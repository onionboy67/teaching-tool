# Teacher HQ — Main Page & Curriculum Redesign

## Release focus
This release reorganizes the daily Teacher HQ workflow around a persistent navigation menu, an interactive Overview calendar, Cohort working dashboards, and a redesigned Curriculum Browser. It also formally separates **Hook** from **Attention Grabber**.

## Main page
- Added persistent left navigation in this order: Cohorts, Classes, Unit Planner, Curriculum Browser, Backup & Share, Trash.
- Kept the Overview calendar as the centre of the page.
- Moved `+ Add School Term` out of the calendar header.
- Added the right-side Overview action rail:
  - Notifications
  - + Add Lesson
  - + Days Off
  - Calendar View
- `+ Add Lesson` opens the stand-alone Lesson creator.
- `Calendar View` replaces the old Full Calendar wording.
- Backup & Share navigation scrolls to the existing backup/share workspace.

## Notifications
- Notifications are now presented as the central Overview notification hub.
- Old duplicate/legacy notification blocks remain hidden.
- Notification icons are larger, bold, and use the notification category colour.
- Planning notices no longer display the old “Only Instructional Time is counted” helper line.
- Student-interest reminders feed the same central hub.

## Interactive calendar + Daily View
- Clicking an Overview calendar date opens Daily View.
- Planned Lesson chips open their Lesson record/planner.
- Field Trips and Assessments in Daily View open their editors.
- Daily View can create:
  - a Lesson for the selected date
  - a custom Event
  - a custom Block
- Custom Events/Blocks are stored on the Daily Record and can be reopened/edited.

## Sub Day
- Added `Sub Day` to Days Off/calendar exceptions.
- A Sub Day does **not** cancel the instructional schedule.
- Lessons can still be planned normally on that date.
- Overview, Calendar View, Unit calendars, Daily View, and readable calendar output display a dedicated `SUB` indicator.

## Cohorts
- Cohort Dashboard now opens to **Students & Interests** by default.
- Added a first-class **Attention Grabbers** workspace.
- Attention Grabbers are reusable Cohort routines with a title and description.
- Added more visual Cohort curriculum progress cards across attached Classes.
- Added a Cohort assessment timeline aggregating assessments from attached Classes.
- Existing Student ## IDs, optional nicknames, interest tags/descriptions, individual complexities, context modules, and interest reminders remain intact.

## Hook vs Attention Grabber
- Lesson agenda opening activity is now called **Hook**.
- Legacy lesson data using the old `attention-grabber` agenda type is migrated in memory to `hook`.
- A Hook can optionally select a saved Cohort Attention Grabber.
- Selected Attention Grabbers and their descriptions are included in Lesson Print View.

## Unit Planner
- Class choices now display the Cohort and Class together, e.g. `Cohort 1 · Grade 4 Math`, so the Cohort + Class relationship is clear before creating a Unit.
- Existing Unit workspace features remain available for Resources, Indigenous Voices, Projects, Assessments, Field Trips, Lessons, simulations, and other planning data.

## Curriculum Browser
- Rebuilt the primary browser flow as:
  1. visual Grade buttons
  2. visual Subject buttons
  3. existing collapsible curriculum hierarchy
- Curriculum branches remain **collapsed by default**.
- Split Grade View now opens exactly two independent grade/subject panes.
- Progressions are now a mode inside the same Curriculum Browser rather than a separate conceptual destination.
- Progression mode includes Grade, Framework, and division override controls.

## Curriculum notes
- Teachers can attach a persistent personal note to a curriculum record.
- Notes are stored in the user profile by stable curriculum record ID; official curriculum data is never modified.
- When a noted curriculum record appears in Lesson Planner, the note is visible to the teacher.
- The teacher can choose **Show this note on the lesson plan**.
- Hiding a note for one Lesson does not delete the original curriculum note.
- Only explicitly visible notes are included in Lesson Print View.

## UI layer
- Added `main-page-redesign.css` for the new application frame, Overview action rail, Cohort workspace polish, Curriculum Browser, note UI, responsive layout, and alignment cleanup.
- Added `main-page-redesign.js` for Cohort navigation, quick stand-alone Lesson creation, and Backup & Share navigation.
- Cache version bumped to `?v=17` on both Teacher HQ and Calendar View pages.

## Deferred by design
A future **Design Review Mode** is intentionally not included in this release. The planned concept is to let the user identify an exact UI element, make temporary layout/spacing adjustments, and export a compact feedback description that can be converted into permanent CSS later.
