/* ============================================================
   TEACHER HQ — OVERVIEW FEATURE MODULE v18
   Owns cross-feature dashboard refresh orchestration.
   Main navigation wiring remains in main-page-redesign.js for now.
============================================================ */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  if (!hq?.coreReady) throw new Error("Teacher HQ core must load before feature modules.");

  function afterDashboardRender() {
    window.TeacherHQClasses?.refresh?.();
    window.TeacherHQTrash?.purgeExpired?.();
    window.TeacherHQUnits?.enhanceUnitDeleteButton?.();
  }

  function installDashboardWrapper() {
    try {
      if (typeof renderTeacherHQ === "function" && !renderTeacherHQ.__teacherHQOverviewV18) {
        const base = renderTeacherHQ;
        const wrapped = function() {
          const result = base.apply(this, arguments);
          afterDashboardRender();
          return result;
        };
        wrapped.__teacherHQOverviewV18 = true;
        renderTeacherHQ = wrapped;
      }
    } catch (error) {
      console.warn("Teacher HQ: could not extend dashboard renderer", error);
    }
  }

  hq.features.register({
    name: "overview",
    dependencies: ["units", "trash", "classes"],
    description: "Teacher HQ overview orchestration and cross-feature post-render refreshes.",
    owns: ["feature-overview.js"],
    transitionalLegacyFiles: ["main-page-redesign.js", "main-page-redesign.css", "calendar-tools.js", "mega-features.js"],
    init(ctx) {
      installDashboardWrapper();
      afterDashboardRender();
      ctx.events.emit("overview:module:loaded", { transitional: true });
    }
  });
})();
