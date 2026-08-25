/* Teacher HQ — Cohorts feature boundary v18 */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  hq.features.register({
    name: "cohorts",
    description: "Cohort dashboards, students/interests, context, curriculum progress, assessments and Attention Grabbers.",
    owns: ["feature-cohorts.js"],
    transitionalLegacyFiles: ["classes.js", "main-page-redesign.css"],
    init(ctx) { ctx.events.emit("cohorts:module:loaded", { transitional: true }); }
  });
})();
