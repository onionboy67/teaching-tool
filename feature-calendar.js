/* Teacher HQ — Calendar feature boundary v18 */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  hq.features.register({
    name: "calendar",
    description: "Overview calendar integrations, Daily View and Calendar View connections.",
    owns: ["feature-calendar.js"],
    transitionalLegacyFiles: ["calendar-tools.js", "calendar-page.js", "calendar-page.css"],
    init(ctx) { ctx.events.emit("calendar:module:loaded", { transitional: true }); }
  });
})();
