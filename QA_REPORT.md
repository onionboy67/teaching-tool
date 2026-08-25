# Teacher HQ — QA Report

## Release
Foundation Tracker Reset v18

## Automated/static checks performed
- JavaScript syntax checked with Node `--check` across all **12 packaged JavaScript files**: **PASS**.
- `index.html` duplicate ID scan: **PASS**.
- `calendar.html` duplicate ID scan: **PASS**.
- HTML local JS/CSS reference scan: **PASS**, using the verified v17 preserved-runtime allowlist documented in `BUILD_MANIFEST.json`.
- `data-validation.json` parse check: **PASS**.
- CSS brace-balance scan across all **3 packaged CSS files**: **PASS**.
- Failed Architecture Foundation v18 runtime-name/reference scan: **PASS** — no abandoned architecture runtime references are present.
- Main and Calendar View cache references: **PASS** — both use `?v=18`.

## Development Tracker integration checks
- `development-tracker.js` syntax: **PASS**.
- Tracker storage is isolated at `teacherHQDevelopmentTracker_v1`; Teacher HQ `teacherHQData_v11` is not modified by the tracker.
- Main-page access is dynamically appended to the existing `.hq-nav-list` when available.
- Calendar View uses the floating Development fallback.
- Point-to-Problem mode captures structural metadata (page/dialog/container/element identifiers, control metadata and structural path) rather than automatically copying visible student/page text.
- JSON and Markdown handoff export routines are present.
- JSON handoff import supports merge/replace.
- Foundation Decision records use stable `D-###` identifiers.

## Baseline integrity
- Files supplied by the user on 2026-08-25 are authoritative wherever present in this package.
- The failed Architecture Foundation v18 package is not used as a runtime source.
- Eight unchanged v17 runtime files that were not included in the user's supplied reset set are intentionally preserved in the existing GitHub repository rather than recreated or guessed. They are listed in `BUILD_MANIFEST.json`.

## Browser-runtime note
A full browser automation harness is not bundled with this static GitHub Pages project. Run the smoke test in `INSTALL.md` after deployment, especially Development Tracker persistence, Point-to-Problem selection, exports, and the core Teacher HQ navigation paths.
