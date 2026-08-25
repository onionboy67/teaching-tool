/* ============================================================
   TEACHER HQ — CALENDAR TOOLS
   ------------------------------------------------------------
   Shared date-picker, readable daily view, Overview calendar renderer,
   compact notifications, course colours, and automatic text contrast.
============================================================ */
(function () {
  "use strict";

  const $id = id => document.getElementById(id);
  const COURSE_COLOURS = ["#FF5F8F","#8C6CFF","#33C7FF","#39D98A","#FFB347","#F04FCB","#6EDB3F","#FF7043","#00B8D9","#FFC93C","#A45CFF","#00C48C"];

  function hex(value, fallback="#33C7FF") { return normalizeHexColour?.(value) || fallback; }
  function rgbFromHex(value) { const c=hex(value).slice(1); return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]; }
  function contrastText(background) { const [r,g,b]=rgbFromHex(background).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); const lum=0.2126*r+0.7152*g+0.0722*b; return lum>0.48?"#17171A":"#FFFFFF"; }
  function rgba(background,alpha=.15){const [r,g,b]=rgbFromHex(background);return `rgba(${r}, ${g}, ${b}, ${alpha})`;}

  function classForBlock(user, block) {
    const linked = window.TeacherHQClasses?.classById(user, block.classId);
    if (linked) return linked;
    const matches = (user.classes || []).filter(item => classKey({grades:item.grades,subject:item.subject})===classKey({grades:block.grades,subject:block.subject}));
    return matches.length === 1 ? matches[0] : null;
  }

  function courseColour(user, block) {
    const teachingClass=classForBlock(user,block); if(teachingClass?.colour)return hex(teachingClass.colour);
    user.courseColours ||= {}; const key=classKey({grades:block.grades,subject:block.subject}); if(!user.courseColours[key]){const used=new Set(Object.values(user.courseColours).map(v=>String(v).toUpperCase())); user.courseColours[key]=COURSE_COLOURS.find(c=>!used.has(c.toUpperCase()))||COURSE_COLOURS[Object.keys(user.courseColours).length%COURSE_COLOURS.length]; saveData();} return hex(user.courseColours[key]);
  }

  function lessonForOccurrence(user, occurrence) {
    const matches=findUnitLessonsForOccurrence(user,occurrence)||[];
    return matches.length?matches[0]:null;
  }

  function instructionalLabel(user, occurrence) {
    const linked=lessonForOccurrence(user,occurrence);
    const teachingClass=classForBlock(user,occurrence.block);
    const term=(user.terms||[]).find(item=>item.id===occurrence.termId);
    const finished=Boolean(teachingClass?.archivedAt||term?.archivedAt);
    const label=linked ? lessonDisplayTitleForUnit(linked.unit,linked.lesson) : (teachingClass?.name || `${gradeDisplay(occurrence.block.grades)} ${occurrence.block.subject}`.trim() || "Instructional Block");
    return `${finished?"✓ ":""}${label}`;
  }

  function occurrenceArchived(user, occurrence) {
    const teachingClass = classForBlock(user, occurrence.block);
    const term = (user.terms || []).find(item => item.id === occurrence.termId);
    return Boolean(teachingClass?.archivedAt || term?.archivedAt);
  }

  function reflectionDueItems(user) {
    const now=new Date(); const today=getLocalDateKey(now); const afterFive=now.getHours()>=17; const results=[];
    (user.units||[]).forEach(unit=>{ const plans=unit.workspace?.lessonPlans||{}; (unit.lessons||[]).forEach(lesson=>{ const plan=plans[lesson.id]; if(!plan)return; const past=lesson.dateKey<today || (lesson.dateKey===today&&afterFive); if(past&&!plan.reflection?.completed)results.push({unit,lesson}); }); });
    return results.sort((a,b)=>a.lesson.dateKey.localeCompare(b.lesson.dateKey));
  }

  function notificationItems(user) {
    if(!user)return[]; const items=[]; const today=getLocalDateKey();
    if(user.lastBackupDate!==today)items.push({type:"backup",icon:"↓",title:"Daily backup needed",detail:"Download today's portable recovery copy.",action:()=>document.getElementById("downloadBackupButton")?.click()});
    if((user.terms||[]).some(term=>!term.archivedAt)){const counts=countFutureAttentionItems(user);if(counts.unplanned)items.push({type:"danger",icon:"!",title:`${counts.unplanned} lesson block${counts.unplanned===1?"":"s"} need planning`,detail:""});if(counts.conflicts)items.push({type:"warning",icon:"!",title:`${counts.conflicts} schedule conflict${counts.conflicts===1?"":"s"}`,detail:"Overlaps are allowed but should be reviewed."});}
    const pd=getPDAttentionItems?.(user)||[]; if(pd.length)items.push({type:"info",icon:"!",title:`${pd.length} upcoming PD entr${pd.length===1?"y":"ies"} incomplete`,detail:"Location or description is missing.",action:()=>document.getElementById("manageDaysOffButton")?.click()});
    const reflections=reflectionDueItems(user);if(reflections.length)items.push({type:"reflection",icon:"!",title:`${reflections.length} lesson reflection${reflections.length===1?"":"s"} need attention`,detail:`Oldest: ${formatDate(reflections[0].lesson.dateKey)} · ${reflections[0].unit.name}`,action:()=>window.TeacherHQLessonPlanner?.open?.(reflections[0].unit.id,reflections[0].lesson.id)});
    (user.interestReminders||[]).filter(reminder=>!reminder.completedAt&&reminder.dueDate&&reminder.dueDate<=today).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).forEach(reminder=>{
      const cohort=window.TeacherHQClasses?.cohortById?.(user,reminder.cohortId); if(!cohort)return;
      const students=(reminder.studentIds||[]).map(id=>(cohort.students||[]).find(student=>student.id===id)).filter(Boolean);
      const label=students.length?students.map(student=>student.code).join(", "):"selected students";
      items.push({type:"interest",icon:"!",title:reminder.note||"Gather student interests",detail:`${cohort.name} · Students ${label}`,action:()=>window.TeacherHQClasses?.openCohortDashboard?.(cohort.id,"reminders")});
    });
    return items;
  }

  function renderNotificationDock(user) {
    const dock = $id("notificationDock"); if (!dock) return;
    const items = notificationItems(user);
    document.querySelectorAll(".legacy-notice,#reflectionAlert").forEach(el => el.classList.add("hidden"));
    dock.classList.remove("hidden");
    dock.innerHTML = `<div class="notification-hub-summary"><strong>${items.length ? `${items.length} open` : "All clear"}</strong><small>${items.length ? "Select an item to act on it." : "Nothing needs your attention right now."}</small></div><div class="notification-drawer"></div>`;
    const drawer = dock.querySelector(".notification-drawer");
    items.forEach(item => {
      const row = document.createElement(item.action ? "button" : "article");
      if (item.action) row.type = "button";
      row.className = `notification-row notification-${item.type}`;
      row.innerHTML = `<span class="notification-icon">${item.icon}</span><div><strong>${escapeHTML(item.title)}</strong>${item.detail ? `<small>${escapeHTML(item.detail)}</small>` : ""}</div>${item.action ? '<em>→</em>' : ''}`;
      if (item.action) row.onclick = item.action;
      drawer.appendChild(row);
    });
  }


  function renderOverviewCalendar() {
    const grid = $id("calendarGrid"), title = $id("monthTitle"), user = getActiveUser();
    if (!grid || !title || !user) return;
    grid.innerHTML = "";
    const year = visibleDate.getFullYear(), month = visibleDate.getMonth(), today = getLocalDateKey();
    title.textContent = visibleDate.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label, index) => {
      const heading = document.createElement("div");
      heading.className = `weekday ${index === 0 || index === 6 ? "weekend-heading" : ""}`;
      heading.textContent = label;
      grid.appendChild(heading);
    });
    const first = new Date(year, month, 1).getDay(), days = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < first; i += 1) {
      const empty = document.createElement("div"); empty.className = "day empty"; grid.appendChild(empty);
    }
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day), key = getLocalDateKey(date);
      const cell = document.createElement("div");
      cell.className = "day overview-rich-day";
      cell.dataset.dateKey = key;
      if ([0, 6].includes(date.getDay())) cell.classList.add("weekend");
      if (key < today) cell.classList.add("past");
      if (key === today) cell.classList.add("today");
      cell.innerHTML = `<span class="day-number">${day}</span><div class="overview-day-events"></div>`;
      const events = cell.querySelector(".overview-day-events");
      const exception = getExceptionForDate(user, key);
      const subDay = exception?.type === "Sub Day";
      const noSchool = Boolean(exception && !subDay);

      if (exception) {
        if (subDay) {
          cell.classList.add("sub-day");
          events.insertAdjacentHTML("beforeend", `<span class="overview-sub-day"><strong>SUB</strong><small>${escapeHTML(exception.label || "Sub Day")}</small></span>`);
        } else {
          cell.classList.add("no-school-day", `no-school-${exception.type.toLowerCase().replaceAll(" ", "-")}`);
          events.insertAdjacentHTML("beforeend", `<span class="overview-day-off"><strong>${escapeHTML(exception.label || exception.type)}</strong><small>${escapeHTML(exception.type)}</small></span>`);
        }
      }

      if (!noSchool) {
        getOccurrencesForDate(date, user).filter(item => item.block.blockType === "Instructional Time").forEach(occ => {
          const linked = lessonForOccurrence(user, occ);
          const archived = occurrenceArchived(user, occ);
          const planned = Boolean(archived || occ.planned || linked?.unit?.workspace?.lessonPlans?.[linked.lesson.id]?.complete);
          const colour = courseColour(user, occ.block);
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = `overview-instruction-chip ${planned ? "planned" : "needs-plan"} ${archived ? "archived" : ""} ${occ.conflict && !archived ? "conflict" : ""}`;
          chip.style.setProperty("--course-colour", colour);
          chip.style.setProperty("--course-text", contrastText(colour));
          chip.textContent = instructionalLabel(user, occ);
          chip.title = `${formatTime(occ.block.startTime)}–${formatTime(occ.block.endTime)} · ${archived ? "Finished / archived" : planned ? "Planned" : "Lesson needs to be created/planned"}`;
          chip.onclick = event => {
            event.stopPropagation();
            if (linked) openLessonPlaceholder(linked.unit.id, linked.lesson.id);
            else openDailyView(key);
          };
          events.appendChild(chip);
        });
      }

      getFieldTripsForDate(user, key).forEach(({ unit, trip }) => {
        const colour = hex(unit.colour, "#FF7043");
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "overview-trip-chip";
        chip.style.setProperty("--trip-colour", colour);
        chip.style.setProperty("--trip-text", contrastText(colour));
        chip.textContent = `🚌 ${trip.title}`;
        chip.onclick = event => {
          event.stopPropagation();
          activeUnitWorkspaceId = unit.id; activeUnitWorkspaceSection = "fieldTrips"; workspaceFieldTripEditorId = trip.id; renderUnitWorkspace();
        };
        events.appendChild(chip);
      });

      (user.units || []).forEach(unit => (unit.workspace?.assessments || [])
        .filter(assessment => assessment.status !== "draft" && assessment.date === key)
        .forEach(assessment => {
          const chip = document.createElement("button"); chip.type = "button"; chip.className = "overview-assessment-chip";
          chip.textContent = `✓ ${assessment.title}`;
          chip.onclick = event => {
            event.stopPropagation(); activeUnitWorkspaceId = unit.id; activeUnitWorkspaceSection = "assessments"; workspaceAssessmentEditorId = assessment.id; renderUnitWorkspace();
          };
          events.appendChild(chip);
        }));

      const dailyCustom = user.dailyRecords?.[key]?.events || [];
      dailyCustom.slice(0, 2).forEach(item => {
        const chip = document.createElement("button"); chip.type = "button"; chip.className = "overview-custom-event-chip";
        chip.textContent = `${item.type === "Block" ? "▥" : "•"} ${item.title}`;
        chip.onclick = event => { event.stopPropagation(); openDailyItemEditor(key, item); };
        events.appendChild(chip);
      });
      if (dailyCustom.length > 2) events.insertAdjacentHTML("beforeend", `<small class="overview-more-events">+${dailyCustom.length - 2} more</small>`);

      cell.onclick = event => { event.stopPropagation(); openDailyView(key); };
      grid.appendChild(cell);
    }
    renderNotificationDock(user);
  }

  function createDailyDialog() {
    let dialog = $id("dailyViewDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "dailyViewDialog";
    dialog.className = "modal extra-large-modal daily-view-dialog";
    dialog.innerHTML = `<div class="modal-content">
      <div class="modal-heading"><div><p class="small-label">Daily View</p><h2 data-daily-title></h2><p data-daily-meta class="section-subtitle"></p></div><button class="close-button" type="button" data-daily-close>×</button></div>
      <div data-daily-alerts class="daily-alerts"></div>
      <div class="daily-create-actions edit-only">
        <button type="button" class="primary-button" data-daily-add-lesson>+ Lesson</button>
        <button type="button" class="secondary-button" data-daily-add-event>+ Event</button>
        <button type="button" class="secondary-button" data-daily-add-block>+ Block</button>
      </div>
      <div class="daily-view-actions"><button type="button" class="secondary-button" data-daily-print-view>View Print-Friendly Version</button><button type="button" class="secondary-button" data-daily-download>Download Print-Friendly Version</button></div>
      <div data-daily-content></div>
      <section class="daily-reflection-card"><div><p class="small-label">Optional</p><h3>Daily Reflection</h3><p class="section-subtitle">A day-level reflection is separate from individual Lesson reflections.</p></div><textarea data-daily-reflection rows="7" placeholder="What should you remember from today?"></textarea><small data-daily-saved></small></section>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-daily-close]").onclick = () => dialog.close();
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function dayData(user, dateKey) {
    const date = parseLocalDate(dateKey);
    const occurrences = getOccurrencesForDate(date, user);
    const trips = getFieldTripsForDate(user, dateKey);
    const exception = getExceptionForDate(user, dateKey);
    const customEvents = Array.isArray(user.dailyRecords?.[dateKey]?.events) ? user.dailyRecords[dateKey].events : [];
    const assessmentItems = [];
    (user.units || []).forEach(unit => (unit.workspace?.assessments || []).filter(a => a.status !== "draft" && a.date === dateKey).forEach(assessment => assessmentItems.push({ unit, assessment })));
    const milestones = [];
    (user.units || []).forEach(unit => {
      const plans = unit.workspace?.lessonPlans || {};
      Object.entries(plans).forEach(([lessonId, plan]) => (plan.assessments?.links || []).forEach(link => {
        const assessment = (unit.workspace?.assessments || []).find(a => a.id === link.assessmentId);
        if (!assessment) return;
        if (link.toStudentsDate === dateKey) milestones.push({ unit, assessment, direction: "TO" });
        if (link.fromStudentsDate === dateKey) milestones.push({ unit, assessment, direction: "FROM" });
      }));
    });
    return { date, occurrences, trips, exception, customEvents, assessmentItems, milestones };
  }

  function dailyAlertsFor(user, dateKey) {
    const alerts = [], data = dayData(user, dateKey);
    const unplanned = data.occurrences.filter(o => o.block.blockType === "Instructional Time" && !o.planned && !occurrenceArchived(user, o)).length;
    if (unplanned) alerts.push(`${unplanned} instructional block${unplanned === 1 ? "" : "s"} still need planning.`);
    const conflicts = getConflictPairCount(data.occurrences.filter(o => !occurrenceArchived(user, o)));
    if (conflicts) alerts.push(`${conflicts} schedule conflict${conflicts === 1 ? "" : "s"} on this date.`);
    const weekly = notificationItems(user).map(item => item.title);
    return { alerts, weekly };
  }

  function dailyContentHTML(user, dateKey, print = false) {
    const data = dayData(user, dateKey);
    let html = "";
    if (data.exception) {
      const sub = data.exception.type === "Sub Day";
      html += `<div class="daily-day-off ${sub ? "daily-sub-day" : ""}"><strong>${sub ? "SUB · " : ""}${escapeHTML(data.exception.label || data.exception.type)}</strong><span>${escapeHTML(data.exception.type)}${data.exception.description ? ` · ${escapeHTML(data.exception.description)}` : ""}</span></div>`;
    }
    const rows = [];
    data.occurrences.forEach(occ => {
      const block = occ.block, linked = lessonForOccurrence(user, occ);
      if (block.blockType === "Instructional Time") {
        const archived = occurrenceArchived(user, occ);
        const title = linked ? lessonDisplayTitleForUnit(linked.unit, linked.lesson) : (classForBlock(user, block)?.name || `${gradeDisplay(block.grades)} ${block.subject}`);
        const detail = linked ? linked.unit.name : "Instructional Time";
        rows.push({
          time: block.startTime,
          html: linked
            ? `<button type="button" class="daily-event daily-event-link instructional ${archived ? "archived" : occ.planned ? "planned" : "unplanned"}" style="--event-colour:${courseColour(user, block)}" data-open-lesson data-unit-id="${escapeHTML(linked.unit.id)}" data-lesson-id="${escapeHTML(linked.lesson.id)}"><time>${escapeHTML(formatTime(block.startTime))}</time><div><strong>${escapeHTML(`${archived ? "✓ " : ""}${title}`)}</strong><span>${escapeHTML(detail)}${archived ? " · finished / archived" : !occ.planned ? " · needs planning" : ""}</span></div><em>→</em></button>`
            : `<article class="daily-event instructional ${archived ? "archived" : occ.planned ? "planned" : "unplanned"}" style="--event-colour:${courseColour(user, block)}"><time>${escapeHTML(formatTime(block.startTime))}</time><div><strong>${escapeHTML(`${archived ? "✓ " : ""}${title}`)}</strong><span>${escapeHTML(detail)}${archived ? " · finished / archived" : !occ.planned ? " · needs planning" : ""}</span></div></article>`
        });
      } else {
        rows.push({ time: block.startTime, html: `<article class="daily-event noninstructional"><time>${escapeHTML(formatTime(block.startTime))}</time><div><strong>${escapeHTML(block.label || block.blockType)}</strong><span>${escapeHTML(block.blockType)}</span></div></article>` });
      }
    });
    data.customEvents.forEach(item => {
      rows.push({
        time: item.startTime || "12:00",
        html: `<button type="button" class="daily-event daily-event-link custom-daily-event" data-custom-event-id="${escapeHTML(item.id)}"><time>${escapeHTML(item.startTime ? formatTime(item.startTime) : item.type === "Block" ? "▥" : "•")}</time><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.type || "Event")}${item.endTime ? ` · ${escapeHTML(formatTime(item.endTime))}` : ""}${item.notes ? ` · ${escapeHTML(item.notes)}` : ""}</span></div><em>→</em></button>`
      });
    });
    data.trips.forEach(({ unit, trip }) => {
      const archived = Boolean(window.TeacherHQClasses?.classById?.(user, unit.classId)?.archivedAt);
      rows.push({ time: "12:00", html: `<button type="button" class="daily-event daily-event-link field-trip ${archived ? "archived" : ""}" data-open-field-trip data-unit-id="${escapeHTML(unit.id)}" data-trip-id="${escapeHTML(trip.id)}"><time>🚌</time><div><strong>${archived ? "✓ " : ""}Field Trip — ${escapeHTML(trip.title)}</strong><span>${escapeHTML(unit.name)}${trip.location ? ` · ${escapeHTML(trip.location)}` : ""}</span></div><em>→</em></button>` });
    });
    data.assessmentItems.forEach(({ unit, assessment }) => {
      const archived = Boolean(window.TeacherHQClasses?.classById?.(user, unit.classId)?.archivedAt);
      rows.push({ time: "23:50", html: `<button type="button" class="daily-event daily-event-link assessment ${archived ? "archived" : ""}" data-open-assessment data-unit-id="${escapeHTML(unit.id)}" data-assessment-id="${escapeHTML(assessment.id)}"><time>✓</time><div><strong>${archived ? "✓ " : ""}${escapeHTML(assessment.title)}</strong><span>${escapeHTML(assessmentTypeLabel(assessment.type))} · ${escapeHTML(unit.name)}</span></div><em>→</em></button>` });
    });
    data.milestones.forEach(({ unit, assessment, direction }) => rows.push({ time: direction === "TO" ? "07:00" : "23:40", html: `<article class="daily-event assessment-milestone"><time>${direction}</time><div><strong>${escapeHTML(assessment.title)}</strong><span>${direction === "TO" ? "To students" : "From students"} · ${escapeHTML(unit.name)}</span></div></article>` }));
    rows.sort((a, b) => a.time.localeCompare(b.time));
    html += `<div class="daily-timeline">${rows.length ? rows.map(row => row.html).join("") : '<div class="empty-state-card">Nothing is scheduled for this date.</div>'}</div>`;
    const reflection = user.dailyRecords?.[dateKey]?.reflection || "";
    if (print) html += `<section class="print-daily-reflection"><h3>Daily Reflection</h3><p>${reflection ? escapeHTML(reflection).replaceAll("\n", "<br>") : '&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;'}</p></section>`;
    return html;
  }

  function openDailyItemEditor(dateKey, existing = null, type = "Event") {
    const user = getActiveUser(); if (!user || readOnlyMode) return;
    user.dailyRecords ||= {}; user.dailyRecords[dateKey] ||= { reflection: "", updatedAt: "", events: [] };
    user.dailyRecords[dateKey].events ||= [];
    let dialog = $id("dailyItemEditorDialog");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "dailyItemEditorDialog"; dialog.className = "modal"; document.body.appendChild(dialog); }
    const itemType = existing?.type || type;
    dialog.innerHTML = `<form class="modal-content"><div class="modal-heading"><div><p class="small-label">${escapeHTML(formatDate(dateKey))}</p><h2>${existing ? "Edit" : "Add"} ${escapeHTML(itemType)}</h2></div><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Title</span><input data-title required maxlength="120" value="${escapeHTML(existing?.title || "")}" placeholder="${itemType === "Block" ? "Assembly, library block, special activity…" : "Meeting, event, reminder…"}" /></label><div class="form-grid two-column-grid"><label class="form-field"><span>Start Time <small>optional</small></span><input data-start type="time" value="${escapeHTML(existing?.startTime || "")}" /></label><label class="form-field"><span>End Time <small>optional</small></span><input data-end type="time" value="${escapeHTML(existing?.endTime || "")}" /></label></div><label class="form-field"><span>Notes <small>optional</small></span><textarea data-notes rows="3">${escapeHTML(existing?.notes || "")}</textarea></label><div class="modal-actions">${existing ? '<button type="button" class="danger-text-button" data-delete>Delete</button>' : ""}<button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save ${escapeHTML(itemType)}</button></div></form>`;
    dialog.querySelectorAll("[data-close]").forEach(button => button.onclick = () => dialog.close());
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
      user.dailyRecords[dateKey].events = user.dailyRecords[dateKey].events.filter(item => item.id !== existing.id);
      user.dailyRecords[dateKey].updatedAt = new Date().toISOString(); saveData(); dialog.close(); openDailyView(dateKey); renderOverviewCalendar();
    });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const title = dialog.querySelector("[data-title]").value.trim(); if (!title) return;
      const payload = {
        id: existing?.id || makeId("daily-event"), type: itemType, title,
        startTime: dialog.querySelector("[data-start]").value,
        endTime: dialog.querySelector("[data-end]").value,
        notes: dialog.querySelector("[data-notes]").value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      const index = user.dailyRecords[dateKey].events.findIndex(item => item.id === payload.id);
      if (index >= 0) user.dailyRecords[dateKey].events[index] = payload; else user.dailyRecords[dateKey].events.push(payload);
      user.dailyRecords[dateKey].updatedAt = new Date().toISOString(); saveData(); dialog.close(); openDailyView(dateKey); renderOverviewCalendar();
    };
    dialog.showModal();
  }

  function bindDailyContentActions(dialog, user, dateKey) {
    dialog.querySelectorAll("[data-open-lesson]").forEach(button => button.onclick = () => {
      dialog.close(); openLessonPlaceholder(button.dataset.unitId, button.dataset.lessonId);
    });
    dialog.querySelectorAll("[data-open-field-trip]").forEach(button => button.onclick = () => {
      dialog.close(); activeUnitWorkspaceId = button.dataset.unitId; activeUnitWorkspaceSection = "fieldTrips"; workspaceFieldTripEditorId = button.dataset.tripId; renderUnitWorkspace();
    });
    dialog.querySelectorAll("[data-open-assessment]").forEach(button => button.onclick = () => {
      dialog.close(); activeUnitWorkspaceId = button.dataset.unitId; activeUnitWorkspaceSection = "assessments"; workspaceAssessmentEditorId = button.dataset.assessmentId; renderUnitWorkspace();
    });
    dialog.querySelectorAll("[data-custom-event-id]").forEach(button => button.onclick = () => {
      const item = user.dailyRecords?.[dateKey]?.events?.find(entry => entry.id === button.dataset.customEventId); if (item) openDailyItemEditor(dateKey, item);
    });
  }

  function openDailyView(dateKey) {
    const user = getActiveUser(); if (!user) return;
    user.dailyRecords ||= {};
    user.dailyRecords[dateKey] ||= { reflection: "", updatedAt: "", events: [] };
    user.dailyRecords[dateKey].events ||= [];
    const dialog = createDailyDialog(); dialog.dataset.dateKey = dateKey;
    dialog.querySelector("[data-daily-title]").textContent = parseLocalDate(dateKey).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    dialog.querySelector("[data-daily-meta]").textContent = "Daily timetable · lessons, events, blocks, assessments and reflection";
    const alerts = dailyAlertsFor(user, dateKey);
    dialog.querySelector("[data-daily-alerts]").innerHTML = `${alerts.alerts.length ? `<div class="daily-notice-group"><strong>For this day</strong>${alerts.alerts.map(a => `<span>• ${escapeHTML(a)}</span>`).join("")}</div>` : ""}${alerts.weekly.length ? `<details><summary>This week / general notifications</summary>${alerts.weekly.map(a => `<span>• ${escapeHTML(a)}</span>`).join("")}</details>` : ""}`;
    dialog.querySelector("[data-daily-content]").innerHTML = dailyContentHTML(user, dateKey);
    bindDailyContentActions(dialog, user, dateKey);
    const reflection = dialog.querySelector("[data-daily-reflection]"); reflection.value = user.dailyRecords[dateKey].reflection || ""; reflection.disabled = readOnlyMode;
    let timer;
    reflection.oninput = () => { if (readOnlyMode) return; clearTimeout(timer); timer = setTimeout(() => { user.dailyRecords[dateKey].reflection = reflection.value; user.dailyRecords[dateKey].updatedAt = new Date().toISOString(); saveData(); dialog.querySelector("[data-daily-saved]").textContent = "Saved"; }, 250); };
    dialog.querySelector("[data-daily-add-lesson]").onclick = () => { dialog.close(); window.TeacherHQMega?.openStandaloneLesson?.(dateKey); };
    dialog.querySelector("[data-daily-add-event]").onclick = () => openDailyItemEditor(dateKey, null, "Event");
    dialog.querySelector("[data-daily-add-block]").onclick = () => openDailyItemEditor(dateKey, null, "Block");
    dialog.querySelector("[data-daily-print-view]").onclick = () => openDailyPrint(dateKey, false);
    dialog.querySelector("[data-daily-download]").onclick = () => openDailyPrint(dateKey, true);
    dialog.showModal();
  }

  function dailyPrintHTML(user,dateKey){const title=parseLocalDate(dateKey).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)} · Teacher HQ</title><style>@page{size:letter;margin:.55in}body{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17171a}header{border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px}h1{font-size:28px;margin:0}header p{margin:5px 0 0;color:#666}.daily-timeline{display:grid;gap:8px}.daily-event{display:grid;grid-template-columns:70px 1fr;gap:10px;border:1px solid #ddd;border-radius:10px;padding:10px}.daily-event time{font-weight:800}.daily-event span{display:block;color:#555;font-size:12px}.noninstructional{font-size:12px;border-style:dashed}.field-trip{border:2px solid #f2994a}.print-daily-reflection{margin-top:28px;border:1px solid #bbb;border-radius:12px;padding:14px;min-height:180px}.print-daily-reflection h3{margin-top:0}</style></head><body><header><h1>${escapeHTML(title)}</h1><p>Teacher HQ · Daily Timetable</p></header>${dailyContentHTML(user,dateKey,true)}</body></html>`;}
  function openDailyPrint(dateKey,download){const user=getActiveUser();if(!user)return;const htmlText=dailyPrintHTML(user,dateKey);if(download){const blob=new Blob([htmlText],{type:"text/html"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`TeacherHQ_Daily_${dateKey}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return;}const win=window.open("","_blank");if(!win)return alert("Please allow pop-ups for Teacher HQ.");win.document.write(htmlText);win.document.close();}

  /* ---------------- Shared Calendar Picker ---------------- */
  function createPicker(){let dialog=$id("sharedCalendarPickerDialog");if(dialog)return dialog;dialog=document.createElement("dialog");dialog.id="sharedCalendarPickerDialog";dialog.className="modal calendar-picker-dialog";dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><p class="small-label">Calendar</p><h2 data-picker-title>Choose a Date</h2><p data-picker-subtitle class="section-subtitle"></p></div><button class="close-button" type="button" data-picker-close>×</button></div><div class="shared-picker-header"><button type="button" data-picker-prev>←</button><h3 data-picker-month></h3><button type="button" data-picker-next>→</button></div><div data-picker-grid class="shared-picker-grid"></div><div data-picker-range class="picker-range-summary"></div><div class="modal-actions"><button type="button" class="secondary-button" data-picker-cancel>Cancel</button><button type="button" class="primary-button" data-picker-choose>Choose Date</button></div></div>`;document.body.appendChild(dialog);dialog.querySelector("[data-picker-close]").onclick=()=>dialog.close();dialog.querySelector("[data-picker-cancel]").onclick=()=>dialog.close();return dialog;}
  function openPicker(options={}){const user=options.user||getActiveUser();const dialog=createPicker();let chosenStart=options.startDate||"",chosenEnd=options.endDate||chosenStart,visible=chosenStart?parseLocalDate(chosenStart):new Date();visible=new Date(visible.getFullYear(),visible.getMonth(),1);dialog.querySelector("[data-picker-title]").textContent=options.title||"Choose a Date";dialog.querySelector("[data-picker-subtitle]").textContent=options.subtitle||"Lessons, Days Off and Field Trips remain visible while you choose.";const draw=()=>{const year=visible.getFullYear(),month=visible.getMonth();dialog.querySelector("[data-picker-month]").textContent=visible.toLocaleDateString(undefined,{month:"long",year:"numeric"});const grid=dialog.querySelector("[data-picker-grid]");grid.innerHTML="";["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d=>grid.insertAdjacentHTML("beforeend",`<div class="weekday-name">${d}</div>`));const first=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();for(let i=0;i<first;i++)grid.insertAdjacentHTML("beforeend",'<div class="picker-day blank"></div>');for(let d=1;d<=days;d++){const key=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;const cell=document.createElement("button");cell.type="button";cell.className=`picker-day ${[0,6].includes(new Date(year,month,d).getDay())?"weekend":""} ${key===chosenStart?"selected":""} ${options.allowRange&&chosenStart&&chosenEnd&&key>=chosenStart&&key<=chosenEnd?"in-range":""}`;cell.innerHTML=`<span>${d}</span><div></div>`;const inner=cell.querySelector("div");const exception=getExceptionForDate(user,key);if(exception)inner.insertAdjacentHTML("beforeend",`<small class="picker-off">${escapeHTML(exception.label||exception.type)}</small>`);if(options.showLessons!==false)(user.units||[]).filter(unit=>!options.classSpec||classKey(unit.classSpec)===classKey(options.classSpec)).forEach(unit=>(unit.lessons||[]).filter(l=>l.dateKey===key).forEach(l=>{const colour=hex(unit.colour);inner.insertAdjacentHTML("beforeend",`<small class="picker-lesson" style="--unit-colour:${colour};--unit-text:${contrastText(colour)}">${escapeHTML(lessonDisplayTitleForUnit(unit,l))}</small>`);}));if(options.showFieldTrips!==false)getFieldTripsForDate(user,key).forEach(({trip})=>inner.insertAdjacentHTML("beforeend",`<small class="picker-trip">🚌 ${escapeHTML(trip.title)}</small>`));cell.onclick=()=>{if(options.isDateAllowed&&options.isDateAllowed(key)===false)return;if(options.allowRange&&chosenStart&&options.rangeMode){if(!chosenEnd||chosenEnd===chosenStart){chosenEnd=key<chosenStart?chosenStart:key;if(key<chosenStart)chosenStart=key;}else{chosenStart=key;chosenEnd=key;}}else{chosenStart=key;chosenEnd=key;}draw();};grid.appendChild(cell);}dialog.querySelector("[data-picker-range]").textContent=chosenStart?(options.allowRange&&chosenEnd!==chosenStart?`${formatDate(chosenStart)} → ${formatDate(chosenEnd)}`:formatDate(chosenStart)):"No date selected";};dialog.querySelector("[data-picker-prev]").onclick=()=>{visible=new Date(visible.getFullYear(),visible.getMonth()-1,1);draw();};dialog.querySelector("[data-picker-next]").onclick=()=>{visible=new Date(visible.getFullYear(),visible.getMonth()+1,1);draw();};dialog.querySelector("[data-picker-choose]").onclick=()=>{if(!chosenStart)return alert("Choose a date first.");dialog.close();options.onSelect?.({startDate:chosenStart,endDate:options.allowRange?chosenEnd:chosenStart});};draw();dialog.showModal();return dialog;}

  function bindDayOffSingleRange(){const toggle=$id("dayOffUseRange"),start=$id("dayOffStartDate"),end=$id("dayOffEndDate"),card=$id("dayOffEndDateCard"),arrow=$id("dayOffRangeArrow");if(!toggle||toggle.dataset.bound)return;toggle.dataset.bound="1";const sync=()=>{const ranged=toggle.checked;card?.classList.toggle("hidden",!ranged);arrow?.classList.toggle("hidden",!ranged);if(!ranged&&start&&end)end.value=start.value;};toggle.onchange=sync;start?.addEventListener("change",()=>{if(!toggle.checked&&end)end.value=start.value;});sync();}

  // Override core calendar functions after initial app boot.
  try { renderCalendar = renderOverviewCalendar; renderCalendarAlerts = renderNotificationDock; } catch (_) {}
  try { openDayDetails = openDailyView; } catch (_) {}

  bindDayOffSingleRange();
  renderOverviewCalendar();

  window.TeacherHQCalendar={contrastText,rgba,courseColour,renderOverviewCalendar,renderNotificationDock,openDailyView,openPicker,dailyPrintHTML,notificationItems,reflectionDueItems};
})();
