/* ============================================================
   TEACHER HQ — CURRICULUM + PROGRESSION BROWSERS
   ------------------------------------------------------------
   The renderer is deliberately hierarchy-agnostic. Modern Alberta
   curriculum, legacy Fine Arts trees, secondary Science trees, and any
   future source can all expose a path of arbitrary depth.

   Branches are lazy-rendered and CLOSED BY DEFAULT. This prevents large
   curricula from producing thousands of DOM nodes until the teacher asks
   to see them.
============================================================ */
(function () {
  "use strict";

  const $id = id => document.getElementById(id);
  const reg = () => window.TeacherHQRegistry;
  const DEFAULT_BROWSER_GRADES = ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];

  function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }

  function recordPath(record) {
    if (Array.isArray(record.curriculumPath) && record.curriculumPath.length) {
      return record.curriculumPath.map(item => ({ label: text(item.label || "Branch"), title: text(item.title) })).filter(item => item.title);
    }
    const path = [];
    if (record.discipline && record.subject === "Fine Arts") path.push({ label: "Discipline", title: text(record.discipline) });
    if (record.organizingIdea) path.push({ label: record.overviewOnly ? "Organizing Idea" : "Organizing Idea", title: text(record.organizingIdea) });
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

  function renderLeaf(record, options) {
    const { selectable, selectedIds, onSelectionChange, compact } = options;
    const article = document.createElement(selectable ? "label" : "article");
    article.className = `generic-curriculum-leaf ${selectable ? "selectable" : ""} ${record.assessmentTarget ? "assessment-target" : ""}`;
    article.dataset.curriculumId = record.id;
    if (selectable) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedIds.has(record.id);
      input.disabled = Boolean(options.readOnly);
      input.addEventListener("change", () => {
        if (input.checked) selectedIds.add(record.id); else selectedIds.delete(record.id);
        article.classList.toggle("selected", input.checked);
        onSelectionChange?.([...selectedIds], record, input.checked);
        options.onTreeStateChange?.();
      });
      article.appendChild(input);
      article.classList.toggle("selected", input.checked);
    }
    const copy = document.createElement("div");
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
    return article;
  }

  function renderTree(records, container, options = {}) {
    const selectedIds = options.selectedIds instanceof Set ? options.selectedIds : new Set(options.selectedIds || []);
    const tree = treeFromRecords(records);
    container.innerHTML = "";
    container.classList.add("generic-curriculum-tree");

    /* Selection and expansion are deliberately independent.  Bulk selection
       updates the already-rendered controls in place instead of rebuilding the
       tree, so pressing Select All / Clear All can never collapse a branch. */
    function syncRenderedSelection() {
      container.querySelectorAll(".generic-curriculum-leaf[data-curriculum-id]").forEach(article => {
        const checked = selectedIds.has(article.dataset.curriculumId);
        article.classList.toggle("selected", checked);
        const input = article.querySelector('input[type="checkbox"]');
        if (input) input.checked = checked;
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
        refreshCount();
        summary.append(label, title, count);
        if (options.selectable) {
          const actions = document.createElement("span"); actions.className = "branch-select-actions";
          const selectAll = document.createElement("button"); selectAll.type="button"; selectAll.textContent="Select all";
          const clearAll = document.createElement("button"); clearAll.type="button"; clearAll.textContent="Clear all";
          const collect = branch => [...branch.records, ...[...branch.children.values()].flatMap(grand => collect(grand))];
          selectAll.addEventListener("click", event => {
            event.preventDefault(); event.stopPropagation();
            collect(child).forEach(record => selectedIds.add(record.id));
            options.onSelectionChange?.([...selectedIds]);
            syncRenderedSelection();
          });
          clearAll.addEventListener("click", event => {
            event.preventDefault(); event.stopPropagation();
            collect(child).forEach(record => selectedIds.delete(record.id));
            options.onSelectionChange?.([...selectedIds]);
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
      if (depth === 0 && !node.children.size) {
        node.records.forEach(record => parent.appendChild(renderLeaf(record,{...options,selectedIds})));
      }
    }
    renderNode(tree, container, 0);
    if (!tree.children.size && !tree.records.length) container.innerHTML='<div class="empty-state-card">No curriculum records are available for this selection.</div>';
    return { selectedIds };
  }

  function createCurriculumBrowserDialog() {
    let dialog=$id("curriculumBrowserDialog"); if(dialog)return dialog;
    dialog=document.createElement("dialog"); dialog.id="curriculumBrowserDialog"; dialog.className="modal browser-modal";
    dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><h2>Curriculum Browser</h2><p class="section-subtitle">Browse the Alberta curriculum database without creating a Unit or Lesson. Branches stay collapsed until you open them.</p></div><button class="close-button" type="button" data-browser-close>×</button></div><div class="browser-toolbar"><label class="checkbox-row"><input type="checkbox" data-split-toggle /><span>Split grade view</span></label><label class="form-field compact hidden" data-pane-count-wrap><span>Grades to compare</span><select data-pane-count><option>2</option><option>3</option><option>4</option></select></label></div><div data-browser-panes class="curriculum-browser-panes"></div></div>`;
    document.body.appendChild(dialog); dialog.querySelector("[data-browser-close]").onclick=()=>dialog.close(); dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
    return dialog;
  }

  function curriculumPane(index, state) {
    const pane=document.createElement("section"); pane.className="curriculum-browser-pane";
    pane.innerHTML=`<div class="browser-pane-controls"><label><span>Grade</span><select data-grade>${DEFAULT_BROWSER_GRADES.map(g=>`<option ${g===state.grade?"selected":""}>${g}</option>`).join("")}</select></label><label><span>Subject</span><select data-subject></select></label></div><div data-record-count class="browser-record-count"></div><div data-tree></div>`;
    const gradeSelect=pane.querySelector("[data-grade]"), subjectSelect=pane.querySelector("[data-subject]"), tree=pane.querySelector("[data-tree]");
    const drawSubjects=()=>{
      const subjects=reg()?.subjectsForGrade(gradeSelect.value)||[];
      if(!subjects.length){subjectSelect.innerHTML='<option>No loaded subjects</option>';tree.innerHTML='<div class="empty-state-card">No curriculum is loaded for this grade.</div>';return;}
      const preferred=subjects.includes(state.subject)?state.subject:subjects[0]; subjectSelect.innerHTML=subjects.map(s=>`<option ${s===preferred?"selected":""}>${escapeHTML(s)}</option>`).join(""); state.subject=preferred; drawTree();
    };
    const drawTree=()=>{ state.grade=gradeSelect.value; state.subject=subjectSelect.value; const records=reg()?.curriculumFor(state.grade,state.subject)||[]; pane.querySelector("[data-record-count]").textContent=`${records.length} selectable record${records.length===1?"":"s"}`; renderTree(records,tree,{selectable:false,compact:true}); };
    gradeSelect.onchange=drawSubjects; subjectSelect.onchange=drawTree; drawSubjects(); return pane;
  }

  const browserState={ split:false, count:2, panes:[{grade:"Grade 4",subject:"Math"},{grade:"Grade 5",subject:"Math"},{grade:"Grade 6",subject:"Math"},{grade:"Grade 7",subject:"Math"}] };
  function openCurriculumBrowser(){ const dialog=createCurriculumBrowserDialog(); const split=dialog.querySelector("[data-split-toggle]"); const count=dialog.querySelector("[data-pane-count]"); split.checked=browserState.split; count.value=String(browserState.count); const draw=()=>{ browserState.split=split.checked; browserState.count=Number(count.value)||2; dialog.querySelector("[data-pane-count-wrap]").classList.toggle("hidden",!browserState.split); const panes=dialog.querySelector("[data-browser-panes]"); panes.innerHTML=""; const n=browserState.split?browserState.count:1; panes.dataset.count=n; for(let i=0;i<n;i++)panes.appendChild(curriculumPane(i,browserState.panes[i])); }; split.onchange=draw; count.onchange=draw; draw(); dialog.showModal(); }

  function createProgressionBrowserDialog(){ let dialog=$id("progressionBrowserDialog");if(dialog)return dialog; dialog=document.createElement("dialog");dialog.id="progressionBrowserDialog";dialog.className="modal browser-modal";dialog.innerHTML=`<div class="modal-content"><div class="modal-heading"><div><h2>Progression Browser</h2><p class="section-subtitle">Literacy, Numeracy, Career and Competency progressions are planning frameworks—not separate subject curricula.</p></div><button class="close-button" type="button" data-prog-close>×</button></div><div class="progression-browser-controls"><label><span>Grade</span><select data-prog-grade>${[...DEFAULT_BROWSER_GRADES,"Grade 10","Grade 11","Grade 12"].map(g=>`<option>${g}</option>`).join("")}</select></label><div class="progression-framework-tabs">${["Literacy","Numeracy","Career","Competency"].map(f=>`<button type="button" data-framework="${f}">${f}</button>`).join("")}</div></div><div data-division-nav class="division-nav"></div><div data-progression-tree></div></div>`;document.body.appendChild(dialog);dialog.querySelector("[data-prog-close]").onclick=()=>dialog.close();dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});return dialog; }

  const progressionState={grade:"Grade 4",framework:"Literacy",divisionOverride:""};
  function progressionForView(framework,grade,divisionOverride){ const all=(reg()?.progressions||[]).filter(r=>r.framework===framework); const defaultRecords=all.filter(r=>(r.gradeTags||[]).includes(grade)); if(!divisionOverride)return defaultRecords; return all.filter(r=>r.division===divisionOverride); }
  function progressionDivisions(framework){ const order=["Kindergarten","Division 1","Division 2","Division 3","Division 4","Grades 7–12"];return [...new Set((reg()?.progressions||[]).filter(r=>r.framework===framework).map(r=>r.division))].sort((a,b)=>order.indexOf(a)-order.indexOf(b)); }
  function renderProgressionTree(records,container){container.innerHTML="";const headings=new Map();records.forEach(r=>{if(!headings.has(r.heading))headings.set(r.heading,[]);headings.get(r.heading).push(r);});if(!records.length){container.innerHTML='<div class="empty-state-card">This framework has no records for the selected grade/division.</div>';return;} const wrap=document.createElement("div");wrap.className="progression-tree";headings.forEach((items,heading)=>{const details=document.createElement("details");details.className="progression-heading";details.innerHTML=`<summary><strong>${escapeHTML(heading)}</strong><span>${items.length} descriptors</span></summary><div></div>`;const body=details.querySelector("div");items.forEach(item=>{const row=document.createElement("article");row.className="progression-record";row.innerHTML=`<small>${escapeHTML(item.row)}</small><p>${escapeHTML(text(item.text))}</p>${item.examples?.length?`<ul>${item.examples.map(ex=>`<li>${escapeHTML(text(ex))}</li>`).join("")}</ul>`:""}`;body.appendChild(row);});wrap.appendChild(details);});container.appendChild(wrap);}
  function openProgressionBrowser(){const dialog=createProgressionBrowserDialog();const grade=dialog.querySelector("[data-prog-grade]"),nav=dialog.querySelector("[data-division-nav]"),tree=dialog.querySelector("[data-progression-tree]");grade.value=progressionState.grade; const draw=()=>{progressionState.grade=grade.value; dialog.querySelectorAll("[data-framework]").forEach(b=>b.classList.toggle("active",b.dataset.framework===progressionState.framework)); const divisions=progressionDivisions(progressionState.framework); const defaultRecords=progressionForView(progressionState.framework,progressionState.grade,""); const defaultDivision=defaultRecords[0]?.division||divisions[0]||""; if(!progressionState.divisionOverride||!divisions.includes(progressionState.divisionOverride))progressionState.divisionOverride=defaultDivision; const idx=divisions.indexOf(progressionState.divisionOverride); nav.innerHTML=`<button type="button" data-prev ${idx<=0?"disabled":""}>←</button><div><small>Viewing</small><strong>${escapeHTML(progressionState.divisionOverride||"No division")}</strong>${progressionState.divisionOverride!==defaultDivision?'<em>Manual division override</em>':''}</div><button type="button" data-next ${idx<0||idx>=divisions.length-1?"disabled":""}>→</button>`;nav.querySelector("[data-prev]").onclick=()=>{progressionState.divisionOverride=divisions[idx-1];draw();};nav.querySelector("[data-next]").onclick=()=>{progressionState.divisionOverride=divisions[idx+1];draw();};renderProgressionTree(progressionForView(progressionState.framework,progressionState.grade,progressionState.divisionOverride),tree);};grade.onchange=()=>{progressionState.divisionOverride="";draw();};dialog.querySelectorAll("[data-framework]").forEach(button=>button.onclick=()=>{progressionState.framework=button.dataset.framework;progressionState.divisionOverride="";draw();});draw();dialog.showModal();}

  $id("openCurriculumBrowserButton")?.addEventListener("click",openCurriculumBrowser);
  $id("openProgressionBrowserButton")?.addEventListener("click",openProgressionBrowser);

  window.TeacherHQCurriculumUI={recordPath,treeFromRecords,renderTree,openCurriculumBrowser,openProgressionBrowser,progressionForView,progressionDivisions,renderProgressionTree};
})();
