/* ============================================================
   TEACHER HQ — CALENDAR VIEW PAGE
   ------------------------------------------------------------
   Reads the same local Teacher HQ data as index.html without loading
   app.js. Class identity is classId-first so two Cohorts can take the
   same course without being merged on the calendar.
============================================================ */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let state = null;
  let user = null;
  let visible = new Date();
  let classFilter = "";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]);
  }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function parseDate(key) { const [y, m, d] = String(key).split("-").map(Number); return new Date(y, m - 1, d); }
  function fmtDate(key) { return key ? parseDate(key).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
  function fmtLong(key) { return key ? parseDate(key).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""; }
  function fmtTime(value) { if (!value) return ""; const [h, m] = value.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  function classKey(spec) { return `${[...(spec?.grades || [])].sort().join("|")}::${String(spec?.subject || "").trim().toLowerCase()}`; }
  function classLabel(spec) {
    const grades = spec?.grades || [];
    const gradeLabel = grades.length === 1 ? grades[0] : grades.length ? `Grade ${grades.map(g => g.replace(/^Grade\s+/i, "").replace("Kindergarten", "K")).join("/")}` : "";
    return `${gradeLabel} ${spec?.subject || ""}`.trim();
  }
  function contrast(hex) {
    const value = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(value)) return "#17171a";
    const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
    const cv = x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
    return .2126 * cv(r) + .7152 * cv(g) + .0722 * cv(b) > .48 ? "#17171a" : "#fff";
  }

  function load() {
    const keys = Object.keys(localStorage)
      .filter(key => /^teacherHQData_v\d+$/.test(key))
      .sort((a, b) => Number(b.match(/\d+$/)[0]) - Number(a.match(/\d+$/)[0]));
    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        if (parsed?.users) { state = parsed; break; }
      } catch { /* keep looking */ }
    }
    if (!state) return;
    const active = state.activeUserId || localStorage.getItem("teacherHQActiveUserId");
    user = state.users.find(item => item.id === active) || state.users[0] || null;
  }

  function classes() { return user?.classes || []; }
  function classById(id) { return id ? classes().find(item => item.id === id) || null : null; }
  function classForSpec(spec) {
    const key = classKey(spec);
    const matches = classes().filter(item => classKey({ grades: item.grades, subject: item.subject }) === key);
    return matches.length === 1 ? matches[0] : null;
  }
  function teachingClass(spec, classId = "") { return classById(classId) || classForSpec(spec); }
  function classForBlock(block) { return teachingClass({ grades: block?.grades || [], subject: block?.subject || "" }, block?.classId || ""); }
  function classForUnit(unit) { return teachingClass(unit?.classSpec || {}, unit?.classId || ""); }
  function classMatchesFilter(spec, classId = "") {
    if (!classFilter) return true;
    const resolved = teachingClass(spec, classId);
    return resolved?.id === classFilter;
  }
  function courseColour(spec, classId = "") { return teachingClass(spec, classId)?.colour || "#61B6FF"; }
  function archivedClassMark(teachingClass) { return teachingClass?.archivedAt ? "✓ " : ""; }

  function exceptionFor(key) {
    return (user?.calendarExceptions || []).find(item => key >= (item.startDate || item.date || "") && key <= (item.endDate || item.startDate || item.date || ""));
  }
  function termsFor(key) { return (user?.terms || []).filter(term => key >= term.startDate && key <= term.endDate); }
  function versionFor(term, key) {
    return (term.scheduleVersions || []).filter(version => key >= version.effectiveStart && key <= version.effectiveEnd).sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart)).at(-1);
  }
  function occurrences(key) {
    const exception = exceptionFor(key);
    if (exception && exception.type !== "Sub Day") return [];
    const date = parseDate(key), weekday = WEEKDAYS[date.getDay()], rows = [];
    termsFor(key).forEach(term => {
      const version = versionFor(term, key);
      (version?.scheduleBlocks || []).filter(block => block.weekday === weekday).forEach(block => rows.push({
        term, version, block, dateKey: key,
        planned: block.blockType === "Instructional Time" && (block.plannedDates || []).includes(key)
      }));
    });
    return rows.sort((a, b) => a.block.startTime.localeCompare(b.block.startTime));
  }
  function occurrenceArchived(occ) { return Boolean(occ?.term?.archivedAt || classForBlock(occ?.block)?.archivedAt); }

  function units() { return user?.units || []; }
  function lessonsOn(key) { return units().flatMap(unit => (unit.lessons || []).filter(lesson => lesson.dateKey === key).map(lesson => ({ unit, lesson }))); }
  function tripsOn(key) { return units().flatMap(unit => (unit.workspace?.fieldTrips || []).filter(trip => key >= trip.startDate && key <= trip.endDate).map(trip => ({ unit, trip }))); }
  function assessmentsOn(key) { return units().flatMap(unit => (unit.workspace?.assessments || []).filter(assessment => assessment.status !== "draft" && assessment.date === key).map(assessment => ({ unit, assessment }))); }
  function lessonTitle(lesson) { return lesson.customTitle ? `${lesson.sequence} - ${lesson.customTitle}` : `Lesson ${lesson.sequence}`; }
  function lessonForOccurrence(occ) {
    const key = `${occ.term.id}|${occ.version.id}|${occ.block.id}|${occ.dateKey}`;
    return lessonsOn(occ.dateKey).find(({ lesson }) => `${lesson.termId}|${lesson.versionId}|${lesson.blockId}|${lesson.dateKey}` === key);
  }

  function renderClasses() {
    const select = $("fullCalendarClassFilter");
    select.innerHTML = '<option value="">All Classes</option>';
    classes().slice().sort((a, b) => Boolean(a.archivedAt) - Boolean(b.archivedAt) || String(a.name).localeCompare(String(b.name))).forEach(item => {
      select.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(item.id)}">${item.archivedAt ? "✓ " : ""}${escapeHTML(item.name)}</option>`);
    });
    select.onchange = () => { classFilter = select.value; render(); };
  }

  function render() {
    if (!user) return;
    $("fullCalendarMonth").textContent = visible.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const grid = $("fullCalendarGrid");
    grid.innerHTML = "";
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day, index) => grid.insertAdjacentHTML("beforeend", `<div class="full-calendar-weekday ${index === 0 || index === 6 ? "weekend" : ""}">${day}</div>`));

    const year = visible.getFullYear(), month = visible.getMonth(), first = new Date(year, month, 1).getDay(), days = new Date(year, month + 1, 0).getDate(), today = dateKey(new Date());
    for (let i = 0; i < first; i += 1) grid.insertAdjacentHTML("beforeend", '<div class="full-day blank"></div>');

    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const date = new Date(year, month, day);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `full-day ${[0, 6].includes(date.getDay()) ? "weekend" : ""} ${key < today ? "past" : ""} ${key === today ? "today" : ""}`;
      cell.innerHTML = `<span class="full-day-number">${day}</span><div class="full-day-events"></div>`;
      const inner = cell.querySelector(".full-day-events");
      const off = exceptionFor(key);
      if (off) inner.insertAdjacentHTML("beforeend", `<span class="full-event ${off.type === "Sub Day" ? "sub-day" : "off"}">${off.type === "Sub Day" ? "SUB · " : ""}${escapeHTML(off.label || off.title || off.type)}</span>`);
      (user.dailyRecords?.[key]?.events || []).forEach(item => inner.insertAdjacentHTML("beforeend", `<span class="full-event custom-event">${item.type === "Block" ? "▥" : "•"} ${escapeHTML(item.title)}</span>`));

      occurrences(key).filter(occ => occ.block.blockType === "Instructional Time" && classMatchesFilter({ grades: occ.block.grades, subject: occ.block.subject }, occ.block.classId)).forEach(occ => {
        const linked = lessonForOccurrence(occ);
        const teaching = classForBlock(occ.block);
        const archived = occurrenceArchived(occ);
        if (linked) {
          const linkedClass = classForUnit(linked.unit) || teaching;
          const bg = linkedClass?.colour || courseColour(linked.unit.classSpec, linked.unit.classId);
          const mark = archivedClassMark(linkedClass) || (occ.term.archivedAt ? "✓ " : "");
          inner.insertAdjacentHTML("beforeend", `<span class="full-event lesson ${archived ? "archived" : ""}" style="--event-bg:${bg};--event-fg:${contrast(bg)}">${escapeHTML(`${mark}${lessonTitle(linked.lesson)}`)}</span>`);
        } else if (archived) {
          inner.insertAdjacentHTML("beforeend", `<span class="full-event archived">✓ ${escapeHTML(teaching?.name || classLabel({ grades: occ.block.grades, subject: occ.block.subject }))} · finished</span>`);
        } else {
          inner.insertAdjacentHTML("beforeend", `<span class="full-event unplanned">${escapeHTML(teaching?.name || classLabel({ grades: occ.block.grades, subject: occ.block.subject }))} · needs plan</span>`);
        }
      });

      tripsOn(key).filter(({ unit }) => classMatchesFilter(unit.classSpec, unit.classId)).forEach(({ unit, trip }) => {
        const archived = Boolean(classForUnit(unit)?.archivedAt);
        inner.insertAdjacentHTML("beforeend", `<span class="full-event trip ${archived ? "archived" : ""}">${archived ? "✓ " : ""}🚌 ${escapeHTML(trip.title)}</span>`);
      });
      assessmentsOn(key).filter(({ unit }) => classMatchesFilter(unit.classSpec, unit.classId)).forEach(({ unit, assessment }) => {
        const archived = Boolean(classForUnit(unit)?.archivedAt);
        inner.insertAdjacentHTML("beforeend", `<span class="full-event assessment ${archived ? "archived" : ""}">${archived ? "✓ " : ""}✓ ${escapeHTML(assessment.title)}</span>`);
      });
      cell.onclick = () => openDay(key);
      grid.appendChild(cell);
    }
    renderNotifications();
  }

  function notifications() {
    const items = [], today = dateKey(new Date()), end = new Date();
    end.setDate(end.getDate() + 30);
    let unplanned = 0;
    (user.terms || []).filter(term => !term.archivedAt).forEach(term => {
      const cursorStart = new Date(Math.max(parseDate(term.startDate).getTime(), new Date().setHours(0, 0, 0, 0)));
      for (let date = cursorStart; date <= parseDate(term.endDate) && date <= end; date.setDate(date.getDate() + 1)) {
        occurrences(dateKey(date)).filter(occ => occ.term.id === term.id && occ.block.blockType === "Instructional Time" && !occ.planned && !lessonForOccurrence(occ) && !classForBlock(occ.block)?.archivedAt).forEach(() => { unplanned += 1; });
      }
    });
    if (unplanned) items.push({ type: "danger", title: `${unplanned} instructional block${unplanned === 1 ? "" : "s"} need planning`, detail: "Next 30 days" });

    const pd = (user.calendarExceptions || []).filter(item => item.type === "PD Day" && item.startDate >= today && (!item.location || !item.description));
    if (pd.length) items.push({ type: "info", title: `${pd.length} upcoming PD Day${pd.length === 1 ? "" : "s"} need details`, detail: "Location or description is incomplete" });

    const reflections = units().filter(unit => !classForUnit(unit)?.archivedAt).flatMap(unit => (unit.lessons || []).map(lesson => ({ unit, lesson, plan: unit.workspace?.lessonPlans?.[lesson.id] }))).filter(item => item.lesson.dateKey < today && item.plan && !item.plan.reflection?.completed);
    if (reflections.length) items.push({ type: "warning", title: `${reflections.length} lesson reflection${reflections.length === 1 ? "" : "s"} unfinished`, detail: "Past lessons with reflection still open" });

    (user.interestReminders || []).filter(item => !item.completedAt && item.dueDate && item.dueDate <= today).forEach(item => {
      const cohort = (user.cohorts || []).find(entry => entry.id === item.cohortId);
      if (!cohort || cohort.archivedAt) return;
      const codes = (item.studentIds || []).map(id => cohort.students?.find(student => student.id === id)?.code).filter(Boolean);
      items.push({ type: "interest", title: item.note || "Gather student interests", detail: `${cohort.name}${codes.length ? ` · Students ${codes.join(", ")}` : ""}` });
    });
    return items;
  }

  function renderNotifications() {
    const list = $("fullCalendarNotifications"), items = notifications();
    list.innerHTML = items.length
      ? items.map(item => `<article class="full-notification ${item.type}"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.detail)}</small></article>`).join("")
      : '<div class="empty-state-card compact">Nothing urgent right now.</div>';
  }

  function dayAlerts(key) {
    const alerts = [];
    const off = exceptionFor(key);
    if (off) alerts.push(`${off.type}: ${off.label || off.title || "Day off"}`);
    const need = occurrences(key).filter(occ => occ.block.blockType === "Instructional Time" && !occ.planned && !lessonForOccurrence(occ) && !occurrenceArchived(occ) && classMatchesFilter({ grades: occ.block.grades, subject: occ.block.subject }, occ.block.classId)).length;
    if (need) alerts.push(`${need} instructional block${need === 1 ? "" : "s"} need planning.`);
    return { alerts, weekly: notifications().map(item => item.title) };
  }

  function dailyHTML(key, print = false) {
    const off = exceptionFor(key), rows = [];
    occurrences(key).filter(occ => occ.block.blockType !== "Instructional Time" || classMatchesFilter({ grades: occ.block.grades, subject: occ.block.subject }, occ.block.classId)).forEach(occ => {
      const linked = lessonForOccurrence(occ), spec = { grades: occ.block.grades, subject: occ.block.subject };
      if (occ.block.blockType === "Instructional Time") {
        const teaching = classForBlock(occ.block), archived = occurrenceArchived(occ), colour = teaching?.colour || courseColour(spec, occ.block.classId);
        const title = linked ? lessonTitle(linked.lesson) : teaching?.name || classLabel(spec);
        const markedTitle = archived ? `✓ ${title}` : title;
        const detail = linked ? linked.unit.name : archived ? "Finished / archived" : "Instructional Time · needs planning";
        rows.push({ time: occ.block.startTime, html: `<article class="daily-event ${archived ? "archived" : ""}" style="--event-colour:${colour}"><time>${escapeHTML(fmtTime(occ.block.startTime))}</time><div><strong>${escapeHTML(markedTitle)}</strong><span>${escapeHTML(detail)}</span></div></article>` });
      } else {
        rows.push({ time: occ.block.startTime, html: `<article class="daily-event noninstructional"><time>${escapeHTML(fmtTime(occ.block.startTime))}</time><div><strong>${escapeHTML(occ.block.label || occ.block.blockType)}</strong><span>${escapeHTML(occ.block.blockType)}</span></div></article>` });
      }
    });

    tripsOn(key).filter(({ unit }) => classMatchesFilter(unit.classSpec, unit.classId)).forEach(({ unit, trip }) => {
      const archived = Boolean(classForUnit(unit)?.archivedAt);
      rows.push({ time: "12:00", html: `<article class="daily-event ${archived ? "archived" : ""}" style="--event-colour:#ff9f43"><time>🚌</time><div><strong>${archived ? "✓ " : ""}Field Trip — ${escapeHTML(trip.title)}</strong><span>${escapeHTML(unit.name)}${trip.location ? ` · ${escapeHTML(trip.location)}` : ""}</span></div></article>` });
    });
    assessmentsOn(key).filter(({ unit }) => classMatchesFilter(unit.classSpec, unit.classId)).forEach(({ unit, assessment }) => {
      const archived = Boolean(classForUnit(unit)?.archivedAt);
      rows.push({ time: "23:30", html: `<article class="daily-event ${archived ? "archived" : ""}" style="--event-colour:#7a68df"><time>✓</time><div><strong>${archived ? "✓ " : ""}${escapeHTML(assessment.title)}</strong><span>${escapeHTML(assessment.type || "Assessment")} · ${escapeHTML(unit.name)}</span></div></article>` });
    });
    rows.sort((a, b) => a.time.localeCompare(b.time));

    (user.dailyRecords?.[key]?.events || []).forEach(item => rows.push({ time: item.startTime || "12:00", html: `<article class="daily-event custom-daily-event"><time>${escapeHTML(item.startTime ? fmtTime(item.startTime) : item.type === "Block" ? "▥" : "•")}</time><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.type || "Event")}${item.notes ? ` · ${escapeHTML(item.notes)}` : ""}</span></div></article>` }));
    rows.sort((a, b) => a.time.localeCompare(b.time));

    let html = off ? `<div class="daily-day-off ${off.type === "Sub Day" ? "daily-sub-day" : ""}"><strong>${off.type === "Sub Day" ? "SUB · " : ""}${escapeHTML(off.label || off.title || off.type)}</strong><span>${escapeHTML(off.type)}${off.description ? ` · ${escapeHTML(off.description)}` : ""}</span></div>` : "";
    html += `<div class="daily-timeline">${rows.length ? rows.map(row => row.html).join("") : '<div class="empty-state-card">Nothing is scheduled for this date.</div>'}</div>`;
    if (print) {
      const reflection = user.dailyRecords?.[key]?.reflection || "";
      html += `<section class="print-daily-reflection"><h3>Daily Reflection</h3><div style="min-height:180px;border:1px solid #aaa;border-radius:10px;padding:12px">${reflection ? escapeHTML(reflection).replaceAll("\n", "<br>") : ""}</div></section>`;
    }
    return html;
  }

  function saveState() {
    const keys = Object.keys(localStorage).filter(key => /^teacherHQData_v\d+$/.test(key)).sort((a, b) => Number(b.match(/\d+$/)[0]) - Number(a.match(/\d+$/)[0]));
    if (keys[0]) localStorage.setItem(keys[0], JSON.stringify(state));
  }

  function openDay(key) {
    user.dailyRecords ||= {};
    user.dailyRecords[key] ||= { reflection: "", updatedAt: "" };
    const dialog = $("fullDailyDialog"), alerts = dayAlerts(key);
    $("fullDailyTitle").textContent = fmtLong(key);
    $("fullDailyMeta").textContent = "Daily timetable · instructional and non-instructional events";
    $("fullDailyAlerts").innerHTML = `${alerts.alerts.length ? `<div class="daily-alert-block"><strong>For this day</strong>${alerts.alerts.map(alert => `<span>• ${escapeHTML(alert)}</span>`).join("")}</div>` : ""}${alerts.weekly.length ? `<div class="daily-alert-block"><strong>This week / general</strong>${alerts.weekly.map(alert => `<span>• ${escapeHTML(alert)}</span>`).join("")}</div>` : ""}`;
    $("fullDailyContent").innerHTML = dailyHTML(key);
    const text = $("fullDailyReflection");
    text.value = user.dailyRecords[key].reflection || "";
    let timer;
    text.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        user.dailyRecords[key].reflection = text.value;
        user.dailyRecords[key].updatedAt = new Date().toISOString();
        saveState();
        $("fullDailySaved").textContent = "Saved";
      }, 250);
    };
    $("fullDailyPrintView").onclick = () => printDay(key, false);
    $("fullDailyDownload").onclick = () => printDay(key, true);
    dialog.showModal();
  }

  function printDay(key, download) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Teacher HQ — ${escapeHTML(fmtLong(key))}</title><style>@page{size:letter;margin:.55in}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17171a;font-size:12px}h1{margin-bottom:3px}.meta{color:#666;margin-bottom:18px}.daily-event{display:grid;grid-template-columns:90px 1fr;gap:10px;padding:8px;border-left:4px solid var(--event-colour,#777);margin:5px 0;background:#f8f8fa}.daily-event.noninstructional{font-size:10px;border-left-width:2px}.daily-event.archived{opacity:.68}.daily-event time{color:#666}.daily-event strong,.daily-event span{display:block}.daily-event span{color:#666}.daily-day-off{background:#eef6ff;padding:10px;border-radius:8px}.print-daily-reflection{margin-top:25px}.controls{margin-bottom:15px}@media print{.controls{display:none}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save PDF</button></div><h1>${escapeHTML(fmtLong(key))}</h1><div class="meta">${escapeHTML(user.username)} · Teacher HQ Daily Timetable</div>${dailyHTML(key, true)}</body></html>`;
    if (download) {
      const blob = new Blob([html], { type: "text/html" }), url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `TeacherHQ_Daily_${key}.html`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      const win = window.open("", "_blank");
      if (!win) return alert("Allow pop-ups to open the print-friendly version.");
      win.document.write(html); win.document.close();
    }
  }

  function init() {
    load();
    if (!user) { $("fullCalendarNoUser").classList.remove("hidden"); return; }
    $("fullCalendarWorkspace").classList.remove("hidden");
    $("fullCalendarTitle").textContent = `${user.username}'s Calendar`;
    const activeTerms = (user.terms || []).filter(term => !term.archivedAt).length;
    const finishedTerms = (user.terms || []).filter(term => term.archivedAt).length;
    $("fullCalendarMeta").textContent = (user.terms || []).length ? `${activeTerms} active School Term${activeTerms === 1 ? "" : "s"}${finishedTerms ? ` · ${finishedTerms} finished` : ""}` : "No School Terms yet";
    renderClasses();
    const now = new Date(); visible = new Date(now.getFullYear(), now.getMonth(), 1);
    $("fullCalendarPrev").onclick = () => { visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1); render(); };
    $("fullCalendarNext").onclick = () => { visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1); render(); };
    $("fullCalendarToday").onclick = () => { const date = new Date(); visible = new Date(date.getFullYear(), date.getMonth(), 1); render(); };
    $("fullDailyClose").onclick = () => $("fullDailyDialog").close();
    render();
  }

  init();
})();
