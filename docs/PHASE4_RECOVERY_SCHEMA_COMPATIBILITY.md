# Phase 4 recovery-to-migration schema compatibility — synthetic evidence

**Status: BLOCKED / NOT VERIFIED for migration compatibility.** This document describes a negative compatibility test, **not** a successful Phase 4 restore upgrade or a hosted Supabase recovery rehearsal.

## Scope and fixed source inputs

The CI recovery script `scripts/recovery/tests/synthetic-full-set-restore.sh` first restores an encrypted, signed **five-component synthetic set**: application PostgreSQL dump, Auth users/identities dump, private Storage metadata dump, Storage object byte archive, and provider configuration. The existing script already verifies component ciphertext checksums, detached manifest signature, missing payload rejection, same-size corrupted Auth ciphertext rejection, signature tampering rejection, restored object-byte SHA-256 equality, identity-to-owner/patient relationships and the historical requested appointment. It works against disposable PostgreSQL 17 only.

The recovery compatibility probe is `scripts/recovery/tests/phase4-restored-compatibility.sh`; it runs **after** that unchanged restoration and refuses execution outside GitHub Actions / local PostgreSQL. CI checks exact heads and extracted Git blob hashes, in the reviewed dependency order:

| Provenance | Reviewed source SHA |
| --- | --- |
| Four-migration rehearsal PR #52 | `5272cadbef4cc966e1b650905c5680b8fdf56c99` |
| Chow Chow taxonomy correction PR #40 | `7f6b7b4b12c6d5c04a049f5427b77704d560e4f0` |
| Booking contract PR #43 | `2749f810a2d5195e974949cb8e23d4495a8b0d11` |

Files are validated by their exact Git blob identities before any database probe. Missing, empty, altered or moved dependencies reject the CI run. The SQL migrations are never modified or loosened to make the fixture pass.

## Verified recovered state and incompatible Phase 3 prerequisites

PR #49 intentionally restores a **minimal** model: `auth.users`, `auth.identities`, `public.owners`, `public.pets`, `public.appointments`, `storage.buckets`, `storage.objects`, and `clinic_private.recovery_history`. This is sufficient for a coherent recovery/cryptographic evidence test, but it is **not** equivalent to the real Phase 2/3 schema used by PR #52.

The recovery fixture does not create the `anon` / `authenticated` PostgreSQL roles, `auth.uid()`, `clinic_private.is_permanent_user()`, `clinic_private.has_staff_role(text[])`, `public.appointment_resources`, `public.staff_memberships`, or the scheduling fields `appointments.resource_id`, `starts_at`, `ends_at`, and `created_by`. It also has a narrower appointment-status constraint and omits portions of the Phase 3 patient/resource/RLS contract. The recovery history text `synthetic-phase3` is not proof that the actual Phase 3 schema was applied.

For that reason, feeding this restored data directly into the four reviewed Phase 4 migrations would be an **invalid test**. Creating synthetic missing functions/columns after the restore would manufacture compatibility and conceal migration risk.

## Actual CI proof and safety interpretation

The probe checks the recovered two Auth identity relationships, linked synthetic Dog/Chow Chow patient, unchanged requested historical appointment, private Storage ownership paths/checksum metadata, and recovery provenance. The preceding PR #49 script separately verifies **binary object bytes and SHA-256**; the follow-on probe does not falsely claim to have access to those cleaned-up object bytes.

It clones the recovered database into disposable `recovery_phase4_probe` and checks required Phase 2/3 prerequisites **without injecting mocks**. The probe deliberately attempts **only the first exact reviewed Phase 4 migration in this disposable clone** and requires an actual PostgreSQL prerequisite error. A silently successful migration or unrecognized error fails CI rather than being reported as compatibility. The original `recovery_restored` database is never subjected to migrations; its combined Auth/owner/patient/appointment/Storage metadata SHA-256 fingerprint must remain unchanged. The clone is destroyed.

A green **negative-compatibility CI check** therefore proves the preflight **catches a reproducible blocker**; it does **not** prove Phase 4 migrations work on an actual restored production-shaped database. PR #52's four migrations on its **different** complete synthetic Phase 3 input were independently verified, and are not rerun or relabeled here.

## Requirements to claim restored Phase 4 compatibility

