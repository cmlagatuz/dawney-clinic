#!/usr/bin/env bash
# CI-only, real local PG17: reviewed PR69+PR70+PR71 staff+PR68 security source.
set -Eeuo pipefail
fail(){ echo "FULL_TREE_GATE_BLOCKED: $*" >&2; exit 1; }
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_EVENT_NAME" == pull_request &&
   "$GITHUB_REPOSITORY" == cmlagatuz/dawney-clinic &&
   "$PGHOST" == 127.0.0.1 && "$PGPORT" == 5432 &&
   "$PGDATABASE" == full_tree_ci &&
   "$EXPECTED_BASE_SHA" == 63a2b68ee93463f426cafc6bdf468376343001cf &&
   "$EXPECTED_FRONTEND_SHA" == 2a42489a4b85c46979f9c971474fc74579f673de &&
   "$EXPECTED_SECURITY_SHA" == 9bc84ef3cde86d6c052c4d40012ffbee9c2391f0 &&
   "$EXPECTED_STAFF_SHA" == 1dfd25f2ffcf5470ed7e0b4a33fcf5013a53a373 &&
   "$EXPECTED_BACKEND_SHA" == 004544eb80ff0b5301745c74c7659a1d8de4fb39 &&
   "$EXPECTED_PUBLIC_SHA" == f32b5fb16f7d16836fdada2d21212ab04cd4bfc6 &&
   "$EXPECTED_BRANCH_UI_SHA" == 1de646b16c4327b67148e1b3ff405942ebb80dda &&
   "$EXPECTED_HEAD_SHA" =~ ^[0-9a-f]{40}$ &&
   "$EXPECTED_PR_NUMBER" =~ ^[0-9]+$ ]] || fail 'not pinned release-candidate/CI/disposable PG17 environment'
for bin in git psql; do command -v "$bin" >/dev/null || fail "missing $bin";done
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD_SHA" ]] || fail "checkout does not match exact PR head"
git fetch --no-tags origin \
 "refs/pull/$EXPECTED_PR_NUMBER/head:refs/remotes/origin/full-tree-self"
[[ "$(git rev-parse refs/remotes/origin/full-tree-self)" == "$EXPECTED_HEAD_SHA" ]] ||
 fail 'integration gate head changed during run'
git fetch --no-tags origin \
 'refs/pull/69/head:refs/remotes/origin/release-base' \
 'refs/pull/70/head:refs/remotes/origin/reviewed-frontend' \
 'refs/pull/68/head:refs/remotes/origin/reviewed-security' \
 'refs/pull/71/head:refs/remotes/origin/reviewed-staff'
[[ "$(git rev-parse refs/remotes/origin/release-base)" == "$EXPECTED_BASE_SHA" ]] ||
 fail 'PR69 source moved; do not test stale tree'
[[ "$(git rev-parse refs/remotes/origin/reviewed-frontend)" == "$EXPECTED_FRONTEND_SHA" ]] ||
 fail 'PR70 source moved; do not test stale tree'
[[ "$(git rev-parse refs/remotes/origin/reviewed-security)" == "$EXPECTED_SECURITY_SHA" ]] ||
 fail 'PR68 source moved; do not test stale tree'
[[ "$(git rev-parse refs/remotes/origin/reviewed-staff)" == "$EXPECTED_STAFF_SHA" ]] ||
 fail 'PR71 source moved; do not test stale tree'
git merge-base --is-ancestor "$EXPECTED_BASE_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing PR69 ancestry'
git merge-base --is-ancestor "$EXPECTED_FRONTEND_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing reviewed PR70 ancestry'
git merge-base --is-ancestor "$EXPECTED_SECURITY_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing Grok-accepted PR68 ancestry'
git merge-base --is-ancestor "$EXPECTED_STAFF_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing PR71 staff UI ancestry'
# PR82 remains a frozen Kimi-reviewed combined source. This incremental
# backend-only security repair MUST be descended from that exact commit.
git fetch --no-tags origin 'refs/pull/82/head:refs/remotes/origin/frozen-pr82'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr82)" == b0633b2e8d073e9328462d29f4bfca280c70eaa7 ]] ||
 fail 'PR82 frozen source moved; do not test against an unreviewed tree'
git merge-base --is-ancestor b0633b2e8d073e9328462d29f4bfca280c70eaa7 "$EXPECTED_HEAD_SHA" ||
 fail 'issue51 repair is not descendant of frozen PR82'
# PR83 is independently reviewed by SOL: the direct parent stays fixed.
git fetch --no-tags origin 'refs/pull/83/head:refs/remotes/origin/frozen-pr83'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr83)" == 0edeeb152d306fe5c652d289ec5f4e69f00c2f11 ]] ||
 fail 'PR83 source-review head moved during Issue58 integration'
git merge-base --is-ancestor 0edeeb152d306fe5c652d289ec5f4e69f00c2f11 "$EXPECTED_HEAD_SHA" ||
 fail 'Issue58 branch-read candidate must descend from reviewed PR83'
# Frozen PR85 remains the single approved backend source parent for ISSUE78.
# Separate child branch; no edits allowed to SOL's independent PR85 review head.
git fetch --no-tags origin 'refs/pull/85/head:refs/remotes/origin/frozen-pr85'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr85)" == 0c3be38304a6fd9528e8e59d1aebac296d57486f ]] ||
 fail 'PR85 independent-review head changed; inventory candidate fails closed'
git merge-base --is-ancestor 0c3be38304a6fd9528e8e59d1aebac296d57486f "$EXPECTED_HEAD_SHA" ||
 fail 'inventory read-only candidate missing frozen PR85 ancestry'
# PR86 remains frozen for SOL's independent inventory review.
git fetch --no-tags origin 'refs/pull/86/head:refs/remotes/origin/frozen-pr86'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr86)" == 72932678dde35fc6caa0667ff3f900f49255a135 ]] ||
 fail 'PR86 parent source moved; branch public reader must not follow drift'
git merge-base --is-ancestor 72932678dde35fc6caa0667ff3f900f49255a135 "$EXPECTED_HEAD_SHA" ||
 fail 'public reader candidate not descended from PR86 frozen source'
# Exact frontend CI-only child: frozen PR87 then frozen CLOUD PR88.
git fetch --no-tags origin \
 'refs/pull/87/head:refs/remotes/origin/frozen-pr87' \
 'refs/pull/88/head:refs/remotes/origin/frozen-cloud-pr88'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr87)" == 26d5ed9bdc81275b24b80810a7da25f658c9e6e2 &&
   "$(git rev-parse refs/remotes/origin/frozen-cloud-pr88)" == 2171567f275b88b54d5c3997f97ecf4986b050f2 &&
   "$(git rev-parse 2171567f275b88b54d5c3997f97ecf4986b050f2^)" == 26d5ed9bdc81275b24b80810a7da25f658c9e6e2 ]] ||
 fail 'CLOUD PR88 source or parent drifted'
git merge-base --is-ancestor 2171567f275b88b54d5c3997f97ecf4986b050f2 "$EXPECTED_HEAD_SHA" ||
 fail 'CI candidate does not contain exact reviewed PR88'
diff -u <(cat <<'CLOUD_PR88_13_PATHS'
A	web/src/components/BranchBookingAvailability.tsx
M	web/src/components/ServiceBookingForm.tsx
M	web/src/hooks/AuthProvider.tsx
M	web/src/pages/AppointmentsPage.tsx
M	web/src/pages/public/BookPage.tsx
M	web/src/pages/public/ServicesPage.tsx
D	web/src/public-site/useBookingMode.ts
A	web/src/public-site/useBookingRequest.ts
A	web/src/public-site/useBranchBooking.ts
D	web/src/public-site/usePublicCatalog.ts
A	web/tests/branch-booking.browser.mjs
M	web/tests/naga-site.test.mjs
M	web/tests/owner-booking-view.test.mjs
CLOUD_PR88_13_PATHS
) <(git diff --name-status 26d5ed9bdc81275b24b80810a7da25f658c9e6e2 2171567f275b88b54d5c3997f97ecf4986b050f2) ||
 fail 'the 13-file CLOUD frontend diff changed'
