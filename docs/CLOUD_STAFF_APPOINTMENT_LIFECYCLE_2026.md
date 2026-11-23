# CLOUD — Staff appointment lifecycle frontend | 24 November 2026

**SOURCE ONLY / DRAFT / NOT CLINIC LIVE.** This frontend child PR #131 targets frozen RC0 PR #129 exact 078053120774e856c9ddaa8c8027b3c891e9e8f6. Backend transition_staff_appointment is only the provisional documented contract in ASTRA draft PR #130, which had an independent SOL P2 security finding at assignment. ASTRA owns its SQL correction. No hosted SQL, real patient or staff action, production configuration, merge, messages, billing or inventory mutations were performed.

## Existing app path and contract

The existing **/app/ops** branch-scoped staff Operations page remains the sole entry. Reused: its role/branch reader, day/week schedule, flow board, existing 250/251 pagination, dashboard counts, verified account and branch change behavior. Each row now has a keyboard-accessible Review appointment selection.

Issue58's existing bounded read API does not publish lifecycle_revision. Rather than invent an increment, a new narrow frontend-only adapter performs a single selected-appointment read of id, branch_id, owner_id, pet_id, resource_id, starts_at, ends_at, status and lifecycle_revision, followed by a fresh Auth/global+branch-membership assertion. Missing #21 column, mismatched owner/pet/resource/branch or invalid revision means **NO MUTATION**. The verified queue and appointments table are not broadened into a new bulk unscoped patient read. Only abbreviated patient references render, never full owner/patient contact data.

Only one new staff RPC can change status: transition_staff_appointment with p_appointment (UUID), p_branch (UUID), p_action (one of confirm, decline, check_in, complete, no_show, cancel), p_expected_revision (actual server integer), and p_request_id (stable UUID). The frontend validates reply kind, target, branch, action, persisted status and revision exactly +1. After acknowledgement, it independently reads the same appointment again before saying server-confirmed, and refreshes branch counts/queue. **No direct staff appointment UPDATE is introduced.**

Requested may confirm, decline, or cancel; decline persists Cancelled (there is no persisted Declined state). Confirmed can check in, cancel or mark no-show after visit start; the server checks actual timing/policy. Checked-in completion is reserved for veterinarian/administrator **with a verified persisted matching branch_encounters record**, and even then changes only the appointment status. A clinical DRAFT is NOT a completed visit and this UI cannot sign or finalize medical records. Receptionist and accountant do not inherit veterinarian clinical authority.

A lost response or unreadable server acknowledgement preserves the same immutable action, revision and nonce for explicit same-request retry. 40001 stale revision and 23514 policy reject clear local attempts and refresh actual branch state. 42501 denial hides patient-sensitive context and re-verifies branch access. Uncertain or malformed results never say saved. Switching account, role/branch or selection does not carry old appointment data to another context.

## Flags and nonproduction testing

New VITE_STAFF_APPOINTMENT_WRITES_ENABLED remains **false by default**. The existing VITE_PHASE5A_OPS_UI also retains its approved default OFF. Browser tests alone temporarily set the two flags true in an ephemeral local Vite instance; production/Cloudflare configuration is unchanged. No service-role key or real JWT is used.

From web/:
- npm ci --ignore-scripts --no-audit --no-fund
- node --test tests/appointment-lifecycle.test.mjs
- node --test tests/staff-appointment-lifecycle.browser.test.mjs
- npm run typecheck
- npm run build
- npm test

The new browser suite uses an independent synthetic HTTP overlay on the existing release fixture. It exercises actual /app/ops navigation in a real localhost Chromium, 360/768/1440 px and light/dark, keyboard selection, requested→confirmed→checked_in→completed (verified encounter), decline, cancel, no-show, receptionist completion denied, malformed revision/branch, missing backend, lost acknowledgement same-nonce retry, stale CAS, server denial, branch/account switch, and no provider writes. **These browser assertions are synthetic HTTP evidence, NOT hosted Auth/Storage/PostgREST persistence.** Unchanged full-tree CI guards may reject new blobs; CLOUD must not weaken their historical exact-source pins.

## Human clinic operator staged UAT — planned, NOT EXECUTED

1. Obtain Project Owner authorization specifying a disposable staging project, exactly reviewed #21 migration, backup+signed DB/Auth/private Storage byte restore and rollback owner. Confirm independent SOL SOURCE PASS on corrected exact PR130 and PM approved combined source before setting any staging-only flags.
2. With independently verified and approved synthetic receptionist/admin/veterinarian accounts, check appointment requested versus confirmed status in one currently authorized branch; owner-only, accountant and wrong-branch must have no staff mutation. Confirm the initial requested status cannot become confirmed without secure staff RPC.
3. Confirm request, validate backend appointment lifecycle revision and audit action plus fresh queue readback and full page reload. Decline or cancel two separate requested test appointments, verifying both persisted Cancelled with accurate actor audit.
4. At valid time check in a confirmed booking; after start mark another confirmed booking No-show. Outside allowed time, unapproved calendar/resource/species or stale revision must fail closed with no invented saved badge.
5. Attempt Complete as receptionist (denied), veterinarian without linked branch encounter (denied), veterinarian with a genuinely persisted matching encounter (allowed, appointment only). Confirm clinical draft and finalization state remain separate.
6. Lose ACK after server commit, replay exact original nonce/payload and prove only one transition receipt/event, one revision increment; changed-payload nonce 23505 and CAS 40001 must not silently retry as new requests.
7. Revoke role/branch, delete Auth session, ban current Auth user, switch accounts/branches while data is in flight, verify server 42501 and no previous patient's content. Check keyboard focus at 360/768/1440 light/dark.
8. Independently verify signed/encrypted source hash/ACL/RLS/function and appointment/event/nonce restore, actual Auth JWT/Storage bytes parity, cleanup and revert the isolated flag. Preserve historic Dog/Chow Chow and appointment. No hosted attempts without specific authorization.

## Exact integration dependency and next owner

- ASTRA: correct PR130's Auth-user ban/transition concurrent P2, maintain migration #21 security and return a corrected exact SHA, then SOL independently audits it. ASTRA/PM alone may reconcile unchanged CI source-integrity manifest for integrated source.
- Qwen: independently review PR131's actual browser/operator flows, permission and stale-state behavior, including lost ACK same-nonce replay and mobile keyboard. Report personally executed versus read-only.
- Project Manager and human owner: explicit staging eligibility and later production go/no-go, only after complete separately approved hosted JWT/Auth/RLS/private Storage and signed restore acceptance.

**No frontend source in this draft grants backend permission or activates appointment writes.**
