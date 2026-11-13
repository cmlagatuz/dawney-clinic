# Dawney Clinic — Current Supervisor Brief

**Checkpoint 2026-11-13, 20:57 Asia/Riyadh.** Read **this brief plus [Phase 4 Product & QA Spec](PHASE4_PRODUCT_QA_SPEC.md)** before any new work; read historical `AI_HANDOFF.md` selectively, not full repeated dumps. Verified state can change: inspect latest master, PRs, CI and Supabase on starting.

## Supervisor determination and new priority
The deployed React interface is a **basic pet-owner prototype**, not a complete modernized veterinary clinic system. Owner screenshots show generic plus-sign branding, only My profile/Patients/Appointments navigation, sparse clinical workflows, species/breed as raw free-text, and no patient photo/health/vaccination document upload. These are QA gaps. User supplied exact Dawney logo image in supervisor chat; **asset is not yet committed to repo**. User-provided original/optimized brand asset must be supplied to Claude if another app cannot access current conversation uploads.

## Verified engineering
- `master` source at `6f0ddb107b2...` before Phase 4 spec commit; PRs **#2–#28 merged**, old Claude Blade PR #1 open/unmerged. No new Claude React PR detected yet.
- Live preview: **https://dawney-clinic.pages.dev**; authenticated owner screenshots show current UI and persisted pet/appointment. PR #27–28 docs/public HTTPS/anonymous Chromium CI PASS; no full clinic go-live.
- Supabase healthy: six migrations, seven RLS app tables, two confirmed Auth users/two owner records, **1 pet, 1 appointment, 1 event, 1 resource**, zero staff and zero clinical records. `clinical-attachments` private 5MiB PDF/PNG/JPEG bucket exists, **0 files**. Preserve current records.
- Live baseline Auth and read-only RLS tests passed in earlier verified runs. Real owner-vs-owner clinical write/Storage tests, true private-attachments UI, staff role verification, complete Auth+Storage recovery and real role-based clinic dashboard are outstanding. Existing `pets.species`/`pets.breed` free text must survive migration.

## Assignment — parallel, exclusive paths
- **Astra (data/security/API)** `ai/chatgpt/phase4-animal-taxonomy-attachments`: migration and seed for normalized species/breed with supported-by-clinic flags, non-destructive mapping, relational species/breed validation, controlled exceptions; private patient attachment metadata, RLS and secure upload/list/read adapters, negative tests, rollout guide. Own `supabase/`, `web/src/lib/`, `web/src/clinical.mjs`, domain tests, backend docs; **DO NOT edit React pages/components/styles or brand files**.
- **Claude (branding/React UX)** `ai/claude/phase4-react-modern-ui`: add owner-supplied logo assets to `web/public/brand/`, wire it into public/authenticated shells and appropriate favicon, implement professional responsive clinic dashboard/navigation, searchable grouped species and dependent locked breed UI, patient profile and attachment upload UX consuming Astra's typed adapters. Own `web/src/pages/`, `web/src/components/`, `web/src/styles.css`, `web/public/brand/`. No Supabase migrations/policies/auth bypass.
- **Merge gate:** Merge Astra's **tested backend/API contract** first, then Claude syncs with latest master and integrates it. Claude may independently land a branding/layout PR first if it touches only owned visual files. Do not merge old Blade PR #1 as substitute.

## Required proof
All acceptance tests QA-01 through QA-12 in [Phase 4 spec](PHASE4_PRODUCT_QA_SPEC.md), including breed-species mismatch denial in DB, profile persistence across reload, optional private PDF/photo upload, disallowed MIME/oversize rejection, A/B cross-owner file privacy, real responsive screenshots 360/768/1440, role-safe clinic UI and no fabricated data. No public/private secret key leakage, paid services, forced migration, fake screenshots or premature patient-data production claim. Each PR: affected files, tests and real UI screenshots, reviews/merge status, actual deployed commit after Cloudflare publishes.

## Immediate owner intervention
Transfer the *original supplied kangaroo/Australia-map DAWNEY ANIMAL CLINIC logo* to Claude's chat as an upload, unless Claude already can access the attached file. Keep original artwork; treat white/transparent backgrounds deliberately across dark/light UI. Clinical species support and scheduling availability still need veterinarian/clinic approval before offering every cataloged animal type. Do not run approved-write smoke jobs or create staff admin without explicit authorization.
