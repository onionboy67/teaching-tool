/* ============================================================
   TEACHER HQ — LESSONS FEATURE MODULE v18
   Extracted from mega-features.js.
   Owns: Lesson hub, stand-alone Lessons, Unit attachment,
   reusable Saved Contexts.
============================================================ */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  if (!hq?.coreReady) throw new Error("Teacher HQ core must load before feature modules.");

  const $id = id => document.getElementById(id);
  const clone = value => typeof structuredCloneSafe === "function"
    ? structuredCloneSafe(value)
    : JSON.parse(JSON.stringify(value));
  const registry = () => window.TeacherHQRegistry;
  const allGrades = () => ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"];
  const unitIsStandalone = unit => Boolean(unit?.isStandaloneContainer);
  const normalUnits = (user = getActiveUser()) => (user?.units || []).filter(unit => !unitIsStandalone(unit));
  const standaloneUnits = (user = getActiveUser()) => (user?.units || []).filter(unitIsStandalone);
  const standaloneLessonFromUnit = unit => unit?.lessons?.[0] || null;

  function lessonTitle(unit, lesson) {
    return typeof lessonDisplayTitleForUnit === "function"
      ? lessonDisplayTitleForUnit(unit, lesson)
      : (lesson.customTitle ? `${lesson.sequence} - ${lesson.customTitle}` : `Lesson ${lesson.sequence}`);
  }

  function createLessonHubDialog() {
    let dialog = $id("lessonPlannerHubDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "lessonPlannerHubDialog";
    dialog.className = "modal extra-large-modal lesson-hub-dialog";
    dialog.innerHTML = `<div class="modal-content"><div class="modal-heading"><div><p class="small-label">Teacher HQ</p><h2>Lesson Planner</h2><p class="section-subtitle">Open an existing Unit lesson or create a stand-alone lesson that can be attached to a Unit later.</p></div><button type="button" class="close-button" data-close>×</button></div><div class="lesson-hub-actions"><button type="button" class="primary-button" data-new>+ New Stand-Alone Lesson</button><button type="button" class="secondary-button" data-contexts>Saved Contexts</button></div><div data-list></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.querySelector("[data-new]").onclick = () => openStandaloneEditor(dialog);
    dialog.querySelector("[data-contexts]").onclick = () => openContextLibrary();
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function renderLessonHub(dialog) {
    const user = getActiveUser();
    const list = dialog.querySelector("[data-list]");
    list.innerHTML = "";
    if (!user) return;

    const normal = normalUnits(user).flatMap(unit =>
      (unit.lessons || []).map(lesson => ({ unit, lesson, standalone: false }))
    );
    const standalone = standaloneUnits(user)
      .map(unit => ({ unit, lesson: standaloneLessonFromUnit(unit), standalone: true }))
      .filter(item => item.lesson);
    const all = [...normal, ...standalone].sort((a, b) =>
      (a.lesson.dateKey || "").localeCompare(b.lesson.dateKey || "") ||
      (a.lesson.startTime || "").localeCompare(b.lesson.startTime || "")
    );

    if (!all.length) {
      list.innerHTML = '<div class="empty-state-card"><strong>No lessons yet.</strong><p>Create a Unit lesson or start with a stand-alone lesson.</p></div>';
      return;
    }

    const table = document.createElement("div");
    table.className = "lesson-hub-list";
    all.forEach(({ unit, lesson, standalone }) => {
      const row = document.createElement("article");
      row.className = "lesson-hub-row";
      row.style.setProperty("--unit-colour", unit.colour || "#61B6FF");
      row.innerHTML = `<button type="button" data-open><span>${escapeHTML(formatDate(lesson.dateKey))}</span><div><strong>${escapeHTML(lessonTitle(unit, lesson))}</strong><small>${standalone ? "Stand-Alone Lesson" : escapeHTML(unit.name)} · ${escapeHTML(classLabel(unit.classSpec))} · ${escapeHTML(formatTime(lesson.startTime))}</small></div></button>${standalone && !readOnlyMode ? '<button type="button" class="secondary-button" data-attach>Attach to Unit…</button>' : ""}`;
      row.querySelector("[data-open]").onclick = () => {
        dialog.close();
        window.TeacherHQLessonPlanner?.open(unit.id, lesson.id);
      };
      row.querySelector("[data-attach]")?.addEventListener("click", () => attachStandalonePrompt(unit, dialog));
      table.appendChild(row);
    });
    list.appendChild(table);
  }

  function openLessonHub() {
    if (readOnlyMode) return;
    const dialog = createLessonHubDialog();
    renderLessonHub(dialog);
    dialog.showModal();
  }

  function openStandaloneEditor(parentDialog = { close() {} }, initialDate = "") {
    const user = getActiveUser();
    if (!user) return;
    const classes = (user.classes || []).filter(item => !item.archivedAt);
    const classOptions = classes.map(item => {
      const cohort = window.TeacherHQClasses?.cohortForClass?.(user, item);
      return `<option value="${escapeHTML(item.id)}">${escapeHTML(cohort ? `${cohort.name} · ${item.name}` : item.name)}</option>`;
    }).join("");

    const dialog = document.createElement("dialog");
    dialog.className = "modal large-modal";
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><div><h2>New Stand-Alone Lesson</h2><p class="section-subtitle">A stand-alone lesson can use any loaded curriculum and can be attached to a Unit later.</p></div><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Class <small>(optional)</small></span><select data-class><option value="">Manual grade / subject</option>${classOptions}</select></label><div class="form-grid two-column-grid"><label class="form-field"><span>Grade</span><select data-grade>${allGrades().map(grade => `<option>${grade}</option>`).join("")}</select></label><label class="form-field"><span>Subject</span><input data-subject list="standaloneSubjectList" placeholder="Math" required/><datalist id="standaloneSubjectList">${[...(user.customSubjects || []), ...(registry()?.subjectsForGrade("Grade 4") || [])].map(subject => `<option value="${escapeHTML(subject)}"></option>`).join("")}</datalist></label></div><button type="button" class="calendar-selection-button" data-date><span>▦</span><div><strong>Choose Lesson Date</strong><small data-date-label>${initialDate ? escapeHTML(formatLongDate(initialDate)) : "No date selected"}</small></div></button><input type="hidden" data-date-value value="${escapeHTML(initialDate)}"/><div class="form-grid two-column-grid"><label class="form-field"><span>Start Time</span><input data-start type="time" value="08:00" required/></label><label class="form-field"><span>End Time</span><input data-end type="time" value="09:00" required/></label></div><label class="form-field"><span>Lesson Title <small>(optional)</small></span><input data-title placeholder="Lesson title"/></label><div class="modal-actions"><button type="button" class="secondary-button" data-cancel>Cancel</button><button class="primary-button" type="submit">Create Lesson</button></div></form>`;
    document.body.appendChild(dialog);

    const form = dialog.querySelector("form");
    const classSelect = form.querySelector("[data-class]");
    const grade = form.querySelector("[data-grade]");
    const subject = form.querySelector("[data-subject]");

    const syncClass = () => {
      const item = classes.find(classItem => classItem.id === classSelect.value);
      if (item) {
        grade.value = item.grades?.[0] || "Grade 4";
        subject.value = item.subject || "";
      }
    };
    classSelect.onchange = syncClass;

    form.querySelector("[data-date]").onclick = () => window.TeacherHQCalendar?.openPicker({
      title: "Choose Stand-Alone Lesson Date",
      subtitle: "Choose any date inside a School Term. Existing class lessons remain visible.",
      user,
      classSpec: classes.find(item => item.id === classSelect.value)
        ? {
            grades: classes.find(item => item.id === classSelect.value).grades,
            subject: classes.find(item => item.id === classSelect.value).subject
          }
        : { grades: [grade.value], subject: subject.value },
      allowRange: false,
      isDateAllowed: key => termsForDate(key, user).length > 0,
      onSelect: ({ startDate }) => {
        form.querySelector("[data-date-value]").value = startDate;
        form.querySelector("[data-date-label]").textContent = formatLongDate(startDate);
        const selectedClass = classes.find(item => item.id === classSelect.value);
        const spec = selectedClass
          ? { grades: selectedClass.grades, subject: selectedClass.subject }
          : { grades: [grade.value], subject: subject.value };
        const occurrences = getOccurrencesForDate(parseLocalDate(startDate), user)
          .filter(item => classMatches(item.block, spec));
        if (occurrences[0]) {
          form.querySelector("[data-start]").value = occurrences[0].block.startTime;
          form.querySelector("[data-end]").value = occurrences[0].block.endTime;
        }
      }
    });

    const close = () => { dialog.close(); dialog.remove(); };
    form.querySelector("[data-close]").onclick = close;
    form.querySelector("[data-cancel]").onclick = close;
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });

    form.onsubmit = event => {
      event.preventDefault();
      const dateKey = form.querySelector("[data-date-value]").value;
      const start = form.querySelector("[data-start]").value;
      const end = form.querySelector("[data-end]").value;
      if (!dateKey || !subject.value.trim() || !start || !end) {
        return alert("Choose a date, subject, start time, and end time.");
      }

      const item = classes.find(classItem => classItem.id === classSelect.value);
      const classSpec = item
        ? { grades: clone(item.grades), subject: item.subject }
        : { grades: [grade.value], subject: subject.value.trim() };
      const minutes = durationMinutes(start, end);
      if (minutes <= 0) return alert("End time must be after start time.");

      const lesson = normalizeLesson({
        id: makeId("lesson"),
        sequence: 1,
        title: "Lesson 1",
        customTitle: form.querySelector("[data-title]").value.trim(),
        dateKey,
        startTime: start,
        endTime: end,
        durationMinutes: minutes,
        classSpec,
        lessonPlanStatus: "placeholder",
        locked: true,
        createdAt: new Date().toISOString()
      });
      const unit = normalizeUnit({
        id: makeId("standalone"),
        name: "Stand-Alone Lesson",
        isStandaloneContainer: true,
        standaloneMeta: { browseGrade: classSpec.grades[0] || "Grade 4", browseSubject: classSpec.subject },
        classId: item?.id || "",
        classSpec,
        colour: item?.colour || "#61B6FF",
        targetMinutes: minutes,
        startDate: dateKey,
        lessons: [lesson],
        curriculumLinks: { working: [], prerequisite: [], lookingAhead: [], crossCurricular: [] },
        workspace: {}
      });
      user.units.push(unit);
      saveData();
      close();
      parentDialog.close();
      window.TeacherHQLessonPlanner?.open(unit.id, lesson.id);
    };
    dialog.showModal();
  }

  function attachStandalonePrompt(standaloneUnit, parentDialog) {
    const user = getActiveUser();
    const lesson = standaloneLessonFromUnit(standaloneUnit);
    if (!user || !lesson) return;
    const units = normalUnits(user).filter(unit => classKey(unit.classSpec) === classKey(standaloneUnit.classSpec));
    if (!units.length) return alert("Create a Unit for this grade/subject first, then attach the stand-alone lesson.");

    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><h2>Attach Lesson to Unit</h2><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Unit</span><select data-unit>${units.map(unit => `<option value="${escapeHTML(unit.id)}">${escapeHTML(unit.name)}</option>`).join("")}</select></label><p class="section-subtitle">The Lesson keeps its current date, title, planning content, and selected curriculum. Selected subject curriculum can be added to the Unit's Working Curriculum.</p><label class="checkbox-row"><input type="checkbox" data-merge checked/><span>Add selected curriculum to Unit Working Curriculum</span></label><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">Attach Lesson</button></div></form>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll("[data-close]").forEach(button => {
      button.onclick = () => { dialog.close(); dialog.remove(); };
    });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const target = getUnitById(dialog.querySelector("[data-unit]").value, user);
      if (!target) return;
      const plan = standaloneUnit.workspace?.lessonPlans?.[lesson.id];
      target.lessons.push(clone(lesson));
      target.lessons.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime));
      target.lessons.forEach((item, index) => { item.sequence = index + 1; item.title = `Lesson ${index + 1}`; });
      target.workspace ||= {};
      target.workspace.lessonPlans ||= {};
      if (plan) target.workspace.lessonPlans[lesson.id] = clone(plan);
      if (dialog.querySelector("[data-merge]").checked) {
        const byId = new Map((target.curriculumLinks?.working || []).map(record => [record.id, record]));
        (standaloneUnit.curriculumLinks?.working || []).forEach(record => byId.set(record.id, clone(record)));
        target.curriculumLinks ||= { working: [], prerequisite: [], lookingAhead: [], crossCurricular: [] };
        target.curriculumLinks.working = [...byId.values()];
        target.selectedCurriculum = target.curriculumLinks.working.map(clone);
      }
      user.units = user.units.filter(unit => unit.id !== standaloneUnit.id);
      if (window.TeacherHQUnits?.saveUnit) window.TeacherHQUnits.saveUnit(target);
      else saveData();
      dialog.close();
      dialog.remove();
      parentDialog.close();
      window.TeacherHQLessonPlanner?.open(target.id, lesson.id);
    };
    dialog.showModal();
  }

  function openContextLibrary() {
    const user = getActiveUser();
    if (!user) return;
    user.savedContexts ||= [];
    const dialog = document.createElement("dialog");
    dialog.className = "modal large-modal";

    const draw = () => {
      dialog.innerHTML = `<div class="modal-content"><div class="modal-heading"><div><h2>Saved Contexts</h2><p class="section-subtitle">Reusable classroom descriptions available inside the Lesson Planner.</p></div><button class="close-button" type="button" data-close>×</button></div><div class="saved-context-list">${user.savedContexts.length ? user.savedContexts.map(item => `<article><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description || "")}</p></div><button type="button" class="danger-text-button" data-delete="${escapeHTML(item.id)}">Delete</button></article>`).join("") : '<div class="empty-state-card">No saved contexts yet.</div>'}</div></div>`;
      dialog.querySelector("[data-close]").onclick = () => { dialog.close(); dialog.remove(); };
      dialog.querySelectorAll("[data-delete]").forEach(button => {
        button.onclick = () => {
          const item = user.savedContexts.find(row => row.id === button.dataset.delete);
          if (!item || !confirm(`Move “${item.title}” to Trash?`)) return;
          window.TeacherHQTrash?.softDelete("context", item, { parent: "user.savedContexts" });
          user.savedContexts = user.savedContexts.filter(row => row.id !== item.id);
          saveData();
          draw();
        };
      });
    };

    draw();
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  function bindLessonHubButton() {
    const button = $id("openLessonPlannerHubButton");
    if (!button || button.dataset.teacherHqLessonsV18 === "true") return;
    button.dataset.teacherHqLessonsV18 = "true";
    button.addEventListener("click", openLessonHub);
  }

  const api = {
    openLessonHub,
    openStandaloneLesson: initialDate => openStandaloneEditor({ close() {} }, initialDate || ""),
    openContextLibrary,
    attachStandalonePrompt
  };

  hq.features.register({
    name: "lessons",
    dependencies: ["units", "trash"],
    description: "Lesson hub, stand-alone Lesson creation, Unit attachment and Saved Contexts.",
    owns: ["feature-lessons.js"],
    transitionalLegacyFiles: ["lesson-planner.js", "mega-features.js"],
    init(ctx) {
      window.TeacherHQLessons = api;
      bindLessonHubButton();
      ctx.events.emit("lessons:module:loaded", { transitional: true });
    }
  });
})();
