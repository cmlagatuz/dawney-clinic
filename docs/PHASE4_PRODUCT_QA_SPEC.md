# Phase 4 — Dawney Clinic Product Modernization & QA Acceptance Contract

**Supervisor checkpoint:** 2026-11-13, 20:57 Asia/Riyadh.  
**Status:** APPROVED REQUIREMENTS / NOT YET IMPLEMENTED.  
**Baseline:** `master` at `6f0ddb107b2` (PRs #2–#28 merged; Claude's old Blade PR #1 open). Live preview: https://dawney-clinic.pages.dev. Supabase healthy: 6 applied migrations; 7 RLS-enabled app tables; 2 owners, 1 pet, 1 appointment at checkpoint; 0 private files. Do not delete or replace these existing records. Actual public HTTPS/anonymous Chromium smoke was verified; full authenticated browser/clinical/Storage test suite is not yet proved.

## Supervisor QA determination

The site is currently an **owner self-service prototype**, not a completed clinic management system. Its authenticated React routes are `/app/profile`, `/app/pets`, and `/app/appointments`. The app has no true clinical staff dashboard or module navigation, species and breed are unvalidated free-text fields, and patient photos/health/vaccination documents cannot be uploaded. The generic `✚` mark must be replaced with the clinic's owner-supplied visual identity. These are **product blockers**, not cosmetic nice-to-haves.

The user supplied the Dawney Animal Clinic logo in the supervisor conversation: a kangaroo veterinarian, Australia-map Union Jack motif and text **DAWNEY ANIMAL CLINIC**. It is a supplied image asset, not authorization to redraw, restyle or remove elements. The logo is **not yet in the repo**. Claude must receive the original or optimized asset from the owner, commit it in `web/public/brand/` and integrate it in visible site UI. No stock replacement, plus sign, broken image, default Vite icon, or guessed logo. Preserve the brand image's aspect ratio and transparency; do not stretch; provide fallback alt text and legible compact/mobile treatment. A favicon may use a properly legible crop only with owner approval.

## Release priorities (strict order)

**P0** — logo/branding, species–breed selector, private patient attachments, safe migration of existing pet record, functional app UI; close QA regressions.  
**P1** — staff-accessible clinic workspace (administrator/veterinarian/receptionist and optionally veterinary nurse after authorization), role-aware dashboard, patient records/visits/calendar, queue and practitioner workflow.  
**P2** — vaccination history/reminders, clinical encounter notes, treatments, prescriptions, inventory, invoices/receipts, reports and exports, configurable clinic hours/time zone, actual staff onboarding and recovery. Never mark a page complete because a menu item or non-persisted mock screen exists.

### A. Species/animal type catalog (P0)

- Change **Species** on Add/Edit Patient to a searchable, grouped, keyboard-accessible **selection**. No unrestricted unreviewed typing in the primary happy path. Include household companion animals, exotics, farm animals and common treated birds/fish/reptiles. Start with these **display categories and examples**, then expand as staff support requires:
  - **Companion mammals:** Dog, Cat, Rabbit, Guinea pig, Hamster, Gerbil, Mouse, Rat, Ferret, Chinchilla, Hedgehog, Sugar glider.
  - **Equine and livestock:** Horse, Donkey, Mule, Cattle/Cow, Water buffalo, Sheep, Goat, Pig, Camel, Alpaca, Llama.
  - **Poultry and birds:** Chicken, Duck, Goose, Turkey, Quail, Pigeon, Dove, Budgerigar, Cockatiel, Parrot, Macaw, Canary and other small birds.
  - **Reptiles/amphibians:** Turtle, Tortoise, Snake, Gecko, Bearded dragon, Iguana, Other lizard, Frog, Salamander.
  - **Aquatic/other:** Goldfish, Koi, Aquarium fish, Other fish; **Other/Not listed (staff review)**, not invented arbitrary breed names.
- "Species" is the requested UI label but many entries are everyday *animal types* rather than biological species. Make the catalog names sensible and optionally store scientific names. Clinic-supported species must be distinguishable from known-but-not-treated species before accepting appointments. Do NOT imply the clinic actually treats all listed animals without owner/veterinarian signoff.
- **Breed control is disabled until Species selected.** On a new Species selection, immediately clear an old Breed choice; fetch/show **only breeds belonging to selected species**, sorted, searchable, with optional valid `Mixed/Crossbreed`, `Unknown` and `Not applicable` where appropriate. Breed is optional when taxonomy is undefined, not a mandatory fabricated answer. For no breed coverage use `Not listed — ask clinic to review` rather than unrestricted arbitrary values.
- Use stable `species_id` and `breed_id` keys, clear species-to-breed referential validation at DB/API level, and curated source/provenance/version information. Prefer normalized `species_catalog`, `breed_catalog` tables or an equally secure documented equivalent, with `is_active` and optional `clinic_supported`. Never trust frontend-only species/breed validation.
- Seed a useful **broad set of recognized breeds** for dog, cat, rabbit, horse, cattle, sheep, goat and others supported by the clinic; catalog is extensible and explicitly NOT guaranteed exhaustive worldwide. Official reference starting points: American Kennel Club (https://www.akc.org/dog-breeds/), TICA (https://tica.org/ticas-breeds/browse-all-breeds/), FAO DAD-IS for livestock (https://www.fao.org/dad-is/data/breed-information/en). Review terms/attribution; do not bulk scrape/copy copyrighted page descriptions or imply a kennel registry is the only authoritative classification.
- **Existing rows:** Preserve the current real existing `pets.species`/`pets.breed` text; map known values case-insensitively/non-destructively and flag unmatched values for admin review; no conversion-induced loss or silent breed replacement.

### B. Patient photos and documents (P0)

- In Add/Edit Patient include optional **Profile photo**, **Health card** (if any), **Vaccination card** (if any). Allow appropriate multiple/replacement versions of documents, timestamp and uploader attribution; profile picture has a clear active-image rule. Do not make an upload mandatory to create/edit pet.
- Use the already-configured **private** Supabase Storage bucket `clinical-attachments`, **5 MiB per file**, MIME allowlist `image/png`, `image/jpeg`, `application/pdf`. A patient profile picture should accept PNG/JPEG only; cards accept PDF/PNG/JPEG. Do not create a public bucket for photos or add secret service keys to React.
- Existing Storage RLS object paths: `pets/<pet_id>/owners/<auth_uid>/<random-uuid>.<ext>` for patient-owner scoped files; `pets/<pet_id>/clinic/<random-uuid>.<ext>` for veterinarian/admin scoped files. Study the actual migration before using these paths; do not weaken policies.
- Pet must be persisted **before** upload so its UUID exists. Show per-file progress, MIME/size failure, safe retry, preview/download and removal/version request workflow. Prefer a `pet_attachments` metadata table with pet, category, object key, original filename (sanitized), MIME, size, uploader, timestamps and immutable/version state, with RLS. Ensure metadata and Storage ownership cannot drift on failure; orphan prevention/reconciliation and explicit operator-approved deletion.
- No publicly discoverable patient thumbnails, perpetual public URLs or anonymous reads. Only time-bounded signed URLs/authenticated requests where policies permit. Protect against cross-owner read/write, forged pet path, unauthorized clinic path, malicious HTML/SVG, oversize and wrong MIME, and XSS in filenames/notes. MIME restrictions alone are not virus scanning; note residual risks and avoid unsafe rendering.

### C. Role-aware application architecture (P1)

- The existing UI shows only **My profile / Patients / Appointments** even though the legacy PHP project had more clinic modules. This is a *pet owner portal*; create an independently permission-checked **Staff Clinic Workspace** for verified active membership, not by showing owner-only menus to everyone.
- Roles present in DB: `administrator`, `veterinarian`, `receptionist`. Consider **veterinary nurse/technician** via reviewed migration/RLS and permission matrix, never invent a privileged role client-side. Owners should see their own profile, patients, appointments and permitted documents. Staff need queue/today, full authorized patients/owners, encounter details, review-confirm-cancel workflow, medical records, vaccinations, prescriptions, document review and audit information according to role.
- First make a role/permission matrix and route inventory. Protect every data query and state transition in Supabase/RLS/trusted functions. Staff onboarding and MFA are owner-approval gated; never silently bootstrap a staff admin or seed fake working clinic data.
- Dashboard KPIs must query **actual persisted data**, show "no data yet"/pending where applicable; no fabricated statistics, disabled forms disguised as operational functionality, or empty template pages presented as complete.
- Scheduling must distinguish requested vs confirmed, clinic timezone and resource availability. The owner must approve opening hours, holidays, duration and concurrency before enforced scheduling; current device-local 30-minute selection is only provisional.

### D. UI, accessibility and branding (Claude owns visual work)

- Use owner-supplied brand logo on sign-in/login, header/sidebar, authenticated shell, favicon where legible, and a proper mobile treatment. Keep overall identity professional, clinic-focused and readable on dark/light backgrounds.
- Modernize layout: role-aware sidebar/topbar, home/dashboard, concise content density, meaningful patient cards with *actual* photo when permitted, patient detail sections/tabs, editable forms, appointment status/calendar, warnings and consistent buttons. Avoid oversized empty space and generic template appearance.
- A searchable species combobox with visible focus, ARIA labeling, `disabled` Breed control until species selection, explicit empty/not-listed states and a confirmation before changing species on an existing animal if breed will reset. Preserve form drafts during upload/network failures.
- Keyboard navigation, WCAG AA contrast, responsive 360/768/1440 px views, no horizontal overflow, loading/empty/error states, reduced-motion support, screen-reader labels and 2 distinct visual roles (owner vs staff where account provided). Screenshots should be from **real application state**, not mocked proof.

### E. QA acceptance matrix (release blocker if failed)

| Test ID | Required behavior |
|---|---|
| QA-01 | Owner-provided logo renders on auth, desktop sidebar and mobile; no obsolete `✚` as clinic logo; transparent/aspect-safe asset, descriptive alt |
| QA-02 | Species list grouped and searchable; includes dogs, cats, rabbits, horses, **cattle/cows**, birds, reptiles and fish; clinic-supported state explicit |
| QA-03 | Breed initially disabled; Dog→dog breeds only; Dog→Cat resets breed; Cattle→cattle breeds only; Unknown/Not applicable works without false breed |
| QA-04 | Forged/off-list species-breed pairing rejected by DB/API; editing existing legacy pet preserves valid prior data; migration is reversible/non-destructive |
| QA-05 | Add/Edit patient persists after refresh/logout/relogin and shows accurate photo/doc references; docs optional |
| QA-06 | Profile PNG/JPEG and card PDF/PNG/JPEG <=5 MiB accepted; invalid/oversize/SVG rejected without stray metadata; controlled retry/progress |
| QA-07 | Auth A cannot read, write, list, download or replace Auth B's patient files or file metadata; anon cannot read private files; clinic-path policy enforced |
| QA-08 | No secret keys, tokens, contact data or patient docs in logs, HTML bundle, GitHub, screenshots or public URLs |
| QA-09 | Owner user cannot access staff dashboard/clinical actions; role-specific menus and API checks agree; no self-grant / stale-role bypass |
| QA-10 | Booking persistence, resource overlap/cancellation and requested-vs-confirmed transitions work; approved timezone/hours required for final scheduling |
| QA-11 | UI passes desktop/mobile 360/768/1440 widths, keyboard flow, readable dark/light palettes, accessible errors/loading/empty states; no fake KPIs |
| QA-12 | CI tests, actual hosted browser checks, rollback and full restore evidence maintained; no clinical go-live until security, privacy and data recovery accepted |

**Evidence required per PR:** changed file/commit list, source-to-feature traceability, passing unit/integration/build tests, scoped DB policy/negative tests, screenshots of actual implemented UI, and exact unresolved issues. Green CI is not proof of real clinical acceptance; retain last verified deployment until new release is tested.

## Simultaneous AI ownership and merge order

**Astra (backend/security/architecture):** new `ai/chatgpt/phase4-animal-taxonomy-attachments` branch, own `supabase/migrations/`, `supabase/tests/`, `web/src/lib/`, domain validators/tests, scripts and backend docs. Define stable typed adapter/contracts for Claude. Implement a safe taxonomic catalog, species/breed validation and private attachment metadata/storage functions with RLS. Preserve current 1 pet/appointment. **Do not touch** `web/src/pages/`, `web/src/components/`, `web/src/styles.css`, or logo presentation assets while Claude works.

**Claude (frontend branding/UX):** new `ai/claude/phase4-react-modern-ui` from current `master`. Own `web/public/brand/` (after owner transfers attached logo), `web/src/components/`, `web/src/pages/`, and `web/src/styles.css`; implement responsive new branded shell, good real layouts and a form that consumes typed animal taxonomy/attachment adapters after Astra's contract is ready. No migrations/RLS/security bypass, no fake app data; visual improvements may proceed first in a separate PR to avoid waiting.

**Merge order:** Astra's reviewed schema/API PR first, then Claude refreshes from new master and integrates the real backend. Existing `ai/claude/admin-ui-foundation` Blade PR #1 is not the production target and must not be merged merely to save old visual work. Agents must update handoff only after checking current head; do not independently edit the same handoff section concurrently.

## External blockers and control points

- User-supplied logo is visible in current supervisor conversation but not yet in GitHub. Owner needs to attach the original logo to Claude if Claude cannot access this conversation image; commit and verify under `web/public/brand/` before claiming QA-01 passed.
- No broad clinical support list or clinic schedule has been approved by a veterinarian; supporting catalog entries does not mean offering services to all animals.
- Any new Supabase migration requires RLS review, reversible data mapping plan and real DB verification. Do not run clinical/Storage synthetic-write smoke modes without explicit owner authorization. Existing human-created test patient/appointment must not be deleted by cleanup.
- Full real Auth/Storage recovery and clinical staff permission workflows remain pending. Cloudflare deployment is a **preview/prototype**, not patient-data production sign-off.
