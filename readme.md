# Dawney Veterinary Clinic

## Project Manager milestone register — 26 November 2026

**Release verdict: accepted RC1 source and bounded preview; clinic-live NO-GO.** The December 3 target remains unchanged. This documentation-only update does not promote source or authorize deployment.

| Milestone | Exact evidence | Standing |
| --- | --- | --- |
| Integrated RC0 | [PR129](https://github.com/cmlagatuz/dawney-clinic/pull/129) `078053120774e856c9ddaa8c8027b3c891e9e8f6` | Historical source checkpoint; 16/16 CI |
| Staff appointment lifecycle | [PR130](https://github.com/cmlagatuz/dawney-clinic/pull/130) `b6ee64b38ca4ce2965f2b02f09a4e5584aa56608` | Reviewed source, additive migration 21; hosted activation pending |
| Frontend hardening and public navigation | [PR134](https://github.com/cmlagatuz/dawney-clinic/pull/134), [PR135](https://github.com/cmlagatuz/dawney-clinic/pull/135) | Accepted exact source imported into RC1 |
| Integrated RC1 | [PR132](https://github.com/cmlagatuz/dawney-clinic/pull/132) `2e029697fc2c446171a951167b30bcf7679c286e` | 15/15 workflows successful; 21 migration pins and 28 approved frontend blobs preserved; disposable PG17 and signed synthetic recovery passed |
| Independent RC1 acceptance | [SOL](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7162248449), [TERRA](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7162230088) | Scoped source security and functional CI PASS |
| Public preview and promotion preflight | [TERRA](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7163002880), [ASTRA](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7162980136) | Seven public routes rendered; promotion feasible, not executed |
| Manual backup direction | [Owner-approved direction](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7163439457) | Supabase retained; no dedicated recovery computer or scheduled agent automation |
| Manual recovery correction | [PR136](https://github.com/cmlagatuz/dawney-clinic/pull/136) `e8537d5535ac7b5277cd790968ac26d7494c8bad` | 4/4 CI; guided menu, differentiated errors and signed synthetic recovery; corrected head independent acceptance pending; collection/import still manual, hosted restoration NOT VERIFIED |
| Clinical chart connection | [PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `1f1dd8a7ef8f56d87cfa2eb726e4150262054c61` | Scoped SOL source security and TERRA in-page functional PASS; 309/309 frontend; flags OFF |
| Connected clinical browser coverage | [PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `931b231f957ee9f51dcd380f0e9c610b7ca77192` | Test-only delta; 309/310 React, test 112 failed; 3/5 CI overall, historical PG17 guard also blocked before SQL. Durable save reconciliation remains an activation blocker |


### PM checkpoint — 26 November 2026, 14:27 Asia/Riyadh

- [ASTRA PR140](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7190411566) `8a3b35f94b63ac318b9f977d33d4f7153fbd2cc5`: 20/20 triggered workflows; actual [fail-closed static gate](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45808597580/job/139870243019) 13/13 gate tests, 313/313 frontend, 9/9 release, zero failed/skipped/cancelled; [ASTRA appointment](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45808597611/job/139870243284) 313/313 and current #1–23 signed synthetic restore verified. 14 CI/docs changed paths; no web/SQL/recovery changes per delivery. Independent SOL/TERRA exact delta reviews pending.
- [CLOUD PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7190370662) `c0a2d7c9011ee6e1d7337bd8c05eff6af2877586`: five-path corrective delta including useOpsData production refresh fix; actual [React](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45808023396/job/139868279034) and [static](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45808023410/job/139868278721) 314/314 each, #88/#222/#238/#265/#266 pass, static 9/9 release, tsc/Vite PASS. 4/6 triggered workflows; inherited historical source guards remain red. Independent SOL/TERRA acceptance pending; final design not imported.
- SOL #7190344497 and TERRA #7190363834/#7190360064 prior blocker assessments accepted; immediate exact new gate/frontend delta reviews. Freeze both candidates; ASTRA final exact import only after PM accepts both deltas. No new features or competing PRs. Supabase healthy, production prefix6/staging11 reverified after transient connection error; previews reported deployed. Actual provider recovery, physical schema, hosted Auth/Storage/persistence and 34 operator UAT remain unverified. Master unchanged. Clinic-live NO-GO; Dec3 conditional target. No hosted writes, flags, merge/deploy, automation/spend.

### PM checkpoint — 26 November 2026, 14:00 Asia/Riyadh

- [Combined RC2 PR140](https://github.com/cmlagatuz/dawney-clinic/pull/140) `55e86d4f431878d9e4c142b657d7640c81272c6a` unchanged, 19/20 triggered workflows; [SOL scoped source/provenance PASS](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7189154844) and [TERRA scoped combined evidence PASS](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7189168477) accepted, not final CI/hosted acceptance.
- [CLOUD PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `f928a559d107e16179f7b90753958de537ebe972`: one test-only #88 correction. Actual [React job](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45799679915/job/139839317917) 313/314 (#265 held queue Cancel assertion FAIL); [static job](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45799679967/job/139839318308) 313/314 (#238 verified pet selection FAIL), despite workflow success; release suite reports zero tests, build ran. #88/#222 pass both. No product root cause confirmed. PM identifies shared phase3-release.yml shell AND-list failure propagation/cwd issue; ASTRA owns fail-closed gate correction, CLOUD owns browser readiness and product behavior only. No blind retries or weakened assertions.
- SOL/TERRA reviews advance only on exact new deltas; TERRA prior corrective report accepted as assessment, recurring #265 gate remains open. Both previews reported deployed, no independent screenshot or provider verification. Hosted metadata healthy production 6/staging 11 migrations. Independent recovery, physical schema, hosted Auth/Storage/clinical persistence and all 34 UAT checks remain unverified. Master unchanged. Dec3 conditional core target; no hosted writes, flags, merge/deploy, automation or spend.

### PM checkpoint — 26 November 2026, 13:11 Asia/Riyadh

- [ASTRA combined RC2](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7187535368) `55e86d4f431878d9e4c142b657d7640c81272c6a`: exact accepted clinical frontend imported, 23 migrations preserved per report; 19/20 triggered workflows, actual unified 313/313 +69/69 +5/5 and current #1–23 signed synthetic restore PASS. Standalone clinical PG17 restored to green. Offline preflight 21/21 reported, actual new frontend drift refusal PASS. Mandatory ASTRA workflow fails browser #88 (312/313), same failure on CLOUD. Not final source acceptance.
- [CLOUD](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7187500695) `4ed79ff9bec80ce55c7fe965a5f1adcb6d09fa58`: two test-only paths; actual #222/#265/#266 PASS in both React/static; static 314/314, React 313/314 due #88 (line136 password form after path change). Shared test synchronization hypothesis not proven product defect; CLOUD sole correction owner; design import still gated. 3/6 workflows; historical guards red on isolated branch.
- [SOL preflight source PASS](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7187494179) at 939bc5f1237d90df431d06408e8812682fd58421 accepted within scope. [TERRA frozen design review](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7187514825) accepted as completed review, not final UI acceptance. SOL/TERRA continue exact combined and corrective delta reviews; no duplicate implementation. No screenshot-based design verdict.
- Provider metadata verified healthy; production exact 6/staging exact 11 versions. Actual provider recovery, physical schema, real Auth/Storage and 34 UAT checks NOT VERIFIED. Cloudflare reports previews deployed for both exact heads. Master unchanged. No hosted actions, flags, merge, deployment, automation or spend. Clinic-live NO-GO.

### PM checkpoint — 26 November 2026, 11:52 Asia/Riyadh

- [ASTRA PR140](https://github.com/cmlagatuz/dawney-clinic/pull/140) `939bc5f1237d90df431d06408e8812682fd58421`: nine-path release-preparation delta, 17/17 triggered workflows successful; [offline preflight](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45776804506/job/139762303937) 2 positive +18 refusal cases PASS. Historical 23 migrations and recovery/web source unchanged per delivery. Independent SOL delta acceptance pending; no final frontend import. Hosted job skipped.
- [CLOUD PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `c8f43e65313095e38367e0696edf0fbc1bb74c58`: professional 11-path source delta; [actual React CI](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45778214879/job/139766989427) 313/314, new #222 professional UI PASS, #265 appointment lifecycle fails at enabled Cancel appointment after confirm. Earlier #266 intermittent failure recovered. 3/6 workflows; historical PG17 and unified source guards also red. No final design acceptance or screenshot claim.
- [SOL recovery readiness](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7185777667) and [TERRA UAT package](https://github.com/cmlagatuz/dawney-clinic/issues/63#issuecomment-7185801442) delivered; PM accepts preparation, not operational readiness. 34 operator checks NOT RUN. Independent destination, physical schema, hosted Auth/Storage/persistence and recovery remain unverified.
- PM accelerates incremental integration: ASTRA may import already independently accepted 313-test PR137 `052b7223ad3208e5644e39bc2e72ae11f2cc74bf` into same PR140 as provisional combined checkpoint while SOL reviews pinned release-preparation parent; no unaccepted design import. CLOUD sole owner of frontend regression correction and final design. TERRA independent QA delta review and owner evidence checklist; no duplicate historical reviews. Final design import gated by exact CI/independent/PM acceptance.
- Fresh provider history remains exact #1–6 production and #1–11 staging, both healthy metadata; 17/12 remaining. Cloudflare bot reports separate design preview. Master unchanged; no hosted changes, real data, flags, merge, automation, spend. Clinic-live NO-GO; Dec3 target conditional.

### PM checkpoint — 26 November 2026, 10:12 Asia/Riyadh

- PM accepts [SOL intermediate integration PASS](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7184969994) at PR140 `ce427658860d9f3421d9dde06dc0fdb0c84a87da`, 15/15 triggered workflows, 23/23 migration and 20/20 delta ledger entries independently verified. No final frontend import. [SOL test-only PASS](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7184970700) and [TERRA direct functional PASS](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7185055077) at PR137 `052b7223ad3208e5644e39bc2e72ae11f2cc74bf`, 313/313 actual React CI. CHART-01 closed within source/synthetic scope; native history limitation and hosted proof remain. TERRA direct GitHub reporting works; local archive optional.
- PM release-first work packages: ASTRA exact 23-version offline operator preflight and release engineering, then final approved frontend integration; CLOUD bounded launch-quality UI implementation now; SOL independent hosted-recovery feasibility/approval readiness, then final delta review; TERRA role-based operator UAT/evidence and later visual/final functional acceptance. No duplicate historical audit or new feature contracts.
- Fresh read-only provider history matches source prefix production #1–6 / staging #1–11 (17 / 12 remaining respectively); both healthy metadata. Physical schema, compatible independent recovery destination, actual provider backup/restore, staging writes, clinical policy and final GO not authorized or verified. Current master unchanged. Dec3 target; core scope first, unsupported billing, dispensing, clinical finalization, messaging remain disabled/partial. No hosted actions, merge, activation, third-party execution, automation or spend.

### PM checkpoint — 26 November 2026, 09:51 Asia/Riyadh

- [PR140 intermediate RC2](https://github.com/cmlagatuz/dawney-clinic/pull/140) `ce427658860d9f3421d9dde06dc0fdb0c84a87da`: 15/15 triggered workflows PASS; 21-path delta, 23 migrations and RC1 web tree reported preserved. Manual recovery imported; strict provenance and historical guards reconciled. [Actual #23 regression/restore](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45769785625/job/139739392570), [manual recovery](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45769785504/job/139739392303), [unified release](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45769785457) passed. Independent integration-delta acceptance pending; no final CLOUD import.
- [PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `052b7223ad3208e5644e39bc2e72ae11f2cc74bf`: one test-file delta; [actual React CI](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45769047333/job/139736971521) 313/313, new #114/#115 PASS, zero fail/skip, tsc/Vite PASS. 4/5 workflows; old standalone PG17 pin remains red. Mock reload and scope tests are not provider persistence. TERRA verdict pending; design not implemented.
- PM verifies CI checkpoints, routes SOL to review new backend integration and test evidence; TERRA continues independent receipt functional acceptance. CLOUD and ASTRA preserve checkpoints until applicable gates; no duplicate branches. Both Supabase projects healthy, production six/staging eleven migrations; Cloudflare bot reports intermediate preview. Hosted recovery and UAT NOT VERIFIED, clinic-live NO-GO; December 3 target unchanged.

### PM checkpoint — 26 November 2026, 09:28 Asia/Riyadh

- SOL independently passed [PR140 #23](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7183481553) at `be49e7b25ff7ab3a5eee3ef42b6e62cc50c84267` and [PR137 receipt UI](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7183502939) at `24cc6f35f6cd0ca7a0c0578a9e59147f0b01d813`. PM accepts scoped source verdicts; prior clinical session finding closed within source scope. No hosted activation or integrated signoff.
- ASTRA completed [exact manifests](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7183488397) and [integration preparation](https://github.com/cmlagatuz/dawney-clinic/pull/140#issuecomment-7183501881). RC2 remains 7/10 workflows; frontend 311/311 and 4/5 workflows; RC1 15/15.
- CLOUD completed [source design baseline](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7183509212); local rendering blocked by administrator policy and GitHub DNS, no screenshots. TERRA new receipt functional verdict not located. CHART-01 remains open.
- PM permits bounded backend integration preparation implementation in existing PR140 while final frontend remains pending; CLOUD may execute targeted synthetic receipt coverage in PR137 while TERRA reviews frozen SHA, then design after PM functional acceptance. No new release branches or clinical flags.
- Fresh Supabase metadata: production six migrations, staging eleven, both healthy. Actual independent hosted recovery and operator acceptance NOT VERIFIED. Clinic-live NO-GO; Dec3 target unchanged.

### PM checkpoint — 26 November 2026, 08:18 Asia/Riyadh

- [RC2 PR140](https://github.com/cmlagatuz/dawney-clinic/pull/140) `be49e7b25ff7ab3a5eee3ef42b6e62cc50c84267`: six backend paths, additive #23; [dedicated PG17 and signed restore PASS](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45717570833/job/139567459688), 7/10 workflows; three historical guard failures before SQL. Independent SOL review pending; no integrated acceptance.
- [CLOUD PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `24cc6f35f6cd0ca7a0c0578a9e59147f0b01d813`: five-path receipt UI delta; [actual React CI](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45717602276/job/139567569667) 311/311, #112/#113 PASS, 0 failed/skipped, tsc/Vite PASS. 4/5 workflows; historical PG17 guard blocked. Independent SOL/TERRA acceptance pending; CHART-01 open, design pilot not yet delivered. No real reload/provider persistence proof.
- SOL Phase A matrix delivered [PR139](https://github.com/cmlagatuz/dawney-clinic/pull/139); no #23 or new UI verdict located. TERRA latest scoped receipt contract PASS predates new UI. PM freezes both new checkpoints for review; ASTRA prepares exact integration evidence; CLOUD prepares bounded design baseline, source changes after PM review. No duplicate development.
- Both Supabase projects healthy, production 6/staging 11 migrations; GitHub Cloudflare bot reports separate RC2 and frontend previews. No provider-side live acceptance, real recovery, merge or activation. RC1 remains frozen fallback; Dec3 target and clinic-live NO-GO unchanged.

### PM checkpoint — 26 November 2026, 01:49 Asia/Riyadh

- PR137 `2f371836ff5b91c5de7742bb9b1d40c403b7e14d`: [actual React job](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45714814635/job/139558038533) 310/310, #112 PASS, TypeScript/Vite PASS; 4/5 workflows, historical clinical PG17 pin fails. Final delta one browser fixture file +11/-1. PM accepts frontend CI correction within scope; independent corrected UI and receipt integration pending.
- PR139 `2a79d535ec7b473581381a0122a20afbcefc3256`: [SOL scoped source PASS](https://github.com/cmlagatuz/dawney-clinic/pull/139#issuecomment-7176597516) and [TERRA scoped contract PASS](https://github.com/cmlagatuz/dawney-clinic/pull/139#issuecomment-7176615757); PM accepts additive #22 within scope. Existing clinical read/save live-session authorization alignment remains a separate activation blocker. CHART-01 remains open until combined receipt UI and independent acceptance. Seven of ten workflows green; reconcile historical guards without bypass.
- PM decision: one next RC2 integrated candidate, with RC1 frozen; ASTRA owns additive clinical authorization alignment and subsequent exact imports, CLOUD owns receipt UI and bounded human-read design polish, SOL and TERRA independently review. No third-party execution, new automation or production action.
- Fresh provider metadata: production healthy with six migrations; synthetic staging healthy with eleven. Real hosted Auth/DB/Storage recovery, staging persistence and clinic-live acceptance remain NOT VERIFIED. No merge or clinical activation.

### Latest verified checkpoint — 26 November 2026

| Deliverable | Exact evidence and standing |
| --- | --- |
| Manual recovery P2 closure | [PR136](https://github.com/cmlagatuz/dawney-clinic/pull/136) `e8537d5535ac7b5277cd790968ac26d7494c8bad`: 4/4 CI, [SOL scoped security GO](https://github.com/cmlagatuz/dawney-clinic/pull/136#issuecomment-7175666380), [TERRA bounded functional PASS](https://github.com/cmlagatuz/dawney-clinic/pull/136#issuecomment-7175710718), 19/19 targeted excerpt checks with mocked boundaries. BACKUP-01 closed within tested scope. Windows UAT, real provider completeness/restoration and RPO/RTO unverified. |
| Clinical browser fixture correction | [PR137](https://github.com/cmlagatuz/dawney-clinic/pull/137) `b6ffe25c7ace1cc75abdba649f04d930bb3d5b92`: test-only delta, [React CI](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45708390055) 309/310, #112 still fails at line 450; historical PG17 pin also fails. 3/5 workflows PASS. No new production defect established; keep flags OFF. |
| Durable clinical receipt | [PR139](https://github.com/cmlagatuz/dawney-clinic/pull/139) `2a79d535ec7b473581381a0122a20afbcefc3256`: six backend/test/docs paths, one additive migration #22, 21 prior migrations reported unchanged; [dedicated PG17 and signed synthetic restore PASS](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45708623691). 7/10 triggered workflows PASS, three historical source gates stop before SQL. Independent review and end-to-end receipt UI pending; CHART-01 remains open. Discovery without original UUID is not proof of a particular lost save. |
| External tool trust | [SOL assurance](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7175690895): Unslop APPROVE BOUNDED PILOT (source-only); Vibe Shield execution BLOCKED; Ghost QA NEEDS FIX. No npm artifact parity or actual execution verified. |
| Professional UI | [CLOUD manual seven-pillar baseline](https://github.com/cmlagatuz/dawney-clinic/pull/137#issuecomment-7175690791); analyzer NOT RUN, score NOT MEASURED, no design pilot or before/after browser evidence. Adopt human-reviewed Unslop principles only; no automatic setup, unverified package execution or score-driven gate. |

Both hosted Supabase projects rechecked ACTIVE_HEALTHY, production 6 and staging 11 applied migrations; 22 proposed migrations exist only in the new backend child. Accepted RC1 remains frozen with 15/15 CI; clinic-live NO-GO. All prior historical entries retained. This documentation draft requires its own strict provenance reconciliation; previous documentation head had one green PHP workflow and one expected source guard failure.

### Professional engineering quality initiative

- [Unslop](https://github.com/avivgerz-hue/unslop/tree/ca9a3969233e83f768d2d0975fcd805099b7c6cb) 2.1.2: evaluated upstream; advisory design baseline and Dawney-specific design system, Linear Precision as inspiration. CLOUD owns frontend implementation. No automatic preset installation or wholesale theme replacement.
- [Vibe Shield](https://github.com/avivgerz-hue/vibe-shield/tree/81cc23361ab7f147487ea68ba17bd6f23cbbade7) 2.1.3: supplemental defensive static analysis evaluation by SOL; upstream tests 359/359, publish authentication failure. Not a replacement for actual authorization evidence.
- [Ghost QA](https://github.com/avivgerz-hue/ghost-qa/tree/19cc3ab24eeb1fd40c4f9ddab5f009ef5cc7d149) 2.1.2: independent synthetic browser QA evaluation by TERRA; upstream Node22 122/123, version assertion mismatch. No live-clinic crawling or autonomous interactions.
- All three are MIT-licensed upstream source candidates, not installed or accepted dependencies. Pin and review exact artifacts, license and execution boundaries before use. No arbitrary latest, instruction/config overwrites, clinical data, privileged credentials, hosted scans or automatic repair loops. Advisory results never replace existing CI or manual acceptance.

### Current team and release policy

PM governs priorities, evidence and release gates; ASTRA owns backend/integration/recovery; CLOUD owns frontend; SOL owns independent security; TERRA owns independent functional QA. Claude replaced by CLOUD, Qwen paused, Manus suspended, Grok and KIMI retired (historical contributions preserved). Supabase + Cloudflare Pages + GitHub remain the architecture, with zero additional spending. Last verified hosted migration standing: production 6, synthetic staging 11; accepted source has 21. Hosted recovery, staging acceptance, clinical policies, durable clinical save reconciliation, finalization, vaccination, prescriptions, dispensing, transfers, billing/payment and consent/outbox remain outstanding or partial. No production merge, hosted migration, feature activation or clinical release authorized.

**Milestone documentation rule:** Every new accepted milestone must include exact head, actual CI and review evidence, scope/limitations, provider standing, and release verdict. PM maintains this register; ASTRA reconciles it into the next approved integrated release, preserving historical entries. Historical sections below describe earlier checkpoints and do not override this register.

## Historical RC1 release standing — 25 November 2026 (superseded by milestone register)

Authoritative draft [PR132](https://github.com/cmlagatuz/dawney-clinic/pull/132); approved frontend PR135 `f464c4494615147297f8802dc5299fadd95786c9` imported at `8209a545960baa48396e507fbff21ae39f54be01` (8/8 exact, 28 cumulative pins). CI reconciliation checkpoint `ed75eb76789632c1044f7f6795cea73c26011cce` retains all 21 migration blobs and historical guards. On that exact checkpoint, integrated provenance, unified PG17, #21 appointment SQL/ban race/nonce CAS/rollback and signed restore steps, operational signed PG17 restore, clinical draft PG17, signed five-component recovery and encrypted isolated database restore passed. See exact [Actions evidence](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45609400350) and PR132 for final head and complete CI status. This documentation update requires its own exact-head CI; do not inherit green. Final independent SOL/TERRA and hosted owner acceptance are still required. No clinical GO, hosted SQL, flags, merge or deploy authorized. Clinical chart adapter remains disconnected; no claim of end-to-end clinical persistence. Finalization, vaccination, prescriptions, dispensing, transfer/adjustment, billing/payment, consent/outbox and durable reload reconciliation remain unsupported or partial. See [Issue120](https://github.com/cmlagatuz/dawney-clinic/issues/120).

## Historical release notes (superseded by current standing above)

## RC1 source integration — 25 November 2026

Exact PR134 `73067fcdbce7846522e55c33cd0e0ca2051335f4` eight-path correction accepted by PM [7152144119](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7152144119), SOL and TERRA; imported without other frontend edits. All 21 migrations remain frozen. Integrated CI and final independent acceptance pending; no clinic-live GO. Memory-only unresolved-operation warning is not durable reload reconciliation. No new SQL contract authorized. Hosted operations and relevant write flags remain OFF.


> **AUTHORITATIVE RC1 RELEASE STATUS — 24 November 2026:** The RC1 preparation DRAFT descends from frozen SOL-source-PASS [PR #130](https://github.com/cmlagatuz/dawney-clinic/pull/130) at `b6ee64b38ca4ce2965f2b02f09a4e5584aa56608`, containing **21 proposed source migrations**. [PR #129](https://github.com/cmlagatuz/dawney-clinic/pull/129) RC0 is frozen; [CLOUD PR #131](https://github.com/cmlagatuz/dawney-clinic/pull/131) staff appointment UI is separately tested (302/302 synthetic frontend) but **SOURCE IMPORTED — CI PENDING**, with SOL/PM accepted PR133 hardening; integrated CI pending. Both appointment writes and Operations flags remain OFF. PM reports **staging 11 / production 6 applied migrations**; these counts do not mean the rest are deployed. Cloudflare preview ≠ hosted RLS/Storage/recovery UAT ≠ clinic-live. No clinic-live GO, hosted SQL, production merge, or flag activation authorized. See [RC1 integration handoff](docs/RC1_INTEGRATION_HANDOFF.md) and [non-executed staging/rollback packet](docs/RC1_STAGING_ACCEPTANCE_ROLLBACK.md).

> **Architecture/operations snapshot:** Legacy Laravel 5.8/PHP/MySQL preserved in the same repository; the independent `web/` React/TypeScript/Vite frontend targets Cloudflare Pages Free with Supabase Free Auth/Postgres/private Storage. Source modules cover public site, owner and patient portal, requested booking, branch staff Operations/day-week schedule, approval and transactional inventory, clinical *drafts*, and billing UI with unimplemented financial server writes disabled. ASTRA owns backend+CI+recovery; CLOUD frontend; SOL independent security; TERRA independent functional QA; Supervisor/PM coordinates; Qwen assists QA, Manus suspended. This draft contains approved frontend source; integrated acceptance is pending.

> **Historical notes below are dated records, not an authoritative current deployment statement.** Older sections predate source-only PR129–131 and may describe functionality as not yet implemented which is now present only in unmerged source.

**Veterinary clinic management system — modernization in progress**

> **New P0 scope (14 Nov 2026):** No public customer-facing home/services/contact/location page exists on current `master`. `/` redirects into the signed-in owner portal, and customers currently must register/authenticate, complete owner/pet records and request (not confirm) a provisional device-local 30-minute appointment. Dawney Animal Clinic is in **General Trias, Cavite, Philippines**; exact phone, unit and opening hours require owner verification. [Public clinic website + safe booking contract](docs/PHASE4_PUBLIC_SITE_BOOKING_SPEC.md) · [Issue #42](https://github.com/cmlagatuz/dawney-clinic/issues/42). Claude PRs #34 and #41 are open/NOT deployed; Astra PR #40 is open/NOT live. No Phase4 migrations applied.\n

> **Supervisor status (14 November 2026):** Astra's Phase 4 **backend code** for 50 animal types, breed relationships and private attachment metadata has merged via PRs #29–#33, but the two additive Phase 4 migrations are **not applied** to the connected Supabase. Claude's actual Dawney logo, new React theme/navigation and owner overview are in **open PR #34**, with passing CI but **not merged/deployed**. Species/Breed are still free-text in PR #34, and photo/health/vaccination uploads are not yet in the page. **Live patient Dog/Chow Chow is absent from the new seed — P0 [issue #35](https://github.com/cmlagatuz/dawney-clinic/issues/35) must be fixed before migration.** See [current supervisor brief](docs/PHASE4_CURRENT_SUPERVISOR_BRIEF.md) for merge and QA gates.

> **Phase 4 product/QA direction:** The current deployed React UI is a **working pet-owner prototype, not a complete staff-facing veterinary clinic system**. P0 work required: exact owner-supplied Dawney brand logo, searchable species with species-matched locked breed choices (including cattle/livestock), private patient photo/health-card/vaccination-card uploads, and explicit testable UX/privacy acceptance. P1/P2: role-aware staff workspace, encounter workflow, treatment/vaccination/prescription, inventory and billing. See [Phase 4 QA spec](docs/PHASE4_PRODUCT_QA_SPEC.md) and [current concise supervisor brief](docs/PHASE4_CURRENT_SUPERVISOR_BRIEF.md). These features are **requirements, not completed implementations**.

> **Project status (13 November 2026): Phases 1–2 security foundations and Phase 3 React frontend, pet/appointment workflows, staff safeguards, private Storage RLS, and recovery tools are merged. Six Supabase migrations are applied. Real two-account Auth/JWT owner-row RLS and owner-profile persistence **passed**; the separate read-only HTTPS security smoke **passed** (#43443472697). Offline Phase 4 scheduling, staff, recovery-set, Chromium and dependency-security safeguards are merged and CI-tested. Cloudflare Pages public deployment is verified at https://dawney-clinic.pages.dev with 10 HTTPS routes and real anonymous Chromium guards passing; **authenticated hosted-browser persistence**, clinical/Storage synthetic-write security tests, clinical data migration, and full real Auth/Storage restore remain pending.** Not approved for real clinic records.

**Phase 4 Astra backend milestone (PR #29):** Normalized animal taxonomy (50 types, 237 curated breed/fallback options), composite species/breed DB validation, immutable private patient attachment metadata, TypeScript adapters and isolated security regression tests are **merged and CI-tested**. The new two SQL migrations are **not applied to live Supabase yet**; the existing free-text UI must first be coordinated with Claude's dependent-selector integration. [Backend integration/rollout](docs/PHASE4_TAXONOMY_ATTACHMENTS.md) · [Clinical/staff permission architecture](docs/PHASE4_CLINICAL_ARCHITECTURE.md). Do not claim live attachments, species enforcement or clinical go-live until migration and owner-approved live tests pass.

## Overview

Dawney Veterinary Clinic aims to provide a practical, secure, accessible, and responsive workflow for clinic administrators, staff, veterinarians, pet owners and patients. The project is modernizing an existing 2019-era Laravel application, preserving legacy data and useful behavior while planning a free-tier deployable architecture.

**Repository:** [cmlagatuz/dawney-clinic](https://github.com/cmlagatuz/dawney-clinic)  
**Default branch:** `master`  
**Collaboration:** ChatGPT GPT-6 Astra (architecture, security, backend, integration) + Claude Sonnet Free (UI/UX, accessibility, frontend), coordinated through GitHub.  
**Budget:** No paid backend, hosting subscription, mandatory payment API or compulsory purchase. Free service limits apply; no uptime or backup SLA is implied.

## Current implementation — distinguish existing code from planned features

The checked-in **legacy application** uses Laravel 5.8, PHP 7.1-era requirements, Blade, Bootstrap 4, Vue 2, Laravel Mix, and a MySQL database configuration. Because several dependencies are end-of-life, **do not publish the legacy PHP application as a production clinic system without appropriate security modernization**.

| Area | Current evidence | Status |
| --- | --- | --- |
| Login, registration and email verification | Laravel authentication routes and controllers | Legacy source present; production behavior not verified |
| Pet owner and user management | Existing users/owners models and admin workflows | Legacy source present |
| Patients/pets and clinical records | Models, views, controllers and migrations | Legacy source present |
| Appointments | Legacy create/list/detail flow; targeted owner-scoping and input validation fixes | Security fixes merged; conflict handling still needed |
| Admin dashboard | Legacy dashboards and patient/appointment views | Legacy source present; UI PR in progress |
| Inventory / purchasing / orders | Models, controllers and views present; main routes commented out | Disabled; not safe to enable unchanged |
| Modern Supabase-backed frontend | Standalone `web/` React/TypeScript/Vite with Supabase Auth, profile, pets and booking workflows; TypeScript/Vite CI green | Source implemented; real browser/API persistence checks and deployment pending |
| Supabase schema | Six applied migrations: 7 public RLS tables, staff audit, appointment lifecycle/overlap and private Storage object policies | SQL tests passed; owner Auth/JWT baseline passed; clinical and Storage API negative tests pending |
| Cloud hosting and live URL | Cloudflare Pages Free at [dawney-clinic.pages.dev](https://dawney-clinic.pages.dev), React/Vite static app | Real live public HTTPS/Chromium anonymous checks PASSED ([run #43467749073](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43467749073)); hosted authenticated clinical/recovery validation pending; no release tag |
| Production backups, restore drill and cutover | GPG-encrypted app-only exports, tamper detection and actual disposable PostgreSQL 17+GPG isolated restore CI | **Synthetic restore verified**; live clinic Auth/Storage backup and full restore pending |

**Audit scope:** Source review and targeted regression tests, not a full browser-based security test or a validated production environment. Do not enter real clinic records into an unverified deployment.

## Progress and evidence

- **Phase 4 readiness (PRs #19–#25):** [#19 Pages rollback fingerprint](https://github.com/cmlagatuz/dawney-clinic/pull/19), [#20 offline five-part encrypted recovery checks](https://github.com/cmlagatuz/dawney-clinic/pull/20), [#21 scheduling contract](https://github.com/cmlagatuz/dawney-clinic/pull/21), [#22 staff intent guards](https://github.com/cmlagatuz/dawney-clinic/pull/22), [#23 real local Chromium anonymous acceptance](https://github.com/cmlagatuz/dawney-clinic/pull/23), [#24 repository guard/least-privilege CI](https://github.com/cmlagatuz/dawney-clinic/pull/24), [#25 pinned npm advisory check](https://github.com/cmlagatuz/dawney-clinic/pull/25). All relevant scoped PR CI passed; npm audit reported 0 vulnerabilities in the locked web graph. **These are offline/preview-readiness safeguards, not live clinical proof.** See [full recovery](docs/PHASE3_FULL_RECOVERY_PLAN.md), [staff](docs/PHASE4_STAFF_SECURITY.md), [scheduling](docs/PHASE4_SCHEDULING_POLICY.md), [browser](docs/PHASE4_BROWSER_TESTS.md), and [repository](docs/PHASE4_REPO_SECURITY.md) runbooks.
- **Read-only Auth security smoke PASSED:** [workflow #43443472697](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43443472697), real A/B HTTPS sessions, owner isolation, SDK session rehydration and anonymous privacy. No clinical/Storage synthetic write occurred.

- **Phase 1 completed (2026-11-13):** [Legacy audit and modernization gates](docs/PHASE1_LEGACY_AUDIT.md), security hardening for patient appointment ownership and forged foreign-pet bookings, bounded booking inputs, regression tests and GitHub Actions legacy PHP checks.
- **[PR #2](https://github.com/cmlagatuz/dawney-clinic/pull/2):** Phase 1 merged to `master`; CI passed **5 tests / 11 assertions**, with PHP 7.4 and a compatibility install. See [the passing Actions run](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43378768881). This is targeted coverage, not a guarantee of full-system correctness.
- **[PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1):** Claude's accessible UI foundation (dark/light mode, components, layouts, responsive styling) is **open, not merged**. Blade view compile/render tests and frontend/legacy PHP CI passed on its branch; production browser/MySQL integration and lead review remain outstanding. After the Phase 2 merge, GitHub reports the PR as conflicted with updated `master`; it must be reconciled before merging. Do not describe it as merged or deployed.
- **Phase 2 foundation (2026-11-13):** [Supabase schema, security tests and recovery contract](docs/PHASE2_DATA_SECURITY.md), [Phase 2 PR #3](https://github.com/cmlagatuz/dawney-clinic/pull/3). Two migrations applied, RLS and appointment overlap constraint verified with rollback-only test fixtures. Real Auth login/RLS HTTP checks and backup/restore rehearsal are still required.
- **[PR #4](https://github.com/cmlagatuz/dawney-clinic/pull/4):** adds a third verified-user/security migration and a dependency-free Supabase Auth/owner profile integration contract, unit tests, and an opt-in live two-account HTTP test workflow. See [Phase 2 Auth verification and owner steps](docs/PHASE2_AUTH_INTEGRATION.md). Real sign-up/verification and HTTP RLS testing require owner-controlled temporary mailboxes and GitHub Actions secrets; **not yet verified live**.
- **Historical Auth checkpoint before the passing tests (2026-11-13):** [Registration-only run](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43425109459) successfully registered disposable Account A. Latest read-only Supabase verification reports **two registered, email-confirmed accounts, both with sign-in activity**, but **the newer passing tests documented below supersede that earlier observation**. Do **not** repeat registration; run `test` on `master` using the existing private GitHub Actions secrets. At last check, app owners/pets/appointments/staff still had zero records. See [Phase 2 Auth guide](docs/PHASE2_AUTH_INTEGRATION.md).
- **Latest verified live Auth/JWT baseline:** [operation=test run 43438147911](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43438147911) and [repeat run 43438358753](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43438358753) both PASS (1/1 live test). Two confirmed disposable identities created and persisted exactly two synthetic owner profiles; HTTP cross-owner SELECT deny, staff self-escalation deny and logout/re-login persistence passed. A fresh read-only project query confirms **2 owners, 0 pets, 0 bookings, 0 staff, 1 active appointment resource and 0 private objects**. Further read-only/clinical/Storage tests remain pending and owner-gated. [Follow the acceptance runbook](docs/PHASE3_LIVE_BROWSER_ACCEPTANCE.md).
- **Supabase:** 7 public application tables have RLS enabled; no real user/patient data imported or stored in the application schema. No live data migration has occurred.
- **Phase 3 integration readiness ([PR #12](https://github.com/cmlagatuz/dawney-clinic/pull/12), [#13](https://github.com/cmlagatuz/dawney-clinic/pull/13), [#14](https://github.com/cmlagatuz/dawney-clinic/pull/14)):** Manual real JWT clinical/Storage smoke tests (explicit synthetic-write opt-in), Cloudflare Pages Git preview and checksum-protected GitHub Release readiness, and a **passing genuine synthetic PostgreSQL 17/GPG restore and tamper-denial CI**. The synthetic restore **does not** recover real Supabase Auth/Storage. Docs: [HTTP and Storage smoke](docs/PHASE3_HTTP_STORAGE_SMOKE.md), [deployment/release](docs/PHASE3_DEPLOY_RELEASE.md), [synthetic restore](docs/PHASE3_SYNTHETIC_RESTORE_DRILL.md).
- **Private Storage bucket verified:** `clinical-attachments` exists, `public=false`, 5 MB maximum, MIME allowlist PDF/PNG/JPEG, zero objects at last check. Existing two RLS policies and SQL verification passed. Live A/B Storage upload/download denies **not yet run**.
- **Phase 3 merged:** [PR #5](https://github.com/cmlagatuz/dawney-clinic/pull/5) modern React/Vite app; [#6](https://github.com/cmlagatuz/dawney-clinic/pull/6) persisted pet/appointment workflows; [#7](https://github.com/cmlagatuz/dawney-clinic/pull/7) encrypted export tools; [#8](https://github.com/cmlagatuz/dawney-clinic/pull/8) private Storage policies; [#9](https://github.com/cmlagatuz/dawney-clinic/pull/9) staff safety/audit. See [web](docs/PHASE3_WEB_FOUNDATION.md), [clinical workflows](docs/PHASE3_CLINICAL_CORE.md), [private Storage](docs/PHASE3_PRIVATE_STORAGE.md), [staff safeguards](docs/PHASE3_STAFF_AUDIT.md) and [recovery](docs/PHASE3_FREE_RECOVERY.md). All PR GitHub checks passed; connected DB SQL tests were transaction scoped.
- **Latest integration audit:** [PR #15](https://github.com/cmlagatuz/dawney-clinic/pull/15) reconciled live-test/release blockers, and [PR #16](https://github.com/cmlagatuz/dawney-clinic/pull/16) added CI syntax validation for manual clinical smoke tests. [Supervisor's current execution plan](docs/PHASE3_SUPERVISOR_PLAN.md) reflects the two confirmed test accounts and ready private bucket. Neither PR proves a successful live two-account HTTP test or deployed Pages website.
- **Latest verified read-only security smoke:** [GitHub Actions run 43443472697](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43443472697) passed two real HTTPS Auth sessions, owner RLS isolation, SDK session rehydration, and anonymous access denial with **no application records written**. This does not replace browser reload, clinical/Storage negative write checks or full recovery verification. [Next supervised tasks](docs/PHASE3_SUPERVISOR_PLAN.md).
- **Limitations:** The later live A/B Auth contract tests passed and produced two disposable owner profiles, but still no pets, appointments or staff. The private Storage bucket exists with zero stored files; cross-account file API testing is still pending. The isolated restore test used **synthetic PostgreSQL data only**, and no full Supabase Auth/Storage recovery snapshot exists.
- **Deployment:** Owner screenshot confirms Cloudflare Pages deployed; real public HTTPS/Chromium checks on [dawney-clinic.pages.dev](https://dawney-clinic.pages.dev) PASSED. Exact Cloudflare deployed Git SHA, Supabase Auth redirect setup, logged-in browser persistence, Storage denies and full recovery are still unverified.

For live agent ownership and new changes, read **[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)**. This README is a project overview rather than a replacement for the frequently updated handoff.

## Modernization stages

| Phase | Goal | Gate / evidence |
| --- | --- | --- |
| **1 — Legacy assessment** | Feature inventory, security findings, minimal high-risk fixes, tests | **Merged**; focused CI green |
| **2 — Data contract and access** | Legacy mapping, Supabase schema, roles and RLS | Six applied migrations, SQL tests pass; owner Auth/JWT baseline passed; clinical JWT and full recovery rehearsal pending |
| **3 — Modern frontend foundation** | React/TypeScript/Vite and accessible authenticated owner UI | Merged and CI built; live UI/HTTP verification and deployment pending |
| **4 — Core clinical parity** | Owners, pets, appointments, medical history | Owner/pet/appointment UI built with RLS; medical records UI and real-data migration pending |
| **5 — Operations** | Vaccines, prescription flows, inventory stock ledger, invoices/receipts, reporting and audit logs | Pending |
| **6 — Pilot and deployment** | Free GitHub-linked hosting, migration rehearsal, restore drill, live security/persistence smoke tests | Pending |

No phase is considered complete solely because screens, migrations or code were drafted; integration and verification gates are required.

## Free-only deployment architecture (frontend and schema built; hosting not connected)

```text
GitHub master + verified CI
          |
          v
Cloudflare Pages Free (static frontend: React + TypeScript + Vite)
          |
          v
Supabase Free (Postgres + Auth + private Storage + RLS)
```

Cloudflare Pages **cannot run Laravel/PHP** in this static architecture. The team must build a separate frontend, migrate the required functionality and data safely, and verify access control before cutover. Free quotas, potential Supabase project pausing, email limits and lack of free managed database backups must be addressed; see the [Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md). No paid provider is authorized.

## Development and collaboration

Before making changes, agents and contributors must read:

1. **[AGENTS.md](AGENTS.md)** — shared engineering, privacy, branches, release and verification rules.
2. **[CLAUDE.md](CLAUDE.md)** — Claude-specific scoped-work guidance.
3. **[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)** — current branch/PR ownership, blockers and upcoming task.
4. **[docs/PHASE1_LEGACY_AUDIT.md](docs/PHASE1_LEGACY_AUDIT.md)** — feature parity and migration/security requirements.

Use separate `ai/chatgpt/*` and `ai/claude/*` branches; propose tested changes through PRs, check conflict status and checks before merge, and update the shared handoff. Do not store credentials, raw client/animal records or private backups in GitHub.

### Supabase skills

When running a compatible terminal-based development agent inside the repository, install official skills with:

```bash
npx skills add supabase/agent-skills
```

This command installs agent skills in a compatible local environment; **it does not automatically add tools to ChatGPT.com or Claude.ai browser conversations**. GitHub and Supabase connectors remain separate. Read current documentation and verify every database migration and RLS policy; do not expose any service-role/secret key in frontend code.

### Legacy local testing (maintenance only)

The legacy project is an old Laravel/PHP application with dependencies that may require an isolated, compatible environment. Do not blindly upgrade runtime or Composer or deploy it publicly. A constrained PHP 7.4 compatibility setup was used for the Phase 1 GitHub Actions regression job. See [the workflow](.github/workflows/legacy-static-audit.yml) for the actual test setup and [the Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md) for unresolved issues. The modern app's pinned dependencies, lockfile, build and deployment instructions are in [web/README.md](web/README.md) and [Phase 3 web guidance](docs/PHASE3_WEB_FOUNDATION.md).

## Outstanding security and operations risks

Legacy code includes overlapping-booking race conditions, charged SMS behavior, unsafe password onboarding, disabled purchase flows, incomplete DB constraints and legacy dependency vulnerabilities. The baseline Supabase schema now enforces row-level security (RLS), trusted staff roles, client ownership and two-account SQL deny tests. Private Storage RLS exists and the private `clinical-attachments` bucket is created with a 5 MiB PDF/PNG/JPEG allowlist; real cross-account Storage API testing, real Auth HTTP verification, full Auth/Storage backup and migration rehearsal are still required. Paid SMS must not be required. Before any real-world clinic launch: reconcile old IDs and records, export and restore backups, confirm data retention and secure staff permissions, run integration tests, and verify the live URL.

## Project links

- [Source and active branches](https://github.com/cmlagatuz/dawney-clinic)
- [Pull requests](https://github.com/cmlagatuz/dawney-clinic/pulls)
- [GitHub Actions](https://github.com/cmlagatuz/dawney-clinic/actions)
- [Shared AI handoff](docs/AI_HANDOFF.md)
- [Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md)

**Documentation policy:** Update verified feature statuses and hosting URL on each major merge/release. Do not turn anticipated capabilities into completed claims.


### CLOUD accepted appointment source

| Supabase schema | Six applied migrations: 7 public RLS tables, staff audit, appointment lifecycle/overlap and private Storage object policies | SQL tests passed; owner Auth/JWT baseline passed; clinical and Storage API negative tests pending |
