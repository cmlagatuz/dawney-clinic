/*
 * Dawney Clinic UI behaviours (owner: Claude / frontend).
 * Vanilla JS, no build step, no dependencies. Progressive enhancement only:
 * every page still works if this file fails to load.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'dawney-theme';

  function storedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function currentTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) { return attr; }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* storage blocked: session-only */ }
    }
    syncToggles(theme);
  }

  function syncToggles(theme) {
    var next = theme === 'dark' ? 'light' : 'dark';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      var label = 'Switch to ' + next + ' theme';
      buttons[i].setAttribute('aria-label', label);
      buttons[i].setAttribute('title', label);
      var text = buttons[i].querySelector('[data-theme-toggle-label]');
      if (text) { text.textContent = theme === 'dark' ? 'Light' : 'Dark'; }
    }
  }

  function initTheme() {
    syncToggles(currentTheme());
    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
      if (!btn) { return; }
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    });

    // Follow OS changes only while the user has not chosen explicitly.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (e) {
        if (!storedTheme()) { applyTheme(e.matches ? 'dark' : 'light', false); }
      };
      if (mq.addEventListener) { mq.addEventListener('change', onChange); }
      else if (mq.addListener) { mq.addListener(onChange); }
    }
  }

  /*
   * Live client-side list filter.
   *   <input data-filter-input="#table-id" data-filter-status="#status-id">
   * Filters <tbody> rows of the target table by visible text, and announces
   * "Showing X of Y" through a polite live region.
   */
  function initFilters() {
    var inputs = document.querySelectorAll('[data-filter-input]');
    Array.prototype.forEach.call(inputs, function (input) {
      var table = document.querySelector(input.getAttribute('data-filter-input'));
      if (!table) { return; }
      var status = document.querySelector(input.getAttribute('data-filter-status') || '');
      var rows = Array.prototype.filter.call(table.querySelectorAll('tbody tr'), function (r) {
        return !r.hasAttribute('data-filter-ignore');
      });
      var noMatch = table.querySelector('[data-filter-nomatch]');

      function run() {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        rows.forEach(function (row) {
          var hit = q === '' || row.textContent.toLowerCase().indexOf(q) !== -1;
          row.hidden = !hit;
          if (hit) { shown++; }
        });
        if (noMatch) { noMatch.hidden = shown !== 0 || rows.length === 0; }
        if (status) { status.textContent = 'Showing ' + shown + ' of ' + rows.length; }
      }

      input.addEventListener('input', run);
      run();
    });
  }

  function init() {
    initTheme();
    initFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
