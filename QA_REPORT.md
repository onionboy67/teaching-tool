# Teacher HQ — Cohort Architecture Update QA Report

## Automated structural checks
- All JavaScript files pass `node --check` syntax validation.
- `index.html` contains no duplicate static HTML IDs.
- `calendar.html` contains no duplicate static HTML IDs.
- All static JavaScript/CSS references in `index.html` and `calendar.html` resolve to files in the release.
- `styles.css`, `lesson-planner.css`, `mega-features.css` and `calendar-page.css` have balanced block braces.
- Main/Full Calendar assets use cache version `?v=16`.

## Registry validation
Executed the included data files through the registry and verified:
- Curriculum records: **10,316**.
- Unique curriculum IDs: **10,316**.
- Progression records: **380**.
- Unique progression IDs: **380**.

Curriculum totals:
- Math: 1,754
- Science: 1,637
- ELA: 2,040
- PE: 1,179
- Fine Arts: 2,849
- Social Studies: 668
- Career Education & Financial Literacy: 189

Progression totals:
- Literacy: 94
- Numeracy: 113
- Competency: 141
- Career: 32

## Cohort/Class implementation checks
Static/integration audit confirms code paths for:
- `Cohort → Class → Unit → Lesson` hierarchy.
- Anonymous random two-digit student codes with uniqueness enforced within each Cohort and a maximum of 100 profiles.
- Optional student nicknames; no required legal-name field.
- Per-student Interest tags with optional descriptions.
- Per-student anonymous Complexity items.
- Dated student-interest reminders targeting selected Student IDs.
- Cohort context modules: Culture, School Setting, Classroom Setting and Complexities.
- Lesson Planner Cohort-context inheritance and lesson-level context selection/override.
- Simulation workspace opt-in for Cohort-interest inspiration.
- Class names optional with generated grade/subject fallback and numbered duplicate fallback.
- Split-grade / multi-subject class-name formatting.
- Compact Class colour control with live preview.
- Curriculum Assignment preview without record-count text.
- Unit copying between active Classes with destination reallocation and date-state cleanup.
- Finished/archive state for Cohorts, Classes and School Terms with reactivation.
- Calendar occurrence logic includes finished School Terms historically while active-attention logic excludes finished Classes/Terms.
- Class-ID-first matching in calendar integrations so two Cohorts taking the same course remain separate Classes.
- Trash integration for Cohorts and Classes.

## Notification revision checks
- Compact notification summary uses **Attention required**.
- Legacy notice elements, including the old PD alert, are hidden when the compact notification dock renders.
- Lesson-planning notification no longer contains the “Only Instructional Time is counted” detail.
- Notification `!` icons have enlarged/heavy styling and notification-type colours.
- Student-interest reminders are added to the Overview notification feed when due.

## Remaining validation boundary
This environment supports syntax, structure and integration audits but does not reproduce the user's deployed Safari/GitHub Pages browser state. The numbered smoke test in `INSTALL.md` should be used after deployment for interaction/visual verification.
