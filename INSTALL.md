# Teacher HQ — Cohort Architecture Update Installation

This release is a full-file replacement package containing **28 files**.

## Before replacing files
1. Keep a fresh Teacher HQ backup from the currently working site if there is any data you want to retain.
2. Keep the backup outside the GitHub repository.
3. Existing test data is not a design constraint for this release; migration helpers remain for older Class records where practical.

## Install
Upload/replace **all 28 files** from this release in the repository root. Keep every filename exactly as provided.

The release includes the existing curriculum/data modules plus the updated application files. The main feature changes are concentrated in:
- `classes.js`
- `app.js`
- `lesson-planner.js`
- `calendar-tools.js`
- `calendar-page.js`
- `trash.js`
- `mega-features.css`
- `lesson-planner.css`
- `index.html`
- `calendar.html`

Asset cache-busting is set to `?v=16`.

Suggested commit message:

`Add cohorts, anonymous student profiles and class context`

After committing directly to `main`, wait for GitHub Pages to deploy, then refresh Teacher HQ normally.

## Focused smoke test
Run these one at a time:
1. Select/create a Teacher HQ user and confirm Overview loads.
2. Open **Manage Cohorts & Classes**. With no Cohorts, confirm there is one clear **Create Cohort** action and no redundant Add Class button.
3. Create a Cohort with 15 students. Confirm 15 anonymous Student ## profiles are generated and all two-digit codes are unique within that Cohort.
4. Open the Cohort dashboard. Add an optional nickname to one student, add an Interest tag + description, and add one individual Complexity item.
5. Add Culture, School Setting, Classroom Setting and Cohort-wide Complexity items. Set/confirm the normal classroom location.
6. Add a student-interest reminder for a date and selected Student ## IDs; confirm it appears in Overview notifications when due.
7. Create a Class linked to the Cohort. Leave Class Name blank and confirm a name such as `Grade 4 Math` is generated. Create a second matching Class for another Cohort and confirm numbering such as `Grade 4 Math - 2`.
8. Confirm the grade selector is readable, the colour preview updates, and Curriculum Assignment chips show titles without record counts.
9. Link an Instructional Time schedule block to the Class and confirm Overview/Full Calendar use the Class colour.
10. Create a Unit and Lesson. Open Lesson Planner and confirm Cohort Context is inherited, with a lesson-specific Classroom Setting override available.
11. Add student interests and enable **Use Cohort Interests for Inspiration** in the Unit Simulation workspace.
12. Copy a Unit to another Class and confirm the copy can be rescheduled/adapted without reusing old assessment/field-trip dates.
13. Mark a Class Finished and confirm historical calendar entries remain with a `✓` marker while active-planning alerts ignore it. Reactivate it.
14. Mark a School Term Finished and confirm its historical dates remain on the calendar with finished treatment. Reactivate it.
15. Mark a Cohort Finished and confirm it moves to Finished Cohorts and can be reactivated.
16. Confirm the Overview notification drawer says **Attention required**, has larger coloured `!` icons, contains no redundant second PD notification below it, and contains no “Only Instructional Time is counted” line.
