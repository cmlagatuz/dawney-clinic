# ASTRA #21 — staff appointment lifecycle contract (PR129 child, source only)

Base: frozen integrated PR129 `078053120774e856c9ddaa8c8027b3c891e9e8f6`. Existing SQL migrations #1–#20 and RC0 integration remain untouched. This contract is **NOT deployed or approved for real clinical writes**. No branch/service/doctor/schedule was activated by the migration.

## Verified source gap and backward compatibility
The original `supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql` contains only a transition trigger, not a staff mutation RPC. The Phase2 schema grants `UPDATE(status)` to authenticated users, and Phase4 #12 adds branch RLS; neither provides staff nonce, expected revision, transactional authoritative confirmation, or immutable staff event. The original `web/src/lib/clinical.ts` owner cancellation uses direct `appointments.update({status:'cancelled'})`; **that path is retained**, with server-side live-session validation and an automatic lifecycle revision increment. Existing historic Dog/Chow Chow + NULL-branch appointment is not reassigned.

## Backend API for CLOUD
Only this reviewed RPC is available for staff status writes:

```ts
const {data,error}=await supabase.rpc('transition_staff_appointment',{
  p_appointment: appointmentId,  // UUID of existing appointment
  p_branch: selectedBranchId,     // UUID; checked against LIVE branch membership
  p_action: 'confirm' | 'decline' | 'check_in' | 'complete' | 'no_show' | 'cancel',
  p_expected_revision: revision,  // integer > 0; server revision, NOT frontend counter
  p_request_id: stableRequestUuid // same UUID on retry; NEVER generate a new one on ACK loss
})
// success: {kind:'staff_appointment_transition',appointmentId,branchId,
//           status,revision,action}
```

Do not optimistically display confirmed/saved/completed when RPC is disabled or fails. Gate the UI behind an explicit independently approved feature flag, with API/migration readiness checks; do not wire into the frozen RC0 UI without a separately reviewed CLOUD child. After success or 40001 refresh the selected-branch queue from the server; 23505 signals changed-payload reuse of an existing nonce, 42501 inaccessible/revoked session/branch, 23514 invalid state or policy/visit. **Do not update the appointment status table directly for staff actions.**

### State contract
| Action | Input status | New persisted status | Required role |
|---|---|---|---|
| confirm | requested | confirmed | receptionist/veterinarian/administrator |
| decline | requested | cancelled | receptionist/veterinarian/administrator |
| check_in | confirmed | checked_in | receptionist/veterinarian/administrator |
| complete | checked_in | completed | veterinarian/administrator and existing matching branch_encounters row |
| no_show | confirmed, after start | no_show | receptionist/veterinarian/administrator |
| cancel | requested or confirmed | cancelled | receptionist/veterinarian/administrator |

The persisted schema does **not** have a `declined` status. `decline` is an immutable staff audit action resulting in the existing `cancelled` status; the UI may render "Declined" only when it has a server-owned audit source, not by guessing from `cancelled` alone. The legacy direct owner cancellation does not add a staff event.

### Security and conflict
All writes use `clinic_private.require_operational_actor()` (live `auth.sessions` lock, confirmed/active Auth, nonanonymous, fresh JWT claims) plus the current global and selected-branch role/membership. Accountant is always denied. The RPC locks the target appointment, requires branch/resource/pet/owner binding and expected `lifecycle_revision`, and locks the nonce for exactly-one receipt. A confirmation revalidates published owner-approved active service, eligible species, active capacity-one resource, approved branch calendar, local timezone, opening interval and slot alignment; existing GiST exclusion and a second conflict check protect active resource occupancy. Check-in is bounded to one hour before to 24 hours after the visit; completion requires a persisted matching encounter. Read-only owners may not use staff RPC.

`clinic_private.appointment_transition_events` and `clinic_private.appointment_transition_receipts` are private, insert-only audit/nonce stores without client privileges. Actor UUID remains immutable even if account deleted. Existing `public.appointment_events` continues writing the status history. SQL-shim JWT tests **do not verify provider JWT signatures**; only actual isolated HTTP GoTrue/PostgREST acceptance can prove those.

### Cutover/recovery checklist
Apply additive #21 **only after** owner-approved nonproduction restore plan, 20-migration source hash match and independent SOL review. Keep real booking/staff mutation switches OFF until hosted current-session, A/B, nonce race, signed recovery and explicit owner approval. New data to include in signed backups/restores: `appointments.lifecycle_revision`, both private appointment transition tables, their functions/triggers/ACLs and existing `appointment_events`. Do not infer provider-managed Auth/Storage backups from synthetic PostgreSQL tests. No SMS, bill, stock, or clinical finalization is performed by this RPC.
