# Manual Supabase backup and guarded restore preparation (draft)
Authority: PM directive [7163440393](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7163440393); frozen RC1 2e029697fc2c446171a951167b30bcf7679c286e. This is a manually launched tool, not a server, scheduled backup or new release candidate. No hosted collection or restoration is authorized by this document. No dedicated recovery computer is required; use an existing trusted Windows computer with WSL Linux filesystem on encrypted storage. A separately approved compatible independent destination is still necessary to prove restore; neither current hosted project can be overwritten, and a third free project is not assumed.

## Quick start — one manually launched menu

On an existing trusted Windows computer, open WSL. Install the documented tools once and import independently verified owner keys. Keep the workspace on an encrypted Linux filesystem outside the repository (not /mnt/c). From the reviewed repository:

```bash
mkdir -m 700 -p ~/dawney-manual
python3 scripts/recovery/manual-supabase-recovery.py guide ~/dawney-manual
```

**Each backup:** select **1 Create backup**; confirm source twice, trusted signer and encryption key; confirm owner approval, encrypted disk and sufficient space. The menu checks actual local Python 3.12, Node 22, GnuPG 2.4+, Supabase CLI 3.0.0, PostgreSQL 17 client versions and performs an actual local encryption/decryption/signing challenge. The disk check is only a minimum startup floor (64 MiB), not a dataset capacity estimate. Verify adequate space for source files, ZIP scratch, ciphertext and independent copies before continuing. It creates a new timestamped, randomly suffixed collection folder every time. Follow the authorized collection checklist below in that exact folder; keep the menu open. It will not run provider commands. Supply the independently obtained source listing as JSON outside the collection folder, with path and byte count, optionally source SHA256. The menu calculates local SHA256 values and checks exact path/size parity and supplied source hashes. Complete the configuration inventory and explicitly attest source coverage and quiescence only after review. It packages and signs the five components. Failed collection stays private; never reuse an old folder as a new cutoff.

**After backup:** copy the whole backup directory to independent encrypted owner-held media. Launch the menu, choose **2 Verify backup**, independently confirm the trusted signer and source, select the copied folder. **3 Prepare restore** is a separate owner-approved action; confirm a different compatible independent destination. It only prepares local decrypted files; actual import and object transfer remain manual and separately authorized. No dedicated recovery computer or background service.

| Status | Meaning / action |
|---|---|
| COLLECTION_INCOMPLETE | Finish missing exports or reconcile object listing and config; no complete package claimed. |
| SOURCE_MISMATCH / DESTINATION_MISMATCH | Independently confirm the exact project; do not relabel an archive or reuse either existing hosted destination. |
| SIGNATURE_INVALID | Obtain original signed manifest and independently trusted owner public key. |
| BACKUP_CORRUPT | Use a verified intact copy; do not repair ciphertext or bypass hash checks. |
| VERSION_MISMATCH / KEY_NOT_READY / TOOL_FAILURE | Check documented versions, GPG agent and local permissions/capacity; no raw tool output or sensitive paths in errors. |
| PACKAGE CREATED | Signed encrypted folder exists; independent verification still required. |
| INTEGRITY VERIFIED | Five-component integrity checked; provider coverage remains operator-attested. |
| PREPARED ONLY | Local restore files prepared; no SQL or Storage upload executed. |
| RESTORE NOT VERIFIED | Actual independent provider acceptance not executed. |

No automatic claim of provider completeness. No actual hosted collection or import has been tested or authorized. The guided menu removes recurring manual checksum assembly, not the need for authorized provider collection and independent source inventory.

