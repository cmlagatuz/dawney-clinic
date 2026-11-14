# Brand assets

Place the **owner-supplied Dawney Animal Clinic logo** here, exactly as supplied (do not redraw, restyle or crop):

- `dawney-logo.png` — original artwork, transparent or white background. Used on sign-in, sidebar, headers.
- (optional, owner-approved crop only) `favicon.png` for the browser tab.

`web/src/components/Layout.tsx` (`LOGO_SRC`) loads `/brand/dawney-logo.png` with its natural aspect ratio on a light plate,
and falls back to a plain text wordmark if the file is missing. Keep the file under ~150 KB.
No stock, placeholder or guessed logo may be committed in this folder.
