# Phase 3 → Phase 4: complete free-only recovery runbook (owner-controlled)

**Status: plan + offline ciphertext integrity verifier, not a real Supabase restore.**
No live data, Auth identities, Storage objects or secrets have been exported. No production database restoration is authorized. A synthetic PostgreSQL 17/GPG app-only isolated restore has passed ([CI evidence](PHASE3_SYNTHETIC_RESTORE_DRILL.md)), but that does **not** prove this full plan works.

## Recovery boundary and free-only constraints

Supabase Free does not provide an owner-controlled guaranteed PITR/managed backup SLA. The existing `scripts/recovery/backup-clinic.sh` exports **only** application schemas `public` and `clinic_private`, encrypted using the owner's GPG public key. Recovery of Auth, Storage and hosted configuration is a **separate obligation**. Cloudflare Pages can roll back **frontend only** and cannot repair Supabase data. Never restore over active production.

Before any real patient/staff data, owner must approve a legal retention regime, an isolated Supabase-compatible restore destination, independent offline keys, and a complete verified backup-and-restore rehearsal. Free allocations may limit the ability to host two concurrent projects; a trusted local Supabase stack with free tools may be required. **Do not buy a plan automatically.**

Current provider guidance:
- [Supabase: backup and restore using CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) — distinguish application-only `pg_dump` from supported project migration.
- [Supabase: restore dashboard backup](https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore) — restoring metadata does not restore Storage file bytes.
- [Supabase: Storage security](https://supabase.com/docs/guides/storage/security/access-control) — object downloads/uploads still obey permissions.
- [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/) — only successful production deployments are rollback targets.

## Required **five** independently encrypted evidence components

| Key in offline manifest | Contents held by owner only | Restoration considerations |
| --- | --- | --- |
| `application` | Existing GPG-encrypted `public` + `clinic_private` app schema/data dump | Needs Auth identities/FKs restored first; RLS, functions and triggers must match applied migrations |
| `auth-identities` | Authorized, encrypted **provider-supported** Auth export/identity mapping + recovery plan | Preserve UUID/FKs where supported; Auth secrets/sessions and MFA cannot be assumed portable; force-safe re-authentication or re-enrolment where needed |
| `storage-metadata` | Authorized encrypted Storage bucket/object metadata and inventory, including private bucket policy/mime/size/settings | SQL metadata is not file bytes; reinstate migrations/policies and bucket rules |
| `storage-objects` | Encrypted copy of **actual private file bytes** with object-path ownership and per-object SHA-256 inventory; an encrypted empty inventory when empty | Export/download through approved Storage interfaces, not direct writes to `storage.objects`; restore via approved Storage API and recheck hashes/RLS |
| `configuration` | Encrypted, human-reviewed operational configuration **inventory** (project region/ref, Auth provider and SMTP settings, Site URL and exact redirect list, policies, scheduled jobs, Pages config, MFA/secret rotation tasks) | Do not archive plaintext service keys/passwords; regenerate/reissue credentials via trusted dashboard and record access controls offline |

All files must be `*.gpg`, encrypted to the owner-controlled recovery key and stored on **two separate private encrypted media**. Do not upload copies to GitHub, CI artifacts, a publicly accessible bucket, chat, or a public Cloudflare URL. Preserve historic MySQL export and authoritative ID mapping separately as its own controlled migration dataset; this plan is not a substitute for validated legacy migration.

## Owner offline recovery-set manifest

Keep a non-sensitive `recovery-set.json` in the **same private directory** as five encrypted files. Fixed JSON fields only: `format` = `dawney-recovery-set`, `version` = `1`, `created_utc` = strict UTC timestamp, and `components` = object with exactly the five keys above. Each component contains only `file` (simple `*.gpg` basename), `bytes` (positive exact encrypted file size) and `sha256` (lowercase 64-character digest of encrypted bytes). No personal identifiers, filenames revealing patients, access tokens or private keys appear in manifest.

Example **structure only** (the digest below is a placeholder; regenerate locally from real ciphertext after authorization):
```json
{
  "format": "dawney-recovery-set",
  "version": 1,
  "created_utc": "2026-11-13T14:00:00Z",
  "components": {
    "application": {"file":"application.pgdump.gpg","bytes":1,"sha256":"<sha256-of-ciphertext>"},
    "auth-identities": {"file":"auth-identities.gpg","bytes":1,"sha256":"<sha256-of-ciphertext>"},
    "storage-metadata": {"file":"storage-metadata.gpg","bytes":1,"sha256":"<sha256-of-ciphertext>"},
    "storage-objects": {"file":"storage-objects.gpg","bytes":1,"sha256":"<sha256-of-ciphertext>"},
    "configuration": {"file":"configuration.gpg","bytes":1,"sha256":"<sha256-of-ciphertext>"}
  }
}
```
Replace every placeholder with **actual** bytes and hash using trusted local tools: `wc -c < file.gpg`, `sha256sum file.gpg`. Then sign the manifest with the owner's **separate** trusted GPG signing key and retain its signature `recovery-set.json.sig` alongside the bundle, for example:
```bash
gpg --local-user "<trusted-signing-key-fingerprint>" --detach-sign --output recovery-set.json.sig recovery-set.json
```
On recovery media independently confirm the signing fingerprint from an out-of-band recorded owner key, then:
```bash
gpg --verify recovery-set.json.sig recovery-set.json
node scripts/recovery/verify-recovery-set.mjs /secure/backup/recovery-set.json
```
The Node tool **never** decrypts or connects to any provider. It rejects missing component coverage, invalid/duplicate/traversal filenames, symlinked ciphertext, wrong sizes, and changed SHA-256 digests. A passing integrity check **does not** prove that encrypted files are decryptable, that exported data is complete, or that signer identity is trusted. The manifest signing step is mandatory for operator-grade evidence but is intentionally **not** performed by the Node tool; record successful detached-signature verification separately. Decrypt and verify actual PostgreSQL archive with existing `verify-archive.sh` using the owner's authorized private key.

## Owner-only complete rehearsal checklist — not yet executed

1. **Authorize** scope, owner identity, lawful access, recipient key and a genuinely isolated destination. Record source snapshot marker, source schema migration versions, expected schema/table counts and private object count/hashes in a private operator ledger; require approval before any export.
2. **Export securely** using current Supabase-supported tools for auth/managed schemas and approved authenticated Storage downloads; produce all five *encrypted* categories. Keep encryption private; protect `PGPASSFILE`, signing/decryption keys and all generated files outside GitHub. `backup-clinic.sh` alone is insufficient.
3. **Inspect offline**: verify detached signature against trusted owner fingerprint, run `verify-recovery-set.mjs`, GPG-decrypt/inspect actual dump structure, verify encrypted Storage artifact inventory and object hashes under an owner-controlled system. If a category cannot be exported lawfully or in a restorable form, **stop and document blocker**.
4. **Restore only to isolated environment** using provider-supported schema/identity procedures: first identity/Auth dependencies or a documented identity-relink plan, then schema/migrations/triggers/RLS/app rows, then private bucket metadata/policies and **file bytes** via Storage interfaces, then Auth redirect/MFA/SMTP configurations with freshly rotated credentials. Do not transplant live JWT signing keys/sessions to insecure systems or assume user passwords/MFA transfer.
5. **Reconcile** exact non-sensitive row counts across 7 public app tables, orphan FKs, staff role audit/last-admin rules, migration ledger, documented RLS policies, file count/size/path/hash and denial of foreign-owner/private Storage reads with **real** two-account JWTs in isolated destination. Rehearse login reset/re-enrolment if Auth identities cannot be transferred safely.
6. **Measure** observed restore time (RTO), snapshot age/data-loss window (RPO), failure/rollback procedure, operator signature and privacy approval. Do not publish a clinic go-live decision until an actual full rehearsal passes.
7. **Preserve** at least two encrypted offline copies, rotate and inspect daily app snapshots / weekly media (clinic must approve retention), repeat restoration monthly and before schema/production changes. Test restoring without depending on a live project still existing.

**Never** run `pg_restore --clean` against the active Supabase project, place privileged credentials into `VITE_*`, directly manipulate `storage.objects` instead of the Storage API, or use a live clinic Auth user as an unaudited disposable test fixture.

## Automated proof and limits

`.github/workflows/phase3-recovery.yml` runs only fake/synthetic offline Node tests and the prior genuine **disposable** PostgreSQL17/GPG app-only restore. The new `verify-recovery-set.mjs` tests use synthetic string files and assert fail-closed behavior for missing/tampered/unsafe backup pieces. Nothing in CI contacts, exports or modifies connected Supabase clinical/Auth/Storage resources.
