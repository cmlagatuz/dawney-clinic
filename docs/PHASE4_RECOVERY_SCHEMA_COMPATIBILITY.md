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
