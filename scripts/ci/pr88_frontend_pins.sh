#!/usr/bin/env bash
# PR88 CLOUD frontend manifest retained; PR91's exact four-slot-path delta stays frozen.
# PR94's independently reviewed one-test fixed-clock correction is pinned separately.
# Never replace older reviewed browser source hashes with an unverified HEAD hash.
# CI-only: safe on shallow Node/Chromium checkouts and full-tree PG17.
# No RLS/migration, feature-flag, source or advisory exemptions.
set -Eeuo pipefail
fail(){ echo "PR88_CLOUD_SOURCE_BLOCKED: $*" >&2; exit 1; }
[[ "$GITHUB_ACTIONS" == true &&
   "$GITHUB_EVENT_NAME" == pull_request &&
   "$GITHUB_REPOSITORY" == cmlagatuz/dawney-clinic ]] ||
  fail 'not a Dawney pull request Actions environment'
# This CI-only child DESCENDS from the exact PR88 source commit.
# Full-tree PG17 separately verifies exact ancestry and unchanged prior source.
while read -r path sha; do
 if [[ "$path" == web/tests/branch-booking.browser.mjs ]]; then
  # Preserve the original PR88 test at PR90 and CLOUD's reviewed PR91 extension.
  # PR94 changes only this test again; SOL independently accepted exact blob 3b1fffccd16d002cb02b08e44c932442bd34d66e.
  [[ "$(git rev-parse "961ee716316720821e1ce159815977743b823cee:$path")" == "$sha" &&
     "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:$path")" == db91b57c285f80fa24c4487de9c652f4fd04957f &&
     "$(git rev-parse "10650396dc968a4685f8f6ba1c6d5f932df117a9:$path")" == 3b1fffccd16d002cb02b08e44c932442bd34d66e &&
     "$(git rev-parse "HEAD:$path")" == 3b1fffccd16d002cb02b08e44c932442bd34d66e &&
     "$(git hash-object "$path")" == 3b1fffccd16d002cb02b08e44c932442bd34d66e ]] ||
   fail "CLOUD PR88 ancestor, PR91 browser extension, or reviewed PR94 correction changed: $path"
 else
  [[ "$(git rev-parse "HEAD:$path" 2>/dev/null)" == "$sha" &&
     "$(git hash-object "$path")" == "$sha" ]] ||
   fail "CLOUD changed or missing reviewed frontend source: $path"
 fi
done <<'CLOUD_PR88_PRESENT'
web/src/components/BranchBookingAvailability.tsx 798effde15763b52981781f70627d6feb93c2de8
web/src/components/ServiceBookingForm.tsx 180410495143b79676502438f2dcc53fa2210f51
web/src/hooks/AuthProvider.tsx ea5bf11bbfb99bb2d8bdb57b6902bf6f632d6a9f
web/src/pages/AppointmentsPage.tsx 63c25a2d3725f9f2d712568533429663ce97b0ca
web/src/pages/public/BookPage.tsx fe5ebd539aa5f11239b80630e41969b7fc734381
web/src/pages/public/ServicesPage.tsx 7d85b649c8763f952061f4c09e4f92646a58ab2e
web/src/public-site/useBookingRequest.ts 128d87ba3d601bed933424a1939983454452c4e3
web/src/public-site/useBranchBooking.ts 9c5ea9ebc333e08b849d870ad57b14d368ec8e17
web/tests/branch-booking.browser.mjs c6f594fa51ff3b69a26f144bbfa8e3fe08b2d9b4
web/tests/naga-site.test.mjs b0d3bb56f2eab8f7518ff8fe257c6eddd8d985fd
web/tests/owner-booking-view.test.mjs b2d1d868e7d6429981090b2e517272c25ab18dd4
CLOUD_PR88_PRESENT
while read -r path; do
 [[ ! -e "$path" ]] && ! git cat-file -e "HEAD:$path" 2>/dev/null ||
   fail "CLOUD deleted frontend source was unexpectedly revived: $path"
done <<'CLOUD_PR88_REMOVED'
web/src/public-site/useBookingMode.ts
web/src/public-site/usePublicCatalog.ts
CLOUD_PR88_REMOVED
# PR91 four and ONLY four frontend changes over frozen CI-only PR90 remain historical truth.
# PR94 changes only the browser fixture from db91b57c285f80fa24c4487de9c652f4fd04957f to 3b1fffccd16d002cb02b08e44c932442bd34d66e.
# Historical slot implementation and original PR88 browser SHA are immutable.
[[ "$(git rev-parse "961ee716316720821e1ce159815977743b823cee:web/src/public-site/slots.mjs")" == 4932b1f5db8ce4983461e38aa6c24a8448c61f1e ]] ||
 fail 'PR90 source slots.mjs ancestor changed'
while read -r path sha; do
 if [[ "$path" == web/tests/branch-booking.browser.mjs ]]; then
  [[ "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:$path")" == db91b57c285f80fa24c4487de9c652f4fd04957f &&
     "$(git rev-parse "10650396dc968a4685f8f6ba1c6d5f932df117a9:$path")" == "$sha" &&
     "$(git rev-parse "HEAD:$path")" == "$sha" &&
     "$(git hash-object "$path")" == "$sha" ]] ||
   fail "CLOUD reviewed PR94 browser correction changed: $path"
 else
  [[ "$(git rev-parse "c3ab821bc4cf359a7ea2929356dd035c540d6eb6:$path")" == "$sha" &&
     "$(git rev-parse "10650396dc968a4685f8f6ba1c6d5f932df117a9:$path")" == "$sha" &&
     "$(git rev-parse "HEAD:$path")" == "$sha" &&
     "$(git hash-object "$path")" == "$sha" ]] ||
   fail "CLOUD PR91 exact slot source/test blob changed after PR94: $path"
 fi
done <<'CLOUD_PR91_PLUS_PR94_APPROVED'
web/src/public-site/slots.mjs 958acabddeda66067299fe3ec7713684b37e440b
web/tests/branch-booking.browser.mjs 3b1fffccd16d002cb02b08e44c932442bd34d66e
web/tests/slots.test.mjs 51a144774d138a09a3dfe386cd228bddd6d99989
web/tests/slot-routes.chromium.test.mjs 87f80ebbb64e7509c77ee7e3fcbea691df9d5af2
CLOUD_PR91_PLUS_PR94_APPROVED
for path in web/tests/slots.test.mjs web/tests/slot-routes.chromium.test.mjs; do
 ! git cat-file -e "961ee716316720821e1ce159815977743b823cee:$path" 2>/dev/null ||
  fail "PR91 newly-added test already existed in frozen PR90: $path"
done
# The 7-argument booking RPC and all SQL blobs remain checked by full_tree_pg17.sh.
echo 'PASS: exact prior PR88/90 browser history, frozen PR91 four-file delta, and reviewed PR94 one-test correction pinned'
