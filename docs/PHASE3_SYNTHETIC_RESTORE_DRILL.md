# Phase 3 — Disposable PostgreSQL 17 + GPG restore rehearsal

**Owner:** ChatGPT · **Synthetic-only CI test**. This is NOT a real Supabase clinical database backup or full disaster recovery proof.

## What this adds

`.github/workflows/phase3-recovery.yml` runs a new **isolated-postgres-drill** alongside the existing mock unit tests.

- Starts a disposable local PostgreSQL 17 service, with a static CI-only password that is **not** a credential for the Supabase project.
- Creates two synthetic public patient rows and one synthetic private legacy-mapping row in `clinic_source` on that disposable service.
- Generates a disposable GnuPG private/public encryption key under `RUNNER_TEMP`.
- Executes the project's **actual** `scripts/recovery/backup-clinic.sh` with real `pg_dump` and `pg_restore` binaries provided by a matching PostgreSQL 17 Docker image. The test uses local Docker wrappers to disable SSL for its **localhost-only** database; the production script still requires SSL for hosted connections.
- Executes the actual `scripts/recovery/verify-archive.sh`, verifies the encrypted archive checksum, and checks that tampering the ciphertext causes verification to fail.
- Decrypts the real archive and performs `pg_restore --exit-on-error` into a separate, empty `clinic_restored` database, then reconciles synthetic table row counts in public and `clinic_private`.
- Cleans ephemeral local data and GPG keys on runner exit. It never fetches, writes, logs, or exports **real** Supabase Auth users or clinical rows.

## What this test proves and does not prove

If the GitHub Actions job succeeds, it proves the actual bash export, genuine GnuPG encryption and checksum verification, PostgreSQL custom archive inspection, isolated restore mechanism and synthetic row reconciliation work on PostgreSQL 17. This significantly improves on the earlier mock-only tests.

It does **not** establish a complete real Supabase restore: the synthetic service does not implement Supabase-managed `auth.users`, Auth Sessions, secrets, JWT signing keys, Storage bucket object bytes, Edge Functions or full metadata. The existing actual clinic schema has FKs to `auth.users`; a standalone app-only dump cannot build a fully usable clinic database. A full owner-authorized Supabase-compatible export/restore plus private Storage recovery remains a strict release blocker.

No additional database migrations, provider costs or hosting services were created. Do not use GPG keys created by this CI test for a real backup.

## Required future full restore rehearsal (owner-controlled)

1. Arrange an authorized isolated, Supabase-compatible destination or owner-operated local Supabase environment; protect patient records and follow relevant privacy rules.
2. Record the source MySQL migration archive and new Supabase app/Auth/Storage backup scope. Store credentials and encrypted files exclusively on owner-controlled private systems, never GitHub.
3. Restore Auth identities/relationships and Storage binary objects through provider-supported paths; handle unique identity linking and staff permissions without transplanting live signing secrets into unsafe systems.
4. Restore app schemas with verified constraints/RLS, reconcile source/restored counts and legacy IDs, then run two **real** authenticated test sessions against the restored environment.
5. Record recovery duration, lost-data window, restore checksums, actual clinical record completeness and owner approval. Do not promise RTO/RPO or cutover readiness until observed.

**Status:** actual isolated *synthetic* restore verified only after GitHub CI succeeds; real full Supabase restore is pending.
