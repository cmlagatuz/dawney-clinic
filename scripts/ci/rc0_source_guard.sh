#!/usr/bin/env bash
# Integrated RC0 exact-blob lineage gate. No wildcard imports or historical rewrites.
# Accepts only frozen PR128 + exact CLOUD PR127 + SOL-pass PR119 and named CI.
set -Eeuo pipefail
fail(){ echo "RC0_SOURCE_BLOCKED: $*" >&2; exit 1; }
BACKEND=5bb687ee33a670618b1eb60762b1a5625a810bf4
CLOUD=930a7c7a13cf1d5516f04ea024e68dfabd5df064
PRIVACY=2e06b9b16866e16e551d3bb9e9e0f3f38e102e33
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic ]] || fail 'not official pull_request checkout'
git fetch --no-tags origin \
 'refs/pull/128/head:refs/remotes/origin/rc0-frozen-backend' \
 'refs/pull/127/head:refs/remotes/origin/rc0-frozen-cloud' \
 'refs/pull/119/head:refs/remotes/origin/rc0-frozen-privacy'
[[ "$(git rev-parse refs/remotes/origin/rc0-frozen-backend)" == "$BACKEND" &&
   "$(git rev-parse refs/remotes/origin/rc0-frozen-cloud)" == "$CLOUD" &&
   "$(git rev-parse refs/remotes/origin/rc0-frozen-privacy)" == "$PRIVACY" ]] ||
 fail 'a frozen reviewed source head drifted'
git merge-base --is-ancestor "$BACKEND" HEAD || fail 'no exact SOL-PASS backend ancestry'
[[ "$(git rev-parse HEAD)" != "$BACKEND" ]] || fail 'not integrated'
# Filename allowlist is complete and path-by-path, NOT web/** or docs/**.
diff -u <(cat <<'RC0_EXACT_ALLOWED_PATHS'
.github/workflows/operational-p2-recovery-pg17.yml
.github/workflows/operational-staff-inventory-pg17.yml
docs/CLOUD_OPERATIONAL_RPC_FRONTEND_2026.md
docs/CLOUD_STAFF_INVENTORY_OPERATOR_2026.md
docs/FULL_CLINIC_FRONTEND_RELEASE_TRAIN_2026.md
docs/OWNER_PATIENT_RELEASE_HARDENING_2026.md
docs/RC0_INTEGRATION_HANDOFF.md
docs/RELEASE_CLINIC_UAT_2026.md
scripts/ci/full_tree_pg17.sh
scripts/ci/pr88_frontend_pins.sh
scripts/ci/rc0_source_guard.sh
scripts/hosted-acceptance/acceptance.mjs
scripts/hosted-acceptance/guards.mjs
scripts/hosted-acceptance/tests/acceptance.test.mjs
web/src/App.tsx
web/src/billing/ASTRA_CONTRACT.md
web/src/billing/OwnerBillingPage.tsx
web/src/billing/UAT_CHECKLIST.md
web/src/billing/Workspace.tsx
web/src/billing/billing.css
web/src/billing/model.d.mts
web/src/billing/model.mjs
web/src/billing/port.ts
web/src/clinical/ASTRA_CONTRACT.md
web/src/clinical/ChartIntegration.tsx
web/src/clinical/INTEGRATION_UAT.md
web/src/clinical/PatientChart.tsx
web/src/clinical/chart-model.d.mts
web/src/clinical/chart-model.mjs
web/src/clinical/chart-port.ts
web/src/clinical/draft.d.mts
web/src/clinical/draft.mjs
web/src/clinical/port.ts
web/src/clinical/workspace.css
web/src/components/AttachmentField.tsx
web/src/components/Layout.tsx
web/src/inventory/ASTRA_CONTRACT.md
web/src/inventory/model.d.mts
web/src/inventory/model.mjs
web/src/inventory/operator-validation.d.mts
web/src/inventory/operator-validation.mjs
web/src/inventory/pharmacy.css
web/src/inventory/port.ts
web/src/operational/contract.ts
web/src/operational/model.d.mts
web/src/operational/model.mjs
web/src/operational/port.ts
web/src/ops/port.ts
web/src/pages/AppointmentsPage.tsx
web/src/pages/ClinicReleasePage.tsx
web/src/pages/OverviewPage.tsx
web/src/pages/PetsPage.tsx
web/src/pages/PetsPageCatalog.tsx
web/src/pages/ProfilePage.tsx
web/src/pages/public/NotFoundPage.tsx
web/src/pages/staff/BillingPage.tsx
web/src/pages/staff/ClinicalWorkspacePage.tsx
web/src/pages/staff/InventoryOperatorForms.tsx
web/src/pages/staff/InventoryOperatorPage.tsx
web/src/pages/staff/OpsPage.tsx
web/src/pages/staff/PharmacyPage.tsx
web/src/pages/staff/StaffAccessPages.tsx
web/src/pages/staff/operator-workspaces.css
web/src/patient-form-logic.d.mts
web/src/patient-form-logic.mjs
web/src/public-site/usePatientEligibility.ts
web/src/public-site/useServiceSpecies.ts
web/src/release/clinic-contracts.d.mts
web/src/release/clinic-contracts.mjs
web/src/release/clinic-release.css
web/src/release/verified-staff-branches.ts
web/tests/billing-model.test.mjs
web/tests/billing-workspace.browser.test.mjs
web/tests/clinic-release-contracts.test.mjs
web/tests/clinic-release-flags.browser.test.mjs
web/tests/clinic-release-train.browser.test.mjs
web/tests/clinical-chart-integration.browser.test.mjs
web/tests/clinical-chart-model.test.mjs
web/tests/clinical-draft.test.mjs
web/tests/clinical-workspace.browser.test.mjs
web/tests/fixtures/billing-fixture.html
web/tests/fixtures/billing-fixture.tsx
web/tests/fixtures/clinical-chart-fixture.html
web/tests/fixtures/clinical-chart-fixture.tsx
web/tests/fixtures/operational-http.mjs
web/tests/fixtures/owner-patient-http.mjs
web/tests/fixtures/release-clinic-http.mjs
web/tests/frontend-release-integration.browser.test.mjs
web/tests/inventory-model.test.mjs
web/tests/inventory-pharmacy.browser.test.mjs
web/tests/operational-contract.test.mjs
web/tests/ops-branch.test.mjs
web/tests/ops-port.test.mjs
web/tests/owner-patient-hardening.browser.test.mjs
web/tests/owner-patient-hardening.test.mjs
web/tests/rc0-operational-contract.test.mjs
web/tests/release-clinic.browser.test.mjs
web/tests/staff-inventory-operational.browser.test.mjs
web/tests/staff-inventory-operator.browser.test.mjs
web/tests/staff-inventory-operator.test.mjs
web/tests/staff-ops-connected.browser.test.mjs
RC0_EXACT_ALLOWED_PATHS
) <(git diff --name-only "$BACKEND" HEAD) ||
 fail 'unreviewed added/removed/modified path'
