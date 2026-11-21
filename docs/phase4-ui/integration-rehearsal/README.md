# #34 + #41 + #48 integration rehearsal (disposable; nothing merged)

Evidence images are from a **stubbed** local Chromium harness over the combined source (not live Supabase, no real Storage or bookings).

## Real conflicts (merging #41 `4276604` with #48 on #34 `85132e0`)
Only 3 textual conflicts; every other file merged cleanly (#41 touches 23 files, #48 touches 78; overlap = these three):

| File | Cause | Resolution |
|---|---|---|
| `web/src/App.tsx` | #48 deleted `Root()` (the `/` → `/app/overview` redirect; `/` is now the public Home). #41 added the OFF-by-default `phase4PatientForm` flag right next to it. | Keep #41's flag, drop `Root()`. Nothing else. |
| `web/src/styles.css` | Both append a new numbered section (12 patient form / 13 public website). No selector is defined in both. | Keep both. |
| `docs/AI_HANDOFF.md` | Both append sections. | Keep both. |

No semantic overlaps: public booking never imports catalog/attachment code, and the attachment code never imports public-site/booking code; both use the same #34 `lib/*` unchanged.

## Safe integration procedure (when approved by the PM)
1. Merge #46 and #43 (backend) first; merge #34 into master. Never retarget before that.
2. Refresh #41 and #48 on the new master separately (no force-push). Merge #41 first, then rebase/merge master into #48 and resolve the same 3 conflicts as above (`scripts/integration-rehearsal/resolve-41-48.mjs` shows the exact resolution).
3. Drop #48's byte-identical copies of #43 files once #43 is on master.
4. Keep `VITE_PHASE4_PATIENT_FORM` unset until the Phase 4 migrations are live and the owner authorises it.
5. Delete `.github/workflows/phase4-integration-rehearsal.yml` and `scripts/integration-rehearsal/` after the real merge.
