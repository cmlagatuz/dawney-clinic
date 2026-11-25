# Manual Supabase backup and guarded restore preparation (draft)
Authority: PM directive [7163440393](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7163440393); frozen RC1 2e029697fc2c446171a951167b30bcf7679c286e. This is a manually launched tool, not a server, scheduled backup or new release candidate. No hosted collection or restoration is authorized by this document. No dedicated recovery computer is required; use an existing trusted Windows computer with WSL Linux filesystem on encrypted storage. A separately approved compatible independent destination is still necessary to prove restore; neither current hosted project can be overwritten, and a third free project is not assumed.

## One-time setup
Use Python 3.12, Node 22 (existing verifier), GnuPG 2.4, PostgreSQL 17 client, Supabase CLI exactly 3.0.0 (check versions, use official release distributions; CLI dump may need existing Docker-compatible runtime). Do not install a permanent Supabase stack for backup. The PostgreSQL client and provider versions must be compatible. The supplied utility checks the recorded PG major/CLI version, not the actual installed versions of collection tools. Run from WSL, not the Windows-mounted or repository filesystem; enforce encrypted disk and mode 700 private directories. Import the owner encryption public key and independently verify the full signing fingerprint through an out-of-band channel. Keep signing/decryption keys private, passphrases in GPG agent, never in command arguments or GitHub. Review official docs below; do not upgrade tools blindly.
- [Current CLI v3 targeting behavior](https://supabase.com/changelog/supabase-cli-v3)
- [Official logical backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Storage downloads](https://supabase.com/docs/guides/storage/management/download-objects)
- [Database backup limitations](https://supabase.com/docs/guides/platform/backups)

## Backup: collect, pack, verify
Only after owner approves the precise source and cutoff, pause application writes and object changes for a coordinated collection window. Check source ref in Dashboard and in every CLI target. Store no credentials or logs containing credentials; use official private CLI authentication, no URL/password on shell command line. Commands are examples for authorized collection, NOT executed in this PR. Use explicit v3 remote project ref, never implicit linked/local defaults. Check `supabase --version`, `supabase db dump --help`, and each Target line; stop if mismatch, export error, permission error, unsupported table or version difference. The CLI invokes a supported filtered logical dump; do not substitute raw dumps of managed internals.
```bash
umask 077
mkdir -m 700 -p ~/dawney-manual/{collection,backups,work}
cd ~/dawney-manual/collection
mkdir -m 700 application auth-identities storage-metadata storage-objects configuration
# set REF to the exact independently confirmed source project ref
supabase db dump --remote="$REF" --role-only -f application/roles.sql
supabase db dump --remote="$REF" -f application/schema.sql
supabase db dump --remote="$REF" --data-only --use-copy -x 'storage.buckets_vectors' -x 'storage.vector_indexes' -f application/data.sql
supabase db dump --remote="$REF" --schema supabase_migrations -f application/history_schema.sql
supabase db dump --remote="$REF" --schema supabase_migrations --data-only --use-copy -f application/history_data.sql
supabase db dump --remote="$REF" --schema auth --data-only --use-copy -f auth-identities/auth.sql
supabase db dump --remote="$REF" --schema storage --data-only --use-copy -x 'storage.buckets_vectors' -x 'storage.vector_indexes' -f storage-metadata/storage.sql
```
Review actual output privately for managed schema/data coverage. The scoped Auth and Storage dumps are **inspection evidence**, may overlap application/data.sql, and must never be blindly replayed twice. If the CLI filters them or they lack identity/metadata coverage, stop; use the official provider-supported migration path rather than inventing a dump. Vector Storage exclusions are only appropriate if confirmed unused; otherwise stop and obtain supported coverage. Compare source identity counts/UUIDs, object metadata, history, ACLs/RLS and routine/trigger inventory privately. For application/managed_changes.sql, collect and review provider-managed Auth/Storage customizations (official CLI diff and exact reviewed migrations, including policies/triggers); a documented no-change SQL comment is acceptable only after actual review. CLI diff alone can omit some managed schema objects. Never remove policies or ACLs just to restore. Record missing or unsupported objects and do not attest coverage until resolved.

Download every authorized Storage object using Dashboard or an official S3-compatible client with privately configured credentials (no changes to permissions/settings unless separately approved). Save original bytes under storage-objects/<bucket>/<object path>. Use an independent complete source object listing and compare all downloaded paths/counts/bytes. Create storage-metadata/objects.json as a JSON array of {"path":"bucket/object.ext","bytes":123,"sha256":"<64 lowercase hex>"} entries; calculate SHA256 of downloaded bytes using sha256sum or Get-FileHash and compare against independent source checksum evidence where available. Empty array only for confirmed empty inventory. Names unsupported by the portable path rules (non-ASCII, reserved Windows names, case collisions, etc.) cause STOP; do not silently rename. This release uses manual inventory collection, not automatic S3 enumeration, and cannot prove the owner listed every source object.

Create configuration/inventory.json:
```json
{
  "source": "<exact source ref>",
  "cutoff_utc": "2026-11-25T00:00:00Z",
  "postgres_major": 17,
  "cli_version": "3.0.0",
  "auth_storage_versions": "<observed provider versions and compatibility notes>",
  "settings": {
    "auth": "<nonsecret redirect/email/provider settings>",
    "storage": "<bucket privacy, policies, limits>",
    "extensions": "<names and versions>",
    "realtime": "<publications>",
    "functions": "<function source/version inventory>",
    "network": "<nonsecret SSL and network settings>",
    "secrets_reconfiguration": "<names only; separate owner custody>"
  },
  "coverage_attestation": "operator-reviewed-quiescent-export"
}
```
Replace every example value. Attest only after confirming all five components and the source cutoff; do not include actual API keys, database passwords, SMTP secrets, tokens, encryption root keys or signing private keys. This inventory is not a provider configuration export. Use explicit NONE only for verified unused categories; record unsupported coverage and stop if material.

From the reviewed repository directory:
```bash
python3 scripts/recovery/manual-supabase-recovery.py pack ~/dawney-manual/collection ~/dawney-manual/backups --source "$REF" --confirm-source "$REF" --recipient "$RECIPIENT_FPR" --signer "$SIGNER_FPR"
python3 scripts/recovery/manual-supabase-recovery.py verify <backup-folder> ~/dawney-manual/work --source "$REF" --confirm-source "$REF" --signer "$SIGNER_FPR"
```
Supply independently checked uppercase 40-hex fingerprints. Confirm source manually, not by copying an unknown value; separate trusted signer confirmation is essential. The folder contains five GPG-encrypted ZIP components and a detached signed existing-format manifest with ciphertext sizes/hashes. Copy the entire folder to independent encrypted owner-held media and verify again using a separately trusted signer and authorized decryption key. No plaintext in GitHub, no cloud upload. The temporary plaintext ZIPs and decrypted files must be on encrypted private storage; deletion is not secure erasure. Clean up the original collection securely according to clinic policy. Integrity verification does not establish source completeness, provider restore compatibility or measured recovery.

## Restore: prepare only, no hosted SQL or upload
After separate owner approval of an independent empty compatible destination, use:
```bash
python3 scripts/recovery/manual-supabase-recovery.py prepare-restore <backup-folder> ~/dawney-manual/work --source "$REF" --confirm-source "$REF" --signer "$SIGNER_FPR" --destination "$DEST" --confirm-destination "$DEST" --approval OWNER-APPROVED-PREPARE-ONLY
```
The utility refuses the two existing clinic hosted project refs, same source/destination, mismatched confirmations, invalid signature, missing/corrupt bytes and synthetic/hosted mixing. It writes only decrypted files and a PREPARED_ONLY_NO_SQL_EXECUTED plan to the private directory. It cannot verify a real destination exists or is empty; owner must independently confirm this. It never connects to or restores any hosted database.

For actual restoration, follow the official logical import guide on the separately authorized destination only: check compatible PG17/provider extensions and managed Auth/Storage schemas; review roles/schema/data in provider-prescribed order using psql with ON_ERROR_STOP and transactional restore where supported; reconcile migration history and managed customizations separately without duplicate replay. Review default grants/ACLs and new role passwords before enabling access. Use the supported Storage API/S3 upload workflow to reconstruct actual objects and compare metadata and bytes; never write directly into Storage metadata as a substitute for object transfer. Verify identity mapping, fresh login (old tokens are not guaranteed portable), owner/branch isolation, clinical history, grants, policy and routine/trigger definitions, object bytes and ledger/nonce behavior. Do not skip errors, disable application protections or apply a destructive default command. Stop on mismatch, unsupported components or missing approval. Keep destination disconnected from real clients until accepted. If no compatible independent destination is available, retain verified backups and report RESTORE NOT VERIFIED.

## Coverage and limits
Existing backup-clinic.sh remains an application-only export; it omits ownership/ACLs and provider components. New utility packages provider-supported logical roles/schema/data, separate Auth/Storage evidence, actual downloaded objects, migration history, reviewed managed customizations and manual config inventory. It is not physical backup/PITR or proof of complete managed project cloning. Managed services, API keys, secrets, encryption root keys, functions/config, sessions, Storage ownership mapping and external services can require supported separate migration/reconfiguration. No secrets collected by the utility. No guarantee of cross-component snapshot consistency without operator quiescence. No third free slot, no permanent machine, no paid services. Existing accepted disposable recovery evidence: [signed five-component](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609708904), [operational restore](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609708931), [appointment21](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609709211). New regression tests use synthetic data only, not provider acceptance. Frozen RC1 remains unchanged.
