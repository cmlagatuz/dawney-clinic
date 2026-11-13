{{-- Runs in <head> before first paint so the saved/OS theme never flashes. --}}
<script>
(function () {
  try {
    var t = localStorage.getItem('dawney-theme');
    if (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { t = 'dark'; }
    if (t === 'dark' || t === 'light') { document.documentElement.setAttribute('data-theme', t); }
  } catch (e) { /* storage unavailable: CSS falls back to the OS preference */ }
})();
</script>
