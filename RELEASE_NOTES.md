# Teacher HQ — Foundation Tracker Reset v18

## Purpose
This release establishes a shared, known baseline for foundation stabilization after GitHub deployment confusion. It deliberately does **not** include the abandoned architecture refactor.

## Development Tracker
- Added a private Development workspace directly in Teacher HQ.
- Added quick issue capture with Bug, Logic, UX, Missing Connection, Feature, Polish, and Unsure categories.
- Added Foundation blocker levels: Yes, Maybe/Discuss, and No/Future.
- Added workflow states: Inbox, Discussing, Approved, Done.
- Added Area tags for Overview, Profiles, Cohorts, Classes, Calendar, Units, Lessons, Curriculum, Assessments, Backup & Share, Trash, and Other.
- Added Observation, Expected Behaviour, and Proposed Solution fields.
- Added **Point to Problem** mode to attach structural element context to an issue.
- Added automatic structural context capture without automatically copying student/page text.
- Added Foundation Decision records with stable `D-###` IDs.
- Added search/filtering, edit/delete, status updates, and summary counts.
- Added AI Handoff export in JSON plus a human-readable Markdown export.
- Added AI Handoff import with merge/replace choices.
- Added tracker reset controls.
- Added Development Tracker access to both Teacher HQ and the dedicated Calendar View.

## Isolation / safety
- Tracker data is stored separately at `teacherHQDevelopmentTracker_v1`.
- Existing Teacher HQ profile/storage schema is unchanged.
- Existing curriculum datasets are not rewritten by this release.
- No failed v18 architecture modules/shims are included.

## Cache reset
- Main and Calendar View asset references are bumped from `?v=17` to `?v=18` so GitHub Pages/browser caches do not mix versions after the reset deployment.
