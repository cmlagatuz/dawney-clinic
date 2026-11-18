#!/usr/bin/env bash
# PR88 CLOUD frontend manifest: reviewed exact 13-file source delta.
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
 [[ "$(git rev-parse "HEAD:$path" 2>/dev/null)" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "CLOUD changed or missing reviewed frontend source: $path"
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
# The 7-argument booking RPC and all SQL blobs remain checked by full_tree_pg17.sh.
echo 'PASS: exact 11 reviewed PR88 frontend blobs and 2 intentional deletions, no substitutions'
