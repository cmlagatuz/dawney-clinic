# Phase 4 — Source, dependency, workflow and branch-security audit

**Checkpoint:** 2026-11-13. Read-only GitHub review and new static CI guard; no hosting/database changes, no release tags. Current code is still an unverified clinical preview.

## Repository findings

| Area | Verified finding | Action |
| --- | --- | --- |
| Default branch | `master` used; GitHub branch API reported **`protected=false`** at audit | Owner must enable branch protection / ruleset in GitHub dashboard |
| History | [unrelated-histories merge `65032983`](https://github.com/cmlagatuz/dawney-clinic/commit/650329834fb03943abcd226cdcc4df787b0bcda5) has Git tree `32048b53`, identical to **both** its parents (`c4e45965`, `d5c4f631`) | Preserve history; **never force-push or reset master** |
| Legacy PR #1 | Old Laravel Blade UI remains separate and unmerged | Never merge merely to preserve old visual code; Claude may use as reference |
| React/Vite | Exact pinned direct dependency versions in `web/package.json`, committed npm lockfile, Node 22 Vite build | New guard checks pinning and lock presence; **CVE advisories are not determined by pinning alone** |
| Laravel | Laravel 5.8 / PHP 7.4-era test runtime and Composer 1 remain historical EOL risk | Keep legacy unhosted. Any replacement/upgrade requires a separate reviewed migration, not a silent patch |
| GitHub Actions | Existing code uses checkout/setup-node, with a special tag-only `github-release` writer | Add explicit `contents:read` to legacy/React checks; retire obsolete write-capable one-time lock-generation job now that lock exists. Tag-only release job keeps narrowly scoped write permission |
| Secrets/files | No authentic clinical credentials or backup artifact are required in PR CI | Fail new offline checks if sensitive filenames, obvious embedded private key/DB URL, or floating npm versions are tracked |
| Cloudflare | No verified Pages project/URL/provider deployment was available at the checkpoint | Connect only Free Git integration, verify actual URL and browser/rollback externally |
| Supabase | Auth two-account and read-only RLS smoke already passed; private Storage HTTP deny and full recovery remain pending | No DB/schema changes in this audit |

## Security guard behavior

Run from repo root:
```bash
node --test scripts/security/tests/*.test.mjs
node scripts/security/repository-guard.mjs
```
`.github/workflows/phase4-repository-security.yml` repeats these in no-secret/no-network CI on relevant source/CI changes. The guard checks only tracked filenames, selected obvious secret signatures and **direct** npm version pins plus lockfile. This is deliberately a conservative check and **not**:
- GitHub Advanced Security or full secret scanning of the entire Git history, forks, binaries or untracked files
- an npm/Composer vulnerability audit, SBOM, SAST, penetration test or real Supabase credential scan
- a guarantee that Action tags remain unmodified or a guarantee that Free providers are available

If a credential ever appears in a public commit, **rotate/revoke it immediately**; deleting the file or resetting Git history is not an adequate response. Do not post the credential in issue logs.

## Owner-only GitHub branch protection (not executed)

1. GitHub repo → **Settings → Branches** (or **Rules → Rulesets** when offered) → **Add rule** targeting exactly `master`.
2. Require a pull request before merging; keep owner-approved review rules compatible with the two-agent free workflow. Enable **require status checks**, selecting the always-run `Legacy PHP checks / php-syntax` and `Legacy PHP checks / legacy-regression` checks (confirm exact displayed GitHub check names). Other path-filtered browser/recovery/release/policy checks should be inspected on relevant PRs, but do not mark a conditional check required for every PR unless it runs for every PR.
3. Disallow force-push and deletion; restrict bypass to explicitly authorized owner/emergency roles and record who can modify workflow files. Consider signed commits and 2FA/MFA for all collaborators.
4. Test the policy with a harmless scoped PR: confirm direct push is blocked but a verified squash merge is allowed. **Do not test by force-pushing master.** Record the rule ID and exact effective state in `docs/AI_HANDOFF.md`.
5. Review GitHub → **Settings → Security**: enable available free Dependabot vulnerability alerts/security advisories and secret scanning options if offered; do not enable paid GitHub features without explicit approval. Manage GitHub Actions repo Secrets in the GitHub dashboard and limit who may dispatch workflows.

## Remaining owner/engineer work

- Inspect versioned transitive npm security advisories with `npm audit` on a trusted connected environment, resolve critical/high issues in separate scoped lockfile PRs after compatibility review. Confirm Laravel dependency EOL exposure; PHP must not be placed on Pages static hosting.
- Review Action SHA pinning, public preview exposure, dependency integrity, Cloudflare deploy protections and real browser/clinic-record test gates. Privacy and compliance decisions belong to actual clinic owner.
- Keep the Auth/Storage synthetic-write smoke opt-in and an isolated full Auth+Storage restore rehearsal before any go-live.
