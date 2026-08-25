/* Teacher HQ — Backup / Share feature boundary v18 */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  hq.features.register({
    name: "backup",
    description: "Backup, restore, Read View and sharing workflows.",
    owns: ["feature-backup.js"],
    transitionalLegacyFiles: ["app.js", "main-page-redesign.js"],
    init(ctx) { ctx.events.emit("backup:module:loaded", { transitional: true }); }
  });
})();
