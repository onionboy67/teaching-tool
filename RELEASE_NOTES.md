# Teacher HQ — Combined E1–E4 Release Notes

## Curriculum / data
- Added Social Studies K–9.
- Added Career Education & Financial Literacy Grades 7–9.
- Added Literacy, Numeracy, Career and Competency progression datasets.
- Added unified curriculum/progression registry.
- Curriculum database total: 10,316 unique curriculum records.
- Progression database total: 380 unique progression records.
- Social Studies K contains only the authentic Organizing Ideas supplied in the source; missing detail is not invented.
- Grade 7 Career Education contains only the authentic Organizing Ideas supplied in the source; missing detail is not invented.

## Classes Taught
- Persistent Class records separate grade/subject identity from weekly schedule timing.
- Instructional schedule blocks may reference Classes.
- Class course colours are reusable on Overview / Full Calendar.
- Class Dashboard includes Calendar, Units, Lessons, Curriculum Progress, Assessments, Resources and Context.
- Coverage can distinguish Planned, Introduced, Developing, Taught, Assessed and Covered, with teacher override.

## Curriculum / progression navigation
- Curriculum lookup trees start collapsed.
- Split-grade Curriculum Browser supports 2–4 grades.
- Progression Browser exposes Literacy, Numeracy, Career and Competency frameworks.
- Lesson Planner combines these under one progression section with Develop / Practise / Observe intent.

## Calendar / Daily View
- Existing Overview Calendar remains on Teacher HQ.
- Full Calendar is a separate larger workspace.
- Overview notifications are collapsed into a notification dock.
- Overview instructional entries use readable one-line titles and course colours; unplanned items keep red attention styling.
- Daily View includes instructional/non-instructional timetable, relevant alerts and optional Daily Reflection.
- Shared calendar picker is reused by Assessment, Field Trip and stand-alone Lesson date workflows.
- Print-Friendly View and downloadable print-friendly HTML are standardized for new daily/lesson/rubric workflows.

## Units / Lessons / Field Trips / Assessments
- Unit Workspace begins with Calendar.
- Unit Lessons calendar preserves distinct Unit colours while needs-planning state is shown by a red outline.
- Field Trip date selection is calendar-based and can shift the replaced lesson plus subsequent Unit lessons into the next valid instructional blocks.
- Field Trip labels use a bus icon and no square-bracket text.
- Assessment date selection is calendar-based.
- Assessment history combines formative/summative records chronologically.
- Stand-alone Lessons can be created outside Units and later attached to a Unit.
- Saved Lesson Contexts provide reusable classroom descriptions.

## Rubrics
- Existing 1-point and 3-point systems remain.
- Added 4-point rubric: Starting / Developing / Meeting / Mastery.
- Rubric heading colours are teacher-editable and intended to correspond to Bloom progression.
- Curriculum references use a generalized stable/reference-friendly approach rather than assuming every subject has Math-style branch names.

## Resources / Indigenous Voices
- Resources no longer use the term “renewable resource.”
- Drive/cloud link field supported.
- Indigenous resource grade/subject tagging uses cleaner multi-select controls and supports custom grades/subjects.

## Deletion / Trash
- User-created records use soft-deletion where integrated.
- Trash items are retained for six months and can be restored or permanently removed.
- Deleted users are stored as whole-workspace snapshots for meaningful restoration.
- Expired trash is purged when Teacher HQ next runs; a static browser app cannot wake itself six months later.

## Known architecture boundary
Teacher HQ is still local-first and file-backup based. Local profile switching is not strong authentication. Real password-protected multi-device accounts should be implemented later with Firebase Authentication / a backend rather than pretending a local password protects browser storage.
