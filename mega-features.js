/* ============================================================
   TEACHER HQ — LEGACY MEGA-FEATURES COMPATIBILITY SHIM v18
   The former catch-all implementation has been extracted into
   feature-units.js, feature-lessons.js, feature-trash.js and
   feature-overview.js. Keep this filename temporarily so older
   callers do not break while the architecture is migrated.
============================================================ */
(() => {
  "use strict";

  function invoke(namespace, method, ...args) {
    const api = window[namespace];
    const fn = api?.[method];
    if (typeof fn !== "function") {
      console.warn(`[Teacher HQ] ${namespace}.${method} is not ready yet.`);
      return undefined;
    }
    return fn(...args);
  }

  window.TeacherHQPlanning = {
    ...(window.TeacherHQPlanning || {}),
    shiftLessonsAfterFieldTrip: (...args) => invoke("TeacherHQUnits", "shiftLessonsAfterFieldTrip", ...args)
  };

  window.TeacherHQMega = {
    openLessonHub: (...args) => invoke("TeacherHQLessons", "openLessonHub", ...args),
    openStandaloneLesson: initialDate => invoke("TeacherHQLessons", "openStandaloneLesson", initialDate || ""),
    openContextLibrary: (...args) => invoke("TeacherHQLessons", "openContextLibrary", ...args),
    shiftLessonsAfterFieldTrip: (...args) => invoke("TeacherHQUnits", "shiftLessonsAfterFieldTrip", ...args),
    renderUnitProgressions: (...args) => invoke("TeacherHQUnits", "renderUnitProgressions", ...args),
    attachStandalonePrompt: (...args) => invoke("TeacherHQLessons", "attachStandalonePrompt", ...args),
    version: "v18-modular"
  };
})();
