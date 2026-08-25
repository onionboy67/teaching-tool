# Teacher HQ — QA Report

## Release
Main Page, Cohort Workspace & Curriculum Browser Redesign (`?v=17`)

## Automated/static checks performed
- JavaScript syntax checked with Node `--check` across all JavaScript files: **PASS**.
- `index.html` duplicate ID scan: **PASS** — no duplicate IDs.
- `calendar.html` duplicate ID scan: **PASS** — no duplicate IDs.
- HTML local JS/CSS reference scan: **PASS** — no missing referenced assets.
- CSS brace-balance scan across core/release CSS files: **PASS**.
- Main and Calendar View cache references: **PASS** — no remaining `?v=16` asset references.

## Curriculum registry integrity
The release does not alter official curriculum/progression datasets.

- Curriculum records: **10,316**
- Unique curriculum IDs: **10,316**
- Duplicate curriculum IDs: **0**
- Progression records: **380**
- Unique progression IDs: **380**
- Duplicate progression IDs: **0**

## Integration points checked in code
- Persistent left menu IDs map to existing Cohort/Class/Unit/Curriculum/Backup/Trash actions.
- Main `Calendar View` action replaces the old whole-calendar-card navigation behaviour.
- Calendar date cells route to Daily View.
- Daily View supports Lesson/Event/Block creation.
- Daily linked Lessons, Field Trips and Assessments route to their existing editors.
- `Sub Day` is excluded from `isNoSchoolDate`, so it does not remove valid instructional blocks.
- Sub Day is displayed in Overview, Calendar View, Unit calendars and readable calendar output.
- Cohort Attention Grabbers normalize into Cohort data and are exposed to Lesson Hook selection.
- Legacy Lesson agenda type `attention-grabber` normalizes to `hook`.
- Curriculum notes are stored on the user profile by stable curriculum record ID rather than modifying registry data.
- Lesson curriculum note visibility is stored independently in each Lesson Plan.
- Curriculum bulk Select/Clear logic remains separate from branch expansion state.
- Split Grade View creates two independent Curriculum Browser panes.
- Progressions use the same Browser dialog but remain visually/data-wise distinct from subject curriculum.

## Browser-runtime note
A full automated browser harness is not bundled with this static GitHub Pages project. The release has therefore been validated structurally and by syntax/data-integrity checks; the included `INSTALL.md` smoke test should be run on the deployed GitHub Pages copy after upload, especially for visual spacing and real interaction flow.

## Package integrity
- Full replacement package contains **30 files**.
- ZIP archive integrity test: **PASS** — no compressed-data errors detected.
- Uncompressed package size: **11,071,578 bytes**.
