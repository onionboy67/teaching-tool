# Teacher HQ v18 — Modular Architecture Foundation

## Why this exists
Teacher HQ grew from a small static application into a multi-feature teaching tool. The current release already has several separate feature files, but `app.js` still owns storage, school terms, schedules, units, workspace logic and backup/read-view helpers, while `mega-features.js` contains unrelated cross-feature integrations. That makes broad changes slower and harder to isolate.

v18 introduces a permanent modular layer without invalidating the working v17 application. As the first real extraction, the former `mega-features.js` catch-all is reduced to a compatibility shim and its responsibilities are moved into Units, Lessons, Trash/Profile, and Overview modules.

## The rule from v18 onward
**New feature code does not go into `app.js` or `mega-features.js` unless it is genuinely shared core infrastructure.**

Use these boundaries instead:

| Feature | Primary patch file | Existing legacy source to gradually extract |
|---|---|---|
| Overview | `feature-overview.js` | `main-page-redesign.js`, `calendar-tools.js` |
| Cohorts | `feature-cohorts.js` | Cohort portions of `classes.js` |
| Classes | `feature-classes.js` | Class portions of `classes.js` |
| Units | `feature-units.js` | Unit portions of `app.js`, `mega-features.js` |
| Curriculum | `feature-curriculum.js` | `curriculum-browser.js`, `data-registry.js` |
| Lessons | `feature-lessons.js` | `lesson-planner.js`, `mega-features.js` |
| Calendar | `feature-calendar.js` | `calendar-tools.js`, `calendar-page.js` |
| Backup / Share | `feature-backup.js` | backup/read-view portions of `app.js` |
| Trash | `feature-trash.js` | `trash.js`, deleted-user portions of `mega-features.js` |

Official curriculum/progression datasets are inputs, not feature implementation files. Routine UI or planner patches should not modify those datasets.

## How the bridge works
`architecture.js` is the one permanent loader. It loads:

1. `hq-core.js` — event bus, service registry, command registry, feature registry and feature-local style injection.
2. `hq-legacy-bridge.js` — allows new modules to call existing global Teacher HQ functions while code is migrated gradually.
3. the nine feature boundary modules.

The existing v17 scripts still load normally first. If the modular layer ever fails to load, the loader catches the failure and the existing site is left running.

## No data migration
This architecture patch does **not** change the existing browser storage key or schema. It does not rewrite user records, curriculum notes, cohorts, classes, lessons, units, calendar data, backups or Attention Grabbers.

## Incremental extraction order
Do not perform another all-at-once rewrite. Extract only when a feature is next being changed:

1. **Completed in v18:** `mega-features.js` responsibilities moved into Units, Lessons, Trash/Profile, and Overview feature files; the old filename remains only as a compatibility shim.
2. Split Cohort and Class logic out of `classes.js` when either area next changes.
3. Move Unit workspace logic out of `app.js` when Unit Planner next changes.
4. Move Backup/Share out of `app.js` when that feature next changes.
5. Move storage/normalization into a dedicated core service only after the feature boundaries are stable.

This keeps each migration independently testable and reversible.