# Original PR88→PR90 CI source remains precisely three reviewed paths.
diff -u <(cat <<'CI_ONLY_SOURCE'
.github/workflows/full-tree-pg17-security.yml
scripts/ci/full_tree_pg17.sh
scripts/ci/pr88_frontend_pins.sh
CI_ONLY_SOURCE
) <(git diff --name-only 2171567f275b88b54d5c3997f97ecf4986b050f2 961ee716316720821e1ce159815977743b823cee) ||
 fail 'frozen PR90 original CI-only delta changed'
# Freeze CLOUD PR91, ASTRA PR93, and reviewed CLOUD PR94 before this CI-only child.
git fetch --no-tags origin \
 'refs/pull/90/head:refs/remotes/origin/frozen-pr90' \
 'refs/pull/91/head:refs/remotes/origin/frozen-pr91' \
 'refs/pull/93/head:refs/remotes/origin/frozen-pr93' \
 'refs/pull/94/head:refs/remotes/origin/frozen-pr94'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr90)" == 961ee716316720821e1ce159815977743b823cee &&
   "$(git rev-parse refs/remotes/origin/frozen-pr91)" == c3ab821bc4cf359a7ea2929356dd035c540d6eb6 &&
   "$(git rev-parse refs/remotes/origin/frozen-pr93)" == 2e75251163fca977fcbfe0e5b8d40a17177e7962 &&
   "$(git rev-parse refs/remotes/origin/frozen-pr94)" == 10650396dc968a4685f8f6ba1c6d5f932df117a9 ]] ||
 fail 'frozen PR90/PR91/PR93/PR94 source moved'
git merge-base --is-ancestor 961ee716316720821e1ce159815977743b823cee c3ab821bc4cf359a7ea2929356dd035c540d6eb6 ||
 fail 'PR91 not descended from frozen PR90'
[[ "$(git rev-parse "2e75251163fca977fcbfe0e5b8d40a17177e7962^")" == c3ab821bc4cf359a7ea2929356dd035c540d6eb6 &&
   "$(git rev-parse "10650396dc968a4685f8f6ba1c6d5f932df117a9^")" == 2e75251163fca977fcbfe0e5b8d40a17177e7962 ]] ||
 fail 'frozen PR91 -> PR93 -> PR94 direct ancestry changed'
git merge-base --is-ancestor 10650396dc968a4685f8f6ba1c6d5f932df117a9 "$EXPECTED_HEAD_SHA" ||
 fail 'CI child must descend from exact reviewed CLOUD PR94'
diff -u <(cat <<'CLOUD_PR91_FOUR'
M	web/src/public-site/slots.mjs
M	web/tests/branch-booking.browser.mjs
A	web/tests/slot-routes.chromium.test.mjs
A	web/tests/slots.test.mjs
CLOUD_PR91_FOUR
) <(git diff --name-status 961ee716316720821e1ce159815977743b823cee c3ab821bc4cf359a7ea2929356dd035c540d6eb6) ||
 fail 'CLOUD PR91 was not exactly four reviewed frontend changes'
diff -u <(cat <<'ASTRA_PR93_CI_ONLY'
.github/workflows/full-tree-pg17-security.yml
scripts/ci/full_tree_pg17.sh
scripts/ci/pr88_frontend_pins.sh
ASTRA_PR93_CI_ONLY
) <(git diff --name-only c3ab821bc4cf359a7ea2929356dd035c540d6eb6 2e75251163fca977fcbfe0e5b8d40a17177e7962) ||
 fail 'frozen PR93 was not exactly the reviewed three-file CI child'
diff -u <(printf '%s\n' $'M\tweb/tests/branch-booking.browser.mjs') \
 <(git diff --name-status 2e75251163fca977fcbfe0e5b8d40a17177e7962 10650396dc968a4685f8f6ba1c6d5f932df117a9) ||
 fail 'reviewed PR94 was not exactly one modified browser test'
[[ "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:web/tests/branch-booking.browser.mjs")" == db91b57c285f80fa24c4487de9c652f4fd04957f &&
   "$(git rev-parse "10650396dc968a4685f8f6ba1c6d5f932df117a9:web/tests/branch-booking.browser.mjs")" == 3b1fffccd16d002cb02b08e44c932442bd34d66e ]] ||
 fail 'PR91 or independently reviewed PR94 browser-test blob changed'
# Preserve ASTRA PR95 exactly; this integration may only add reviewed PR92 inventory paths.
git fetch --no-tags origin 'refs/pull/95/head:refs/remotes/origin/frozen-pr95'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr95)" == ba1d0a19c9b7b51f58d92a7d417e44cf257cb97f &&
   "$(git rev-parse "ba1d0a19c9b7b51f58d92a7d417e44cf257cb97f^")" == 10650396dc968a4685f8f6ba1c6d5f932df117a9 ]] ||
 fail 'PR95 Playwright full-tree source lineage changed'
diff -u <(cat <<'PR95_CI_ONLY'
scripts/ci/full_tree_pg17.sh
scripts/ci/pr88_frontend_pins.sh
PR95_CI_ONLY
) <(git diff --name-only 10650396dc968a4685f8f6ba1c6d5f932df117a9 ba1d0a19c9b7b51f58d92a7d417e44cf257cb97f) ||
 fail 'PR95 original CI correction changed'
git merge-base --is-ancestor ba1d0a19c9b7b51f58d92a7d417e44cf257cb97f "$EXPECTED_HEAD_SHA" ||
 fail 'inventory integration is missing frozen green PR95'
# Approved PR92 is a separate branch, NOT assumed to be an ancestor of this child.
git fetch --no-tags origin 'refs/pull/92/head:refs/remotes/origin/frozen-pr92'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr92)" == e3207dfef7f6473ab3b0dae9a807519845a57da4 &&
   "$(git rev-parse "e3207dfef7f6473ab3b0dae9a807519845a57da4^")" == 72932678dde35fc6caa0667ff3f900f49255a135 ]] ||
 fail 'SOL-approved PR92 source or parent moved'
diff -u <(cat <<'PR92_FOUR_REVIEWED'
.github/workflows/issue78-inventory-pg17.yml
scripts/ci/full_tree_pg17.sh
supabase/migrations/20261118225000_issue78_inventory_read_only_foundation.sql
supabase/tests/issue78_inventory_timezone_pg17.sql
PR92_FOUR_REVIEWED
) <(git diff --name-only 72932678dde35fc6caa0667ff3f900f49255a135 e3207dfef7f6473ab3b0dae9a807519845a57da4) ||
 fail 'PR92 had source outside SOL-reviewed four paths'
# Do not rebase or synthesize the SOL-accepted PR96 exact source.
git fetch --no-tags origin 'refs/pull/96/head:refs/remotes/origin/frozen-pr96'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr96)" == 162c554f2866547f83ff37c698cada203842aaa9 &&
   "$(git rev-parse "162c554f2866547f83ff37c698cada203842aaa9^")" == ba1d0a19c9b7b51f58d92a7d417e44cf257cb97f ]] ||
 fail 'reviewed PR96 combined source or direct parent changed'
diff -u <(cat <<'INVENTORY_INTEGRATION_ONLY'
.github/workflows/issue78-inventory-pg17.yml
scripts/ci/full_tree_pg17.sh
supabase/migrations/20261118225000_issue78_inventory_read_only_foundation.sql
supabase/tests/issue78_inventory_timezone_pg17.sql
INVENTORY_INTEGRATION_ONLY
) <(git diff --name-only ba1d0a19c9b7b51f58d92a7d417e44cf257cb97f 162c554f2866547f83ff37c698cada203842aaa9) ||
 fail 'frozen PR96 inventory child changed its exact four paths'
