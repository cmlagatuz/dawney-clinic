# Dawney — Unified Non-Production Release Candidate (PR #69 + PR #70)

**Gate status: AWAITING SECURITY REVIEW — NOT RELEASE READY.** No production or staging SQL, hosted Auth/Storage requests, synthetic hosted writes, staff bootstrap, patient exports, provider publication, master merge, force push or paid resource.

## Pinned source ancestry

| Source | Verified reviewed head | Role |
| --- | --- | --- |
| PR [#66](https://github.com/cmlagatuz/dawney-clinic/pull/66) | `2bbcbde08f3a73aa222bec2c8f3332f23b09eba2` | Original backend integrations, RLS/booking/staff/Storage, preserved via PR #67 |
| PR [#67](https://github.com/cmlagatuz/dawney-clinic/pull/67) | `5b8f7a03292123ed0314b5b7c6304d410b2fc94e` | Already merged frontend/backend source ancestry |
| PR [#69](https://github.com/cmlagatuz/dawney-clinic/pull/69) | `63a2b68ee93463f426cafc6bdf468376343001cf` | Candidate base, full-tree PG17 test assets (first merge parent) |
| PR [#70](https://github.com/cmlagatuz/dawney-clinic/pull/70) | `2a42489a4b85c46979f9c971474fc74579f673de` | Claude booking compatibility (second merge parent) |
| PR [#68](https://github.com/cmlagatuz/dawney-clinic/pull/68) | `9bc84ef3cde86d6c052c4d40012ffbee9c2391f0` | **NOT IMPORTED**. Await independent Grok fixed-head source security acceptance before inclusion |

**Actual normal, non-force merge commit:** `da1d26b90bdaf515a4be37bd4b692d0569edaff9` with parents PR69 then PR70. PR69's three CI test files and all backend files remain unchanged at that merge. Git's common PR67 ancestor was verified: each of PR70's seven modified/added paths was unmodified on PR69 relative to PR67; no conflict or frontend manual edit.

### Exactly preserved PR70 blob contents (no Claude edits)

| Path | Git blob SHA |
| --- | --- |
| `docs/AI_HANDOFF.md` | `cd29660b30eafe7ff7bf475e11f457c7443dc779` |
| `web/src/pages/AppointmentsPage.tsx` | `4fb506194b1fa22ef14d795333e4a9bed0e25598` |
| `web/src/public-site/booking-mode.d.mts` | `61dfb4d1dc0479eead44b11fb4e4b9fd08aef932` |
| `web/src/public-site/booking-mode.mjs` | `3f67451f7ca6c70108ea04067d900078d44e48fe` |
| `web/src/public-site/usePatientEligibility.ts` | `c3f51706a6415d57aeb73081ff51033877089fe3` |
| `web/src/public-site/useServiceSpecies.ts` | `d14fd817ed6d61ad95d7bbb9e0796331fec7a3a2` |
| `web/tests/owner-booking-view.test.mjs` | `0782a74fdb33532cd27dba75a395c08e1e2d23bc` |

## Unchanged migration/security chain

Six original Phase2/3 SQL files (no edits):
`20261113070302`, `20261113070834`, `20261113074938`,
`20261113095318`, `20261113100958`, `20261113101626`.

Four strictly ordered Phase4:
1. `20261113211600_phase4_taxonomy_attachments.sql` (historical text retained)
2. `20261113211700_phase4_animal_catalog_seed.sql` (recognizes Dog/Chow Chow)
3. `20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql` (exact-one trigger)
4. `20261114090000_phase4_public_booking_contract.sql` (approved service/RPC, privacy, nonce and resource conflict)

Separate additive policy correction:
`20261116002500_phase3_storage_outer_object_path_rls_fix.sql`.
The existing full-tree PG17 script validates immutable Git blob SHAs for all eleven SQL files and crucial booking/staff/Storage tests; the repaired script adds exact PR69/PR70 ancestry and all seven source-blob assertions. The offline provider-shim history database creates the test Dog/Chow Chow and appointment **before** Phase4 migration and checks exact historical field preservation afterward. Nothing touches hosted Supabase.

## CI gate and stop conditions

- Pull-request-only `.github/workflows/full-tree-pg17-security.yml`: disposable **PostgreSQL 17**, original six + four + Storage correction, RLS/Storage/booking/staff negative cases, nonce replay, source and historic record preservation.
- Node 22: `web/npm ci`, `npm test`, strict TypeScript/`npm run build`, scheduling tests and bundled-key safety.
- Chromium: `scripts/browser/tests/*.test.mjs`, local Vite preview (127.0.0.1), and `scripts/browser/anonymous.mjs`. **Chromium here is local-source browser QA, not hosted Auth/RLS proof.**
- Legacy PHP and repository safety workflows run as PR checks. Record all final-head run URLs only after observing completed jobs.
- **STOP** if source head drift, unapproved file modification, CI failure, migration/hash mismatch, new frontend conflict or missing Grok independent acceptance of PR68. Do not integrate PR68 until Grok explicitly approves that repaired exact head; then do a separate reviewed merge into this SAME candidate and rerun relevant gates. A local cleanup journal's cross-host replay limitation remains documented in PR68.
- No claim of source-release readiness, staging or clinic-live readiness on green mock CI alone.
