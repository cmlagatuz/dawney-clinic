#!/usr/bin/env node
/**
 * CLOUD: portable Node/Windows/Linux profile selection. Builds are public
 * STATIC artifacts, not deployment. Backend URL + publishable key are never
 * proof of Auth/RLS/Storage, clinic policies, release approval or availability.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { releaseCapabilities, resolveReleaseProfile } from '../src/release-profile.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const [action, requestedProfile] = process.argv.slice(2)
const mode = resolveReleaseProfile(requestedProfile)
if (!['build', 'test'].includes(action) || !['informational', 'connected'].includes(requestedProfile)) {
  console.error('Usage: node scripts/release-cli.mjs build informational|connected; test connected')
  process.exit(2)
}
if (action === 'test' && mode !== 'connected') {
  console.error('Use the two-track release suite to test both profiles; the inherited full frontend suite requires connected synthetic fixtures')
  process.exit(2)
}
const flags = ['VITE_PHASE4_PATIENT_FORM', 'VITE_PHASE5A_OPS_UI', 'VITE_CLINICAL_WORKSPACE_UI',
  'VITE_PHASE5B_PHARMACY_UI', 'VITE_PHASE5C_BILLING_UI']
const env = { ...process.env, VITE_RELEASE_PROFILE: mode }
if (action === 'build') {
  if (mode === 'informational') {
    // This build intentionally needs no Supabase. Never inherit CI/Pages
    // credentials or any unapproved private feature flag into Profile A.
    delete env.VITE_SUPABASE_URL
    delete env.VITE_SUPABASE_PUBLISHABLE_KEY
    for (const name of flags) env[name] = 'false'
  } else {
    const url = env.VITE_SUPABASE_URL?.trim()
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url ?? '') ||
        !/^sb_publishable_[A-Za-z0-9_-]{1,}$/.test(key ?? '')) {
      console.error('Profile B requires an explicitly provided public Supabase URL and publishable key. No build performed.')
      process.exit(2)
    }
    if (flags.some(name => env[name] === 'true')) {
      console.error('Two-track public release excludes private/staff/clinical/pharmacy/billing preview flags. No build performed.')
      process.exit(2)
    }
  }
}
const caps = releaseCapabilities(mode, mode === 'connected')
if (caps.canConfirmAppointments || caps.canEnableBilling || caps.canEnableClinicalWrites) {
  console.error('Unsafe release capability manifest')
  process.exit(2)
}

function run(script, args) {
  const binary = resolve(root, 'node_modules', script)
  const proc = spawnSync(process.execPath, [binary, ...args], {
    cwd: root, env, stdio: 'inherit', windowsHide: true
  })
  if (proc.error) {
    console.error('Local test/build tool unavailable')
    process.exit(1)
  }
  if (proc.signal || proc.status !== 0) process.exit(proc.status ?? 1)
}
if (action === 'test') {
  const files = readdirSync(join(root, 'tests'))
    .filter(name => name.endsWith('.test.mjs')).map(name => join(root, 'tests', name))
  const proc = spawnSync(process.execPath, ['--test', ...files], {
    cwd: root, env, stdio: 'inherit', windowsHide: true
  })
  if (proc.error || proc.signal || proc.status !== 0) process.exit(proc.status ?? 1)
} else {
  run(join('typescript', 'bin', 'tsc'), ['--noEmit'])
  run(join('vite', 'bin', 'vite.js'), ['build'])
  console.log('CLOUD source-only static build complete: '+mode+' profile; no deployment or authorization inferred.')
}