git merge-base --is-ancestor 162c554f2866547f83ff37c698cada203842aaa9 "$EXPECTED_HEAD_SHA" ||
 fail 'recovery child is missing reviewed PR96 ancestor'
# Preserve PR97's immutable nine-path signed recovery manifest. Its original
# scope MUST be compared to frozen PR97, never the later frontend/CI HEAD.
git merge-base --is-ancestor 5d915af715d5ad771e45fba5278042938c196ed5 "$EXPECTED_HEAD_SHA" ||
 fail 'CI candidate missing frozen PR97 ancestor'
[[ "$(git rev-parse "5d915af715d5ad771e45fba5278042938c196ed5:.github/workflows/phase3-recovery.yml")" == 8897020270294b8da628b4db2c9cef07b5827309 &&
   "$(git rev-parse "5d915af715d5ad771e45fba5278042938c196ed5:scripts/ci/full_tree_pg17.sh")" == d8fdb630b58eedc7579ba1808d75eeb4388007cf ]] ||
 fail 'original PR97 recovery/CI source fingerprint drift'
# PR49 positive five-piece signed restore is an external immutable source,
# copied only into recovery scripts; do not pretend it is in PR96 ancestry.
git fetch --no-tags origin 'refs/pull/49/head:refs/remotes/origin/frozen-recovery-pr49'
[[ "$(git rev-parse refs/remotes/origin/frozen-recovery-pr49)" == 034be375d577bf421b9590d68c3599c0067a8b58 ]] ||
 fail 'reviewed PR49 recovery harness head moved'
diff -u <(cat <<'RECOVERY_CHILD_ONLY'
.github/workflows/phase3-recovery.yml
scripts/ci/full_tree_pg17.sh
scripts/recovery/tests/phase3-phase4-positive-assertions.sql
scripts/recovery/tests/phase3-preserved-snapshot.sql
scripts/recovery/tests/phase3-provider-bootstrap.sql
scripts/recovery/tests/phase3-synthetic-records.sql
scripts/recovery/tests/phase3-to-15-assertions.sql
scripts/recovery/tests/phase3-to-15-history-snapshot.sql
scripts/recovery/tests/synthetic-phase3-phase4-positive.sh
RECOVERY_CHILD_ONLY
) <(git diff --name-only 162c554f2866547f83ff37c698cada203842aaa9 5d915af715d5ad771e45fba5278042938c196ed5) ||
 fail 'frozen PR97 recovery child exceeds original nine authorized paths'
# CLOUD owns the exact two frontend paths between the frozen PR97 and PR99.
git fetch --no-tags origin 'refs/pull/99/head:refs/remotes/origin/frozen-cloud-pr99'
[[ "$(git rev-parse refs/remotes/origin/frozen-cloud-pr99)" == c1f2751740792b069ca2a3da38efa7ce538f7489 ]] ||
 fail 'frozen CLOUD PR99 source moved'
git merge-base --is-ancestor c1f2751740792b069ca2a3da38efa7ce538f7489 "$EXPECTED_HEAD_SHA" ||
 fail 'CI child does not descend from frozen CLOUD PR99'
diff -u <(cat <<'CLOUD_PR99_ONLY'
web/src/components/SiteLayout.tsx
web/tests/public-owner-journeys.test.mjs
CLOUD_PR99_ONLY
) <(git diff --name-only 5d915af715d5ad771e45fba5278042938c196ed5 c1f2751740792b069ca2a3da38efa7ce538f7489) ||
 fail 'CLOUD PR99 expanded beyond two exact frontend paths'
diff -u <(cat <<'ASTRA_CI_ONLY'
.github/workflows/phase3-recovery.yml
scripts/ci/full_tree_pg17.sh
ASTRA_CI_ONLY
) <(git diff --name-only c1f2751740792b069ca2a3da38efa7ce538f7489 e71f54a232198b8e2c0e3ba72aab76aab25dcd98) ||
 fail 'frozen PR101 expanded outside its original two CI paths'
git fetch --no-tags origin 'refs/pull/101/head:refs/remotes/origin/frozen-pr101'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr101)" == e71f54a232198b8e2c0e3ba72aab76aab25dcd98 ]] ||
 fail 'frozen parent PR101 moved'
git merge-base --is-ancestor e71f54a232198b8e2c0e3ba72aab76aab25dcd98 "$EXPECTED_HEAD_SHA" ||
 fail 'clinical candidate missing exact PR101 ancestor'
diff -u <(cat <<'CLINICAL16_ONLY'
.github/workflows/clinical-chart-pg17.yml
docs/CLINICAL_CHART_ENCOUNTER_DRAFT.md
scripts/ci/full_tree_pg17.sh
supabase/migrations/20261120160000_clinical_chart_encounter_drafts.sql
supabase/tests/clinical_chart_encounter_pg17.sql
web/src/lib/clinical-chart.ts
CLINICAL16_ONLY
) <(git diff --name-only e71f54a232198b8e2c0e3ba72aab76aab25dcd98 eb030489626babb9bb0a61a387c2d49df2f71730) ||
 fail 'frozen PR106 exact original six-path clinical delivery was modified'
git fetch --no-tags origin 'refs/pull/106/head:refs/remotes/origin/frozen-pr106'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr106)" == eb030489626babb9bb0a61a387c2d49df2f71730 &&
  "$(git rev-parse "eb030489626babb9bb0a61a387c2d49df2f71730:scripts/ci/full_tree_pg17.sh")" == 81ef5e907829ccd36f96a8bd78289c6d3443f1fe ]] ||
 fail 'frozen SOL-reviewed PR106 changed'
git merge-base --is-ancestor eb030489626babb9bb0a61a387c2d49df2f71730 "$EXPECTED_HEAD_SHA" ||
 fail 'proposed security remediation missing frozen PR106 ancestry'
diff -u <(cat <<'CLINICAL17_ONLY'
.github/workflows/clinical-chart-pg17.yml
docs/CLINICAL_CHART_ENCOUNTER_DRAFT.md
scripts/ci/full_tree_pg17.sh
scripts/recovery/tests/clinical17-signed-restore.sh
supabase/migrations/20261120221000_clinical_provenance_pagination_security.sql
supabase/tests/clinical_provenance_pagination_pg17.sql
web/src/lib/clinical-chart.ts
CLINICAL17_ONLY
) <(git diff --name-only eb030489626babb9bb0a61a387c2d49df2f71730 08713ddc9a3ef984426807f475cf7829631c5326) ||
 fail 'frozen PR109 original seven-path clinical remediation moved'
git fetch --no-tags origin 'refs/pull/109/head:refs/remotes/origin/frozen-pr109'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr109)" == 08713ddc9a3ef984426807f475cf7829631c5326 &&
  "$(git rev-parse "08713ddc9a3ef984426807f475cf7829631c5326:scripts/ci/full_tree_pg17.sh")" == 29fad32738e2c60d8748b6e01cd908952f827208 ]] ||
 fail 'SOL-reviewed frozen PR109 exact head/CI guard moved'
git merge-base --is-ancestor 08713ddc9a3ef984426807f475cf7829631c5326 "$EXPECTED_HEAD_SHA" ||
 fail 'clinical recovery ACL child is not descended from frozen PR109'
diff -u <(cat <<'CLINICAL_ACL_RECOVERY_ONLY'
.github/workflows/clinical-chart-pg17.yml
scripts/ci/full_tree_pg17.sh
scripts/recovery/tests/clinical17-restored-authz.sql
scripts/recovery/tests/clinical17-security-fingerprint.sql
scripts/recovery/tests/clinical17-signed-restore.sh
CLINICAL_ACL_RECOVERY_ONLY
) <(git diff --name-only 08713ddc9a3ef984426807f475cf7829631c5326 "$EXPECTED_HEAD_SHA") ||
 fail 'ACL recovery correction changed outside exactly five authorized paths'
while read -r path sha;do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
 fail "clinical recovery ACL reviewed child blob drift: $path"
