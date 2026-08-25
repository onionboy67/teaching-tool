# Teacher HQ — Code Map

Teacher HQ is a static GitHub Pages application with major systems separated into named modules for easier maintenance and debugging.

## Core application
- `index.html` — Teacher HQ dashboard and static dialogs.
- `styles.css` — core interface styles.
- `app.js` — core data model, profiles, School Terms, schedule history, Units, resources, Field Trips, Assessments, backups and Simulation workspace integration.

## Cohorts / Classes
- `classes.js` — Cohort + anonymous student model, two-digit student-code generation, optional nicknames, student interests/reminders, modular Cohort context, persistent Classes, Class editor/dashboard, archive state, curriculum coverage and Unit copying.
- Primary hierarchy: `Teacher HQ → Cohort → Class → Unit → Lesson`.
- Schedule blocks reference Classes; Classes reference Cohorts.

## Curriculum data
- `curriculum-data.js` — Math, Science, ELA and PE curriculum records.
- `fine-arts-data.js` — Art, Drama, Music and Arts Competency records.
- `social-studies-data.js` — Social Studies K–9 records.
- `career-curriculum-data.js` — Career Education & Financial Literacy Grades 7–9.
- `progressions-data.js` — Literacy, Numeracy, Career and Competency planning progressions.
- `bloom-data.js` — teacher-supplied Bloom verb reference.
- `data-registry.js` — unified lookup layer across curriculum/progression files.

## Curriculum / progression navigation
- `curriculum-browser.js` — stand-alone Curriculum Browser, split-grade view and Progression Browser. Trees begin collapsed.

## Calendar systems
- `calendar-tools.js` — Overview calendar, compact notification dock, Daily View, shared calendar picker, Daily Reflection, course colours and archived occurrence handling.
- `calendar.html` — enlarged Full Calendar page.
- `calendar-page.js` — Full Calendar logic, Class-ID-first event identity, archive markers and Cohort-interest reminder display.
- `calendar-page.css` — Full Calendar styles.

## Lesson / planning systems
- `lesson-planner.js` — Lesson Planner including Cohort Context inheritance/overrides, agendas, UDL, curriculum, assessments, reflection, Cognitive Tempo and lesson calendar.
- `lesson-planner.css` — Lesson Planner styles.
- `mega-features.js` — cross-system features such as stand-alone Lessons, reusable saved contexts, progression planning, Field Trip lesson shifting and 4-point rubric support.
- `mega-features.css` — newer UI components including Cohorts/Classes, notifications, archive states, grade/colour controls, calendars and rubric additions.

## Safety / deletion
- `trash.js` — six-month soft deletion, restore/permanent delete logic, Cohort/Class relationship restoration and deleted-user workspace support.

## Data philosophy
Curriculum and planning progressions are intentionally separate. Curriculum can participate in Unit/Lesson/Assessment coverage. Progression descriptors are planning supports with Develop / Practise / Observe intent.

Cohort is the student-group identity. Class is the course identity. School Terms describe when Classes meet; finishing a School Term does not delete its historical calendar.
