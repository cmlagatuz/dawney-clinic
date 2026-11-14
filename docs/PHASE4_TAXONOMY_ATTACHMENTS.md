# Phase 4 P0 — Animal taxonomy and private patient attachment contract

**Scope:** backend, database, tests and TypeScript adapters only. **No React components modified.**
**Status:** [PR #29](https://github.com/cmlagatuz/dawney-clinic/pull/29) merged and [isolated PostgreSQL17 + Node/TypeScript CI #43483917460](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43483917460) **PASSED**. Connected Supabase still has only six applied migrations; these two new migration files **have NOT been applied**. App page integration and live HTTP/Storage denial tests remain pending owner/Claude coordination. Existing pet and appointment data must survive.

## Animal catalog API — Claude integration

| Operation | Export | Behavior |
| --- | --- | --- |
| List grouped species | `listAnimalTypes()` in `web/src/lib/taxonomy.ts` | Server-filtered active reviewed species; `group_name`, `clinic_supported` and reference provenance |
| Dependent breed choices | `listBreedsForSpecies(speciesId)` | Active matching breeds only; `kind: recognized/mixed/unknown/not_applicable`; clear prior breed after species changes |
| Register selected pet | `addCatalogPet(user,input)` | Requires `speciesId`, optional `breedId`; server resolves canonical text and database trigger/compound FK rejects forged mismatches |
| Update selected pet | `editCatalogPet(user,petId,input)` | Owner ID cannot be forged; RLS owner-scopes update; existing text archive retained where not changed |
| Legacy rows | `listCatalogPets(user)` | Legacy `species`/`breed` text stays verbatim; `species_id`/`breed_id` may be null; `taxonomy_review_needed=true` signals unresolved mapping |
| Staff-reviewed additions | Trusted SQL/operator only | Create proposed `pending` rows; verified operator reviews and activates; no ordinary user insert/update into catalogs |

The `public.species_catalog.id` and `public.breed_catalog.id` identifiers are stable lower-case slugs; `pets(species_id,breed_id)` references a composite FK `breed_catalog(id,species_id)`. A DB trigger resolves existing common legacy form strings and rejects new unlisted species/breeds. Do not mark `clinic_supported=true` until the actual clinic veterinarian formally confirms services.

Seed is intentionally **limited and curated**, not a worldwide registry. At this checkpoint it includes 50 everyday animal types and 237 recognized/sentinel options spanning companion mammals, livestock including horses/cattle/sheep/goats, birds, reptiles/amphibians and fish. Breed names draw on [AKC](https://www.akc.org/dog-breeds/) (dogs), [TICA](https://tica.org/ticas-breeds/browse-all-breeds/) (cats), and [FAO DAD-IS](https://www.fao.org/dad-is/en/) (livestock), with additional locally curated example names. Source name/URL stored per recognized breed; no registry descriptions are copied. Mixed, Unknown and Not applicable are labeled as UX conventions and should not be misrepresented as registered breeds.

## Upload and private file contract

`web/src/lib/pet-attachments.ts` exports:

- `uploadPatientAttachment(user,petId,category,file,scope='owners')` → `UploadResult`. Requires the actual confirmed Supabase Auth session, persisted pet UUID and owner/staff role, exact MIME `image/png`, `image/jpeg` or `application/pdf`, file size 1–5 MiB and PNG/JPEG/PDF magic bytes. A **profile_photo** is image only. Owner path: `pets/<pet UUID>/owners/<auth uid>/<random UUID>.(png|jpg|pdf)`. Clinic role path: `pets/<pet UUID>/clinic/<random UUID>.(png|jpg|pdf)` (vet/admin only). Ordinary users cannot overwrite/delete Storage objects.
- First Storage upload with `upsert:false`, then DB metadata insert. Metadata insert trigger validates existing object path/patient/uploader, MIME and Storage-reported size before allocating monotonic `version_no` under a transaction advisory lock. A replacement **creates a new version with a new object key**, never updates/removes old files. Latest version is active. Source original filename sanitized; no public URL or signed bearer URL issued.
- **Known two-service atomicity limitation:** Storage and PostgreSQL are separate, so if upload succeeds and metadata finalization fails, adapter returns `{status:'uploaded_unindexed',objectPath,reason:'metadata_finalization_failed'}`. Do not falsely show a saved document, silently overwrite or automatically delete. Trusted operator reconciliation or same-account `finalizeUploadedAttachment` with the original file metadata is needed; log no private path/PII to public consoles.
- `listPatientAttachments(user,petId)`, `currentAttachment(rows,category)`, `downloadPatientAttachment(user,petId,attachmentId)` list only RLS-visible metadata and perform an **authenticated private Storage download** by verified row ID; never use `getPublicUrl`.
- Metadata has no ordinary UPDATE/DELETE privileges and immutable version numbers. All RLS rows are limited by Supabase Auth and the **existing private Storage policies**. No bucket permissions, public flags, or old Storage policies are changed.

## Security, validations and QA coverage

| QA | Backend scope | Status / evidence |
| --- | --- | --- |
| QA-01 | Original visual logo | Claude owns; not covered here |
| QA-02 | 50 grouped species, review flag, livestock entries | SQL seed + API; require CI and deployed verification |
| QA-03 | Breed per species, sentinels | Composite FK + API list, dependent clearing belongs to Claude UI |
| QA-04 | Cross-species forgery, legacy data preservation | SQL trigger/FK + isolated DB regression |
| QA-05 | Persisted patient + optional attachments | Backend adapters; hosted Auth write/read UI test owner-gated |
| QA-06 | MIME, 5MiB, image-only photo, file magic, versioning | Node validators + SQL constraints; live storage bytes test owner-gated |
| QA-07 | A/B and anonymous file metadata privacy | Isolated RLS negative test; **live JWT Storage access tests not run** |
| QA-08 | No secrets/signed public links | Static source guard and private authenticated download; broader audit pending |
| QA-09 | Staff authorizations | Existing staff SQL remains; no new roles/bootstrap |
| QA-10 | Scheduling | Existing overlap and status lifecycle unchanged |
| QA-11 | Responsive, accessible UI | Claude owns; no UI modifications |
| QA-12 | Isolated CI/verified migration/real restore | CI pending; real provider smoke and full restore not approved |

**Residual risks:** File MIME/magic checks cannot exclude malicious PDF payloads; preview PDFs as downloads rather than executing embedded scripts; no antivirus scanner. Service/storage bytes and metadata are not one ACID transaction, orphan reconciliation required. Supabase Free has no guaranteed backups/PITR; clinic rollout is prohibited pending full real recovery rehearsal. Filename sanitation is a defense-in-depth measure, never render user-supplied names as HTML. Prevent unapproved clinic appointment booking by checking `clinic_supported` only after medical support approval; existing booking architecture is provisional.

## Installation, rollback and verification

- Apply the two new migrations **in sequence** after migration approval, a trusted backup and review of the user's existing one pet and appointment. Both are additive: new catalog and metadata tables, nullable catalog IDs on pets, case-insensitive conservative mapping (preserves old text), no deletion or replacement of rows/files. Changes to schema are not reverted by Cloudflare static rollback.
- Run `.github/workflows/phase4-taxonomy-attachments.yml` PR CI. It provisions **disposable PostgreSQL17**, fake Auth/owner/Storage tables, executes both versioned migrations and denial assertions; it never uses connected Supabase credentials. It also builds TypeScript/Vite with inert publishable key and runs existing Node tests.
- For connected project **only** after release approval, inspect migration list and row counts, verify `pg_policies`/column grants, preview both known and unmatched pet mappings, and run real A/B HTTP/storage negative and persistence tests with explicit owner permission. Do not run live synthetic-write workflows automatically.
- If migration application fails, stop deployment and preserve the existing database; fix through a new versioned migration, never edit an applied migration or force-delete live data. Only verified backups and a dedicated restore rehearsal justify any destructive rollback.

## Source links

- Supabase private Storage: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Seed provenance: https://www.akc.org/dog-breeds/ ; https://tica.org/ticas-breeds/browse-all-breeds/ ; https://www.fao.org/dad-is/en/
