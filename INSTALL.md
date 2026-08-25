# Teacher HQ — Mega Update Installation

This is the combined E1–E4 release.

## Before replacing files
1. Download a fresh Teacher HQ backup from the currently working site.
2. Keep that backup outside the GitHub repository.
3. This release prioritizes the new production architecture; old testing data is not a design constraint, although migration code remains present.

## Install
Replace the matching files in the repository with every file from `TeacherHQ_Large_Update.zip`.

New JavaScript modules in this release include:
- `social-studies-data.js`
- `career-curriculum-data.js`
- `progressions-data.js`
- `data-registry.js`
- `classes.js`
- `curriculum-browser.js`
- `calendar-tools.js`
- `calendar-page.js`
- `trash.js`
- `mega-features.js`

New CSS modules include:
- `mega-features.css`
- `calendar-page.css`

Keep all existing filenames exactly as provided.

Suggested commit message:

`Build classes, curriculum progressions, full calendar and planning tools`

Then Commit & Push, wait for GitHub Pages to deploy, and refresh the site normally.

## First smoke test
1. Create/select a user.
2. Create a Class under **Classes Taught**.
3. Add a School Term and an Instructional Time block tied to that Class.
4. Open Curriculum Browser and confirm branches begin collapsed.
5. Open Progression Browser and confirm the selected grade maps to the expected division.
6. Create a Unit for the Class and confirm the Class/Unit colour appears on calendars.
7. Open the Unit **Calendar** and **Lessons** tabs.
8. Create an Assessment and choose its date using the calendar picker.
9. Create a Field Trip and test the lesson-shift choice on an occupied lesson date.
10. Open **Full Calendar**, then click a date to open Daily View and enter a Daily Reflection.
11. Create a stand-alone Lesson from the main-page Lesson Planner.
12. Delete a test resource/lesson/unit and restore it from Trash.
13. Download a backup and Read View.

If one of these fails, keep the current backup and report which numbered smoke-test step failed.
