/* ============================================================
   TEACHER HQ — TRASH / PROFILE FEATURE MODULE v18
   Extracted from mega-features.js.
   Owns: deleted-user UI and profile soft-delete enhancements.
============================================================ */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  if (!hq?.coreReady) throw new Error("Teacher HQ core must load before feature modules.");
  const $id = id => document.getElementById(id);

  function openDeletedUsers() {
    const entries = window.TeacherHQTrash?.ensureGlobalTrash?.() || [];
    const dialog = document.createElement("dialog");
    dialog.className = "modal large-modal";

    const draw = () => {
      dialog.innerHTML = `<div class="modal-content"><div class="modal-heading"><div><h2>Deleted Users</h2><p class="section-subtitle">Deleted user workspaces remain recoverable for six months unless permanently removed.</p></div><button type="button" class="close-button" data-close>×</button></div><div class="trash-list">${entries.length ? entries.map(entry => `<article class="trash-row"><div class="trash-icon">◉</div><div><strong>${escapeHTML(entry.label)}</strong><span>Deleted user workspace</span></div><div class="trash-actions"><button class="secondary-button" data-restore="${escapeHTML(entry.id)}">Restore</button><button class="danger-text-button" data-delete="${escapeHTML(entry.id)}">Delete Permanently</button></div></article>`).join("") : '<div class="empty-state-card">No deleted users.</div>'}</div></div>`;
      dialog.querySelector("[data-close]").onclick = () => { dialog.close(); dialog.remove(); };
      dialog.querySelectorAll("[data-restore]").forEach(button => {
        button.onclick = () => {
          window.TeacherHQTrash.restore(button.dataset.restore, { global: true });
          location.reload();
        };
      });
      dialog.querySelectorAll("[data-delete]").forEach(button => {
        button.onclick = () => {
          if (confirm("Permanently delete this user workspace? This cannot be undone.")) {
            window.TeacherHQTrash.permanentDelete(button.dataset.delete, { global: true });
            draw();
          }
        };
      });
    };

    draw();
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  function enhanceProfileSelection() {
    const list = $id("profileList");
    if (!list) return;
    [...list.querySelectorAll(":scope > .profile-card")].forEach((card, index) => {
      const user = appData.users[index];
      if (!user || card.parentElement?.classList.contains("profile-card-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "profile-card-wrap";
      card.replaceWith(wrap);
      wrap.appendChild(card);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "profile-delete-button";
      del.title = "Delete user";
      del.textContent = "×";
      del.onclick = event => {
        event.stopPropagation();
        window.TeacherHQTrash?.deleteUser(user.id);
      };
      wrap.appendChild(del);
    });

    const actions = document.querySelector("#userSelectionView .stacked-actions");
    if (actions && !actions.querySelector("[data-deleted-users]") && (window.TeacherHQTrash?.ensureGlobalTrash?.().length || 0)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.dataset.deletedUsers = "";
      button.textContent = "Deleted Users";
      button.onclick = openDeletedUsers;
      actions.appendChild(button);
    }
  }

  function installProfileWrapper() {
    try {
      if (typeof renderProfileSelection === "function" && !renderProfileSelection.__teacherHQTrashV18) {
        const base = renderProfileSelection;
        const wrapped = function() {
          const result = base.apply(this, arguments);
          enhanceProfileSelection();
          return result;
        };
        wrapped.__teacherHQTrashV18 = true;
        renderProfileSelection = wrapped;
      }
    } catch (error) {
      console.warn("Teacher HQ: could not extend profile selection", error);
    }
  }

  const api = { openDeletedUsers, enhanceProfileSelection };

  hq.features.register({
    name: "trash",
    description: "Trash integrations, deleted-user workspace UI and profile soft-delete enhancements.",
    owns: ["feature-trash.js"],
    transitionalLegacyFiles: ["trash.js", "mega-features.js"],
    init(ctx) {
      window.TeacherHQProfileTrash = api;
      installProfileWrapper();
      enhanceProfileSelection();
      ctx.events.emit("trash:module:loaded", { transitional: true });
    }
  });
})();
