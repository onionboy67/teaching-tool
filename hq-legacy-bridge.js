/* ============================================================
   TEACHER HQ — LEGACY BRIDGE
   Lets new modules use existing v17 functions without copying them.
   This is temporary infrastructure for incremental extraction.
============================================================ */
(() => {
  "use strict";
  const hq = window.TeacherHQArchitecture;
  if (!hq?.coreReady) throw new Error("Teacher HQ core must load before the legacy bridge.");

  function getCallable(name) {
    const value = window[name];
    return typeof value === "function" ? value : null;
  }

  const legacy = {
    has(name) { return Boolean(getCallable(name)); },
    call(name, ...args) {
      const fn = getCallable(name);
      if (!fn) throw new Error(`Legacy Teacher HQ function is unavailable: ${name}`);
      return fn(...args);
    },
    callIfPresent(name, ...args) {
      const fn = getCallable(name);
      return fn ? fn(...args) : undefined;
    }
  };

  hq.services.register("legacy", legacy);
  hq.services.register("dom", hq.dom);

  // Stable commands that are safe to expose when their legacy equivalents exist.
  hq.commands.register("app.render", (...args) => legacy.callIfPresent("renderTeacherHQ", ...args));
  hq.commands.register("data.save", (...args) => legacy.callIfPresent("saveData", ...args));
  hq.commands.register("profile.active", (...args) => legacy.callIfPresent("getActiveUser", ...args));

  hq.events.emit("legacy:bridge:ready", { available: true });
})();
