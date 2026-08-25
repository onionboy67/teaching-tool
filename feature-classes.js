/* Teacher HQ — Classes feature boundary v18 */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  hq.features.register({
    name: "classes",
    dependencies: ["cohorts"],
    description: "Class setup, grade/subject membership and Cohort-to-Class relationships.",
    owns: ["feature-classes.js"],
    transitionalLegacyFiles: ["classes.js"],
    init(ctx) { ctx.events.emit("classes:module:loaded", { transitional: true }); }
  });
})();
