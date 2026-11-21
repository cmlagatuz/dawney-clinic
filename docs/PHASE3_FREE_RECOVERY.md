# Phase 3 free-only recovery foundation

**Owner-operated, not deployed.** This milestone adds a conservative encrypted backup and archive verification toolkit in `scripts/recovery/`. No real clinic data or secret has been exported, and no live database migration is performed by these scripts.

## Why backups must be separate

Supabase Free does **not** include managed automatic backups or point-in-time recovery. The clinic requires an independent, offline, encrypted and verified recovery strategy before any live patient data is accepted. See the [Supabase pricing matrix](https://supabase.com/pricing).

The supplied `backup-clinic.sh` exports only `public` and `clinic_private` PostgreSQL schemas, with custom-format `pg_dump`, checks the archive manifest, encrypts with a pre-existing owner-controlled **GPG public key** and stores a SHA-256 integrity file. It never places database passwords on the command line or writes plaintext dumps to GitHub. An ephemeral local plaintext dump is deleted on exit; run on an encrypted local machine, not a multi-user server.

**Critical coverage gap:** This is not a full Supabase disaster backup. It **does not export** Supabase-managed `auth.users`/login identities, Storage object bytes, provider configuration or secrets, or an exportable recovery history of the platform. FKs to `auth.users` mean the application dump cannot be restored standalone into an empty vanilla Postgres instance. Full recovery requires a separately approved Supabase-compatible test environment plus Auth identity/re-onboarding plan and authenticated Storage API export. Do **not** use a false claim that a plain `pg_restore` would recreate a working clinic system.

## Operator prerequisites

1. A local, trusted Linux/macOS machine with free PostgreSQL client binaries (`pg_dump`, `pg_restore`), GnuPG, `sha256sum`, `bash`, `stat`, and adequate encrypted free disk space.
2. Approved Supabase database connection values via the dashboard only. Use a private `.pgpass` file (`chmod 600 path`), an owner-owned public GPG key and its 40-character fingerprint. Never paste database credentials, `.pgpass`, recovery private keys, patient data or dump files into GitHub/ChatGPT.
3. On the local terminal, set `PGHOST`, `PGUSER`, `PGDATABASE`, optional `PGPORT`, `PGPASSFILE`, `DAWNEY_BACKUP_RECIPIENT_FPR` and `DAWNEY_BACKUP_DIR`. Use a connection path supported by the owner's network. The script enforces `PGSSLMODE=require`.
4. Run `bash scripts/recovery/backup-clinic.sh`. Keep both `.pgdump.gpg` and `.sha256` together on two physically separate private encrypted media, plus owner-held recovery private key backup.
5. Run `bash scripts/recovery/verify-archive.sh /private/path/filename.pgdump.gpg` on an owner-controlled system with the private GPG key. The script checks ciphertext SHA-256 and decrypts into a private temporary directory for `pg_restore --list`. **This does not test a restore.**
6. Perform a separate actual isolated **Supabase-compatible** restore using safe provider-supported tools with auth users and Storage bytes accounted for. Reconcile table counts, orphan relationships, RLS with two signed-in accounts, file access and business recovery time before clinical go-live. Never run `pg_restore --clean` on the live Supabase project.

## Recommended zero-paid operating schedule

- Export app schemas daily and before migrations, encrypted at rest, with at least weekly offline rotation and two independent owner-controlled copies.
- Re-check decrypted archive structures each time; verify restore at least monthly, and **before** any production cutover.
- Keep encrypted files out of cloud public URLs and repository artifacts; clinic-specific legal/privacy retention needs owner approval.
- Document measured recovery point and recovery time objectives only after a full restore drill. Free hosting may pause after inactivity and cannot guarantee uninterrupted medical availability.

## Tests and evidence

`node --test scripts/recovery/tests/recovery.test.mjs` runs local Bash syntax checks, missing-environment fail-closed checks and a mocked export/encryption/verification pipeline using fake `pg_dump`, `pg_restore` and `gpg` executables. It proves script control flow only, **not** actual database backup integrity, GPG cryptography strength, provider connectivity or isolated recovery. Those remain owner-gated tests.