A future fully verified rehearsal must recover a **versioned, Phase 3-equivalent** Auth/database/private Storage fixture with real migration ledger, constraints, RLS, scheduling columns, staff membership functions and Auth/Storage provider metadata; validate the five-component signed manifest and decrypted object bytes; capture before/after user/owner/pet/appointment/storage checksums and identities; apply the exact four reviewed migrations in their fixed sequence; run compatibility, negative authorization, booking and rollback/recovery tests; and ensure failure of missing/corrupted/mismatched assets before any migration. No synthetic shortcut should be labeled production compatibility.

Still owner-gated: **hosted Supabase Auth users/sessions and tokens, real Storage API objects and private bucket recovery, actual backup export and restore into an isolated Supabase environment, patient reconciliation, rollback verification, and approved production migration execution**. Do not export clinical data, perform hosted writes or incur costs without explicit authorization.
## Additional positive Phase 3-equivalent synthetic recovery rehearsal

The original minimal fixture and its **expected failure** remain in place. A **separate** PostgreSQL 17 CI job named `full-phase3-signed-recovery-to-phase4-pg17` exercises a fuller input instead of silently fabricating absent Phase 3 scheduling tables or staff policies.

Its source is `scripts/recovery/tests/synthetic-phase3-phase4-positive.sh`. The versioned synthetic fixture is made of:

- `phase3-provider-bootstrap.sql`: strictly **CI-only** provider shims for PostgreSQL roles, the minimal Auth users/identities catalog and `auth.uid()`/`auth.jwt()`, and minimal Storage metadata/filename/folder functions. These are **not** hosted Supabase Auth/Storage implementations.
- The six **unmodified** actual Phase 2/3 SQL migrations, executed once in source database in chronological order. The migrations—not the shim—create application tables, staff memberships, role authorization functions, appointment resources, scheduling constraints, status/audit triggers, privileges and RLS policies.
- `phase3-synthetic-records.sql`: five invented Auth identities including separate owners A/B, one active receptionist, one revoked veterinarian, and one anonymous account, all with FK-backed identities; Dog/Chow Chow patient, another pet, historical requested appointment in the genuine scheduling table, and private Storage metadata pointing to two synthetic binary objects. `clinic_ci.recovery_fixture` explicitly marks `phase3-real-six-migrations-v1`, never claims to be Supabase's managed schema ledger.
- `phase3-preserved-snapshot.sql`: stable normalized JSON fingerprint for the *unchanged* Auth identities, owner/patient legacy fields, appointments/status/events, resources, staff audit, private Storage metadata, and synthetic fixture provenance.
- `phase3-phase4-positive-assertions.sql`: after all four migrations, checks exact legacy dog Chow Chow taxonomy mapping, exactly one active taxonomy trigger, unchanged historical appointment and no invented clinic service approval, and SQL-role owner/other-owner/active-staff/revoked-staff/anonymous denials (all transactionally rolled back). It does **not** assert real signed JWT/HTTP authorization.

The positive job pins and checks current heads of PR #52 `5272cadbef4cc966e1b650905c5680b8fdf56c99`, PR #40 `7f6b7b4b12c6d5c04a049f5427b77704d560e4f0` and PR #43 `2749f810a2d5195e974949cb8e23d4495a8b0d11`, and verifies exact Git blob identities for all six Phase 2/3 and four Phase 4 migrations **before** touching a disposable database. An upstream PR change stops the test until reviewed and re-pinned.

The recovery set contains **five individually encrypted components** covered by a GPG-signed JSON manifest with verified SHA-256 hashes: full SQL-generated application schema+data (omitting only Auth/Storage table data), Auth users+identities data, private Storage metadata data, private Storage object bytes, and provider configuration. A pristine PostgreSQL database is restored in dependency-safe order: application schema/pre-data; Auth rows; Storage metadata rows; application rows; application post-data (constraints/ACLs/triggers/RLS). Synthetic provider roles are cluster-wide and intentionally re-created only once within the isolated local service. Object bytes are separately restored and checked against both original bytes and their SHA-256 values recorded in Storage metadata.

Missing objects, altered same-size Auth ciphertext or a modified signed manifest must fail **before** restoration. The restored baseline snapshot is required to equal the source. The four exact reviewed Phase 4 migrations then run in order on the recovered database, after which both the preexisting-data fingerprint and RLS/booking assertions must pass. The original minimal negative fixture still must reject Phase 4.

**Evidence status:** Record positive or reproducible blocker only from the actual job logs for the exact PR commit; do not label this section PASS based solely on source code. This test proves only disposable PostgreSQL/SQL and synthetic encrypted object restoration. It does not create or export real clinical records or validate hosted Supabase migrations, Auth tokens/sessions, managed roles, full Storage API bytes, provider settings, production backup restore or live rollback.
