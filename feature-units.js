/* ============================================================
   TEACHER HQ — UNITS FEATURE MODULE v18
   Extracted from the former mega-features.js catch-all.
   Owns: field-trip shifting, Unit progressions, Unit deletion,
   assessment rubric download polish, field-trip visuals.
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
  const progressionFrameworks = () => ["Literacy", "Numeracy", "Career", "Competency"];

  function saveUnit(unit) {
    if (!unit) return;
    unit.updatedAt = new Date().toISOString();
    if (typeof autosaveUnit === "function") autosaveUnit(unit);
    else if (typeof saveData === "function") saveData();
  }

  function ensureUnitProgressions(unit) {
    unit.workspace ||= {};
    unit.workspace.progressionSelections ||= {};
    progressionFrameworks().forEach(framework => {
      if (!Array.isArray(unit.workspace.progressionSelections[framework])) {
        unit.workspace.progressionSelections[framework] = [];
      }
    });
    return unit.workspace.progressionSelections;
  }

  function progressionDefaultGrade(unit) {
    return unit?.classSpec?.grades?.[0] || "Grade 4";
  }

  function occurrenceKey(occurrence) {
    return `${occurrence.termId}|${occurrence.versionId}|${occurrence.blockId}|${occurrence.dateKey}`;
  }

  function lessonKey(lesson) {
    return `${lesson.termId}|${lesson.versionId}|${lesson.blockId}|${lesson.dateKey}`;
  }

  function collectFutureOccurrences(unit, user, startDateKey) {
    const range = getRelevantDateRange(user);
    if (!range) return [];
    const start = parseLocalDate(startDateKey);
    const end = parseLocalDate(range.end);
    const result = [];
    const seen = new Set();

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const key = getLocalDateKey(date);
      if (isNoSchoolDate(user, key)) continue;
      getOccurrencesForDate(date, user)
        .filter(item => classMatches(item.block, unit.classSpec))
        .forEach(occurrence => {
          const occurrenceId = occurrenceKey(occurrence);
          if (seen.has(occurrenceId)) return;
          seen.add(occurrenceId);
          if (isOccurrenceAllocated(user, occurrence, unit.id)) return;
          result.push(occurrence);
        });
    }

    return result.sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey) || a.block.startTime.localeCompare(b.block.startTime)
    );
  }

  function shiftLessonsAfterFieldTrip(unit, trip) {
    const user = getActiveUser();
    if (!user || !unit || !trip) return false;

    const ordered = [...(unit.lessons || [])].sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime)
    );
    const firstIndex = ordered.findIndex(lesson => lesson.dateKey >= trip.startDate);
    if (firstIndex < 0) return true;

    const fixed = ordered.slice(0, firstIndex);
    const moving = ordered.slice(firstIndex);
    const nextDay = parseLocalDate(trip.endDate || trip.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const candidates = collectFutureOccurrences(unit, user, getLocalDateKey(nextDay));
    const reserved = new Set(fixed.map(lessonKey));
    let cursor = 0;
    let moved = 0;

    moving.forEach(lesson => {
      while (cursor < candidates.length && reserved.has(occurrenceKey(candidates[cursor]))) cursor++;
      const occurrence = candidates[cursor++];
      if (!occurrence) return;

      lesson.dateKey = occurrence.dateKey;
      lesson.startTime = occurrence.block.startTime;
      lesson.endTime = occurrence.block.endTime;
      lesson.durationMinutes = durationMinutes(occurrence.block.startTime, occurrence.block.endTime);
      lesson.termId = occurrence.termId;
      lesson.versionId = occurrence.versionId;
      lesson.blockId = occurrence.blockId;
      lesson.classSpec = clone(unit.classSpec);
      reserved.add(occurrenceKey(occurrence));
      moved++;
    });

    unit.lessons = ordered.sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime)
    );
    unit.lessons.forEach((lesson, index) => {
      lesson.sequence = index + 1;
      lesson.title = `Lesson ${index + 1}`;
    });
    unit.needsScheduleReview = moved < moving.length ||
      (typeof unitScheduledMinutes === "function" && unitScheduledMinutes(unit) < unit.targetMinutes);
    saveUnit(unit);

    if (moved < moving.length) {
      alert(`${moving.length - moved} lesson${moving.length - moved === 1 ? "" : "s"} could not be shifted because no later instructional blocks were available. Teacher HQ has flagged the Unit for schedule review.`);
    }
    return moved === moving.length;
  }

  function renderUnitProgressions(unit, container) {
    const selections = ensureUnitProgressions(unit);
    const grade = progressionDefaultGrade(unit);
    const intro = document.createElement("div");
    intro.className = "progression-workspace-intro";
    intro.innerHTML = `<div><span class="planning-framework-badge">Progression</span><h4>Literacy, Numeracy, Career & Competency Progressions</h4><p>These frameworks support subject planning. They do not replace or inflate the official subject curriculum.</p></div>`;
    container.appendChild(intro);

    if (!registry()?.progressions?.length) {
      container.insertAdjacentHTML("beforeend", '<div class="empty-state-card">Progression data is not loaded.</div>');
      return;
    }

    progressionFrameworks().forEach(framework => {
      const selected = new Map((selections[framework] || []).map(item => [item.id, item]));
      const divisions = window.TeacherHQCurriculumUI?.progressionDivisions?.(framework) || [];
      const defaults = registry().progressions.filter(record =>
        record.framework === framework && (record.gradeTags || []).includes(grade)
      );
      let division = defaults[0]?.division || divisions[0] || "";
      const card = document.createElement("article");
      card.className = "unit-progression-card";
      card.innerHTML = `<header><div><span class="planning-framework-badge">Progression</span><h4>${escapeHTML(framework)}</h4><small>Default for ${escapeHTML(grade)}</small></div><strong data-count>${selected.size} selected</strong></header><div data-division class="division-nav"></div><div data-tree class="unit-progression-tree"></div>`;
      const nav = card.querySelector("[data-division]");
      const tree = card.querySelector("[data-tree]");

      const draw = () => {
        const defaultDivision = defaults[0]?.division || division;
        const idx = divisions.indexOf(division);
        nav.innerHTML = `<button type="button" data-prev ${idx <= 0 ? "disabled" : ""}>←</button><div><small>Viewing</small><strong>${escapeHTML(division || "No division")}</strong>${division !== defaultDivision ? '<em>Manual division override</em>' : ''}</div><button type="button" data-next ${idx < 0 || idx >= divisions.length - 1 ? "disabled" : ""}>→</button>`;
        nav.querySelector("[data-prev]").onclick = () => { division = divisions[idx - 1]; draw(); };
        nav.querySelector("[data-next]").onclick = () => { division = divisions[idx + 1]; draw(); };

        const records = registry().progressions.filter(record =>
          record.framework === framework && record.division === division
        );
        tree.innerHTML = "";
        if (!records.length) {
          tree.innerHTML = '<div class="empty-state-card compact">No descriptors are available for this division.</div>';
          return;
        }

        const grouped = new Map();
        records.forEach(record => {
          const key = record.heading || framework;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key).push(record);
        });

        grouped.forEach((items, heading) => {
          const details = document.createElement("details");
          details.className = "progression-heading";
          const selectedCount = items.filter(item => selected.has(item.id)).length;
          details.innerHTML = `<summary><strong>${escapeHTML(heading)}</strong><span>${selectedCount ? `${selectedCount} selected` : ""}</span></summary><div></div>`;
          const body = details.querySelector("div");

          items.forEach(record => {
            const current = selected.get(record.id);
            const row = document.createElement("div");
            row.className = `progression-selection-row ${current ? "selected" : ""}`;
            row.innerHTML = `<label><input type="checkbox" ${current ? "checked" : ""} ${readOnlyMode ? "disabled" : ""}/><div><small>${escapeHTML(record.row || record.type || "Descriptor")}</small><p>${escapeHTML(record.text)}</p></div></label><select ${current ? "" : "disabled"} ${readOnlyMode ? "disabled" : ""}><option ${current?.intent === "Develop" ? "selected" : ""}>Develop</option><option ${current?.intent === "Practise" ? "selected" : ""}>Practise</option><option ${current?.intent === "Observe" ? "selected" : ""}>Observe</option></select>`;
            const checkbox = row.querySelector("input");
            const intent = row.querySelector("select");
            checkbox.onchange = () => {
              if (checkbox.checked) selected.set(record.id, { id: record.id, intent: "Develop" });
              else selected.delete(record.id);
              selections[framework] = [...selected.values()];
              saveUnit(unit);
              draw();
            };
            intent.onchange = () => {
              if (selected.has(record.id)) selected.get(record.id).intent = intent.value;
              selections[framework] = [...selected.values()];
              saveUnit(unit);
            };
            body.appendChild(row);
          });
          tree.appendChild(details);
        });
        card.querySelector("[data-count]").textContent = `${selected.size} selected`;
      };

      draw();
      container.appendChild(card);
    });
  }

  function rubricHTML(unit, assessment) {
    if (assessment.rubric?.type === "onePoint") return buildOnePointRubricPrintHTML(unit, assessment);
    if (assessment.rubric?.type === "threePoint") return buildThreePointRubricPrintHTML(unit, assessment);
    if (assessment.rubric?.type === "fourPoint") return buildFourPointRubricPrintHTML(unit, assessment);
    return "";
  }

  function downloadRubric(unit, assessment) {
    const problem = validateRubricForPrint(unit, assessment);
    if (problem) return alert(problem);
    const html = rubricHTML(unit, assessment);
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TeacherHQ_${String(assessment.title || "Rubric").replace(/[^a-z0-9_-]+/gi, "_")}_Rubric.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function enhanceAssessmentPrintControls(unit) {
    document.querySelectorAll(".rubric-print-actions").forEach(group => {
      const view = group.querySelector("[data-rubric-print]");
      if (view) view.textContent = "View Print-Friendly Version";
      if (!group.querySelector("[data-rubric-download]") && view) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button";
        button.dataset.rubricDownload = "";
        button.textContent = "Download Print-Friendly Version";
        button.onclick = () => {
          const id = workspaceAssessmentEditorId;
          const assessment = (unit.workspace?.assessments || []).find(item => item.id === id);
          if (assessment) downloadRubric(unit, assessment);
        };
        group.appendChild(button);
      }
    });
  }

  function enhanceFieldTripVisuals() {
    document.querySelectorAll(".field-trip-card .field-trip-icon").forEach(icon => {
      icon.textContent = "🚌";
    });
  }

  function enhanceUnitDeleteButton() {
    const actions = document.querySelector(".unit-workspace-meta-actions");
    if (!actions || actions.querySelector("[data-delete-unit]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "danger-outline-button edit-only";
    button.dataset.deleteUnit = "";
    button.textContent = "Delete Unit";
    button.onclick = () => {
      const user = getActiveUser();
      const unit = getUnitById(activeUnitWorkspaceId, user);
      if (!unit) return;
      if (!confirm(`Move “${unit.name}” and its contained lesson/assessment data to Trash?`)) return;
      window.TeacherHQTrash?.softDelete("unit", unit, { parent: "user.units" });
      user.units = user.units.filter(item => item.id !== unit.id);
      saveData();
      document.getElementById("unitDetailDialog")?.close();
      activeUnitWorkspaceId = null;
      renderTeacherHQ();
    };
    actions.appendChild(button);
  }

  function installWorkspaceWrappers() {
    try {
      if (typeof renderUnitWorkspacePanel === "function" && !renderUnitWorkspacePanel.__teacherHQUnitsV18) {
        const basePanel = renderUnitWorkspacePanel;
        const wrappedPanel = function(unit, section) {
          if (section === "progressions") {
            const heading = $id("unitWorkspacePanelHeading");
            const content = $id("unitWorkspacePanelContent");
            heading.textContent = "Literacy, Numeracy, Career & Competency Progressions";
            content.innerHTML = "";
            renderUnitProgressions(unit, content);
            return;
          }
          const result = basePanel.apply(this, arguments);
          if (section === "assessments") enhanceAssessmentPrintControls(unit);
          if (section === "fieldTrips") enhanceFieldTripVisuals();
          return result;
        };
        wrappedPanel.__teacherHQUnitsV18 = true;
        renderUnitWorkspacePanel = wrappedPanel;
      }
    } catch (error) {
      console.warn("Teacher HQ: could not extend Unit Workspace panel", error);
    }

    try {
      if (typeof renderUnitWorkspace === "function" && !renderUnitWorkspace.__teacherHQUnitsV18) {
        const baseWorkspace = renderUnitWorkspace;
        const wrappedWorkspace = function() {
          const result = baseWorkspace.apply(this, arguments);
          enhanceUnitDeleteButton();
          return result;
        };
        wrappedWorkspace.__teacherHQUnitsV18 = true;
        renderUnitWorkspace = wrappedWorkspace;
      }
    } catch (error) {
      console.warn("Teacher HQ: could not extend Unit Workspace", error);
    }
  }

  const api = {
    saveUnit,
    shiftLessonsAfterFieldTrip,
    renderUnitProgressions,
    enhanceAssessmentPrintControls,
    enhanceFieldTripVisuals,
    enhanceUnitDeleteButton
  };

  hq.features.register({
    name: "units",
    description: "Unit Planner, Unit Workspace, field-trip shifting, progression planning and Unit-level enhancements.",
    owns: ["feature-units.js"],
    transitionalLegacyFiles: ["app.js", "mega-features.js"],
    init(ctx) {
      window.TeacherHQUnits = api;
      window.TeacherHQPlanning = { ...(window.TeacherHQPlanning || {}), shiftLessonsAfterFieldTrip };
      installWorkspaceWrappers();
      enhanceUnitDeleteButton();
      ctx.events.emit("units:module:loaded", { transitional: true });
    }
  });
})();