# For every inherited PR128 blob, do not permit drift unless the path is
# explicitly listed. Accepted older CI and source remain untouched otherwise.
while IFS= read -r path;do
 if ! git diff --name-only "$BACKEND" HEAD -- "$path" | grep -Fxq "$path";then
   [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$BACKEND:$path")" ]] ||
    fail "inherited backend source drift: $path"
 fi
done < <(git ls-tree -r --name-only "$BACKEND")
# Cloud import: all 91 blobs are from ONE frozen exact PR127 tree.
# ONLY the type adapter is deliberately changed to directly import the
# existing canonical backend signatures; exact override SHA pinned below.
while read -r path sha;do
 [[ "$(git rev-parse "$CLOUD:$path")" == "$sha" ]] ||
  fail "PR127 reviewed original differs: $path"
 case "$path" in
  web/src/operational/contract.ts)
   [[ "$sha" == 526e100258b544d354a0e033cce8e274966babfb &&
     "$(git rev-parse "HEAD:$path")" == 5dbf35c9234a40210c2a2a7587ac975f1793aeba &&
     "$(git hash-object "$path")" == 5dbf35c9234a40210c2a2a7587ac975f1793aeba ]] ||
     fail 'canonical backend type alias adapter source changed';;
  *)
   [[ "$(git rev-parse "HEAD:$path")" == "$sha" && "$(git hash-object "$path")" == "$sha" ]] ||
    fail "non-exact reviewed PR127 frontend blob: $path";;
 esac
