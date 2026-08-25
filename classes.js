/* ============================================================
   TEACHER HQ — CLASSES TAUGHT
   ------------------------------------------------------------
   A Class is the durable layer between Teacher HQ and Units.
   Schedules reference a class; schedules may change by Term without
   changing the class, curriculum coverage, units, or lesson history.

   This file intentionally contains no curriculum source data. It asks
   TeacherHQRegistry for curriculum so new subjects can be added without
   rewriting this feature.
============================================================ */
(function () {
  "use strict";

  const COLOUR_POOL = [
    "#FF5F8F", "#8C6CFF", "#33C7FF", "#39D98A", "#FFB347", "#F04FCB",
    "#6EDB3F", "#FF7043", "#00B8D9", "#FFC93C", "#A45CFF", "#00C48C",
    "#FF4D6D", "#5B8CFF", "#FF8A3D", "#2DD4BF", "#C45CFF", "#A6E22E"
  ];

  const $id = id => document.getElementById(id);
  const registry = () => window.TeacherHQRegistry || null;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function sameText(a, b) {
    return clean(a).toLowerCase() === clean(b).toLowerCase();
  }

  /** Return a highly readable foreground for a user-selected background. */
  function contrastText(background) {
    const hex = String(background || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return "#17171A";
    const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(value =>
      value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
    );
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance > 0.48 ? "#17171A" : "#FFFFFF";
  }

  function normalizeGrades(grades) {
    return [...new Set((grades || []).map(clean).filter(Boolean))];
  }

  function formatGrades(grades) {
    const list = normalizeGrades(grades);
    if (!list.length) return "No grade";
    if (list.length === 1) return list[0];
    const numeric = list.map(item => item.match(/Grade\s+(\d+)/i)?.[1]).filter(Boolean);
    if (numeric.length === list.length) return `Grade ${numeric.join("/")}`;
    return list.join(" / ");
  }

  function suggestedName(grades, subject) {
    return `${formatGrades(grades)} ${clean(subject)}`.trim();
  }

  function nextColour(user, ignoreId = "") {
    const used = new Set((user.classes || [])
      .filter(item => item.id !== ignoreId)
      .map(item => String(item.colour || "").toUpperCase()));
    return COLOUR_POOL.find(colour => !used.has(colour.toUpperCase())) || COLOUR_POOL[(user.classes || []).length % COLOUR_POOL.length];
  }

  function normalizeClass(item, user) {
    const grades = normalizeGrades(item?.grades);
    const subject = clean(item?.subject);
    const assignments = Array.isArray(item?.curriculumAssignments) && item.curriculumAssignments.length
      ? item.curriculumAssignments.map(entry => ({ grade: clean(entry.grade), subject: clean(entry.subject || subject) })).filter(entry => entry.grade && entry.subject)
      : grades.map(grade => ({ grade, subject })).filter(entry => entry.subject);
    return {
      id: item?.id || makeId("class"),
      name: clean(item?.name) || suggestedName(grades, subject) || "Class",
      grades,
      subject,
      studentCount: Math.max(0, Number(item?.studentCount) || 0),
      description: String(item?.description || ""),
      notes: String(item?.notes || ""),
      colour: normalizeHexColour?.(item?.colour) || item?.colour || nextColour(user || { classes: [] }, item?.id),
      curriculumAssignments: assignments,
      coverageOverrides: item?.coverageOverrides && typeof item.coverageOverrides === "object" ? { ...item.coverageOverrides } : {},
      createdAt: item?.createdAt || new Date().toISOString(),
      updatedAt: item?.updatedAt || new Date().toISOString()
    };
  }

  function ensureClasses(user) {
    if (!user) return [];
    if (!Array.isArray(user.classes)) user.classes = [];
    user.classes = user.classes.map(item => normalizeClass(item, user));

    // If this is a freshly upgraded test workspace, infer classes from the
    // existing schedule so the class layer does not require re-entry.
    const knownKeys = new Set(user.classes.map(item => classKey({ grades: item.grades, subject: item.subject })));
    const inferred = new Map();
    (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => {
      (version.scheduleBlocks || []).filter(block => block.blockType === "Instructional Time").forEach(block => {
        const grades = normalizeGrades(block.grades);
        const subject = clean(block.subject);
        if (!grades.length || !subject) return;
        const key = classKey({ grades, subject });
        if (!knownKeys.has(key)) inferred.set(key, { grades, subject });
      });
    }));
    (user.units || []).forEach(unit => {
      const grades = normalizeGrades(unit.classSpec?.grades);
      const subject = clean(unit.classSpec?.subject);
      if (!grades.length || !subject) return;
      const key = classKey({ grades, subject });
      if (!knownKeys.has(key)) inferred.set(key, { grades, subject });
    });

    inferred.forEach(spec => {
      const created = normalizeClass({ grades: spec.grades, subject: spec.subject }, user);
      user.classes.push(created);
      knownKeys.add(classKey(spec));
    });

    // Attach schedule blocks and units that pre-date the class layer.
    user.classes.forEach(item => {
      const key = classKey({ grades: item.grades, subject: item.subject });
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => {
        (version.scheduleBlocks || []).forEach(block => {
          if (block.blockType !== "Instructional Time" || block.classId) return;
          if (classKey({ grades: block.grades, subject: block.subject }) === key) block.classId = item.id;
        });
      }));
      (user.units || []).forEach(unit => {
        if (!unit.classId && classKey(unit.classSpec || {}) === key) unit.classId = item.id;
      });
    });
    return user.classes;
  }

  function classById(user, id) {
    return ensureClasses(user).find(item => item.id === id) || null;
  }

  function recordsForClass(teachingClass) {
    const reg = registry();
    if (!reg || !teachingClass) return [];
    const map = new Map();
    const assignments = teachingClass.curriculumAssignments?.length
      ? teachingClass.curriculumAssignments
      : teachingClass.grades.map(grade => ({ grade, subject: teachingClass.subject }));
    assignments.forEach(entry => reg.curriculumFor(entry.grade, entry.subject).forEach(record => map.set(record.id, record)));
    return [...map.values()];
  }

  function unitsForClass(user, teachingClass) {
    if (!teachingClass) return [];
    const key = classKey({ grades: teachingClass.grades, subject: teachingClass.subject });
    return (user.units || []).filter(unit => unit.classId === teachingClass.id || classKey(unit.classSpec || {}) === key);
  }

  function curriculumCoverage(user, teachingClass) {
    const records = recordsForClass(teachingClass);
    const ids = new Set(records.map(record => record.id));
    const planned = new Set();
    const introduced = new Set();
    const developing = new Set();
    const taught = new Set();
    const assessed = new Set();
    const lessonUseCounts = new Map();
    const units = unitsForClass(user, teachingClass);

    units.forEach(unit => {
      (unit.curriculumLinks?.working || unit.selectedCurriculum || []).forEach(record => ids.has(record.id) && planned.add(record.id));
      const plans = unit.workspace?.lessonPlans || {};
      (unit.lessons || []).forEach(lesson => {
        const plan = plans[lesson.id];
        const todayIds = plan?.curriculum?.todayIds || [];
        todayIds.forEach(id => {
          if (!ids.has(id)) return;
          introduced.add(id);
          lessonUseCounts.set(id, (lessonUseCounts.get(id) || 0) + 1);
          if (plan?.complete) taught.add(id);
        });
      });
      (unit.workspace?.assessments || []).filter(item => item.status !== "draft").forEach(assessment => {
        (assessment.curriculumIds || []).forEach(id => ids.has(id) && assessed.add(id));
      });
    });

    lessonUseCounts.forEach((count, id) => {
      if (count >= 2 && !taught.has(id)) developing.add(id);
    });

    const override = teachingClass.coverageOverrides || {};
    Object.entries(override).forEach(([id, status]) => {
      if (!ids.has(id)) return;
      if (["planned", "introduced", "developing", "taught", "assessed", "covered"].includes(status)) planned.add(id);
      if (["introduced", "developing", "taught", "assessed", "covered"].includes(status)) introduced.add(id);
      if (["developing", "taught", "assessed", "covered"].includes(status)) developing.add(id);
      if (["taught", "covered"].includes(status)) taught.add(id);
      if (["assessed", "covered"].includes(status)) assessed.add(id);
    });

    const addressed = new Set([...planned, ...introduced, ...taught, ...assessed]);
    const covered = new Set([...taught].filter(id => assessed.has(id)));
    const total = records.length;
    const pct = set => total ? Math.round((set.size / total) * 100) : 0;
    return {
      records, total, planned, introduced, developing, taught, assessed, addressed, covered,
      addressedPct: pct(addressed), taughtPct: pct(taught), assessedPct: pct(assessed), coveredPct: pct(covered)
    };
  }

  function createDialog() {
    let dialog = $id("classesDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "classesDialog";
    dialog.className = "modal extra-large-modal classes-dialog";
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-heading"><div><h2>Classes Taught</h2><p class="section-subtitle">Classes persist across School Terms. Schedule changes change availability, not the class record.</p></div><button type="button" class="close-button" data-class-close>×</button></div>
        <div class="class-manager-layout">
          <div><div class="section-heading-row compact-heading-row"><div><h3>Your Classes</h3><p class="section-subtitle">Select one to edit or view curriculum coverage.</p></div><button class="primary-button" type="button" data-class-new>+ Add Class</button></div><div data-class-list class="class-manager-list"></div></div>
          <form data-class-form class="class-editor-card hidden">
            <input type="hidden" data-class-id />
            <div class="section-heading-row"><div><p class="small-label">Class</p><h3 data-class-editor-title>New Class</h3></div><button type="button" class="danger-text-button" data-class-delete>Delete</button></div>
            <label class="form-field"><span>Class Name</span><input data-class-name required maxlength="80" placeholder="Grade 4 Math" /></label>
            <div class="form-grid two-column-grid"><label class="form-field"><span>Grade(s)</span><div data-class-grades class="class-chip-picker"></div><button type="button" class="text-button align-left" data-class-custom-grade>+ Custom Grade</button></label><label class="form-field"><span>Subject</span><select data-class-subject required></select><button type="button" class="text-button align-left" data-class-custom-subject>+ Custom Subject</button></label></div>
            <div class="form-grid two-column-grid"><label class="form-field"><span>Student Count <small>optional</small></span><input data-class-students type="number" min="0" step="1" /></label><label class="form-field"><span>Course Colour</span><div class="colour-input-combo"><input data-class-colour type="color" /><input data-class-colour-hex type="text" maxlength="7" placeholder="#33C7FF" /></div></label></div>
            <label class="form-field"><span>Class Context <small>optional</small></span><textarea data-class-description rows="4" placeholder="Anything that meaningfully shapes planning for this class…"></textarea></label>
            <label class="form-field"><span>Notes <small>optional</small></span><textarea data-class-notes rows="3"></textarea></label>
            <div class="class-curriculum-assignment"><strong>Curriculum Assignment</strong><p class="section-subtitle">Each selected grade automatically uses that grade's curriculum for the selected subject. Split grades keep both curricula parallel.</p><div data-class-curriculum-preview></div></div>
            <div class="modal-actions"><button type="button" class="secondary-button" data-class-cancel>Cancel</button><button class="primary-button" type="submit">Save Class</button></div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector("[data-class-close]").addEventListener("click", () => dialog.close());
    return dialog;
  }

  function availableGrades(user) {
    return typeof getAvailableGrades === "function" ? getAvailableGrades(user) : [...DEFAULT_GRADES, ...(user.customGrades || [])];
  }

  function availableSubjects(user) {
    const base = typeof getAvailableSubjects === "function" ? getAvailableSubjects(user) : [...DEFAULT_SUBJECTS, ...(user.customSubjects || [])];
    const regSubjects = registry() ? [...new Set(registry().curriculum.map(record => record.subject))] : [];
    return [...new Set([...base, ...regSubjects])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function openManager(editId = "") {
    const user = getActiveUser();
    if (!user || readOnlyMode) return;
    ensureClasses(user);
    const dialog = createDialog();
    renderManager(dialog, user);
    dialog.showModal();
    if (editId) openEditor(dialog, user, classById(user, editId));
  }

  function renderManager(dialog, user) {
    const list = dialog.querySelector("[data-class-list]");
    list.innerHTML = "";
    const classes = ensureClasses(user);
    if (!classes.length) list.innerHTML = '<div class="empty-state-card">No classes yet. Create your first class before building the weekly instructional schedule.</div>';
    classes.forEach(item => {
      const coverage = curriculumCoverage(user, item);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "class-manager-card";
      button.style.setProperty("--course-colour", item.colour || "#33C7FF");
      button.innerHTML = `<span class="class-colour-bar"></span><div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(formatGrades(item.grades))} · ${escapeHTML(item.subject)}${item.studentCount ? ` · ${item.studentCount} students` : ""}</small><div class="mini-coverage"><span>${coverage.addressedPct}% addressed</span><span>${coverage.taughtPct}% taught</span><span>${coverage.assessedPct}% assessed</span></div></div>`;
      button.addEventListener("click", () => openEditor(dialog, user, item));
      list.appendChild(button);
    });
    dialog.querySelector("[data-class-new]").onclick = () => openEditor(dialog, user, null);
  }

  function openEditor(dialog, user, item) {
    const form = dialog.querySelector("[data-class-form]");
    form.classList.remove("hidden");
    const current = item ? normalizeClass(item, user) : normalizeClass({ colour: nextColour(user) }, user);
    form.dataset.editing = item ? "1" : "0";
    form.querySelector("[data-class-id]").value = item?.id || "";
    form.querySelector("[data-class-editor-title]").textContent = item ? "Edit Class" : "New Class";
    form.querySelector("[data-class-name]").value = item?.name || "";
    form.querySelector("[data-class-students]").value = item?.studentCount || "";
    form.querySelector("[data-class-description]").value = item?.description || "";
    form.querySelector("[data-class-notes]").value = item?.notes || "";
    form.querySelector("[data-class-colour]").value = normalizeHexColour?.(current.colour) || "#33C7FF";
    form.querySelector("[data-class-colour-hex]").value = normalizeHexColour?.(current.colour) || "#33C7FF";

    const subjectSelect = form.querySelector("[data-class-subject]");
    subjectSelect.innerHTML = '<option value="">Select subject</option>' + availableSubjects(user).map(subject => `<option ${subject === item?.subject ? "selected" : ""}>${escapeHTML(subject)}</option>`).join("");

    const gradeWrap = form.querySelector("[data-class-grades]");
    gradeWrap.innerHTML = "";
    const selected = new Set(item?.grades || []);
    availableGrades(user).forEach(grade => {
      const label = document.createElement("label");
      label.className = "selection-chip-check";
      label.innerHTML = `<input type="checkbox" value="${escapeHTML(grade)}" ${selected.has(grade) ? "checked" : ""}/><span>${escapeHTML(grade)}</span>`;
      gradeWrap.appendChild(label);
    });

    const updatePreview = () => {
      const grades = [...gradeWrap.querySelectorAll("input:checked")].map(input => input.value);
      const subject = subjectSelect.value;
      const preview = form.querySelector("[data-class-curriculum-preview]");
      if (!grades.length || !subject) {
        preview.innerHTML = '<small>Select a grade and subject to preview curriculum.</small>';
        return;
      }
      preview.innerHTML = grades.map(grade => {
        const count = registry()?.curriculumFor(grade, subject).length || 0;
        return `<span class="curriculum-assignment-chip">${escapeHTML(grade)} · ${escapeHTML(subject)} <b>${count ? `${count} records` : "no loaded detail"}</b></span>`;
      }).join("");
      if (!form.querySelector("[data-class-name]").value.trim()) form.querySelector("[data-class-name]").placeholder = suggestedName(grades, subject);
    };
    gradeWrap.querySelectorAll("input").forEach(input => input.addEventListener("change", updatePreview));
    subjectSelect.addEventListener("change", updatePreview);
    updatePreview();

    const colour = form.querySelector("[data-class-colour]");
    const hex = form.querySelector("[data-class-colour-hex]");
    colour.oninput = () => { hex.value = colour.value.toUpperCase(); };
    hex.oninput = () => { const valid = normalizeHexColour?.(hex.value); if (valid) colour.value = valid; };

    form.querySelector("[data-class-custom-grade]").onclick = () => {
      const value = prompt("Enter the grade or class label:")?.trim();
      if (!value) return;
      if (!(user.customGrades || []).some(existing => sameText(existing, value))) user.customGrades.push(value);
      saveData();
      openEditor(dialog, user, { ...current, id: item?.id, grades: [...selected, value], subject: subjectSelect.value, name: form.querySelector("[data-class-name]").value, colour: colour.value, description: form.querySelector("[data-class-description]").value, notes: form.querySelector("[data-class-notes]").value, studentCount: form.querySelector("[data-class-students]").value });
    };
    form.querySelector("[data-class-custom-subject]").onclick = () => {
      const value = prompt("Enter the subject name:")?.trim();
      if (!value) return;
      if (!(user.customSubjects || []).some(existing => sameText(existing, value))) user.customSubjects.push(value);
      saveData();
      openEditor(dialog, user, { ...current, id: item?.id, grades: [...gradeWrap.querySelectorAll("input:checked")].map(input => input.value), subject: value, name: form.querySelector("[data-class-name]").value, colour: colour.value, description: form.querySelector("[data-class-description]").value, notes: form.querySelector("[data-class-notes]").value, studentCount: form.querySelector("[data-class-students]").value });
    };

    form.querySelector("[data-class-cancel]").onclick = () => form.classList.add("hidden");
    const deleteButton = form.querySelector("[data-class-delete]");
    deleteButton.classList.toggle("hidden", !item);
    deleteButton.onclick = () => {
      if (!item || !confirm(`Move “${item.name}” to Trash? Units and lessons are not deleted; their class link becomes unassigned until restored or changed.`)) return;
      const unitIds = (user.units || []).filter(unit => unit.classId === item.id).map(unit => unit.id);
      const blockRefs = [];
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => (version.scheduleBlocks || []).forEach(block => {
        if (block.classId === item.id) blockRefs.push({ termId: term.id, versionId: version.id, blockId: block.id });
      })));
      if (window.TeacherHQTrash) window.TeacherHQTrash.softDelete("class", item, { parent: "user.classes", unitIds, blockRefs });
      else user.classes = user.classes.filter(entry => entry.id !== item.id);
      // Keep related history intact; only clear live foreign keys.
      (user.units || []).forEach(unit => { if (unit.classId === item.id) unit.classId = ""; });
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => (version.scheduleBlocks || []).forEach(block => { if (block.classId === item.id) block.classId = ""; })));
      saveData();
      form.classList.add("hidden");
      renderManager(dialog, user);
      refresh();
    };

    form.onsubmit = event => {
      event.preventDefault();
      const grades = [...gradeWrap.querySelectorAll("input:checked")].map(input => input.value);
      const subject = subjectSelect.value.trim();
      if (!grades.length || !subject) return alert("Select at least one grade and a subject.");
      const id = form.querySelector("[data-class-id]").value || makeId("class");
      const name = form.querySelector("[data-class-name]").value.trim() || suggestedName(grades, subject);
      const saved = normalizeClass({
        id, name, grades, subject,
        studentCount: form.querySelector("[data-class-students]").value,
        description: form.querySelector("[data-class-description]").value,
        notes: form.querySelector("[data-class-notes]").value,
        colour: colour.value,
        curriculumAssignments: grades.map(grade => ({ grade, subject })),
        coverageOverrides: item?.coverageOverrides || {},
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, user);
      const index = user.classes.findIndex(entry => entry.id === id);
      if (index >= 0) user.classes[index] = saved; else user.classes.push(saved);
      // If the class identity changed, linked schedule blocks/units inherit the
      // new grade+subject but preserve their dates and history.
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => (version.scheduleBlocks || []).forEach(block => {
        if (block.classId !== id) return;
        block.grades = [...saved.grades]; block.subject = saved.subject;
      })));
      (user.units || []).forEach(unit => {
        if (unit.classId !== id) return;
        unit.classSpec = { grades: [...saved.grades], subject: saved.subject };
      });
      saveData();
      form.classList.add("hidden");
      renderManager(dialog, user);
      refresh();
    };
  }

  function populateBlockClassSelect() {
    const user = getActiveUser();
    const select = $id("blockClass");
    if (!user || !select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Manual grade / subject</option>';
    ensureClasses(user).sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      option.dataset.grades = JSON.stringify(item.grades);
      option.dataset.subject = item.subject;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function bindScheduleClassSelect() {
    const select = $id("blockClass");
    if (!select || select.dataset.classBound) return;
    select.dataset.classBound = "1";
    select.addEventListener("change", () => {
      const user = getActiveUser();
      const teachingClass = classById(user, select.value);
      if (!teachingClass) return;
      const gradeSelect = $id("blockGrade");
      const subjectSelect = $id("blockSubject");
      if (subjectSelect && ![...subjectSelect.options].some(option => option.value === teachingClass.subject)) {
        const option = document.createElement("option"); option.value = teachingClass.subject; option.textContent = teachingClass.subject; subjectSelect.appendChild(option);
      }
      if (subjectSelect) subjectSelect.value = teachingClass.subject;
      if (teachingClass.grades.length > 1) {
        if ($id("splitClassCheckbox")) $id("splitClassCheckbox").checked = true;
        if (typeof updateSplitGradeVisibility === "function") updateSplitGradeVisibility();
        setTimeout(() => {
          document.querySelectorAll("#splitGradeChoices input").forEach(input => { input.checked = teachingClass.grades.includes(input.value); });
        }, 0);
      } else {
        if ($id("splitClassCheckbox")) $id("splitClassCheckbox").checked = false;
        if (typeof updateSplitGradeVisibility === "function") updateSplitGradeVisibility();
        const grade = teachingClass.grades[0] || "";
        if (gradeSelect && ![...gradeSelect.options].some(option => option.value === grade)) {
          const option = document.createElement("option"); option.value = grade; option.textContent = grade; gradeSelect.appendChild(option);
        }
        if (gradeSelect) gradeSelect.value = grade;
      }
    });
    $id("addScheduleBlockButton")?.addEventListener("click", () => setTimeout(populateBlockClassSelect, 0));
  }

  function classOptionSpecs(user) {
    return ensureClasses(user).map(item => ({
      classId: item.id,
      id: item.id,
      name: item.name,
      grades: [...item.grades],
      subject: item.subject,
      colour: item.colour
    }));
  }

  function renderClassOverview() {
    const user = getActiveUser();
    const container = $id("classOverviewList");
    if (!user || !container) return;
    const classes = ensureClasses(user);
    container.innerHTML = "";
    if (!classes.length) {
      container.innerHTML = '<div class="empty-state-card">Create Classes Taught first. Instructional schedule blocks, Units, curriculum tracking and course colours will all reference them.</div>';
      return;
    }
    classes.forEach(item => {
      const coverage = curriculumCoverage(user, item);
      const units = unitsForClass(user, item);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "class-overview-card";
      card.style.setProperty("--course-colour", item.colour || "#33C7FF");
      card.innerHTML = `<span class="class-card-accent"></span><div class="class-card-heading"><div><p class="small-label">${escapeHTML(formatGrades(item.grades))}</p><h3>${escapeHTML(item.name)}</h3><span>${escapeHTML(item.subject)}${item.studentCount ? ` · ${item.studentCount} students` : ""}</span></div><span class="class-arrow">→</span></div><div class="coverage-bars"><div><span>Addressed</span><b>${coverage.addressedPct}%</b><i><em style="width:${coverage.addressedPct}%"></em></i></div><div><span>Taught</span><b>${coverage.taughtPct}%</b><i><em style="width:${coverage.taughtPct}%"></em></i></div><div><span>Assessed</span><b>${coverage.assessedPct}%</b><i><em style="width:${coverage.assessedPct}%"></em></i></div></div><small>${units.length} unit${units.length === 1 ? "" : "s"} · ${coverage.total || "No"} loaded curriculum record${coverage.total === 1 ? "" : "s"}</small>`;
      card.addEventListener("click", () => openDashboard(item.id));
      container.appendChild(card);
    });
  }

  function createDashboardDialog() {
    let dialog = $id("classDashboardDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "classDashboardDialog";
    dialog.className = "modal extra-large-modal class-dashboard-dialog";
    dialog.innerHTML = '<div class="modal-content"><div class="modal-heading"><div><p class="small-label">Class Dashboard</p><h2 data-class-dashboard-title></h2><p data-class-dashboard-meta class="section-subtitle"></p></div><button type="button" class="close-button" data-class-dashboard-close>×</button></div><nav class="class-dashboard-tabs" data-class-dashboard-tabs></nav><div data-class-dashboard-content></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector("[data-class-dashboard-close]").onclick = () => dialog.close();
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function openDashboard(classId, tab = "calendar") {
    const user = getActiveUser();
    const teachingClass = classById(user, classId);
    if (!teachingClass) return;
    const dialog = createDashboardDialog();
    dialog.dataset.classId = classId;
    dialog.dataset.tab = tab;
    renderDashboard(dialog, user, teachingClass, tab);
    dialog.showModal();
  }

  function renderDashboard(dialog, user, teachingClass, tab) {
    dialog.querySelector("[data-class-dashboard-title]").textContent = teachingClass.name;
    dialog.querySelector("[data-class-dashboard-meta]").textContent = `${formatGrades(teachingClass.grades)} · ${teachingClass.subject}${teachingClass.studentCount ? ` · ${teachingClass.studentCount} students` : ""}`;
    const tabs = ["calendar", "units", "lessons", "curriculum", "assessments", "resources", "context"];
    const labels = { calendar: "Calendar", units: "Units", lessons: "Lessons", curriculum: "Curriculum Progress", assessments: "Assessments", resources: "Resources", context: "Class Context" };
    const nav = dialog.querySelector("[data-class-dashboard-tabs]");
    nav.innerHTML = tabs.map(id => `<button type="button" class="${tab === id ? "active" : ""}" data-class-tab="${id}">${labels[id]}</button>`).join("");
    nav.querySelectorAll("button").forEach(button => button.onclick = () => renderDashboard(dialog, user, teachingClass, button.dataset.classTab));
    const content = dialog.querySelector("[data-class-dashboard-content]");
    content.innerHTML = "";
    if (tab === "curriculum") return renderCoverage(content, user, teachingClass);
    if (tab === "units") return renderUnits(content, user, teachingClass);
    if (tab === "lessons") return renderLessons(content, user, teachingClass);
    if (tab === "assessments") return renderAssessments(content, user, teachingClass);
    if (tab === "resources") return renderResources(content, user, teachingClass);
    if (tab === "context") return renderContext(content, user, teachingClass);
    return renderClassCalendar(content, user, teachingClass);
  }

  function renderCoverage(container, user, teachingClass) {
    const coverage = curriculumCoverage(user, teachingClass);
    const summary = document.createElement("div");
    summary.className = "class-coverage-summary";
    summary.innerHTML = `<div><strong>${coverage.addressedPct}%</strong><span>Addressed</span></div><div><strong>${coverage.taughtPct}%</strong><span>Taught</span></div><div><strong>${coverage.assessedPct}%</strong><span>Assessed</span></div><div><strong>${coverage.coveredPct}%</strong><span>Taught + assessed</span></div>`;
    container.appendChild(summary);
    if (!coverage.records.length) {
      container.insertAdjacentHTML("beforeend", '<div class="empty-state-card">No detailed curriculum is loaded for this class yet.</div>');
      return;
    }
    const groups = new Map();
    coverage.records.forEach(record => {
      const key = record.curriculumPath?.[0]?.title || record.organizingIdea || record.discipline || "Curriculum";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    const tree = document.createElement("div"); tree.className = "coverage-tree";
    groups.forEach((records, group) => {
      const details = document.createElement("details");
      const addressed = records.filter(record => coverage.addressed.has(record.id)).length;
      details.innerHTML = `<summary><strong>${escapeHTML(group)}</strong><span>${addressed}/${records.length} addressed</span></summary><div class="coverage-record-list"></div>`;
      const list = details.querySelector("div");
      records.forEach(record => {
        const status = coverage.assessed.has(record.id) && coverage.taught.has(record.id) ? "covered" : coverage.assessed.has(record.id) ? "assessed" : coverage.taught.has(record.id) ? "taught" : coverage.developing.has(record.id) ? "developing" : coverage.introduced.has(record.id) ? "introduced" : coverage.planned.has(record.id) ? "planned" : "not-planned";
        const row = document.createElement("article");
        row.className = `coverage-record status-${status}`;
        row.innerHTML = `<span class="coverage-status-dot"></span><div><small>${escapeHTML(record.type || record.role || "Curriculum")}</small><p>${escapeHTML(record.text || record.learningOutcome || record.organizingIdeaDescription || "")}</p></div><select aria-label="Coverage status"><option value="auto">Auto · ${status.replace("-", " ")}</option><option value="planned">Planned</option><option value="introduced">Introduced</option><option value="developing">Developing</option><option value="taught">Taught</option><option value="assessed">Assessed</option><option value="covered">Covered</option><option value="not-planned">Not planned</option></select>`;
        const select = row.querySelector("select");
        const override = teachingClass.coverageOverrides?.[record.id];
        if (override) select.value = override;
        select.disabled = readOnlyMode;
        select.onchange = () => {
          teachingClass.coverageOverrides ||= {};
          if (select.value === "auto") delete teachingClass.coverageOverrides[record.id]; else teachingClass.coverageOverrides[record.id] = select.value;
          teachingClass.updatedAt = new Date().toISOString(); saveData(); renderCoverage(container, user, teachingClass);
        };
        list.appendChild(row);
      });
      tree.appendChild(details);
    });
    container.appendChild(tree);
  }

  function renderUnits(container, user, teachingClass) {
    const units = unitsForClass(user, teachingClass);
    const top = document.createElement("div"); top.className = "class-dashboard-action-row";
    top.innerHTML = `<span>${units.length} unit${units.length === 1 ? "" : "s"}</span>${readOnlyMode ? "" : '<button class="primary-button" type="button">+ New Unit</button>'}`;
    top.querySelector("button")?.addEventListener("click", () => { document.getElementById("classDashboardDialog")?.close(); openUnitWizard(); setTimeout(() => {
      const select = $id("unitClassSelect"); if (select) { const option = [...select.options].find(item => item.dataset.classId === teachingClass.id); if (option) { select.value = option.value; select.dispatchEvent(new Event("change", { bubbles: true })); } }
    }, 0); });
    container.appendChild(top);
    const grid = document.createElement("div"); grid.className = "unit-overview-list grouped-unit-list";
    units.forEach(unit => grid.appendChild(makeUnitCard(unit, false)));
    if (!units.length) grid.innerHTML = '<div class="empty-state-card">No Units yet.</div>';
    container.appendChild(grid);
  }

  function renderLessons(container, user, teachingClass) {
    const units = unitsForClass(user, teachingClass);
    const list = document.createElement("div"); list.className = "class-lesson-list";
    const lessons = units.flatMap(unit => (unit.lessons || []).map(lesson => ({ unit, lesson }))).sort((a, b) => a.lesson.dateKey.localeCompare(b.lesson.dateKey) || a.lesson.startTime.localeCompare(b.lesson.startTime));
    lessons.forEach(({ unit, lesson }) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "class-lesson-row"; button.style.setProperty("--unit-colour", unit.colour || teachingClass.colour);
      button.innerHTML = `<span>${escapeHTML(formatDate(lesson.dateKey))}</span><strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong><small>${escapeHTML(unit.name)} · ${escapeHTML(formatTime(lesson.startTime))}</small>`;
      button.onclick = () => { document.getElementById("classDashboardDialog")?.close(); openLessonPlaceholder(unit.id, lesson.id); };
      list.appendChild(button);
    });
    if (!lessons.length) list.innerHTML = '<div class="empty-state-card">No allocated Lessons yet.</div>';
    container.appendChild(list);
  }

  function renderAssessments(container, user, teachingClass) {
    const items = unitsForClass(user, teachingClass).flatMap(unit => (unit.workspace?.assessments || []).filter(a => a.status !== "draft").map(assessment => ({ unit, assessment }))).sort((a,b)=>(a.assessment.date||"").localeCompare(b.assessment.date||""));
    const list = document.createElement("div"); list.className = "class-assessment-list";
    items.forEach(({unit, assessment}) => {
      const button=document.createElement("button"); button.type="button"; button.className="class-assessment-row";
      button.innerHTML=`<span class="assessment-kind ${assessment.type}">${escapeHTML(assessmentTypeLabel(assessment.type))}</span><div><strong>${escapeHTML(assessment.title)}</strong><small>${assessment.date ? escapeHTML(formatDate(assessment.date)) : "No date"} · ${escapeHTML(unit.name)}</small></div>`;
      button.onclick=()=>{ document.getElementById("classDashboardDialog")?.close(); activeUnitWorkspaceId=unit.id; activeUnitWorkspaceSection="assessments"; workspaceAssessmentEditorId=assessment.id; renderUnitWorkspace(); };
      list.appendChild(button);
    });
    if(!items.length) list.innerHTML='<div class="empty-state-card">No assessments yet.</div>';
    container.appendChild(list);
  }

  function renderResources(container, user, teachingClass) {
    const units = unitsForClass(user, teachingClass);
    const ids = new Set(units.flatMap(unit => unit.workspace?.resourceIds || []));
    const records = (user.resourceLibrary || []).filter(item => ids.has(item.id));
    const list=document.createElement("div"); list.className="resource-library-list";
    records.forEach(item=>{ const row=document.createElement("article"); row.className="resource-library-card"; row.innerHTML=`<strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.kind)}</span>${item.url ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener">Open link</a>` : ""}${item.driveUrl ? `<a href="${escapeHTML(item.driveUrl)}" target="_blank" rel="noopener">Open Drive link</a>` : ""}`; list.appendChild(row); });
    if(!records.length) list.innerHTML='<div class="empty-state-card">No resources are linked to this class\'s Units yet.</div>';
    container.appendChild(list);
  }

  function renderContext(container, user, teachingClass) {
    const card=document.createElement("div"); card.className="class-context-editor";
    card.innerHTML=`<label class="form-field"><span>Class Context</span><textarea rows="8" ${readOnlyMode?"disabled":""}>${escapeHTML(teachingClass.description||"")}</textarea></label><label class="form-field"><span>Notes</span><textarea rows="5" ${readOnlyMode?"disabled":""}>${escapeHTML(teachingClass.notes||"")}</textarea></label>${readOnlyMode?"":'<button class="primary-button" type="button">Save</button>'}`;
    card.querySelector("button")?.addEventListener("click",()=>{ const areas=card.querySelectorAll("textarea"); teachingClass.description=areas[0].value; teachingClass.notes=areas[1].value; teachingClass.updatedAt=new Date().toISOString(); saveData(); alert("Class context saved."); });
    container.appendChild(card);
  }

  function renderClassCalendar(container, user, teachingClass) {
    const date = new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const shell = document.createElement("div"); shell.className="class-calendar-shell"; shell.dataset.year=start.getFullYear(); shell.dataset.month=start.getMonth();
    const draw=()=>{
      const year=Number(shell.dataset.year), month=Number(shell.dataset.month); const view=new Date(year,month,1);
      shell.innerHTML=`<div class="calendar-header"><div><p class="small-label">Class Calendar</p><h3>${view.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h3></div><div class="calendar-controls"><button type="button" data-prev>←</button><button type="button" data-next>→</button></div></div><div class="class-calendar-grid"></div>`;
      const grid=shell.querySelector(".class-calendar-grid"); ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d=>grid.insertAdjacentHTML("beforeend",`<div class="weekday-name">${d}</div>`));
      const first=view.getDay(), days=new Date(year,month+1,0).getDate(); for(let i=0;i<first;i++)grid.insertAdjacentHTML("beforeend",'<div class="class-calendar-day blank"></div>');
      const units=unitsForClass(user,teachingClass);
      for(let day=1;day<=days;day++){
        const key=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const dow=new Date(year,month,day).getDay(); const cell=document.createElement("button"); cell.type="button"; cell.className=`class-calendar-day ${dow===0||dow===6?"weekend":""}`; cell.innerHTML=`<span>${day}</span><div></div>`; const inner=cell.querySelector("div");
        const exception=getExceptionForDate(user,key); if(exception){ cell.classList.add("day-off"); inner.insertAdjacentHTML("beforeend",`<small class="day-off-label">${escapeHTML(exception.label||exception.type)}</small>`); }
        units.forEach(unit=>(unit.lessons||[]).filter(l=>l.dateKey===key).forEach(lesson=>{const colour=unit.colour||teachingClass.colour||"#61B6FF";inner.insertAdjacentHTML("beforeend",`<small class="class-calendar-lesson" style="--unit-colour:${escapeHTML(colour)};--auto-fg:${escapeHTML(contrastText(colour))}">${escapeHTML(lessonDisplayTitleForUnit(unit,lesson))}</small>`);}));
        cell.onclick=()=>openDayDetails(key); grid.appendChild(cell);
      }
      shell.querySelector("[data-prev]").onclick=()=>{ const d=new Date(year,month-1,1); shell.dataset.year=d.getFullYear(); shell.dataset.month=d.getMonth(); draw(); };
      shell.querySelector("[data-next]").onclick=()=>{ const d=new Date(year,month+1,1); shell.dataset.year=d.getFullYear(); shell.dataset.month=d.getMonth(); draw(); };
    };
    draw(); container.appendChild(shell);
  }

  function renderUnitOverviewGrouped() {
    const user=getActiveUser(); const container=$id("unitOverviewList"); if(!user||!container)return;
    ensureClasses(user); container.innerHTML="";
    const units=(user.units||[]).filter(unit=>!unit.isStandaloneContainer);
    if(!units.length){ container.innerHTML='<div class="empty-state-card">No units yet. Choose a class above or open Unit Planner to create one.</div>'; return; }
    const groups=new Map();
    units.forEach(unit=>{ const item=classById(user,unit.classId); const key=item?.id||classKey(unit.classSpec||{}); if(!groups.has(key))groups.set(key,{teachingClass:item,spec:unit.classSpec,units:[]}); groups.get(key).units.push(unit); });
    groups.forEach(group=>{
      const wrapper=document.createElement("section"); wrapper.className="unit-class-group"; const label=group.teachingClass?.name||classLabel(group.spec); wrapper.innerHTML=`<div class="unit-class-group-heading"><button type="button" class="unit-class-heading-button"><div><p class="small-label">Class</p><h3>${escapeHTML(label)}</h3></div><span>→</span></button>${readOnlyMode?"":'<button type="button" class="secondary-button">+ New Unit</button>'}</div><div class="unit-overview-list grouped-unit-list"></div>`;
      wrapper.querySelector(".unit-class-heading-button").onclick=()=> group.teachingClass ? openDashboard(group.teachingClass.id,"units") : openUnitPlanner();
      wrapper.querySelector(".secondary-button")?.addEventListener("click",()=>{ openUnitWizard(); setTimeout(()=>{ const select=$id("unitClassSelect"); const option=[...select.options].find(o=>o.dataset.classId===group.teachingClass?.id || o.value===classKey(group.spec)); if(option){select.value=option.value;select.dispatchEvent(new Event("change",{bubbles:true}));}},0); });
      const list=wrapper.querySelector(".grouped-unit-list"); group.units.sort((a,b)=>(a.startDate||"").localeCompare(b.startDate||"")).forEach(unit=>list.appendChild(makeUnitCard(unit,true))); container.appendChild(wrapper);
    });
  }

  function refresh() {
    const user=getActiveUser(); if(!user)return; ensureClasses(user); populateBlockClassSelect(); renderClassOverview(); renderUnitOverviewGrouped();
  }

  // Replace the schedule-derived Class options with the durable Class layer.
  try { getClassOptions = user => classOptionSpecs(user); } catch (_) { /* classic-script global may be non-writable in unusual hosts */ }
  try { renderUnitOverview = user => { if (user) renderUnitOverviewGrouped(); }; } catch (_) {}

  $id("manageClassesButton")?.addEventListener("click",()=>openManager());
  bindScheduleClassSelect();

  // Refresh the extension whenever the core dashboard is rendered.
  try {
    const originalRenderTeacherHQ=renderTeacherHQ;
    renderTeacherHQ=function(){ originalRenderTeacherHQ.apply(this,arguments); refresh(); };
  } catch (_) {}

  window.TeacherHQClasses = {
    ensureClasses, classById, recordsForClass, unitsForClass, curriculumCoverage,
    openManager, openDashboard, populateBlockClassSelect, renderClassOverview,
    renderUnitOverviewGrouped, refresh, formatGrades
  };

  refresh();
})();
