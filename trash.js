/* ============================================================
   TEACHER HQ — TRASH / SOFT DELETION
   ------------------------------------------------------------
   User-created records are moved to Trash rather than immediately
   destroyed. Items expire after six months; because Teacher HQ is a
   static client-side app, the expiry purge occurs the next time the app
   is opened after the expiry date.
============================================================ */
(function () {
  "use strict";

  const RETENTION_MS = 183 * 24 * 60 * 60 * 1000; // approximately six months
  const $id = id => document.getElementById(id);
  const clone = value => typeof structuredCloneSafe === "function" ? structuredCloneSafe(value) : JSON.parse(JSON.stringify(value));

  function ensureUserTrash(user) {
    if (!user) return [];
    if (!Array.isArray(user.trash)) user.trash = [];
    return user.trash;
  }

  function ensureGlobalTrash() {
    if (!Array.isArray(appData.globalTrash)) appData.globalTrash = [];
    return appData.globalTrash;
  }

  function expiryFor(deletedAt) {
    return new Date(new Date(deletedAt).getTime() + RETENTION_MS).toISOString();
  }

  function makeEntry(kind, object, restoreMeta = {}, user = getActiveUser()) {
    const deletedAt = new Date().toISOString();
    return {
      id: makeId("trash"),
      kind,
      label: String(object?.name || object?.title || object?.username || object?.customTitle || kind),
      objectId: object?.id || "",
      deletedAt,
      purgeAfter: expiryFor(deletedAt),
      restoreMeta: clone(restoreMeta),
      data: clone(object),
      ownerUserId: user?.id || null
    };
  }

  function softDelete(kind, object, restoreMeta = {}, options = {}) {
    const user = options.user || getActiveUser();
    const entry = makeEntry(kind, object, restoreMeta, user);
    (options.global ? ensureGlobalTrash() : ensureUserTrash(user)).push(entry);
    saveData();
    return entry;
  }

  function collectionFor(user, entry) {
    const meta = entry.restoreMeta || {};
    if (meta.parent === "user.classes") return user.classes ||= [];
    if (meta.parent === "user.units") return user.units ||= [];
    if (meta.parent === "user.resources" || meta.parent === "user.resourceLibrary") return user.resourceLibrary ||= [];
    if (meta.parent === "user.learningModalities") return user.learningModalities ||= [];
    if (meta.parent === "user.indigenousResources") return user.indigenousResources ||= [];
    if (meta.parent === "user.savedContexts") return user.savedContexts ||= [];
    if (meta.parent === "user.calendarExceptions") return user.calendarExceptions ||= [];
    if (meta.parent === "user.terms") return user.terms ||= [];
    if (meta.parent === "user.standaloneLessons") return user.standaloneLessons ||= [];
    const unit = meta.unitId ? (user.units || []).find(item => item.id === meta.unitId) : null;
    if (unit && meta.parent === "unit.assessments") return (unit.workspace ||= {}).assessments ||= [];
    if (unit && meta.parent === "unit.fieldTrips") return (unit.workspace ||= {}).fieldTrips ||= [];
    if (unit && meta.parent === "unit.lessons") return unit.lessons ||= [];
    return null;
  }

  function restore(entryId, options = {}) {
    const user = options.user || getActiveUser();
    const store = options.global ? ensureGlobalTrash() : ensureUserTrash(user);
    const index = store.findIndex(entry => entry.id === entryId);
    if (index < 0) return false;
    const entry = store[index];

    if (options.global && entry.kind === "user") {
      if (!Array.isArray(appData.users)) appData.users = [];
      if (!appData.users.some(item => item.id === entry.data.id)) appData.users.push(clone(entry.data));
      store.splice(index, 1);
      saveData();
      return true;
    }

    const collection = collectionFor(user, entry);
    if (!collection) return false;
    if (!collection.some(item => item.id === entry.data.id)) collection.push(clone(entry.data));

    // Reconnect relationships that were intentionally cleared when an item
    // entered Trash.  This keeps restoration meaningful instead of merely
    // recreating an orphaned record.
    const meta = entry.restoreMeta || {};
    if (entry.kind === "class") {
      (meta.unitIds || []).forEach(unitId => {
        const unit = (user.units || []).find(item => item.id === unitId);
        if (unit) unit.classId = entry.data.id;
      });
      (meta.blockRefs || []).forEach(ref => {
        const term = (user.terms || []).find(item => item.id === ref.termId);
        const version = term?.scheduleVersions?.find(item => item.id === ref.versionId);
        const block = version?.scheduleBlocks?.find(item => item.id === ref.blockId);
        if (block) block.classId = entry.data.id;
      });
    }
    if (entry.kind === "resource") {
      (meta.unitIds || []).forEach(unitId => {
        const unit = (user.units || []).find(item => item.id === unitId);
        if (!unit) return;
        unit.workspace ||= {}; unit.workspace.resourceIds ||= [];
        if (!unit.workspace.resourceIds.includes(entry.data.id)) unit.workspace.resourceIds.push(entry.data.id);
      });
    }
    if (entry.kind === "modality") {
      (meta.unitIds || []).forEach(unitId => {
        const unit = (user.units || []).find(item => item.id === unitId);
        if (!unit) return;
        unit.workspace ||= {}; unit.workspace.learningModalityIds ||= [];
        if (!unit.workspace.learningModalityIds.includes(entry.data.id)) unit.workspace.learningModalityIds.push(entry.data.id);
      });
    }
    if (entry.kind === "indigenousResource") {
      (meta.unitIds || []).forEach(unitId => {
        const unit = (user.units || []).find(item => item.id === unitId);
        if (!unit) return;
        unit.workspace ||= {}; unit.workspace.indigenousVoiceResourceIds ||= [];
        if (!unit.workspace.indigenousVoiceResourceIds.includes(entry.data.id)) unit.workspace.indigenousVoiceResourceIds.push(entry.data.id);
      });
    }

    // Lesson plans are stored outside the lesson allocation itself. Restore the
    // matching plan snapshot if the delete operation captured one.
    if (entry.kind === "lesson" && meta.lessonPlan && meta.unitId) {
      const unit = (user.units || []).find(item => item.id === meta.unitId);
      if (unit) {
        unit.workspace ||= {};
        unit.workspace.lessonPlans ||= {};
        unit.workspace.lessonPlans[entry.data.id] = clone(meta.lessonPlan);
        unit.lessons = (unit.lessons || []).sort((a,b) => (a.dateKey || "").localeCompare(b.dateKey || "") || (a.startTime || "").localeCompare(b.startTime || ""));
        unit.lessons.forEach((lesson, position) => { lesson.sequence = position + 1; lesson.title = `Lesson ${position + 1}`; });
      }
    }
    if (entry.kind === "fieldTrip" && meta.unitId && typeof syncFieldTripOverrides === "function") {
      const unit = (user.units || []).find(item => item.id === meta.unitId);
      if (unit) syncFieldTripOverrides(unit);
    }
    if (entry.kind === "term") user.terms?.sort((a,b) => (a.startDate || "").localeCompare(b.startDate || ""));
    if (entry.kind === "calendarException") user.calendarExceptions?.sort((a,b) => (a.startDate || a.date || "").localeCompare(b.startDate || b.date || ""));

    store.splice(index, 1);
    saveData();
    return true;
  }

  function permanentDelete(entryId, options = {}) {
    const user = options.user || getActiveUser();
    const store = options.global ? ensureGlobalTrash() : ensureUserTrash(user);
    const index = store.findIndex(entry => entry.id === entryId);
    if (index < 0) return false;
    store.splice(index, 1);
    saveData();
    return true;
  }

  function purgeExpired() {
    const now = Date.now();
    let changed = false;
    (appData.users || []).forEach(user => {
      const before = ensureUserTrash(user).length;
      user.trash = user.trash.filter(entry => new Date(entry.purgeAfter || expiryFor(entry.deletedAt)).getTime() > now);
      if (before !== user.trash.length) changed = true;
    });
    const global = ensureGlobalTrash();
    const kept = global.filter(entry => new Date(entry.purgeAfter || expiryFor(entry.deletedAt)).getTime() > now);
    if (kept.length !== global.length) { appData.globalTrash = kept; changed = true; }
    if (changed) saveData();
  }

  function daysRemaining(entry) {
    return Math.max(0, Math.ceil((new Date(entry.purgeAfter || expiryFor(entry.deletedAt)).getTime() - Date.now()) / 86400000));
  }

  function createDialog() {
    let dialog = $id("trashDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "trashDialog";
    dialog.className = "modal extra-large-modal trash-dialog";
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-heading"><div><h2>Trash</h2><p class="section-subtitle">Deleted work remains recoverable for six months unless you permanently delete it.</p></div><button class="close-button" type="button" data-trash-close>×</button></div>
        <div class="trash-toolbar"><span data-trash-count></span><button type="button" class="danger-outline-button" data-trash-empty>Empty Trash</button></div>
        <div data-trash-list class="trash-list"></div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-trash-close]").onclick = () => dialog.close();
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function openTrash() {
    const user = getActiveUser();
    if (!user || readOnlyMode) return;
    purgeExpired();
    const dialog = createDialog();
    renderTrash(dialog, user);
    dialog.showModal();
  }

  function renderTrash(dialog, user) {
    const list = dialog.querySelector("[data-trash-list]");
    const entries = [...ensureUserTrash(user)].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    dialog.querySelector("[data-trash-count]").textContent = `${entries.length} item${entries.length === 1 ? "" : "s"}`;
    list.innerHTML = "";
    if (!entries.length) list.innerHTML = '<div class="empty-state-card"><strong>Trash is empty.</strong><p>Deleted Units, Lessons, Assessments, Resources and other records will appear here.</p></div>';
    entries.forEach(entry => {
      const row = document.createElement("article");
      row.className = "trash-row";
      row.innerHTML = `<div class="trash-icon">${iconFor(entry.kind)}</div><div><strong>${escapeHTML(entry.label)}</strong><span>${escapeHTML(labelFor(entry.kind))} · deleted ${escapeHTML(formatDateTime(entry.deletedAt))}</span><small>Permanently removed in ${daysRemaining(entry)} day${daysRemaining(entry) === 1 ? "" : "s"}</small></div><div class="trash-actions"><button type="button" class="secondary-button" data-restore>Restore</button><button type="button" class="danger-text-button" data-permanent>Delete Permanently</button></div>`;
      row.querySelector("[data-restore]").onclick = () => {
        if (!restore(entry.id, { user })) return alert("Teacher HQ could not determine where this item belongs. It has been left safely in Trash.");
        renderTrash(dialog, user);
        if (typeof renderTeacherHQ === "function") renderTeacherHQ();
      };
      row.querySelector("[data-permanent]").onclick = () => {
        if (!confirm(`Permanently delete “${entry.label}”? This cannot be undone.`)) return;
        permanentDelete(entry.id, { user }); renderTrash(dialog, user);
      };
      list.appendChild(row);
    });
    dialog.querySelector("[data-trash-empty]").onclick = () => {
      if (!entries.length) return;
      if (!confirm(`Permanently delete all ${entries.length} item${entries.length === 1 ? "" : "s"} in Trash? This cannot be undone.`)) return;
      user.trash = []; saveData(); renderTrash(dialog, user);
    };
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "recently" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function labelFor(kind) {
    return ({ unit: "Unit", lesson: "Lesson", assessment: "Assessment", resource: "Resource", fieldTrip: "Field Trip", class: "Class", context: "Context", modality: "Learning Modality", indigenousResource: "Indigenous Resource", calendarException: "Day Off / PD Day", term: "School Term" })[kind] || kind;
  }

  function iconFor(kind) {
    return ({ unit: "▦", lesson: "📝", assessment: "✓", resource: "↗", fieldTrip: "🚌", class: "◉", context: "☰", modality: "◇", indigenousResource: "◆", calendarException: "🌴", term: "▣" })[kind] || "⌫";
  }

  function deleteUser(userId) {
    const user = (appData.users || []).find(item => item.id === userId);
    if (!user) return false;
    const typed = prompt(`Type “${user.username}” to move this entire user workspace to Trash:`);
    if (typed !== user.username) return false;
    ensureGlobalTrash().push(makeEntry("user", user, { parent: "appData.users" }, user));
    appData.users = appData.users.filter(item => item.id !== userId);
    if (appData.activeUserId === userId) appData.activeUserId = null;
    if (activeUserId === userId) activeUserId = null;
    saveData();
    location.reload();
    return true;
  }

  purgeExpired();
  $id("openTrashButton")?.addEventListener("click", openTrash);

  window.TeacherHQTrash = {
    softDelete, restore, permanentDelete, purgeExpired, openTrash, deleteUser,
    ensureUserTrash, ensureGlobalTrash
  };
})();
