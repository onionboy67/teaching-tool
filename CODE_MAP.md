# Teacher HQ — Code Map

Teacher HQ is still a static GitHub Pages application, but major systems are now split into named modules to make long-term maintenance and debugging practical.

## Core application
- `index.html` — Teacher HQ dashboard and static dialogs.
- `styles.css` — long-lived/core interface styles.
- `app.js` — legacy/core data model, School Terms, schedule occurrences, Unit Planner, resources, Field Trips, Assessments and backups.

## Curriculum data
- `curriculum-data.js` — Math, Science, ELA and PE curriculum records.
- `fine-arts-data.js` — Art, Drama, Music and Arts Competency records.
- `social-studies-data.js` — Social Studies K–9 records.
- `career-curriculum-data.js` — Career Education & Financial Literacy Grades 7–9.
- `progressions-data.js` — Literacy, Numeracy, Career and Competency planning progressions.
- `bloom-data.js` — teacher-supplied Bloom verb reference.
- `data-registry.js` — unified lookup layer so application logic does not care which physical file owns a curriculum record.

## Class / curriculum navigation
- `classes.js` — persistent Classes Taught, schedule-to-Class linking, Class Dashboard and curriculum coverage calculations.
- `curriculum-browser.js` — stand-alone Curriculum Browser, split-grade view and Progression Browser. Branches are lazy/collapsed by default.

## Calendar systems
- `calendar-tools.js` — rich Overview calendar, compact notification dock, Daily View, shared calendar picker, daily reflection and course colour utilities.
- `calendar.html` — enlarged Full Calendar page; does not replace Overview.
- `calendar-page.js` — self-contained Full Calendar logic using the same stored Teacher HQ data.
- `calendar-page.css` — Full Calendar styles.

## Lesson / planning systems
- `lesson-planner.js` — living Lesson Planner, agendas, UDL, curriculum, assessments, reflection, Cognitive Tempo and lesson calendar.
- `lesson-planner.css` — Lesson Planner styles.
- `mega-features.js` — cross-system integration: stand-alone lessons, reusable saved contexts, progression planning, Field Trip lesson shifting, 4-point rubric additions and final dashboard enhancements.
- `mega-features.css` — styles for Classes, Browsers, Trash, enhanced calendars, rubric additions and other newer UI components.

## Safety / deletion
- `trash.js` — six-month soft deletion, restore/permanent delete logic and deleted-user workspace support.

## Data philosophy
Curriculum and planning-progressions are intentionally different types of records. Curriculum can participate in Unit/Lesson/Assessment coverage. Progression descriptors are planning supports and can be tagged Develop / Practise / Observe without pretending they are separate programs of study.

The primary navigation/data hierarchy is now:

`Teacher HQ → Class → Unit → Lesson`

School Terms describe when Classes meet; changing a School Term should not redefine the Class itself.
