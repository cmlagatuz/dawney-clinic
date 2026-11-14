/*
 * Applies the saved or OS theme before first paint so there is no light/dark flash.
 * External file because the CSP is `script-src 'self'` (no inline scripts). No secrets, no network.
 */
(function () {
  try {
    var saved = localStorage.getItem('dawney-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) { /* storage blocked: CSS falls back to the OS preference */ }
})();
