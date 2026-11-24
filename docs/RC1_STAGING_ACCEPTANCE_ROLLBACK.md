# RC1 — isolated staging acceptance & rollback packet (PREPARED, NOT EXECUTED)

**Authority:** Human clinic owner must separately authorize the exact disposable nonproduction Supabase project, recipient, synthetic actors, SQL migration scope, Auth/Storage byte exports, recovery destination, test cleanup/expiry, acceptable data loss and STOP owner. This file is *not* that authorization. No hosted migration or test has been run from this packet. The project manager reports isolated staging **11 applied** and production **6 applied**; this is PM-provided status, not an independently queried provider snapshot in this branch.

## Source and no-network preflight

- Freeze PR129 `078053120774e856c9ddaa8c8027b3c891e9e8f6`, corrected SOL-passed PR130 `b6ee64b38ca4ce2965f2b02f09a4e5584aa56608` and exactly 21 Git blob hashes in `RC1_MIGRATION_BLOBS.tsv`. Final RC1 child SHA/guard is **pending** PM-accepted frontend hardening.
- The offline preflight `scripts/release/rc1_staging_preflight.sh` accepts only a locally supplied text file with exactly one 14-digit applied migration version per line, ascending; it NEVER connects to Supabase or executes SQL. Do not run this packet until owner approval; its expected example output is the ten missing migration versions #12–#21.
- The trusted, authorized operator uses a fresh `supabase --version`, `supabase --help`, `supabase db --help`, and `supabase migration --help` against a locally configured **staging-only** profile; independently check today's official CLI behavior before deployment. Confirm `supabase_migrations.schema_migrations` versions from a read-only staging query, not an assumed count. Supply a scrubbed versions-only file for the offline guard. Compare prefix before any migration; a mismatch, partial version, altered source blob, additional applied version or production project reference is a HARD STOP.
- No credentials, project refs, JWTs, staff identifiers or database URLs are to be placed in GitHub. Keep production tokens/connection entirely detached and verify target project name and ref on **both** CLI and Supabase Dashboard prior to the owner-authorized action.

## Exact missing migration packet

| # | Pending migration | Git blob SHA (first 12) | Dependency / high-value gate |
| --- | --- | --- | --- |
| 12 | `20261117233500_issue77_four_branch_foundation.sql` | `4732b815cff4` | branch identity and isolation |
| 13 | `20261118203500_issue51_branch_booking_security.sql` | `f58ca0e0bcb3` | booking service/resource and nonce |
| 14 | `20261118215500_issue58_staff_branch_read_contract.sql` | `c889477348d9` | branch staff read + role denied |
| 15 | `20261118225000_issue78_inventory_read_only_foundation.sql` | `908f881bfc54` | read-only FEFO stock |
| 16 | `20261120160000_clinical_chart_encounter_drafts.sql` | `a017d6f11819` | clinical draft encounter |
| 17 | `20261120221000_clinical_provenance_pagination_security.sql` | `c1018e711cc0` | clinical provenance/read pagination |
| 18 | `20261121201000_staff_self_service_approval_accountant.sql` | `2267dc84aa9a` | self-request/approval, accountant and live session |
| 19 | `20261121202000_inventory_transactional_branch_ops.sql` | `ec9f63a3c8b4` | transactional inventory and immutable ledger |
| 20 | `20261122120000_operational_live_session_read_guard.sql` | `c96ab853629a` | deleted-session staff/RLS guard |
| 21 | `20261123210000_staff_appointment_lifecycle.sql` | `969db983facf` | staff appointment CAS/nonce/events and auth.users lock |

**Application prerequisites:** all eleven original migration versions and their physical schema/RLS/ACL/function fingerprints must match reviewed source; Phase4 Dog/Chow Chow and the historical appointment must remain byte-equivalent or STOP; branch calendar/service approval decisions must come from clinic owner. For migration #16 onward, the chosen staging Auth/session schema must match actual GoTrue capabilities; for #18–#21 independent current-session/session-delete/ban lock behavior must be tested with provider, not merely SQL mocks.

**Authorized operator sequence (NOT EXECUTED):** (1) snapshot, sign, encrypt and independently restore pre-change database+Auth+Storage; (2) record non-sensitive migration-history checksum and baseline `pg_get_functiondef`/`pg_get_triggerdef`/`pg_policies`/ACL fingerprints; (3) use the current Supabase CLI's documented staging migration workflow with project ref independently verified and an explicit final plan showing EXACT #12…#21 order and nothing else, no manual history spoofing; (4) apply only after signed owner approval naming all ten; (5) compare new migration versions, security ACL/policy/routine body and synthetic historical data; (6) run dedicated provider acceptance with isolated approved actors and signed rollback evidence. Never run an entire unreviewed directory, reapply a migration, or use production connection.

## Approved synthetic actor matrix — required test evidence

| Actor | Must succeed (after independently approved setup) | Must be denied |
| --- | --- | --- |
| Anonymous or unverified signup | anonymous catalog discovery only | owner records, staff, private Storage, SQL transition |
| Verified owner A with pet A | own patient/booking `requested`, own private attachments | owner B patient/Storage, staff confirm/completion |
| Verified owner B with pet B | own separate patient booking and readback | any owner A rows, objects or appointment edits |
| Unapproved staff applicant | own request status / pending | branch queue, reviewer privileges, stock/appointment writes |
| Approved receptionist in branch X | scoped queue, requested→confirmed, check-in/no-show/cancel and approved inventory receiving | branch Y, clinical completion without vet permission, admin membership escalation |
| Approved veterinarian in X | authorized scoped encounter draft and complete only after matching persisted `branch_encounters` | other branch, stale revision, revoked session, other owner outside clinical scope |
| Administrator in X | authorized same-branch approvals and operations | self-assigned other branch, direct invoice/medical finalization without approved API |
| Accountant in X | finance read only where a verified contract exists | appointment transitions, chart writes, inventory movements, staff administration |
| Revoked/banned/expired/deleted-session actor | none of the previously privileged mutations | session/RLS reads, approval, booking, stock, appointment transition even with unexpired JWT |