done <<'RC0_CLOUD_SOURCE_91'
docs/CLOUD_OPERATIONAL_RPC_FRONTEND_2026.md 7ac79b9305e675dfc21ee35b5561579d5f133703
docs/CLOUD_STAFF_INVENTORY_OPERATOR_2026.md 1205806fd2eaf05459472951b69d0c38e56c42b4
docs/FULL_CLINIC_FRONTEND_RELEASE_TRAIN_2026.md e26be1801a9c356c81c6c0f41733504198c33d93
docs/OWNER_PATIENT_RELEASE_HARDENING_2026.md cdd65e3f499fe8d3a76f2e336d3a4fc932e92d89
docs/RELEASE_CLINIC_UAT_2026.md 710535d01219b5ed88aed4856dabaf692716b372
web/src/App.tsx a3e5d3abfc4ba54dea9b1e429e5ef44bf60d9024
web/src/billing/ASTRA_CONTRACT.md 794d0ddfa665256440062eee27f23ce30809ce12
web/src/billing/OwnerBillingPage.tsx 2843ad470e18a75cd2c46b27845ce8317f494df4
web/src/billing/UAT_CHECKLIST.md d2368b389d899feee03153a3784d5e48e4d1c105
web/src/billing/Workspace.tsx 73d669e96c61daa3395ea948c4cd141d046968c4
web/src/billing/billing.css 7d8d56f2cec4a79ba31bd82dc6d9ce8bbba48ec0
web/src/billing/model.d.mts ea9cc3cffbea58fc35f310a7408c562e97cffc87
web/src/billing/model.mjs 1ba98dbe1734d3e887fd9e1f89ce93df4ae54581
web/src/billing/port.ts cb07615b7ad351e0b8fb3886a9e2ab3fbfc32ba8
web/src/clinical/ASTRA_CONTRACT.md 518070be5392c04ce1ee382fa50066bf1339d921
web/src/clinical/ChartIntegration.tsx 9f1b762d5146bc0bf0a193171fa012012a492975
web/src/clinical/INTEGRATION_UAT.md c668d523e4ef2d5cfabab2b02306bfefb51397bd
web/src/clinical/PatientChart.tsx 16154d9d54316a29a3361cd741a8eec1e67c4503
web/src/clinical/chart-model.d.mts 786e73430bf6131b90954356059614a41dda0c9f
web/src/clinical/chart-model.mjs 7cafa1c4ca959f7bc04be82557eaac78600e242e
web/src/clinical/chart-port.ts 1c57a652c80b55c05f520003ef3f0d2812c62ff2
web/src/clinical/draft.d.mts 30451e3e4ae52bf371aadd06cb8746f401eb8c4b
web/src/clinical/draft.mjs 97d8c975493efc0d6863ed70e14df8c7db8d98cc
web/src/clinical/port.ts d738000ae165cdc5a5a42eaf55148f7d30aeb30c
web/src/clinical/workspace.css 0912b2d2c36567bb5375e9fee93b65c04a391c00
web/src/components/AttachmentField.tsx 56b48adb7dd0ffe3b1cc842aa03f28caa5df7411
web/src/components/Layout.tsx 2af70c2e5b3a9da68719ea05814e8d9a259091ab
web/src/inventory/ASTRA_CONTRACT.md a2777a427d2e85c24c6e35c15af533853e818199
web/src/inventory/model.d.mts 40ea82e93ac3ddc6af9bb9940bcab43e559088c7
web/src/inventory/model.mjs 5a66bb75fd8c0d91623acb20ab28188259d1914d
web/src/inventory/operator-validation.d.mts 341d5aeb050ba8865e4c7767bd49e14ee7b62172
web/src/inventory/operator-validation.mjs 0f111d2c85facd6b1122b8d1bbbbe344c07560ea
web/src/inventory/pharmacy.css 94c5bef2a123f2461f28b2a29386f6b4764fb67b
web/src/inventory/port.ts f1f1e9ba5649a6197dc0a91cfaba3a5525d4015a
web/src/operational/contract.ts 526e100258b544d354a0e033cce8e274966babfb
web/src/operational/model.d.mts 3d4c4694f8190d035dc483b3f537b309668f4c0a
web/src/operational/model.mjs 1100fdb81ea8a8b616b3bb143e6374e8a8be2b14
web/src/operational/port.ts ec1352b3221ca0507eef6509e1c875fc9d299a23
web/src/ops/port.ts f405649dfa8ba617d922de5974fc9b6a03c195cf
web/src/pages/AppointmentsPage.tsx 9c8a1a17ba916449c056f8c4765094239ba01c9f
web/src/pages/ClinicReleasePage.tsx 04e5b67f93b042ad7d0b52a6573830c77c6417eb
web/src/pages/OverviewPage.tsx 1fe1c69ef186f0e8d087b08733c5b90290143240
web/src/pages/PetsPage.tsx 010e9351f7117215e37f334910e73def004c53c4
web/src/pages/PetsPageCatalog.tsx b8d58a1947bf7a726cf3b991318efade25819c98
web/src/pages/ProfilePage.tsx cccbcb62e8018018c4dc7766c948e73b8876357b
web/src/pages/public/NotFoundPage.tsx c9672ab0635b0e3087b78340e7e8f57732fe2ce1
web/src/pages/staff/BillingPage.tsx ac1c08581e5e90d535fa8016e91a8cc87f1f3c5e
web/src/pages/staff/ClinicalWorkspacePage.tsx bcf016ce3ac60f86520f6dfbc166fa47637b82d3
web/src/pages/staff/InventoryOperatorForms.tsx 659ae79958228f8b1af5d9aa739ddb7f169f6dad
web/src/pages/staff/InventoryOperatorPage.tsx 3e975e2d81aaf59b1191ce0e1622f481a57b7ae9
web/src/pages/staff/OpsPage.tsx ef0c7ae4c723795fa858aa42fd3442d385d0c082
web/src/pages/staff/PharmacyPage.tsx cb8589d80f68df8f11a380bec5832645c3dea089
web/src/pages/staff/StaffAccessPages.tsx 60aa9fd8cd1acb644bc57838dc19d688d3370a84
web/src/pages/staff/operator-workspaces.css a9c9fd5638e0cf551d413a70c72e6925c734b7f9
web/src/patient-form-logic.d.mts dabf011cbaa1acba6b9dbcd5c4d7cddf50d7448b
web/src/patient-form-logic.mjs 249111b9388816cd48b0407362902f0ce1379be4
web/src/public-site/usePatientEligibility.ts fc6e3b988e44bf1554c46a5bec81ad48c2dce362
web/src/public-site/useServiceSpecies.ts 782a30958e3e945334ed2be8ebfe4de605ce87fb
web/src/release/clinic-contracts.d.mts 1a2fdb7476a2ab4071531050ea852e4828e6e420
web/src/release/clinic-contracts.mjs 6f69b48af9595ebce76ebccc29feaf70065f184c
web/src/release/clinic-release.css bf5696948afa9d979944ec9f35b0c6c1c799b802
web/src/release/verified-staff-branches.ts 9212f0d3ffad6d8ac82c12bbb7eb455333c93254
web/tests/billing-model.test.mjs 2bebc7d317c9c4248229b4cfbbb08addab216bb8
web/tests/billing-workspace.browser.test.mjs b708e005a915e9a1c5e82c4a443ee99857a68f18
web/tests/clinic-release-contracts.test.mjs 44c81825e8acf23b5bbb71d312f36d6dac96dbeb
web/tests/clinic-release-flags.browser.test.mjs e9aac1501744f6587f304dfdf369977891051bc2
web/tests/clinic-release-train.browser.test.mjs a2e2ac4f9ccdb8f254a878775f9e025e3476a111
web/tests/clinical-chart-integration.browser.test.mjs ec7a12f1637ea690ecae839885c78e2395ca5722
web/tests/clinical-chart-model.test.mjs 197983275c18658a437fbb3af7cd7c212987f3e3
web/tests/clinical-draft.test.mjs 3944008ead4e1697725f41d809861e43c2968e32
web/tests/clinical-workspace.browser.test.mjs 54787fe7bcae924e2e614f5bf2cdc341c3e8663b
web/tests/fixtures/billing-fixture.html a4046db3782154d6a2398ea0f3f478cb4624900e
web/tests/fixtures/billing-fixture.tsx 2289df5daf78c647151e3d068022ad1e37764fdf
web/tests/fixtures/clinical-chart-fixture.html 33beb67d19ca9d3a1f6da85c3bb54e9be80a350a
web/tests/fixtures/clinical-chart-fixture.tsx 04cc869dd911534db572172d1a3254510cc2789a
web/tests/fixtures/operational-http.mjs c0e2db2f1078d40ac03368c46f6b42564ff51d26
web/tests/fixtures/owner-patient-http.mjs c0960db6ce5ab6b43e01c15507c5eb7924fb4300
web/tests/fixtures/release-clinic-http.mjs 2034d70b6db5e718457d68db158316c0cb0cc91a
web/tests/frontend-release-integration.browser.test.mjs f14f4c69b609a1d1d9cae90dae98edc5929ea232
web/tests/inventory-model.test.mjs f618c948cb238fdab0e3370980d1ca2985934029
web/tests/inventory-pharmacy.browser.test.mjs c3bbff78477f00a8b6267250048fae283fcd9167
web/tests/operational-contract.test.mjs 1d90647273031101980f75c9124d46f0efb93b06
web/tests/ops-branch.test.mjs ceb55be76820e4618cd5c06bd851fea5db07033d
web/tests/ops-port.test.mjs bc4771591a8be596711e2fbd9045419d730ba7e5
web/tests/owner-patient-hardening.browser.test.mjs 8f394500c5b081961d4611ff0cfcc8e60088177b
web/tests/owner-patient-hardening.test.mjs 195257427bbb4c3e38f8a2adb91459249a53ceb7
web/tests/release-clinic.browser.test.mjs fe4e3f0084dbeb6a0f55b52e21cd0b25b0357096
web/tests/staff-inventory-operational.browser.test.mjs 20d80a0813e43d9a34b5f0bee719536fa1623073
web/tests/staff-inventory-operator.browser.test.mjs e52cdefb8e2004c5408a74fbcc3873336869b16d
web/tests/staff-inventory-operator.test.mjs 6e5269e655ee6ba5089b5ff9a4c39ee3354ed235
web/tests/staff-ops-connected.browser.test.mjs 8d3da5342ec3a9bdd30c960f7b7433742be15dc2
RC0_CLOUD_SOURCE_91
# PR119's exact accepted privacy runner depends on the separately accepted
# immutable staging-ownership security guard from its own source tree.
while read -r path sha;do
 [[ "$(git rev-parse "$PRIVACY:$path")" == "$sha" &&
   "$(git rev-parse "HEAD:$path")" == "$sha" &&
   "$(git hash-object "$path")" == "$sha" ]] ||
  fail "SOL-accepted revoked-vet/owned-staging source drift: $path"