done <<'CLINICAL_ACL_RECOVERY_BLOBS'
.github/workflows/clinical-chart-pg17.yml 71a391467609d4b825a91cec4b4018dacfca67e8
scripts/recovery/tests/clinical17-restored-authz.sql 734c71a16dab0235a0965df037a5d66c845d1ace
scripts/recovery/tests/clinical17-security-fingerprint.sql ff91ed721aa1e49a28f9a350cedab5cef23c7211
scripts/recovery/tests/clinical17-signed-restore.sh 4ea872facdb768b5084236679cff06216e4b58ae
CLINICAL_ACL_RECOVERY_BLOBS
while read -r path sha;do
 [[ "$(git rev-parse "08713ddc9a3ef984426807f475cf7829631c5326:$path")" == "$sha" ]] ||
 fail "frozen PR109 clinical source drift: $path"
done <<'CLINICAL17_BLOBS'
.github/workflows/clinical-chart-pg17.yml 290a0dd049de4d0006afa6d5739c1f030386e086
docs/CLINICAL_CHART_ENCOUNTER_DRAFT.md 48069e896afc9f52ddea5eaaf5777eb835d802e7
scripts/recovery/tests/clinical17-signed-restore.sh c879ee38563f9e47dfd7860eb30592583a70c8c0
supabase/migrations/20261120221000_clinical_provenance_pagination_security.sql c1018e711cc01055e4ef3269caf261c05036fd58
supabase/tests/clinical_provenance_pagination_pg17.sql ee20ce8d21fdac11dfd2cf30e7e8f1209649fb84
web/src/lib/clinical-chart.ts baa7b28eba264a271c636f947fa9f467c87b4c37
CLINICAL17_BLOBS
while read -r file sha; do
 [[ "$(git rev-parse "eb030489626babb9bb0a61a387c2d49df2f71730:$file")" == "$sha" ]] ||
 fail "frozen PR106 #16 historical source changed: $file"
done <<'CLINICAL16_BLOBS'
.github/workflows/clinical-chart-pg17.yml 8a45eddfdd52110ab403f0a2bc32161d4a4d5b05
docs/CLINICAL_CHART_ENCOUNTER_DRAFT.md 346b0a668391fd2efc59b1bc2525bb5a07b7c280
supabase/migrations/20261120160000_clinical_chart_encounter_drafts.sql a017d6f11819fcd7dba743cf37e4533342d8a5a5
supabase/tests/clinical_chart_encounter_pg17.sql d223db9503a5145372b0603445d05e645dd079fa
web/src/lib/clinical-chart.ts 62221ba4c8a854456da99f044ca1ddb36acbed03
CLINICAL16_BLOBS
while read -r path sha; do
 [[ "$(git rev-parse "c1f2751740792b069ca2a3da38efa7ce538f7489:$path")" == "$sha" &&
    "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
 fail "CLOUD PR99 reviewed source drift: $path"
done <<'CLOUD_PR99_EXACT_BLOBS'
web/src/components/SiteLayout.tsx f4bd3adb932e87a4b4ac0751b0c678fa02d7bfaa
web/tests/public-owner-journeys.test.mjs 9097c181801b72325e23b4581d4606bc19532604
CLOUD_PR99_EXACT_BLOBS
# PR49 supporting test fixtures are exact, not a new Auth/Storage model.
while read -r path sha; do
 [[ "$(git rev-parse "034be375d577bf421b9590d68c3599c0067a8b58:$path")" == "$sha" &&
    "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
 fail "PR49 signed recovery supporting source changed: $path"
done <<'PR49_SIGNED_SUPPORT'
scripts/recovery/tests/phase3-phase4-positive-assertions.sql d8a4b0335a16c1b789f710a433e641125eec1f09
scripts/recovery/tests/phase3-preserved-snapshot.sql 84578873ac8cac4b3735b273fc3c1918d1c951cc
scripts/recovery/tests/phase3-provider-bootstrap.sql 3c40fded35f8022c813796e79e991930bf3f4bef
scripts/recovery/tests/phase3-synthetic-records.sql 36b8afee6df92e0e1000ad7d05b5ffbbf325e909
PR49_SIGNED_SUPPORT
[[ "$(git rev-parse "034be375d577bf421b9590d68c3599c0067a8b58:scripts/recovery/tests/synthetic-phase3-phase4-positive.sh")" == 24ff53d115d7d153474f5018adb289aee525798f ]] ||
 fail 'original positive signed five-component PR49 harness changed'
while read -r path sha; do
 if [[ "$path" == .github/workflows/phase3-recovery.yml ]]; then
  [[ "$(git rev-parse "5d915af715d5ad771e45fba5278042938c196ed5:$path")" == 8897020270294b8da628b4db2c9cef07b5827309 &&
     "$(git rev-parse "HEAD:$path")" == "$sha" &&
     "$(git hash-object "$path")" == "$sha" ]] ||
    fail 'recovery trigger changed beyond its exact reviewed CI-only blob'
 else
  [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
     "$(git hash-object "$path")" == "$sha" ]] ||
    fail "recovery extension exact source drift: $path"
 fi
done <<'RECOVERY_EXTENSION_PINS'
.github/workflows/phase3-recovery.yml a78b3e6c4f53496efb729dcd6b43450c50b0eaa5
scripts/recovery/tests/synthetic-phase3-phase4-positive.sh 76cd48e241bda58562e4934697009a5d9cbd41fa
scripts/recovery/tests/phase3-to-15-history-snapshot.sql b13a10eb386e2743904c379a4d89aef33afe24c8
scripts/recovery/tests/phase3-to-15-assertions.sql 6e17a935cf8f68caae757f5759c725e25f6f4447
RECOVERY_EXTENSION_PINS
while read -r path sha; do
 [[ "$(git rev-parse "e3207dfef7f6473ab3b0dae9a807519845a57da4:$path")" == "$sha" &&
    "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
 fail "independently reviewed PR92 migration/test/workflow drift: $path"
done <<'PR92_PINNED_CONTENT'
.github/workflows/issue78-inventory-pg17.yml 4fc7d56d512fb2eacd2bea7136104b2d82d6b14f
supabase/migrations/20261118225000_issue78_inventory_read_only_foundation.sql 908f881bfc541ab4265912e0a9e55525ea8275a5
supabase/tests/issue78_inventory_timezone_pg17.sql 06bc46e34209dfd9d61e3fe576cf4b7d29d13992
PR92_PINNED_CONTENT
[[ "$(git rev-parse "961ee716316720821e1ce159815977743b823cee:scripts/ci/pr88_frontend_pins.sh")" == d4d4531a56abf28605530e8f7573e710b4b9fa44 &&
   "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:scripts/ci/pr88_frontend_pins.sh")" == d4d4531a56abf28605530e8f7573e710b4b9fa44 &&
   "$(git rev-parse "10650396dc968a4685f8f6ba1c6d5f932df117a9:scripts/ci/pr88_frontend_pins.sh")" == 2a9f2ba92baab119c2d781b63063b676eb02fa56 &&
   "$(git rev-parse HEAD:scripts/ci/pr88_frontend_pins.sh)" == 75af9ae159488b4cf7f6111fb93b760968359dee &&
   "$(git hash-object scripts/ci/pr88_frontend_pins.sh)" == 75af9ae159488b4cf7f6111fb93b760968359dee ]] ||
 fail 'historical or PR94-approved source-pin script changed'
bash scripts/ci/pr88_frontend_pins.sh
# The combined commit is based on the exact P1-repaired backend and imports
# EXACT, independently reviewable PR79 Naga + PR81 branch-selector commits.
# Reject any source-head drift rather than re-pinning an unreviewed commit.
git fetch --no-tags origin \
 'refs/pull/80/head:refs/remotes/origin/p1-backend' \
 'refs/pull/79/head:refs/remotes/origin/naga-public' \
 'refs/pull/81/head:refs/remotes/origin/branch-selector'
[[ "$(git rev-parse refs/remotes/origin/p1-backend)" == "$EXPECTED_BACKEND_SHA" &&
   "$(git rev-parse refs/remotes/origin/naga-public)" == "$EXPECTED_PUBLIC_SHA" &&
   "$(git rev-parse refs/remotes/origin/branch-selector)" == "$EXPECTED_BRANCH_UI_SHA" ]] ||
 fail 'PR79/PR80/PR81 reviewed source moved during combined integration'
for parent in "$EXPECTED_BACKEND_SHA" "$EXPECTED_PUBLIC_SHA" "$EXPECTED_BRANCH_UI_SHA"; do
 git merge-base --is-ancestor "$parent" "$EXPECTED_HEAD_SHA" ||
  fail "tested combined commit lacks exact reviewed source ancestor: $parent"
done
# The seven PR70 files must be byte-for-byte identical to Claude's reviewed head.
while IFS= read -r path; do
 case "$path" in
  web/src/pages/AppointmentsPage.tsx|web/tests/owner-booking-view.test.mjs)
   [[ "$(git rev-parse "26d5ed9bdc81275b24b80810a7da25f658c9e6e2:$path")" == "$(git rev-parse "$EXPECTED_FRONTEND_SHA:$path")" ]] ||
    fail "original PR70 frontend source drift: $path"
   # The exact changed CLOUD blob is checked by pr88_frontend_pins.sh.
   ;;
  *)
   [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$EXPECTED_FRONTEND_SHA:$path")" ]] ||
    fail "untouched PR70 frontend source drift: $path"
   ;;
 esac
done <<'CLAUDE'
docs/AI_HANDOFF.md
web/src/pages/AppointmentsPage.tsx
web/src/public-site/booking-mode.d.mts
web/src/public-site/booking-mode.mjs
web/src/public-site/usePatientEligibility.ts
web/src/public-site/useServiceSpecies.ts
web/tests/owner-booking-view.test.mjs
CLAUDE
# Every imported Grok-accepted PR68 source blob must remain unchanged.
while IFS= read -r path; do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$EXPECTED_SECURITY_SHA:$path")" ]] ||
 fail "Grok-accepted hosted harness drift: $path"