## One-time setup
Use Python 3.12, Node 22 (existing verifier), GnuPG 2.4, PostgreSQL 17 client, Supabase CLI exactly 3.0.0 (check versions, use official release distributions; CLI dump may need existing Docker-compatible runtime). Do not install a permanent Supabase stack for backup. The PostgreSQL client and provider versions must be compatible. The guided menu checks actual local tool versions before collection; low-level pack validates the recorded PG major/CLI version, not installed collection tools. Run from WSL, not the Windows-mounted or repository filesystem; enforce encrypted disk and mode 700 private directories. Import the owner encryption public key and independently verify the full signing fingerprint through an out-of-band channel. Keep signing/decryption keys private, passphrases in GPG agent, never in command arguments or GitHub. Review official docs below; do not upgrade tools blindly.
- [Current CLI v3 targeting behavior](https://supabase.com/changelog/supabase-cli-v3)
- [Official logical backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Storage downloads](https://supabase.com/docs/guides/storage/management/download-objects)
- [Database backup limitations](https://supabase.com/docs/guides/platform/backups)

## Backup: collect, pack, verify
Only after owner approves the precise source and cutoff, pause application writes and object changes for a coordinated collection window. Check source ref in Dashboard and in every CLI target. Store no credentials or logs containing credentials; use official private CLI authentication, no URL/password on shell command line. Commands are examples for authorized collection, NOT executed in this PR. Use explicit v3 remote project ref, never implicit linked/local defaults. Check `supabase --version`, `supabase db dump --help`, and each Target line; stop if mismatch, export error, permission error, unsupported table or version difference. The CLI invokes a supported filtered logical dump; do not substitute raw dumps of managed internals.
```bash
umask 077
# Change into the fresh collection directory printed by the guided menu.
# The menu has already created all five component directories.
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

Download every authorized Storage object using Dashboard or an official S3-compatible client with privately configured credentials (no changes to permissions/settings unless separately approved). Save original bytes under storage-objects/<bucket>/<object path>. Use an independent complete source object listing and compare all downloaded paths/counts/bytes. Save an independent source-list JSON array of {"path":"bucket/object.ext","bytes":123} entries (optional "sha256" from independent source evidence) outside the collection folder. The guided menu generates storage-metadata/objects.json and verifies listing-to-download parity. Never derive the independent list solely from the downloads. For low-level pack without the menu, prepare the same inventory with SHA256 values manually. Empty array only for confirmed empty inventory. Names unsupported by the portable path rules (non-ASCII, reserved Windows names, case collisions, etc.) cause STOP; do not silently rename. This release uses manual inventory collection, not automatic S3 enumeration, and cannot prove the owner listed every source object.

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

The guided menu packages and verifies through the existing primitives. Advanced standalone commands (create private output and work directories first; set COLLECTION to the fresh folder):
```bash
python3 scripts/recovery/manual-supabase-recovery.py pack "$COLLECTION" ~/dawney-manual/backups --source "$REF" --confirm-source "$REF" --recipient "$RECIPIENT_FPR" --signer "$SIGNER_FPR"
python3 scripts/recovery/manual-supabase-recovery.py verify <backup-folder> ~/dawney-manual/verification --source "$REF" --confirm-source "$REF" --signer "$SIGNER_FPR"
```
Supply independently checked uppercase 40-hex fingerprints. Confirm source manually, not by copying an unknown value; separate trusted signer confirmation is essential. The folder contains five GPG-encrypted ZIP components and a detached signed existing-format manifest with ciphertext sizes/hashes. Copy the entire folder to independent encrypted owner-held media and verify again using a separately trusted signer and authorized decryption key. No plaintext in GitHub, no cloud upload. The temporary plaintext ZIPs and decrypted files must be on encrypted private storage; deletion is not secure erasure. Clean up the original collection securely according to clinic policy. Integrity verification does not establish source completeness, provider restore compatibility or measured recovery.

## Restore: prepare only, no hosted SQL or upload
After separate owner approval of an independent empty compatible destination, use:
```bash
python3 scripts/recovery/manual-supabase-recovery.py prepare-restore <backup-folder> ~/dawney-manual/work --source "$REF" --confirm-source "$REF" --signer "$SIGNER_FPR" --destination "$DEST" --confirm-destination "$DEST" --approval OWNER-APPROVED-PREPARE-ONLY
```
The utility refuses the two existing clinic hosted project refs, same source/destination, mismatched confirmations, invalid signature, missing/corrupt bytes and synthetic/hosted mixing. It writes only decrypted files and a PREPARED_ONLY_NO_SQL_EXECUTED plan to the private directory. It cannot verify a real destination exists or is empty; owner must independently confirm this. It never connects to or restores any hosted database.

For actual restoration, follow the official logical import guide on the separately authorized destination only: check compatible PG17/provider extensions and managed Auth/Storage schemas; review roles/schema/data in provider-prescribed order using psql with ON_ERROR_STOP and transactional restore where supported; reconcile migration history and managed customizations separately without duplicate replay. Review default grants/ACLs and new role passwords before enabling access. Use the supported Storage API/S3 upload workflow to reconstruct actual objects and compare metadata and bytes; never write directly into Storage metadata as a substitute for object transfer. Verify identity mapping, fresh login (old tokens are not guaranteed portable), owner/branch isolation, clinical history, grants, policy and routine/trigger definitions, object bytes and ledger/nonce behavior. Do not skip errors, disable application protections or apply a destructive default command. Stop on mismatch, unsupported components or missing approval. Keep destination disconnected from real clients until accepted. If no compatible independent destination is available, retain verified backups and report RESTORE NOT VERIFIED.

## Acceptance scope
TERRA-BACKUP-01 correction: distinct safe status codes, first-run guided menu, version and actual key challenge, per-cutoff folders and independent listing helper. New synthetic regression exercises menu and real crypto; version command responses are simulated in CI. No Windows host or real provider exports tested. The approved RC1 remains frozen.

## Coverage and limits
Existing backup-clinic.sh remains an application-only export; it omits ownership/ACLs and provider components. New utility packages provider-supported logical roles/schema/data, separate Auth/Storage evidence, actual downloaded objects, migration history, reviewed managed customizations and manual config inventory. It is not physical backup/PITR or proof of complete managed project cloning. Managed services, API keys, secrets, encryption root keys, functions/config, sessions, Storage ownership mapping and external services can require supported separate migration/reconfiguration. No secrets collected by the utility. No guarantee of cross-component snapshot consistency without operator quiescence. No third free slot, no permanent machine, no paid services. Existing accepted disposable recovery evidence: [signed five-component](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609708904), [operational restore](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609708931), [appointment21](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609709211). New regression tests use synthetic data only, not provider acceptance. Frozen RC1 remains unchanged.
