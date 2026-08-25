/* ============================================================
   TEACHER HQ — DEVELOPMENT TRACKER
   ------------------------------------------------------------
   Development-only issue/decision tracker used during foundation
   stabilization. It intentionally stores data outside Teacher HQ
   profile data so it cannot alter classroom planning records.
============================================================ */
(function () {
  "use strict";

  const STORAGE_KEY = "teacherHQDevelopmentTracker_v1";
  const SCHEMA_VERSION = 1;
  const SITE_RELEASE = "18-foundation-tracker";

  const CATEGORIES = [
    ["bug", "🐛 Bug"],
    ["logic", "🧠 Logic problem"],
    ["ux", "😕 Confusing UX"],
    ["connection", "🔗 Missing connection"],
    ["feature", "✨ Feature idea"],
    ["polish", "🧹 Polish"],
    ["unsure", "❓ I'm not sure"]
  ];

  const AREAS = [
    "Overview", "Profiles", "Cohorts", "Classes", "Calendar", "Units",
    "Lessons", "Curriculum", "Assessments", "Backup & Share", "Trash", "Other"
  ];

  const BLOCKERS = [
    ["yes", "🔴 Yes — foundation blocker"],
    ["maybe", "🟡 Maybe — discuss"],
    ["no", "⚪ No — future improvement"]
  ];

  const STATUSES = [
    ["inbox", "Inbox"],
    ["discussing", "Discussing"],
    ["approved", "Approved"],
    ["done", "Done"]
  ];

  const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
  const BLOCKER_LABEL = Object.fromEntries(BLOCKERS);
  const STATUS_LABEL = Object.fromEntries(STATUSES);

  let state = loadState();
  let editingIssueId = null;
  let editingDecisionId = null;
  let capturedContext = null;
  let pointMode = false;
  let pointTarget = null;
  let dialog = null;
  let floatingButton = null;
  let pointBanner = null;

  function nowISO() { return new Date().toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function safeText(value) { return String(value == null ? "" : value); }
  function escapeHTML(value) {
    return safeText(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function slugDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function optionHTML(entries, selected = "") {
    return entries.map(([value, label]) =>
      `<option value="${escapeHTML(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(label)}</option>`
    ).join("");
  }
  function areaOptionHTML(selected = "") {
    return AREAS.map(value => `<option ${value === selected ? "selected" : ""}>${escapeHTML(value)}</option>`).join("");
  }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      project: "Teacher HQ",
      siteRelease: SITE_RELEASE,
      nextIssueNumber: 1,
      nextDecisionNumber: 1,
      issues: [],
      decisions: [],
      updatedAt: nowISO()
    };
  }

  function normalizeIssue(issue) {
    return {
      id: safeText(issue.id || ""),
      category: CATEGORY_LABEL[issue.category] ? issue.category : "unsure",
      area: AREAS.includes(issue.area) ? issue.area : "Other",
      blocker: BLOCKER_LABEL[issue.blocker] ? issue.blocker : "maybe",
      status: STATUS_LABEL[issue.status] ? issue.status : "inbox",
      observation: safeText(issue.observation).trim(),
      expectedBehavior: safeText(issue.expectedBehavior).trim(),
      proposedSolution: safeText(issue.proposedSolution).trim(),
      context: normalizeContext(issue.context),
      createdAt: issue.createdAt || nowISO(),
      updatedAt: issue.updatedAt || nowISO()
    };
  }

  function normalizeDecision(decision) {
    return {
      id: safeText(decision.id || ""),
      title: safeText(decision.title).trim(),
      statement: safeText(decision.statement).trim(),
      area: AREAS.includes(decision.area) ? decision.area : "Other",
      status: ["active", "superseded"].includes(decision.status) ? decision.status : "active",
      createdAt: decision.createdAt || nowISO(),
      updatedAt: decision.updatedAt || nowISO()
    };
  }

  function normalizeContext(context) {
    const value = context && typeof context === "object" ? context : {};
    return {
      page: safeText(value.page || location.pathname || "index.html"),
      pageTitle: safeText(value.pageTitle || document.title || "Teacher HQ"),
      dialogId: safeText(value.dialogId),
      containerId: safeText(value.containerId),
      elementId: safeText(value.elementId),
      elementTag: safeText(value.elementTag),
      elementType: safeText(value.elementType),
      elementName: safeText(value.elementName),
      ariaLabel: safeText(value.ariaLabel),
      title: safeText(value.title),
      cssPath: safeText(value.cssPath),
      capturedAt: value.capturedAt || nowISO()
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    const issues = Array.isArray(raw.issues) ? raw.issues.map(normalizeIssue) : [];
    const decisions = Array.isArray(raw.decisions) ? raw.decisions.map(normalizeDecision) : [];
    const issueMax = issues.reduce((max, item) => Math.max(max, Number((item.id.match(/DEV-(\d+)/) || [])[1]) || 0), 0);
    const decisionMax = decisions.reduce((max, item) => Math.max(max, Number((item.id.match(/D-(\d+)/) || [])[1]) || 0), 0);
    return {
      ...base,
      ...raw,
      schemaVersion: SCHEMA_VERSION,
      siteRelease: SITE_RELEASE,
      issues,
      decisions,
      nextIssueNumber: Math.max(Number(raw.nextIssueNumber) || 1, issueMax + 1),
      nextDecisionNumber: Math.max(Number(raw.nextDecisionNumber) || 1, decisionMax + 1)
    };
  }

  function loadState() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      return normalizeState(text ? JSON.parse(text) : null);
    } catch (error) {
      console.warn("Teacher HQ Development Tracker: could not load saved tracker", error);
      return defaultState();
    }
  }

  function saveState() {
    state.updatedAt = nowISO();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateFloatingCount();
  }

  function nextIssueId() {
    const id = `DEV-${String(state.nextIssueNumber).padStart(3, "0")}`;
    state.nextIssueNumber += 1;
    return id;
  }

  function nextDecisionId() {
    const id = `D-${String(state.nextDecisionNumber).padStart(3, "0")}`;
    state.nextDecisionNumber += 1;
    return id;
  }

  function visibleDialog() {
    return [...document.querySelectorAll("dialog[open]")]
      .find(item => !item.classList.contains("devtracker-dialog")) || null;
  }

  function inferArea(context = {}) {
    const haystack = [
      context.page, context.dialogId, context.containerId, context.elementId,
      context.ariaLabel, context.title
    ].join(" ").toLowerCase();
    if (haystack.includes("cohort")) return "Cohorts";
    if (haystack.includes("class")) return "Classes";
    if (haystack.includes("lesson")) return "Lessons";
    if (haystack.includes("unit")) return "Units";
    if (haystack.includes("curriculum") || haystack.includes("progression")) return "Curriculum";
    if (haystack.includes("assessment") || haystack.includes("rubric")) return "Assessments";
    if (haystack.includes("calendar") || haystack.includes("daily") || haystack.includes("dayoff") || haystack.includes("schedule")) return "Calendar";
    if (haystack.includes("backup") || haystack.includes("restore") || haystack.includes("readview")) return "Backup & Share";
    if (haystack.includes("trash") || haystack.includes("delete")) return "Trash";
    if (haystack.includes("profile") || haystack.includes("user")) return "Profiles";
    if (haystack.includes("overview") || haystack.includes("index.html")) return "Overview";
    return "Other";
  }

  function captureAmbientContext() {
    const openDialog = visibleDialog();
    const active = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    const context = normalizeContext({
      page: location.pathname.split("/").pop() || "index.html",
      pageTitle: document.title,
      dialogId: openDialog?.id || "",
      containerId: active?.closest?.("[id]")?.id || "",
      elementId: active?.id || "",
      elementTag: active?.tagName?.toLowerCase() || "",
      elementType: active?.getAttribute?.("type") || "",
      elementName: active?.getAttribute?.("name") || "",
      ariaLabel: active?.getAttribute?.("aria-label") || "",
      title: active?.getAttribute?.("title") || "",
      cssPath: active ? structuralPath(active) : "",
      capturedAt: nowISO()
    });
    return context;
  }

  function structuralPath(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element.id) return `#${element.id}`;
    const parts = [];
    let current = element;
    let depth = 0;
    while (current && current !== document.body && depth < 4) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${current.id}`);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const same = [...parent.children].filter(child => child.tagName === current.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parent;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function captureElementContext(element) {
    const openDialog = element.closest("dialog") || visibleDialog();
    const container = element.closest("section[id], article[id], nav[id], main[id], aside[id], [role='dialog'][id]") || element.closest("[id]");
    return normalizeContext({
      page: location.pathname.split("/").pop() || "index.html",
      pageTitle: document.title,
      dialogId: openDialog?.id || "",
      containerId: container?.id || "",
      elementId: element.id || "",
      elementTag: element.tagName.toLowerCase(),
      elementType: element.getAttribute("type") || "",
      elementName: element.getAttribute("name") || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      cssPath: structuralPath(element),
      capturedAt: nowISO()
    });
  }

  function contextSummary(context) {
    if (!context) return "No technical context captured yet.";
    const bits = [context.page || "index.html"];
    if (context.dialogId) bits.push(`dialog #${context.dialogId}`);
    if (context.containerId && context.containerId !== context.dialogId) bits.push(`container #${context.containerId}`);
    if (context.elementId) bits.push(`element #${context.elementId}`);
    else if (context.elementTag) bits.push(context.elementTag);
    return bits.join(" · ");
  }

  function createShell() {
    if (document.getElementById("devtrackerOpenButton")) return;

    const primaryNav = document.querySelector(".hq-nav-list");
    if (primaryNav) {
      floatingButton = document.createElement("button");
      floatingButton.id = "devtrackerOpenButton";
      floatingButton.type = "button";
      floatingButton.className = "hq-nav-item devtracker-nav-button";
      floatingButton.innerHTML = `<span aria-hidden="true">🛠</span><strong>Development</strong><em data-dev-count></em>`;
      floatingButton.setAttribute("aria-label", "Open Teacher HQ Development Tracker");
      floatingButton.addEventListener("click", openTracker);
      primaryNav.appendChild(floatingButton);
    } else {
      floatingButton = document.createElement("button");
      floatingButton.id = "devtrackerOpenButton";
      floatingButton.type = "button";
      floatingButton.className = "devtracker-open-button";
      floatingButton.innerHTML = `<span aria-hidden="true">🛠</span><strong>Development</strong><em data-dev-count></em>`;
      floatingButton.setAttribute("aria-label", "Open Teacher HQ Development Tracker");
      floatingButton.addEventListener("click", openTracker);
      document.body.appendChild(floatingButton);
    }

    dialog = document.createElement("dialog");
    dialog.id = "developmentTrackerDialog";
    dialog.className = "devtracker-dialog";
    dialog.innerHTML = `
      <div class="devtracker-shell">
        <header class="devtracker-header">
          <div>
            <p class="devtracker-kicker">Foundation Stabilization</p>
            <h2>Development Tracker</h2>
            <p>Capture problems while you use Teacher HQ, then export a clean AI handoff.</p>
          </div>
          <button type="button" class="devtracker-close" data-dev-close aria-label="Close Development Tracker">×</button>
        </header>
        <div class="devtracker-privacy-note"><strong>Development-only.</strong> Automatic capture records interface structure, not student names or classroom content. Avoid typing private student information into reports.</div>
        <nav class="devtracker-tabs" aria-label="Development Tracker sections">
          <button type="button" data-dev-tab="issues" class="active">Issues</button>
          <button type="button" data-dev-tab="decisions">Foundation Decisions</button>
          <button type="button" data-dev-tab="handoff">AI Handoff</button>
        </nav>
        <section class="devtracker-tab-panel" data-dev-panel="issues"></section>
        <section class="devtracker-tab-panel hidden" data-dev-panel="decisions"></section>
        <section class="devtracker-tab-panel hidden" data-dev-panel="handoff"></section>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelector("[data-dev-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelectorAll("[data-dev-tab]").forEach(button => {
      button.addEventListener("click", () => showTab(button.dataset.devTab));
    });

    updateFloatingCount();
  }

  function updateFloatingCount() {
    if (!floatingButton) return;
    const open = state.issues.filter(item => item.status !== "done").length;
    const badge = floatingButton.querySelector("[data-dev-count]");
    badge.textContent = open ? String(open) : "";
    badge.classList.toggle("hidden", !open);
  }

  function openTracker() {
    capturedContext = captureAmbientContext();
    editingIssueId = null;
    renderIssues();
    renderDecisions();
    renderHandoff();
    showTab("issues");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function showTab(name) {
    dialog.querySelectorAll("[data-dev-tab]").forEach(button => button.classList.toggle("active", button.dataset.devTab === name));
    dialog.querySelectorAll("[data-dev-panel]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.devPanel !== name));
  }

  function issueFormHTML(issue = null) {
    const draft = issue || {
      category: "unsure",
      area: inferArea(capturedContext || captureAmbientContext()),
      blocker: "maybe",
      status: "inbox",
      observation: "",
      expectedBehavior: "",
      proposedSolution: "",
      context: capturedContext || captureAmbientContext()
    };
    capturedContext = draft.context || capturedContext || captureAmbientContext();
    return `
      <form class="devtracker-issue-form" data-dev-issue-form>
        <div class="devtracker-form-heading">
          <div><p class="devtracker-kicker">${issue ? `Editing ${escapeHTML(issue.id)}` : "Quick capture"}</p><h3>${issue ? "Edit observation" : "What needs to change?"}</h3></div>
          ${issue ? '<button type="button" class="devtracker-text-button" data-dev-cancel-edit>Cancel edit</button>' : ""}
        </div>
        <div class="devtracker-form-grid">
          <label><span>Type</span><select name="category">${optionHTML(CATEGORIES, draft.category)}</select></label>
          <label><span>Area</span><select name="area">${areaOptionHTML(draft.area)}</select></label>
          <label><span>Foundation blocker?</span><select name="blocker">${optionHTML(BLOCKERS, draft.blocker)}</select></label>
          <label><span>Status</span><select name="status">${optionHTML(STATUSES, draft.status)}</select></label>
        </div>
        <label class="devtracker-field devtracker-main-field"><span>Observation</span><textarea name="observation" rows="4" required placeholder="Write naturally: what feels wrong, confusing, broken, duplicated, or missing?">${escapeHTML(draft.observation)}</textarea></label>
        <label class="devtracker-field"><span>Expected behaviour <small>(optional)</small></span><textarea name="expectedBehavior" rows="2" placeholder="What did you expect to happen instead?">${escapeHTML(draft.expectedBehavior)}</textarea></label>
        <details class="devtracker-solution-details" ${draft.proposedSolution ? "open" : ""}><summary>Proposed solution <small>(optional — observation is more important)</small></summary><textarea name="proposedSolution" rows="2" placeholder="Only add this if you already have a possible solution in mind.">${escapeHTML(draft.proposedSolution)}</textarea></details>
        <div class="devtracker-context-card">
          <div><span>Technical context</span><strong data-dev-context-summary>${escapeHTML(contextSummary(capturedContext))}</strong><small>No page content or student text is automatically copied.</small></div>
          <button type="button" class="devtracker-secondary" data-dev-point>🎯 Point to Problem</button>
        </div>
        <div class="devtracker-form-actions">
          <button type="submit" class="devtracker-primary">${issue ? "Save Changes" : "Add to Inbox"}</button>
          ${issue ? '<button type="button" class="devtracker-danger" data-dev-delete-issue>Delete issue</button>' : ""}
        </div>
      </form>`;
  }

  function renderIssues() {
    const panel = dialog.querySelector('[data-dev-panel="issues"]');
    const activeIssue = editingIssueId ? state.issues.find(item => item.id === editingIssueId) : null;
    panel.innerHTML = `
      <div class="devtracker-summary-row">${summaryCardsHTML()}</div>
      ${issueFormHTML(activeIssue)}
      <section class="devtracker-list-section">
        <div class="devtracker-list-heading"><div><p class="devtracker-kicker">Tracker</p><h3>Observations</h3></div><span>${state.issues.length} total</span></div>
        <div class="devtracker-filters">
          <input type="search" data-dev-search placeholder="Search observations…" />
          <select data-dev-filter-status><option value="">All statuses</option>${optionHTML(STATUSES)}</select>
          <select data-dev-filter-blocker><option value="">All blocker levels</option>${optionHTML(BLOCKERS)}</select>
          <select data-dev-filter-area><option value="">All areas</option>${areaOptionHTML()}</select>
        </div>
        <div class="devtracker-issue-list" data-dev-issue-list></div>
      </section>`;

    const form = panel.querySelector("[data-dev-issue-form]");
    form.addEventListener("submit", saveIssueFromForm);
    form.querySelector("[data-dev-point]").addEventListener("click", beginPointMode);
    form.querySelector("[data-dev-cancel-edit]")?.addEventListener("click", () => { editingIssueId = null; capturedContext = captureAmbientContext(); renderIssues(); });
    form.querySelector("[data-dev-delete-issue]")?.addEventListener("click", () => deleteIssue(editingIssueId));

    panel.querySelectorAll("[data-dev-search],[data-dev-filter-status],[data-dev-filter-blocker],[data-dev-filter-area]").forEach(control => {
      control.addEventListener("input", renderIssueList);
      control.addEventListener("change", renderIssueList);
    });
    renderIssueList();
  }

  function summaryCardsHTML() {
    const open = state.issues.filter(item => item.status !== "done").length;
    const blockers = state.issues.filter(item => item.status !== "done" && item.blocker === "yes").length;
    const discuss = state.issues.filter(item => item.status !== "done" && item.blocker === "maybe").length;
    const decisions = state.decisions.filter(item => item.status === "active").length;
    return [
      [blockers, "Foundation blockers", "danger"],
      [discuss, "Need discussion", "warning"],
      [open, "Open observations", "neutral"],
      [decisions, "Active decisions", "good"]
    ].map(([value, label, cls]) => `<article class="devtracker-summary-card ${cls}"><strong>${value}</strong><span>${label}</span></article>`).join("");
  }

  function saveIssueFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const observation = safeText(data.get("observation")).trim();
    if (!observation) return;
    const existing = editingIssueId ? state.issues.find(item => item.id === editingIssueId) : null;
    const issue = normalizeIssue({
      id: existing?.id || nextIssueId(),
      category: data.get("category"),
      area: data.get("area"),
      blocker: data.get("blocker"),
      status: data.get("status"),
      observation,
      expectedBehavior: data.get("expectedBehavior"),
      proposedSolution: data.get("proposedSolution"),
      context: capturedContext || existing?.context || captureAmbientContext(),
      createdAt: existing?.createdAt || nowISO(),
      updatedAt: nowISO()
    });
    if (existing) Object.assign(existing, issue);
    else state.issues.unshift(issue);
    editingIssueId = null;
    capturedContext = captureAmbientContext();
    saveState();
    renderIssues();
    renderHandoff();
  }

  function issueMatchesFilters(issue) {
    const panel = dialog.querySelector('[data-dev-panel="issues"]');
    const query = safeText(panel.querySelector("[data-dev-search]")?.value).trim().toLowerCase();
    const status = panel.querySelector("[data-dev-filter-status]")?.value || "";
    const blocker = panel.querySelector("[data-dev-filter-blocker]")?.value || "";
    const area = panel.querySelector("[data-dev-filter-area]")?.value || "";
    if (status && issue.status !== status) return false;
    if (blocker && issue.blocker !== blocker) return false;
    if (area && issue.area !== area) return false;
    if (query) {
      const text = [issue.id, issue.observation, issue.expectedBehavior, issue.proposedSolution, issue.area, CATEGORY_LABEL[issue.category], contextSummary(issue.context)].join(" ").toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  }

  function renderIssueList() {
    const list = dialog.querySelector("[data-dev-issue-list]");
    if (!list) return;
    const filtered = state.issues.filter(issueMatchesFilters);
    if (!filtered.length) {
      list.innerHTML = '<div class="devtracker-empty"><strong>No matching observations.</strong><span>Add one above while the problem is fresh.</span></div>';
      return;
    }
    list.innerHTML = filtered.map(issue => `
      <article class="devtracker-issue-card blocker-${escapeHTML(issue.blocker)} status-${escapeHTML(issue.status)}" data-dev-issue="${escapeHTML(issue.id)}">
        <header><div><span class="devtracker-id">${escapeHTML(issue.id)}</span><strong>${escapeHTML(issue.area)}</strong></div><div class="devtracker-chip-row"><span>${escapeHTML(CATEGORY_LABEL[issue.category])}</span><span>${escapeHTML(BLOCKER_LABEL[issue.blocker])}</span></div></header>
        <p>${escapeHTML(issue.observation)}</p>
        ${issue.expectedBehavior ? `<div class="devtracker-expected"><span>Expected</span>${escapeHTML(issue.expectedBehavior)}</div>` : ""}
        <small>${escapeHTML(contextSummary(issue.context))}</small>
        <footer>
          <select data-dev-status-select aria-label="Status for ${escapeHTML(issue.id)}">${optionHTML(STATUSES, issue.status)}</select>
          <button type="button" class="devtracker-text-button" data-dev-edit>Edit</button>
        </footer>
      </article>`).join("");

    list.querySelectorAll("[data-dev-issue]").forEach(card => {
      const id = card.dataset.devIssue;
      card.querySelector("[data-dev-edit]").addEventListener("click", () => {
        editingIssueId = id;
        const issue = state.issues.find(item => item.id === id);
        capturedContext = clone(issue.context);
        renderIssues();
        dialog.querySelector("[data-dev-issue-form]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      card.querySelector("[data-dev-status-select]").addEventListener("change", event => {
        const issue = state.issues.find(item => item.id === id);
        if (!issue) return;
        issue.status = event.target.value;
        issue.updatedAt = nowISO();
        saveState();
        renderIssues();
        renderHandoff();
      });
    });
  }

  function deleteIssue(id) {
    const issue = state.issues.find(item => item.id === id);
    if (!issue || !confirm(`Delete ${issue.id}? This removes the tracker note only.`)) return;
    state.issues = state.issues.filter(item => item.id !== id);
    editingIssueId = null;
    saveState();
    renderIssues();
    renderHandoff();
  }

  function beginPointMode() {
    if (pointMode) return;
    pointMode = true;
    dialog.close();
    document.body.classList.add("devtracker-pointing");
    pointBanner = document.createElement("div");
    pointBanner.className = "devtracker-point-banner";
    pointBanner.innerHTML = '<strong>🎯 Point to Problem</strong><span>Click the interface element you mean. Press Esc to cancel.</span>';
    document.body.appendChild(pointBanner);
    document.addEventListener("pointermove", onPointMove, true);
    document.addEventListener("click", onPointClick, true);
    document.addEventListener("keydown", onPointKeydown, true);
  }

  function isTrackerElement(element) {
    return element?.closest?.(".devtracker-dialog, .devtracker-open-button, .devtracker-point-banner");
  }

  function onPointMove(event) {
    const target = event.target;
    if (!target || isTrackerElement(target)) return;
    if (pointTarget && pointTarget !== target) pointTarget.classList.remove("devtracker-point-target");
    pointTarget = target;
    pointTarget.classList.add("devtracker-point-target");
  }

  function onPointClick(event) {
    const target = event.target;
    if (!target || isTrackerElement(target)) return;
    event.preventDefault();
    event.stopPropagation();
    capturedContext = captureElementContext(target);
    finishPointMode();
    const summary = dialog.querySelector("[data-dev-context-summary]");
    if (summary) summary.textContent = contextSummary(capturedContext);
    const areaSelect = dialog.querySelector('[name="area"]');
    if (areaSelect) areaSelect.value = inferArea(capturedContext);
    dialog.showModal();
  }

  function onPointKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    finishPointMode();
    dialog.showModal();
  }

  function finishPointMode() {
    pointMode = false;
    document.body.classList.remove("devtracker-pointing");
    pointTarget?.classList.remove("devtracker-point-target");
    pointTarget = null;
    pointBanner?.remove();
    pointBanner = null;
    document.removeEventListener("pointermove", onPointMove, true);
    document.removeEventListener("click", onPointClick, true);
    document.removeEventListener("keydown", onPointKeydown, true);
  }

  function renderDecisions() {
    const panel = dialog.querySelector('[data-dev-panel="decisions"]');
    const existing = editingDecisionId ? state.decisions.find(item => item.id === editingDecisionId) : null;
    panel.innerHTML = `
      <form class="devtracker-decision-form" data-dev-decision-form>
        <div class="devtracker-form-heading"><div><p class="devtracker-kicker">Foundation constitution</p><h3>${existing ? `Edit ${escapeHTML(existing.id)}` : "Record a decision"}</h3></div>${existing ? '<button type="button" class="devtracker-text-button" data-dev-cancel-decision>Cancel edit</button>' : ""}</div>
        <div class="devtracker-form-grid decision-grid">
          <label><span>Area</span><select name="area">${areaOptionHTML(existing?.area || "Other")}</select></label>
          <label><span>Status</span><select name="status"><option value="active" ${existing?.status !== "superseded" ? "selected" : ""}>Active</option><option value="superseded" ${existing?.status === "superseded" ? "selected" : ""}>Superseded</option></select></label>
        </div>
        <label class="devtracker-field"><span>Decision title</span><input name="title" required value="${escapeHTML(existing?.title || "")}" placeholder="e.g. Cohorts own student information" /></label>
        <label class="devtracker-field"><span>Decision</span><textarea name="statement" rows="4" required placeholder="State the rule we agreed on so future changes cannot accidentally contradict it.">${escapeHTML(existing?.statement || "")}</textarea></label>
        <div class="devtracker-form-actions"><button class="devtracker-primary" type="submit">${existing ? "Save Decision" : "Add Decision"}</button>${existing ? '<button type="button" class="devtracker-danger" data-dev-delete-decision>Delete decision</button>' : ""}</div>
      </form>
      <section class="devtracker-list-section"><div class="devtracker-list-heading"><div><p class="devtracker-kicker">Agreed rules</p><h3>Foundation Decisions</h3></div><span>${state.decisions.length} total</span></div><div class="devtracker-decision-list">${decisionListHTML()}</div></section>`;

    panel.querySelector("[data-dev-decision-form]").addEventListener("submit", saveDecisionFromForm);
    panel.querySelector("[data-dev-cancel-decision]")?.addEventListener("click", () => { editingDecisionId = null; renderDecisions(); });
    panel.querySelector("[data-dev-delete-decision]")?.addEventListener("click", () => deleteDecision(editingDecisionId));
    panel.querySelectorAll("[data-dev-edit-decision]").forEach(button => button.addEventListener("click", () => { editingDecisionId = button.dataset.devEditDecision; renderDecisions(); }));
  }

  function decisionListHTML() {
    if (!state.decisions.length) return '<div class="devtracker-empty"><strong>No foundation decisions recorded yet.</strong><span>Use this after we settle a product-model question together.</span></div>';
    return state.decisions.map(item => `
      <article class="devtracker-decision-card ${item.status === "superseded" ? "superseded" : ""}">
        <header><div><span class="devtracker-id">${escapeHTML(item.id)}</span><strong>${escapeHTML(item.title)}</strong></div><span>${escapeHTML(item.area)} · ${escapeHTML(item.status)}</span></header>
        <p>${escapeHTML(item.statement)}</p>
        <button type="button" class="devtracker-text-button" data-dev-edit-decision="${escapeHTML(item.id)}">Edit</button>
      </article>`).join("");
  }

  function saveDecisionFromForm(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = editingDecisionId ? state.decisions.find(item => item.id === editingDecisionId) : null;
    const decision = normalizeDecision({
      id: existing?.id || nextDecisionId(),
      title: data.get("title"),
      statement: data.get("statement"),
      area: data.get("area"),
      status: data.get("status"),
      createdAt: existing?.createdAt || nowISO(),
      updatedAt: nowISO()
    });
    if (!decision.title || !decision.statement) return;
    if (existing) Object.assign(existing, decision);
    else state.decisions.unshift(decision);
    editingDecisionId = null;
    saveState();
    renderDecisions();
    renderIssues();
    renderHandoff();
  }

  function deleteDecision(id) {
    const item = state.decisions.find(row => row.id === id);
    if (!item || !confirm(`Delete ${item.id}?`)) return;
    state.decisions = state.decisions.filter(row => row.id !== id);
    editingDecisionId = null;
    saveState();
    renderDecisions();
    renderIssues();
    renderHandoff();
  }

  function exportPayload() {
    return {
      project: "Teacher HQ",
      purpose: "Foundation stabilization / AI development handoff",
      trackerSchemaVersion: SCHEMA_VERSION,
      siteRelease: SITE_RELEASE,
      exportedAt: nowISO(),
      summary: {
        totalIssues: state.issues.length,
        openIssues: state.issues.filter(item => item.status !== "done").length,
        foundationBlockers: state.issues.filter(item => item.status !== "done" && item.blocker === "yes").length,
        discuss: state.issues.filter(item => item.status !== "done" && item.blocker === "maybe").length,
        activeDecisions: state.decisions.filter(item => item.status === "active").length
      },
      decisions: clone(state.decisions),
      issues: clone(state.issues)
    };
  }

  function markdownPayload(payload) {
    const lines = [
      "# Teacher HQ — Development Handoff",
      "",
      `Exported: ${payload.exportedAt}`,
      `Site release: ${payload.siteRelease}`,
      "",
      "## Summary",
      `- Open observations: ${payload.summary.openIssues}`,
      `- Foundation blockers: ${payload.summary.foundationBlockers}`,
      `- Need discussion: ${payload.summary.discuss}`,
      `- Active decisions: ${payload.summary.activeDecisions}`,
      "",
      "## Foundation Decisions"
    ];
    if (!payload.decisions.length) lines.push("- None recorded.");
    payload.decisions.forEach(item => {
      lines.push("", `### ${item.id} — ${item.title}`, `Area: ${item.area} · Status: ${item.status}`, "", item.statement);
    });
    lines.push("", "## Observations");
    if (!payload.issues.length) lines.push("- None recorded.");
    payload.issues.forEach(item => {
      lines.push("", `### ${item.id} — ${item.area}`, `Type: ${CATEGORY_LABEL[item.category]} · Blocker: ${BLOCKER_LABEL[item.blocker]} · Status: ${STATUS_LABEL[item.status]}`, "", `**Observation:** ${item.observation}`);
      if (item.expectedBehavior) lines.push("", `**Expected behaviour:** ${item.expectedBehavior}`);
      if (item.proposedSolution) lines.push("", `**Proposed solution:** ${item.proposedSolution}`);
      lines.push("", `**Technical context:** ${contextSummary(item.context)}`);
      if (item.context?.cssPath) lines.push(`- CSS path: \`${item.context.cssPath}\``);
      if (item.context?.elementTag) lines.push(`- Element: ${item.context.elementTag}${item.context.elementType ? ` (${item.context.elementType})` : ""}`);
    });
    lines.push("", "---", "Development tracker data is separate from Teacher HQ profile/classroom data.");
    return lines.join("\n");
  }

  function downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    const payload = exportPayload();
    downloadText(JSON.stringify(payload, null, 2), `TeacherHQ_Development_Handoff_${slugDate()}.json`, "application/json");
  }

  function exportMarkdown() {
    const payload = exportPayload();
    downloadText(markdownPayload(payload), `TeacherHQ_Development_Handoff_${slugDate()}.md`, "text/markdown");
  }

  function renderHandoff() {
    const panel = dialog.querySelector('[data-dev-panel="handoff"]');
    const payload = exportPayload();
    panel.innerHTML = `
      <section class="devtracker-handoff-card">
        <p class="devtracker-kicker">One-file continuation</p><h3>Export for ChatGPT</h3>
        <p>Upload the JSON handoff in a future chat. It contains the development observations, technical element references, statuses, and foundation decisions — not Teacher HQ classroom/profile data.</p>
        <div class="devtracker-handoff-stats"><span><strong>${payload.summary.openIssues}</strong> open</span><span><strong>${payload.summary.foundationBlockers}</strong> blockers</span><span><strong>${payload.summary.activeDecisions}</strong> decisions</span></div>
        <div class="devtracker-form-actions"><button type="button" class="devtracker-primary" data-dev-export-json>Export AI Handoff (.json)</button><button type="button" class="devtracker-secondary" data-dev-export-md>Readable Copy (.md)</button></div>
      </section>
      <section class="devtracker-handoff-card">
        <p class="devtracker-kicker">Restore / continue</p><h3>Import a previous handoff</h3>
        <p>Merge keeps local items and updates matching IDs. Replace discards the tracker currently stored in this browser and uses the imported file.</p>
        <div class="devtracker-import-row"><select data-dev-import-mode><option value="merge">Merge with tracker</option><option value="replace">Replace tracker</option></select><input type="file" accept=".json,application/json" data-dev-import-file /></div>
        <button type="button" class="devtracker-secondary" data-dev-import>Import Handoff</button>
        <p class="devtracker-import-status" data-dev-import-status aria-live="polite"></p>
      </section>
      <section class="devtracker-handoff-card danger-zone"><p class="devtracker-kicker">Local tracker only</p><h3>Reset Development Tracker</h3><p>This does not touch Teacher HQ profiles, classes, lessons, curriculum notes, or backups.</p><button type="button" class="devtracker-danger" data-dev-reset>Clear Tracker Data</button></section>`;

    panel.querySelector("[data-dev-export-json]").addEventListener("click", exportJSON);
    panel.querySelector("[data-dev-export-md]").addEventListener("click", exportMarkdown);
    panel.querySelector("[data-dev-import]").addEventListener("click", importHandoff);
    panel.querySelector("[data-dev-reset]").addEventListener("click", resetTracker);
  }

  async function importHandoff() {
    const fileInput = dialog.querySelector("[data-dev-import-file]");
    const mode = dialog.querySelector("[data-dev-import-mode]").value;
    const status = dialog.querySelector("[data-dev-import-status]");
    const file = fileInput.files?.[0];
    if (!file) { status.textContent = "Choose a JSON handoff first."; return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.issues) || !Array.isArray(parsed.decisions)) throw new Error("This is not a Teacher HQ Development Handoff.");
      const imported = normalizeState({
        ...defaultState(),
        issues: parsed.issues,
        decisions: parsed.decisions
      });
      if (mode === "replace") {
        if (!confirm("Replace the development tracker currently stored in this browser? Teacher HQ classroom data will not be changed.")) return;
        state = imported;
      } else {
        const issueMap = new Map(state.issues.map(item => [item.id, item]));
        imported.issues.forEach(item => issueMap.set(item.id, item));
        const decisionMap = new Map(state.decisions.map(item => [item.id, item]));
        imported.decisions.forEach(item => decisionMap.set(item.id, item));
        state = normalizeState({ ...state, issues: [...issueMap.values()], decisions: [...decisionMap.values()] });
      }
      saveState();
      status.textContent = `Imported ${imported.issues.length} observations and ${imported.decisions.length} decisions.`;
      renderIssues(); renderDecisions(); renderHandoff();
    } catch (error) {
      status.textContent = `Import failed: ${error.message}`;
    } finally {
      fileInput.value = "";
    }
  }

  function resetTracker() {
    if (!confirm("Clear every Development Tracker observation and decision from this browser? This cannot be undone unless you exported a handoff.")) return;
    state = defaultState();
    editingIssueId = null;
    editingDecisionId = null;
    saveState();
    renderIssues(); renderDecisions(); renderHandoff();
  }

  createShell();
  window.TeacherHQDevelopmentTracker = {
    open: openTracker,
    exportData: () => clone(exportPayload()),
    storageKey: STORAGE_KEY,
    release: SITE_RELEASE
  };
})();
