/* ============================================================
   TEACHER HQ — CURRICULUM + PROGRESSION BROWSER
   ------------------------------------------------------------
   One shared browser for official curriculum and planning
   progressions. Curriculum trees are hierarchy-agnostic, lazy rendered,
   and CLOSED BY DEFAULT. Selection never changes branch expansion.

   Teacher notes are stored on the active user's profile by stable
   curriculum record ID. Lesson Planner can surface those notes without
   copying them into the curriculum data itself.
============================================================ */
(function () {
  "use strict";

  const $id = id => document.getElementById(id);
  const reg = () => window.TeacherHQRegistry;
  const DEFAULT_BROWSER_GRADES = ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
  const PROGRESSION_GRADES = [...DEFAULT_BROWSER_GRADES,"Grade 10","Grade 11","Grade 12"];

  function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
  function gradeShortLabel(grade) { return grade === "Kindergarten" ? "K" : grade.replace("Grade ", ""); }

  function activeUser() {
    try { return typeof getActiveUser === "function" ? getActiveUser() : null; }
    catch (_) { return null; }
  }

  function persist() {
    try { if (typeof saveData === "function") saveData(); }
    catch (error) { console.error("Could not save curriculum note", error); }
  }

  function isReadOnly() {
    try {
      return Boolean((typeof readOnlyMode !== "undefined" && readOnlyMode) || (typeof readOnlySource !== "undefined" && readOnlySource === "shared"));
    } catch (_) { return false; }
  }

  function recordPath(record) {
    if (Array.isArray(record.curriculumPath) && record.curriculumPath.length) {
      return record.curriculumPath.map(item => ({ label: text(item.label || "Branch"), title: text(item.title) })).filter(item => item.title);
    }
    const path = [];
    if (record.discipline && record.subject === "Fine Arts") path.push({ label: "Discipline", title: text(record.discipline) });
    if (record.organizingIdea) path.push({ label: "Organizing Idea", title: text(record.organizingIdea) });
    if (record.guidingQuestion && !["Organizing Idea Details", "Overview"].includes(record.guidingQuestion)) path.push({ label: "Guiding Question", title: text(record.guidingQuestion) });
    if (record.learningOutcome && !["Overview"].includes(record.learningOutcome)) path.push({ label: "Learning Outcome", title: text(record.learningOutcome) });
    return path;
  }

  function treeFromRecords(records) {
    const root = { children: new Map(), records: [] };
    (records || []).forEach(record => {
      let node = root;
      recordPath(record).forEach(part => {
        const key = `${part.label}::${part.title}`;
        if (!node.children.has(key)) node.children.set(key, { part, children: new Map(), records: [] });
        node = node.children.get(key);
      });
      node.records.push(record);
    });
    return root;
  }

  function selectedCount(node, selectedIds) {
    let count = node.records.filter(record => selectedIds.has(record.id)).length;
    node.children.forEach(child => { count += selectedCount(child, selectedIds); });
    return count;
  }

  function leafLabel(record) {
    return text(record.type || record.role || (record.overviewOnly ? "Overview" : "Curriculum"));
  }

  function curriculumNote(user, recordId) {
    const value = user?.curriculumNotes?.[recordId];
    if (!value) return null;
    if (typeof value === "string") return value.trim() ? { text: value.trim(), updatedAt: "" } : null;
    const noteText = String(value.text ?? "").trim();
    return noteText ? { ...value, text: noteText } : null;
  }

  function ensureCurriculumNotes(user) {
    if (!user) return {};
    if (!user.curriculumNotes || typeof user.curriculumNotes !== "object" || Array.isArray(user.curriculumNotes)) user.curriculumNotes = {};
    return user.curriculumNotes;
  }

  function openCurriculumNoteEditor(record, onSaved) {
    const user = activeUser();
    if (!user || !record) return;
    let dialog = $id("curriculumNoteDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "curriculumNoteDialog";
      dialog.className = "modal curriculum-note-dialog";
      document.body.appendChild(dialog);
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    }
    const existing = curriculumNote(user, record.id);
    const breadcrumb = recordPath(record).map(item => `${item.label}: ${item.title}`).join(" → ");
    dialog.innerHTML = `<form method="dialog" class="modal-content curriculum-note-editor">
      <div class="modal-heading"><div><h2>Curriculum Note</h2><p class="section-subtitle">This note stays attached to this curriculum objective wherever you use it.</p></div><button class="close-button" type="button" data-close>×</button></div>
      <div class="curriculum-note-source"><small>${escapeHTML(record.grade || "")} · ${escapeHTML(record.subject || "")}</small>${breadcrumb ? `<strong>${escapeHTML(breadcrumb)}</strong>` : ""}<p>${escapeHTML(text(record.text || record.learningOutcome || record.organizingIdea))}</p></div>
      <label class="form-field"><span>Your note</span><textarea data-note rows="6" placeholder="Add a reminder, teaching idea, misconception to watch for, resource connection…">${escapeHTML(existing?.text || "")}</textarea></label>
      <div class="form-actions split-actions"><button type="button" class="danger secondary-button ${existing ? "" : "hidden"}" data-delete>Delete note</button><span></span><button type="button" class="secondary-button" data-cancel>Cancel</button><button type="submit" class="primary-button">Save note</button></div>
    </form>`;
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.querySelector("[data-cancel]").onclick = () => dialog.close();
    dialog.querySelector("[data-delete]")?.addEventListener("click", () => {
      delete ensureCurriculumNotes(user)[record.id];
      persist();
      dialog.close();
      onSaved?.(null);
    });
    dialog.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const noteText = String(dialog.querySelector("[data-note]").value || "").trim();
      const notes = ensureCurriculumNotes(user);
      if (noteText) notes[record.id] = { text: noteText, updatedAt: new Date().toISOString() };
      else delete notes[record.id];
      persist();
      dialog.close();
      onSaved?.(curriculumNote(user, record.id));
    };
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector("[data-note]")?.focus());
  }

  function renderLeaf(record, options) {
    const { selectable, selectedIds, onSelectionChange, compact } = options;
    const user = options.user || activeUser();
    const article = document.createElement("article");
    article.className = `generic-curriculum-leaf ${selectable ? "selectable" : ""} ${record.assessmentTarget ? "assessment-target" : ""}`;
    article.dataset.curriculumId = record.id;

    if (selectable) {
      const checkWrap = document.createElement("label");
      checkWrap.className = "curriculum-leaf-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedIds.has(record.id);
      input.disabled = Boolean(options.readOnly);
      input.addEventListener("change", () => {
        if (input.checked) selectedIds.add(record.id); else selectedIds.delete(record.id);
        article.classList.toggle("selected", input.checked);
        onSelectionChange?.([...selectedIds], record, input.checked);
        options.onTreeStateChange?.();
        updateNoteVisibilityState();
      });
      checkWrap.appendChild(input);
      article.appendChild(checkWrap);
      article.classList.toggle("selected", input.checked);
    }

    const copy = document.createElement("div");
    copy.className = "curriculum-leaf-copy";
    const top = document.createElement("div"); top.className = "curriculum-leaf-meta";
    top.innerHTML = `<span>${escapeHTML(leafLabel(record))}</span>${record.requiredStatus ? `<em>${escapeHTML(text(record.requiredStatus).replaceAll("-", " "))}</em>` : ""}${record.requiresParentOptIn ? '<em class="warning">Parent opt-in</em>' : ""}${record.curriculumStatus?.toLowerCase().includes("draft") ? '<em class="draft">Draft</em>' : ""}`;
    copy.appendChild(top);
    const p = document.createElement("p");
    p.textContent = text(record.text || record.learningOutcome || record.organizingIdeaDescription || record.organizingIdea);
    copy.appendChild(p);
    if (!compact && record.source) {
      const source = document.createElement("small"); source.textContent = text(record.source); copy.appendChild(source);
    }
    article.appendChild(copy);

    const noteArea = document.createElement("div");
    noteArea.className = "curriculum-leaf-note-area";
    article.appendChild(noteArea);

    function drawNote() {
      const note = curriculumNote(user, record.id);
      noteArea.innerHTML = "";
      if (options.enableNotes && !options.readOnly) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = `curriculum-note-button ${note ? "has-note" : ""}`;
        edit.textContent = note ? "✎ Edit note" : "+ Note";
        edit.addEventListener("click", event => {
          event.preventDefault(); event.stopPropagation();
          openCurriculumNoteEditor(record, () => { drawNote(); options.onNoteChanged?.(record.id); });
        });
        noteArea.appendChild(edit);
        if (note) {
          const preview = document.createElement("p");
          preview.className = "curriculum-note-preview";
          preview.textContent = note.text;
          noteArea.appendChild(preview);
        }
      }
      if (note && options.showTeacherNotes) {
        const noteCard = document.createElement("div");
        noteCard.className = "lesson-curriculum-teacher-note";
        noteCard.innerHTML = `<div><strong>Teacher note</strong><p>${escapeHTML(note.text)}</p></div>`;
        if (!options.readOnly) {
          const edit = document.createElement("button"); edit.type="button"; edit.className="text-button"; edit.textContent="Edit";
          edit.onclick = event => { event.preventDefault(); event.stopPropagation(); openCurriculumNoteEditor(record, () => { drawNote(); options.onNoteChanged?.(record.id); }); };
          noteCard.appendChild(edit);
        }
        noteArea.appendChild(noteCard);

        if (options.noteVisibilityIds instanceof Set) {
          const visibility = document.createElement("label");
          visibility.className = "curriculum-note-visibility";
          const box = document.createElement("input"); box.type="checkbox"; box.dataset.noteVisibilityFor=record.id;
          box.checked = options.noteVisibilityIds.has(record.id);
          box.disabled = Boolean(options.readOnly) || (selectable && !selectedIds.has(record.id));
          const label = document.createElement("span"); label.textContent = "Show this note on the lesson plan";
          box.onchange = () => {
            if (box.checked) options.noteVisibilityIds.add(record.id); else options.noteVisibilityIds.delete(record.id);
            options.onNoteVisibilityChange?.([...options.noteVisibilityIds], record, box.checked);
          };
          visibility.append(box,label); noteArea.appendChild(visibility);
        }
      }
    }

    function updateNoteVisibilityState() {
      const box = noteArea.querySelector("[data-note-visibility-for]");
      if (box) {
        box.disabled = Boolean(options.readOnly) || (selectable && !selectedIds.has(record.id));
        if (selectable && !selectedIds.has(record.id) && box.checked) {
          box.checked = false;
          options.noteVisibilityIds?.delete(record.id);
          options.onNoteVisibilityChange?.([...(options.noteVisibilityIds || [])], record, false);
        }
      }
    }

    drawNote();
    return article;
  }

  function renderTree(records, container, options = {}) {
    const selectedIds = options.selectedIds instanceof Set ? options.selectedIds : new Set(options.selectedIds || []);
    const tree = treeFromRecords(records);
    container.innerHTML = "";
    container.classList.add("generic-curriculum-tree");

    function syncRenderedSelection() {
      container.querySelectorAll(".generic-curriculum-leaf[data-curriculum-id]").forEach(article => {
        const checked = selectedIds.has(article.dataset.curriculumId);
        article.classList.toggle("selected", checked);
        const input = article.querySelector('.curriculum-leaf-check input[type="checkbox"]');
        if (input) input.checked = checked;
        const noteBox = article.querySelector("[data-note-visibility-for]");
        if (noteBox) noteBox.disabled = Boolean(options.readOnly) || !checked;
      });
      container.querySelectorAll(".curriculum-tree-branch").forEach(details => {
        const branch = details.__teacherHQTreeNode;
        const count = details.querySelector(":scope > summary .branch-selected-count");
        if (!branch || !count) return;
        const selected = selectedCount(branch, selectedIds);
        count.textContent = selected ? `${selected} selected` : "";
        count.classList.toggle("hidden", !selected);
      });
    }

    function renderNode(node, parent, depth = 0) {
      [...node.children.values()].sort((a,b)=>a.part.title.localeCompare(b.part.title, undefined, {numeric:true})).forEach(child => {
        const details = document.createElement("details");
        details.className = `curriculum-tree-branch depth-${Math.min(depth, 6)}`;
        details.__teacherHQTreeNode = child;
        const summary = document.createElement("summary");
        const label = document.createElement("span"); label.className = "branch-label"; label.textContent = child.part.label;
        const title = document.createElement("strong"); title.textContent = child.part.title;
        const count = document.createElement("span"); count.className = "branch-selected-count";
        const refreshCount = () => {
          const selected = selectedCount(child, selectedIds);
          count.textContent = selected ? `${selected} selected` : "";
          count.classList.toggle("hidden", !selected);
        };
        refreshCount(); summary.append(label, title, count);
        if (options.selectable) {
          const actions = document.createElement("span"); actions.className = "branch-select-actions";
          const selectAll = document.createElement("button"); selectAll.type="button"; selectAll.textContent="Select all";
          const clearAll = document.createElement("button"); clearAll.type="button"; clearAll.textContent="Clear all";
          const collect = branch => [...branch.records, ...[...branch.children.values()].flatMap(grand => collect(grand))];
          selectAll.addEventListener("click", event => {
            event.preventDefault(); event.stopPropagation();
            collect(child).forEach(record => selectedIds.add(record.id));
            options.onSelectionChange?.([...selectedIds]); syncRenderedSelection();
          });
          clearAll.addEventListener("click", event => {
            event.preventDefault(); event.stopPropagation();
            const ids = new Set(collect(child).map(record => record.id));
            ids.forEach(id => { selectedIds.delete(id); options.noteVisibilityIds?.delete(id); });
            options.onSelectionChange?.([...selectedIds]);
            if (options.noteVisibilityIds) options.onNoteVisibilityChange?.([...options.noteVisibilityIds]);
            syncRenderedSelection();
          });
          actions.append(selectAll, clearAll); summary.appendChild(actions);
        }
        details.appendChild(summary);
        const body = document.createElement("div"); body.className="curriculum-branch-body"; details.appendChild(body);
        let rendered = false;
        const draw = () => {
          if (rendered) return; rendered = true;
          renderNode(child, body, depth + 1);
          const grouped = new Map();
          child.records.forEach(record => { const key = leafLabel(record); if(!grouped.has(key))grouped.set(key,[]); grouped.get(key).push(record); });
          grouped.forEach((items, type) => {
            const section=document.createElement("section"); section.className="curriculum-leaf-group";
            const heading=document.createElement("div"); heading.className="curriculum-leaf-group-heading"; heading.innerHTML=`<strong>${escapeHTML(type)}</strong><span>${items.length}</span>`; section.appendChild(heading);
            items.forEach(record=>section.appendChild(renderLeaf(record,{...options,selectedIds,onTreeStateChange:refreshCount})));
            body.appendChild(section);
          });
        };
        details.addEventListener("toggle",()=>{ if(details.open) draw(); refreshCount(); });
        parent.appendChild(details);
      });
      if (depth === 0 && !node.children.size) node.records.forEach(record => parent.appendChild(renderLeaf(record,{...options,selectedIds})));
    }
    renderNode(tree, container, 0);
    if (!tree.children.size && !tree.records.length) container.innerHTML='<div class="empty-state-card">No curriculum records are available for this selection.</div>';
    return { selectedIds };
  }

  function createCurriculumBrowserDialog() {
    let dialog=$id("curriculumBrowserDialog"); if(dialog)return dialog;
    dialog=document.createElement("dialog"); dialog.id="curriculumBrowserDialog"; dialog.className="modal browser-modal curriculum-browser-redesign";
    dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><h2>Curriculum Browser</h2><p class="section-subtitle">Browse curriculum, keep your own notes, or switch to planning progressions.</p></div><button class="close-button" type="button" data-browser-close>×</button></div>
      <div class="browser-mode-tabs"><button type="button" data-browser-mode="curriculum">Curriculum</button><button type="button" data-browser-mode="progressions">Progressions</button></div>
      <div data-curriculum-mode><div class="browser-toolbar"><label class="checkbox-row split-grade-toggle"><input type="checkbox" data-split-toggle /><span>Split grade view</span></label><span class="browser-toolbar-note">Compare two grade/subject curricula side by side.</span></div><div data-browser-panes class="curriculum-browser-panes"></div></div>
      <div data-progressions-mode class="hidden"></div>
    </div>`;
    document.body.appendChild(dialog); dialog.querySelector("[data-browser-close]").onclick=()=>dialog.close(); dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
    return dialog;
  }

  function buttonGrid(values, selected, className, onSelect, formatter = value => value) {
    const grid = document.createElement("div"); grid.className = className;
    values.forEach(value => {
      const button = document.createElement("button"); button.type="button"; button.dataset.value=value;
      button.className = value === selected ? "selected" : ""; button.textContent = formatter(value);
      button.onclick = () => onSelect(value);
      grid.appendChild(button);
    });
    return grid;
  }

  function curriculumPane(index, state) {
    const pane=document.createElement("section"); pane.className="curriculum-browser-pane";
    pane.innerHTML=`<div class="browser-step"><span class="browser-step-number">1</span><div><strong>Choose a grade</strong></div></div><div data-grade-buttons></div><div class="browser-step"><span class="browser-step-number">2</span><div><strong>Choose a subject</strong></div></div><div data-subject-buttons></div><div data-curriculum-stage class="browser-curriculum-stage hidden"><div class="browser-step"><span class="browser-step-number">3</span><div><strong data-tree-heading>Browse curriculum</strong><small>Open only the branches you need.</small></div></div><div data-tree></div></div>`;
    const gradesHost=pane.querySelector("[data-grade-buttons]"), subjectsHost=pane.querySelector("[data-subject-buttons]"), stage=pane.querySelector("[data-curriculum-stage]"), tree=pane.querySelector("[data-tree]");

    const drawGrades=()=>{
      gradesHost.innerHTML="";
      gradesHost.appendChild(buttonGrid(DEFAULT_BROWSER_GRADES,state.grade,"browser-grade-grid",value=>{state.grade=value;state.subject="";drawGrades();drawSubjects();},gradeShortLabel));
    };
    const drawSubjects=()=>{
      const subjects=reg()?.subjectsForGrade(state.grade)||[];
      subjectsHost.innerHTML=""; stage.classList.add("hidden"); tree.innerHTML="";
      if(!subjects.length){subjectsHost.innerHTML='<div class="empty-state-card compact">No curriculum is loaded for this grade.</div>';return;}
      subjectsHost.appendChild(buttonGrid(subjects,state.subject,"browser-subject-grid",value=>{state.subject=value;drawSubjects();}));
      if(state.subject && subjects.includes(state.subject)) drawTree();
    };
    const drawTree=()=>{
      if(!state.subject)return;
      stage.classList.remove("hidden");
      pane.querySelector("[data-tree-heading]").textContent=`${state.grade} ${state.subject}`;
      const records=reg()?.curriculumFor(state.grade,state.subject)||[];
      renderTree(records,tree,{selectable:false,compact:true,enableNotes:true,user:activeUser(),readOnly:isReadOnly()});
    };
    drawGrades(); drawSubjects();
    return pane;
  }

  const browserState={ mode:"curriculum", split:false, panes:[{grade:"Grade 4",subject:""},{grade:"Grade 5",subject:""}] };
  const progressionState={grade:"Grade 4",framework:"Literacy",divisionOverride:""};

  function progressionForView(framework,grade,divisionOverride){ const all=(reg()?.progressions||[]).filter(r=>r.framework===framework); const defaultRecords=all.filter(r=>(r.gradeTags||[]).includes(grade)); if(!divisionOverride)return defaultRecords; return all.filter(r=>r.division===divisionOverride); }
  function progressionDivisions(framework){ const order=["Kindergarten","Division 1","Division 2","Division 3","Division 4","Grades 7–12"];return [...new Set((reg()?.progressions||[]).filter(r=>r.framework===framework).map(r=>r.division))].sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi);}); }
  function renderProgressionTree(records,container){container.innerHTML="";const headings=new Map();records.forEach(r=>{if(!headings.has(r.heading))headings.set(r.heading,[]);headings.get(r.heading).push(r);});if(!records.length){container.innerHTML='<div class="empty-state-card">This framework has no records for the selected grade/division.</div>';return;} const wrap=document.createElement("div");wrap.className="progression-tree";headings.forEach((items,heading)=>{const details=document.createElement("details");details.className="progression-heading";details.innerHTML=`<summary><strong>${escapeHTML(heading)}</strong><span>${items.length} descriptors</span></summary><div></div>`;const body=details.querySelector("div");items.forEach(item=>{const row=document.createElement("article");row.className="progression-record";row.innerHTML=`<small>${escapeHTML(item.row)}</small><p>${escapeHTML(text(item.text))}</p>${item.examples?.length?`<ul>${item.examples.map(ex=>`<li>${escapeHTML(text(ex))}</li>`).join("")}</ul>`:""}`;body.appendChild(row);});wrap.appendChild(details);});container.appendChild(wrap);}

  function renderProgressionMode(host) {
    host.innerHTML=`<div class="progression-browser-intro"><strong>Planning Progressions</strong><span>Literacy, Numeracy, Career and Competency progressions support planning; they are visually separate from subject curriculum.</span></div><div class="browser-step"><span class="browser-step-number">1</span><div><strong>Choose a grade</strong></div></div><div data-prog-grades></div><div class="browser-step"><span class="browser-step-number">2</span><div><strong>Choose a progression</strong></div></div><div data-prog-frameworks></div><div data-division-nav class="division-nav"></div><div data-progression-tree></div>`;
    const gradeHost=host.querySelector("[data-prog-grades]"), frameworkHost=host.querySelector("[data-prog-frameworks]"), nav=host.querySelector("[data-division-nav]"), tree=host.querySelector("[data-progression-tree]");
    const draw=()=>{
      gradeHost.innerHTML="";
      gradeHost.appendChild(buttonGrid(PROGRESSION_GRADES, progressionState.grade, "browser-grade-grid progression-grade-grid", value=>{progressionState.grade=value;progressionState.divisionOverride="";draw();}, gradeShortLabel));
      frameworkHost.innerHTML="";
      frameworkHost.appendChild(buttonGrid(["Literacy","Numeracy","Career","Competency"], progressionState.framework, "browser-subject-grid progression-framework-grid", value=>{progressionState.framework=value;progressionState.divisionOverride="";draw();}));
      const divisions=progressionDivisions(progressionState.framework);
      const defaultRecords=progressionForView(progressionState.framework,progressionState.grade,"");
      const defaultDivision=defaultRecords[0]?.division||divisions[0]||"";
      if(!progressionState.divisionOverride||!divisions.includes(progressionState.divisionOverride))progressionState.divisionOverride=defaultDivision;
      const idx=divisions.indexOf(progressionState.divisionOverride);
      nav.innerHTML=`<button type="button" data-prev ${idx<=0?"disabled":""}>←</button><div><small>Viewing division</small><strong>${escapeHTML(progressionState.divisionOverride||"No division")}</strong>${progressionState.divisionOverride!==defaultDivision?'<em>Manual division override</em>':''}</div><button type="button" data-next ${idx<0||idx>=divisions.length-1?"disabled":""}>→</button>`;
      nav.querySelector("[data-prev]").onclick=()=>{progressionState.divisionOverride=divisions[idx-1];draw();};
      nav.querySelector("[data-next]").onclick=()=>{progressionState.divisionOverride=divisions[idx+1];draw();};
      renderProgressionTree(progressionForView(progressionState.framework,progressionState.grade,progressionState.divisionOverride),tree);
    };
    draw();
  }

  function openCurriculumBrowser(mode="curriculum"){
    browserState.mode = mode === "progressions" ? "progressions" : "curriculum";
    const dialog=createCurriculumBrowserDialog();
    const split=dialog.querySelector("[data-split-toggle]"); split.checked=browserState.split;
    const curriculumHost=dialog.querySelector("[data-curriculum-mode]"), progressionHost=dialog.querySelector("[data-progressions-mode]");
    const drawCurriculum=()=>{browserState.split=split.checked;const panes=dialog.querySelector("[data-browser-panes]");panes.innerHTML="";const n=browserState.split?2:1;panes.dataset.count=n;for(let i=0;i<n;i++)panes.appendChild(curriculumPane(i,browserState.panes[i]));};
    const drawMode=()=>{
      dialog.querySelectorAll("[data-browser-mode]").forEach(button=>button.classList.toggle("active",button.dataset.browserMode===browserState.mode));
      curriculumHost.classList.toggle("hidden",browserState.mode!=="curriculum"); progressionHost.classList.toggle("hidden",browserState.mode!=="progressions");
      if(browserState.mode==="curriculum") drawCurriculum(); else renderProgressionMode(progressionHost);
    };
    split.onchange=drawCurriculum;
    dialog.querySelectorAll("[data-browser-mode]").forEach(button=>button.onclick=()=>{browserState.mode=button.dataset.browserMode;drawMode();});
    drawMode();
    if(!dialog.open) dialog.showModal();
  }

  function openProgressionBrowser(){ openCurriculumBrowser("progressions"); }

  $id("openCurriculumBrowserButton")?.addEventListener("click",()=>openCurriculumBrowser("curriculum"));
  $id("openProgressionBrowserButton")?.addEventListener("click",openProgressionBrowser);

  window.TeacherHQCurriculumUI={recordPath,treeFromRecords,renderTree,openCurriculumBrowser,openProgressionBrowser,progressionForView,progressionDivisions,renderProgressionTree,curriculumNote,openCurriculumNoteEditor};
})();
