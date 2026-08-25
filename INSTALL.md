# Teacher HQ — Foundation Tracker Reset v18

## Install on GitHub Pages
This is the new synchronization/reset package. It is designed for the same simple upload workflow used successfully for Teacher HQ.

1. Extract `TeacherHQ_Foundation_Reset_v18.zip` locally.
2. Open the `onionboy67/teaching-tool` repository on github.com.
3. Choose **Add file → Upload files**.
4. Upload **all extracted files from this ZIP**. Do not upload the ZIP itself.
5. Let matching files replace their existing versions and let the new Development Tracker/manifest files be added.
6. **Do not delete the repository first.** A small group of unchanged v17 runtime files was not part of the supplied reset upload and is intentionally preserved in-place on GitHub; `BUILD_MANIFEST.json` lists them.
7. Commit directly to `main` with:

   `Add development tracker and reset Teacher HQ baseline`

8. After GitHub Pages deploys, refresh Teacher HQ. The HTML uses `?v=18` asset keys to force fresh browser copies.

No manual HTML/code editing is required.

## Development Tracker smoke test
1. Open a Teacher HQ profile.
2. Confirm **Development** appears at the bottom of the left navigation.
3. Open it and create a test item in the Inbox.
4. Set it as a foundation blocker and confirm the summary count updates.
5. Choose **Point to Problem**, click a harmless control such as Curriculum Browser, and confirm structural context appears in the issue form.
6. Save the issue, refresh the page, and confirm it persists.
7. Add a Foundation Decision and confirm it receives a `D-###` ID.
8. Export **AI Handoff JSON** and **Readable Markdown**.
9. Open `calendar.html` and confirm the floating Development button can open the same tracker data.

## Existing Teacher HQ smoke test
Run the core v17 checks after deployment:
1. Profile selection and main Overview load.
2. Cohorts and Classes open.
3. Unit Planner opens and existing units remain available.
4. Lesson Planner opens.
5. Calendar Daily View and dedicated Calendar View open.
6. Curriculum Browser opens and curriculum notes remain available.
7. Backup & Share and Trash open.
8. Existing browser-local planning data remains intact.

## Data separation
The Development Tracker uses its own browser-local key: `teacherHQDevelopmentTracker_v1`. It is not stored inside the Teacher HQ profile schema and does not change `teacherHQData_v11`.
