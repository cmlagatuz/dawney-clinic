/**
 * Verify that a Vite static bundle is publishable without privileged material.
 * Release/Pages readiness only; not proof of a functional deployed application.
 */
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const forbidden = [
  /sb_secret_/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /DAWNEY_TEST_[AB]_PASSWORD/i,
  /DAWNEY_TEST_[AB]_EMAIL/i,
  // Supabase JS includes the public role identifier "service_role" in SDK code;
  // that literal alone is not a secret. Detect real privileged key formats instead.
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
];
function filesUnder(dir, base = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(dir,entry.name);
    const name = path.posix.join(base,entry.name);
    return entry.isDirectory() ? filesUnder(filename,name) : [{ filename,name }];
  });
}
export function verifyStaticBuild(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw Error('Missing Vite output directory');
  }
  const assets = filesUnder(dir);
  const index = readFileSync(path.join(dir,'index.html'),'utf8');
  if (!index.includes('id="root"') || !index.includes('/assets/')) {
    throw Error('Missing React mount point or Vite assets');
  }
  const headers = readFileSync(path.join(dir,'_headers'),'utf8');
  for (const item of ['Content-Security-Policy:',"default-src 'self'","object-src 'none'",'X-Content-Type-Options: nosniff']) {
    if (!headers.includes(item)) throw Error('Missing required security header: '+item);
  }
  if (!assets.some(a=>a.name.startsWith('assets/') && a.name.endsWith('.js'))) {
    throw Error('No static JavaScript bundle');
  }
  for (const item of assets) {
    if (/(^|\/)\.env(?:\.|$)/.test(item.name) || item.name.endsWith('.map')) {
      throw Error('Unexpected environment or source-map file in distribution');
    }
    const bytes=readFileSync(item.filename);
    const data=bytes.toString('utf8');
    if (forbidden.some(p=>p.test(data))) {
      throw Error('Possible privileged key material in frontend asset: '+item.name);
    }
  }
  return { files: assets.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const {files}=verifyStaticBuild(path.resolve(process.argv[2]??'web/dist'));
    console.log('Static release safety checks passed for '+files+' files.');
  } catch(e) {
    console.error('Static release safety check failed: '+(e instanceof Error?e.message:'unknown'));
    process.exitCode=1;
  }
}
