# Teacher HQ — Installation & Smoke Test

## Install on GitHub Pages
This package is a full replacement set. Use the same GitHub upload workflow that has been reliable for Teacher HQ:

1. Extract the ZIP locally.
2. Open the `onionboy67/teaching-tool` repository on github.com.
3. Choose **Add file → Upload files**.
4. Upload the extracted files themselves, not the ZIP.
5. Let files with matching names replace the existing versions and let the two new files be added:
   - `main-page-redesign.css`
   - `main-page-redesign.js`
6. Commit directly to `main`.
7. Wait for GitHub Pages to deploy, then refresh Teacher HQ normally.

Suggested commit message:

`Redesign Teacher HQ overview, cohorts and curriculum browser`

## Fast smoke test
1. Open a user profile and confirm the main page loads.
2. Confirm the persistent left menu shows Cohorts, Classes, Unit Planner, Curriculum Browser, Backup & Share, Trash.
3. Confirm the Overview right rail shows Notifications, Add Lesson, Days Off, Calendar View.
4. Click **Cohorts** and open a Cohort. Confirm it opens to Students & Interests and contains the Attention Grabbers, Curriculum Progress, and Assessments tabs.
5. Add an Attention Grabber such as `Clap Sequence`.
6. Open/create a Lesson, add a **Hook**, and confirm that Cohort Attention Grabber is selectable.
7. Click an Overview calendar date and confirm Daily View opens. Test `+ Lesson`, `+ Event`, and `+ Block`.
8. Add a **Sub Day** and confirm normal instructional lessons remain visible for that date along with the SUB indicator.
9. Open **Curriculum Browser**. Choose a Grade button, then a Subject button, and open curriculum branches.
10. Add a curriculum note, close/reopen the browser, and confirm the note remains.
11. Enable **Split grade view** and confirm two independent Grade → Subject → Curriculum panes appear.
12. Switch Curriculum Browser to **Progressions** and confirm progression browsing works.
13. Select a noted curriculum objective in Lesson Planner and confirm the teacher note appears with the `Show this note on the lesson plan` option.
14. Open Lesson Print View and confirm the note prints only when that option is selected.
15. Open **Backup & Share** from the left navigation and confirm it moves to the existing backup/share section.
16. Open **Calendar View** and confirm the dedicated calendar page loads.

## Important data note
Curriculum notes, custom daily Events/Blocks, Attention Grabbers, Cohorts, Classes, Lessons, and other planning data remain browser-local under the existing Teacher HQ storage architecture and are included in normal profile backup/share data according to the existing backup rules.