done <<'GROK'
.github/workflows/hosted-security-acceptance-source.yml
docs/HOSTED_SECURITY_ACCEPTANCE.md
scripts/hosted-acceptance/acceptance.mjs
scripts/hosted-acceptance/guards.mjs
scripts/hosted-acceptance/tests/acceptance.test.mjs
GROK
# Preserve every immutable PR71 staff source blob (including originals of the
# three intentionally modified PR81 paths). All unchanged staff files stay
# byte-identical at HEAD; changed files require exact PR81 SHA pins below.
while read -r path sha; do
 [[ "$(git rev-parse "$EXPECTED_STAFF_SHA:$path")" == "$sha" ]] ||
  fail "original reviewed PR71 staff UI source drift: $path"
 case "$path" in
  web/src/ops/port-adapter.d.mts|web/src/ops/port-adapter.mjs|web/src/pages/staff/OpsPage.tsx)
    # PR81 exact reviewed replacements pinned below; no unreviewed exception.
    ;;
  *)
    [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
       "$(git hash-object "$path")" == "$sha" ]] ||
      fail "untouched PR71 staff UI source drift: $path"
    ;;
 esac
done <<'STAFF_BLOBS'
docs/phase5a-ui/INTEGRATION.md 849736b92d23cfeae9f1c41d9354c98559063df6
web/src/ops/port-adapter.d.mts be658d899e66551062b88fbf7062ff8444092efd
web/src/ops/port-adapter.mjs cc219d05c37408ea2833ee71bdd1b1dc6c486b59
web/src/ops/port.ts 49c86914c496b37c73ccf2193bcbaf65757088fb
web/src/ops/useOpsData.ts 65ba82cee4aca9fbb26d9539d04942fd1ace93b7
web/src/pages/staff/OpsPage.tsx 441f4e201fc0dd45568d8de9a75eb2e6be7b3ccf
web/tests/ops-model.test.mjs b142ba5b8aca13cf95231d39d01396f12ced2b81
web/tests/ops-port.test.mjs af738c1fef40a537c1ae6dc77e467c4adabd5339
STAFF_BLOBS
while IFS= read -r path; do
 case "$path" in
 docs/AI_HANDOFF.md|docs/UNIFIED_RELEASE_CANDIDATE.md|\
 .github/workflows/full-tree-pg17-security.yml|scripts/ci/full_tree_pg17.sh|\
 .github/workflows/hosted-security-acceptance-source.yml|docs/HOSTED_SECURITY_ACCEPTANCE.md|\
 scripts/hosted-acceptance/guards.mjs|scripts/hosted-acceptance/acceptance.mjs|\
 scripts/hosted-acceptance/tests/acceptance.test.mjs|\
 web/src/pages/AppointmentsPage.tsx|web/src/public-site/booking-mode.d.mts|\
 web/src/public-site/booking-mode.mjs|web/src/public-site/usePatientEligibility.ts|\
 web/src/public-site/useServiceSpecies.ts|web/tests/owner-booking-view.test.mjs|\
 docs/phase5a-ui/INTEGRATION.md|web/src/ops/port-adapter.d.mts|\
 web/src/ops/port-adapter.mjs|web/src/ops/port.ts|web/src/ops/useOpsData.ts|\
 web/src/pages/staff/OpsPage.tsx|web/tests/ops-model.test.mjs|\
 web/tests/ops-port.test.mjs|\
  web/index.html|\
  web/src/components/SiteLayout.tsx|\
  web/src/pages/public/AboutPage.tsx|\
  web/src/pages/public/BookPage.tsx|\
  web/src/pages/public/HomePage.tsx|\
  web/src/pages/public/ServicesPage.tsx|\
  web/src/public-site/clinic-info.d.mts|\
  web/src/public-site/clinic-info.mjs|\
  web/tests/naga-site.test.mjs|\
  web/tests/public-site.test.mjs|\
  web/src/ops/branch-model.d.mts|\
  web/src/ops/branch-model.mjs|\
  web/src/ops/read-port.ts|\
  web/src/ops/useBranchScope.ts|\
  web/tests/ops-branch.test.mjs|\
  docs/STAGING_ACCEPTANCE_TRANSPORT_PREPARATION.md|\
  .github/workflows/staging-acceptance-plan-offline.yml|\
  scripts/hosted-acceptance/staging-request-plan.mjs|\
  scripts/hosted-acceptance/tests/staging-request-plan.test.mjs|\
  supabase/migrations/20261117233500_issue77_four_branch_foundation.sql|\
  supabase/tests/issue77_four_branch_pg17_denials.sql|\
  docs/ISSUE77_FOUR_BRANCH_FOUNDATION.md|\
  .github/workflows/issue77-four-branch-pg17.yml|\
  .github/workflows/issue51-branch-booking-pg17.yml|\
  supabase/tests/issue51_branch_booking_pre_repair_pg17.sql|\
  supabase/tests/issue51_branch_booking_after_repair_pg17.sql|\
  supabase/migrations/20261118203500_issue51_branch_booking_security.sql|\
  docs/ISSUE51_BRANCH_BOOKING_REPAIR.md|\
  supabase/migrations/20261118215500_issue58_staff_branch_read_contract.sql|\
  supabase/tests/issue58_staff_branch_queue_fixture.sql|\
  supabase/tests/issue58_staff_branch_read_pg17.sql|\
  .github/workflows/issue58-staff-branch-read-pg17.yml|\
  web/src/staff-branch-read-contract.mjs|\
  web/src/staff-branch-read-contract.d.mts|\
  web/src/lib/staff-branch.ts|\
  web/tests/staff-branch-read-contract.test.mjs|\
  docs/ISSUE58_STAFF_BRANCH_READ.md|\
  supabase/migrations/20261118225000_issue78_inventory_read_only_foundation.sql|\
  supabase/tests/issue78_inventory_synthetic_fixture.sql|\
  supabase/tests/issue78_inventory_pg17_denials.sql|\
  supabase/tests/issue78_inventory_timezone_pg17.sql|\
  scripts/ci/issue78_concurrent_denials.sh|\
  .github/workflows/issue78-inventory-pg17.yml|\
  docs/ISSUE78_MEDICINE_INVENTORY_READ_ONLY.md|\
  web/src/lib/branch-public-booking.ts|\
  web/src/lib/branch-public-booking-reader.mjs|\
  web/src/lib/branch-public-booking-reader.d.mts|\
  web/tests/branch-public-booking-reader.test.mjs|\
  web/src/components/BranchBookingAvailability.tsx|\
  web/src/components/ServiceBookingForm.tsx|\
  web/src/hooks/AuthProvider.tsx|\
  web/src/public-site/useBookingMode.ts|\
  web/src/public-site/useBookingRequest.ts|\
  web/src/public-site/useBranchBooking.ts|\
  web/src/public-site/usePublicCatalog.ts|\
  web/tests/branch-booking.browser.mjs|\
  web/src/public-site/slots.mjs|\
  web/tests/slots.test.mjs|\
  web/tests/slot-routes.chromium.test.mjs|\
  .github/workflows/phase3-recovery.yml|\
  scripts/recovery/tests/phase3-phase4-positive-assertions.sql|\
  scripts/recovery/tests/phase3-preserved-snapshot.sql|\
  scripts/recovery/tests/phase3-provider-bootstrap.sql|\
  scripts/recovery/tests/phase3-synthetic-records.sql|\
  scripts/recovery/tests/phase3-to-15-assertions.sql|\
  scripts/recovery/tests/phase3-to-15-history-snapshot.sql|\
  scripts/recovery/tests/synthetic-phase3-phase4-positive.sh|\
  scripts/ci/pr88_frontend_pins.sh|\
  web/tests/public-owner-journeys.test.mjs|\
  .github/workflows/clinical-chart-pg17.yml|\
  docs/CLINICAL_CHART_ENCOUNTER_DRAFT.md|\
  supabase/migrations/20261120160000_clinical_chart_encounter_drafts.sql|\
  supabase/tests/clinical_chart_encounter_pg17.sql|\
  scripts/recovery/tests/clinical17-signed-restore.sh|\
  scripts/recovery/tests/clinical17-security-fingerprint.sql|\
  scripts/recovery/tests/clinical17-restored-authz.sql|\
  supabase/migrations/20261120221000_clinical_provenance_pagination_security.sql|\
  supabase/tests/clinical_provenance_pagination_pg17.sql|\
  web/src/lib/clinical-chart.ts) ;;
 *) fail "unexpected source change against PR69: $path";;
 esac
