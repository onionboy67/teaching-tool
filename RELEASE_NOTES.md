# Teacher HQ — Cohort Architecture Update

## Core terminology / hierarchy
Teacher HQ now uses the planning hierarchy:

`Teacher HQ → Cohort → Class → Unit → Lesson`

- **Cohort** = a particular collection of students.
- **Class** = a course/subject taught to one Cohort. A Class may use one or more grades and one or more subjects.
- **Unit** = a collection of Lessons inside a Class.
- **Lesson** = one planned instructional period from a Unit for a Cohort.

This separates the student group from the course being taught and allows two Cohorts to take the same course as separate Classes with independent pacing, assessment and curriculum coverage.

## Cohorts / student profiles
- Added Cohort management alongside Classes.
- Creating a Cohort can generate 0–100 anonymous student profiles.
- Each generated student receives a unique random two-digit code (`00`–`99`) within that Cohort.
- Student legal names are not required or generated.
- Optional nickname field is available for local use.
- Cohort setup can be copied to create a new context without copying student identities/interests.
- Cohorts can be marked **Finished**, remain available historically, and can later be reactivated.

## Student interests
- Each anonymous student can have reusable interest tags.
- Clicking an interest tag allows an optional description to be stored with it.
- Cohort dashboards show interest data without requiring real student names.
- Added manual **student-interest reminders**: choose a date, one or more anonymous student IDs, and a reminder message.
- Due interest reminders appear in the Overview notification system.
- Simulation planning can optionally use Cohort interest patterns as inspiration without automatically dictating a simulation.

## Cohort context
Added modular point-form context sections:
- Culture
- School Setting
- Classroom Setting
- Complexities

Context entries are reusable modular items rather than one large text field. Classroom Setting supports a usual/default location plus saved alternatives. Lesson Planner inherits the Cohort context and allows a lesson-specific override when the context differs (for example, using the computer lab instead of the usual classroom).

Individual students can also carry their own anonymous Complexity items separately from Cohort-wide environmental/context factors.

## Classes
- Every Class is linked to a Cohort.
- Class name is optional.
- If no name is entered, Teacher HQ generates a readable name from grade(s) and subject(s), e.g. `Grade 4 Math`.
- Duplicate generated names are automatically numbered, e.g. `Grade 4 Math - 2`.
- Split-grade names use compact labels such as `Grade 4/5 Math`.
- Multiple-subject Classes can use labels such as `Grade 4 Math + Science`.
- Redesigned grade selection UI.
- Course colour control is compact, positioned with the Class title, and includes a live colour preview.
- Curriculum Assignment now shows clean curriculum titles only; record-count clutter was removed.
- Spacing was improved for multiple curriculum assignments.
- Empty-state Class management no longer shows a redundant non-working Add Class button.
- Classes can be copied, marked Finished, reactivated, or deleted to Trash.

## Unit reuse between Classes
- A Unit can be copied to the same or another active Class.
- Planning content, curriculum, rubrics, resources and lesson-plan structure are copied.
- The copied Unit is reallocated into the destination Class's valid instructional blocks from a chosen start date.
- Old Field Trip and Assessment dates are cleared so copied Units can be adapted safely to the new Cohort/context.
- Lesson reflections/completion state are reset in the copy.

## Finished / archive behaviour
- **Cohorts**, **Classes**, and **School Terms** can be marked Finished rather than deleted.
- Finished Classes/School Terms remain visible in historical calendars and use a `✓` finished marker.
- Finished records are separated from normal active planning views but remain openable where appropriate.
- Reactivation is supported.
- Archive/Finished is separate from Trash: archived records are valid historical work, while Trash is for deletion.

## Overview notifications
- Removed the redundant second PD-Day notification display under the compact notification system.
- Notification summary now uses the generic text **Attention required**.
- Removed the unnecessary “Only Instructional Time is counted” text from the lesson-planning alert.
- Exclamation icons are larger, heavier, and coloured by notification type.
- Student-interest reminders participate in the same compact notification drawer.

## Calendar integration
- Class identity is Class-ID-first, so two Cohorts taking the same subject do not collapse into one course identity.
- Finished Class/School Term occurrences remain in historical calendars and receive a finished marker.
- Active-planning notification counts ignore finished Classes and School Terms.
- Existing Overview Calendar remains; Full Calendar remains the larger calendar workspace.

## Existing curriculum / progression content retained
- Curriculum registry: **10,316 unique curriculum records**.
- Progression registry: **380 unique progression records**.
- Existing Math, Science, ELA, PE, Fine Arts, Social Studies, Career Education & Financial Literacy, Literacy, Numeracy, Competency and Career progression data remain included.

## Local-data boundary
Teacher HQ remains local-first and file-backup based. Anonymous Student ## codes are intended to let the teacher maintain any real-world identity key separately. Optional nicknames are local data; Teacher HQ does not require them.
