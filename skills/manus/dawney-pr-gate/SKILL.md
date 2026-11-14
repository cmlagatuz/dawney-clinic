---
name: dawney-pr-gate
description: Inspect Dawney GitHub PR change scope, head SHA, CI checks, mergeability and independent reviewer; produce concise source-merge readiness without merging or deploying. Use on PR creation, updates or ready-for-review.
---

# Dawney PR gate

When a Phase4 PR is opened or its head changes:

1. Read repo `MANUS.md`, selected PR title/description, changed files, current master and base branch, exact head SHA and required GitHub check runs. Ignore stale instructions and old SHAs.
2. Verify dependencies: **#46 CI -> #34 UI -> #40 taxonomy -> #43 booking (with #50 privacy) -> #49 recovery; #52 regression after #40/#43; #41/#48 stacked on #34 and require reviewed retarget**. #47 is CI validation-only; #39 is an unfinished security draft. Re-evaluate when actual branches change.
3. Distinguish statuses: **source-scope** mergeability (true/false), **CI** success/failed/skipped, **Pages** deploy (real commit), **Workers** unrelated/unknown, and **clinical live** (always owner gated).
4. If failing check, inspect **actual log** (minimum fragment) and determine whether it is application failure vs separate #45 Worker integration. Never mark an unstable PR as totally green.
5. Check ownership paths: backend SQL/lib Astra; React components/pages Claude; QA Qwen; security audit Grok; deploy issue/logs Manus. Flag overlaps and copied temporary contracts.
6. Output:
   - `HEAD: <SHA>`; `BASE:`; `CHANGES:` <=3 meaningful files/categories
   - `CHECKS:` key Github URLs with pass/fail, including Workers separated
   - `DEPENDENCIES:` one or two
   - `SOURCE MERGE:` READY / NEEDS FIX / BLOCKED
   - `CLINICAL ACTIVATION:` OWNER-GATED
   - `NEXT OWNER:` exactly one agent + bounded action
7. No self-merge, no deployment, no source edits, no secrets and no patient content. Max 250 words.

When no SHA change or already-reviewed result exists, output `NO MATERIAL CHANGE` and stop.
