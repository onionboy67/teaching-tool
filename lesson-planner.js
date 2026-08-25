/* ============================================================
   TEACHER HQ — RELEASE D LESSON SYSTEM
   Living lesson planner + reflection + lesson calendar tools
   Stored inside unit.workspace.lessonPlans so older unit records
   remain compatible with the core Teacher HQ normalizer.
============================================================ */

(() => {
  "use strict";

  const LP_SECTIONS = [
    ["general", "General Information", "◉"],
    ["curriculum", "Curriculum", "⌘"],
    ["progressions", "Literacy, Numeracy, Career & Competency Progressions", "🧭"],
    ["objectives", "Objectives", "△"],
    ["assessments", "Assessments", "✓"],
    ["observations", "Observations", "•"],
    ["agenda", "Agenda", "≡"],
    ["udl", "UDL", "✦"],
    ["indigenous", "Indigenous Voices", "◇"],
    ["reflection", "Reflection", "↺"]
  ];

  const BLOOM_SCORE = {
    Remember: 1,
    Understand: 2,
    Apply: 3,
    Analyze: 4,
    Evaluate: 5,
    Create: 6
  };

  const TEMPO_COLOURS = {
    1: { bg: "#B9F6B1", fg: "#163516", label: "Remember" },
    2: { bg: "#43C95E", fg: "#102F16", label: "Understand" },
    3: { bg: "#61B6FF", fg: "#102C44", label: "Apply" },
    4: { bg: "#2772C9", fg: "#FFFFFF", label: "Analyze" },
    5: { bg: "#183B6B", fg: "#FFFFFF", label: "Evaluate" },
    6: { bg: "#17171A", fg: "#FFFFFF", label: "Create" }
  };

  const CURRICULUM_CONTEXTS = Array.isArray(window.TEACHER_HQ_CURRICULUM_CONTEXTS)
    ? window.TEACHER_HQ_CURRICULUM_CONTEXTS
    : [];

  let lessonPlannerDialog = null;
  let currentLessonUnitId = null;
  let currentLessonId = null;
  let lessonAutosaveTimer = null;
  let bloomBandOpen = "green";
  const bloomPage = { green: 0, blue: 0, black: 0 };
  let lastObjectiveTarget = "studentsWill";
  let pendingAssessmentReturn = null;

  function lp$(selector, root = document) {
    return root.querySelector(selector);
  }

  function lp$all(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function lessonPlanMap(unit) {
    if (!unit.workspace || typeof unit.workspace !== "object") unit.workspace = {};
    if (!unit.workspace.lessonPlans || typeof unit.workspace.lessonPlans !== "object" || Array.isArray(unit.workspace.lessonPlans)) {
      unit.workspace.lessonPlans = {};
    }
    return unit.workspace.lessonPlans;
  }

  function blankLessonPlan(lesson) {
    return {
      version: 1,
      lessonId: lesson.id,
      general: {
        contextMode: "generic",
        context: "",
        savedContextId: "",
        cohortContext: {
          cohortId: "",
          cultureIds: [],
          schoolSettingIds: [],
          classroomSettingId: "",
          complexitiesIds: []
        },
        continuationFromLessonId: "",
        inheritedSnapshot: null
      },
      curriculum: {
        priorIds: [],
        todayIds: [],
        lookingAheadIds: [],
        contextIds: [],
        noteVisibleIds: []
      },
      progressions: {
        Literacy: [],
        Numeracy: [],
        Career: [],
        Competency: []
      },
      objectives: {
        iCan: "",
        studentsWill: ""
      },
      assessments: {
        links: []
      },
      observations: [],
      agenda: [],
      udl: {
        parts: {},
        differentiationNeeded: false,
        differentiationStudentCount: "",
        differentiationDescription: ""
      },
      indigenous: {
        considered: null,
        taggedAgendaIds: [],
        resourceIds: []
      },
      reflection: {
        text: "",
        url: "",
        completed: false,
        updatedAt: ""
      },
      cognitiveOverride: null,
      complete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeAgendaPart(part) {
    const sourceType = part?.type === "attention-grabber" ? "hook" : part?.type;
    return {
      id: part?.id || makeId("agenda-part"),
      title: String(part?.title || ""),
      type: ["hook", "purpose", "body", "wrap-up", "transition"].includes(sourceType)
        ? sourceType
        : "body",
      attentionGrabberId: String(part?.attentionGrabberId || ""),
      durationMinutes: Number(part?.durationMinutes) || 1,
      teacherDoes: String(part?.teacherDoes || ""),
      studentsDo: String(part?.studentsDo || ""),
      notes: String(part?.notes || ""),
      modalityIds: unique(part?.modalityIds || [])
    };
  }

  function normalizeLessonProgressions(raw, legacyCurriculum = {}) {
    const source = raw && typeof raw === "object" ? raw : {};
    const normalize = framework => {
      const rows = Array.isArray(source[framework]) ? source[framework] : [];
      return rows.map(item => typeof item === "string" ? { id: item, intent: "Develop" } : {
        id: String(item?.id || ""),
        intent: ["Develop", "Practise", "Observe"].includes(item?.intent) ? item.intent : "Develop"
      }).filter(item => item.id);
    };
    // Older Release-D test data stored Literacy/Numeracy IDs inside curriculum.
    const literacy = normalize("Literacy");
    const numeracy = normalize("Numeracy");
    if (!literacy.length) (legacyCurriculum.literacyIds || []).forEach(id => literacy.push({ id, intent: "Develop" }));
    if (!numeracy.length) (legacyCurriculum.numeracyIds || []).forEach(id => numeracy.push({ id, intent: "Develop" }));
    return { Literacy: literacy, Numeracy: numeracy, Career: normalize("Career"), Competency: normalize("Competency") };
  }

  function normalizeLessonPlan(raw, lesson) {
    const source = raw && typeof raw === "object" ? raw : {};
    const general = source.general && typeof source.general === "object" ? source.general : {};
    const curriculum = source.curriculum && typeof source.curriculum === "object" ? source.curriculum : {};
    const objectives = source.objectives && typeof source.objectives === "object" ? source.objectives : {};
    const assessments = source.assessments && typeof source.assessments === "object" ? source.assessments : {};
    const udl = source.udl && typeof source.udl === "object" ? source.udl : {};
    const indigenous = source.indigenous && typeof source.indigenous === "object" ? source.indigenous : {};
    const reflection = source.reflection && typeof source.reflection === "object" ? source.reflection : {};

    return {
      ...blankLessonPlan(lesson),
      ...source,
      version: 1,
      lessonId: lesson.id,
      general: {
        contextMode: ["custom", "saved"].includes(general.contextMode) ? general.contextMode : "generic",
        context: String(general.context || ""),
        savedContextId: String(general.savedContextId || ""),
        cohortContext: {
          cohortId: String(general.cohortContext?.cohortId || ""),
          cultureIds: unique(general.cohortContext?.cultureIds),
          schoolSettingIds: unique(general.cohortContext?.schoolSettingIds),
          classroomSettingId: String(general.cohortContext?.classroomSettingId || ""),
          complexitiesIds: unique(general.cohortContext?.complexitiesIds)
        },
        continuationFromLessonId: String(general.continuationFromLessonId || ""),
        inheritedSnapshot: general.inheritedSnapshot && typeof general.inheritedSnapshot === "object"
          ? structuredCloneSafe(general.inheritedSnapshot)
          : null
      },
      curriculum: {
        priorIds: unique(curriculum.priorIds),
        todayIds: unique(curriculum.todayIds),
        lookingAheadIds: unique(curriculum.lookingAheadIds),
        contextIds: unique(curriculum.contextIds),
        noteVisibleIds: unique(curriculum.noteVisibleIds)
      },
      progressions: normalizeLessonProgressions(source.progressions, curriculum),
      objectives: {
        iCan: String(objectives.iCan || ""),
        studentsWill: String(objectives.studentsWill || "")
      },
      assessments: {
        links: Array.isArray(assessments.links)
          ? assessments.links.map(link => ({
              assessmentId: String(link?.assessmentId || ""),
              toStudentsDate: String(link?.toStudentsDate || ""),
              fromStudentsDate: String(link?.fromStudentsDate || ""),
              curriculumIds: unique(link?.curriculumIds)
            })).filter(link => link.assessmentId)
          : []
      },
      observations: Array.isArray(source.observations)
        ? source.observations.map(item => ({ id: item?.id || makeId("observation"), text: String(item?.text || "") }))
        : [],
      agenda: Array.isArray(source.agenda) ? source.agenda.map(normalizeAgendaPart) : [],
      udl: {
        parts: udl.parts && typeof udl.parts === "object" ? structuredCloneSafe(udl.parts) : {},
        differentiationNeeded: Boolean(udl.differentiationNeeded),
        differentiationStudentCount: String(udl.differentiationStudentCount || ""),
        differentiationDescription: String(udl.differentiationDescription || "")
      },
      indigenous: {
        considered: typeof indigenous.considered === "boolean" ? indigenous.considered : null,
        taggedAgendaIds: unique(indigenous.taggedAgendaIds),
        resourceIds: unique(indigenous.resourceIds)
      },
      reflection: {
        text: String(reflection.text || ""),
        url: String(reflection.url || ""),
        completed: Boolean(reflection.completed),
        updatedAt: String(reflection.updatedAt || "")
      },
      cognitiveOverride: [1, 2, 3, 4, 5, 6].includes(Number(source.cognitiveOverride))
        ? Number(source.cognitiveOverride)
        : null,
      complete: Boolean(source.complete),
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString()
    };
  }

  function ensureLessonPlan(unit, lesson, { create = true } = {}) {
    const map = lessonPlanMap(unit);
    if (!map[lesson.id] && !create) return null;
    const plan = normalizeLessonPlan(map[lesson.id], lesson);
    if (create) map[lesson.id] = plan;
    return plan;
  }

  function hasLessonPlan(unit, lesson) {
    const map = unit?.workspace?.lessonPlans;
    return Boolean(map && map[lesson.id]);
  }

  function inheritedPlan(plan) {
    return plan?.general?.inheritedSnapshot && typeof plan.general.inheritedSnapshot === "object"
      ? plan.general.inheritedSnapshot
      : null;
  }

  function mergeFallback(localValue, inheritedValue) {
    if (Array.isArray(localValue)) return localValue.length ? localValue : (Array.isArray(inheritedValue) ? structuredCloneSafe(inheritedValue) : []);
    if (localValue && typeof localValue === "object") return localValue;
    return String(localValue || "").trim() ? localValue : inheritedValue;
  }

  function effectivePlan(plan) {
    const inherited = inheritedPlan(plan);
    if (!inherited) return structuredCloneSafe(plan);
    const result = structuredCloneSafe(plan);

    result.curriculum.priorIds = mergeFallback(plan.curriculum.priorIds, inherited.curriculum?.priorIds);
    result.curriculum.todayIds = mergeFallback(plan.curriculum.todayIds, inherited.curriculum?.todayIds);
    result.curriculum.lookingAheadIds = mergeFallback(plan.curriculum.lookingAheadIds, inherited.curriculum?.lookingAheadIds);
    result.curriculum.contextIds = mergeFallback(plan.curriculum.contextIds, inherited.curriculum?.contextIds);
    result.curriculum.noteVisibleIds = mergeFallback(plan.curriculum.noteVisibleIds, inherited.curriculum?.noteVisibleIds);
    result.objectives.iCan = mergeFallback(plan.objectives.iCan, inherited.objectives?.iCan) || "";
    result.objectives.studentsWill = mergeFallback(plan.objectives.studentsWill, inherited.objectives?.studentsWill) || "";
    result.assessments.links = mergeFallback(plan.assessments.links, inherited.assessments?.links);
    result.observations = mergeFallback(plan.observations, inherited.observations);
    result.agenda = mergeFallback(plan.agenda, inherited.agenda);
    if (!Object.keys(plan.udl.parts || {}).length && inherited.udl?.parts) result.udl.parts = structuredCloneSafe(inherited.udl.parts);
    if (plan.indigenous.considered === null && inherited.indigenous) result.indigenous = structuredCloneSafe(inherited.indigenous);
    return result;
  }

  function currentContext() {
    const user = getActiveUser();
    const unit = getUnitById(currentLessonUnitId, user);
    const lesson = unit?.lessons?.find(item => item.id === currentLessonId);
    if (!user || !unit || !lesson) return null;
    const plan = ensureLessonPlan(unit, lesson);
    return { user, unit, lesson, plan };
  }

  function scheduleLessonSave(unit, plan, lesson) {
    if (readOnlyMode || readOnlySource === "shared") return;
    plan.updatedAt = new Date().toISOString();
    lesson.locked = true;
    if (lesson.lessonPlanStatus === "placeholder") lesson.lessonPlanStatus = "draft";
    clearTimeout(lessonAutosaveTimer);
    lessonAutosaveTimer = setTimeout(() => {
      autosaveUnit(unit);
      renderReflectionAttention(getActiveUser());
      appendLessonCalendarExtras();
    }, 260);
    updatePlannerSaveStatus("Saved");
  }

  function saveNow(unit) {
    if (readOnlyMode || readOnlySource === "shared") return;
    clearTimeout(lessonAutosaveTimer);
    unit.updatedAt = new Date().toISOString();
    saveData();
    renderUnitOverview(getActiveUser());
    renderReflectionAttention(getActiveUser());
    updatePlannerSaveStatus("Saved");
  }

  function updatePlannerSaveStatus(text) {
    const node = document.getElementById("lessonPlannerSaveStatus");
    if (!node) return;
    node.textContent = text;
    node.classList.add("visible");
    clearTimeout(node._fadeTimer);
    node._fadeTimer = setTimeout(() => node.classList.remove("visible"), 1400);
  }

  function createLessonPlannerDialog() {
    if (lessonPlannerDialog) return lessonPlannerDialog;
    const dialog = document.createElement("dialog");
    dialog.id = "lessonPlannerDialog";
    dialog.className = "lesson-planner-dialog";
    dialog.innerHTML = `
      <div class="lesson-planner-shell">
        <aside class="lesson-planner-rail">
          <button type="button" class="lesson-planner-home" data-lp-close title="Back to unit">←</button>
          <div class="lesson-planner-rail-title">Lesson</div>
          <nav aria-label="Lesson planner sections">
            ${LP_SECTIONS.map(([id, label, icon]) => `<button type="button" data-lp-jump="${id}" title="${label}"><span>${icon}</span><small>${label}</small></button>`).join("")}
          </nav>
          <div id="lessonPlannerSaveStatus" class="lesson-save-status">Saved</div>
        </aside>
        <div class="lesson-planner-document">
          <header id="lessonPlannerHeader" class="lesson-document-header"></header>
          <div id="lessonPlannerInheritedNotice"></div>
          <main id="lessonPlannerSections"></main>
          <footer class="lesson-document-footer">
            <button type="button" class="secondary-button" data-lp-print-view>View Print-Friendly Version</button>
            <button type="button" class="secondary-button" data-lp-print-download>Download Print-Friendly Version</button>
            <button type="button" class="secondary-button" data-lp-close>Back</button>
          </footer>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    lessonPlannerDialog = dialog;

    dialog.querySelectorAll("[data-lp-close]").forEach(button => button.addEventListener("click", closeLessonPlanner));
    dialog.querySelector("[data-lp-print-view]").addEventListener("click", () => printCurrentLesson("view"));
    dialog.querySelector("[data-lp-print-download]").addEventListener("click", () => printCurrentLesson("download"));
    dialog.querySelectorAll("[data-lp-jump]").forEach(button => {
      button.addEventListener("click", () => {
        const section = document.getElementById(`lp-section-${button.dataset.lpJump}`);
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id.replace("lp-section-", "");
      dialog.querySelectorAll("[data-lp-jump]").forEach(button => {
        button.classList.toggle("active", button.dataset.lpJump === id);
      });
    }, { root: dialog.querySelector(".lesson-planner-document"), threshold: [0.15, 0.45, 0.7] });
    dialog._lessonObserver = observer;

    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      closeLessonPlanner();
    });
    return dialog;
  }

  function openLessonPlanner(unitId, lessonId) {
    const user = getActiveUser();
    const unit = getUnitById(unitId, user);
    const lesson = unit?.lessons?.find(item => item.id === lessonId);
    if (!unit || !lesson) return;

    currentLessonUnitId = unit.id;
    currentLessonId = lesson.id;
    selectedLessonContext = { unitId, lessonId };

    const plan = ensureLessonPlan(unit, lesson);
    if (!readOnlyMode && lesson.lessonPlanStatus === "placeholder") {
      lesson.lessonPlanStatus = "draft";
      plan.updatedAt = new Date().toISOString();
      autosaveUnit(unit);
    }

    createLessonPlannerDialog();
    renderLessonPlanner();
    if (lessonPlaceholderDialog?.open) lessonPlaceholderDialog.close();
    if (!lessonPlannerDialog.open) lessonPlannerDialog.showModal();
    setTimeout(() => lp$("[data-lp-jump='general']", lessonPlannerDialog)?.classList.add("active"), 20);
  }

  function closeLessonPlanner() {
    const context = currentContext();
    if (context) saveNow(context.unit);
    lessonPlannerDialog?.close();
    currentLessonUnitId = null;
    currentLessonId = null;
    if (activeUnitWorkspaceId) renderUnitWorkspace();
  }

  function renderLessonPlanner() {
    const context = currentContext();
    if (!context) return;
    const { user, unit, lesson, plan } = context;
    const header = lp$("#lessonPlannerHeader", lessonPlannerDialog);
    const inheritedNotice = lp$("#lessonPlannerInheritedNotice", lessonPlannerDialog);
    const sections = lp$("#lessonPlannerSections", lessonPlannerDialog);

    const trip = getFieldTripForLesson(unit, lesson);
    header.innerHTML = `
      <div class="lesson-document-title-row">
        <div>
          <p class="small-label">${escapeHTML(classLabel(unit.classSpec))} · ${escapeHTML(unit.name)}</p>
          <h1>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</h1>
          <p>${escapeHTML(formatLongDate(lesson.dateKey))} · ${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))} · ${escapeHTML(hoursLabel(lesson.durationMinutes))}</p>
        </div>
        <div class="lesson-status-stack">
          <span class="lesson-status-pill ${plan.complete ? "complete" : "needs-work"}">${plan.complete ? "Lesson complete" : "Planning in progress"}</span>
          ${trip ? `<span class="lesson-status-pill field-trip">Overridden by field trip</span>` : ""}
        </div>
      </div>`;

    const previous = plan.general.continuationFromLessonId
      ? unit.lessons.find(item => item.id === plan.general.continuationFromLessonId)
      : null;
    inheritedNotice.innerHTML = previous && plan.general.inheritedSnapshot
      ? `<div class="lesson-inherited-banner"><strong>Continuation of ${escapeHTML(lessonDisplayTitleForUnit(unit, previous))}</strong><span>Grey sections show inherited planning. Leave a new section blank to keep the inherited version, or add/change information for this lesson.</span></div>`
      : "";

    sections.innerHTML = "";
    sections.append(
      renderGeneralSection(context),
      renderCurriculumSection(context),
      renderProgressionsSection(context),
      renderObjectivesSection(context),
      renderAssessmentsSection(context),
      renderObservationsSection(context),
      renderAgendaSection(context),
      renderUDLSection(context),
      renderIndigenousSection(context),
      renderReflectionSection(context)
    );

    lessonPlannerDialog._lessonObserver?.disconnect();
    LP_SECTIONS.forEach(([id]) => {
      const section = document.getElementById(`lp-section-${id}`);
      if (section) lessonPlannerDialog._lessonObserver?.observe(section);
    });

    if (readOnlyMode) {
      lp$all("input, textarea, select, button", sections).forEach(element => {
        if (!element.matches("[data-lp-jump]")) element.disabled = true;
      });
    }
  }

  function lessonSection(id, title, subtitle = "") {
    const section = document.createElement("section");
    section.id = `lp-section-${id}`;
    section.className = `lesson-plan-section lesson-plan-section-${id}`;
    section.innerHTML = `<div class="lesson-section-heading"><div><p class="small-label">Lesson Planner</p><h2>${escapeHTML(title)}</h2>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</div></div>`;
    return section;
  }

  function appendInheritedCard(section, plan, key, label, formatter = null) {
    const inherited = inheritedPlan(plan);
    if (!inherited) return;
    const value = key.split(".").reduce((obj, part) => obj?.[part], inherited);
    const meaningful = Array.isArray(value) ? value.length : (typeof value === "object" ? value && Object.keys(value).length : String(value || "").trim());
    if (!meaningful) return;
    const card = document.createElement("div");
    card.className = "inherited-content-card";
    const content = formatter ? formatter(value, inherited) : escapeHTML(String(value));
    card.innerHTML = `<span>Inherited · ${escapeHTML(label)}</span><div>${content}</div>`;
    section.appendChild(card);
  }

  function teachingClassForUnit(user, unit) {
    if (!user || !unit) return null;
    return window.TeacherHQClasses?.classById?.(user, unit.classId)
      || (user.classes || []).find(item => item.id === unit.classId)
      || null;
  }

  function cohortForUnit(user, unit) {
    const teachingClass = teachingClassForUnit(user, unit);
    if (!teachingClass) return null;
    return window.TeacherHQClasses?.cohortForClass?.(user, teachingClass)
      || (user.cohorts || []).find(item => item.id === teachingClass.cohortId)
      || null;
  }

  function ensureLessonCohortContext(plan, cohort) {
    if (!plan?.general) return false;
    const current = plan.general.cohortContext && typeof plan.general.cohortContext === "object"
      ? plan.general.cohortContext
      : {};
    if (!cohort) {
      if (!plan.general.cohortContext) {
        plan.general.cohortContext = { cohortId: "", cultureIds: [], schoolSettingIds: [], classroomSettingId: "", complexitiesIds: [] };
        return true;
      }
      return false;
    }
    if (current.cohortId === cohort.id) return false;
    const defaults = key => (cohort.context?.[key] || []).filter(item => item.useByDefault !== false).map(item => item.id);
    const classroom = (cohort.context?.classroomSetting || []).find(item => item.useByDefault)
      || (cohort.context?.classroomSetting || [])[0]
      || null;
    plan.general.cohortContext = {
      cohortId: cohort.id,
      cultureIds: defaults("culture"),
      schoolSettingIds: defaults("schoolSetting"),
      classroomSettingId: classroom?.id || "",
      complexitiesIds: defaults("complexities")
    };
    return true;
  }

  function cohortContextPrintHTML(user, unit, plan) {
    const cohort = cohortForUnit(user, unit);
    if (!cohort || plan.general?.cohortContext?.cohortId !== cohort.id) return "";
    const selected = plan.general.cohortContext;
    const sections = [
      ["Culture", "culture", selected.cultureIds],
      ["School Setting", "schoolSetting", selected.schoolSettingIds],
      ["Complexities", "complexities", selected.complexitiesIds]
    ];
    const rows = sections.map(([label, key, ids]) => {
      const wanted = new Set(ids || []);
      const items = (cohort.context?.[key] || []).filter(item => wanted.has(item.id));
      if (!items.length) return "";
      return `<div class="print-note"><strong>${escapePrint(label)}</strong><ul>${items.map(item => `<li>${escapePrint(item.title)}${item.description ? ` — ${escapePrint(item.description)}` : ""}</li>`).join("")}</ul></div>`;
    }).filter(Boolean);
    const room = (cohort.context?.classroomSetting || []).find(item => item.id === selected.classroomSettingId);
    if (room) rows.splice(2, 0, `<div class="print-note"><strong>Classroom Setting</strong><p>${escapePrint(room.title)}${room.description ? ` — ${escapePrint(room.description)}` : ""}</p></div>`);
    if (!rows.length) return "";
    return `<h2>Cohort Context</h2><p class="muted">${escapePrint(cohort.name)}</p>${rows.join("")}`;
  }

  function renderGeneralSection(context) {
    const { user, unit, lesson, plan } = context;
    const section = lessonSection("general", "General Information", "The fixed schedule information is already attached to this lesson. Add only the context that helps you teach it.");

    const priorLessons = unit.lessons
      .filter(item => item.id !== lesson.id && (item.dateKey < lesson.dateKey || (item.dateKey === lesson.dateKey && item.startTime < lesson.startTime)))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.startTime.localeCompare(a.startTime));

    const teachingClass = teachingClassForUnit(user, unit);
    const cohort = cohortForUnit(user, unit);
    if (ensureLessonCohortContext(plan, cohort)) scheduleLessonSave(unit, plan, lesson);
    const cohortContext = plan.general.cohortContext || { cohortId: "", cultureIds: [], schoolSettingIds: [], classroomSettingId: "", complexitiesIds: [] };

    const grid = document.createElement("div");
    grid.className = "lesson-general-grid";
    const grades = teachingClass?.grades?.length ? teachingClass.grades : unit.classSpec.grades;
    const subjects = teachingClass?.subjects?.length ? teachingClass.subjects.join(" + ") : unit.classSpec.subject;
    grid.innerHTML = `
      <label class="lesson-edit-card important"><span>Lesson Title</span><input data-lp-title type="text" value="${escapeHTML(lesson.customTitle || "")}" placeholder="Give this lesson a clear title…" /></label>
      ${cohort ? `<div class="lesson-fixed-info"><span>Cohort</span><strong>${escapeHTML(cohort.name)}</strong></div>` : ""}
      ${teachingClass ? `<div class="lesson-fixed-info"><span>Class</span><strong>${escapeHTML(teachingClass.name)}</strong></div>` : ""}
      <div class="lesson-fixed-info"><span>Grade(s)</span><strong>${escapeHTML(gradeDisplay(grades))}</strong></div>
      <div class="lesson-fixed-info"><span>Subject</span><strong>${escapeHTML(subjects)}</strong></div>
      <div class="lesson-fixed-info"><span>Unit</span><strong>${escapeHTML(unit.name)}</strong></div>
      <div class="lesson-fixed-info"><span>Date</span><strong>${escapeHTML(formatLongDate(lesson.dateKey))}</strong></div>
      <div class="lesson-fixed-info"><span>Duration</span><strong>${escapeHTML(hoursLabel(lesson.durationMinutes))}</strong></div>`;
    section.appendChild(grid);

    if (cohort) {
      const contextCard = document.createElement("div");
      contextCard.className = "lesson-edit-card lesson-cohort-context-card";
      const multiModule = (label, key, selectionKey) => {
        const items = cohort.context?.[key] || [];
        const selected = new Set(cohortContext[selectionKey] || []);
        return `<section class="lesson-context-module"><h4>${escapeHTML(label)}</h4><div class="lesson-context-options">${items.length ? items.map(item => `<label class="lesson-context-option"><input type="checkbox" data-lp-cohort-context-key="${escapeHTML(selectionKey)}" value="${escapeHTML(item.id)}" ${selected.has(item.id) ? "checked" : ""} ${readOnlyMode ? "disabled" : ""}/><span><strong>${escapeHTML(item.title)}</strong>${item.description ? `<small>${escapeHTML(item.description)}</small>` : ""}</span></label>`).join("") : '<span class="lesson-context-empty">No saved entries.</span>'}</div></section>`;
      };
      const rooms = cohort.context?.classroomSetting || [];
      contextCard.innerHTML = `
        <div class="lesson-cohort-context-heading"><div><span>Cohort Context</span><small>Inherited from ${escapeHTML(cohort.name)}. Change selections here only when this lesson is different.</small></div></div>
        <div class="lesson-cohort-context-grid">
          ${multiModule("Culture", "culture", "cultureIds")}
          ${multiModule("School Setting", "schoolSetting", "schoolSettingIds")}
          <section class="lesson-context-module"><h4>Classroom Setting</h4>${rooms.length ? `<select class="lesson-classroom-select" data-lp-cohort-room ${readOnlyMode ? "disabled" : ""}><option value="">No saved location for this lesson</option>${rooms.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === cohortContext.classroomSettingId ? "selected" : ""}>${escapeHTML(item.title)}${item.useByDefault ? " · usual" : ""}</option>`).join("")}</select>` : '<span class="lesson-context-empty">No saved classroom locations.</span>'}</section>
          ${multiModule("Complexities", "complexities", "complexitiesIds")}
        </div>`;
      section.appendChild(contextCard);

      contextCard.querySelectorAll("[data-lp-cohort-context-key]").forEach(input => {
        input.addEventListener("change", () => {
          const key = input.dataset.lpCohortContextKey;
          const values = [...contextCard.querySelectorAll(`[data-lp-cohort-context-key="${key}"]:checked`)].map(item => item.value);
          plan.general.cohortContext[key] = values;
          scheduleLessonSave(unit, plan, lesson);
        });
      });
      contextCard.querySelector("[data-lp-cohort-room]")?.addEventListener("change", event => {
        plan.general.cohortContext.classroomSettingId = event.target.value;
        scheduleLessonSave(unit, plan, lesson);
      });
    }

    const contextCard = document.createElement("div");
    contextCard.className = "lesson-edit-card";
    const savedContexts = Array.isArray(user.savedContexts) ? user.savedContexts : [];
    contextCard.innerHTML = `
      <div class="lesson-card-title"><div><span>Additional Lesson Context</span><small>Optional one-off notes that are specific to this lesson and not part of the Cohort profile.</small></div>
        <select data-lp-context-mode>
          <option value="generic" ${plan.general.contextMode === "generic" ? "selected" : ""}>None</option>
          <option value="saved" ${plan.general.contextMode === "saved" ? "selected" : ""}>Saved context</option>
          <option value="custom" ${plan.general.contextMode === "custom" ? "selected" : ""}>Add context</option>
        </select>
      </div>
      <label class="form-field ${plan.general.contextMode === "saved" ? "" : "hidden"}" data-lp-saved-context-wrap><span>Saved context</span><select data-lp-saved-context><option value="">Choose saved context…</option>${savedContexts.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === plan.general.savedContextId ? "selected" : ""}>${escapeHTML(item.title)}</option>`).join("")}</select></label>
      <textarea data-lp-context rows="4" class="${plan.general.contextMode === "generic" ? "hidden" : ""}" placeholder="What else should you remember for this lesson?">${escapeHTML(plan.general.context)}</textarea>
      <label class="checkbox-row ${plan.general.contextMode === "custom" ? "" : "hidden"}" data-lp-save-context-wrap><input type="checkbox" data-lp-save-context /><span>Save this context for later</span></label>
      <label class="form-field hidden" data-lp-context-title-wrap><span>Saved context title</span><input data-lp-context-title type="text" maxlength="80" placeholder="e.g., Computer lab setup" /></label>`;
    section.appendChild(contextCard);

    const continuation = document.createElement("div");
    continuation.className = "lesson-edit-card continuation-card";
    continuation.innerHTML = `
      <div class="lesson-card-title"><div><span>Continuation of a previous lesson?</span><small>No by default. Selecting Yes creates a historical snapshot rather than a live link.</small></div>
        <select data-lp-continuation><option value="no" ${!plan.general.continuationFromLessonId ? "selected" : ""}>No</option><option value="yes" ${plan.general.continuationFromLessonId ? "selected" : ""}>Yes</option></select>
      </div>
      <label class="form-field ${plan.general.continuationFromLessonId ? "" : "hidden"}" data-lp-previous-wrap><span>Previous lesson</span><select data-lp-previous-lesson><option value="">Choose a lesson…</option>${priorLessons.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === plan.general.continuationFromLessonId ? "selected" : ""}>${escapeHTML(formatDate(item.dateKey))} · ${escapeHTML(lessonDisplayTitleForUnit(unit, item))}</option>`).join("")}</select></label>`;
    section.appendChild(continuation);

    lp$("[data-lp-title]", section).addEventListener("input", event => {
      lesson.customTitle = event.target.value.trimStart();
      scheduleLessonSave(unit, plan, lesson);
      lp$("h1", lp$("#lessonPlannerHeader", lessonPlannerDialog)).textContent = lessonDisplayTitleForUnit(unit, lesson);
    });
    lp$("[data-lp-context-mode]", section).addEventListener("change", event => {
      plan.general.contextMode = event.target.value;
      const mode = event.target.value;
      lp$("[data-lp-context]", section).classList.toggle("hidden", mode === "generic");
      lp$("[data-lp-saved-context-wrap]", section).classList.toggle("hidden", mode !== "saved");
      lp$("[data-lp-save-context-wrap]", section).classList.toggle("hidden", mode !== "custom");
      if (mode === "generic") { plan.general.context = ""; plan.general.savedContextId = ""; }
      if (mode === "saved" && plan.general.savedContextId) {
        const saved = savedContexts.find(item => item.id === plan.general.savedContextId);
        if (saved) { plan.general.context = saved.description || ""; lp$("[data-lp-context]", section).value = plan.general.context; }
      }
      scheduleLessonSave(unit, plan, lesson);
    });
    lp$("[data-lp-saved-context]", section)?.addEventListener("change", event => {
      plan.general.savedContextId = event.target.value;
      const saved = savedContexts.find(item => item.id === event.target.value);
      plan.general.context = saved?.description || "";
      lp$("[data-lp-context]", section).value = plan.general.context;
      scheduleLessonSave(unit, plan, lesson);
    });
    lp$("[data-lp-context]", section).addEventListener("input", event => {
      plan.general.context = event.target.value;
      scheduleLessonSave(unit, plan, lesson);
    });
    lp$("[data-lp-save-context]", section)?.addEventListener("change", event => {
      lp$("[data-lp-context-title-wrap]", section).classList.toggle("hidden", !event.target.checked);
    });
    lp$("[data-lp-context-title]", section)?.addEventListener("change", event => {
      const title = event.target.value.trim();
      if (!title || !lp$("[data-lp-save-context]", section)?.checked || !plan.general.context.trim()) return;
      const existing = savedContexts.find(item => item.title.toLowerCase() === title.toLowerCase());
      if (existing) { existing.description = plan.general.context; plan.general.savedContextId = existing.id; }
      else { const item = { id: makeId("context"), title, description: plan.general.context, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; user.savedContexts.push(item); plan.general.savedContextId = item.id; }
      plan.general.contextMode = "saved";
      scheduleLessonSave(unit, plan, lesson);
      renderLessonPlanner();
    });
    lp$("[data-lp-continuation]", section).addEventListener("change", event => {
      const yes = event.target.value === "yes";
      lp$("[data-lp-previous-wrap]", section).classList.toggle("hidden", !yes);
      if (!yes) {
        plan.general.continuationFromLessonId = "";
        plan.general.inheritedSnapshot = null;
        scheduleLessonSave(unit, plan, lesson);
        renderLessonPlanner();
      }
    });
    lp$("[data-lp-previous-lesson]", section).addEventListener("change", event => {
      const previousId = event.target.value;
      const previous = unit.lessons.find(item => item.id === previousId);
      if (!previous) return;
      const previousPlan = ensureLessonPlan(unit, previous, { create: false });
      if (!previousPlan) {
        alert("That lesson does not have a lesson plan to continue from yet.");
        event.target.value = "";
        return;
      }
      const snapshot = effectivePlan(previousPlan);
      snapshot.reflection = { text: "", url: "", completed: false, updatedAt: "" };
      snapshot.complete = false;
      snapshot.cognitiveOverride = null;
      (snapshot.assessments?.links || []).forEach(link => {
        link.toStudentsDate = "";
        link.fromStudentsDate = "";
      });
      plan.general.continuationFromLessonId = previous.id;
      plan.general.inheritedSnapshot = structuredCloneSafe(snapshot);
      scheduleLessonSave(unit, plan, lesson);
      renderLessonPlanner();
    });

    return section;
  }

  function groupCurriculumRecords(records) {
    const grades = new Map();
    (records || []).forEach(record => {
      const grade = record.grade || "Curriculum";
      if (!grades.has(grade)) grades.set(grade, new Map());
      const oiMap = grades.get(grade);
      const oi = record.organizingIdea || "Curriculum";
      if (!oiMap.has(oi)) oiMap.set(oi, new Map());
      const gqMap = oiMap.get(oi);
      const gq = record.guidingQuestion || "Guiding Question";
      if (!gqMap.has(gq)) gqMap.set(gq, new Map());
      const loMap = gqMap.get(gq);
      const lo = record.learningOutcome || "Learning Outcome";
      if (!loMap.has(lo)) loMap.set(lo, []);
      loMap.get(lo).push(record);
    });
    return grades;
  }


  function lessonCurriculumFormat(records) {
    return (records || []).find(record => record?.curriculumFormat)?.curriculumFormat || "k6-standard";
  }

  function isScience79LessonRecords(records) {
    return lessonCurriculumFormat(records) === "science-7-9";
  }

  function lessonBranchLabels(records) {
    const format = lessonCurriculumFormat(records);
    if (format === "science-7-9") return { oi: "Unit", gq: "Outcome Category", lo: "General Outcome / Skill Area" };
    if (format === "ela-7-9") return { oi: "General Outcome", gq: "Outcome Cluster", lo: "Focus" };
    if (format === "pe-7-9") return { oi: "General Outcome", gq: "Outcome Area", lo: "Outcome Set" };
    return { oi: "Organizing Idea", gq: "Guiding Question", lo: "Learning Outcome" };
  }

  function splitFocusingQuestions(text) {
    const matches = String(text || "").match(/[^?]+\?/g);
    return matches ? matches.map(item => item.trim()) : (text ? [String(text).trim()] : []);
  }

  function scienceContextItemsForUnit(unit) {
    const contextIds = unique((unit.curriculumLinks?.working || []).map(record => record.contextId));
    const items = [];

    CURRICULUM_CONTEXTS
      .filter(context => contextIds.includes(context.id))
      .forEach(context => {
        if (context.overview) {
          items.push({
            id: `${context.id}::overview`,
            contextId: context.id,
            unit: context.unit,
            kind: "Unit Overview",
            text: context.overview
          });
        }

        splitFocusingQuestions(context.focusingQuestions).forEach((question, index) => {
          items.push({
            id: `${context.id}::focus-${index + 1}`,
            contextId: context.id,
            unit: context.unit,
            kind: "Focusing Question",
            text: question
          });
        });

        (context.keyConcepts || []).forEach((concept, index) => {
          items.push({
            id: `${context.id}::concept-${index + 1}`,
            contextId: context.id,
            unit: context.unit,
            kind: "Key Concept",
            text: concept
          });
        });
      });

    return items;
  }

  function scienceContextPicker(unit, selectedIds, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "lesson-science-context";
    wrap.innerHTML =
      `<div class="lesson-curriculum-pool-heading">` +
      `<div><span>Science Unit Context</span><small>Grade 7–9 unit overview, focusing questions, and key concepts. Select anything you want visible in this Lesson Plan.</small></div>` +
      `<strong>${selectedIds.size} selected</strong></div>`;

    const items = scienceContextItemsForUnit(unit);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No Grade 7–9 Science unit context is available for the Working Curriculum selected in this Unit.";
      wrap.appendChild(empty);
      return wrap;
    }

    const byUnit = new Map();
    items.forEach(item => {
      if (!byUnit.has(item.unit)) byUnit.set(item.unit, []);
      byUnit.get(item.unit).push(item);
    });

    byUnit.forEach((unitItems, unitName) => {
      const unitCard = document.createElement("section");
      unitCard.className = "lesson-science-context-unit";
      unitCard.innerHTML = `<h4>${escapeHTML(unitName)}</h4>`;

      ["Unit Overview", "Focusing Question", "Key Concept"].forEach(kind => {
        const kindItems = unitItems.filter(item => item.kind === kind);
        if (!kindItems.length) return;

        const group = document.createElement("div");
        group.className = "lesson-science-context-group";
        group.innerHTML = `<strong>${escapeHTML(kind)}${kindItems.length === 1 ? "" : "s"}</strong>`;

        kindItems.forEach(item => {
          const label = document.createElement("label");
          label.className = "lesson-science-context-item";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selectedIds.has(item.id);
          checkbox.disabled = readOnlyMode;
          const text = document.createElement("span");
          text.textContent = item.text;
          label.append(checkbox, text);

          checkbox.addEventListener("change", () => {
            if (checkbox.checked) selectedIds.add(item.id);
            else selectedIds.delete(item.id);
            onChange([...selectedIds]);
            lp$(".lesson-curriculum-pool-heading strong", wrap).textContent = `${selectedIds.size} selected`;
          });

          group.appendChild(label);
        });

        unitCard.appendChild(group);
      });

      wrap.appendChild(unitCard);
    });

    return wrap;
  }


  function isFineArtsLessonRecord(record) {
    return record?.curriculumFormat === "fine-arts-tree" && Array.isArray(record.curriculumPath);
  }

  function fineArtsLessonTree(records) {
    const root = { children: new Map(), records: [] };
    records.forEach(record => {
      let node = root;
      (record.curriculumPath || []).forEach((item, index) => {
        const key = `${item.label || "Branch"}|||${item.title || ""}`;
        if (!node.children.has(key)) node.children.set(key, { item, children: new Map(), records: [], depth: index });
        node = node.children.get(key);
      });
      node.records.push(record);
    });
    return root;
  }

  function fineArtsLessonNodeRecords(node) {
    const rows = [...(node.records || [])];
    node.children?.forEach(child => rows.push(...fineArtsLessonNodeRecords(child)));
    return rows;
  }

  function appendFineArtsLessonPicker(wrap, records, selectedIds, onChange) {
    const byGrade = new Map();
    records.forEach(record => {
      if (!byGrade.has(record.grade)) byGrade.set(record.grade, []);
      byGrade.get(record.grade).push(record);
    });

    byGrade.forEach((gradeRecords, grade) => {
      const gradeDetails = document.createElement("details");
      gradeDetails.className = "lesson-curriculum-details fine-arts-lesson-grade";
      gradeDetails.innerHTML = `<summary><span>Grade / Subject</span><strong>${escapeHTML(grade)} Fine Arts</strong><small>${gradeRecords.filter(r => selectedIds.has(r.id)).length} selected</small></summary>`;

      if (gradeRecords.some(r => Number(r.electiveMaximumPercent) === 30)) {
        const rule = document.createElement("p");
        rule.className = "lesson-fine-arts-rule";
        rule.textContent = "Junior-high Fine Arts: elective/enrichment time is capped at 30% in the supplied Drama/Music programs.";
        gradeDetails.appendChild(rule);
      }

      const tree = fineArtsLessonTree(gradeRecords);
      const appendLeaves = (parent, leafRecords) => {
        leafRecords.forEach(record => {
          const label = document.createElement("label");
          label.className = `lesson-curriculum-statement type-${String(record.type || "item").toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`;
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selectedIds.has(record.id);
          checkbox.disabled = readOnlyMode;
          const copy = document.createElement("div");
          const type = document.createElement("small");
          type.textContent = record.role === "assessmentTarget" ? "Assessment Target" : record.role === "concept" ? "Concept" : record.role === "module" ? "Module" : record.role === "programGoal" ? "Program Framework" : record.role === "competency" ? "Optional Arts Competency" : record.type;
          const text = document.createElement("p");
          const analysis = (record.type === "Skills & Procedures" || record.bloomEligible) ? analyzeCurriculumVerb(record.text) : null;
          if (analysis?.keyVerb && record.text.toLowerCase().startsWith(analysis.keyVerb.toLowerCase())) {
            text.innerHTML = `<mark>${escapeHTML(record.text.slice(0, analysis.keyVerb.length))}</mark>${escapeHTML(record.text.slice(analysis.keyVerb.length))}`;
          } else text.textContent = record.text;
          copy.append(type, text);
          if (record.requiredStatus) {
            const badge = document.createElement("small");
            badge.className = "lesson-curriculum-status";
            badge.textContent = String(record.requiredStatus).replaceAll("-", " ");
            copy.appendChild(badge);
          }
          label.append(checkbox, copy);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) selectedIds.add(record.id); else selectedIds.delete(record.id);
            onChange([...selectedIds]);
            const count = lp$(".lesson-curriculum-pool-heading strong", wrap);
            if (count) count.textContent = `${selectedIds.size} selected`;
          });
          parent.appendChild(label);
        });
      };
      const renderNode = (node, parent) => {
        node.children.forEach(child => {
          const details = document.createElement("details");
          details.className = `lesson-curriculum-details fine-arts-depth-${child.depth}`;
          const selectedCount = fineArtsLessonNodeRecords(child).filter(r => selectedIds.has(r.id)).length;
          details.innerHTML = `<summary><span>${escapeHTML(child.item.label || "Branch")}</span><strong>${escapeHTML(child.item.title || "")}</strong><small>${selectedCount ? `${selectedCount} selected` : ""}</small></summary>`;
          appendLeaves(details, child.records);
          renderNode(child, details);
          parent.appendChild(details);
        });
        appendLeaves(parent, node.records);
      };
      renderNode(tree, gradeDetails);
      wrap.appendChild(gradeDetails);
    });
  }

  function curriculumPickerCard({ title, subtitle, records, selectedIds, prominent = false, onChange, emptyText, user, noteVisibilityIds, onNoteVisibilityChange }) {
    const wrap = document.createElement("div");
    wrap.className = `lesson-curriculum-pool ${prominent ? "prominent" : "subdued"}`;
    wrap.innerHTML = `<div class="lesson-curriculum-pool-heading"><div><span>${escapeHTML(title)}</span><small>${escapeHTML(subtitle || "")}</small></div><strong>${selectedIds.size} selected</strong></div>`;
    if (!records.length) {
      const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = emptyText || "No curriculum has been added to this Unit pool yet."; wrap.appendChild(empty); return wrap;
    }

    const noteSummary = document.createElement("div");
    noteSummary.className = "selected-curriculum-note-summary hidden";
    wrap.appendChild(noteSummary);
    const drawNoteSummary = () => {
      const noted = records.filter(record => selectedIds.has(record.id)).map(record => ({ record, note: window.TeacherHQCurriculumUI?.curriculumNote?.(user, record.id) })).filter(item => item.note);
      noteSummary.classList.toggle("hidden", !noted.length);
      if (!noted.length) { noteSummary.innerHTML = ""; return; }
      noteSummary.innerHTML = `<div class="selected-note-summary-heading"><strong>Notes attached to selected curriculum</strong><small>${noted.length} teacher note${noted.length === 1 ? "" : "s"}</small></div><div class="selected-note-summary-list">${noted.map(({record,note}) => `<article data-summary-note="${escapeHTML(record.id)}"><p>${escapeHTML(note.text)}</p><button type="button" class="text-button" data-toggle-summary-note="${escapeHTML(record.id)}">${noteVisibilityIds?.has(record.id) ? "Shown on lesson plan" : "Hidden from lesson plan"}</button></article>`).join("")}</div>`;
      noteSummary.querySelectorAll("[data-toggle-summary-note]").forEach(button => button.onclick = () => {
        const id = button.dataset.toggleSummaryNote;
        if (noteVisibilityIds?.has(id)) noteVisibilityIds.delete(id); else noteVisibilityIds?.add(id);
        onNoteVisibilityChange?.([...(noteVisibilityIds || [])]);
        const leafBox = wrap.querySelector(`[data-note-visibility-for="${CSS.escape(id)}"]`);
        if (leafBox) leafBox.checked = noteVisibilityIds?.has(id);
        drawNoteSummary();
      });
    };
    drawNoteSummary();

    const tree = document.createElement("div"); wrap.appendChild(tree);
    if (window.TeacherHQCurriculumUI?.renderTree) {
      window.TeacherHQCurriculumUI.renderTree(records, tree, {
        selectable: true, selectedIds, readOnly: readOnlyMode, compact: true,
        user, showTeacherNotes: true, noteVisibilityIds, onNoteChanged: drawNoteSummary,
        onNoteVisibilityChange(ids) { onNoteVisibilityChange?.(ids); drawNoteSummary(); },
        onSelectionChange(ids) { onChange(ids); const count = lp$(".lesson-curriculum-pool-heading strong", wrap); if (count) count.textContent = `${ids.length} selected`; drawNoteSummary(); }
      });
    } else {
      // Safety fallback if the generic renderer fails to load. Keep the list usable, but still compact.
      records.forEach(record => {
        const label=document.createElement("label"); label.className="lesson-curriculum-statement";
        const input=document.createElement("input"); input.type="checkbox"; input.checked=selectedIds.has(record.id); input.disabled=readOnlyMode;
        const span=document.createElement("span"); span.textContent=record.text; label.append(input,span);
        input.onchange=()=>{ if(input.checked)selectedIds.add(record.id);else selectedIds.delete(record.id);onChange([...selectedIds]); }; tree.appendChild(label);
      });
    }
    return wrap;
  }

  function renderCurriculumSection(context) {
    const { user, unit, lesson, plan } = context;
    const section = lessonSection("curriculum", "Curriculum", unit.isStandaloneContainer
      ? "Stand-alone lessons can draw from any curriculum loaded in Teacher HQ. Choose a grade and subject, then browse collapsed branches."
      : "Today's Curriculum is intentionally the most prominent. Prior and future curriculum stay contextual rather than becoming accidental lesson objectives.");
    const noteVisibilityIds = new Set(plan.curriculum.noteVisibleIds || []);
    const saveNoteVisibility = ids => { plan.curriculum.noteVisibleIds = unique(ids); scheduleLessonSave(unit, plan, lesson); };

    if (unit.isStandaloneContainer) {
      const registry = window.TeacherHQRegistry;
      const selected = new Set(plan.curriculum.todayIds || []);
      const chooser = document.createElement("div"); chooser.className = "lesson-curriculum-pool prominent standalone-curriculum-pool";
      const grades = ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
      const defaultGrade = unit.standaloneMeta?.browseGrade || unit.classSpec?.grades?.[0] || "Grade 4";
      chooser.innerHTML = `<div class="lesson-curriculum-pool-heading"><div><span>Today's Curriculum</span><small>Full Alberta curriculum database</small></div><strong data-standalone-selected>${selected.size} selected</strong></div><div class="standalone-curriculum-controls"><label><span>Grade</span><select data-standalone-grade>${grades.map(g=>`<option ${g===defaultGrade?"selected":""}>${g}</option>`).join("")}</select></label><label><span>Subject</span><select data-standalone-subject></select></label></div><div data-standalone-tree></div>`;
      const gradeSelect=chooser.querySelector("[data-standalone-grade]"), subjectSelect=chooser.querySelector("[data-standalone-subject]"), tree=chooser.querySelector("[data-standalone-tree]");
      const drawTree=()=>{
        unit.standaloneMeta ||= {}; unit.standaloneMeta.browseGrade=gradeSelect.value; unit.standaloneMeta.browseSubject=subjectSelect.value;
        const records=registry?.curriculumFor(gradeSelect.value,subjectSelect.value)||[];
        window.TeacherHQCurriculumUI?.renderTree(records,tree,{selectable:true,selectedIds:selected,readOnly:readOnlyMode,compact:true,user,showTeacherNotes:true,noteVisibilityIds,onNoteVisibilityChange:saveNoteVisibility,onSelectionChange(ids){
          plan.curriculum.todayIds=ids;
          unit.curriculumLinks ||= { working:[], prerequisite:[], lookingAhead:[], crossCurricular:[] };
          unit.curriculumLinks.working=ids.map(id=>registry?.record(id)).filter(Boolean).map(structuredCloneSafe);
          unit.selectedCurriculum=unit.curriculumLinks.working.map(structuredCloneSafe);
          chooser.querySelector("[data-standalone-selected]").textContent=`${ids.length} selected`;
          scheduleLessonSave(unit,plan,lesson);
        }});
      };
      const drawSubjects=()=>{ const subjects=registry?.subjectsForGrade(gradeSelect.value)||[]; const preferred=unit.standaloneMeta?.browseSubject; subjectSelect.innerHTML=subjects.map(subject=>`<option ${subject===preferred?"selected":""}>${escapeHTML(subject)}</option>`).join(""); if(!subjects.length)tree.innerHTML='<p class="empty-state">No curriculum is loaded for this grade.</p>'; else drawTree(); };
      gradeSelect.onchange=drawSubjects; subjectSelect.onchange=drawTree; drawSubjects(); section.appendChild(chooser); return section;
    }
    appendInheritedCard(section, plan, "curriculum.todayIds", "Today's Curriculum", (ids, inherited) => `${ids.length} inherited curriculum objective${ids.length === 1 ? "" : "s"}`);

    const priorSelected = new Set(plan.curriculum.priorIds);
    const todaySelected = new Set(plan.curriculum.todayIds);
    const aheadSelected = new Set(plan.curriculum.lookingAheadIds);
    const contextSelected = new Set(plan.curriculum.contextIds || []);

    if (scienceContextItemsForUnit(unit).length) {
      section.appendChild(scienceContextPicker(
        unit,
        contextSelected,
        ids => {
          plan.curriculum.contextIds = ids;
          scheduleLessonSave(unit, plan, lesson);
        }
      ));
    }

    section.appendChild(curriculumPickerCard({
      title: "Prior Curriculum",
      subtitle: "Optional context from Prerequisite Curriculum.",
      records: unit.curriculumLinks?.prerequisite || [],
      selectedIds: priorSelected, user, noteVisibilityIds, onNoteVisibilityChange: saveNoteVisibility,
      onChange: ids => { plan.curriculum.priorIds = ids; scheduleLessonSave(unit, plan, lesson); },
      emptyText: "No Prerequisite Curriculum has been selected for this Unit yet."
    }));

    section.appendChild(curriculumPickerCard({
      title: "Today's Curriculum",
      subtitle: "Choose from Working Curriculum. These are the objectives this lesson is actively teaching.",
      records: unit.curriculumLinks?.working || [],
      selectedIds: todaySelected, user, noteVisibilityIds, onNoteVisibilityChange: saveNoteVisibility,
      prominent: true,
      onChange: ids => { plan.curriculum.todayIds = ids; scheduleLessonSave(unit, plan, lesson); },
      emptyText: "No Working Curriculum has been selected for this Unit yet."
    }));

    section.appendChild(curriculumPickerCard({
      title: "Looking Ahead",
      subtitle: "Optional next-grade context. Kept separate from today's objectives.",
      records: unit.curriculumLinks?.lookingAhead || [],
      selectedIds: aheadSelected, user, noteVisibilityIds, onNoteVisibilityChange: saveNoteVisibility,
      onChange: ids => { plan.curriculum.lookingAheadIds = ids; scheduleLessonSave(unit, plan, lesson); },
      emptyText: "No Looking Ahead curriculum has been selected for this Unit yet."
    }));

    return section;
  }

  function progressionGradeForUnit(unit) {
    return unit?.classSpec?.grades?.[0] || "Grade 4";
  }

  function progressionIntentFor(plan, framework, id) {
    return (plan.progressions?.[framework] || []).find(item => item.id === id)?.intent || "Develop";
  }

  function renderProgressionsSection(context) {
    const { unit, lesson, plan } = context;
    const section = lessonSection("progressions", "Literacy, Numeracy, Career & Competency Progressions", "These are cross-curricular planning frameworks. Choose a descriptor and identify whether this lesson will Develop, Practise, or Observe it.");
    const registry = window.TeacherHQRegistry;
    if (!registry?.progressions?.length) { section.insertAdjacentHTML("beforeend", '<p class="empty-state">Progression data is not loaded.</p>'); return section; }
    const grade = progressionGradeForUnit(unit);
    ["Literacy","Numeracy","Career","Competency"].forEach(framework => {
      const card=document.createElement("article"); card.className="lesson-progression-card";
      const selected = new Map((plan.progressions?.[framework] || []).map(item => [item.id,item]));
      const defaultRecords=(registry.progressions||[]).filter(r=>r.framework===framework && (r.gradeTags||[]).includes(grade));
      const divisions=window.TeacherHQCurriculumUI?.progressionDivisions?.(framework)||[];
      let activeDivision=card.dataset.division || defaultRecords[0]?.division || divisions[0] || "";
      card.innerHTML=`<div class="lesson-progression-heading"><div><strong>${escapeHTML(framework)}</strong><small>Default for ${escapeHTML(grade)}</small></div><span data-prog-count>${selected.size} selected</span></div><div class="lesson-progression-division"></div><div class="lesson-progression-tree"></div>`;
      const nav=lp$(".lesson-progression-division",card), tree=lp$(".lesson-progression-tree",card);
      const draw=()=>{
        const idx=divisions.indexOf(activeDivision); const defaultDivision=defaultRecords[0]?.division||activeDivision;
        nav.innerHTML=`<button type="button" data-prev ${idx<=0?"disabled":""}>←</button><div><small>Viewing</small><strong>${escapeHTML(activeDivision||"No division")}</strong>${activeDivision!==defaultDivision?'<em>Manual division override</em>':''}</div><button type="button" data-next ${idx<0||idx>=divisions.length-1?"disabled":""}>→</button>`;
        lp$("[data-prev]",nav).onclick=()=>{activeDivision=divisions[idx-1];draw();}; lp$("[data-next]",nav).onclick=()=>{activeDivision=divisions[idx+1];draw();};
        const rows=(registry.progressions||[]).filter(r=>r.framework===framework && r.division===activeDivision); tree.innerHTML="";
        const byHeading=new Map(); rows.forEach(r=>{const key=r.heading||framework;if(!byHeading.has(key))byHeading.set(key,[]);byHeading.get(key).push(r);});
        if(!rows.length){tree.innerHTML='<p class="empty-state compact">No descriptors are available for this division.</p>';return;}
        byHeading.forEach((items,heading)=>{const details=document.createElement("details");details.className="progression-heading";details.innerHTML=`<summary><strong>${escapeHTML(heading)}</strong><span>${items.filter(i=>selected.has(i.id)).length?`${items.filter(i=>selected.has(i.id)).length} selected`:""}</span></summary><div></div>`;const body=details.querySelector("div");items.forEach(item=>{const row=document.createElement("div");row.className=`lesson-progression-record ${selected.has(item.id)?"selected":""}`;const current=selected.get(item.id);row.innerHTML=`<label><input type="checkbox" ${current?"checked":""} ${readOnlyMode?"disabled":""}/><div><small>${escapeHTML(item.row||item.type||"Descriptor")}</small><p>${escapeHTML(item.text)}</p></div></label><select ${current?"":"disabled"} ${readOnlyMode?"disabled":""}><option ${current?.intent==="Develop"?"selected":""}>Develop</option><option ${current?.intent==="Practise"?"selected":""}>Practise</option><option ${current?.intent==="Observe"?"selected":""}>Observe</option></select>`;const check=row.querySelector("input"),intent=row.querySelector("select");check.onchange=()=>{if(check.checked)selected.set(item.id,{id:item.id,intent:"Develop"});else selected.delete(item.id);plan.progressions[framework]=[...selected.values()];scheduleLessonSave(unit,plan,lesson);draw();};intent.onchange=()=>{if(selected.has(item.id))selected.get(item.id).intent=intent.value;plan.progressions[framework]=[...selected.values()];scheduleLessonSave(unit,plan,lesson);};body.appendChild(row);});details.appendChild(body);tree.appendChild(details);});
        lp$("[data-prog-count]",card).textContent=`${selected.size} selected`;
      };
      draw(); section.appendChild(card);
    });
    return section;
  }

  function bloomBandVerbs(band) {
    const levels = band === "green" ? ["Remember", "Understand"] : band === "blue" ? ["Apply", "Analyze"] : ["Evaluate", "Create"];
    return unique(levels.flatMap(level => BLOOM_REFERENCE.levels?.[level] || [])).sort((a, b) => a.localeCompare(b));
  }

  function renderObjectivesSection(context) {
    const { unit, lesson, plan } = context;
    const section = lessonSection("objectives", "Objectives", "Write classroom-ready statements, with the Bloom helper available when you want a verb prompt.");
    appendInheritedCard(section, plan, "objectives.iCan", "I can statement");
    appendInheritedCard(section, plan, "objectives.studentsWill", "Students will statement");

    const cards = document.createElement("div");
    cards.className = "objective-statement-grid";
    cards.innerHTML = `
      <label class="objective-statement-card i-can"><span>I can…</span><textarea data-lp-i-can rows="4" placeholder="I can explain…">${escapeHTML(plan.objectives.iCan)}</textarea></label>
      <label class="objective-statement-card students-will"><span>Students will…</span><textarea data-lp-students-will rows="4" placeholder="Students will analyze…">${escapeHTML(plan.objectives.studentsWill)}</textarea></label>`;
    section.appendChild(cards);

    const helper = document.createElement("div");
    helper.className = "bloom-pyramid-helper";
    helper.innerHTML = `
      <div class="bloom-helper-heading"><div><strong>Bloom's Verb Pyramid</strong><p>Pick a cognitive band, then browse verbs. Teacher judgement always wins.</p></div><span>Verb helper</span></div>
      <div class="bloom-pyramid">
        <button type="button" data-bloom-band="black" class="bloom-tier black"><strong>Create / Evaluate</strong><small>Higher cognitive intensity</small></button>
        <button type="button" data-bloom-band="blue" class="bloom-tier blue"><strong>Analyze / Apply</strong><small>Middle cognitive intensity</small></button>
        <button type="button" data-bloom-band="green" class="bloom-tier green"><strong>Remember / Understand</strong><small>Foundational cognitive intensity</small></button>
      </div>
      <div class="bloom-verb-browser" data-bloom-browser></div>`;
    section.appendChild(helper);

    const iCan = lp$("[data-lp-i-can]", section);
    const studentsWill = lp$("[data-lp-students-will]", section);
    iCan.addEventListener("focus", () => { lastObjectiveTarget = "iCan"; });
    studentsWill.addEventListener("focus", () => { lastObjectiveTarget = "studentsWill"; });
    iCan.addEventListener("input", event => { plan.objectives.iCan = event.target.value; scheduleLessonSave(unit, plan, lesson); });
    studentsWill.addEventListener("input", event => { plan.objectives.studentsWill = event.target.value; scheduleLessonSave(unit, plan, lesson); });

    function renderBloomBrowser() {
      const verbs = bloomBandVerbs(bloomBandOpen);
      const perPage = 12;
      const maxPage = Math.max(0, Math.ceil(verbs.length / perPage) - 1);
      bloomPage[bloomBandOpen] = Math.min(bloomPage[bloomBandOpen] || 0, maxPage);
      const page = bloomPage[bloomBandOpen];
      const slice = verbs.slice(page * perPage, page * perPage + perPage);
      const browser = lp$("[data-bloom-browser]", helper);
      browser.innerHTML = `
        <div class="bloom-browser-controls"><button type="button" data-bloom-prev aria-label="Previous verbs">←</button><span>${bloomBandOpen === "green" ? "Remember / Understand" : bloomBandOpen === "blue" ? "Apply / Analyze" : "Evaluate / Create"} · ${page + 1}/${maxPage + 1}</span><button type="button" data-bloom-next aria-label="Next verbs">→</button></div>
        <div class="bloom-verb-pills">${slice.map(verb => `<button type="button" data-bloom-verb="${escapeHTML(verb)}">${escapeHTML(verb)}</button>`).join("")}</div>
        <p class="bloom-target-note">Click a verb to insert it into the last objective box you selected.</p>`;
      lp$("[data-bloom-prev]", browser).addEventListener("click", () => { bloomPage[bloomBandOpen] = page > 0 ? page - 1 : maxPage; renderBloomBrowser(); });
      lp$("[data-bloom-next]", browser).addEventListener("click", () => { bloomPage[bloomBandOpen] = page < maxPage ? page + 1 : 0; renderBloomBrowser(); });
      lp$all("[data-bloom-verb]", browser).forEach(button => button.addEventListener("click", () => {
        const target = lastObjectiveTarget === "iCan" ? iCan : studentsWill;
        const verb = button.dataset.bloomVerb;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const before = target.value.slice(0, start);
        const after = target.value.slice(end);
        const needsSpace = before && !/\s$/.test(before);
        target.value = `${before}${needsSpace ? " " : ""}${verb}${after ? " " : ""}${after}`;
        target.focus();
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }));
    }

    lp$all("[data-bloom-band]", helper).forEach(button => button.addEventListener("click", () => {
      bloomBandOpen = button.dataset.bloomBand;
      lp$all("[data-bloom-band]", helper).forEach(item => item.classList.toggle("active", item.dataset.bloomBand === bloomBandOpen));
      renderBloomBrowser();
    }));
    lp$(`[data-bloom-band='${bloomBandOpen}']`, helper)?.classList.add("active");
    renderBloomBrowser();
    return section;
  }

  function assessmentLinkFor(plan, assessmentId) {
    return plan.assessments.links.find(link => link.assessmentId === assessmentId) || null;
  }

  function renderAssessmentsSection(context) {
    const { unit, lesson, plan } = context;
    const section = lessonSection("assessments", "Assessments", "Attach Unit assessments to this lesson, schedule TO/FROM student dates, and identify which of today's curriculum they collect evidence for.");
    const assessments = (unit.workspace?.assessments || []).filter(item => item.status !== "draft");
    const todayRecords = (unit.curriculumLinks?.working || []).filter(record => plan.curriculum.todayIds.includes(record.id));

    const actions = document.createElement("div");
    actions.className = "lesson-assessment-topbar";
    actions.innerHTML = `<div><strong>Unit Assessments</strong><span>${assessments.length} available</span></div>${!readOnlyMode ? '<button type="button" class="secondary-button" data-lp-new-assessment>+ Create New Assessment</button>' : ""}`;
    section.appendChild(actions);

    if (!assessments.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No Unit assessments exist yet. Create one without losing this lesson's work.";
      section.appendChild(empty);
    }

    const list = document.createElement("div");
    list.className = "lesson-assessment-list";
    assessments.forEach(assessment => {
      const link = assessmentLinkFor(plan, assessment.id);
      const selected = Boolean(link);
      const card = document.createElement("article");
      card.className = `lesson-assessment-card ${selected ? "selected" : ""}`;
      card.innerHTML = `
        <label class="lesson-assessment-select"><input type="checkbox" data-lp-assessment-check="${escapeHTML(assessment.id)}" ${selected ? "checked" : ""} ${readOnlyMode ? "disabled" : ""}/><div><strong>${escapeHTML(assessment.title)}</strong><span>${escapeHTML(assessmentTypeLabel(assessment.type))}${assessment.date ? ` · ${escapeHTML(formatDate(assessment.date))}` : ""}</span></div></label>
        <div class="lesson-assessment-detail ${selected ? "" : "hidden"}" data-lp-assessment-detail="${escapeHTML(assessment.id)}">
          <div class="assessment-date-pair">
            <label><span>TO students <small>optional</small></span><input type="date" data-lp-to-date value="${escapeHTML(link?.toStudentsDate || "")}" ${readOnlyMode ? "disabled" : ""}/></label>
            <label><span>FROM students <small>optional</small></span><input type="date" data-lp-from-date value="${escapeHTML(link?.fromStudentsDate || "")}" ${readOnlyMode ? "disabled" : ""}/></label>
          </div>
          <div class="lesson-assessment-curriculum"><span>Today's curriculum assessed here</span><div data-lp-assessment-curriculum-list></div></div>
        </div>`;

      const currList = lp$("[data-lp-assessment-curriculum-list]", card);
      if (!todayRecords.length) {
        currList.innerHTML = '<small class="empty-state compact">Select Today\'s Curriculum above to associate lesson objectives with this assessment.</small>';
      } else {
        todayRecords.forEach(record => {
          const row = document.createElement("label");
          row.className = "assessment-mini-curriculum";
          const checked = link?.curriculumIds?.includes(record.id);
          row.innerHTML = `<input type="checkbox" value="${escapeHTML(record.id)}" ${checked ? "checked" : ""} ${readOnlyMode ? "disabled" : ""}/><span><small>${escapeHTML(record.type)}</small>${escapeHTML(record.text)}</span>`;
          row.querySelector("input").addEventListener("change", event => {
            const active = assessmentLinkFor(plan, assessment.id);
            if (!active) return;
            const set = new Set(active.curriculumIds || []);
            if (event.target.checked) set.add(record.id); else set.delete(record.id);
            active.curriculumIds = [...set];
            scheduleLessonSave(unit, plan, lesson);
          });
          currList.appendChild(row);
        });
      }

      lp$("[data-lp-assessment-check]", card).addEventListener("change", event => {
        if (event.target.checked) {
          plan.assessments.links.push({ assessmentId: assessment.id, toStudentsDate: "", fromStudentsDate: "", curriculumIds: [] });
        } else {
          plan.assessments.links = plan.assessments.links.filter(item => item.assessmentId !== assessment.id);
        }
        scheduleLessonSave(unit, plan, lesson);
        renderLessonPlanner();
      });
      lp$("[data-lp-to-date]", card)?.addEventListener("change", event => {
        const active = assessmentLinkFor(plan, assessment.id); if (!active) return;
        active.toStudentsDate = event.target.value; scheduleLessonSave(unit, plan, lesson); appendLessonCalendarExtras();
      });
      lp$("[data-lp-from-date]", card)?.addEventListener("change", event => {
        const active = assessmentLinkFor(plan, assessment.id); if (!active) return;
        active.fromStudentsDate = event.target.value; scheduleLessonSave(unit, plan, lesson); appendLessonCalendarExtras();
      });
      list.appendChild(card);
    });
    section.appendChild(list);

    lp$("[data-lp-new-assessment]", section)?.addEventListener("click", () => {
      saveNow(unit);
      pendingAssessmentReturn = { unitId: unit.id, lessonId: lesson.id };
      const draft = blankAssessment(unit);
      unit.workspace.assessments.push(draft);
      workspaceAssessmentEditorId = draft.id;
      workspaceAssessmentCatalogOpen = false;
      activeUnitWorkspaceId = unit.id;
      activeUnitWorkspaceSection = "assessments";
      saveData();
      lessonPlannerDialog.close();
      renderUnitWorkspace();
    });
    return section;
  }

  function renderObservationsSection(context) {
    const { unit, lesson, plan } = context;
    const section = lessonSection("observations", "Observations", "Keep quick bullet-form reminders about what to watch for and strategies that help engage all students.");
    appendInheritedCard(section, plan, "observations", "Observations", items => `<ul>${items.map(item => `<li>${escapeHTML(item.text)}</li>`).join("")}</ul>`);

    const list = document.createElement("div");
    list.className = "observation-list";
    const renderRows = () => {
      list.innerHTML = "";
      if (!plan.observations.length) list.innerHTML = '<p class="empty-state compact">No lesson-specific observations yet.</p>';
      plan.observations.forEach(item => {
        const row = document.createElement("div");
        row.className = "observation-row";
        row.innerHTML = `<span>•</span><textarea rows="2" placeholder="Watch for…">${escapeHTML(item.text)}</textarea>${readOnlyMode ? "" : '<button type="button" aria-label="Remove observation">×</button>'}`;
        row.querySelector("textarea").addEventListener("input", event => { item.text = event.target.value; scheduleLessonSave(unit, plan, lesson); });
        row.querySelector("button")?.addEventListener("click", () => { plan.observations = plan.observations.filter(obs => obs.id !== item.id); scheduleLessonSave(unit, plan, lesson); renderRows(); });
        list.appendChild(row);
      });
    };
    renderRows();
    section.appendChild(list);
    if (!readOnlyMode) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "secondary-button add-observation-button";
      add.textContent = "+ Add observation / strategy";
      add.addEventListener("click", () => { plan.observations.push({ id: makeId("observation"), text: "" }); scheduleLessonSave(unit, plan, lesson); renderRows(); list.querySelector("textarea:last-of-type")?.focus(); });
      section.appendChild(add);
    }
    return section;
  }

  function agendaTypeLabel(type) {
    return {
      hook: "Hook",
      purpose: "Purpose of Lesson",
      body: "Body",
      "wrap-up": "Wrap-Up",
      transition: "Transition"
    }[type] || "Body";
  }

  function durationOptions(selected) {
    const values = [0.5, ...Array.from({ length: 60 }, (_, index) => index + 1)];
    return values.map(value => `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${value === 0.5 ? "30 sec" : `${value} min`}</option>`).join("");
  }

  function renderAgendaSection(context) {
    const { user, unit, lesson, plan } = context;
    const section = lessonSection("agenda", "Agenda", "Build the sequence of the lesson. The concise agenda above the editor updates automatically and is emphasized in Print View.");
    appendInheritedCard(section, plan, "agenda", "Agenda", parts => `<ol>${parts.map(part => `<li>${escapeHTML(part.title || agendaTypeLabel(part.type))} · ${escapeHTML(String(part.durationMinutes))} min</li>`).join("")}</ol>`);

    const summary = document.createElement("div");
    summary.className = "agenda-summary-card";
    const cards = document.createElement("div");
    cards.className = "agenda-part-list";
    section.append(summary, cards);

    const modalities = (user.learningModalities || []).filter(modality =>
      (unit.workspace?.learningModalityIds || []).includes(modality.id)
    );

    function updateSummary() {
      const effective = plan.agenda.length ? plan.agenda : (inheritedPlan(plan)?.agenda || []);
      const total = effective.reduce((sum, part) => sum + Number(part.durationMinutes || 0), 0);
      summary.innerHTML = `<div class="agenda-summary-heading"><div><strong>Lesson Agenda</strong><span>${total} min planned · ${lesson.durationMinutes} min scheduled</span></div><span class="${Math.abs(total - lesson.durationMinutes) > 0.5 ? "agenda-time-warning" : "agenda-time-good"}">${total > lesson.durationMinutes ? `${total - lesson.durationMinutes} min over` : total < lesson.durationMinutes ? `${lesson.durationMinutes - total} min open` : "Fits block"}</span></div><ol>${effective.length ? effective.map(part => `<li><span>${escapeHTML(part.title || agendaTypeLabel(part.type))}</span><small>${escapeHTML(agendaTypeLabel(part.type))} · ${part.durationMinutes === 0.5 ? "30 sec" : `${part.durationMinutes} min`}</small></li>`).join("") : '<li class="empty-state compact">Add the first part of the lesson below.</li>'}</ol>`;
    }

    function renderCards() {
      cards.innerHTML = "";
      if (!plan.agenda.length) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "agenda-empty-slot";
        slot.disabled = readOnlyMode;
        slot.innerHTML = `<span>+</span><strong>Add the first part</strong><small>Build the lesson sequence here.</small>`;
        slot.addEventListener("click", addPart);
        cards.appendChild(slot);
      }

      plan.agenda.forEach((part, index) => {
        const card = document.createElement("article");
        card.className = `agenda-part-card agenda-type-${part.type}`;
        card.draggable = !readOnlyMode;
        card.dataset.agendaId = part.id;
        card.innerHTML = `
          <div class="agenda-part-card-header">
            <div class="agenda-order-control"><span>${index + 1}</span>${readOnlyMode ? "" : `<div><button type="button" data-agenda-up ${index === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button type="button" data-agenda-down ${index === plan.agenda.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button></div>`}</div>
            <label><span>Part title</span><input data-agenda-title type="text" value="${escapeHTML(part.title)}" placeholder="Investigation, mini-lesson…" ${readOnlyMode ? "disabled" : ""}/></label>
            <label class="agenda-duration"><span>Time</span><select data-agenda-duration ${readOnlyMode ? "disabled" : ""}>${durationOptions(part.durationMinutes)}</select></label>
            <label class="agenda-type"><span>Type</span><select data-agenda-type ${readOnlyMode ? "disabled" : ""}><option value="hook" ${part.type === "hook" ? "selected" : ""}>Hook</option><option value="purpose" ${part.type === "purpose" ? "selected" : ""}>Purpose of Lesson</option><option value="body" ${part.type === "body" ? "selected" : ""}>Body</option><option value="wrap-up" ${part.type === "wrap-up" ? "selected" : ""}>Wrap-Up</option><option value="transition" ${part.type === "transition" ? "selected" : ""}>Transition</option></select></label>
            ${readOnlyMode ? "" : '<button type="button" class="agenda-delete" data-agenda-delete aria-label="Delete part">×</button>'}
          </div>
          <div class="agenda-special-prompt" data-agenda-prompt></div>
          <div class="teacher-student-columns">
            <label><span>Teacher does</span><textarea data-agenda-teacher rows="4" placeholder="What are you doing, saying, modelling or prompting?" ${readOnlyMode ? "disabled" : ""}>${escapeHTML(part.teacherDoes)}</textarea></label>
            <label><span>Students do</span><textarea data-agenda-students rows="4" placeholder="What are students doing, saying, making or thinking?" ${readOnlyMode ? "disabled" : ""}>${escapeHTML(part.studentsDo)}</textarea></label>
          </div>
          <label class="agenda-notes"><span>Notes <small>optional</small></span><textarea data-agenda-notes rows="2" ${readOnlyMode ? "disabled" : ""}>${escapeHTML(part.notes)}</textarea></label>
          <div class="agenda-modalities"><div><strong>Learning Modalities</strong><small>Drawn from this Unit's saved modalities.</small></div><div data-agenda-modalities></div>${readOnlyMode ? "" : '<button type="button" class="text-button" data-manage-modalities>Manage modalities →</button>'}</div>`;

        const prompt = lp$("[data-agenda-prompt]", card);
        if (part.type === "purpose") {
          const objective = plan.objectives.iCan || inheritedPlan(plan)?.objectives?.iCan || "No I can statement has been written yet.";
          prompt.innerHTML = `<span>Purpose of Lesson</span><p>Clarify the classroom objective: <strong>“${escapeHTML(objective)}”</strong></p>`;
        } else if (part.type === "wrap-up") {
          const objective = plan.objectives.studentsWill || inheritedPlan(plan)?.objectives?.studentsWill || "today's Students will statement";
          prompt.innerHTML = `<span>Wrap-Up</span><p><strong>How will we confirm the “Students will” of today?</strong><br>${escapeHTML(objective)}</p>`;
        } else if (part.type === "transition") {
          prompt.innerHTML = `<span>Transition</span><p>Plan room changes, furniture/material movement, regrouping or a change in learning modality.</p>`;
        } else if (part.type === "hook") {
          const cohort = cohortForUnit(user, unit);
          const routines = cohort?.attentionGrabbers || [];
          prompt.innerHTML = `<span>Hook</span><p>Open with something that creates a reason to care about what comes next. A Cohort Attention Grabber can be used first to summon attention.</p>${cohort ? `<label class="hook-attention-grabber"><strong>Cohort Attention Grabber <small>optional</small></strong><select data-hook-attention ${readOnlyMode ? "disabled" : ""}><option value="">None</option>${routines.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === part.attentionGrabberId ? "selected" : ""}>${escapeHTML(item.title)}</option>`).join("")}</select><small data-hook-attention-description></small></label>` : '<small class="lesson-context-empty">Attach this Lesson to a Class with a Cohort to use saved Attention Grabbers.</small>'}`;
          const routineSelect = prompt.querySelector("[data-hook-attention]");
          const description = prompt.querySelector("[data-hook-attention-description]");
          const drawRoutine = () => {
            if (!description) return;
            const routine = routines.find(item => item.id === routineSelect?.value);
            description.textContent = routine?.description || (routine ? "No description saved." : "Choose one of this Cohort's saved attention routines.");
          };
          routineSelect?.addEventListener("change", () => { part.attentionGrabberId = routineSelect.value; scheduleLessonSave(unit, plan, lesson); drawRoutine(); });
          drawRoutine();
        } else {
          prompt.innerHTML = `<span>Body</span><p>Describe the learning activity clearly enough that you can teach from this page.</p>`;
        }

        const modWrap = lp$("[data-agenda-modalities]", card);
        if (!modalities.length) modWrap.innerHTML = '<small class="empty-state compact">No modalities are linked to this Unit yet.</small>';
        modalities.forEach(modality => {
          const label = document.createElement("label");
          label.className = "modality-chip-check";
          label.innerHTML = `<input type="checkbox" value="${escapeHTML(modality.id)}" ${part.modalityIds.includes(modality.id) ? "checked" : ""} ${readOnlyMode ? "disabled" : ""}/><span>${escapeHTML(modality.title)}</span>`;
          label.querySelector("input").addEventListener("change", event => {
            const set = new Set(part.modalityIds || []);
            if (event.target.checked) set.add(modality.id); else set.delete(modality.id);
            part.modalityIds = [...set]; scheduleLessonSave(unit, plan, lesson);
          });
          modWrap.appendChild(label);
        });

        lp$("[data-agenda-title]", card).addEventListener("input", event => { part.title = event.target.value; scheduleLessonSave(unit, plan, lesson); updateSummary(); });
        lp$("[data-agenda-duration]", card).addEventListener("change", event => { part.durationMinutes = Number(event.target.value); scheduleLessonSave(unit, plan, lesson); updateSummary(); });
        lp$("[data-agenda-type]", card).addEventListener("change", event => { part.type = event.target.value; scheduleLessonSave(unit, plan, lesson); renderCards(); });
        lp$("[data-agenda-teacher]", card).addEventListener("input", event => { part.teacherDoes = event.target.value; scheduleLessonSave(unit, plan, lesson); });
        lp$("[data-agenda-students]", card).addEventListener("input", event => { part.studentsDo = event.target.value; scheduleLessonSave(unit, plan, lesson); });
        lp$("[data-agenda-notes]", card).addEventListener("input", event => { part.notes = event.target.value; scheduleLessonSave(unit, plan, lesson); });
        lp$("[data-agenda-delete]", card)?.addEventListener("click", () => {
          plan.agenda = plan.agenda.filter(item => item.id !== part.id);
          delete plan.udl.parts?.[part.id];
          plan.indigenous.taggedAgendaIds = plan.indigenous.taggedAgendaIds.filter(id => id !== part.id);
          scheduleLessonSave(unit, plan, lesson); renderCards();
        });
        lp$("[data-agenda-up]", card)?.addEventListener("click", () => moveAgendaPart(index, index - 1));
        lp$("[data-agenda-down]", card)?.addEventListener("click", () => moveAgendaPart(index, index + 1));
        lp$("[data-manage-modalities]", card)?.addEventListener("click", () => {
          saveNow(unit); activeUnitWorkspaceId = unit.id; activeUnitWorkspaceSection = "learningModalities"; lessonPlannerDialog.close(); renderUnitWorkspace();
        });

        card.addEventListener("dragstart", event => { event.dataTransfer.setData("text/plain", part.id); card.classList.add("dragging"); });
        card.addEventListener("dragend", () => card.classList.remove("dragging"));
        card.addEventListener("dragover", event => { if (!readOnlyMode) event.preventDefault(); });
        card.addEventListener("drop", event => {
          if (readOnlyMode) return;
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("text/plain");
          const from = plan.agenda.findIndex(item => item.id === draggedId);
          const to = plan.agenda.findIndex(item => item.id === part.id);
          if (from >= 0 && to >= 0 && from !== to) moveAgendaPart(from, to);
        });
        cards.appendChild(card);
      });
      updateSummary();
    }

    function moveAgendaPart(from, to) {
      if (to < 0 || to >= plan.agenda.length) return;
      const [item] = plan.agenda.splice(from, 1);
      plan.agenda.splice(to, 0, item);
      scheduleLessonSave(unit, plan, lesson);
      renderCards();
    }

    function addPart() {
      plan.agenda.push(normalizeAgendaPart({ id: makeId("agenda-part"), title: "", type: "body", durationMinutes: 5 }));
      scheduleLessonSave(unit, plan, lesson);
      renderCards();
      const last = cards.lastElementChild;
      last?.scrollIntoView({ behavior: "smooth", block: "center" });
      lp$("[data-agenda-title]", last)?.focus();
    }

    renderCards();
    if (!readOnlyMode) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "primary-button agenda-add-part";
      add.textContent = "+ Add Part";
      add.addEventListener("click", addPart);
      section.appendChild(add);
    }
    return section;
  }

  function renderUDLSection(context) {
    const { unit, lesson, plan } = context;
    const section = lessonSection("udl", "UDL", "Review each Body component for complexity, multisensory conveyance and differentiation needs.");
    const agenda = effectivePlan(plan).agenda || [];
    const bodyParts = agenda.filter(part => part.type === "body");

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "udl-body-list";
    if (!bodyParts.length) bodyWrap.innerHTML = '<p class="empty-state">Add Body parts to the Agenda first; they will automatically appear here.</p>';
    bodyParts.forEach(part => {
      if (!plan.udl.parts[part.id]) plan.udl.parts[part.id] = { complexity: "", multisensory: "" };
      const udl = plan.udl.parts[part.id];
      const card = document.createElement("article");
      card.className = "udl-body-card";
      card.innerHTML = `<div class="udl-part-heading"><span>${escapeHTML(part.title || "Body")}</span><small>${part.durationMinutes} min</small></div><div class="udl-tag-grid"><label class="udl-tag complexity"><span>Complexities / access</span><textarea rows="3" data-udl-complexity placeholder="What could make this harder to access?">${escapeHTML(udl.complexity || "")}</textarea></label><label class="udl-tag multisensory"><span>Multisensory conveyance</span><textarea rows="3" data-udl-multisensory placeholder="How can the idea be seen, heard, touched, moved or represented differently?">${escapeHTML(udl.multisensory || "")}</textarea></label></div>`;
      lp$("[data-udl-complexity]", card).addEventListener("input", event => { udl.complexity = event.target.value; scheduleLessonSave(unit, plan, lesson); });
      lp$("[data-udl-multisensory]", card).addEventListener("input", event => { udl.multisensory = event.target.value; scheduleLessonSave(unit, plan, lesson); });
      bodyWrap.appendChild(card);
    });
    section.appendChild(bodyWrap);

    const diff = document.createElement("div");
    diff.className = "lesson-edit-card differentiation-card";
    diff.innerHTML = `<div class="lesson-card-title"><div><span>Is differentiation needed?</span><small>No student names are required.</small></div><select data-diff-needed><option value="no" ${!plan.udl.differentiationNeeded ? "selected" : ""}>No</option><option value="yes" ${plan.udl.differentiationNeeded ? "selected" : ""}>Yes</option></select></div><div class="differentiation-detail ${plan.udl.differentiationNeeded ? "" : "hidden"}" data-diff-detail><label><span>How many students?</span><input data-diff-count type="number" min="1" step="1" value="${escapeHTML(plan.udl.differentiationStudentCount)}" /></label><label><span>How will differentiation be done?</span><textarea data-diff-description rows="4">${escapeHTML(plan.udl.differentiationDescription)}</textarea></label></div>`;
    section.appendChild(diff);
    lp$("[data-diff-needed]", diff).addEventListener("change", event => { plan.udl.differentiationNeeded = event.target.value === "yes"; lp$("[data-diff-detail]", diff).classList.toggle("hidden", !plan.udl.differentiationNeeded); scheduleLessonSave(unit, plan, lesson); });
    lp$("[data-diff-count]", diff).addEventListener("input", event => { plan.udl.differentiationStudentCount = event.target.value; scheduleLessonSave(unit, plan, lesson); });
    lp$("[data-diff-description]", diff).addEventListener("input", event => { plan.udl.differentiationDescription = event.target.value; scheduleLessonSave(unit, plan, lesson); });
    return section;
  }

  function indigenousMatchScore(resource, unit) {
    const gradeMatches = (resource.grades || []).some(grade => unit.classSpec.grades.includes(grade));
    const subjectMatches = (resource.subjects || []).some(subject => subject === unit.classSpec.subject);
    return gradeMatches && subjectMatches ? 4 : subjectMatches ? 3 : gradeMatches ? 2 : 1;
  }

  function renderIndigenousSection(context) {
    const { user, unit, lesson, plan } = context;
    const section = lessonSection("indigenous", "Indigenous Voices", "A respectful prompt rather than a requirement: include perspectives where they are appropriate and supported by relevant resources.");
    const choice = document.createElement("div");
    choice.className = "indigenous-consideration-card";
    choice.innerHTML = `<div><strong>Have you considered including Indigenous perspectives in this lesson?</strong><p>This is not a quota. Use the prompt to consider respectful, authentic inclusion where it fits the learning.</p></div><div class="segmented-control"><label><input type="radio" name="lpIndigenous" value="yes" ${plan.indigenous.considered === true ? "checked" : ""}/><span>Yes</span></label><label><input type="radio" name="lpIndigenous" value="no" ${plan.indigenous.considered === false ? "checked" : ""}/><span>No</span></label></div>`;
    section.appendChild(choice);

    const detail = document.createElement("div");
    detail.className = "indigenous-lesson-detail";
    section.appendChild(detail);

    function renderDetail() {
      detail.innerHTML = "";
      const agenda = effectivePlan(plan).agenda || [];
      if (plan.indigenous.considered === true) {
        const heading = document.createElement("div");
        heading.className = "indigenous-detail-heading";
        heading.innerHTML = `<strong>Where is the perspective included?</strong><span>Tag one or more lesson parts.</span>`;
        detail.appendChild(heading);
        const parts = document.createElement("div");
        parts.className = "indigenous-agenda-tags";
        agenda.forEach(part => {
          const label = document.createElement("label");
          label.innerHTML = `<input type="checkbox" value="${escapeHTML(part.id)}" ${plan.indigenous.taggedAgendaIds.includes(part.id) ? "checked" : ""}/><span>${escapeHTML(part.title || agendaTypeLabel(part.type))}</span>`;
          label.querySelector("input").addEventListener("change", event => {
            const set = new Set(plan.indigenous.taggedAgendaIds || []);
            if (event.target.checked) set.add(part.id); else set.delete(part.id);
            plan.indigenous.taggedAgendaIds = [...set]; scheduleLessonSave(unit, plan, lesson);
          });
          parts.appendChild(label);
        });
        detail.appendChild(parts);
      } else if (plan.indigenous.considered === false) {
        const note = document.createElement("div");
        note.className = "indigenous-respect-note";
        note.innerHTML = `<strong>One more consideration</strong><p>Consider whether an Indigenous perspective could be included respectfully and meaningfully. If it does not fit, leaving it out is appropriate.</p>`;
        detail.appendChild(note);

        const resources = (user.indigenousResources || []).slice().sort((a, b) => indigenousMatchScore(b, unit) - indigenousMatchScore(a, unit) || a.title.localeCompare(b.title));
        const suggested = document.createElement("div");
        suggested.className = "indigenous-suggested-resources";
        suggested.innerHTML = `<div class="indigenous-detail-heading"><strong>Saved resources that may help</strong><span>Grade + subject matches appear first.</span></div>`;
        if (!resources.length) suggested.innerHTML += '<p class="empty-state compact">No Indigenous Voices resources are saved yet.</p>';
        resources.slice(0, 8).forEach(resource => {
          const score = indigenousMatchScore(resource, unit);
          const label = document.createElement("label");
          label.className = "indigenous-resource-option";
          label.innerHTML = `<input type="checkbox" value="${escapeHTML(resource.id)}" ${plan.indigenous.resourceIds.includes(resource.id) ? "checked" : ""}/><div><strong>${escapeHTML(resource.title)}</strong><small>${score === 4 ? "Matches grade + subject" : score === 3 ? "Matches subject" : score === 2 ? "Matches grade" : "Broader resource"}</small>${resource.description ? `<p>${escapeHTML(resource.description)}</p>` : ""}</div>`;
          label.querySelector("input").addEventListener("change", event => {
            const set = new Set(plan.indigenous.resourceIds || []);
            if (event.target.checked) set.add(resource.id); else set.delete(resource.id);
            plan.indigenous.resourceIds = [...set]; scheduleLessonSave(unit, plan, lesson);
          });
          suggested.appendChild(label);
        });
        detail.appendChild(suggested);
      } else {
        detail.innerHTML = '<p class="empty-state">Choose Yes or No above. You can change this at any time.</p>';
      }
    }
    lp$all("input[name='lpIndigenous']", choice).forEach(input => input.addEventListener("change", event => {
      plan.indigenous.considered = event.target.value === "yes";
      scheduleLessonSave(unit, plan, lesson);
      renderDetail();
    }));
    renderDetail();
    return section;
  }

  function lessonReflectionIsDue(lesson, plan, now = new Date()) {
    if (!plan || plan.reflection.completed) return false;
    const today = getLocalDateKey(now);
    if (lesson.dateKey < today) return true;
    if (lesson.dateKey > today) return false;
    return now.getHours() >= 17;
  }

  function renderReflectionSection(context) {
    const { unit, lesson, plan } = context;
    const section = lessonSection("reflection", "Reflection", "This is intentionally not required during lesson planning. After 5:00 PM on the lesson date, Teacher HQ keeps reminding you until the reflection is finished.");
    const due = lessonReflectionIsDue(lesson, plan);
    const card = document.createElement("div");
    card.className = `reflection-editor-card ${due ? "due" : ""}`;
    card.innerHTML = `
      ${due ? '<div class="reflection-due-banner"><strong>Reflection due</strong><span>This lesson has passed the 5:00 PM reflection point.</span></div>' : ""}
      <label><span>Reflection</span><textarea data-reflection-text rows="8" placeholder="What worked? What surprised you? What needs to change next time?">${escapeHTML(plan.reflection.text)}</textarea></label>
      <label><span>Reflection link <small>optional — Drive video/audio or another format</small></span><input data-reflection-url type="url" value="${escapeHTML(plan.reflection.url)}" placeholder="https://…" /></label>
      <label class="reflection-complete-check"><input data-reflection-complete type="checkbox" ${plan.reflection.completed ? "checked" : ""}/><span>Reflection complete</span></label>`;
    section.appendChild(card);

    const completion = document.createElement("div");
    completion.className = `lesson-completion-card ${plan.complete ? "complete" : ""}`;
    completion.innerHTML = `<div><strong>Is this lesson complete?</strong><p>Checking Yes marks the Lesson Plan complete, clears its needs-attention styling and marks the instructional occurrence as planned.</p></div><label><input data-lesson-complete type="checkbox" ${plan.complete ? "checked" : ""}/><span>Yes</span></label>`;
    section.appendChild(completion);

    lp$("[data-reflection-text]", card).addEventListener("input", event => { plan.reflection.text = event.target.value; plan.reflection.updatedAt = new Date().toISOString(); scheduleLessonSave(unit, plan, lesson); });
    lp$("[data-reflection-url]", card).addEventListener("input", event => { plan.reflection.url = event.target.value; plan.reflection.updatedAt = new Date().toISOString(); scheduleLessonSave(unit, plan, lesson); });
    lp$("[data-reflection-complete]", card).addEventListener("change", event => { plan.reflection.completed = event.target.checked; plan.reflection.updatedAt = new Date().toISOString(); scheduleLessonSave(unit, plan, lesson); renderReflectionAttention(getActiveUser()); });
    lp$("[data-lesson-complete]", completion).addEventListener("change", event => {
      plan.complete = event.target.checked;
      lesson.lessonPlanStatus = plan.complete ? "complete" : "draft";
      lesson.locked = true;
      syncLessonPlannedOccurrence(unit, lesson, plan.complete);
      scheduleLessonSave(unit, plan, lesson);
      renderLessonPlanner();
      renderCalendar();
    });
    return section;
  }

  function syncLessonPlannedOccurrence(unit, lesson, planned) {
    const term = getTermById(lesson.termId);
    const version = term?.scheduleVersions?.find(item => item.id === lesson.versionId);
    const block = version?.scheduleBlocks?.find(item => item.id === lesson.blockId);
    if (!block || block.blockType !== "Instructional Time") return;
    const dates = new Set(block.plannedDates || []);
    if (planned) dates.add(lesson.dateKey); else dates.delete(lesson.dateKey);
    block.plannedDates = [...dates].sort();
  }

  function reflectionDueLessons(user) {
    const now = new Date();
    const results = [];
    (user?.units || []).forEach(unit => {
      (unit.lessons || []).forEach(lesson => {
        const plan = ensureLessonPlan(unit, lesson, { create: false });
        if (!plan) return;
        if (lessonReflectionIsDue(lesson, plan, now)) results.push({ unit, lesson, plan });
      });
    });
    return results.sort((a, b) => a.lesson.dateKey.localeCompare(b.lesson.dateKey) || a.lesson.startTime.localeCompare(b.lesson.startTime));
  }

  function ensureReflectionAlert() {
    let alert = document.getElementById("reflectionAlert");
    if (alert) return alert;
    const pd = document.getElementById("pdAlert");
    if (!pd) return null;
    alert = document.createElement("div");
    alert.id = "reflectionAlert";
    alert.className = "notice notice-reflection hidden";
    alert.setAttribute("role", "status");
    alert.innerHTML = `<div class="notice-icon">↺</div><div><strong id="reflectionAlertText">Lesson reflections need attention</strong><p id="reflectionAlertDetail">A completed lesson is waiting for reflection.</p></div><button id="reflectionAlertButton" class="secondary-button edit-only">Open Reflection</button>`;
    pd.insertAdjacentElement("afterend", alert);
    return alert;
  }

  function renderReflectionAttention(user) {
    const alert = ensureReflectionAlert();
    if (!alert) return;
    const due = reflectionDueLessons(user);
    alert.classList.toggle("hidden", due.length === 0);
    if (!due.length) return;
    const first = due[0];
    lp$("#reflectionAlertText", alert).textContent = due.length === 1 ? "1 lesson reflection needs attention" : `${due.length} lesson reflections need attention`;
    lp$("#reflectionAlertDetail", alert).textContent = `${formatDate(first.lesson.dateKey)} · ${first.unit.name} · ${lessonDisplayTitleForUnit(first.unit, first.lesson)}`;
    const button = lp$("#reflectionAlertButton", alert);
    button.onclick = () => openLessonPlanner(first.unit.id, first.lesson.id);
  }

  function assessmentMilestones(user, dateKey, classSpec = null) {
    const results = [];
    (user?.units || []).forEach(unit => {
      if (classSpec && classKey(unit.classSpec) !== classKey(classSpec)) return;
      const assessments = unit.workspace?.assessments || [];
      const plans = unit.workspace?.lessonPlans || {};
      Object.entries(plans).forEach(([lessonId, raw]) => {
        const lesson = unit.lessons.find(item => item.id === lessonId);
        if (!lesson) return;
        const plan = normalizeLessonPlan(raw, lesson);
        (plan.assessments.links || []).forEach(link => {
          const assessment = assessments.find(item => item.id === link.assessmentId);
          if (!assessment) return;
          if (link.toStudentsDate === dateKey) results.push({ unit, lesson, assessment, direction: "TO" });
          if (link.fromStudentsDate === dateKey) results.push({ unit, lesson, assessment, direction: "FROM" });
        });
      });
    });
    return results;
  }

  function appendLessonCalendarExtras() {
    const user = getActiveUser();
    if (!user) return;
    document.querySelectorAll(".assessment-calendar-chip").forEach(node => node.remove());
    document.querySelectorAll("#calendarGrid .day[data-date-key]").forEach(cell => {
      const dateKey = cell.dataset.dateKey;
      assessmentMilestones(user, dateKey).forEach(item => {
        const chip = document.createElement("span");
        chip.className = `assessment-calendar-chip direction-${item.direction.toLowerCase()}`;
        chip.textContent = `${item.direction}: ${item.assessment.title}`;
        chip.title = `${item.unit.name} · ${item.direction} students`;
        cell.appendChild(chip);
      });
    });
    const currentUnit = getUnitById(activeUnitWorkspaceId, user);
    if (currentUnit) {
      document.querySelectorAll("#unitWorkspaceCalendarGrid .day[data-date-key]").forEach(cell => {
        assessmentMilestones(user, cell.dataset.dateKey, currentUnit.classSpec).forEach(item => {
          const chip = document.createElement("span");
          chip.className = `assessment-calendar-chip direction-${item.direction.toLowerCase()}`;
          chip.textContent = `${item.direction}: ${item.assessment.title}`;
          cell.appendChild(chip);
        });
      });
    }
  }

  function lessonPlanStatusClass(unit, lesson) {
    const plan = ensureLessonPlan(unit, lesson, { create: false });
    return plan?.complete ? "lesson-complete" : "lesson-needs-attention";
  }

  function renderLessonCalendar(unit, container) {
    const user = getActiveUser();
    const months = new Map();
    const classUnits = (user.units || []).filter(item => classKey(item.classSpec) === classKey(unit.classSpec));
    classUnits.forEach(item => item.lessons.forEach(lesson => {
      if (!lesson.dateKey) return;
      const date = parseLocalDate(lesson.dateKey);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!months.has(key)) months.set(key, new Date(date.getFullYear(), date.getMonth(), 1));
    }));
    const values = [...months.values()].sort((a, b) => a - b);
    if (!values.length) {
      container.innerHTML = '<p class="empty-state">No lessons have been allocated yet.</p>';
      return;
    }

    values.forEach(monthDate => {
      const monthSection = document.createElement("section");
      monthSection.className = "lesson-workspace-month";
      monthSection.innerHTML = `<h4>${escapeHTML(monthDate.toLocaleDateString("en-CA", { month: "long", year: "numeric" }))}</h4>`;
      const grid = document.createElement("div");
      grid.className = "calendar-grid lesson-workspace-calendar-grid";
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day, index) => {
        const heading = document.createElement("div"); heading.className = `weekday ${index === 0 || index === 6 ? "weekend-heading" : ""}`; heading.textContent = day; grid.appendChild(heading);
      });
      const year = monthDate.getFullYear(), month = monthDate.getMonth();
      const first = new Date(year, month, 1).getDay(), days = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < first; i++) { const empty = document.createElement("div"); empty.className = "day empty"; grid.appendChild(empty); }
      for (let day = 1; day <= days; day++) {
        const date = new Date(year, month, day), dateKey = getLocalDateKey(date);
        const cell = document.createElement("div"); cell.className = "day lesson-workspace-day"; if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add("weekend");
        cell.innerHTML = `<span class="day-number">${day}</span>`;
        const exception = getExceptionForDate(user, dateKey);
        if (exception) { cell.classList.add("no-school-day"); const off = document.createElement("span"); off.className = "day-off-chip"; off.textContent = exception.label || exception.type; cell.appendChild(off); }
        classUnits.forEach(item => item.lessons.filter(lesson => lesson.dateKey === dateKey).forEach(lesson => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `lesson-calendar-entry ${lessonPlanStatusClass(item, lesson)} ${item.id === unit.id ? "current-unit" : "other-unit"}`;
          const colour = normalizeHexColour(item.colour) || "#8C6CFF";
          button.style.setProperty("--lesson-unit-colour", colour);
          button.style.setProperty("--lesson-unit-soft", hexToRgba(colour, 0.18));
          button.innerHTML = `<small>${escapeHTML(item.name)}</small><strong>${escapeHTML(lessonDisplayTitleForUnit(item, lesson))}</strong>`;
          button.addEventListener("click", () => openLessonPlanner(item.id, lesson.id));
          cell.appendChild(button);
        }));
        assessmentMilestones(user, dateKey, unit.classSpec).forEach(item => {
          const chip = document.createElement("span"); chip.className = `assessment-calendar-chip direction-${item.direction.toLowerCase()}`; chip.textContent = `${item.direction}: ${item.assessment.title}`; cell.appendChild(chip);
        });
        grid.appendChild(cell);
      }
      monthSection.appendChild(grid); container.appendChild(monthSection);
    });
  }

  function unitScheduledMinutes(unit) {
    return (unit.lessons || []).reduce((sum, lesson) => sum + Number(lesson.durationMinutes || 0), 0);
  }

  function renderLessonsWorkspace(unit, container) {
    const scheduled = unitScheduledMinutes(unit);
    const short = Math.max(0, Number(unit.targetMinutes || 0) - scheduled);
    const top = document.createElement("div");
    top.className = "lessons-workspace-top";
    top.innerHTML = `<div><h4>Lessons</h4><p>Plan directly from the course calendar. Incomplete Lesson Plans remain visually distinct until you mark them complete.</p></div><div class="lesson-allocation-status ${short ? "short" : "good"}"><strong>${hoursLabel(scheduled)} / ${hoursLabel(unit.targetMinutes)}</strong><span>${short ? `${hoursLabel(short)} short` : "Allocation covered"}</span></div>`;
    container.appendChild(top);

    if (short) {
      const warning = document.createElement("div");
      warning.className = "lesson-shortfall-warning";
      warning.innerHTML = `<div><strong>Unit instructional time is short.</strong><p>A lesson was removed or the schedule changed. Add another available lesson to restore at least ${escapeHTML(hoursLabel(unit.targetMinutes))}.</p></div>${readOnlyMode ? "" : '<button type="button" class="primary-button" data-add-missing-lesson>+ Add New Lesson</button>'}`;
      container.appendChild(warning);
      lp$("[data-add-missing-lesson]", warning)?.addEventListener("click", () => addMissingLesson(unit));
    }

    const tools = document.createElement("div");
    tools.className = "lesson-calendar-tools";
    tools.innerHTML = `<span><i class="lesson-status-dot needs"></i> Needs planning</span><span><i class="lesson-status-dot complete"></i> Completed plan</span><span><i class="lesson-status-dot other"></i> Other unit</span>`;
    container.appendChild(tools);
    const calendar = document.createElement("div");
    calendar.className = "lesson-course-calendar";
    container.appendChild(calendar);
    renderLessonCalendar(unit, calendar);

    const management = document.createElement("div");
    management.className = "lesson-management-list";
    management.innerHTML = `<div class="workspace-subheading"><div><p class="small-label">Lesson Records</p><h4>Copy or remove lessons</h4></div></div>`;
    (unit.lessons || []).forEach(lesson => {
      const row = document.createElement("div");
      row.className = `lesson-management-row ${lessonPlanStatusClass(unit, lesson)}`;
      row.innerHTML = `<button type="button" class="lesson-management-open"><strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong><span>${escapeHTML(formatLongDate(lesson.dateKey))} · ${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))}</span></button>${readOnlyMode ? "" : '<div class="lesson-management-actions"><button type="button" class="secondary-button" data-copy-lesson>Copy plan…</button><button type="button" class="danger-text-button" data-delete-lesson>Delete</button></div>'}`;
      lp$(".lesson-management-open", row).addEventListener("click", () => openLessonPlanner(unit.id, lesson.id));
      lp$("[data-copy-lesson]", row)?.addEventListener("click", () => copyLessonPlanPrompt(unit, lesson));
      lp$("[data-delete-lesson]", row)?.addEventListener("click", () => deleteLessonFromUnit(unit, lesson));
      management.appendChild(row);
    });
    container.appendChild(management);
  }

  function copyLessonPlanPrompt(unit, sourceLesson) {
    const candidates = unit.lessons.filter(item => item.id !== sourceLesson.id);
    if (!candidates.length) { alert("There is no other lesson date in this Unit to copy the plan to yet."); return; }
    const dialog = document.createElement("dialog");
    dialog.className = "modal copy-lesson-dialog";
    dialog.innerHTML = `<form method="dialog" class="modal-content"><div class="modal-heading"><div><p class="small-label">Copy Lesson Plan</p><h2>${escapeHTML(lessonDisplayTitleForUnit(unit, sourceLesson))}</h2></div><button value="cancel" class="close-button">×</button></div><label class="form-field"><span>Copy this plan to</span><select data-copy-target>${candidates.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(formatDate(item.dateKey))} · ${escapeHTML(lessonDisplayTitleForUnit(unit, item))}</option>`).join("")}</select></label><p class="section-subtitle">The target keeps its own date, time and lesson number. Reflection and completion status are cleared.</p><div class="modal-actions"><button value="cancel" class="secondary-button">Cancel</button><button type="button" class="primary-button" data-copy-confirm>Copy Plan</button></div></form>`;
    document.body.appendChild(dialog);
    lp$("[data-copy-confirm]", dialog).addEventListener("click", () => {
      const target = unit.lessons.find(item => item.id === lp$("[data-copy-target]", dialog).value);
      if (!target) return;
      const sourcePlan = ensureLessonPlan(unit, sourceLesson, { create: false });
      if (!sourcePlan) { alert("The source lesson does not have a plan to copy yet."); return; }
      const copied = structuredCloneSafe(effectivePlan(sourcePlan));
      copied.lessonId = target.id;
      copied.general.continuationFromLessonId = "";
      copied.general.inheritedSnapshot = null;
      copied.reflection = { text: "", url: "", completed: false, updatedAt: "" };
      copied.complete = false;
      copied.cognitiveOverride = null;
      copied.createdAt = new Date().toISOString();
      copied.updatedAt = new Date().toISOString();
      (copied.assessments?.links || []).forEach(link => { link.toStudentsDate = ""; link.fromStudentsDate = ""; });
      lessonPlanMap(unit)[target.id] = copied;
      target.customTitle = sourceLesson.customTitle || "";
      target.lessonPlanStatus = "draft";
      target.locked = true;
      autosaveUnit(unit);
      dialog.close(); dialog.remove();
      renderUnitWorkspacePanel(unit, "lessons");
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  function deleteLessonFromUnit(unit, lesson) {
    if (!confirm(`Move ${lessonDisplayTitleForUnit(unit, lesson)} to Trash? You can restore it for six months.`)) return;
    const plan = structuredCloneSafe(lessonPlanMap(unit)[lesson.id] || null);
    if (window.TeacherHQTrash?.softDelete) {
      window.TeacherHQTrash.softDelete("lesson", structuredCloneSafe(lesson), { parent: "unit.lessons", unitId: unit.id, lessonPlan: plan });
    }
    unit.lessons = unit.lessons.filter(item => item.id !== lesson.id);
    delete lessonPlanMap(unit)[lesson.id];
    unit.lessons.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime));
    unit.lessons.forEach((item, index) => { item.sequence = index + 1; item.title = `Lesson ${index + 1}`; });
    unit.needsScheduleReview = unitScheduledMinutes(unit) < unit.targetMinutes;
    autosaveUnit(unit);
    renderUnitWorkspacePanel(unit, "lessons");
  }

  function addMissingLesson(unit) {
    const user = getActiveUser();
    if (!user || unitScheduledMinutes(unit) >= unit.targetMinutes) return;
    const result = allocateLessons(unit, user, unit.startDate || getLocalDateKey(), unit.id, structuredCloneSafe(unit.lessons));
    const before = unit.lessons.length;
    unit.lessons = result.lessons;
    unit.needsScheduleReview = result.scheduledMinutes < unit.targetMinutes;
    autosaveUnit(unit);
    if (unit.lessons.length === before) alert("No additional available teaching block could be found for this class inside the current School Terms.");
    renderUnitWorkspacePanel(unit, "lessons");
  }

  function lessonAssessmentBloomScores(unit, lesson, plan) {
    const scores = [];
    const links = plan?.assessments?.links || [];
    links.forEach(link => {
      const assessment = (unit.workspace?.assessments || []).find(item => item.id === link.assessmentId);
      if (!assessment) return;
      const ids = link.curriculumIds?.length ? link.curriculumIds : assessment.curriculumIds || [];
      ids.forEach(id => {
        const record = curriculumRecordForAssessment(unit, assessment, id) || CURRICULUM.find(item => item.id === id);
        if (!record || record.type !== "Skills & Procedures") return;
        const analysis = analyzeCurriculumVerb(record.text);
        const level = getCurriculumBloomLevel(record, getActiveUser(), analysis);
        if (BLOOM_SCORE[level]) scores.push({ score: BLOOM_SCORE[level], level, record, assessment });
      });
    });
    return scores;
  }

  function lessonTempo(unit, lesson) {
    const plan = ensureLessonPlan(unit, lesson, { create: false });
    if (!plan) return { automatic: null, shown: null, manual: false, details: [] };
    const details = lessonAssessmentBloomScores(unit, lesson, plan);
    const automatic = details.length ? details.reduce((sum, item) => sum + item.score, 0) / details.length : null;
    const shown = plan.cognitiveOverride || automatic;
    return { automatic, shown, manual: Boolean(plan.cognitiveOverride), details };
  }

  function tempoStyle(score) {
    if (!score) return { bg: "#F1F1F3", fg: "#666", label: "No assessment verbs" };
    const rounded = Math.min(6, Math.max(1, Math.round(score)));
    return TEMPO_COLOURS[rounded];
  }

  function renderCognitiveTempo(unit, container) {
    const intro = document.createElement("div");
    intro.className = "cognitive-tempo-intro";
    intro.innerHTML = `<div><h4>Cognitive Tempo</h4><p>Assessment verbs are weighted Remember=1 through Create=6. Each lesson date shows the average cognitive demand of the assessments attached to that lesson.</p></div><div class="tempo-scale">${[1,2,3,4,5,6].map(score => `<span style="--tempo-bg:${TEMPO_COLOURS[score].bg};--tempo-fg:${TEMPO_COLOURS[score].fg}">${score}</span>`).join("")}</div>`;
    container.appendChild(intro);

    if (!unit.lessons.length) { container.insertAdjacentHTML("beforeend", '<p class="empty-state">No lesson dates are allocated yet.</p>'); return; }
    const months = new Map();
    unit.lessons.forEach(lesson => {
      const date = parseLocalDate(lesson.dateKey), key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!months.has(key)) months.set(key, new Date(date.getFullYear(), date.getMonth(), 1));
    });
    [...months.values()].sort((a,b)=>a-b).forEach(monthDate => {
      const section = document.createElement("section"); section.className = "tempo-month"; section.innerHTML = `<h4>${escapeHTML(monthDate.toLocaleDateString("en-CA", { month:"long", year:"numeric" }))}</h4>`;
      const grid = document.createElement("div"); grid.className = "calendar-grid tempo-calendar-grid";
      ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach((d,i)=>{const h=document.createElement("div");h.className="weekday";h.textContent=d;if(i===0||i===6)h.classList.add("weekend-heading");grid.appendChild(h);});
      const y=monthDate.getFullYear(),m=monthDate.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
      for(let i=0;i<first;i++){const e=document.createElement("div");e.className="day empty";grid.appendChild(e);}
      for(let d=1;d<=days;d++){
        const date=new Date(y,m,d),key=getLocalDateKey(date),lesson=unit.lessons.find(item=>item.dateKey===key);
        const cell=document.createElement("div");cell.className="day tempo-day";cell.innerHTML=`<span class="day-number">${d}</span>`;
        if(date.getDay()===0||date.getDay()===6)cell.classList.add("weekend");
        if(lesson){
          const tempo=lessonTempo(unit,lesson),style=tempoStyle(tempo.shown);cell.style.setProperty("--tempo-bg",style.bg);cell.style.setProperty("--tempo-fg",style.fg);cell.classList.add("has-tempo");
          const details=document.createElement("div");details.className="tempo-lesson";details.innerHTML=`<strong>${escapeHTML(lessonDisplayTitleForUnit(unit,lesson))}</strong><span>${tempo.shown ? `Tempo ${tempo.shown.toFixed(tempo.shown % 1 ? 1 : 0)}${tempo.manual ? " · manual" : ""}` : "No assessed S&P verbs"}</span>`;cell.appendChild(details);
          if(!readOnlyMode){const select=document.createElement("select");select.className="tempo-override";select.innerHTML=`<option value="">Auto</option>${[1,2,3,4,5,6].map(v=>`<option value="${v}" ${ensureLessonPlan(unit,lesson).cognitiveOverride===v?"selected":""}>${v}</option>`).join("")}`;select.addEventListener("change",event=>{const plan=ensureLessonPlan(unit,lesson);plan.cognitiveOverride=event.target.value?Number(event.target.value):null;scheduleLessonSave(unit,plan,lesson);renderUnitWorkspacePanel(unit,"cognitiveTempo");});cell.appendChild(select);}
        }
        grid.appendChild(cell);
      }
      section.appendChild(grid);container.appendChild(section);
    });
  }

  function appendAssessmentDayDetails(dateKey) {
    const list = document.getElementById("dayDetailsList");
    if (!list) return;
    const items = assessmentMilestones(getActiveUser(), dateKey);
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "day-detail-card day-detail-assessment";
      card.innerHTML = `<strong>${escapeHTML(item.direction)} students · ${escapeHTML(item.assessment.title)}</strong><div class="term-meta">${escapeHTML(item.unit.name)} · ${escapeHTML(assessmentTypeLabel(item.assessment.type))}</div>`;
      list.appendChild(card);
    });
  }

  function escapePrint(value) {
    return escapeHTML(value ?? "");
  }

  function printCurrentLesson(mode = "view") {
    const context = currentContext();
    if (!context) return;
    saveNow(context.unit);
    const html = buildLessonPrintHTML(context.unit, context.lesson, context.plan, context.user);
    if (mode === "download") {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TeacherHQ_${String(lessonDisplayTitleForUnit(context.unit, context.lesson)).replace(/[^a-z0-9_-]+/gi, "_")}_${context.lesson.dateKey}.html`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const win = window.open("", "_blank");
    if (!win) { alert("The browser blocked the print-friendly view. Please allow pop-ups for Teacher HQ, then try again."); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }

  function printCurriculum(records, ids, user, noteVisibleIds = []) {
    const visible = new Set(noteVisibleIds || []);
    return (records || []).filter(record => ids.includes(record.id)).map(record => {
      const path = window.TeacherHQCurriculumUI?.recordPath?.(record) || [];
      const breadcrumb = path.map(item => `${item.label}: ${item.title}`).join(" → ");
      const note = visible.has(record.id) ? window.TeacherHQCurriculumUI?.curriculumNote?.(user, record.id) : null;
      return `<div class="print-curriculum-item"><small>${escapePrint(record.type || record.role || "Curriculum")}</small>${breadcrumb ? `<strong>${escapePrint(breadcrumb)}</strong>` : ""}<p>${escapePrint(record.text)}</p>${note ? `<div class="print-teacher-note"><b>Teacher note:</b> ${escapePrint(note.text)}</div>` : ""}</div>`;
    }).join("");
  }


  function printScienceContext(unit, ids) {
    const selected = new Set(ids || []);
    return scienceContextItemsForUnit(unit)
      .filter(item => selected.has(item.id))
      .map(item => `<div class="print-curriculum-item"><small>Science Unit Context · ${escapePrint(item.unit)}</small><strong>${escapePrint(item.kind)}</strong><p>${escapePrint(item.text)}</p></div>`)
      .join("");
  }

  function printProgressions(plan) {
    const all = window.TeacherHQRegistry?.progressions || [];
    const rows=[]; ["Literacy","Numeracy","Career","Competency"].forEach(framework => {
      (plan.progressions?.[framework] || []).forEach(selection => { const record=all.find(r=>r.id===selection.id); if(record) rows.push(`<div class="print-curriculum-item"><small>Progression · ${escapePrint(framework)} · ${escapePrint(record.division || "")}</small><strong>${escapePrint(record.heading || "")}${record.row?` — ${escapePrint(record.row)}`:""}</strong><p>${escapePrint(record.text)}</p><span>Intent: ${escapePrint(selection.intent || "Develop")}</span></div>`); });
    }); return rows.join("");
  }

  function buildLessonPrintHTML(unit, lesson, rawPlan, user) {
    const plan = effectivePlan(rawPlan);
    const assessments = (plan.assessments.links || []).map(link => {
      const item = (unit.workspace?.assessments || []).find(a => a.id === link.assessmentId);
      return item ? `<li><strong>${escapePrint(item.title)}</strong> · ${escapePrint(assessmentTypeLabel(item.type))}${link.toStudentsDate ? ` · TO ${escapePrint(formatDate(link.toStudentsDate))}` : ""}${link.fromStudentsDate ? ` · FROM ${escapePrint(formatDate(link.fromStudentsDate))}` : ""}</li>` : "";
    }).join("");
    const modalities = new Map((user.learningModalities || []).map(item => [item.id, item.title]));
    const printCohort = cohortForUnit(user, unit);
    const agenda = (plan.agenda || []).map((part, index) => {
      const routine = part.type === "hook" ? (printCohort?.attentionGrabbers || []).find(item => item.id === part.attentionGrabberId) : null;
      const routineHTML = routine ? `<small><b>Attention Grabber:</b> ${escapePrint(routine.title)}${routine.description ? ` — ${escapePrint(routine.description)}` : ""}</small>` : "";
      return `<tr><td>${index + 1}</td><td><strong>${escapePrint(part.title || agendaTypeLabel(part.type))}</strong><small>${escapePrint(agendaTypeLabel(part.type))}</small>${routineHTML}</td><td>${part.durationMinutes === 0.5 ? "30 sec" : `${part.durationMinutes} min`}</td><td>${escapePrint(part.teacherDoes)}</td><td>${escapePrint(part.studentsDo)}</td></tr>`;
    }).join("");
    const observations = (plan.observations || []).filter(item => item.text.trim()).map(item => `<li>${escapePrint(item.text)}</li>`).join("");
    const bodyUdl = (plan.agenda || []).filter(part => part.type === "body").map(part => {const entry=plan.udl.parts?.[part.id]||{};return `<div class="print-note"><strong>${escapePrint(part.title || "Body")}</strong>${entry.complexity?`<p><b>Complexity/access:</b> ${escapePrint(entry.complexity)}</p>`:""}${entry.multisensory?`<p><b>Multisensory:</b> ${escapePrint(entry.multisensory)}</p>`:""}</div>`;}).join("");
    const indigenousResources = (user.indigenousResources || []).filter(item => plan.indigenous.resourceIds.includes(item.id)).map(item => item.title).join(", ");

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapePrint(lessonDisplayTitleForUnit(unit, lesson))}</title><style>
      @page{size:letter;margin:.55in}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17171a;margin:0;font-size:11px;line-height:1.4}.controls{display:flex;justify-content:flex-end;margin-bottom:16px}.controls button{border:0;background:#1d1d1f;color:#fff;border-radius:10px;padding:10px 15px;font-weight:700}h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px;border-bottom:2px solid #222;padding-bottom:5px}.meta{color:#666;margin-bottom:15px}.objective-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.objective{border:1.5px solid #222;border-radius:10px;padding:10px;font-size:13px}.objective span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:4px}.print-curriculum-item{border-left:3px solid #888;padding:7px 9px;margin:6px 0;background:#f7f7f8}.print-curriculum-item small,.print-curriculum-item span{display:block;color:#666}.print-curriculum-item p{margin:4px 0 0}.print-teacher-note{margin-top:6px;padding:6px 8px;border-radius:6px;background:#fff3c4}.agenda-summary{margin:0 0 8px;padding-left:18px}.agenda-summary li{margin:3px 0}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aaa;padding:6px;vertical-align:top}th{background:#f2f2f3;font-size:9px;text-transform:uppercase}td:nth-child(1){width:5%}td:nth-child(2){width:19%}td:nth-child(3){width:8%}td small{display:block;color:#666}.print-note{padding:7px 9px;background:#f5f5f7;border-radius:8px;margin:5px 0}.print-note p{margin:3px 0}.reflection-box{height:4.8in;border:2px solid #333;border-radius:10px;padding:12px}.reflection-box p{white-space:pre-wrap}.page-break{break-before:page}.completion{margin-top:12px}.muted{color:#777}@media print{.controls{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}tr,.print-curriculum-item,.objective{break-inside:avoid}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save PDF</button></div>
      <h1>${escapePrint(lessonDisplayTitleForUnit(unit, lesson))}</h1><div class="meta">${escapePrint(classLabel(unit.classSpec))} · ${escapePrint(unit.name)} · ${escapePrint(formatLongDate(lesson.dateKey))} · ${escapePrint(formatTime(lesson.startTime))}–${escapePrint(formatTime(lesson.endTime))} · ${escapePrint(hoursLabel(lesson.durationMinutes))}</div>
      ${cohortContextPrintHTML(user, unit, plan)}
      ${plan.general.contextMode !== "generic" && plan.general.context ? `<p><strong>Additional lesson context:</strong> ${escapePrint(plan.general.context)}</p>` : ""}
      <h2>Curriculum</h2>${printScienceContext(unit, plan.curriculum.contextIds)}${printCurriculum(unit.curriculumLinks?.prerequisite || [], plan.curriculum.priorIds, user, plan.curriculum.noteVisibleIds)}${printCurriculum(unit.curriculumLinks?.working || [], plan.curriculum.todayIds, user, plan.curriculum.noteVisibleIds)}${printCurriculum(unit.curriculumLinks?.lookingAhead || [], plan.curriculum.lookingAheadIds, user, plan.curriculum.noteVisibleIds)}
      ${printProgressions(plan) ? `<h2>Literacy, Numeracy, Career & Competency Progressions</h2>${printProgressions(plan)}` : ""}
      <h2>Objectives</h2><div class="objective-grid"><div class="objective"><span>I can…</span>${escapePrint(plan.objectives.iCan || "—")}</div><div class="objective"><span>Students will…</span>${escapePrint(plan.objectives.studentsWill || "—")}</div></div>
      ${assessments ? `<h2>Assessments</h2><ul>${assessments}</ul>` : ""}${observations ? `<h2>Observations</h2><ul>${observations}</ul>` : ""}
      <h2>Agenda</h2><ol class="agenda-summary">${(plan.agenda || []).map(part => `<li>${escapePrint(part.title || agendaTypeLabel(part.type))} — ${part.durationMinutes === .5 ? "30 sec" : `${part.durationMinutes} min`}${part.modalityIds?.length ? ` · ${escapePrint(part.modalityIds.map(id => modalities.get(id)).filter(Boolean).join(", "))}` : ""}</li>`).join("")}</ol><table><thead><tr><th>#</th><th>Part</th><th>Time</th><th>Teacher Does</th><th>Students Do</th></tr></thead><tbody>${agenda}</tbody></table>
      <h2>UDL</h2>${bodyUdl || '<p class="muted">No UDL notes recorded.</p>'}${plan.udl.differentiationNeeded ? `<div class="print-note"><strong>Differentiation · ${escapePrint(plan.udl.differentiationStudentCount || "—")} students</strong><p>${escapePrint(plan.udl.differentiationDescription)}</p></div>` : '<p class="muted">No differentiation indicated.</p>'}
      <h2>Indigenous Voices</h2><p>${plan.indigenous.considered === true ? `Included in ${plan.indigenous.taggedAgendaIds.length} agenda part(s).` : plan.indigenous.considered === false ? "Considered; not included in this lesson." : "Not yet recorded."}${indigenousResources ? ` Resources: ${escapePrint(indigenousResources)}.` : ""}</p>
      <div class="page-break"></div><h2>Reflection</h2><div class="reflection-box">${plan.reflection.text ? `<p>${escapePrint(plan.reflection.text)}</p>` : ""}${plan.reflection.url ? `<p><strong>Reflection link:</strong> ${escapePrint(plan.reflection.url)}</p>` : ""}</div><p class="completion"><strong>Lesson complete:</strong> ${plan.complete ? "Yes" : "No"}</p>
      </body></html>`;
  }

  function readableLessonPlanHTML(unit, lesson, user) {
    const plan = ensureLessonPlan(unit, lesson, { create: false });
    if (!plan) return "";
    const effective = effectivePlan(plan);
    return `<div class="lesson" style="border-left-color:${escapeHTML(unit.colour || "#8C6CFF")};background:${escapeHTML(hexToRgba(unit.colour || "#8C6CFF", 0.10))}"><strong>${escapeHTML(lessonDisplayTitleForUnit(unit, lesson))}</strong> · ${escapeHTML(formatDate(lesson.dateKey))} · ${escapeHTML(formatTime(lesson.startTime))}–${escapeHTML(formatTime(lesson.endTime))}<br><span class="muted">${plan.complete ? "Lesson plan complete" : "Planning in progress"}${effective.objectives.iCan ? ` · I can: ${escapeHTML(effective.objectives.iCan)}` : ""}${effective.objectives.studentsWill ? ` · Students will: ${escapeHTML(effective.objectives.studentsWill)}` : ""}${effective.agenda?.length ? ` · ${effective.agenda.length} agenda parts` : ""}${plan.reflection.completed ? " · Reflection complete" : ""}</span></div>`;
  }

  function installHooks() {
    // Existing calendar and workspace callers already reference these names at click time.
    openLessonPlaceholder = openLessonPlanner;

    const baseRenderTeacherHQ = renderTeacherHQ;
    renderTeacherHQ = function (...args) {
      const result = baseRenderTeacherHQ(...args);
      renderReflectionAttention(getActiveUser());
      appendLessonCalendarExtras();
      return result;
    };

    const baseRenderCalendar = renderCalendar;
    renderCalendar = function (...args) {
      const result = baseRenderCalendar(...args);
      setTimeout(appendLessonCalendarExtras, 0);
      return result;
    };

    const baseRenderWorkspaceCalendar = renderUnitWorkspaceCalendar;
    renderUnitWorkspaceCalendar = function (...args) {
      const result = baseRenderWorkspaceCalendar(...args);
      const user = getActiveUser();
      const currentUnit = getUnitById(activeUnitWorkspaceId, user);
      if (currentUnit) {
        document.querySelectorAll("#unitWorkspaceCalendarGrid .workspace-unit-lesson").forEach(button => {
          // Determine from visible labels; status styling is fully handled in the dedicated Lessons calendar.
          button.classList.add("lesson-system-enabled");
        });
      }
      setTimeout(appendLessonCalendarExtras, 0);
      return result;
    };

    const basePanel = renderUnitWorkspacePanel;
    renderUnitWorkspacePanel = function (unit, section) {
      const heading = document.getElementById("unitWorkspacePanelHeading");
      const content = document.getElementById("unitWorkspacePanelContent");
      if (section === "lessons") {
        heading.textContent = "Lessons";
        content.innerHTML = "";
        renderLessonsWorkspace(unit, content);
        return;
      }
      if (section === "cognitiveTempo") {
        heading.textContent = "Cognitive Tempo";
        content.innerHTML = "";
        renderCognitiveTempo(unit, content);
        return;
      }
      const result = basePanel(unit, section);
      if (section === "assessments" && pendingAssessmentReturn?.unitId === unit.id) {
        const content = document.getElementById("unitWorkspacePanelContent");
        if (content && !content.querySelector("[data-return-to-lesson]")) {
          const returnBar = document.createElement("div");
          returnBar.className = "return-to-lesson-bar";
          returnBar.innerHTML = `<div><strong>Lesson work is saved.</strong><span>When you are finished with the assessment, return to the lesson you came from.</span></div><button type="button" class="primary-button" data-return-to-lesson>Return to Lesson</button>`;
          content.prepend(returnBar);
          returnBar.querySelector("[data-return-to-lesson]").addEventListener("click", () => {
            const target = pendingAssessmentReturn;
            pendingAssessmentReturn = null;
            if (target) openLessonPlanner(target.unitId, target.lessonId);
          });
        }
      }
      return result;
    };

    const baseOpenDayDetails = openDayDetails;
    openDayDetails = function (dateKey) {
      const result = baseOpenDayDetails(dateKey);
      appendAssessmentDayDetails(dateKey);
      return result;
    };

    const baseReadableUnits = buildReadableUnitsHTML;
    buildReadableUnitsHTML = function (user) {
      // Keep all Release C Unit content, then add a readable Lesson Plan appendix.
      const original = baseReadableUnits(user);
      const lessonPlans = (user.units || []).map(unit => {
        const entries = (unit.lessons || []).map(lesson => readableLessonPlanHTML(unit, lesson, user)).filter(Boolean).join("");
        return entries ? `<section class="card"><strong>${escapeHTML(unit.name)} — Lesson Plan Status</strong>${entries}</section>` : "";
      }).filter(Boolean).join("");
      return original + lessonPlans;
    };
  }

  function initializeLessonSystem() {
    createLessonPlannerDialog();
    installHooks();
    renderReflectionAttention(getActiveUser());
    appendLessonCalendarExtras();
    window.TeacherHQLessonPlanner = {
      open: openLessonPlanner,
      ensurePlan: ensureLessonPlan,
      renderReflectionAttention,
      renderCognitiveTempo,
      getPlan(unit, lesson) { return ensureLessonPlan(unit, lesson); },
      version: 2
    };
  }

  initializeLessonSystem();
})();
