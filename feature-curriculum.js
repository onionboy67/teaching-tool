/* Teacher HQ — Curriculum feature boundary v18 */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  hq.features.register({
    name: "curriculum",
    description: "Curriculum Browser, progressions, curriculum notes and selection UI. Dataset files are read-only inputs.",
    owns: ["feature-curriculum.js"],
    transitionalLegacyFiles: ["curriculum-browser.js", "data-registry.js", "main-page-redesign.css"],
    init(ctx) { ctx.events.emit("curriculum:module:loaded", { transitional: true }); }
  });
})();
