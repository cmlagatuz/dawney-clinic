# Frontend integration candidate (#34 + #41 + #48 + #64)

**Source-only, stubbed-harness evidence, not live verified, not for merge to master as-is.** Branch `ai/claude/phase5-frontend-integration`, stacked on #64 `1a661b0` (which already contains #48 `58f15c0` on #34 `5bacc13`), plus #41 `59f8cb1`. Original PR branches are untouched.

## Conflicts resolved (3 files, content only)
- `web/src/App.tsx`: #41 predates #48's public site. Kept #48's `SiteLayout` routes and `NotFoundPage` catch-all; dropped #41's `Root()` redirect and `*` route (it would have hidden the public 404 and sent anonymous visitors to the owner portal). Kept `VITE_PHASE4_PATIENT_FORM` (default OFF) choosing `PetsPageCatalog`, and `VITE_PHASE5A_OPS_UI` (default OFF) adding `/app/ops`.
- `web/src/styles.css`, `docs/AI_HANDOFF.md`: both sides appended; both kept.
- All #41 logic files (`attachment-load.mjs`, `patient-form-logic.mjs`, `usePatientAttachments.ts`, `AttachmentField.tsx`, `PetsPageCatalog.tsx`, `SpeciesBreedFields.tsx`) are byte-identical to #41.

## Flags (all default OFF)
`VITE_PHASE4_PATIENT_FORM`, `VITE_PHASE5A_OPS_UI`. Staff read port (`web/src/ops/port.ts`) stays `null` ("contract not integrated") until the reviewed #59 contract is wired.

## Remaining backend dependencies
#59 integration + names/vet read for staff; Phase 4 catalog/attachment migrations live before enabling the patient form; hosted Auth Redirect URL allowlist for `/auth/callback?next=%2Fbook`; hosted RLS/Storage verification (owner-gated).