done < <(git diff --name-only "$EXPECTED_BASE_SHA" "$EXPECTED_HEAD_SHA")
# Public site files must be identical to BOTH exact PR79 and PR81 source
# commits, and to the checked-out working tree (no content synthesis).
while read -r path sha; do
 [[ "$(git rev-parse "$EXPECTED_PUBLIC_SHA:$path")" == "$sha" &&
    "$(git rev-parse "$EXPECTED_BRANCH_UI_SHA:$path")" == "$sha" &&
    "$(git rev-parse "26d5ed9bdc81275b24b80810a7da25f658c9e6e2:$path")" == "$sha" ]] ||
 fail "original PR79/81 public source drift: $path"
 case "$path" in
  web/src/pages/public/BookPage.tsx|web/src/pages/public/ServicesPage.tsx|web/tests/naga-site.test.mjs|web/src/components/SiteLayout.tsx)
   # PR88 replacements are independently pinned; CLOUD's SiteLayout is
   # separately pinned to its exact PR99 blob by CLOUD_PR99_EXACT_BLOBS.
   ;;
  *)
   [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
      "$(git hash-object "$path")" == "$sha" ]] ||
    fail "untouched PR79 public source drift: $path"
   ;;
 esac
done <<'NAGA_PUBLIC_BLOBS'
web/index.html f2e7f6abbc6683fce6340d8f98841714461bb7f0
web/src/components/SiteLayout.tsx 4db722e00b2cdc3277271963455634653128e804
web/src/pages/public/AboutPage.tsx 235be92e03673abb0a10379460416a500433ac45
web/src/pages/public/BookPage.tsx 15247ee6408b27d8c6a0dede40cad1453bd0ca0d
web/src/pages/public/HomePage.tsx ff28f6860ff48d94133f0f650d0dbc5aae7d384a
web/src/pages/public/ServicesPage.tsx 9004b0935ce1d31c4baa8dd464aeeb5c941c68f4
web/src/public-site/clinic-info.d.mts 530162da5f1fb30c1902682d8d6882e45a32aca4
web/src/public-site/clinic-info.mjs d91fd8d7b796874c87b6ad5f9dc220928efde172
web/tests/naga-site.test.mjs 0b464538d1e72cc2b1716e35ba462307df7fb897
web/tests/public-site.test.mjs 7738e66acefd74b1dd7a369b58e5c5b38455df3c
NAGA_PUBLIC_BLOBS
# PR81-only staff changes and additions are separately exact-pinned; this
# replaces no other PR71 invariant and cannot authorize additional paths.
while read -r path sha; do
 [[ "$(git rev-parse "$EXPECTED_BRANCH_UI_SHA:$path")" == "$sha" &&
    "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "reviewed PR81 branch selector source drift: $path"
done <<'BRANCH_UI_BLOBS'
web/src/ops/branch-model.d.mts dd33df741e89f2d354a676d471b39b5c947fc8e4
web/src/ops/branch-model.mjs c3927986e90c555490985fa886df5fa546401ed2
web/src/ops/port-adapter.d.mts 5c0437523ef465040bf7be911ec05c14d70bf990
web/src/ops/port-adapter.mjs 01c85c09539fce8984aa8eac5399f4c5ab53e9a6
web/src/ops/read-port.ts 032cd721d218f118c385b010b531b84109d87610
web/src/ops/useBranchScope.ts 4bdfbc5ac23b073127bf7a9cb87733d664f08b31
web/src/pages/staff/OpsPage.tsx 968abaff7a2986ebecc5b736a8765630ea0b65cc
web/tests/ops-branch.test.mjs f43e98d20b73aae4aa1e9ad1303c2edb97b197c8
BRANCH_UI_BLOBS
# Offline-only PR75 staging transport plan and mock coverage: strict blob pins.
# Grok-reviewed PR68 acceptance/guard source remains byte-identical to PR68.
while read -r path sha; do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "unreviewed staging transport-preparation source drift: $path"
done <<'STAGING_PREP_BLOBS'
scripts/hosted-acceptance/staging-request-plan.mjs 2654049c6221efea7a1b9c138c7c88442d99961e
scripts/hosted-acceptance/tests/staging-request-plan.test.mjs 6287fd01a8b51b254083058a33643280d47496db
docs/STAGING_ACCEPTANCE_TRANSPORT_PREPARATION.md 5c61c7182d98cd48e519f8091859a69d59f0ab9c
.github/workflows/staging-acceptance-plan-offline.yml 2c04fb85121b4d714b7dc319c39da4e82727566f
STAGING_PREP_BLOBS
# New Issue51-only corrective source may NEVER change frozen PR82 bytes.
# New files are exact git blobs, not broad path-prefix or wildcard exceptions.
while read -r path sha; do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
   fail "unreviewed Issue51 branch-booking security/test source drift: $path"
done <<'ISSUE51_REPAIR_BLOBS'
supabase/migrations/20261118203500_issue51_branch_booking_security.sql f58ca0e0bcb36d3a320060db7bf9bbeffe7f35f3
supabase/tests/issue51_branch_booking_pre_repair_pg17.sql caa144d8dc9bee0c7b0c578b46ff5001c695116d
supabase/tests/issue51_branch_booking_after_repair_pg17.sql c7a447e5583855d70dcbefb547a9f4019d2c3336
.github/workflows/issue51-branch-booking-pg17.yml d47cef68217e85d5883fb0062bd6c51b6dbe486b
docs/ISSUE51_BRANCH_BOOKING_REPAIR.md 5fe6cd5ad2248368330dc99cc19ba408e7f8cb96
ISSUE51_REPAIR_BLOBS
# New issue58 source-only additions are fixed Git blob hashes, no wildcard.
# Previous source PRs and eleven installed migrations retain the old hash pins.
while read -r path sha; do
 if [[ "$path" == .github/workflows/full-tree-pg17-security.yml ]]; then
   # Parent PR85's original workflow blob remains EXACT and immutable.
   # This child adds only the separately pinned new Issue78 path triggers.
   [[ "$(git rev-parse "0c3be38304a6fd9528e8e59d1aebac296d57486f:$path")" == "$sha" &&
      "$(git rev-parse "72932678dde35fc6caa0667ff3f900f49255a135:$path")" == 2b0e121b7aa201e3102a7836a6349c05884ef20b &&
      "$(git rev-parse "26d5ed9bdc81275b24b80810a7da25f658c9e6e2:$path")" == f5e8b4e0c02aae2a9abc31dde6cac83f7d46bdf8 &&
      "$(git rev-parse "2171567f275b88b54d5c3997f97ecf4986b050f2:$path")" == f5e8b4e0c02aae2a9abc31dde6cac83f7d46bdf8 &&
      "$(git rev-parse "961ee716316720821e1ce159815977743b823cee:$path")" == 55c88d25d7c44074b1c608f432fbe498106cdec2 &&
      "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:$path")" == 55c88d25d7c44074b1c608f432fbe498106cdec2 &&
      "$(git rev-parse "HEAD:$path")" == bbb1f1d3d03ff40d269c0b33dd0a2f520e56d86d &&
      "$(git hash-object "$path")" == bbb1f1d3d03ff40d269c0b33dd0a2f520e56d86d ]] ||
     fail 'parent or updated full-tree workflow drifted outside Issue78 exact pins'
 else
   [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
      "$(git hash-object "$path")" == "$sha" ]] ||
     fail "Issue58 unreviewed branch read source drift: $path"
 fi