done <<'RC0_SOL_PRIVACY'
scripts/hosted-acceptance/acceptance.mjs ca6489bee35eaa60639ef775fa9c2478d68b9d65
scripts/hosted-acceptance/guards.mjs 58d5fd6e2444ecd018c21f76b770269ac6ac04a9
scripts/hosted-acceptance/tests/acceptance.test.mjs 5c47cbefe90f5402994e199899b00e5acd49b75e
RC0_SOL_PRIVACY
# All 20 historical/proposed migrations remain exactly as accepted in PR128.
test "$(git ls-tree -r --name-only HEAD supabase/migrations | grep -Ec '^supabase/migrations/[0-9]+.*\.sql$')" = 20 ||
 fail 'unexpected migration count'
diff -u <(git ls-tree -r --name-only "$BACKEND" supabase/migrations) \
 <(git ls-tree -r --name-only HEAD supabase/migrations) ||
 fail 'migration names or ordering changed'
while read -r path;do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$BACKEND:$path")" ]] ||
  fail "migration hash changed: $path"
done < <(git ls-tree -r --name-only "$BACKEND" supabase/migrations)
[[ "$(git rev-parse "HEAD:scripts/ci/pr126_p2_source_guard.sh")" == 3d547abce1b6e2f3560e9dc4fbe9e8597e78933e &&
   "$(git rev-parse "HEAD:scripts/ci/operational_source_guard.sh")" == b43652ee31c9f8b4f11260e1c82907907e17cfea ]] ||
 fail 'accepted prior exact source guard files modified'
# SOURCE-ONLY: new CI scripts and documentation are narrowly named above.
# Independent SOL must review the new runner itself and exact merged head.
echo "PASS: RC0 frozen PR128+PR127+PR119, 20 original SQL blobs, 91 exact CLOUD review imports (one explicitly adapted type bridge), three SOL privacy files and narrow CI-only edits"
