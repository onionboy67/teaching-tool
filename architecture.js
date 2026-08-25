/* ============================================================
   TEACHER HQ — MODULAR ARCHITECTURE LOADER v18
   One permanent entry point for small, feature-scoped patches.
   Load this AFTER the existing Teacher HQ scripts.
============================================================ */
(() => {
  "use strict";

  const VERSION = "18.0.0";
  const script = document.currentScript;
  const baseURL = script?.src ? new URL(".", script.src) : new URL(".", location.href);
  const cacheKey = `v=${encodeURIComponent(VERSION)}`;

  const files = [
    "hq-core.js",
    "hq-legacy-bridge.js",
    "feature-units.js",
    "feature-trash.js",
    "feature-lessons.js",
    "feature-cohorts.js",
    "feature-classes.js",
    "feature-curriculum.js",
    "feature-calendar.js",
    "feature-backup.js",
    "feature-overview.js"
  ];

  window.TeacherHQArchitecture = window.TeacherHQArchitecture || {};
  window.TeacherHQArchitecture.loaderVersion = VERSION;
  window.TeacherHQArchitecture.baseURL = baseURL.href;

  function loadScript(filename) {
    return new Promise((resolve, reject) => {
      const node = document.createElement("script");
      node.src = `${new URL(filename, baseURL).href}?${cacheKey}`;
      node.async = false;
      node.dataset.teacherHqModule = filename;
      node.addEventListener("load", () => resolve(filename), { once: true });
      node.addEventListener("error", () => reject(new Error(`Could not load ${filename}`)), { once: true });
      document.head.appendChild(node);
    });
  }

  async function boot() {
    try {
      for (const filename of files) await loadScript(filename);
      if (document.readyState === "loading") {
        await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
      }
      const hq = window.TeacherHQArchitecture;
      await hq.boot?.();
      document.documentElement.dataset.teacherHqArchitecture = VERSION;
      console.info(`[Teacher HQ] Modular architecture ${VERSION} ready.`);
    } catch (error) {
      console.error("[Teacher HQ] Architecture loader failed:", error);
      // Existing v17 code keeps running even if this additive layer fails.
    }
  }

  boot();
})();