done <<'ISSUE58_BLOBS'
supabase/migrations/20261118215500_issue58_staff_branch_read_contract.sql c889477348d9505d54f54b1d08532c2f648992a9
supabase/tests/issue58_staff_branch_queue_fixture.sql 627c704a311cfe92c3c805bb248a2ed90c1987dc
supabase/tests/issue58_staff_branch_read_pg17.sql b73006e7a5c45a00037c97511a3014bd2e19299e
.github/workflows/issue58-staff-branch-read-pg17.yml 7b0de31308a3057ad6c7aa85bf74d1d11dc5968c
web/src/staff-branch-read-contract.mjs 39c4b19edb70bb14c12ee09d69d160386ac6d175
web/src/staff-branch-read-contract.d.mts 39ac1f2802283d0a42790cd4647effc6e9494a2f
web/src/lib/staff-branch.ts 4ef4e033585ba3545cc86da6dd61b98fd70f6b05
web/tests/staff-branch-read-contract.test.mjs ab8588bdec70ef4a498c4acc1625a688b00b4ecf
docs/ISSUE58_STAFF_BRANCH_READ.md 56aa231f45b068d22268d73185dd4f18ce3d6860
.github/workflows/full-tree-pg17-security.yml 09c9c1978690d815f6779af172a53ce81eed7d6f
ISSUE58_BLOBS
# ISSUE78 only: pin exact Git blobs for new inventory schema, fixtures and
# disposable race-denial CI. Do not relax pre-existing PR68-85 source pins.
while read -r path sha; do
 if [[ "$path" == .github/workflows/full-tree-pg17-security.yml ]]; then
   [[ "$(git rev-parse "72932678dde35fc6caa0667ff3f900f49255a135:$path")" == "$sha" &&
      "$(git rev-parse "26d5ed9bdc81275b24b80810a7da25f658c9e6e2:$path")" == f5e8b4e0c02aae2a9abc31dde6cac83f7d46bdf8 &&
      "$(git rev-parse "2171567f275b88b54d5c3997f97ecf4986b050f2:$path")" == f5e8b4e0c02aae2a9abc31dde6cac83f7d46bdf8 &&
      "$(git rev-parse "961ee716316720821e1ce159815977743b823cee:$path")" == 55c88d25d7c44074b1c608f432fbe498106cdec2 &&
      "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:$path")" == 55c88d25d7c44074b1c608f432fbe498106cdec2 &&
      "$(git rev-parse "HEAD:$path")" == bbb1f1d3d03ff40d269c0b33dd0a2f520e56d86d &&
      "$(git hash-object "$path")" == bbb1f1d3d03ff40d269c0b33dd0a2f520e56d86d ]] ||
    fail 'immutable PR86 workflow or public reader path triggers changed'
 else
  [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
     "$(git hash-object "$path")" == "$sha" ]] ||
  fail "Issue78 unreviewed inventory source drift: $path"
 fi
done <<'ISSUE78_BLOBS'
supabase/migrations/20261118225000_issue78_inventory_read_only_foundation.sql 908f881bfc541ab4265912e0a9e55525ea8275a5
supabase/tests/issue78_inventory_synthetic_fixture.sql de5ee91ed724718acbc6724ce1c6beb489e1ac80
supabase/tests/issue78_inventory_pg17_denials.sql 24465f1c7e70d946c0f07ef1def7a39aa5439843
supabase/tests/issue78_inventory_timezone_pg17.sql 06bc46e34209dfd9d61e3fe576cf4b7d29d13992
scripts/ci/issue78_concurrent_denials.sh 989b18062262d4b677e7df76273cf6637519a432
.github/workflows/issue78-inventory-pg17.yml 4fc7d56d512fb2eacd2bea7136104b2d82d6b14f
docs/ISSUE78_MEDICINE_INVENTORY_READ_ONLY.md 95d9a5333573be38cce5b42bccc737b81ee56d30
.github/workflows/full-tree-pg17-security.yml 2b0e121b7aa201e3102a7836a6349c05884ef20b
ISSUE78_BLOBS
# ISSUE51 PUBLIC READER ONLY: these four source and test blobs are immutable.
# Existing service booking RPC, Claude UI and 15 SQL migrations are untouched.
while read -r path sha; do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "Issue51 unreviewed public branch reader source drift: $path"
done <<'ISSUE51_PUBLIC_READER_BLOBS'
web/src/lib/branch-public-booking-reader.mjs a06cfd1cc77ce911dc52a1febab1ad74ff1253ef
web/src/lib/branch-public-booking-reader.d.mts d48907f2c56ba5ff2bfd6d129633fa345f128228
web/src/lib/branch-public-booking.ts b972ac6d3fe739da24d9e961e3242dfe10e7fa83
web/tests/branch-public-booking-reader.test.mjs fc18a9d20ffd3bce24fd0bc410ac4924d038d61d
ISSUE51_PUBLIC_READER_BLOBS
# Source-only issue77 additive candidate: exact immutable schema/test/workflow/docs.
# Original eleven applied migrations and Grok/booking/staff blobs remain separately pinned.
while read -r path sha; do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
   fail "unreviewed multi-branch source drift: $path"
done <<'ISSUE77_BLOBS'
supabase/migrations/20261117233500_issue77_four_branch_foundation.sql 4732b815cff45850d2f01cdeb93c527dac0e22a0
supabase/tests/issue77_four_branch_pg17_denials.sql dbbc145902a9516fdda4e6ae629e86c4f4096e78
docs/ISSUE77_FOUR_BRANCH_FOUNDATION.md c2058b309fed0be06617f4fedb504faf6a1d7ab4
.github/workflows/issue77-four-branch-pg17.yml 131d7da33df4f6be56484046c87a95fd398a79b2
ISSUE77_BLOBS
while read -r path sha; do
 [[ -s "$path" && "$(git hash-object "$path")" == "$sha" ]] ||
  fail "source drift: $path"
