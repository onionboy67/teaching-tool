/* ============================================================
   TEACHER HQ — COHORTS + CLASSES
   ------------------------------------------------------------
   Vocabulary used throughout Teacher HQ:
   - Cohort = a particular collection of students.
   - Class  = a course/subject taught to one Cohort.
   - Unit   = a collection of lessons inside a Class.
   - Lesson = one planned instructional period from a Unit.

   Student records are local-only and anonymous by default. Each student
   receives a unique two-digit code within their Cohort. Nicknames are
   optional; Teacher HQ never requires a legal name.
============================================================ */
(function () {
  "use strict";

  const COLOUR_POOL = [
    "#FF5F8F", "#8C6CFF", "#33C7FF", "#39D98A", "#FFB347", "#F04FCB",
    "#6EDB3F", "#FF7043", "#00B8D9", "#FFC93C", "#A45CFF", "#00C48C",
    "#FF4D6D", "#5B8CFF", "#FF8A3D", "#2DD4BF", "#C45CFF", "#A6E22E"
  ];

  const CONTEXT_MODULES = [
    { key: "culture", label: "Culture", help: "Local and classroom-specific cultural considerations." },
    { key: "schoolSetting", label: "School Setting", help: "School factors that affect learning: routines, mottos, specialization, shared expectations, and environment." },
    { key: "classroomSetting", label: "Classroom Setting", help: "Saved teaching locations. One can be the usual/default location; lessons can temporarily use another." },
    { key: "complexities", label: "Complexities", help: "Physical, mental, environmental, or situational factors that can move students outside the zone of proximal development." }
  ];

  const $id = id => document.getElementById(id);
  const registry = () => window.TeacherHQRegistry || null;
  const clone = value => typeof structuredCloneSafe === "function" ? structuredCloneSafe(value) : JSON.parse(JSON.stringify(value));

  function clean(value) { return String(value ?? "").trim(); }
  function sameText(a, b) { return clean(a).toLowerCase() === clean(b).toLowerCase(); }
  function nowISO() { return new Date().toISOString(); }

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

  function normalizeSubjects(subjects, fallback = "") {
    const source = Array.isArray(subjects) ? subjects : [fallback];
    const list = [...new Set(source.map(clean).filter(Boolean))];
    if (fallback && !list.includes(clean(fallback))) list.unshift(clean(fallback));
    return list;
  }

  function formatGrades(grades) {
    const list = normalizeGrades(grades);
    if (!list.length) return "No grade";
    if (list.length === 1) return list[0];
    const numeric = list.map(item => item.match(/Grade\s+(\d+)/i)?.[1]).filter(Boolean);
    if (numeric.length === list.length) return `Grade ${numeric.join("/")}`;
    return list.join(" / ");
  }

  function formatSubjects(subjects, fallback = "") {
    const list = normalizeSubjects(subjects, fallback);
    return list.length ? list.join(" + ") : "No subject";
  }

  function baseClassName(grades, subjects, fallback = "") {
    return `${formatGrades(grades)} ${formatSubjects(subjects, fallback)}`.trim();
  }

  function uniqueDefaultClassName(user, grades, subjects, ignoreId = "") {
    const base = baseClassName(grades, subjects) || "Class";
    const used = new Set((user.classes || []).filter(item => item.id !== ignoreId).map(item => clean(item.name).toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let number = 2;
    while (used.has(`${base} - ${number}`.toLowerCase())) number += 1;
    return `${base} - ${number}`;
  }

  function uniqueDefaultCohortName(user, ignoreId = "") {
    const used = new Set((user.cohorts || []).filter(item => item.id !== ignoreId).map(item => clean(item.name).toLowerCase()));
    let number = 1;
    while (used.has(`cohort ${number}`)) number += 1;
    return `Cohort ${number}`;
  }

  function nextColour(user, ignoreId = "") {
    const used = new Set((user.classes || [])
      .filter(item => item.id !== ignoreId)
      .map(item => String(item.colour || "").toUpperCase()));
    return COLOUR_POOL.find(colour => !used.has(colour.toUpperCase())) || COLOUR_POOL[(user.classes || []).length % COLOUR_POOL.length];
  }

  function randomInt(max) {
    if (window.crypto?.getRandomValues) {
      const data = new Uint32Array(1);
      window.crypto.getRandomValues(data);
      return data[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function availableStudentCode(existingCodes = new Set()) {
    if (existingCodes.size >= 100) return null;
    const available = [];
    for (let i = 0; i < 100; i += 1) {
      const code = String(i).padStart(2, "0");
      if (!existingCodes.has(code)) available.push(code);
    }
    return available[randomInt(available.length)] || null;
  }

  function normalizeInterest(item) {
    return {
      id: item?.id || makeId("interest"),
      tag: clean(item?.tag || item?.title),
      description: String(item?.description || ""),
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    };
  }

  function normalizeAttentionGrabber(item) {
    return {
      id: item?.id || makeId("attention-grabber"),
      title: clean(item?.title || item?.name),
      description: String(item?.description || ""),
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    };
  }

  function normalizeStudent(item, usedCodes) {
    let code = clean(item?.code).replace(/\D/g, "").slice(-2).padStart(2, "0");
    if (!/^\d{2}$/.test(code) || usedCodes.has(code)) code = availableStudentCode(usedCodes) || "00";
    usedCodes.add(code);
    return {
      id: item?.id || makeId("student"),
      code,
      nickname: clean(item?.nickname),
      interests: Array.isArray(item?.interests) ? item.interests.map(normalizeInterest).filter(entry => entry.tag) : [],
      complexities: Array.isArray(item?.complexities)
        ? item.complexities.map(entry => normalizeContextItem(entry, "studentComplexities")).filter(entry => entry.title)
        : [],
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    };
  }

  function normalizeContextItem(item, moduleKey) {
    return {
      id: item?.id || makeId("context-item"),
      title: clean(item?.title || item?.label),
      description: String(item?.description || ""),
      useByDefault: typeof item?.useByDefault === "boolean" ? item.useByDefault : true,
      module: moduleKey,
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    };
  }

  function normalizeCohort(item) {
    const usedCodes = new Set();
    const contextSource = item?.context && typeof item.context === "object" ? item.context : {};
    const context = {};
    CONTEXT_MODULES.forEach(module => {
      const entries = Array.isArray(contextSource[module.key]) ? contextSource[module.key] : [];
      context[module.key] = entries.map(entry => normalizeContextItem(entry, module.key)).filter(entry => entry.title);
      if (module.key === "classroomSetting" && context[module.key].length && !context[module.key].some(entry => entry.useByDefault)) {
        context[module.key][0].useByDefault = true;
      }
    });
    return {
      id: item?.id || makeId("cohort"),
      name: clean(item?.name) || "Cohort",
      students: Array.isArray(item?.students) ? item.students.map(student => normalizeStudent(student, usedCodes)) : [],
      attentionGrabbers: Array.isArray(item?.attentionGrabbers) ? item.attentionGrabbers.map(normalizeAttentionGrabber).filter(entry => entry.title) : [],
      context,
      notes: String(item?.notes || ""),
      archivedAt: item?.archivedAt || null,
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    };
  }

  function makeStudents(count, existing = []) {
    const students = [...existing];
    const used = new Set(students.map(student => student.code));
    const target = Math.min(100, Math.max(students.length, Number(count) || 0));
    while (students.length < target) {
      const code = availableStudentCode(used);
      if (code == null) break;
      students.push(normalizeStudent({ code }, used));
    }
    return students;
  }

  function ensureCohorts(user) {
    if (!user) return [];
    if (!Array.isArray(user.cohorts)) user.cohorts = [];
    user.cohorts = user.cohorts.map(normalizeCohort);
    if (!Array.isArray(user.interestReminders)) user.interestReminders = [];
    user.interestReminders = user.interestReminders.map(item => ({
      id: item?.id || makeId("interest-reminder"),
      cohortId: clean(item?.cohortId),
      studentIds: Array.isArray(item?.studentIds) ? [...new Set(item.studentIds.map(clean).filter(Boolean))] : [],
      dueDate: clean(item?.dueDate),
      note: clean(item?.note) || "Gather student interests",
      completedAt: item?.completedAt || null,
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    })).filter(item => item.cohortId && item.dueDate);
    return user.cohorts;
  }

  function normalizeClass(item, user) {
    const grades = normalizeGrades(item?.grades);
    const subject = clean(item?.subject || item?.subjects?.[0]);
    const subjects = normalizeSubjects(item?.subjects, subject);
    const assignments = Array.isArray(item?.curriculumAssignments) && item.curriculumAssignments.length
      ? item.curriculumAssignments.map(entry => ({ grade: clean(entry.grade), subject: clean(entry.subject || subject) })).filter(entry => entry.grade && entry.subject)
      : grades.flatMap(grade => subjects.map(subjectName => ({ grade, subject: subjectName })));
    const fallbackName = baseClassName(grades, subjects, subject) || "Class";
    return {
      id: item?.id || makeId("class"),
      cohortId: clean(item?.cohortId),
      name: clean(item?.name) || fallbackName,
      nameIsCustom: typeof item?.nameIsCustom === "boolean" ? item.nameIsCustom : Boolean(item?.name && clean(item.name) !== fallbackName),
      grades,
      subject,
      subjects,
      legacyStudentCount: Math.max(0, Number(item?.legacyStudentCount ?? item?.studentCount) || 0),
      description: String(item?.description || ""),
      notes: String(item?.notes || ""),
      colour: normalizeHexColour?.(item?.colour) || item?.colour || nextColour(user || { classes: [] }, item?.id),
      curriculumAssignments: assignments,
      coverageOverrides: item?.coverageOverrides && typeof item.coverageOverrides === "object" ? { ...item.coverageOverrides } : {},
      archivedAt: item?.archivedAt || null,
      createdAt: item?.createdAt || nowISO(),
      updatedAt: item?.updatedAt || nowISO()
    };
  }

  function ensureClasses(user) {
    if (!user) return [];
    ensureCohorts(user);
    if (!Array.isArray(user.classes)) user.classes = [];
    user.classes = user.classes.map(item => normalizeClass(item, user));

    // Upgrade old Class records (where Class also represented the student
    // group) by creating one local Cohort per legacy Class when necessary.
    user.classes.forEach(item => {
      if (item.cohortId && cohortById(user, item.cohortId)) return;
      const legacyCount = Math.max(0, Number(item.legacyStudentCount) || 0);
      const cohort = normalizeCohort({
        name: `${item.name || baseClassName(item.grades, item.subjects)} Cohort`,
        students: makeStudents(legacyCount)
      });
      if (!cohort.students.length && legacyCount) cohort.students = makeStudents(legacyCount);
      user.cohorts.push(cohort);
      item.cohortId = cohort.id;
    });

    // Infer a Class for old instructional schedule/unit records that pre-date
    // the durable Class layer. This fallback is only for migration.
    const known = new Set(user.classes.map(item => classKey({ grades: item.grades, subject: item.subject })));
    const inferred = new Map();
    (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => {
      (version.scheduleBlocks || []).filter(block => block.blockType === "Instructional Time").forEach(block => {
        const grades = normalizeGrades(block.grades);
        const subjectName = clean(block.subject);
        if (!grades.length || !subjectName || block.classId) return;
        const key = classKey({ grades, subject: subjectName });
        if (!known.has(key)) inferred.set(key, { grades, subject: subjectName });
      });
    }));
    (user.units || []).forEach(unit => {
      if (unit.classId) return;
      const grades = normalizeGrades(unit.classSpec?.grades);
      const subjectName = clean(unit.classSpec?.subject);
      if (!grades.length || !subjectName) return;
      const key = classKey({ grades, subject: subjectName });
      if (!known.has(key)) inferred.set(key, { grades, subject: subjectName });
    });

    inferred.forEach(spec => {
      const cohort = normalizeCohort({ name: uniqueDefaultCohortName(user) });
      user.cohorts.push(cohort);
      const created = normalizeClass({
        cohortId: cohort.id,
        grades: spec.grades,
        subject: spec.subject,
        subjects: [spec.subject],
        name: uniqueDefaultClassName(user, spec.grades, [spec.subject])
      }, user);
      user.classes.push(created);
      known.add(classKey(spec));
    });

    // Attach old schedule blocks and Units only when the match is unambiguous.
    const byKey = new Map();
    user.classes.forEach(item => {
      const key = classKey({ grades: item.grades, subject: item.subject });
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    });
    byKey.forEach((matches, key) => {
      if (matches.length !== 1) return;
      const item = matches[0];
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => {
        (version.scheduleBlocks || []).forEach(block => {
          if (block.blockType !== "Instructional Time" || block.classId) return;
          if (classKey({ grades: block.grades, subject: block.subject }) === key) block.classId = item.id;
        });
      }));
      (user.units || []).forEach(unit => {
        if (!unit.classId && classKey(unit.classSpec || {}) === key) {
          unit.classId = item.id;
          (unit.lessons || []).forEach(lesson => { lesson.classId = item.id; });
        }
      });
    });

    return user.classes;
  }

  function cohortById(user, id) {
    return ensureCohorts(user).find(item => item.id === id) || null;
  }

  function classById(user, id) {
    return ensureClasses(user).find(item => item.id === id) || null;
  }

  function cohortForClass(user, teachingClassOrId) {
    const teachingClass = typeof teachingClassOrId === "string" ? classById(user, teachingClassOrId) : teachingClassOrId;
    return teachingClass ? cohortById(user, teachingClass.cohortId) : null;
  }

  function studentLabel(student) {
    if (!student) return "Student";
    return student.nickname ? `Student ${student.code} · ${student.nickname}` : `Student ${student.code}`;
  }

  function activeClasses(user) { return ensureClasses(user).filter(item => !item.archivedAt); }
  function activeCohorts(user) { return ensureCohorts(user).filter(item => !item.archivedAt); }

  function recordsForClass(teachingClass) {
    const reg = registry();
    if (!reg || !teachingClass) return [];
    const map = new Map();
    const assignments = teachingClass.curriculumAssignments?.length
      ? teachingClass.curriculumAssignments
      : teachingClass.grades.flatMap(grade => normalizeSubjects(teachingClass.subjects, teachingClass.subject).map(subject => ({ grade, subject })));
    assignments.forEach(entry => reg.curriculumFor(entry.grade, entry.subject).forEach(record => map.set(record.id, record)));
    return [...map.values()];
  }

  function unitsForClass(user, teachingClass) {
    if (!teachingClass) return [];
    const key = classKey({ grades: teachingClass.grades, subject: teachingClass.subject });
    return (user.units || []).filter(unit => unit.classId ? unit.classId === teachingClass.id : classKey(unit.classSpec || {}) === key);
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

    lessonUseCounts.forEach((count, id) => { if (count >= 2 && !taught.has(id)) developing.add(id); });
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
    return { records, total, planned, introduced, developing, taught, assessed, addressed, covered,
      addressedPct: pct(addressed), taughtPct: pct(taught), assessedPct: pct(assessed), coveredPct: pct(covered) };
  }

  function interestSummary(cohort) {
    if (!cohort) return [];
    const map = new Map();
    (cohort.students || []).forEach(student => (student.interests || []).forEach(interest => {
      const key = clean(interest.tag).toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, { tag: interest.tag, count: 0, students: [], descriptions: [] });
      const item = map.get(key);
      item.count += 1;
      item.students.push(student);
      if (interest.description && !item.descriptions.includes(interest.description)) item.descriptions.push(interest.description);
    }));
    return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /* ==========================================================
     MANAGER
  ========================================================== */
  function createManagerDialog() {
    let dialog = $id("classesDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "classesDialog";
    dialog.className = "modal extra-large-modal classes-dialog";
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-heading"><h2>Cohorts &amp; Classes</h2><button type="button" class="close-button" data-manager-close>×</button></div>
        <nav class="class-manager-tabs"><button type="button" data-manager-tab="cohorts">Cohorts</button><button type="button" data-manager-tab="classes">Classes</button></nav>
        <div data-manager-body></div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-manager-close]").onclick = () => dialog.close();
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelectorAll("[data-manager-tab]").forEach(button => button.onclick = () => renderManager(dialog, getActiveUser(), button.dataset.managerTab));
    return dialog;
  }

  function openManager(tab = "classes") {
    const user = getActiveUser();
    if (!user || readOnlyMode) return;
    ensureClasses(user);
    const dialog = createManagerDialog();
    renderManager(dialog, user, tab);
    dialog.showModal();
  }

  function renderManager(dialog, user, tab = "classes") {
    if (!user) return;
    dialog.dataset.tab = tab;
    dialog.querySelectorAll("[data-manager-tab]").forEach(button => button.classList.toggle("active", button.dataset.managerTab === tab));
    const body = dialog.querySelector("[data-manager-body]");
    body.innerHTML = "";
    if (tab === "cohorts") renderCohortManager(body, user);
    else renderClassManager(body, user);
  }

  function renderCohortManager(container, user) {
    const cohorts = ensureCohorts(user);
    const active = cohorts.filter(item => !item.archivedAt);
    const archived = cohorts.filter(item => item.archivedAt);
    const heading = document.createElement("div");
    heading.className = "clean-manager-heading";
    heading.innerHTML = `<h3>Cohorts</h3>${active.length ? '<button type="button" class="primary-button" data-new-cohort>+ Add Cohort</button>' : ""}`;
    container.appendChild(heading);
    heading.querySelector("[data-new-cohort]")?.addEventListener("click", () => openCohortEditor(null, () => renderManager($id("classesDialog"), user, "cohorts")));

    const list = document.createElement("div");
    list.className = "cohort-manager-list";
    if (!active.length) {
      list.innerHTML = `<div class="empty-state-card manager-empty-state"><strong>No cohorts yet.</strong><button type="button" class="primary-button" data-first-cohort>Create Cohort</button></div>`;
      list.querySelector("[data-first-cohort]").onclick = () => openCohortEditor(null, () => renderManager($id("classesDialog"), user, "cohorts"));
    }
    active.forEach(cohort => list.appendChild(makeCohortManagerCard(user, cohort)));
    container.appendChild(list);

    if (archived.length) {
      const archive = document.createElement("details");
      archive.className = "archive-section";
      archive.innerHTML = `<summary>Finished Cohorts <span>${archived.length}</span></summary><div class="cohort-manager-list" data-archived-cohorts></div>`;
      archived.forEach(cohort => archive.querySelector("[data-archived-cohorts]").appendChild(makeCohortManagerCard(user, cohort)));
      container.appendChild(archive);
    }
  }

  function makeCohortManagerCard(user, cohort) {
    const card = document.createElement("article");
    card.className = `cohort-manager-card ${cohort.archivedAt ? "archived-record" : ""}`;
    const classCount = (user.classes || []).filter(item => item.cohortId === cohort.id).length;
    card.innerHTML = `<button type="button" class="cohort-manager-main"><div><strong>${escapeHTML(cohort.name)}</strong><span>${cohort.students.length} student${cohort.students.length === 1 ? "" : "s"} · ${classCount} class${classCount === 1 ? "" : "es"}</span></div><span>${cohort.archivedAt ? "✓ Finished" : "→"}</span></button><div class="manager-card-actions"><button type="button" class="text-button" data-edit>Edit</button><button type="button" class="text-button" data-copy>Copy Setup</button>${cohort.archivedAt ? '<button type="button" class="text-button" data-reactivate>Reactivate</button>' : '<button type="button" class="text-button" data-finish>Mark Finished</button>'}</div>`;
    card.querySelector(".cohort-manager-main").onclick = () => { $id("classesDialog")?.close(); openCohortDashboard(cohort.id); };
    card.querySelector("[data-edit]").onclick = () => openCohortEditor(cohort, () => renderManager($id("classesDialog"), user, "cohorts"));
    card.querySelector("[data-copy]").onclick = () => copyCohortSetup(user, cohort);
    card.querySelector("[data-finish]")?.addEventListener("click", () => { cohort.archivedAt = nowISO(); cohort.updatedAt = nowISO(); saveData(); renderManager($id("classesDialog"), user, "cohorts"); refresh(); });
    card.querySelector("[data-reactivate]")?.addEventListener("click", () => { cohort.archivedAt = null; cohort.updatedAt = nowISO(); saveData(); renderManager($id("classesDialog"), user, "cohorts"); refresh(); });
    return card;
  }

  function renderClassManager(container, user) {
    const cohorts = activeCohorts(user);
    const classes = ensureClasses(user);
    const active = classes.filter(item => !item.archivedAt);
    const archived = classes.filter(item => item.archivedAt);
    const heading = document.createElement("div");
    heading.className = "clean-manager-heading";
    heading.innerHTML = `<h3>Classes</h3>${active.length && cohorts.length ? '<button class="primary-button" type="button" data-new-class>+ Add Class</button>' : ""}`;
    container.appendChild(heading);
    heading.querySelector("[data-new-class]")?.addEventListener("click", () => openClassEditor(null, () => renderManager($id("classesDialog"), user, "classes")));

    const list = document.createElement("div");
    list.className = "class-manager-list";
    if (!cohorts.length) {
      list.innerHTML = `<div class="empty-state-card manager-empty-state"><strong>Create a Cohort first.</strong><button type="button" class="primary-button" data-go-cohort>Create Cohort</button></div>`;
      list.querySelector("[data-go-cohort]").onclick = () => renderManager($id("classesDialog"), user, "cohorts");
    } else if (!active.length) {
      list.innerHTML = `<div class="empty-state-card manager-empty-state"><strong>No active classes yet.</strong><button type="button" class="primary-button" data-first-class>Create Class</button></div>`;
      list.querySelector("[data-first-class]").onclick = () => openClassEditor(null, () => renderManager($id("classesDialog"), user, "classes"));
    }
    active.forEach(item => list.appendChild(makeClassManagerCard(user, item)));
    container.appendChild(list);

    if (archived.length) {
      const archive = document.createElement("details");
      archive.className = "archive-section";
      archive.innerHTML = `<summary>Finished Classes <span>${archived.length}</span></summary><div class="class-manager-list" data-archived-classes></div>`;
      archived.forEach(item => archive.querySelector("[data-archived-classes]").appendChild(makeClassManagerCard(user, item)));
      container.appendChild(archive);
    }
  }

  function makeClassManagerCard(user, item) {
    const coverage = curriculumCoverage(user, item);
    const cohort = cohortForClass(user, item);
    const card = document.createElement("article");
    card.className = `class-manager-card ${item.archivedAt ? "archived-record" : ""}`;
    card.style.setProperty("--course-colour", item.colour || "#33C7FF");
    card.style.setProperty("--course-text", contrastText(item.colour || "#33C7FF"));
    card.innerHTML = `<button type="button" class="class-manager-main"><span class="class-colour-bar"></span><div><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(cohort?.name || "No Cohort")} · ${escapeHTML(formatGrades(item.grades))} · ${escapeHTML(formatSubjects(item.subjects, item.subject))}</span><div class="mini-coverage"><span>${coverage.addressedPct}% addressed</span><span>${coverage.taughtPct}% taught</span><span>${coverage.assessedPct}% assessed</span></div></div><em>${item.archivedAt ? "✓ Finished" : "→"}</em></button><div class="manager-card-actions"><button type="button" class="text-button" data-edit>Edit</button><button type="button" class="text-button" data-copy>Copy</button>${item.archivedAt ? '<button type="button" class="text-button" data-reactivate>Reactivate</button>' : '<button type="button" class="text-button" data-finish>Mark Finished</button>'}</div>`;
    card.querySelector(".class-manager-main").onclick = () => { $id("classesDialog")?.close(); openDashboard(item.id); };
    card.querySelector("[data-edit]").onclick = () => openClassEditor(item, () => renderManager($id("classesDialog"), user, "classes"));
    card.querySelector("[data-copy]").onclick = () => openClassEditor({ ...clone(item), id: "", name: "", nameIsCustom: false, archivedAt: null, coverageOverrides: {} }, () => renderManager($id("classesDialog"), user, "classes"), true);
    card.querySelector("[data-finish]")?.addEventListener("click", () => { item.archivedAt = nowISO(); item.updatedAt = nowISO(); saveData(); renderManager($id("classesDialog"), user, "classes"); refresh(); });
    card.querySelector("[data-reactivate]")?.addEventListener("click", () => { item.archivedAt = null; item.updatedAt = nowISO(); saveData(); renderManager($id("classesDialog"), user, "classes"); refresh(); });
    return card;
  }

  /* ==========================================================
     COHORT EDITOR
  ========================================================== */
  function openCohortEditor(item = null, onSaved = null) {
    const user = getActiveUser();
    if (!user || readOnlyMode) return;
    let dialog = $id("cohortEditorDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "cohortEditorDialog";
      dialog.className = "modal large-modal";
      document.body.appendChild(dialog);
    }
    const existing = item?.id ? cohortById(user, item.id) : null;
    const defaultName = uniqueDefaultCohortName(user, existing?.id || "");
    dialog.innerHTML = `<form class="modal-content" data-cohort-form><div class="modal-heading"><h2>${existing ? "Edit Cohort" : "New Cohort"}</h2><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Cohort Name <small>optional</small></span><input data-cohort-name maxlength="80" value="${escapeHTML(existing?.name || item?.name || "")}" placeholder="${escapeHTML(defaultName)}" /></label>${existing ? `<div class="cohort-count-summary"><strong>${existing.students.length}</strong><span>anonymous student profiles</span></div>` : '<label class="form-field"><span>Number of Students</span><input data-cohort-count type="number" min="0" max="100" step="1" value="0" /></label>'}<label class="form-field"><span>Notes <small>optional</small></span><textarea data-cohort-notes rows="3">${escapeHTML(existing?.notes || item?.notes || "")}</textarea></label><div class="modal-actions">${existing ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save Cohort</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
      if (!existing || !confirm(`Move “${existing.name}” to Trash? Classes remain saved but will temporarily have no Cohort until this is restored or reassigned.`)) return;
      const classIds = (user.classes || []).filter(entry => entry.cohortId === existing.id).map(entry => entry.id);
      const reminders = (user.interestReminders || []).filter(entry => entry.cohortId === existing.id).map(clone);
      window.TeacherHQTrash?.softDelete("cohort", existing, { parent: "user.cohorts", classIds, reminders });
      user.cohorts = user.cohorts.filter(entry => entry.id !== existing.id);
      user.interestReminders = (user.interestReminders || []).filter(entry => entry.cohortId !== existing.id);
      (user.classes || []).forEach(entry => { if (entry.cohortId === existing.id) entry.cohortId = ""; });
      saveData(); dialog.close(); onSaved?.(); refresh();
    });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const name = clean(dialog.querySelector("[data-cohort-name]").value) || defaultName;
      const notes = dialog.querySelector("[data-cohort-notes]").value;
      if (existing) {
        existing.name = name; existing.notes = notes; existing.updatedAt = nowISO();
      } else {
        const count = Math.min(100, Math.max(0, Number(dialog.querySelector("[data-cohort-count]")?.value) || 0));
        const created = normalizeCohort({ id: makeId("cohort"), name, notes, students: [] });
        created.students = makeStudents(count, []);
        user.cohorts.push(created);
      }
      saveData(); dialog.close(); onSaved?.(); refresh();
    };
    dialog.showModal();
  }

  function copyCohortSetup(user, source) {
    const copyNameBase = `${source.name} Copy`;
    const used = new Set((user.cohorts || []).map(item => item.name.toLowerCase()));
    let name = copyNameBase, n = 2;
    while (used.has(name.toLowerCase())) name = `${copyNameBase} ${n++}`;
    const copy = normalizeCohort({
      name,
      students: [],
      attentionGrabbers: clone(source.attentionGrabbers || []),
      context: clone(source.context),
      notes: source.notes,
      archivedAt: null
    });
    copy.students = makeStudents(source.students.length, []);
    user.cohorts.push(copy);
    saveData();
    renderManager($id("classesDialog"), user, "cohorts");
    refresh();
  }

  /* ==========================================================
     CLASS EDITOR
  ========================================================== */
  function availableGrades(user) {
    return typeof getAvailableGrades === "function" ? getAvailableGrades(user) : [...DEFAULT_GRADES, ...(user.customGrades || [])];
  }

  function availableSubjects(user) {
    const base = typeof getAvailableSubjects === "function" ? getAvailableSubjects(user) : [...DEFAULT_SUBJECTS, ...(user.customSubjects || [])];
    const regSubjects = registry() ? [...new Set(registry().curriculum.map(record => record.subject))] : [];
    return [...new Set([...base, ...regSubjects])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function openClassEditor(item = null, onSaved = null, isCopy = false) {
    const user = getActiveUser();
    if (!user || readOnlyMode) return;
    const cohorts = activeCohorts(user);
    if (!cohorts.length) return openManager("cohorts");
    let dialog = $id("classEditorDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "classEditorDialog";
      dialog.className = "modal extra-large-modal class-editor-dialog";
      document.body.appendChild(dialog);
    }
    const existing = item?.id && !isCopy ? classById(user, item.id) : null;
    const source = existing || item || {};
    const selectedGrades = new Set(source.grades || []);
    const selectedSubjects = new Set(normalizeSubjects(source.subjects, source.subject));
    if (!selectedSubjects.size && source.subject) selectedSubjects.add(source.subject);
    const chosenColour = normalizeHexColour?.(source.colour) || nextColour(user, existing?.id || "");
    dialog.innerHTML = `<form class="modal-content" data-class-form><div class="modal-heading"><h2>${existing ? "Edit Class" : isCopy ? "Copy Class" : "New Class"}</h2><button type="button" class="close-button" data-close>×</button></div><div class="class-title-colour-row"><label class="form-field class-name-field"><span>Class Name <small>optional</small></span><input data-class-name maxlength="80" value="${escapeHTML(existing?.nameIsCustom ? existing.name : isCopy ? "" : source.nameIsCustom ? source.name : "")}" placeholder="Generated automatically" /></label><label class="compact-colour-control" title="Course colour"><span>Colour</span><input data-class-colour type="color" value="${escapeHTML(chosenColour)}" /><i data-colour-preview style="--preview:${escapeHTML(chosenColour)}"></i></label></div><label class="form-field"><span>Cohort</span><select data-class-cohort required>${cohorts.map(cohort => `<option value="${escapeHTML(cohort.id)}" ${cohort.id === source.cohortId ? "selected" : ""}>${escapeHTML(cohort.name)}</option>`).join("")}</select></label><div class="class-editor-section"><strong>Grade(s)</strong><div data-grade-picker class="grade-tile-picker"></div><button type="button" class="text-button align-left" data-custom-grade>+ Custom Grade</button></div><div class="class-editor-section"><strong>Primary Subject</strong><select data-primary-subject required><option value="">Select subject</option>${availableSubjects(user).map(subject => `<option value="${escapeHTML(subject)}" ${subject === source.subject ? "selected" : ""}>${escapeHTML(subject)}</option>`).join("")}</select><details class="additional-subjects"><summary>Additional subjects <span>optional</span></summary><div data-additional-subjects class="subject-chip-picker"></div><button type="button" class="text-button align-left" data-custom-subject>+ Custom Subject</button></details></div><div class="class-curriculum-assignment"><strong>Curriculum Assignment</strong><div data-curriculum-preview class="curriculum-assignment-list"></div></div><label class="form-field"><span>Class Notes <small>optional</small></span><textarea data-class-notes rows="3">${escapeHTML(source.notes || "")}</textarea></label><div class="modal-actions">${existing ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save Class</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());

    const gradeWrap = dialog.querySelector("[data-grade-picker]");
    availableGrades(user).forEach(grade => {
      const label = document.createElement("label"); label.className = "grade-tile";
      label.innerHTML = `<input type="checkbox" value="${escapeHTML(grade)}" ${selectedGrades.has(grade) ? "checked" : ""}/><span>${escapeHTML(grade === "Kindergarten" ? "K" : grade)}</span>`;
      gradeWrap.appendChild(label);
    });

    const primary = dialog.querySelector("[data-primary-subject]");
    const additionalWrap = dialog.querySelector("[data-additional-subjects]");
    const drawAdditionalSubjects = () => {
      additionalWrap.innerHTML = "";
      availableSubjects(user).forEach(subject => {
        if (subject === primary.value) return;
        const label = document.createElement("label"); label.className = "subject-chip-check";
        label.innerHTML = `<input type="checkbox" value="${escapeHTML(subject)}" ${selectedSubjects.has(subject) ? "checked" : ""}/><span>${escapeHTML(subject)}</span>`;
        additionalWrap.appendChild(label);
      });
      additionalWrap.querySelectorAll("input").forEach(input => input.onchange = updatePreview);
    };

    const nameInput = dialog.querySelector("[data-class-name]");
    const colourInput = dialog.querySelector("[data-class-colour]");
    colourInput.oninput = () => dialog.querySelector("[data-colour-preview]").style.setProperty("--preview", colourInput.value);

    function chosenSubjects() {
      const list = [primary.value, ...[...additionalWrap.querySelectorAll("input:checked")].map(input => input.value)].filter(Boolean);
      return [...new Set(list)];
    }
    function updatePreview() {
      const grades = [...gradeWrap.querySelectorAll("input:checked")].map(input => input.value);
      const subjects = chosenSubjects();
      const preview = dialog.querySelector("[data-curriculum-preview]");
      if (!grades.length || !subjects.length) preview.innerHTML = '<span class="curriculum-empty">Choose a grade and subject.</span>';
      else preview.innerHTML = grades.flatMap(grade => subjects.map(subject => `<span class="curriculum-assignment-chip">${escapeHTML(grade)} ${escapeHTML(subject)}</span>`)).join("");
      if (!nameInput.value.trim()) nameInput.placeholder = uniqueDefaultClassName(user, grades, subjects, existing?.id || "");
    }

    gradeWrap.querySelectorAll("input").forEach(input => input.onchange = updatePreview);
    primary.onchange = () => { if (primary.value) selectedSubjects.add(primary.value); drawAdditionalSubjects(); updatePreview(); };
    dialog.querySelector("[data-custom-grade]").onclick = () => {
      const value = prompt("Enter the grade or class label:")?.trim();
      if (!value) return;
      if (!(user.customGrades || []).some(existingGrade => sameText(existingGrade, value))) user.customGrades.push(value);
      saveData();
      const state = { ...clone(source), id: existing?.id || "", grades: [...gradeWrap.querySelectorAll("input:checked")].map(input => input.value).concat(value), subjects: chosenSubjects(), subject: primary.value, name: nameInput.value, nameIsCustom: Boolean(nameInput.value.trim()), colour: colourInput.value, cohortId: dialog.querySelector("[data-class-cohort]").value, notes: dialog.querySelector("[data-class-notes]").value };
      dialog.close(); openClassEditor(state, onSaved, !existing);
    };
    dialog.querySelector("[data-custom-subject]").onclick = () => {
      const value = prompt("Enter the subject name:")?.trim();
      if (!value) return;
      if (!(user.customSubjects || []).some(existingSubject => sameText(existingSubject, value))) user.customSubjects.push(value);
      saveData(); selectedSubjects.add(value); drawAdditionalSubjects(); updatePreview();
    };

    dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
      if (!existing || !confirm(`Move “${existing.name}” to Trash? Units and lessons are preserved, but the live Class link is cleared until restored or reassigned.`)) return;
      const unitIds = (user.units || []).filter(unit => unit.classId === existing.id).map(unit => unit.id);
      const blockRefs = [];
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => (version.scheduleBlocks || []).forEach(block => {
        if (block.classId === existing.id) blockRefs.push({ termId: term.id, versionId: version.id, blockId: block.id });
      })));
      window.TeacherHQTrash?.softDelete("class", existing, { parent: "user.classes", unitIds, blockRefs });
      user.classes = user.classes.filter(entry => entry.id !== existing.id);
      (user.units || []).forEach(unit => { if (unit.classId === existing.id) unit.classId = ""; });
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => (version.scheduleBlocks || []).forEach(block => { if (block.classId === existing.id) block.classId = ""; })));
      saveData(); dialog.close(); onSaved?.(); refresh();
    });

    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const grades = [...gradeWrap.querySelectorAll("input:checked")].map(input => input.value);
      const subjects = chosenSubjects();
      if (!grades.length || !subjects.length || !primary.value) return alert("Choose at least one grade and a primary subject.");
      const id = existing?.id || makeId("class");
      const typedName = nameInput.value.trim();
      const name = typedName || uniqueDefaultClassName(user, grades, subjects, existing?.id || "");
      const saved = normalizeClass({
        id,
        cohortId: dialog.querySelector("[data-class-cohort]").value,
        name,
        nameIsCustom: Boolean(typedName),
        grades,
        subject: primary.value,
        subjects,
        notes: dialog.querySelector("[data-class-notes]").value,
        colour: colourInput.value,
        curriculumAssignments: grades.flatMap(grade => subjects.map(subject => ({ grade, subject }))),
        coverageOverrides: existing?.coverageOverrides || {},
        archivedAt: existing?.archivedAt || null,
        createdAt: existing?.createdAt || nowISO(),
        updatedAt: nowISO()
      }, user);
      const index = user.classes.findIndex(entry => entry.id === id);
      if (index >= 0) user.classes[index] = saved; else user.classes.push(saved);
      (user.terms || []).forEach(term => (term.scheduleVersions || []).forEach(version => (version.scheduleBlocks || []).forEach(block => {
        if (block.classId !== id) return;
        block.grades = [...saved.grades];
        if (!saved.subjects.includes(block.subject)) block.subject = saved.subject;
      })));
      (user.units || []).forEach(unit => {
        if (unit.classId !== id) return;
        unit.classSpec.grades = [...saved.grades];
        if (!saved.subjects.includes(unit.classSpec.subject)) unit.classSpec.subject = saved.subject;
        (unit.lessons || []).forEach(lesson => { lesson.classId = saved.id; lesson.classSpec = clone(unit.classSpec); });
      });
      saveData(); dialog.close(); onSaved?.(); refresh();
    };

    drawAdditionalSubjects(); updatePreview(); dialog.showModal();
  }

  /* ==========================================================
     SCHEDULE + UNIT INTEGRATION
  ========================================================== */
  function populateBlockClassSelect() {
    const user = getActiveUser();
    const select = $id("blockClass");
    if (!user || !select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Manual grade / subject</option>';
    activeClasses(user).sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      option.dataset.grades = JSON.stringify(item.grades);
      option.dataset.subject = item.subject;
      option.dataset.subjects = JSON.stringify(item.subjects || [item.subject]);
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
      const subjects = normalizeSubjects(teachingClass.subjects, teachingClass.subject);
      subjects.forEach(subject => {
        if (subjectSelect && ![...subjectSelect.options].some(option => option.value === subject)) {
          const option = document.createElement("option"); option.value = subject; option.textContent = subject; subjectSelect.appendChild(option);
        }
      });
      if (subjectSelect) subjectSelect.value = teachingClass.subject;
      if (teachingClass.grades.length > 1) {
        if ($id("splitClassCheckbox")) $id("splitClassCheckbox").checked = true;
        if (typeof updateSplitGradeVisibility === "function") updateSplitGradeVisibility();
        setTimeout(() => document.querySelectorAll("#splitGradeChoices input").forEach(input => { input.checked = teachingClass.grades.includes(input.value); }), 0);
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
    return activeClasses(user).map(item => {
      const cohort = cohortForClass(user, item);
      return {
        classId: item.id,
        id: item.id,
        name: cohort ? `${cohort.name} · ${item.name}` : item.name,
        className: item.name,
        grades: [...item.grades],
        subject: item.subject,
        subjects: [...normalizeSubjects(item.subjects, item.subject)],
        cohortId: item.cohortId,
        colour: item.colour
      };
    });
  }

  /* ==========================================================
     MAIN CLASS OVERVIEW + CLASS DASHBOARD
  ========================================================== */
  function renderClassOverview() {
    const user = getActiveUser();
    const container = $id("classOverviewList");
    if (!user || !container) return;
    const classes = activeClasses(user);
    container.innerHTML = "";
    if (!classes.length) {
      const archivedCount = ensureClasses(user).filter(item => item.archivedAt).length;
      container.innerHTML = `<div class="empty-state-card">${archivedCount ? "No active classes. Finished classes remain available in Manage Cohorts & Classes." : "Create a Cohort, then create the first Class you teach to that Cohort."}</div>`;
      return;
    }
    classes.forEach(item => {
      const coverage = curriculumCoverage(user, item);
      const units = unitsForClass(user, item);
      const cohort = cohortForClass(user, item);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "class-overview-card";
      card.style.setProperty("--course-colour", item.colour || "#33C7FF");
      card.innerHTML = `<span class="class-card-accent"></span><div class="class-card-heading"><div><p class="cohort-chip">${escapeHTML(cohort?.name || "No Cohort")}</p><h3>${escapeHTML(item.name)}</h3><span>${escapeHTML(formatGrades(item.grades))} · ${escapeHTML(formatSubjects(item.subjects, item.subject))}</span></div><span class="class-arrow">→</span></div><div class="coverage-bars"><div><span>Addressed</span><b>${coverage.addressedPct}%</b><i><em style="width:${coverage.addressedPct}%"></em></i></div><div><span>Taught</span><b>${coverage.taughtPct}%</b><i><em style="width:${coverage.taughtPct}%"></em></i></div><div><span>Assessed</span><b>${coverage.assessedPct}%</b><i><em style="width:${coverage.assessedPct}%"></em></i></div></div><small>${units.length} unit${units.length === 1 ? "" : "s"}</small>`;
      card.onclick = () => openDashboard(item.id);
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
    renderDashboard(dialog, user, teachingClass, tab);
    dialog.showModal();
  }

  function renderDashboard(dialog, user, teachingClass, tab) {
    const cohort = cohortForClass(user, teachingClass);
    dialog.querySelector("[data-class-dashboard-title]").textContent = `${teachingClass.archivedAt ? "✓ " : ""}${teachingClass.name}`;
    dialog.querySelector("[data-class-dashboard-meta]").textContent = `${cohort?.name || "No Cohort"} · ${formatGrades(teachingClass.grades)} · ${formatSubjects(teachingClass.subjects, teachingClass.subject)}`;
    const tabs = ["calendar", "units", "lessons", "curriculum", "assessments", "resources", "context"];
    const labels = { calendar: "Calendar", units: "Units", lessons: "Lessons", curriculum: "Curriculum Progress", assessments: "Assessments", resources: "Resources", context: "Cohort Context" };
    const nav = dialog.querySelector("[data-class-dashboard-tabs]");
    nav.innerHTML = tabs.map(id => `<button type="button" class="${tab === id ? "active" : ""}" data-class-tab="${id}">${labels[id]}</button>`).join("");
    nav.querySelectorAll("button").forEach(button => button.onclick = () => renderDashboard(dialog, user, teachingClass, button.dataset.classTab));
    const content = dialog.querySelector("[data-class-dashboard-content]"); content.innerHTML = "";
    if (tab === "curriculum") return renderCoverage(content, user, teachingClass);
    if (tab === "units") return renderUnits(content, user, teachingClass);
    if (tab === "lessons") return renderLessons(content, user, teachingClass);
    if (tab === "assessments") return renderAssessments(content, user, teachingClass);
    if (tab === "resources") return renderResources(content, user, teachingClass);
    if (tab === "context") return renderClassContext(content, user, teachingClass);
    return renderClassCalendar(content, user, teachingClass);
  }

  function renderCoverage(container, user, teachingClass) {
    const coverage = curriculumCoverage(user, teachingClass);
    const summary = document.createElement("div"); summary.className = "class-coverage-summary";
    summary.innerHTML = `<div><strong>${coverage.addressedPct}%</strong><span>Addressed</span></div><div><strong>${coverage.taughtPct}%</strong><span>Taught</span></div><div><strong>${coverage.assessedPct}%</strong><span>Assessed</span></div><div><strong>${coverage.coveredPct}%</strong><span>Taught + assessed</span></div>`;
    container.appendChild(summary);
    if (!coverage.records.length) return container.insertAdjacentHTML("beforeend", '<div class="empty-state-card">No detailed curriculum is loaded for this class yet.</div>');
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
        const row = document.createElement("article"); row.className = `coverage-record status-${status}`;
        row.innerHTML = `<span class="coverage-status-dot"></span><div><small>${escapeHTML(record.type || record.role || "Curriculum")}</small><p>${escapeHTML(record.text || record.learningOutcome || record.organizingIdeaDescription || "")}</p></div><select aria-label="Coverage status"><option value="auto">Auto · ${status.replace("-", " ")}</option><option value="planned">Planned</option><option value="introduced">Introduced</option><option value="developing">Developing</option><option value="taught">Taught</option><option value="assessed">Assessed</option><option value="covered">Covered</option><option value="not-planned">Not planned</option></select>`;
        const select = row.querySelector("select"); const override = teachingClass.coverageOverrides?.[record.id]; if (override) select.value = override; select.disabled = readOnlyMode;
        select.onchange = () => { teachingClass.coverageOverrides ||= {}; if (select.value === "auto") delete teachingClass.coverageOverrides[record.id]; else teachingClass.coverageOverrides[record.id] = select.value; teachingClass.updatedAt = nowISO(); saveData(); container.innerHTML = ""; renderCoverage(container, user, teachingClass); };
        list.appendChild(row);
      });
      tree.appendChild(details);
    });
    container.appendChild(tree);
  }

  function renderUnits(container, user, teachingClass) {
    const units = unitsForClass(user, teachingClass);
    const top = document.createElement("div"); top.className = "class-dashboard-action-row";
    top.innerHTML = `<span>${units.length} unit${units.length === 1 ? "" : "s"}</span>${readOnlyMode || teachingClass.archivedAt ? "" : '<button class="primary-button" type="button">+ New Unit</button>'}`;
    top.querySelector("button")?.addEventListener("click", () => { $id("classDashboardDialog")?.close(); openUnitWizard(); setTimeout(() => { const select = $id("unitClassSelect"); if (select) { const option = [...select.options].find(item => item.dataset.classId === teachingClass.id); if (option) { select.value = option.value; select.dispatchEvent(new Event("change", { bubbles: true })); } } }, 0); });
    container.appendChild(top);
    const grid = document.createElement("div"); grid.className = "unit-overview-list grouped-unit-list";
    units.forEach(unit => {
      const wrap = document.createElement("div"); wrap.className = "unit-copy-wrap"; wrap.appendChild(makeUnitCard(unit, false));
      if (!readOnlyMode) {
        const copyButton = document.createElement("button"); copyButton.type = "button"; copyButton.className = "secondary-button copy-unit-button"; copyButton.textContent = "Copy Unit"; copyButton.onclick = event => { event.stopPropagation(); openCopyUnitDialog(unit, teachingClass); };
        wrap.appendChild(copyButton);
      }
      grid.appendChild(wrap);
    });
    if (!units.length) grid.innerHTML = '<div class="empty-state-card">No Units yet.</div>';
    container.appendChild(grid);
  }

  function openCopyUnitDialog(sourceUnit, sourceClass) {
    const user = getActiveUser(); if (!user || readOnlyMode) return;
    const destinations = activeClasses(user);
    if (!destinations.length) return alert("Create an active Class first.");
    let dialog = $id("copyUnitDialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "copyUnitDialog"; dialog.className = "modal large-modal"; document.body.appendChild(dialog); }
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><h2>Copy Unit</h2><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Copy to Class</span><select data-copy-class>${destinations.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === sourceClass.id ? "selected" : ""}>${escapeHTML(item.name)} · ${escapeHTML(cohortForClass(user, item)?.name || "No Cohort")}</option>`).join("")}</select></label><label class="form-field"><span>New Unit Name</span><input data-copy-name value="${escapeHTML(`${sourceUnit.name} Copy`)}" maxlength="100" /></label><label class="form-field"><span>Start Date</span><input data-copy-date type="date" required /></label><div class="copy-unit-note">Planning content, curriculum, rubrics, resources and lesson-plan structure are copied. The new copy is re-scheduled into the destination Class's valid instructional blocks; old field-trip dates and assessment dates are cleared.</div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Create Copy</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const destination = classById(user, dialog.querySelector("[data-copy-class]").value);
      const startDate = dialog.querySelector("[data-copy-date]").value;
      if (!destination || !startDate) return;
      const copied = clone(sourceUnit);
      copied.id = makeId("unit"); copied.name = clean(dialog.querySelector("[data-copy-name]").value) || `${sourceUnit.name} Copy`;
      copied.classId = destination.id;
      const destinationSubjects = normalizeSubjects(destination.subjects, destination.subject);
      copied.classSpec = { grades: [...destination.grades], subject: destinationSubjects.includes(sourceUnit.classSpec?.subject) ? sourceUnit.classSpec.subject : destination.subject };
      copied.colour = typeof suggestedUnitColour === "function" ? suggestedUnitColour(user, copied.classSpec, null, sourceUnit.colour) : sourceUnit.colour;
      copied.startDate = startDate; copied.createdAt = nowISO(); copied.updatedAt = nowISO(); copied.needsScheduleReview = false;
      copied.workspace ||= {};
      copied.workspace.fieldTrips = (copied.workspace.fieldTrips || []).map(trip => ({
        ...trip,
        id: makeId("field-trip"),
        startDate: "",
        endDate: "",
        manualOverride: false,
        createdAt: nowISO(),
        updatedAt: nowISO()
      }));
      const assessmentIdMap = new Map();
      copied.workspace.assessments = (copied.workspace.assessments || []).map(assessment => {
        const newId = makeId("assessment");
        assessmentIdMap.set(assessment.id, newId);
        return { ...assessment, id: newId, date: "", startDate: "", endDate: "", toStudentsDate: "", fromStudentsDate: "", createdAt: nowISO(), updatedAt: nowISO() };
      });
      const sourceLessonPlans = sourceUnit.workspace?.lessonPlans || {};
      const sourceLessons = [...(sourceUnit.lessons || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      copied.lessons = [];
      const result = typeof allocateLessons === "function" ? allocateLessons(copied, user, startDate, null, []) : { lessons: [], scheduledMinutes: 0 };
      copied.lessons = result.lessons;
      copied.needsScheduleReview = result.scheduledMinutes < copied.targetMinutes;
      copied.workspace.lessonPlans = {};
      copied.lessons.forEach((lesson, index) => {
        lesson.classId = destination.id;
        const sourceLesson = sourceLessons[index];
        const plan = sourceLesson ? sourceLessonPlans[sourceLesson.id] : null;
        if (sourceLesson?.customTitle) lesson.customTitle = sourceLesson.customTitle;
        if (!plan) return;
        const newPlan = clone(plan);
        newPlan.lessonId = lesson.id;
        newPlan.complete = false;
        newPlan.reflection = { text: "", url: "", completed: false, updatedAt: "" };
        if (newPlan.general) newPlan.general.cohortContext = { cohortId: "", cultureIds: [], schoolSettingIds: [], classroomSettingId: "", complexitiesIds: [] };
        if (newPlan.assessments?.links) newPlan.assessments.links = newPlan.assessments.links.map(link => ({
          ...link,
          assessmentId: assessmentIdMap.get(link.assessmentId) || "",
          toStudentsDate: "",
          fromStudentsDate: ""
        })).filter(link => link.assessmentId);
        copied.workspace.lessonPlans[lesson.id] = newPlan;
      });
      user.units.push(typeof normalizeUnit === "function" ? normalizeUnit(copied) : copied);
      saveData(); dialog.close(); $id("classDashboardDialog")?.close(); refresh(); openDashboard(destination.id, "units");
    };
    dialog.showModal();
  }

  function renderLessons(container, user, teachingClass) {
    const units = unitsForClass(user, teachingClass);
    const list = document.createElement("div"); list.className = "class-lesson-list";
    const lessons = units.flatMap(unit => (unit.lessons || []).map(lesson => ({ unit, lesson }))).sort((a, b) => a.lesson.dateKey.localeCompare(b.lesson.dateKey) || a.lesson.startTime.localeCompare(b.lesson.startTime));
    lessons.forEach(({ unit, lesson }) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "class-lesson-row"; button.style.setProperty("--unit-colour", unit.colour || teachingClass.colour);
      button.innerHTML = `<span>${escapeHTML(formatDate(lesson.dateKey))}</span><strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong><small>${escapeHTML(unit.name)} · ${escapeHTML(formatTime(lesson.startTime))}</small>`;
      button.onclick = () => { $id("classDashboardDialog")?.close(); openLessonPlaceholder(unit.id, lesson.id); };
      list.appendChild(button);
    });
    if (!lessons.length) list.innerHTML = '<div class="empty-state-card">No allocated Lessons yet.</div>';
    container.appendChild(list);
  }

  function renderAssessments(container, user, teachingClass) {
    const items = unitsForClass(user, teachingClass).flatMap(unit => (unit.workspace?.assessments || []).filter(a => a.status !== "draft").map(assessment => ({ unit, assessment }))).sort((a, b) => (a.assessment.date || "").localeCompare(b.assessment.date || ""));
    const list = document.createElement("div"); list.className = "class-assessment-list";
    items.forEach(({ unit, assessment }) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "class-assessment-row";
      button.innerHTML = `<span class="assessment-kind ${assessment.type}">${escapeHTML(assessmentTypeLabel(assessment.type))}</span><div><strong>${escapeHTML(assessment.title)}</strong><small>${assessment.date ? escapeHTML(formatDate(assessment.date)) : "No date"} · ${escapeHTML(unit.name)}</small></div>`;
      button.onclick = () => { $id("classDashboardDialog")?.close(); activeUnitWorkspaceId = unit.id; activeUnitWorkspaceSection = "assessments"; workspaceAssessmentEditorId = assessment.id; renderUnitWorkspace(); };
      list.appendChild(button);
    });
    if (!items.length) list.innerHTML = '<div class="empty-state-card">No assessments yet.</div>';
    container.appendChild(list);
  }

  function renderResources(container, user, teachingClass) {
    const units = unitsForClass(user, teachingClass);
    const ids = new Set(units.flatMap(unit => unit.workspace?.resourceIds || []));
    const records = (user.resourceLibrary || []).filter(item => ids.has(item.id));
    const list = document.createElement("div"); list.className = "resource-library-list";
    records.forEach(item => { const row = document.createElement("article"); row.className = "resource-library-card"; row.innerHTML = `<strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.kind)}</span>${item.url ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener">Open link</a>` : ""}${item.driveUrl ? `<a href="${escapeHTML(item.driveUrl)}" target="_blank" rel="noopener">Open Drive link</a>` : ""}`; list.appendChild(row); });
    if (!records.length) list.innerHTML = '<div class="empty-state-card">No resources are linked to this class\'s Units yet.</div>';
    container.appendChild(list);
  }

  function renderClassContext(container, user, teachingClass) {
    const cohort = cohortForClass(user, teachingClass);
    if (!cohort) return container.insertAdjacentHTML("beforeend", '<div class="empty-state-card">This Class is not linked to a Cohort.</div>');
    const shell = document.createElement("div"); shell.className = "class-cohort-context";
    shell.innerHTML = `<div class="class-dashboard-action-row"><div><strong>${escapeHTML(cohort.name)}</strong><span>${cohort.students.length} anonymous students</span></div>${readOnlyMode ? "" : '<button type="button" class="secondary-button">Open Cohort</button>'}</div>`;
    shell.querySelector("button")?.addEventListener("click", () => { $id("classDashboardDialog")?.close(); openCohortDashboard(cohort.id, "context"); });
    CONTEXT_MODULES.forEach(module => {
      const items = cohort.context?.[module.key] || [];
      const card = document.createElement("section"); card.className = "cohort-context-read-card";
      card.innerHTML = `<h4>${escapeHTML(module.label)}</h4>${items.length ? `<ul>${items.map(item => `<li><strong>${escapeHTML(item.title)}</strong>${item.description ? `<span>${escapeHTML(item.description)}</span>` : ""}</li>`).join("")}</ul>` : '<span class="muted">No entries yet.</span>'}`;
      shell.appendChild(card);
    });
    container.appendChild(shell);
  }

  function renderClassCalendar(container, user, teachingClass) {
    const date = new Date(); const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const shell = document.createElement("div"); shell.className = "class-calendar-shell"; shell.dataset.year = start.getFullYear(); shell.dataset.month = start.getMonth();
    const draw = () => {
      const year = Number(shell.dataset.year), month = Number(shell.dataset.month), view = new Date(year, month, 1);
      shell.innerHTML = `<div class="calendar-header"><div><p class="small-label">Class Calendar</p><h3>${view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3></div><div class="calendar-controls"><button type="button" data-prev>←</button><button type="button" data-next>→</button></div></div><div class="class-calendar-grid"></div>`;
      const grid = shell.querySelector(".class-calendar-grid"); ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => grid.insertAdjacentHTML("beforeend", `<div class="weekday-name">${d}</div>`));
      const first = view.getDay(), days = new Date(year, month + 1, 0).getDate(); for (let i = 0; i < first; i++) grid.insertAdjacentHTML("beforeend", '<div class="class-calendar-day blank"></div>');
      const units = unitsForClass(user, teachingClass);
      for (let day = 1; day <= days; day++) {
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, dow = new Date(year, month, day).getDay();
        const cell = document.createElement("button"); cell.type = "button"; cell.className = `class-calendar-day ${dow === 0 || dow === 6 ? "weekend" : ""}`; cell.innerHTML = `<span>${day}</span><div></div>`; const inner = cell.querySelector("div");
        const exception = getExceptionForDate(user, key); if (exception) { cell.classList.add("day-off"); inner.insertAdjacentHTML("beforeend", `<small class="day-off-label">${escapeHTML(exception.label || exception.type)}</small>`); }
        units.forEach(unit => (unit.lessons || []).filter(l => l.dateKey === key).forEach(lesson => { const colour = unit.colour || teachingClass.colour || "#61B6FF"; inner.insertAdjacentHTML("beforeend", `<small class="class-calendar-lesson" style="--unit-colour:${escapeHTML(colour)};--auto-fg:${escapeHTML(contrastText(colour))}">${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</small>`); }));
        cell.onclick = () => openDayDetails(key); grid.appendChild(cell);
      }
      shell.querySelector("[data-prev]").onclick = () => { const d = new Date(year, month - 1, 1); shell.dataset.year = d.getFullYear(); shell.dataset.month = d.getMonth(); draw(); };
      shell.querySelector("[data-next]").onclick = () => { const d = new Date(year, month + 1, 1); shell.dataset.year = d.getFullYear(); shell.dataset.month = d.getMonth(); draw(); };
    };
    draw(); container.appendChild(shell);
  }

  /* ==========================================================
     COHORT DASHBOARD: CONTEXT, STUDENTS/INTERESTS, REMINDERS
  ========================================================== */
  function createCohortDashboardDialog() {
    let dialog = $id("cohortDashboardDialog"); if (dialog) return dialog;
    dialog = document.createElement("dialog"); dialog.id = "cohortDashboardDialog"; dialog.className = "modal extra-large-modal cohort-dashboard-dialog";
    dialog.innerHTML = '<div class="modal-content"><div class="modal-heading"><div><p class="small-label">Cohort Dashboard</p><h2 data-cohort-title></h2><p data-cohort-meta class="section-subtitle"></p></div><button type="button" class="close-button" data-close>×</button></div><nav class="class-dashboard-tabs" data-cohort-tabs></nav><div data-cohort-content></div></div>';
    document.body.appendChild(dialog); dialog.querySelector("[data-close]").onclick = () => dialog.close(); dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }); return dialog;
  }

  function openCohortDashboard(cohortId, tab = "students") {
    const user = getActiveUser(), cohort = cohortById(user, cohortId); if (!cohort) return;
    const dialog = createCohortDashboardDialog(); dialog.dataset.cohortId = cohortId; renderCohortDashboard(dialog, user, cohort, tab); dialog.showModal();
  }

  function renderCohortDashboard(dialog, user, cohort, tab) {
    dialog.querySelector("[data-cohort-title]").textContent = `${cohort.archivedAt ? "✓ " : ""}${cohort.name}`;
    dialog.querySelector("[data-cohort-meta]").textContent = `${cohort.students.length} anonymous student profile${cohort.students.length === 1 ? "" : "s"}`;
    const tabs = ["students", "attention", "context", "curriculum", "assessments", "reminders", "classes"];
    const labels = { students: "Students & Interests", attention: "Attention Grabbers", context: "Context", curriculum: "Curriculum Progress", assessments: "Assessments", reminders: "Interest Reminders", classes: "Classes" };
    const nav = dialog.querySelector("[data-cohort-tabs]"); nav.innerHTML = tabs.map(id => `<button type="button" class="${tab === id ? "active" : ""}" data-tab="${id}">${labels[id]}</button>`).join("");
    nav.querySelectorAll("button").forEach(button => button.onclick = () => renderCohortDashboard(dialog, user, cohort, button.dataset.tab));
    const content = dialog.querySelector("[data-cohort-content]"); content.innerHTML = "";
    if (tab === "students") return renderCohortStudents(content, user, cohort, dialog);
    if (tab === "attention") return renderAttentionGrabbers(content, user, cohort, dialog);
    if (tab === "curriculum") return renderCohortCurriculumProgress(content, user, cohort, dialog);
    if (tab === "assessments") return renderCohortAssessments(content, user, cohort, dialog);
    if (tab === "reminders") return renderInterestReminders(content, user, cohort, dialog);
    if (tab === "classes") return renderCohortClasses(content, user, cohort);
    return renderCohortContext(content, user, cohort, dialog);
  }

  function renderCohortContext(container, user, cohort, dialog) {
    const grid = document.createElement("div"); grid.className = "cohort-context-grid";
    CONTEXT_MODULES.forEach(module => {
      const card = document.createElement("section"); card.className = "cohort-context-module";
      const items = cohort.context?.[module.key] || [];
      card.innerHTML = `<div class="cohort-module-heading"><div><h3>${escapeHTML(module.label)}</h3><p>${escapeHTML(module.help)}</p></div>${readOnlyMode ? "" : `<button type="button" class="icon-button" data-add title="Add ${escapeHTML(module.label)} item">+</button>`}</div><ul class="context-bullet-list"></ul>`;
      const list = card.querySelector("ul");
      if (!items.length) list.innerHTML = '<li class="empty-context-item">No entries yet.</li>';
      items.forEach(item => {
        const li = document.createElement("li");
        li.className = `context-bullet-item ${item.useByDefault ? "default-context" : ""}`;
        li.innerHTML = `<button type="button"><span class="bullet-dot">•</span><div><strong>${escapeHTML(item.title)}</strong>${item.description ? `<small>${escapeHTML(item.description)}</small>` : ""}</div>${item.useByDefault ? '<em>Default</em>' : ""}</button>`;
        li.querySelector("button").disabled = readOnlyMode;
        li.querySelector("button").onclick = () => openContextItemEditor(user, cohort, module, item, () => renderCohortDashboard(dialog, user, cohort, "context"));
        list.appendChild(li);
      });
      card.querySelector("[data-add]")?.addEventListener("click", () => openContextItemEditor(user, cohort, module, null, () => renderCohortDashboard(dialog, user, cohort, "context")));
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  function openContextItemEditor(user, cohort, module, item, onSaved) {
    let dialog = $id("cohortContextItemDialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "cohortContextItemDialog"; dialog.className = "modal"; document.body.appendChild(dialog); }
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><h2>${item ? "Edit" : "Add"} ${escapeHTML(module.label)}</h2><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Point</span><input data-title required maxlength="120" value="${escapeHTML(item?.title || "")}" placeholder="Short point-form entry" /></label><label class="form-field"><span>Description <small>optional</small></span><textarea data-description rows="4" placeholder="Add detail only when it is useful for planning.">${escapeHTML(item?.description || "")}</textarea></label><label class="checkbox-row"><input data-default type="checkbox" ${item?.useByDefault !== false ? "checked" : ""}/><span>${module.key === "classroomSetting" ? "Use as the usual classroom location" : "Use by default in lesson context"}</span></label><div class="modal-actions">${item ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => { cohort.context[module.key] = cohort.context[module.key].filter(entry => entry.id !== item.id); cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.(); });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault(); const title = clean(dialog.querySelector("[data-title]").value); if (!title) return;
      const useByDefault = dialog.querySelector("[data-default]").checked;
      if (module.key === "classroomSetting" && useByDefault) cohort.context[module.key].forEach(entry => { entry.useByDefault = false; });
      if (item) { item.title = title; item.description = dialog.querySelector("[data-description]").value; item.useByDefault = useByDefault; item.updatedAt = nowISO(); }
      else cohort.context[module.key].push(normalizeContextItem({ title, description: dialog.querySelector("[data-description]").value, useByDefault }, module.key));
      cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.();
    };
    dialog.showModal();
  }

  function renderCohortStudents(container, user, cohort, dialog) {
    const top = document.createElement("div"); top.className = "class-dashboard-action-row";
    const summary = interestSummary(cohort);
    top.innerHTML = `<div><strong>${cohort.students.length} students</strong><span>${summary.length} distinct interest tag${summary.length === 1 ? "" : "s"}</span></div>${readOnlyMode || cohort.students.length >= 100 ? "" : '<button type="button" class="primary-button">+ Add Student</button>'}`;
    top.querySelector("button")?.addEventListener("click", () => { const used = new Set(cohort.students.map(student => student.code)); const code = availableStudentCode(used); if (code == null) return alert("This Cohort already uses all 100 two-digit student codes."); cohort.students.push(normalizeStudent({ code }, used)); cohort.updatedAt = nowISO(); saveData(); renderCohortDashboard(dialog, user, cohort, "students"); });
    container.appendChild(top);

    if (summary.length) {
      const cloud = document.createElement("div"); cloud.className = "cohort-interest-cloud";
      cloud.innerHTML = summary.map(item => `<span>${escapeHTML(item.tag)} <b>${item.count}</b></span>`).join(""); container.appendChild(cloud);
    }

    const list = document.createElement("div"); list.className = "student-roster-list";
    cohort.students.slice().sort((a, b) => a.code.localeCompare(b.code)).forEach(student => {
      const row = document.createElement("article"); row.className = "student-profile-row";
      row.innerHTML = `<div class="student-code">${escapeHTML(student.code)}</div><div class="student-profile-main"><label><span>Optional nickname</span><input data-nickname value="${escapeHTML(student.nickname || "")}" placeholder="Leave blank to stay code-only" ${readOnlyMode ? "disabled" : ""}/></label><div class="student-subsection-label">Interests</div><div class="student-interest-tags"></div><div class="student-subsection-label">Individual complexities</div><div class="student-complexity-tags"></div></div>${readOnlyMode ? "" : '<div class="student-profile-actions"><button type="button" class="secondary-button" data-add-interest>+ Interest</button><button type="button" class="secondary-button" data-add-complexity>+ Factor</button></div>'}`;
      const tags = row.querySelector(".student-interest-tags");
      (student.interests || []).forEach(interest => {
        const button = document.createElement("button"); button.type = "button"; button.className = "interest-tag"; button.textContent = interest.tag; button.title = interest.description || "Click to add/edit description"; button.disabled = readOnlyMode; button.onclick = () => openInterestEditor(user, cohort, student, interest, () => renderCohortDashboard(dialog, user, cohort, "students")); tags.appendChild(button);
      });
      if (!(student.interests || []).length) tags.innerHTML = '<span class="no-interest-tags">No interests recorded yet</span>';
      const complexityTags = row.querySelector(".student-complexity-tags");
      (student.complexities || []).forEach(item => {
        const button = document.createElement("button"); button.type = "button"; button.className = "student-complexity-tag"; button.textContent = item.title; button.title = item.description || "Click to add/edit this individual factor"; button.disabled = readOnlyMode; button.onclick = () => openStudentComplexityEditor(user, cohort, student, item, () => renderCohortDashboard(dialog, user, cohort, "students")); complexityTags.appendChild(button);
      });
      if (!(student.complexities || []).length) complexityTags.innerHTML = '<span class="no-interest-tags">No individual factors recorded</span>';
      row.querySelector("[data-nickname]")?.addEventListener("change", event => { student.nickname = clean(event.target.value); student.updatedAt = nowISO(); cohort.updatedAt = nowISO(); saveData(); });
      row.querySelector("[data-add-interest]")?.addEventListener("click", () => openInterestEditor(user, cohort, student, null, () => renderCohortDashboard(dialog, user, cohort, "students")));
      row.querySelector("[data-add-complexity]")?.addEventListener("click", () => openStudentComplexityEditor(user, cohort, student, null, () => renderCohortDashboard(dialog, user, cohort, "students")));
      list.appendChild(row);
    });
    if (!cohort.students.length) list.innerHTML = '<div class="empty-state-card">No student profiles yet.</div>';
    container.appendChild(list);
  }

  function openInterestEditor(user, cohort, student, interest, onSaved) {
    let dialog = $id("studentInterestDialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "studentInterestDialog"; dialog.className = "modal"; document.body.appendChild(dialog); }
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><div><p class="small-label">Student ${escapeHTML(student.code)}</p><h2>${interest ? "Edit Interest" : "Add Interest"}</h2></div><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Interest Tag</span><input data-tag required maxlength="60" value="${escapeHTML(interest?.tag || "")}" placeholder="e.g., farming, hockey, Minecraft" /></label><label class="form-field"><span>Description <small>optional</small></span><textarea data-description rows="4" placeholder="Anything useful about this interest for future planning or simulations.">${escapeHTML(interest?.description || "")}</textarea></label><div class="modal-actions">${interest ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save Interest</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => { student.interests = student.interests.filter(entry => entry.id !== interest.id); student.updatedAt = nowISO(); cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.(); });
    dialog.querySelector("form").onsubmit = event => { event.preventDefault(); const tag = clean(dialog.querySelector("[data-tag]").value); if (!tag) return; if (interest) { interest.tag = tag; interest.description = dialog.querySelector("[data-description]").value; interest.updatedAt = nowISO(); } else student.interests.push(normalizeInterest({ tag, description: dialog.querySelector("[data-description]").value })); student.updatedAt = nowISO(); cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.(); };
    dialog.showModal();
  }

  function openStudentComplexityEditor(user, cohort, student, item, onSaved) {
    let dialog = $id("studentComplexityDialog");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "studentComplexityDialog"; dialog.className = "modal"; document.body.appendChild(dialog); }
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><div><p class="small-label">Student ${escapeHTML(student.code)}</p><h2>${item ? "Edit" : "Add"} Individual Complexity</h2></div><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Factor</span><input data-title required maxlength="100" value="${escapeHTML(item?.title || "")}" placeholder="Short planning note" /></label><label class="form-field"><span>Description <small>optional</small></span><textarea data-description rows="4" placeholder="Describe the factor only as much as is useful for teaching and planning.">${escapeHTML(item?.description || "")}</textarea></label><div class="modal-actions">${item ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save Factor</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
      student.complexities = (student.complexities || []).filter(entry => entry.id !== item.id);
      student.updatedAt = nowISO(); cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.();
    });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const title = clean(dialog.querySelector("[data-title]").value); if (!title) return;
      if (item) { item.title = title; item.description = dialog.querySelector("[data-description]").value; item.updatedAt = nowISO(); }
      else { student.complexities ||= []; student.complexities.push(normalizeContextItem({ title, description: dialog.querySelector("[data-description]").value, useByDefault: false }, "studentComplexities")); }
      student.updatedAt = nowISO(); cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.();
    };
    dialog.showModal();
  }

  function renderAttentionGrabbers(container, user, cohort, dialog) {
    cohort.attentionGrabbers ||= [];
    const intro = document.createElement("div");
    intro.className = "cohort-workspace-intro attention-grabber-intro";
    intro.innerHTML = `<div><p class="small-label">Cohort routine library</p><h3>Attention Grabbers</h3><p>Reusable actions for getting this Cohort's attention. These become selectable inside a Lesson Planner Hook.</p></div>${readOnlyMode ? "" : '<button type="button" class="primary-button" data-add-attention>+ Add Attention Grabber</button>'}`;
    intro.querySelector("[data-add-attention]")?.addEventListener("click", () => openAttentionGrabberEditor(user, cohort, null, () => renderCohortDashboard(dialog, user, cohort, "attention")));
    container.appendChild(intro);
    const grid = document.createElement("div"); grid.className = "attention-grabber-grid";
    cohort.attentionGrabbers.forEach(item => {
      const card = document.createElement("article"); card.className = "attention-grabber-card";
      card.innerHTML = `<div class="attention-grabber-card-icon">!</div><div><strong>${escapeHTML(item.title)}</strong><p>${item.description ? escapeHTML(item.description) : '<span class="muted">No description yet.</span>'}</p></div>${readOnlyMode ? "" : '<button type="button" class="text-button" data-edit>Edit</button>'}`;
      card.querySelector("[data-edit]")?.addEventListener("click", () => openAttentionGrabberEditor(user, cohort, item, () => renderCohortDashboard(dialog, user, cohort, "attention")));
      grid.appendChild(card);
    });
    if (!cohort.attentionGrabbers.length) grid.innerHTML = '<div class="empty-state-card"><strong>No Attention Grabbers yet.</strong><p>Add routines such as a clap sequence, call-and-response, countdown, or another Cohort-specific attention routine.</p></div>';
    container.appendChild(grid);
  }

  function openAttentionGrabberEditor(user, cohort, item, onSaved) {
    let dialog = $id("attentionGrabberEditorDialog");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "attentionGrabberEditorDialog"; dialog.className = "modal"; document.body.appendChild(dialog); }
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><div><p class="small-label">${escapeHTML(cohort.name)}</p><h2>${item ? "Edit" : "Add"} Attention Grabber</h2></div><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Name</span><input data-title required maxlength="90" value="${escapeHTML(item?.title || "")}" placeholder="Clap sequence" /></label><label class="form-field"><span>Description</span><textarea data-description rows="6" placeholder="Describe the action clearly enough to use it during a lesson.">${escapeHTML(item?.description || "")}</textarea></label><div class="modal-actions">${item ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save Attention Grabber</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
      cohort.attentionGrabbers = cohort.attentionGrabbers.filter(entry => entry.id !== item.id);
      cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.();
    });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault(); const title = clean(dialog.querySelector("[data-title]").value); if (!title) return;
      if (item) { item.title = title; item.description = dialog.querySelector("[data-description]").value; item.updatedAt = nowISO(); }
      else cohort.attentionGrabbers.push(normalizeAttentionGrabber({ title, description: dialog.querySelector("[data-description]").value }));
      cohort.updatedAt = nowISO(); saveData(); dialog.close(); onSaved?.();
    };
    dialog.showModal();
  }

  function renderCohortCurriculumProgress(container, user, cohort, dialog) {
    const linked = (user.classes || []).filter(item => item.cohortId === cohort.id);
    const intro = document.createElement("div"); intro.className = "cohort-workspace-intro curriculum-progress-intro";
    intro.innerHTML = `<div><p class="small-label">Across this Cohort</p><h3>Curriculum Progress</h3><p>Each Class keeps its own curriculum record. Progress here is a visual overview, not a binary completion list.</p></div>`;
    container.appendChild(intro);
    const grid = document.createElement("div"); grid.className = "cohort-progress-grid";
    linked.forEach(teachingClass => {
      const coverage = curriculumCoverage(user, teachingClass);
      const card = document.createElement("button"); card.type = "button"; card.className = `cohort-progress-card ${teachingClass.archivedAt ? "archived-record" : ""}`; card.style.setProperty("--course-colour", teachingClass.colour || "#61B6FF");
      card.innerHTML = `<header><div><small>${teachingClass.archivedAt ? "✓ Finished Class" : "Class"}</small><strong>${escapeHTML(teachingClass.name)}</strong></div><span>→</span></header><div class="cohort-progress-bars"><div><span><b>Planned</b><em>${coverage.total ? Math.round(coverage.planned.size / coverage.total * 100) : 0}%</em></span><i><u style="width:${coverage.total ? Math.round(coverage.planned.size / coverage.total * 100) : 0}%"></u></i></div><div><span><b>Introduced</b><em>${coverage.total ? Math.round(coverage.introduced.size / coverage.total * 100) : 0}%</em></span><i><u style="width:${coverage.total ? Math.round(coverage.introduced.size / coverage.total * 100) : 0}%"></u></i></div><div><span><b>Developing</b><em>${coverage.total ? Math.round(coverage.developing.size / coverage.total * 100) : 0}%</em></span><i><u style="width:${coverage.total ? Math.round(coverage.developing.size / coverage.total * 100) : 0}%"></u></i></div><div><span><b>Taught</b><em>${coverage.taughtPct}%</em></span><i><u style="width:${coverage.taughtPct}%"></u></i></div><div><span><b>Assessed</b><em>${coverage.assessedPct}%</em></span><i><u style="width:${coverage.assessedPct}%"></u></i></div></div><footer><span>${coverage.total} curriculum objectives</span><strong>${coverage.coveredPct}% taught + assessed</strong></footer>`;
      card.onclick = () => { dialog.close(); openDashboard(teachingClass.id, "curriculum"); };
      grid.appendChild(card);
    });
    if (!linked.length) grid.innerHTML = '<div class="empty-state-card"><strong>No Classes are linked yet.</strong><p>Create a Class and attach this Cohort to begin tracking curriculum progress.</p></div>';
    container.appendChild(grid);
  }

  function renderCohortAssessments(container, user, cohort, dialog) {
    const classIds = new Set((user.classes || []).filter(item => item.cohortId === cohort.id).map(item => item.id));
    const items = (user.units || []).filter(unit => classIds.has(unit.classId)).flatMap(unit => (unit.workspace?.assessments || []).filter(a => a.status !== "draft").map(assessment => ({ unit, assessment, teachingClass: classById(user, unit.classId) }))).sort((a, b) => (a.assessment.date || "9999").localeCompare(b.assessment.date || "9999"));
    const intro = document.createElement("div"); intro.className = "cohort-workspace-intro cohort-assessment-intro";
    intro.innerHTML = `<div><p class="small-label">Assessment timeline</p><h3>${items.length} Assessment${items.length === 1 ? "" : "s"}</h3><p>Assessment information from every Class attached to this Cohort.</p></div>`; container.appendChild(intro);
    const list = document.createElement("div"); list.className = "cohort-assessment-list";
    items.forEach(({ unit, assessment, teachingClass }) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "cohort-assessment-row"; button.style.setProperty("--course-colour", teachingClass?.colour || unit.colour || "#61B6FF");
      button.innerHTML = `<span class="assessment-kind ${escapeHTML(assessment.type || "")}">${escapeHTML(assessmentTypeLabel(assessment.type))}</span><div><strong>${escapeHTML(assessment.title)}</strong><small>${assessment.date ? escapeHTML(formatDate(assessment.date)) : "No date"} · ${escapeHTML(teachingClass?.name || classLabel(unit.classSpec))} · ${escapeHTML(unit.name)}</small></div><em>→</em>`;
      button.onclick = () => { dialog.close(); activeUnitWorkspaceId = unit.id; activeUnitWorkspaceSection = "assessments"; workspaceAssessmentEditorId = assessment.id; renderUnitWorkspace(); };
      list.appendChild(button);
    });
    if (!items.length) list.innerHTML = '<div class="empty-state-card">No assessments have been recorded for this Cohort yet.</div>';
    container.appendChild(list);
  }

  function renderInterestReminders(container, user, cohort, dialog) {
    user.interestReminders ||= [];
    if (!readOnlyMode) {
      const form = document.createElement("form"); form.className = "interest-reminder-form";
      form.innerHTML = `<div class="reminder-form-grid"><label class="form-field"><span>Reminder Date</span><input type="date" data-date required /></label><label class="form-field"><span>Reminder</span><input data-note value="Gather student interests" maxlength="120" /></label></div><div class="student-reminder-picker"><strong>Students</strong><div>${cohort.students.slice().sort((a,b)=>a.code.localeCompare(b.code)).map(student => `<label><input type="checkbox" value="${escapeHTML(student.id)}"/><span>${escapeHTML(student.code)}</span></label>`).join("")}</div></div><button type="submit" class="primary-button">Add Reminder</button>`;
      form.onsubmit = event => { event.preventDefault(); const studentIds = [...form.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value); const dueDate = form.querySelector("[data-date]").value; if (!dueDate || !studentIds.length) return alert("Choose a date and at least one student."); user.interestReminders.push({ id: makeId("interest-reminder"), cohortId: cohort.id, studentIds, dueDate, note: clean(form.querySelector("[data-note]").value) || "Gather student interests", completedAt: null, createdAt: nowISO(), updatedAt: nowISO() }); saveData(); renderCohortDashboard(dialog, user, cohort, "reminders"); window.TeacherHQCalendar?.renderNotificationDock?.(user); };
      container.appendChild(form);
    }
    const reminders = (user.interestReminders || []).filter(item => item.cohortId === cohort.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const list = document.createElement("div"); list.className = "interest-reminder-list";
    reminders.forEach(item => {
      const students = item.studentIds.map(id => cohort.students.find(student => student.id === id)).filter(Boolean);
      const row = document.createElement("article"); row.className = `interest-reminder-row ${item.completedAt ? "completed" : ""}`;
      row.innerHTML = `<div><strong>${escapeHTML(item.note)}</strong><span>${escapeHTML(formatDate(item.dueDate))} · ${escapeHTML(students.map(student => `Student ${student.code}`).join(", "))}</span></div>${readOnlyMode ? "" : `<div class="manager-card-actions">${item.completedAt ? '<button type="button" class="text-button" data-reopen>Reopen</button>' : '<button type="button" class="secondary-button" data-complete>Done</button>'}<button type="button" class="danger-text-button" data-delete>Delete</button></div>`}`;
      row.querySelector("[data-complete]")?.addEventListener("click", () => { item.completedAt = nowISO(); item.updatedAt = nowISO(); saveData(); renderCohortDashboard(dialog, user, cohort, "reminders"); window.TeacherHQCalendar?.renderNotificationDock?.(user); });
      row.querySelector("[data-reopen]")?.addEventListener("click", () => { item.completedAt = null; item.updatedAt = nowISO(); saveData(); renderCohortDashboard(dialog, user, cohort, "reminders"); window.TeacherHQCalendar?.renderNotificationDock?.(user); });
      row.querySelector("[data-delete]")?.addEventListener("click", () => { user.interestReminders = user.interestReminders.filter(entry => entry.id !== item.id); saveData(); renderCohortDashboard(dialog, user, cohort, "reminders"); window.TeacherHQCalendar?.renderNotificationDock?.(user); });
      list.appendChild(row);
    });
    if (!reminders.length) list.innerHTML = '<div class="empty-state-card">No student-interest reminders yet.</div>';
    container.appendChild(list);
  }

  function renderCohortClasses(container, user, cohort) {
    const classes = (user.classes || []).filter(item => item.cohortId === cohort.id);
    const list = document.createElement("div"); list.className = "class-manager-list";
    classes.forEach(item => { const card = makeClassManagerCard(user, item); card.querySelector(".manager-card-actions")?.remove(); card.querySelector(".class-manager-main").onclick = () => { $id("cohortDashboardDialog")?.close(); openDashboard(item.id); }; list.appendChild(card); });
    if (!classes.length) list.innerHTML = '<div class="empty-state-card">No Classes are linked to this Cohort yet.</div>';
    container.appendChild(list);
  }

  /* ==========================================================
     UNIT OVERVIEW GROUPING
  ========================================================== */
  function renderUnitOverviewGrouped() {
    const user = getActiveUser(), container = $id("unitOverviewList"); if (!user || !container) return;
    ensureClasses(user); container.innerHTML = "";
    const units = (user.units || []).filter(unit => !unit.isStandaloneContainer);
    if (!units.length) { container.innerHTML = '<div class="empty-state-card">No units yet. Choose a Class above or open Unit Planner to create one.</div>'; return; }
    const groups = new Map();
    units.forEach(unit => { const item = classById(user, unit.classId); const key = item?.id || classKey(unit.classSpec || {}); if (!groups.has(key)) groups.set(key, { teachingClass: item, spec: unit.classSpec, units: [] }); groups.get(key).units.push(unit); });
    const activeGroups = [...groups.values()].filter(group => !group.teachingClass?.archivedAt);
    const archivedGroups = [...groups.values()].filter(group => group.teachingClass?.archivedAt);
    activeGroups.forEach(group => container.appendChild(makeUnitClassGroup(user, group)));
    if (!activeGroups.length) container.insertAdjacentHTML("beforeend", '<div class="empty-state-card">No units belong to an active Class.</div>');
    if (archivedGroups.length) {
      const details = document.createElement("details"); details.className = "archive-section unit-archive-section"; details.innerHTML = `<summary>Finished Class Units <span>${archivedGroups.reduce((sum, group) => sum + group.units.length, 0)}</span></summary><div data-archived-unit-groups></div>`;
      archivedGroups.forEach(group => details.querySelector("[data-archived-unit-groups]").appendChild(makeUnitClassGroup(user, group)));
      container.appendChild(details);
    }
  }

  function makeUnitClassGroup(user, group) {
    const wrapper = document.createElement("section"); wrapper.className = `unit-class-group ${group.teachingClass?.archivedAt ? "archived-record" : ""}`;
    const label = group.teachingClass?.name || classLabel(group.spec); const cohort = group.teachingClass ? cohortForClass(user, group.teachingClass) : null;
    wrapper.innerHTML = `<div class="unit-class-group-heading"><button type="button" class="unit-class-heading-button"><div><p class="small-label">${group.teachingClass?.archivedAt ? "✓ Finished Class" : escapeHTML(cohort?.name || "Class")}</p><h3>${escapeHTML(label)}</h3></div><span>→</span></button>${readOnlyMode || group.teachingClass?.archivedAt ? "" : '<button type="button" class="secondary-button">+ New Unit</button>'}</div><div class="unit-overview-list grouped-unit-list"></div>`;
    wrapper.querySelector(".unit-class-heading-button").onclick = () => group.teachingClass ? openDashboard(group.teachingClass.id, "units") : openUnitPlanner();
    wrapper.querySelector(".secondary-button")?.addEventListener("click", () => { openUnitWizard(); setTimeout(() => { const select = $id("unitClassSelect"); const option = [...select.options].find(o => o.dataset.classId === group.teachingClass?.id); if (option) { select.value = option.value; select.dispatchEvent(new Event("change", { bubbles: true })); } }, 0); });
    const list = wrapper.querySelector(".grouped-unit-list"); group.units.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")).forEach(unit => list.appendChild(makeUnitCard(unit, true))); return wrapper;
  }

  function refresh() {
    const user = getActiveUser(); if (!user) return;
    ensureClasses(user); populateBlockClassSelect(); renderClassOverview(); renderUnitOverviewGrouped();
  }

  try { getClassOptions = user => classOptionSpecs(user); } catch (_) {}
  try { renderUnitOverview = user => { if (user) renderUnitOverviewGrouped(); }; } catch (_) {}

  $id("manageClassesButton")?.addEventListener("click", () => openManager("classes"));
  bindScheduleClassSelect();

  try {
    const originalRenderTeacherHQ = renderTeacherHQ;
    renderTeacherHQ = function () { originalRenderTeacherHQ.apply(this, arguments); refresh(); };
  } catch (_) {}

  window.TeacherHQClasses = {
    ensureClasses, ensureCohorts, classById, cohortById, cohortForClass, activeClasses, activeCohorts,
    recordsForClass, unitsForClass, curriculumCoverage, interestSummary, studentLabel,
    attentionGrabbersForCohort: cohort => cohort?.attentionGrabbers || [],
    openManager, openDashboard, openCohortDashboard, populateBlockClassSelect, renderClassOverview,
    renderUnitOverviewGrouped, refresh, formatGrades, formatSubjects, classOptionSpecs
  };

  refresh();
})();
