/* ============================================================
   TEACHER HQ — MAIN PAGE INTERACTION LAYER
   ------------------------------------------------------------
   Keeps Overview navigation wiring separate from core scheduling code.
============================================================ */
(function () {
  "use strict";
  const $id = id => document.getElementById(id);

  $id("openCohortsNavButton")?.addEventListener("click", () => window.TeacherHQClasses?.openManager?.("cohorts"));
  $id("quickAddLessonButton")?.addEventListener("click", () => window.TeacherHQMega?.openStandaloneLesson?.(""));
  $id("openBackupShareNavButton")?.addEventListener("click", () => {
    const section = $id("backupShareSection");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    section.classList.remove("hq-focus-flash");
    requestAnimationFrame(() => section.classList.add("hq-focus-flash"));
    setTimeout(() => section.classList.remove("hq-focus-flash"), 1300);
  });
})();