done <<'BLOBS'
supabase/migrations/20261113070302_phase2_core_data_security.sql cf329269e3f38a5ac320d0b60fe82b6165e218d6
supabase/migrations/20261113070834_phase2_index_and_policy_tuning.sql d7f8922de9251bb777430ce4163d2ca501b290f5
supabase/migrations/20261113074938_phase2_verified_auth_and_staff_bootstrap.sql 218b612c15944c811708f4908825d0a969064692
supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql f12c39c4b75462aa9597d38065c70216e872c478
supabase/migrations/20261113100958_phase3_clinical_storage_policies.sql b47363bfdc3af3081a2af2f422be44a40c967e54
supabase/migrations/20261113101626_phase3_staff_membership_audit.sql 0fc85dd437eac7d8d89fe69025df917ab79d3e0e
supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql 4296a5dcf84324cd83eea226e6054b0cd4f56658
supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql cc03606d3d47b0d573f431a1a1161ba243a314d3
supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql 028cbdcfb96e15d297a9458322e1108c46a8b035
supabase/migrations/20261114090000_phase4_public_booking_contract.sql 929f327141d9e5bb2be220d5685c6ce3f28c253c
supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql 4d78cb2aef1104379d6fd29797705a6188c4c6dc
supabase/tests/phase5a_staff_booking_rpc_queue.sql 9fd4a627f471391b192968af57f81384a5121a5a
supabase/tests/phase5a_staff_pg17_regression.sql a1b9781325724885188099075d8c36e9ed223b1b
supabase/tests/phase3_storage_outer_path_after_fix.sql 293abc90a168f6157aa0b0055d2e78fea8f59a8f
BLOBS
echo 'PASS: frozen PR97 nine-path signed recovery, exact CLOUD PR99 two frontend blobs, CI-only child, fixed migrations, source and RLS pins.'
pg(){ psql -X -v ON_ERROR_STOP=1 -q -f "$1"; }
provider(){
 if [[ "$PGDATABASE" == full_tree_history_ci ]]; then
  # PostgreSQL roles are CLUSTER-scoped; the original provider bootstrap
  # creates both roles in DB A. Keep its SQL unchanged, exclude just those
  # two CREATE ROLE statements when initializing disposable DB B.
  [[ "$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from pg_roles where rolname in ('anon','authenticated')")" == 2 ]] ||
   fail 'original Auth roles missing before second database'
  sed -e '/^create role anon nologin;$/d' \
      -e '/^create role authenticated nologin;$/d' \
      supabase/tests/phase5a_staff_pg17_bootstrap.sql |
      psql -X -v ON_ERROR_STOP=1 -q
 else
  pg supabase/tests/phase5a_staff_pg17_bootstrap.sql
 fi
 pg supabase/tests/phase4_combined_provider_upgrade.sql
}
six(){
 for n in \
 20261113070302_phase2_core_data_security.sql \
 20261113070834_phase2_index_and_policy_tuning.sql \
 20261113074938_phase2_verified_auth_and_staff_bootstrap.sql \
 20261113095318_phase3_appointment_lifecycle.sql \
 20261113100958_phase3_clinical_storage_policies.sql \
 20261113101626_phase3_staff_membership_audit.sql; do pg "supabase/migrations/$n"; done
}
four(){
 for n in \
 20261113211600_phase4_taxonomy_attachments.sql \
 20261113211700_phase4_animal_catalog_seed.sql \
 20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql \
 20261114090000_phase4_public_booking_contract.sql; do pg "supabase/migrations/$n";done
}
# Database A: combined auth, booking, scheduling negative, queue, Storage.
provider
six
four
pg supabase/tests/phase5a_staff_booking_rpc_queue.sql
psql -X -v ON_ERROR_STOP=1 -q -c 'BEGIN' \
 -f supabase/tests/phase5a_staff_pg17_regression.sql -c 'ROLLBACK'
[[ "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from auth.users')" == 0 &&
   "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from public.appointments')" == 0 ]] ||
 fail 'reused booking/staff fixtures not rolled back'
pg supabase/tests/full_tree_approved_booking_gate.sql
[[ "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from public.clinic_services')" == 0 ]] ||
 fail 'approved synthetic policy leaked outside transaction'
pg supabase/tests/phase3_storage_outer_path_synthetic_records.sql
pg supabase/tests/phase3_storage_outer_path_phase4_preservation.sql
pg supabase/tests/phase3_storage_outer_path_before_fix.sql
pg supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
pg supabase/tests/phase3_storage_outer_path_after_fix.sql
pg supabase/tests/phase4_combined_source_assertions.sql
echo 'PASS: FULL_TREE PG17 real SQL: service-less negative, RPC replay/conflict, owner/anon/revoked/staff RLS, queue 0/249/250/251/300, Storage before/after fix.'

# Database B: original Dog/Chow Chow and requested appointment are present
# BEFORE the four Phase4 migrations, not just seeded afterward.
PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -q -c 'CREATE DATABASE full_tree_history_ci'
export PGDATABASE=full_tree_history_ci
provider
six
pg supabase/tests/phase3_storage_outer_path_synthetic_records.sql
psql -X -v ON_ERROR_STOP=1 -q <<'BEFORE'
create table clinic_ci.full_tree_pre_pets as select id,to_jsonb(p) as original from public.pets p;
create table clinic_ci.full_tree_pre_appointments as select id,to_jsonb(a) as original from public.appointments a;
do $$
begin
 if (select count(*) from clinic_ci.full_tree_pre_pets)<>2
  or (select count(*) from clinic_ci.full_tree_pre_appointments)<>1
  or (select count(*) from public.pets where species='Dog' and breed='Chow Chow')<>1
 then raise exception 'FULL_TREE_FAIL: expected pre-Phase4 Chow Chow and appointment missing';end if;
end $$;
BEFORE
four
psql -X -v ON_ERROR_STOP=1 -q <<'AFTER'
do $$
begin
 if exists(select 1 from clinic_ci.full_tree_pre_pets old left join public.pets p using(id)
   where p.id is null or to_jsonb(p)-'species_id'-'breed_id'-'taxonomy_review_needed' is distinct from old.original)
 or exists(select 1 from clinic_ci.full_tree_pre_appointments old left join public.appointments a using(id)
   where a.id is null or to_jsonb(a)-'service_id'-'request_nonce' is distinct from old.original)
 then raise exception 'FULL_TREE_FAIL: historical patient/appointment data mutated';end if;
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
    and species='Dog' and breed='Chow Chow'
    and species_id='dog' and breed_id='dog-chow-chow'
    and taxonomy_review_needed=false)<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
    and status='requested' and service_id is null and request_nonce is null)<>1
 then raise exception 'FULL_TREE_FAIL: Chow Chow mapping or historical appointment lost';end if;
 if (select count(*) from pg_trigger
   where tgrelid='public.pets'::regclass and
   tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
   and not tgisinternal and tgenabled in ('O','A'))<>1
 then raise exception 'FULL_TREE_FAIL: taxonomy trigger is not exact one';end if;
 if exists(select 1 from public.clinic_services)
    or exists(select 1 from public.clinic_booking_policy where is_approved)
 then raise exception 'FULL_TREE_FAIL: migration auto-approved services or policy';end if;
end $$;
AFTER
pg supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
pg supabase/tests/phase3_storage_outer_path_phase4_preservation.sql
echo 'PASS: FULL_TREE pre-Phase4 Dog/Chow Chow and requested booking archival fields survive exact six+four+fix.'
echo 'NOT VERIFIED: hosted Supabase JWTs/Storage API, provider restore, real patient data or approved clinical hours.'
