#!/usr/bin/env python3
"""WCAG contrast gate for public/css/clinic-ui.css (owner: Claude / frontend).

Fails (exit 1) if any text pairing is below 4.5:1, any focus ring / input border is below
3:1 against its surface, or the no-JS dark fallback drifts from the dark theme tokens.
Run from anywhere:  python3 tests/frontend/contrast_check.py
"""
import os, re, sys

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'css', 'clinic-ui.css')
css = open(CSS, encoding='utf-8').read()


def tokens(selector_regex):
    m = re.search(selector_regex + r'\s*\{(.*?)\n\s*\}', css, re.S)
    return dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})', m.group(1)))


light = tokens(r'\n:root')
dark = tokens(r':root\[data-theme="dark"\]')
fallback = tokens(r':root:not\(\[data-theme\]\)')


def lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def ratio(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + .05) / (lo + .05)


TEXT = [('c-text', 'c-bg'), ('c-text', 'c-surface'), ('c-text', 'c-surface-2'), ('c-muted', 'c-bg'),
        ('c-muted', 'c-surface'), ('c-muted', 'c-surface-2'), ('c-muted', 'c-primary-soft'),
        ('c-primary', 'c-surface'), ('c-primary', 'c-bg'), ('c-primary', 'c-surface-2'),
        ('c-primary', 'c-primary-soft'), ('c-primary-hover', 'c-surface'), ('c-on-primary', 'c-primary'),
        ('c-on-primary', 'c-primary-hover'), ('c-success', 'c-success-soft'), ('c-success', 'c-surface'),
        ('c-danger', 'c-danger-soft'), ('c-warning', 'c-warning-soft'), ('c-text', 'c-primary-soft')]
NON_TEXT = [('c-focus', 'c-surface'), ('c-input-border', 'c-surface')]

failures = 0
for name, t in (('light', light), ('dark', dark)):
    for fg, bg, minimum in [(a, b, 4.5) for a, b in TEXT] + [(a, b, 3.0) for a, b in NON_TEXT]:
        r = ratio(t[fg], t[bg])
        if r < minimum:
            failures += 1
            print(f'FAIL [{name}] {fg} on {bg}: {r:.2f} < {minimum}')

if fallback != dark:
    failures += 1
    print('FAIL: no-JS prefers-color-scheme fallback tokens differ from [data-theme="dark"] tokens')

print(f'contrast_check: {2 * (len(TEXT) + len(NON_TEXT))} pairings checked, {failures} failure(s)')
sys.exit(1 if failures else 0)
