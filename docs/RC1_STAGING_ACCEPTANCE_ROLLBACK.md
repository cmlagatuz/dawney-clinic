## Current RC1 release standing — 25 November 2026

Authoritative draft [PR132](https://github.com/cmlagatuz/dawney-clinic/pull/132); approved frontend PR135 `f464c4494615147297f8802dc5299fadd95786c9` imported at `8209a545960baa48396e507fbff21ae39f54be01` (8/8 exact, 28 cumulative pins). CI reconciliation checkpoint `ed75eb76789632c1044f7f6795cea73c26011cce` retains all 21 migration blobs and historical guards. On that exact checkpoint, integrated provenance, unified PG17, #21 appointment SQL/ban race/nonce CAS/rollback and signed restore steps, operational signed PG17 restore, clinical draft PG17, signed five-component recovery and encrypted isolated database restore passed. See exact [Actions evidence](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609400350) and PR132 for final head and complete CI status. This documentation update requires its own exact-head CI; do not inherit green. Final independent SOL/TERRA and hosted owner acceptance are still required. No clinical GO, hosted SQL, flags, merge or deploy authorized. Clinical chart adapter remains disconnected; no claim of end-to-end clinical persistence. Finalization, vaccination, prescriptions, dispensing, transfer/adjustment, billing/payment, consent/outbox and durable reload reconciliation remain unsupported or partial. See [Issue120](https://github.com/cmlagatuz/dawney-clinic/issues/120).

## Independent recovery destination — feasibility and authorization packet (NOT EXECUTED)

Both hosted projects must remain intact. PM reports staging first 11 and production first 6 migrations; exact version prefixes and physical schema must be rechecked before separate approvals. Apply only #12–21 to staging and #7–21 to production after independent restore and separate authorizations; the ordered 21-pin ledger below specifies each filename. No third free hosted slot assumed. Proposed alternative is an owner-designated existing isolated computer, not former TERRA home PC, with locally running Supabase-compatible PG17, Auth, Storage and API stack. Capacity is unverified: inventory available encrypted disk for images, database, object bytes and two restore copies; CPU/RAM and local runtime adequate for the pinned provider versions; no new purchases. Verify PG major/minor, extensions, roles, schemas, Auth/Storage version and config compatibility before restore; local proof is not equivalence to managed Supabase. Record a coordinated quiescent recovery cutoff, database+Auth identity export, Storage metadata and separately actual object bytes, and configuration inventory. Encrypt all five components and sign size/hash manifest with separately trusted owner fingerprint; owner retains two independent encrypted copies and keys separately, never upload keys or real records to GitHub. First run synthetic-only restoration on independent destination, verify fresh login/old token invalidation, owner A/B and revoked/wrong-branch denials, private object SHA256 parity and bytes, routine/policy/ACL/trigger fingerprint, historical Dog/Chow Chow and appointment parity, nonce/ledger/clinical provenance, and missing/corrupt component rejection. Record measured time and cutoff data loss; proposed RTO 4h and RPO 24h are owner-approved targets only after measurement. Stop on incompatible provider versions, unavailable independent capacity, failed signature/decryption/restore, identity/byte/policy drift, missing owner approval or any cost. Owner must separately approve destination, custody, quiescence, synthetic actors, RTO/RPO, authorized hosted export/restore scope, staging migration, clinical policy/UAT, and later production migration/release. Until then hosted recovery and clinical launch remain NO-GO.

## Historical release notes (superseded by current standing above)

## RC1 source integration — 25 November 2026

Exact PR134 `73067fcdbce7846522e55c33cd0e0ca2051335f4` eight-path correction accepted by PM [7152144119](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7152144119), SOL and TERRA; imported without other frontend edits. All 21 migrations remain frozen. Integrated CI and final independent acceptance pending; no clinic-live GO. Memory-only unresolved-operation warning is not durable reload reconciliation. No new SQL contract authorized. Hosted operations and relevant write flags remain OFF.

PM reports both projects ACTIVE_HEALTHY; staging first 11 and production first 6 migration versions. Not independently hosted-tested. Staging requires #12–21; production requires #7–21 only after separate approval and verified restore. Exact sequences below are source pins, not authorization.

# Sequence\tGit blob SHA\tRepo path — frozen exact PR130 @ b6ee64b38ca4ce2965f2b02f09a4e5584aa56608
01	cf329269e3f38a5ac320d0b60fe82b6165e218d6	supabase/migrations/20261113070302_phase2_core_data_security.sql
02	d7f8922de9251bb777430ce4163d2ca501b290f5	supabase/migrations/20261113070834_phase2_index_and_policy_tuning.sql
03	218b612c15944c811708f4908825d0a969064692	supabase/migrations/20261113074938_phase2_verified_auth_and_staff_bootstrap.sql
04	f12c39c4b75462aa9597d38065c70216e872c478	supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql
05	b47363bfdc3af3081a2af2f422be44a40c967e54	supabase/migrations/20261113100958_phase3_clinical_storage_policies.sql
06	0fc85dd437eac7d8d89fe69025df917ab79d3e0e	supabase/migrations/20261113101626_phase3_staff_membership_audit.sql
07	4296a5dcf84324cd83eea226e6054b0cd4f56658	supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql
08	cc03606d3d47b0d573f431a1a1161ba243a314d3	supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql
09	028cbdcfb96e15d297a9458322e1108c46a8b035	supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql
10	929f327141d9e5bb2be220d5685c6ce3f28c253c	supabase/migrations/20261114090000_phase4_public_booking_contract.sql
11	4d78cb2aef1104379d6fd29797705a6188c4c6dc	supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
12	4732b815cff45850d2f01cdeb93c527dac0e22a0	supabase/migrations/20261117233500_issue77_four_branch_foundation.sql
13	f58ca0e0bcb36d3a320060db7bf9bbeffe7f35f3	supabase/migrations/20261118203500_issue51_branch_booking_security.sql
14	c889477348d9505d54f54b1d08532c2f648992a9	supabase/migrations/20261118215500_issue58_staff_branch_read_contract.sql
15	908f881bfc541ab4265912e0a9e55525ea8275a5	supabase/migrations/20261118225000_issue78_inventory_read_only_foundation.sql
16	a017d6f11819fcd7dba743cf37e4533342d8a5a5	supabase/migrations/20261120160000_clinical_chart_encounter_drafts.sql
17	c1018e711cc01055e4ef3269caf261c05036fd58	supabase/migrations/20261120221000_clinical_provenance_pagination_security.sql
18	2267dc84aa9aadf0dda102bfc16c696ce254f685	supabase/migrations/20261121201000_staff_self_service_approval_accountant.sql
19	ec9f63a3c8b459f3562375b3b6428460f240468e	supabase/migrations/20261121202000_inventory_transactional_branch_ops.sql
20	c96ab853629a6abb05518697b5c4f1a7b1e4fd5e	supabase/migrations/20261122120000_operational_live_session_read_guard.sql
21	969db983facf7082e243d9ebae6e3fe7cdf65a39	supabase/migrations/20261123210000_staff_appointment_lifecycle.sql


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
