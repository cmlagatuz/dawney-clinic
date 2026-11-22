# Operational RLS + signed recovery P2 correction (ASTRA, 22 November 2026)

**Source only; NEVER APPLIED to hosted Supabase.** Frozen PR126 `fd91f7b0e60408764a507df4e1c7efbbd707e5b2`; frozen clinical parent PR124 `ebe6caf8a1f9f17fb00739986b1ebdb83e2d9d0d`. This child fixes **only** independent SOL report [#7068890281](https://github.com/cmlagatuz/dawney-clinic/pull/126#issuecomment-7068890281), P2-A deleted-session direct SELECT, and P2-B absent operational signed restore. CLOUD PR127 is untouched.

## Immutable schema manifest

Exactly the original 19 migration file blobs are preserved, including #18 staff requests/accountant/approval and #19 inventory create/receipt. The **only** new migration, #20 `20261122120000_operational_live_session_read_guard.sql`, is applied after #19. The new fail-closed source guard compares the whole original PR126 tree and every Git SHA, checks the exact new filenames, verifies source SHA256, and refuses an unexpected path or an altered original migration.

## P2-A: direct PostgREST-equivalent SELECT

`clinic_private.operational_read_session_live()` is a private-schema, `STABLE SECURITY DEFINER`, fixed-`search_path` boolean predicate checking fresh `auth.uid()`, token `role`, non-anonymous, account verification/activity via existing `is_permanent_user()`, JWT expiration, well-formed `session_id` and the exact matching **current** `auth.sessions(id,user_id)` row. It never uses `user_metadata`, local storage or client-set branch role.

Five **RESTRICTIVE SELECT** policies AND that predicate with all existing permissive branch/owner policies; they do not grant new SELECT, UPDATE, INSERT, DELETE or EXECUTE of a privileged writer:

- `staff_access_requests`
- `medicine_catalog` (shared authorized-staff catalog; remains global, not per-branch)
- `branch_medicine_rules`
- `branch_stock_batches`
- `stock_movements`

Category, description, supplier, local description/revision from #19 inherit the same RLS. Cost columns remain ungranted. The separate #18 volatile write gate continues to lock `auth.sessions FOR SHARE`; SELECT uses a nonlocking statement-snapshot check compatible with PostgreSQL STABLE/RLS. Do not claim in-flight session deletion can invalidate a transaction's already-established snapshot; PostgREST makes new statements per request.

The P2 workflow executes `operational20_before_fix_repro.sql` **before #20** against actual synthetic pending/revoked staff + Cavite batch/movement rows: an unexpired JWT after its Auth session row is deleted can directly SELECT all five tables, while the staff RPC is denied. Then it applies #20 and runs `operational20_session_rls_pg17.sql`: active authorized Cavite reader positive, committed session deletion, zero operational data via all five tables and added metadata, both RPCs denied, Naga/Cavite branch negatives, pending request, approved distinct accountant, rejected role crossover, zero browser cost/DML grants. Source rows are asserted nonempty before each negative.

## P2-B: complete signed synthetic operational database restore

The dedicated workflow uses an actual disposable PostgreSQL17 server and executes original ordered migrations #1–#19 and additive #20. It retains inherited #16/#17 clinical acceptance and original staff/stock tests. Additional **synthetic** durable rows include one pending request, an accountant approval and receipt, original revoked staff request, original global/branch membership and review receipts/audit, inventory code and opening + 5-unit receipt (Cavite **15 on hand**, Naga independent **3**), stock movements, Dog/Chow Chow and historical requested appointment.

`scripts/recovery/tests/operational20-signed-restore.sh` enforces exactly 20 ordered migrations and captures:
- SHA256 of every migration source file and signed source authority manifest;
- complete row JSON digest of synthetic Auth/session, staff grants/requests/audit/receipts, inventory catalog/rules/batches/movements, clinical and historical pet/appointment data;
- reused **whole-database** PG17 authority/ACL/RLS/policy/trigger and **full SECURITY DEFINER body** SHA256 fingerprints from the already accepted clinical fingerprint generator;
- rollback-only active-actor, branch and accountant denial, existing inventory nonce retry/revised payload rejection, original administrator review nonce retry and unauthorized write/ledger append-only trigger denial.

It runs `pg_dump -Fc`, GPG AES256-encrypts the archive, SHA256-signs the encrypted bytes **and** complete source/authority manifest using ephemeral RSA. Tampered ciphertext, modified manifest or missing signature fail; only verified bytes are decrypted. An independent PG17 database is restored using `pg_restore --no-owner` **without `--no-acl`**. Source/restored data digests, all authority fingerprints and actor behavior must match exactly; full restore is independently repeated into a second database. A deliberate `--no-acl` restore and malicious SECURITY DEFINER routine-body modification must be caught, with body mutation rolled back.

This complements rather than replaces original signed five-component Auth/Storage recovery and clinical #16/#17 signed restore. No live Supabase backup, account sessions or Storage file bytes are tested by this synthetic PG17 workflow.

## Stop gates, rollback and owner authorization

**STOP until independent SOL exact-head PASS.** No RC0 consolidation, migration application, live browser write flags or customer/admin onboarding. Owner must separately authorize controlled synthetic hosted staging tests for ordered missing migration chain, real signed Supabase JWT/session/REST RLS, private Storage and full recovery; a provider database backup/restore rehearsal remains required before any real import/patient/inventory use. Neither this script nor a branch preview touches hosted services. No paid resources, real data, self-merge or automatic first-admin bootstrap.

Rollback for the isolated CI databases is deleting the disposable PostgreSQL17 service; migration #20 RLS must **not** be casually reversed in hosted systems because removal would reopen the known deleted-session disclosure. Hosted rollback requires separately owner-approved backup restore of Postgres/Auth/Storage and verification of historical Dog/Chow Chow patient, appointment and immutable operational receipts.
