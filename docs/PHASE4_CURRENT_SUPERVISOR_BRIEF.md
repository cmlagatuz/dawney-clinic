# Dawney Clinic — Current Supervisor Brief (AUTHORITATIVE)

**Verified: 2026-11-14 05:20 Asia/Riyadh.** Source of truth: latest GitHub master, connected Supabase and [Phase 4 QA contract](PHASE4_PRODUCT_QA_SPEC.md). Earlier instructions in the long [AI_HANDOFF.md](AI_HANDOFF.md) are historical when conflicting with this brief.

## Current verified state — separate *code* from *live*

| Workstream | GitHub | Real connected/live status |
| --- | --- | --- |
| Astra Phase 4 backend | **Merged** PRs [#29](https://github.com/cmlagatuz/dawney-clinic/pull/29), [#30](https://github.com/cmlagatuz/dawney-clinic/pull/30), [#31](https://github.com/cmlagatuz/dawney-clinic/pull/31), [#33](https://github.com/cmlagatuz/dawney-clinic/pull/33). Disposable PG17/Node/TS tests passed | 2 new SQL migrations committed but **NOT APPLIED**: connected Supabase has only 6 earlier migrations, 7 RLS application tables, no `species_catalog`/`breed_catalog`/`pet_attachments`. |
| Claude React redesign | [PR #34](https://github.com/cmlagatuz/dawney-clinic/pull/34) **OPEN, unmerged, not draft**, mergeable but API `mergeable_state=unstable`, four latest CI workflows SUCCESS | New real logo, desktop/mobile dark/light design, owner Overview route only in branch. NOT on verified live release; simulated screenshots use stubbed data; no authenticated hosted browser check. |
| Phase 4 P0 patient form | Astra typed APIs in merged master: 50 animal types, 237 curated breed/fallback choices and private attachment metadata adapters; isolated tests pass | Claude PR #34 **still has free-text Species/Breed and no attachments controls**; front/back integration **NOT COMPLETED**; no patient documents stored. |
| Hosted baseline | https://dawney-clinic.pages.dev public HTTPS/anonymous Chromium checks previously passed | 2 confirmed Auth users, 2 owners, **1 existing pet**, **1 appointment**, 1 event, 0 staff, 0 clinical records, 0 private files. Full hosted authenticated/clinical/Storage tests and production recovery remain pending. |

### Newly verified QA blocker — preserve existing patient breed

Current existing live patient is **Dog / Chow Chow** (read-only inspection, no name/ID disclosed). The merged Phase 4 seed does **NOT** contain `Chow Chow`. See **[P0 Issue #35](https://github.com/cmlagatuz/dawney-clinic/issues/35)**. Migration must not be applied until seed/mapping has been corrected and a non-destructive migration preview proves the old species/breed fields stay unchanged. Do not simply label it Unknown or silently remove the breed.

## New Astra assignment (BACKEND ONLY, priority order)

1. **Resolve #35**: seed Chow Chow under Dog with stable ID; audit *existing* distinct legacy species/breed values vs catalog, add realistic CI mapping fixture and ensure data-preserving migration. No live writes until owner-approved backup and rollout.
2. **Review two pending migrations** `20261113211600_phase4_taxonomy_attachments.sql` and `20261113211700_phase4_animal_catalog_seed.sql` for compatibility, zero-loss mapping, RLS, new grants, attachment validation and no duplicate history. Produce preflight/migration execution + rollback/repair and verify-at-each-step checklist. Do not apply remotely without explicit approval.
3. **Support Claude contracts**: test `web/src/lib/taxonomy.ts` and `web/src/lib/pet-attachments.ts` with existing page contracts; expose precise types, safe errors, private photo/card URL lifecycle; avoid `web/src/pages`, `components`, `styles.css`, `public/brand`.
4. **Prepare role-safe staff clinical contracts**, permission matrix, real data dashboard query APIs and appointment review flow in isolated backend PR only. Do not create privileged staff identities or fabricate records.
5. Push scoped PRs, passing isolated and security tests, update single current handoff. Do not rerun completed baseline Auth or read-only tests.

## New Claude assignment (REACT UI ONLY, priority order)

1. **Close QA for PR #34 as visual foundation**: reviewer comments on PR #34; confirm newest master integration, updated `/app/overview` protected deep-link/redirect checks, actual logo in auth + desktop/mobile and accessible light/dark; 360/768/1440, keyboard navigation, no PII; all CI passes. Once reviewable, merge the **visual-only** PR and verify actual Cloudflare deployed commit; do not label Phase 4 P0 complete.
2. **Second PR from updated master**: integrate new typed taxonomy API into Add/Edit Patient. Searchable grouped Species (including Cattle/Cow); Breed disabled until species selected; reset on species switch; show only matched breeds; preserve unmatched legacy text with explicit review state and no silent data loss. Do not hardcode alternative catalogs.
3. **Add private attachment UI** for optional profile photo (JPEG/PNG), health/vaccination cards (PDF/JPEG/PNG) 5 MiB with preview/download, version, saving/retry, errors; call Astra secure adapters only. **Do not deploy a broken schema-dependent UI until two migrations are approved/applied and verified.**
4. Incrementally improve actual role-aware UI from staff adapter availability; never display fake staff KPIs or bypass backend role checking. Screenshots must be clearly marked mock or live. Run comprehensive tests and request supervisor review.

## Non-negotiable gates

- **Merge order:** finish PR #34 **visual only** after review; Astra fixes issue #35 and validates both migrations + tests; supervisor obtains owner approval for live migration and preservation before Astra applies; Claude patient-form PR integrates once schema/API contracts are ready. Branches and file ownership remain exclusive.
- No clinical or Storage synthetic-write live security smoke, admin bootstrap/role grant, deleting existing pet/appointment, real patient-document onboarding, or billing without separate owner approval.
- No paid products, secret keys in frontend or GitHub, fake deployed claims, or premature clinic go-live.
- Tests for QA-01…QA-12 in [spec](PHASE4_PRODUCT_QA_SPEC.md) are required; green CI/visual previews are not substitutes for real hosted authenticated access and negative cross-account private-file tests.
