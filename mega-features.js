/* ============================================================
   TEACHER HQ — MEGA RELEASE ORCHESTRATOR
   ------------------------------------------------------------
   This file contains cross-cutting features that intentionally sit above
   the core app modules. It is loaded LAST so it can safely extend the
   Unit Workspace, Lesson Planner, profile selector, Trash, and calendar
   infrastructure without forcing those systems back into one giant file.

   Major responsibilities:
   - Unit-level Literacy/Numeracy/Career/Competency progression planning
   - Stand-alone Lesson creation and later attachment to a Unit
   - Schedule-aware Field Trip lesson shifting
   - Soft-delete controls for Units and users
   - Saved Context management
   - Standardized print-friendly download controls
   - Final dashboard wiring and small production safeguards
============================================================ */
(function () {
  "use strict";

  const $id = id => document.getElementById(id);
  const clone = value => typeof structuredCloneSafe === "function" ? structuredCloneSafe(value) : JSON.parse(JSON.stringify(value));
  const registry = () => window.TeacherHQRegistry;

  /* ==========================================================
     SHARED HELPERS
  ========================================================== */
  function allGrades() {
    return ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
  }

  function progressionFrameworks() {
    return ["Literacy","Numeracy","Career","Competency"];
  }

  function lessonTitle(unit, lesson) {
    return typeof lessonDisplayTitleForUnit === "function"
      ? lessonDisplayTitleForUnit(unit, lesson)
      : (lesson.customTitle ? `${lesson.sequence} - ${lesson.customTitle}` : `Lesson ${lesson.sequence}`);
  }

  function unitIsStandalone(unit) {
    return Boolean(unit?.isStandaloneContainer);
  }

  function normalUnits(user = getActiveUser()) {
    return (user?.units || []).filter(unit => !unitIsStandalone(unit));
  }

  function standaloneUnits(user = getActiveUser()) {
    return (user?.units || []).filter(unitIsStandalone);
  }

  function ensureUnitProgressions(unit) {
    unit.workspace ||= {};
    unit.workspace.progressionSelections ||= {};
    progressionFrameworks().forEach(framework => {
      if (!Array.isArray(unit.workspace.progressionSelections[framework])) unit.workspace.progressionSelections[framework] = [];
    });
    return unit.workspace.progressionSelections;
  }

  function progressionDefaultGrade(unit) {
    return unit?.classSpec?.grades?.[0] || "Grade 4";
  }

  function saveUnit(unit) {
    unit.updatedAt = new Date().toISOString();
    if (typeof autosaveUnit === "function") autosaveUnit(unit);
    else saveData();
  }

  /* ==========================================================
     SCHEDULE-AWARE FIELD TRIP SHIFTING
     ----------------------------------------------------------
     Reuses the ORIGINAL Lesson objects and IDs so Lesson Planner content
     remains attached after a trip changes the teaching sequence.
  ========================================================== */
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
          const key2 = occurrenceKey(occurrence);
          if (seen.has(key2)) return;
          seen.add(key2);
          if (isOccurrenceAllocated(user, occurrence, unit.id)) return;
          result.push(occurrence);
        });
    }
    return result.sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||a.block.startTime.localeCompare(b.block.startTime));
  }

  function shiftLessonsAfterFieldTrip(unit, trip) {
    const user = getActiveUser();
    if (!user || !unit || !trip) return false;
    const ordered = [...(unit.lessons || [])].sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||a.startTime.localeCompare(b.startTime));
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

    unit.lessons = ordered.sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||a.startTime.localeCompare(b.startTime));
    unit.lessons.forEach((lesson,index)=>{ lesson.sequence=index+1; lesson.title=`Lesson ${index+1}`; });
    unit.needsScheduleReview = moved < moving.length || (typeof unitScheduledMinutes === "function" && unitScheduledMinutes(unit) < unit.targetMinutes);
    saveUnit(unit);
    if (moved < moving.length) {
      alert(`${moving.length - moved} lesson${moving.length - moved === 1 ? "" : "s"} could not be shifted because no later instructional blocks were available. Teacher HQ has flagged the Unit for schedule review.`);
    }
    return moved === moving.length;
  }

  window.TeacherHQPlanning = { shiftLessonsAfterFieldTrip };

  /* ==========================================================
     UNIT PROGRESSION WORKSPACE
  ========================================================== */
  function renderUnitProgressions(unit, container) {
    const selections = ensureUnitProgressions(unit);
    const grade = progressionDefaultGrade(unit);
    const intro=document.createElement("div"); intro.className="progression-workspace-intro";
    intro.innerHTML=`<div><span class="planning-framework-badge">Progression</span><h4>Literacy, Numeracy, Career & Competency Progressions</h4><p>These frameworks support subject planning. They do not replace or inflate the official subject curriculum.</p></div>`;
    container.appendChild(intro);

    if (!registry()?.progressions?.length) {
      container.insertAdjacentHTML("beforeend",'<div class="empty-state-card">Progression data is not loaded.</div>');
      return;
    }

    progressionFrameworks().forEach(framework => {
      const selected=new Map((selections[framework]||[]).map(item=>[item.id,item]));
      const divisions=window.TeacherHQCurriculumUI?.progressionDivisions?.(framework)||[];
      const defaults=registry().progressions.filter(record=>record.framework===framework && (record.gradeTags||[]).includes(grade));
      let division=defaults[0]?.division||divisions[0]||"";
      const card=document.createElement("article"); card.className="unit-progression-card";
      card.innerHTML=`<header><div><span class="planning-framework-badge">Progression</span><h4>${escapeHTML(framework)}</h4><small>Default for ${escapeHTML(grade)}</small></div><strong data-count>${selected.size} selected</strong></header><div data-division class="division-nav"></div><div data-tree class="unit-progression-tree"></div>`;
      const nav=card.querySelector("[data-division]"), tree=card.querySelector("[data-tree]");

      const draw=()=>{
        const defaultDivision=defaults[0]?.division||division;
        const idx=divisions.indexOf(division);
        nav.innerHTML=`<button type="button" data-prev ${idx<=0?"disabled":""}>←</button><div><small>Viewing</small><strong>${escapeHTML(division||"No division")}</strong>${division!==defaultDivision?'<em>Manual division override</em>':''}</div><button type="button" data-next ${idx<0||idx>=divisions.length-1?"disabled":""}>→</button>`;
        nav.querySelector("[data-prev]").onclick=()=>{division=divisions[idx-1];draw();};
        nav.querySelector("[data-next]").onclick=()=>{division=divisions[idx+1];draw();};
        const records=registry().progressions.filter(record=>record.framework===framework && record.division===division);
        tree.innerHTML="";
        if(!records.length){tree.innerHTML='<div class="empty-state-card compact">No descriptors are available for this division.</div>';return;}
        const grouped=new Map(); records.forEach(record=>{const key=record.heading||framework;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(record);});
        grouped.forEach((items,heading)=>{
          const details=document.createElement("details"); details.className="progression-heading";
          details.innerHTML=`<summary><strong>${escapeHTML(heading)}</strong><span>${items.filter(item=>selected.has(item.id)).length ? `${items.filter(item=>selected.has(item.id)).length} selected` : ""}</span></summary><div></div>`;
          const body=details.querySelector("div");
          items.forEach(record=>{
            const current=selected.get(record.id);
            const row=document.createElement("div"); row.className=`progression-selection-row ${current?"selected":""}`;
            row.innerHTML=`<label><input type="checkbox" ${current?"checked":""} ${readOnlyMode?"disabled":""}/><div><small>${escapeHTML(record.row||record.type||"Descriptor")}</small><p>${escapeHTML(record.text)}</p></div></label><select ${current?"":"disabled"} ${readOnlyMode?"disabled":""}><option ${current?.intent==="Develop"?"selected":""}>Develop</option><option ${current?.intent==="Practise"?"selected":""}>Practise</option><option ${current?.intent==="Observe"?"selected":""}>Observe</option></select>`;
            const checkbox=row.querySelector("input"), intent=row.querySelector("select");
            checkbox.onchange=()=>{if(checkbox.checked)selected.set(record.id,{id:record.id,intent:"Develop"});else selected.delete(record.id);selections[framework]=[...selected.values()];saveUnit(unit);draw();};
            intent.onchange=()=>{if(selected.has(record.id))selected.get(record.id).intent=intent.value;selections[framework]=[...selected.values()];saveUnit(unit);};
            body.appendChild(row);
          });
          tree.appendChild(details);
        });
        card.querySelector("[data-count]").textContent=`${selected.size} selected`;
      };
      draw(); container.appendChild(card);
    });
  }

  /* Load last: extend the Unit Workspace without replacing its existing tabs. */
  try {
    const basePanel=renderUnitWorkspacePanel;
    renderUnitWorkspacePanel=function(unit,section){
      if(section==="progressions"){
        const heading=$id("unitWorkspacePanelHeading"), content=$id("unitWorkspacePanelContent");
        heading.textContent="Literacy, Numeracy, Career & Competency Progressions"; content.innerHTML=""; renderUnitProgressions(unit,content); return;
      }
      const result=basePanel.apply(this,arguments);
      if(section==="assessments") enhanceAssessmentPrintControls(unit);
      if(section==="fieldTrips") enhanceFieldTripVisuals();
      return result;
    };
  } catch (error) { console.warn("Teacher HQ: could not extend Unit Workspace panel",error); }

  /* ==========================================================
     STAND-ALONE LESSON HUB
  ========================================================== */
  function standaloneLessonFromUnit(unit) { return unit?.lessons?.[0] || null; }

  function createLessonHubDialog(){
    let dialog=$id("lessonPlannerHubDialog"); if(dialog)return dialog;
    dialog=document.createElement("dialog"); dialog.id="lessonPlannerHubDialog"; dialog.className="modal extra-large-modal lesson-hub-dialog";
    dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><p class="small-label">Teacher HQ</p><h2>Lesson Planner</h2><p class="section-subtitle">Open an existing Unit lesson or create a stand-alone lesson that can be attached to a Unit later.</p></div><button type="button" class="close-button" data-close>×</button></div><div class="lesson-hub-actions"><button type="button" class="primary-button" data-new>+ New Stand-Alone Lesson</button><button type="button" class="secondary-button" data-contexts>Saved Contexts</button></div><div data-list></div></div>`;
    document.body.appendChild(dialog); dialog.querySelector("[data-close]").onclick=()=>dialog.close(); dialog.querySelector("[data-new]").onclick=()=>openStandaloneEditor(dialog); dialog.querySelector("[data-contexts]").onclick=()=>openContextLibrary(); dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();}); return dialog;
  }

  function renderLessonHub(dialog){
    const user=getActiveUser(), list=dialog.querySelector("[data-list]"); list.innerHTML="";
    if(!user)return;
    const normal=normalUnits(user).flatMap(unit=>(unit.lessons||[]).map(lesson=>({unit,lesson,standalone:false})));
    const standalone=standaloneUnits(user).map(unit=>({unit,lesson:standaloneLessonFromUnit(unit),standalone:true})).filter(item=>item.lesson);
    const all=[...normal,...standalone].sort((a,b)=>(a.lesson.dateKey||"").localeCompare(b.lesson.dateKey||"")||(a.lesson.startTime||"").localeCompare(b.lesson.startTime||""));
    if(!all.length){list.innerHTML='<div class="empty-state-card"><strong>No lessons yet.</strong><p>Create a Unit lesson or start with a stand-alone lesson.</p></div>';return;}
    const table=document.createElement("div");table.className="lesson-hub-list";
    all.forEach(({unit,lesson,standalone})=>{
      const row=document.createElement("article");row.className="lesson-hub-row";row.style.setProperty("--unit-colour",unit.colour||"#61B6FF");
      row.innerHTML=`<button type="button" data-open><span>${escapeHTML(formatDate(lesson.dateKey))}</span><div><strong>${escapeHTML(lessonTitle(unit,lesson))}</strong><small>${standalone?"Stand-Alone Lesson":escapeHTML(unit.name)} · ${escapeHTML(classLabel(unit.classSpec))} · ${escapeHTML(formatTime(lesson.startTime))}</small></div></button>${standalone&&!readOnlyMode?'<button type="button" class="secondary-button" data-attach>Attach to Unit…</button>':""}`;
      row.querySelector("[data-open]").onclick=()=>{dialog.close();window.TeacherHQLessonPlanner?.open(unit.id,lesson.id);};
      row.querySelector("[data-attach]")?.addEventListener("click",()=>attachStandalonePrompt(unit,dialog));
      table.appendChild(row);
    });
    list.appendChild(table);
  }

  function openLessonHub(){ if(readOnlyMode)return; const dialog=createLessonHubDialog();renderLessonHub(dialog);dialog.showModal(); }

  function openStandaloneEditor(parentDialog){
    const user=getActiveUser(); if(!user)return;
    const classes=user.classes||[];
    const dialog=document.createElement("dialog");dialog.className="modal large-modal";
    dialog.innerHTML=`<form class="modal-content"><div class="modal-heading"><div><h2>New Stand-Alone Lesson</h2><p class="section-subtitle">A stand-alone lesson can use any loaded curriculum and can be attached to a Unit later.</p></div><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Class <small>(optional)</small></span><select data-class><option value="">Manual grade / subject</option>${classes.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join("")}</select></label><div class="form-grid two-column-grid"><label class="form-field"><span>Grade</span><select data-grade>${allGrades().map(g=>`<option>${g}</option>`).join("")}</select></label><label class="form-field"><span>Subject</span><input data-subject list="standaloneSubjectList" placeholder="Math" required/><datalist id="standaloneSubjectList">${[...(user.customSubjects||[]),...(registry()?.subjectsForGrade("Grade 4")||[])].map(s=>`<option value="${escapeHTML(s)}"></option>`).join("")}</datalist></label></div><button type="button" class="calendar-selection-button" data-date><span>▦</span><div><strong>Choose Lesson Date</strong><small data-date-label>No date selected</small></div></button><input type="hidden" data-date-value/><div class="form-grid two-column-grid"><label class="form-field"><span>Start Time</span><input data-start type="time" value="08:00" required/></label><label class="form-field"><span>End Time</span><input data-end type="time" value="09:00" required/></label></div><label class="form-field"><span>Lesson Title <small>(optional)</small></span><input data-title placeholder="Lesson title"/></label><div class="modal-actions"><button type="button" class="secondary-button" data-cancel>Cancel</button><button class="primary-button" type="submit">Create Lesson</button></div></form>`;
    document.body.appendChild(dialog);const form=dialog.querySelector("form"),classSelect=form.querySelector("[data-class]"),grade=form.querySelector("[data-grade]"),subject=form.querySelector("[data-subject]");
    const syncClass=()=>{const item=classes.find(c=>c.id===classSelect.value);if(item){grade.value=item.grades?.[0]||"Grade 4";subject.value=item.subject||"";}};classSelect.onchange=syncClass;
    form.querySelector("[data-date]").onclick=()=>window.TeacherHQCalendar?.openPicker({title:"Choose Stand-Alone Lesson Date",subtitle:"Choose any date inside a School Term. Existing class lessons remain visible.",user,classSpec:classes.find(c=>c.id===classSelect.value)?{grades:classes.find(c=>c.id===classSelect.value).grades,subject:classes.find(c=>c.id===classSelect.value).subject}:{grades:[grade.value],subject:subject.value},allowRange:false,isDateAllowed:key=>termsForDate(key,user).length>0,onSelect:({startDate})=>{form.querySelector("[data-date-value]").value=startDate;form.querySelector("[data-date-label]").textContent=formatLongDate(startDate);const spec=classes.find(c=>c.id===classSelect.value)?{grades:classes.find(c=>c.id===classSelect.value).grades,subject:classes.find(c=>c.id===classSelect.value).subject}:{grades:[grade.value],subject:subject.value};const occurrences=getOccurrencesForDate(parseLocalDate(startDate),user).filter(item=>classMatches(item.block,spec));if(occurrences[0]){form.querySelector("[data-start]").value=occurrences[0].block.startTime;form.querySelector("[data-end]").value=occurrences[0].block.endTime;}}});
    const close=()=>{dialog.close();dialog.remove();};form.querySelector("[data-close]").onclick=close;form.querySelector("[data-cancel]").onclick=close;dialog.addEventListener("cancel",e=>{e.preventDefault();close();});
    form.onsubmit=e=>{e.preventDefault();const dateKey=form.querySelector("[data-date-value]").value,start=form.querySelector("[data-start]").value,end=form.querySelector("[data-end]").value;if(!dateKey||!subject.value.trim()||!start||!end)return alert("Choose a date, subject, start time, and end time.");const item=classes.find(c=>c.id===classSelect.value);const classSpec=item?{grades:clone(item.grades),subject:item.subject}:{grades:[grade.value],subject:subject.value.trim()};const minutes=durationMinutes(start,end);if(minutes<=0)return alert("End time must be after start time.");const lesson=normalizeLesson({id:makeId("lesson"),sequence:1,title:"Lesson 1",customTitle:form.querySelector("[data-title]").value.trim(),dateKey,startTime:start,endTime:end,durationMinutes:minutes,classSpec,lessonPlanStatus:"placeholder",locked:true,createdAt:new Date().toISOString()});const unit=normalizeUnit({id:makeId("standalone"),name:"Stand-Alone Lesson",isStandaloneContainer:true,standaloneMeta:{browseGrade:classSpec.grades[0]||"Grade 4",browseSubject:classSpec.subject},classId:item?.id||"",classSpec,colour:item?.colour||"#61B6FF",targetMinutes:minutes,startDate:dateKey,lessons:[lesson],curriculumLinks:{working:[],prerequisite:[],lookingAhead:[],crossCurricular:[]},workspace:{}});user.units.push(unit);saveData();close();parentDialog.close();window.TeacherHQLessonPlanner?.open(unit.id,lesson.id);};
    dialog.showModal();
  }

  function attachStandalonePrompt(standaloneUnit,parentDialog){
    const user=getActiveUser(), lesson=standaloneLessonFromUnit(standaloneUnit); if(!user||!lesson)return;
    const units=normalUnits(user).filter(unit=>classKey(unit.classSpec)===classKey(standaloneUnit.classSpec));
    if(!units.length)return alert("Create a Unit for this grade/subject first, then attach the stand-alone lesson.");
    const dialog=document.createElement("dialog");dialog.className="modal";dialog.innerHTML=`<form class="modal-content"><div class="modal-heading"><h2>Attach Lesson to Unit</h2><button type="button" class="close-button" data-close>×</button></div><label class="form-field"><span>Unit</span><select data-unit>${units.map(unit=>`<option value="${escapeHTML(unit.id)}">${escapeHTML(unit.name)}</option>`).join("")}</select></label><p class="section-subtitle">The Lesson keeps its current date, title, planning content, and selected curriculum. Selected subject curriculum can be added to the Unit's Working Curriculum.</p><label class="checkbox-row"><input type="checkbox" data-merge checked/><span>Add selected curriculum to Unit Working Curriculum</span></label><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">Attach Lesson</button></div></form>`;document.body.appendChild(dialog);dialog.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{dialog.close();dialog.remove();});dialog.querySelector("form").onsubmit=e=>{e.preventDefault();const target=getUnitById(dialog.querySelector("[data-unit]").value,user);if(!target)return;const plan=standaloneUnit.workspace?.lessonPlans?.[lesson.id];target.lessons.push(clone(lesson));target.lessons.sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||a.startTime.localeCompare(b.startTime));target.lessons.forEach((item,index)=>{item.sequence=index+1;item.title=`Lesson ${index+1}`;});target.workspace ||= {};target.workspace.lessonPlans ||= {};if(plan)target.workspace.lessonPlans[lesson.id]=clone(plan);if(dialog.querySelector("[data-merge]").checked){const byId=new Map((target.curriculumLinks?.working||[]).map(record=>[record.id,record]));(standaloneUnit.curriculumLinks?.working||[]).forEach(record=>byId.set(record.id,clone(record)));target.curriculumLinks ||= {working:[],prerequisite:[],lookingAhead:[],crossCurricular:[]};target.curriculumLinks.working=[...byId.values()];target.selectedCurriculum=target.curriculumLinks.working.map(clone);}user.units=user.units.filter(unit=>unit.id!==standaloneUnit.id);saveUnit(target);dialog.close();dialog.remove();parentDialog.close();window.TeacherHQLessonPlanner?.open(target.id,lesson.id);};dialog.showModal();
  }

  $id("openLessonPlannerHubButton")?.addEventListener("click",openLessonHub);

  /* ==========================================================
     SAVED CONTEXT LIBRARY
  ========================================================== */
  function openContextLibrary(){
    const user=getActiveUser();if(!user)return;user.savedContexts ||= [];
    const dialog=document.createElement("dialog");dialog.className="modal large-modal";
    const draw=()=>{dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><h2>Saved Contexts</h2><p class="section-subtitle">Reusable classroom descriptions available inside the Lesson Planner.</p></div><button class="close-button" type="button" data-close>×</button></div><div class="saved-context-list">${user.savedContexts.length?user.savedContexts.map(item=>`<article><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description||"")}</p></div><button type="button" class="danger-text-button" data-delete="${escapeHTML(item.id)}">Delete</button></article>`).join(""):'<div class="empty-state-card">No saved contexts yet.</div>'}</div></div>`;dialog.querySelector("[data-close]").onclick=()=>{dialog.close();dialog.remove();};dialog.querySelectorAll("[data-delete]").forEach(button=>button.onclick=()=>{const item=user.savedContexts.find(row=>row.id===button.dataset.delete);if(!item||!confirm(`Move “${item.title}” to Trash?`))return;window.TeacherHQTrash?.softDelete("context",item,{parent:"user.savedContexts"});user.savedContexts=user.savedContexts.filter(row=>row.id!==item.id);saveData();draw();});};draw();document.body.appendChild(dialog);dialog.showModal();
  }

  /* ==========================================================
     UNIT SOFT DELETION
  ========================================================== */
  function enhanceUnitDeleteButton(){
    const actions=document.querySelector(".unit-workspace-meta-actions");if(!actions||actions.querySelector("[data-delete-unit]"))return;
    const button=document.createElement("button");button.type="button";button.className="danger-outline-button edit-only";button.dataset.deleteUnit="";button.textContent="Delete Unit";
    button.onclick=()=>{const user=getActiveUser(),unit=getUnitById(activeUnitWorkspaceId,user);if(!unit)return;if(!confirm(`Move “${unit.name}” and its contained lesson/assessment data to Trash?`))return;window.TeacherHQTrash?.softDelete("unit",unit,{parent:"user.units"});user.units=user.units.filter(item=>item.id!==unit.id);saveData();document.getElementById("unitDetailDialog")?.close();activeUnitWorkspaceId=null;renderTeacherHQ();};actions.appendChild(button);
  }

  try { const base=renderUnitWorkspace; renderUnitWorkspace=function(){const result=base.apply(this,arguments);enhanceUnitDeleteButton();return result;}; } catch(_) {}
  enhanceUnitDeleteButton();

  /* ==========================================================
     USER SOFT DELETE + GLOBAL USER TRASH
  ========================================================== */
  function openDeletedUsers(){
    const entries=window.TeacherHQTrash?.ensureGlobalTrash?.()||[];
    const dialog=document.createElement("dialog");dialog.className="modal large-modal";
    const draw=()=>{dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><h2>Deleted Users</h2><p class="section-subtitle">Deleted user workspaces remain recoverable for six months unless permanently removed.</p></div><button type="button" class="close-button" data-close>×</button></div><div class="trash-list">${entries.length?entries.map(entry=>`<article class="trash-row"><div class="trash-icon">◉</div><div><strong>${escapeHTML(entry.label)}</strong><span>Deleted user workspace</span></div><div class="trash-actions"><button class="secondary-button" data-restore="${escapeHTML(entry.id)}">Restore</button><button class="danger-text-button" data-delete="${escapeHTML(entry.id)}">Delete Permanently</button></div></article>`).join(""):'<div class="empty-state-card">No deleted users.</div>'}</div></div>`;dialog.querySelector("[data-close]").onclick=()=>{dialog.close();dialog.remove();};dialog.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>{window.TeacherHQTrash.restore(b.dataset.restore,{global:true});location.reload();});dialog.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(confirm("Permanently delete this user workspace? This cannot be undone.")){window.TeacherHQTrash.permanentDelete(b.dataset.delete,{global:true});draw();}});};draw();document.body.appendChild(dialog);dialog.showModal();
  }

  function enhanceProfileSelection(){
    const list=$id("profileList");if(!list)return;
    [...list.querySelectorAll(":scope > .profile-card")].forEach((card,index)=>{
      const user=appData.users[index];if(!user||card.parentElement?.classList.contains("profile-card-wrap"))return;
      const wrap=document.createElement("div");wrap.className="profile-card-wrap";card.replaceWith(wrap);wrap.appendChild(card);
      const del=document.createElement("button");del.type="button";del.className="profile-delete-button";del.title="Delete user";del.textContent="×";del.onclick=e=>{e.stopPropagation();window.TeacherHQTrash?.deleteUser(user.id);};wrap.appendChild(del);
    });
    const actions=document.querySelector("#userSelectionView .stacked-actions");
    if(actions&&!actions.querySelector("[data-deleted-users]")&&(window.TeacherHQTrash?.ensureGlobalTrash?.().length||0)){
      const button=document.createElement("button");button.type="button";button.className="secondary-button";button.dataset.deletedUsers="";button.textContent="Deleted Users";button.onclick=openDeletedUsers;actions.appendChild(button);
    }
  }
  try {const base=renderProfileSelection;renderProfileSelection=function(){const result=base.apply(this,arguments);enhanceProfileSelection();return result;};}catch(_){}
  enhanceProfileSelection();

  /* ==========================================================
     STANDARDIZED RUBRIC PRINT-FRIENDLY DOWNLOAD
  ========================================================== */
  function rubricHTML(unit,assessment){
    if(assessment.rubric?.type==="onePoint")return buildOnePointRubricPrintHTML(unit,assessment);
    if(assessment.rubric?.type==="threePoint")return buildThreePointRubricPrintHTML(unit,assessment);
    if(assessment.rubric?.type==="fourPoint")return buildFourPointRubricPrintHTML(unit,assessment);
    return "";
  }
  function downloadRubric(unit,assessment){
    const problem=validateRubricForPrint(unit,assessment);if(problem)return alert(problem);const html=rubricHTML(unit,assessment);if(!html)return;const blob=new Blob([html],{type:"text/html"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`TeacherHQ_${String(assessment.title||"Rubric").replace(/[^a-z0-9_-]+/gi,"_")}_Rubric.html`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function enhanceAssessmentPrintControls(unit){
    document.querySelectorAll(".rubric-print-actions").forEach(group=>{
      const view=group.querySelector("[data-rubric-print]");if(view)view.textContent="View Print-Friendly Version";
      if(!group.querySelector("[data-rubric-download]")&&view){const button=document.createElement("button");button.type="button";button.className="secondary-button";button.dataset.rubricDownload="";button.textContent="Download Print-Friendly Version";button.onclick=()=>{const id=workspaceAssessmentEditorId;const assessment=(unit.workspace?.assessments||[]).find(item=>item.id===id);if(assessment)downloadRubric(unit,assessment);};group.appendChild(button);}
    });
  }

  /* ==========================================================
     FIELD TRIP VISUAL POLISH
  ========================================================== */
  function enhanceFieldTripVisuals(){
    document.querySelectorAll(".field-trip-card .field-trip-icon").forEach(icon=>icon.textContent="🚌");
  }

  /* ==========================================================
     FINAL DASHBOARD WRAPPER
  ========================================================== */
  try {
    const base=renderTeacherHQ;
    renderTeacherHQ=function(){const result=base.apply(this,arguments);window.TeacherHQClasses?.refresh?.();window.TeacherHQTrash?.purgeExpired?.();enhanceUnitDeleteButton();return result;};
  } catch(_) {}

  window.TeacherHQMega={
    openLessonHub,
    openContextLibrary,
    shiftLessonsAfterFieldTrip,
    renderUnitProgressions,
    attachStandalonePrompt,
    version:"E1-E4"
  };
})();