## Expected provider tests (record independent evidence)

1. Create only owner-approved disposable synthetic identity records. Recheck email confirmation, nonanonymous GoTrue user, `auth.sessions` signature/freshness, no leaked permanent/admin role on signup; first-admin bootstrap is privileged owner-only and **separately gated**.
2. Confirm branch X/Y isolation for queues, owner/pet/appointment rows and live resource slots; approved service eligibility/species/branch calendar/holiday/slot clocks. Verify Dog/Chow Chow and historic appointment identity and counts before/after.
3. Booking `requested` receipt persists after browser refresh; nonce retry is exactly once; changed payload same nonce rejects; two simultaneous resource requests never both consume a capacity-one slot.
4. Appointment #21 six state edges, decline stored `cancelled`, no-show only after start, completion requires matching persisted branch encounter and vet/admin, stale revision `40001`, reused nonce changed payload `23505`, wrong branch/accountant/owner/anon `42501`.
5. Deterministic truly concurrent provider API calls while trusted synthetic admin bans user, revokes branch membership and deletes active session. Ban/session revoke must either wait until already authorized transaction commits or win and produce denial; **never** mutate after committed prior revocation. Confirm no stray audit or receipt after failed transaction.
6. Staff applicant approval/deny/role-revision CAS, no self-grant; transaction inventory zero-opening Add Item → Receive exactly 10 → identical-nonce retry remains 10 and one immutable event; changed payload 11 denied; receipt rollback leaves 0; banned/accountant/wrong branch denied.
7. Read clinical draft/encounter revision, private Storage object bytes only for authorized owner or scoped veterinarian; wrong owner, anonymous and revoked vet denied. Storage byte parity needs real download/hash and metadata checks, not only object listing.
8. Browser at 360/768/1440, light/dark and keyboard: denied/loading/disabled/uncertain states; lost ACK retries same UUID, account/branch switch destroys old data; no fabricated visit, finance or contact metric. Never enable production flags for UAT.
9. Sign and encrypt post-change DB+Auth+private Storage snapshot, independently restore to a **third isolated destination**, compare row primary keys, original historical records, routines/ACL/policies/triggers/nonce/audit, object metadata AND SHA-256 bytes; test missing/tampered signature and no-ACL restore fail closed. Record recovery time and owner acceptance.

## Rollback and STOP boundaries

- **Before any SQL:** failure to verify actual staging project, exact 11-version prefix, old routines/grants, historical Dog/Chow Chow, pre-change signed archive + independent restore, or owner approval means STOP; perform no changes.
- **While applying:** an individual migration error or unexpected privilege/policy mismatch means STOP at that version. Supabase versions and committed schema are not safely undoable by simply deleting rows from `schema_migrations`; NEVER edit history or assume SQL `DOWN` exists. Do not automatically reverse #12–#21 or run down migrations against shared data.
- **After application:** disable preview-only write flags, isolate the staging project, preserve forensic logs without PII. Restore **the entire staging environment** from the verified owner-held pre-change DB+Auth+Storage signed snapshot to a separate isolated destination, verify Auth/session grants, RLS, routine ACL/definition and Storage object bytes, and have owner explicitly authorize cutover or decommission. Snapshots may be inconsistent across managed Auth+Storage unless operator proves consistency; otherwise recovery is NOT accepted.
- **Production (6 applied):** entirely separate release approval; never reuse the 11→21 staging packet as a blind production push. First produce a new 6→21 source/historical-preservation diff, independent signed full-service recovery, explicit UAT PASS and owner-authorized scheduled window, exact SQL order and postdeploy rollback/monitor steps. No production flags or clinic-live GO without SOL, TERRA and owner acceptance.

## Owner acceptance evidence record (blank, to be completed by the independent operator)

| Gate | Required provenance | Status |
| --- | --- | --- |
| Exact final RC1 commit and 21 source blobs | Git SHA, reviewer signature, CI runs | NOT TESTED |
| Staging identity / 11 migration prefix | Redacted provider version-only output, approved ref recorded privately | NOT TESTED |
| Signed pre/post archive and third-target restore | Signed manifest, Auth/DB/Storage object-byte checksums kept privately | NOT TESTED |
| GoTrue/JWT/PostgREST two-owner/branch RLS | Negative and positive HTTP responses with masked actors | NOT TESTED |
| Six appointment transitions / ban race | Request IDs, revisions, event/nonce counts (scrubbed) | NOT TESTED |
| Clinical/Stock/Storage/Booking/Frontend | Operator report and exact build | NOT TESTED |
| SOL and TERRA independent reviews | Exact SHA and verdict | PENDING |
| Clinic production GO | Explicit human owner approval | NOT AUTHORIZED |

Related: [RC1 integration preparation](RC1_INTEGRATION_HANDOFF.md) · [Issue #120](https://github.com/cmlagatuz/dawney-clinic/issues/120) · [Issue #63](https://github.com/cmlagatuz/dawney-clinic/issues/63).
