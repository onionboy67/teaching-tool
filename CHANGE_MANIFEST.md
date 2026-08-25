# Change Manifest — Architecture Foundation v18

## Purpose
Establish permanent feature boundaries so future Teacher HQ updates can be small, isolated and easy to roll back.

## Existing files replaced
- `mega-features.js` — reduced from a cross-feature implementation to a compatibility shim. Its working responsibilities now live in feature modules.

## Existing files manually edited
- `index.html` — one new loader `<script>` line only.

## New runtime files
- `architecture.js`
- `hq-core.js`
- `hq-legacy-bridge.js`
- `feature-overview.js`
- `feature-cohorts.js`
- `feature-classes.js`
- `feature-units.js`
- `feature-curriculum.js`
- `feature-lessons.js`
- `feature-calendar.js`
- `feature-backup.js`
- `feature-trash.js`

## Real extraction completed in this patch
Former `mega-features.js` responsibilities have been separated as follows:

- **Units:** field-trip lesson shifting, Unit progressions, rubric-download enhancement, field-trip visuals, Unit soft-delete integration.
- **Lessons:** Lesson hub, stand-alone Lesson creation, attachment to Units, Saved Context library.
- **Trash/Profile:** deleted-user workspace UI and profile soft-delete controls.
- **Overview:** final cross-feature post-render refresh orchestration.

`mega-features.js` remains only as a compatibility facade for existing `TeacherHQMega` / `TeacherHQPlanning` callers.

## Data/schema impact
None. No localStorage key or schema migration.

## UI impact
None intended.

## Curriculum datasets
Untouched.
