# Install Teacher HQ v18 Architecture Foundation

This is a **one-time architecture refactor**, not a whole-project replacement.

## 1. Extract the ZIP
Inside the folder are the new modular runtime files plus a replacement `mega-features.js`.

## 2. Upload the patch files to the repository root
Open `onionboy67/teaching-tool` on GitHub and use **Add file → Upload files**.

Upload:

- `architecture.js`
- `hq-core.js`
- `hq-legacy-bridge.js`
- `feature-overview.js`
- `feature-cohorts.js`
- `feature-classes.js`
- `feature-units.js`
- `feature-curriculum.js`
- `feature-lessons.js`
- `feature-calendar.js`
- `feature-backup.js`
- `feature-trash.js`
- `mega-features.js` **(replace the existing file)**
- `ARCHITECTURE.md`
- `PATCHING_GUIDE.md`
- `CHANGE_MANIFEST.md`

You may also upload this instruction file and `SHA256SUMS.txt` if you want them retained in the repo.

## 3. Make one tiny edit to `index.html`
The current v17 page ends with `mega-features.js`, then `main-page-redesign.js`.

Change the existing `mega-features.js` cache tag from `?v=17` to `?v=18`, then add the architecture loader **after `main-page-redesign.js` and before `</body>`**:

```html
<script src="mega-features.js?v=18"></script>
<script src="main-page-redesign.js?v=17"></script>
<script src="architecture.js?v=18"></script>
</body>
```

Do not remove or reorder the other existing scripts.

## 4. Commit
Suggested commit message:

`Refactor Teacher HQ into feature-scoped modules`

## 5. Smoke test
After GitHub Pages deploys:

1. Open a profile and confirm Teacher HQ looks unchanged.
2. Open Cohorts and Classes.
3. Open a Unit and test Progressions, Assessments, Field Trips and Delete Unit.
4. Open Lesson Planner / Lesson Hub and create a stand-alone Lesson.
5. Test Saved Contexts.
6. Open Trash and confirm deleted-user handling is still present.
7. Open Curriculum Browser and Calendar / Daily View.
8. Confirm Backup & Share still opens.
9. In the browser console, run:

```js
TeacherHQArchitecture.debug.summary()
```

It should report nine initialized features: units, trash, lessons, cohorts, classes, curriculum, calendar, backup and overview.

## Rollback
If the architecture layer causes a problem:

1. Remove `<script src="architecture.js?v=18"></script>` from `index.html`.
2. Restore the previous v17 `mega-features.js` from GitHub history.

No data rollback is required because this patch does not migrate saved data.
