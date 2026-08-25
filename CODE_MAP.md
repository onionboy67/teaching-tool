# Teacher HQ — Code Map

## Main application
- `index.html` — Teacher HQ profile selection, persistent left navigation, Overview calendar/right action rail, Backup & Share section, dialogs.
- `styles.css` — core application styles.
- `app.js` — storage, users, School Terms, schedules, Days Off/Sub Days, Units, workspace logic, backups/read views, core helpers.
- `main-page-redesign.css` — release-specific main page, notification, Cohort, curriculum-browser and responsive UI layer.
- `main-page-redesign.js` — persistent-navigation and quick-action wiring.

## Cohorts / Classes
- `classes.js` — Cohort → Class architecture; anonymous Student ## profiles; nicknames; interests; individual complexities; Cohort context; Attention Grabbers; interest reminders; Class setup; curriculum coverage; Cohort dashboards; Unit grouping/copy support.

## Lesson Planner
- `lesson-planner.js` — living Lesson Planner; curriculum selection; persistent curriculum-note visibility; Objectives; Assessments; Observations; Hook/Agenda; Cohort Attention Grabber selection; UDL; Indigenous Voices; Reflection; print output.
- `lesson-planner.css` — Lesson Planner styles.

## Calendar
- `calendar-tools.js` — Overview calendar renderer, central notifications, Daily View, custom Daily Events/Blocks, shared calendar picker, course colours, Sub Day display.
- `calendar.html` — dedicated **Calendar View** page.
- `calendar-page.js` — Calendar View logic, filters, archive markers, Sub Days, Daily View content.
- `calendar-page.css` — Calendar View styles.

## Curriculum / progressions
- `data-registry.js` — unified curriculum/progression registry.
- `curriculum-browser.js` — hierarchy-agnostic collapsed curriculum renderer, visual Grade/Subject browser, two-pane Split Grade View, integrated Progressions mode, persistent teacher curriculum notes.
- `curriculum-data.js` — Math, Science, ELA, PE curriculum records.
- `fine-arts-data.js` — Fine Arts curriculum records.
- `social-studies-data.js` — Social Studies curriculum records.
- `career-curriculum-data.js` — Career Education & Financial Literacy curriculum records.
- `progressions-data.js` — Literacy, Numeracy, Competency and Career progression records.
- `bloom-data.js` — Bloom verb/reference data.

## Other feature layers
- `mega-features.js` — stand-alone Lessons, Lesson hub, saved contexts, Field Trip shifting, assessment/rubric enhancements, deleted-user support and other cross-feature integrations.
- `mega-features.css` — shared feature styling from the previous large release.
- `trash.js` — soft-delete, restore, permanent delete and six-month Trash logic.

## Validation/reference files
- `data-validation.json`
- `ela-pe-curriculum-validation.md`
- `fine-arts-curriculum-validation.md`
- `QA_REPORT.md`
- `RELEASE_NOTES.md`
- `INSTALL.md`
