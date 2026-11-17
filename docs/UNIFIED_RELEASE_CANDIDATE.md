# Dawney — Unified Non-Production Release Candidate (PR #69 + PR #70)

**Gate status: GROK SOURCE SECURITY ACCEPTED FOR INTEGRATION — COMBINED CI REQUIRED; NOT RELEASE/LIVE READY.** No production or staging SQL, hosted Auth/Storage requests, synthetic hosted writes, staff bootstrap, patient exports, provider publication, master merge, force push or paid resource.

## Pinned source ancestry

| Source | Verified reviewed head | Role |
| --- | --- | --- |
| PR [#66](https://github.com/cmlagatuz/dawney-clinic/pull/66) | `2bbcbde08f3a73aa222bec2c8f3332f23b09eba2` | Original backend integrations, RLS/booking/staff/Storage, preserved via PR #67 |
| PR [#67](https://github.com/cmlagatuz/dawney-clinic/pull/67) | `5b8f7a03292123ed0314b5b7c6304d410b2fc94e` | Already merged frontend/backend source ancestry |
| PR [#69](https://github.com/cmlagatuz/dawney-clinic/pull/69) | `63a2b68ee93463f426cafc6bdf468376343001cf` | Candidate base, full-tree PG17 test assets (first merge parent) |
| PR [#70](https://github.com/cmlagatuz/dawney-clinic/pull/70) | `2a42489a4b85c46979f9c971474fc74579f673de` | Claude booking compatibility (second merge parent) |
| PR [#68](https://github.com/cmlagatuz/dawney-clinic/pull/68) | `9bc84ef3cde86d6c052c4d40012ffbee9c2391f0` | **SOURCE IMPORTED after [Grok approval #6948651938](https://github.com/cmlagatuz/dawney-clinic/pull/68#issuecomment-6948651938)**. Hosted execution still NOT authorized |

**First normal, non-force merge commit:** `da1d26b90bdaf515a4be37bd4b692d0569edaff9` with parents PR69 then PR70. **Second two-parent merge:** `106aa9f76d4d894578e01599456c7b536773149c` with parents previous candidate and Grok-accepted PR68. PR69's three CI test files and all backend files remain unchanged at that merge. Git's common PR67 ancestor was verified: each of PR70's seven modified/added paths was unmodified on PR69 relative to PR67; no conflict or frontend manual edit.

### Grok-accepted PR68 source blobs imported (no security harness edits)

Five exact source entries were imported from PR68; its concurrent handoff change **was not allowed to overwrite Claude's PR70 handoff**. The overlapping `docs/AI_HANDOFF.md` keeps the byte-exact PR70 blob shown below; this manifest captures PR68 provenance instead.

| Imported PR68 path | Git blob SHA |
| --- | --- |
| `.github/workflows/hosted-security-acceptance-source.yml` | `c49126062eecd97ffd415b99637b42809e1a0c91` |
| `docs/HOSTED_SECURITY_ACCEPTANCE.md` | `c63486294c9ec1f9d7334d55808bc51281f1def2` |
| `scripts/hosted-acceptance/acceptance.mjs` | `ab77c3cb5cad7e3d52f39e418e4c01fb595c9afe` |
| `scripts/hosted-acceptance/guards.mjs` | `c6361ee848c1c78370fc5e771d8765090c367708` |
| `scripts/hosted-acceptance/tests/acceptance.test.mjs` | `c5d2dd61e4fecd0f65b8f57fd30cfc240f0131ea` |

The source harness remains **inert by direct CLI (exit 3)** and has **no default network adapter**. Grok accepted source inclusion only; actual staging/production JWT/RLS/Storage tests, cross-host approval replay prevention and manual cleanup remain unverified/owner-gated.

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
The existing full-tree PG17 script validates immutable Git blob SHAs for all eleven SQL files and crucial booking/staff/Storage tests; the repaired script adds exact PR69/PR70/PR68 ancestry, all seven Claude source-blob assertions and five Grok-reviewed harness source-blob assertions. The offline provider-shim history database creates the test Dog/Chow Chow and appointment **before** Phase4 migration and checks exact historical field preservation afterward. Nothing touches hosted Supabase.

## CI gate and stop conditions

- Pull-request-only `.github/workflows/full-tree-pg17-security.yml`: disposable **PostgreSQL 17**, original six + four + Storage correction, RLS/Storage/booking/staff negative cases, nonce replay, source and historic record preservation.
- Node 22: `web/npm ci`, `npm test`, strict TypeScript/`npm run build`, scheduling tests, bundled-key safety and the **Grok-accepted hosted harness offline mock contracts** with inert-CLI (exit 3) assertion.
- Chromium: `scripts/browser/tests/*.test.mjs`, local Vite preview (127.0.0.1), and `scripts/browser/anonymous.mjs`. **Chromium here is local-source browser QA, not hosted Auth/RLS proof.**
- Legacy PHP and repository safety workflows run as PR checks. Record all final-head run URLs only after observing completed jobs.
- **STOP** if source head drift, unapproved file modification, CI failure, migration/hash mismatch or new frontend conflict. Grok accepted PR68 **for source inclusion only**; this does not authorize an external adapter, staging SQL, hosted requests, patient data or a clinical release. A local cleanup journal's cross-host replay limitation remains documented in PR68.
- No claim of source-release readiness, staging or clinic-live readiness on green mock CI alone.
