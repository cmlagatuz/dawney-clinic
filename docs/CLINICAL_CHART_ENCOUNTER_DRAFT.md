# ASTRA Clinical Chart + Encounter DRAFT — source-only migration #16
**UNAPPLIED.** PR101 ancestry; CLOUD PR102 `web/src/clinical/ASTRA_CONTRACT.md` is a design request, not deployed SQL. This changes no existing migrations, data, policy flags, clinic services or auth users.

## Rollout and migration ordering
1. Preserve original **11** ordered Phase2/3/4 + Storage migrations (no SHA edits).
2. Separately reviewed **#12** four-branch RLS, **#13** branch booking, **#14** staff branch readers and **#15** inventory read-only.
3. New **#16** `20261120160000_clinical_chart_encounter_drafts.sql` only after successful verified synthetic recovery and formal owner change approval. It creates three additive tables, two narrow RPCs and append-only audit/replay protections.
4. Do not apply any migration to hosted Supabase or enable the clinical UI until independent SOL review, actual authorized hosted role/RLS persistence tests and veterinary owner approval.

## Authorization — PostgreSQL, not frontend
`read_staff_patient_chart(p_branch uuid,p_pet uuid,p_section text,p_after_at timestamptz,p_after_id uuid,p_limit int)` returns JSONB:
- `kind:'ok'`, `accountId`, `branchId`, `patient:{id,ownerId,name,species,breed,sex,birthDate,taxonomyReviewNeeded}`, `section`, `items`, `nextCursor:{at,id}|null`, `hasMore`.
- `kind:'not_found'` when no patient with a recorded visit to that branch (same result for nonexistent patient and wrong-branch patient, no existence oracle).
- Errors `42501` not authorized; `22023` invalid cursor/section/limit. Other failures must be presented as unavailable, never empty charts.
- Up to **50** items per page; deterministic descending **(timestamp,id)** cursor, strict pair validation and server-derived `hasMore`. Each page filters the same patient and authorized branch.
- `appointments`: receptionist, veterinarian or administrator with current active global+branch role, confirmed non-anonymous Auth user. Fields `id,branchId,petId,startsAt,endsAt,status,concern`.
- `records`: veterinarian/administrator only, `clinical_records` with known matching `branch_id`. Fields `id,branchId,petId,performedAt,procedure,temperatureC,weightKg,comments,authoredBy`.
- `drafts`: veterinarian/administrator only, committed draft `id,appointmentId,branchId,petId,authorId,revision,status,complaint,examination,assessment,plan,createdAt,updatedAt`.
- A matching, branch-attributed `appointments` row for this exact pet and owner is mandatory even for a globally privileged administrator. Historical NULL-branch appointments and clinical records are NOT guessed/backfilled or used to authorize charts.

`save_staff_clinical_encounter_draft(p_branch,p_pet,p_appointment,p_request_id,p_expected_revision,p_complaint,p_examination,p_assessment,p_plan)` returns `{kind:'saved',id,appointmentId,branchId,petId,authorId,status:'draft',revision,updatedAt}`.
- **Veterinarian only**: up-to-date active global AND branch role with confirmed Auth identity; hard row locks on branch/global role and Auth user until transaction commit, appointment locked and matched against (branch,pet,owner).
- `p_request_id` UUID unique per actor; exact replay (including expected revision) returns the persisted original result, changed payload returns `23505`. Expected revision **0** creates, **N** updates exactly from N to N+1; stale version `40001`.
- Advisory lock serializes writes to the same appointment; database alone sets author, status, timestamps and audit. Note text: complaint 1–4000, examination/assessment/plan 0–4000, non-null, no HTML rendering assumptions. `42501` unauthorized/wrong patient/appointment, `22023` invalid input.
- One encounter-draft per exact appointment, atomic immutable audit event and private idempotency receipt per successful revision. Existing `branch_encounters` and legacy `clinical_records` are untouched.
- RLS enabled on all new tables, no direct client table select, write or private schema grants; precisely `EXECUTE` on two authenticated RPCs. Both are `SECURITY DEFINER` with empty search_path and full SQL-side authorization checks. Review this privilege boundary independently.

## CLOUD frontend handoff — do not enable Save yet
**New adapter** `web/src/lib/clinical-chart.ts` exports:
- `readStaffPatientChart(user,branchId,petId,section,cursor,limit)` (typed `PatientChartResult`, throws malformed server response, maps 42501→denied).
- `saveStaffEncounterDraft(user,input)` (typed `DraftResult`, maps 40001/23505→conflict, 22023→invalid, 42501→denied).
Both require Supabase Auth `getUser` freshness and use the authenticated publishable-key session and `rpc`, never unrestricted `from('clinical_records')` or service_role keys. No existing frontend imports these exports, **VITE_CLINICAL_WORKSPACE_UI remains OFF** in CLOUD PR102. Only CLOUD may integrate after reviewed SQL and owner release approval.

## Threats and deliberately unavailable clinical capabilities
| Threat | Server-side defense |
|---|---|
| Guest / owner-only / revoked / unconfirmed or JWT anonymous | Auth-backed global+branch membership and confirmed non-anonymous user check |
| Guessed patient, cross-owner/branch/appointment | Exact branch appointment + pet + owner provenance, no legacy NULL fallback |
| Receptionist accessing notes / writing | Appointment-only read role, veterinarian-only draft mutation |
| Stale browser, changed nonce, duplicate concurrent write | SQL transaction advisory lock, revision equality, unique actor/request nonce, private payload comparison |
| Direct malicious DML or audit history edit | Zero client grants and RLS on all tables; append-only trigger |
| Partial write or failed validation | Atomic transaction rollback of draft, audit and receipt |

**NOT AVAILABLE:** clinical sign-off, final clinical encounters, medication orders, doses, vaccination events, prescriptions, medication dispensing, treatment plans as independent order entities, reminders, staff account bootstrap and clinical publication. These require separate veterinary policy and authorization review. Existing medication-inventory proposal #15 stays READ ONLY. No hosted writes or real owner/patient exports occurred.

## CI limitations
Isolated GitHub Actions runs original 11 + #12–#15 + proposed #16 in disposable PG17, plus 50/51 paging, role and branch negative tests, audit revisions and the exact historic Dog/Chow Chow invariant. Existing full-tree and recovery jobs test the original unchanged source chain; **they do not constitute hosted acceptance or production backup proof**. Any original strict-source guard failure must remain fail-closed until the exact reviewed source manifest is independently pinned.
