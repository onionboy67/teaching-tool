/* ============================================================
   TEACHER HQ — CORE CONTRACT
   Stable event, service, command, feature and style registries.
============================================================ */
(() => {
  "use strict";

  const hq = window.TeacherHQArchitecture = window.TeacherHQArchitecture || {};
  if (hq.coreReady) return;

  const listeners = new Map();
  const services = new Map();
  const commands = new Map();
  const features = new Map();
  const initialized = new Set();
  const styleNodes = new Map();

  function assertName(name, kind) {
    if (!name || typeof name !== "string") throw new TypeError(`${kind} name must be a non-empty string.`);
  }

  hq.events = {
    on(name, handler) {
      assertName(name, "Event");
      if (typeof handler !== "function") throw new TypeError("Event handler must be a function.");
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
      return () => this.off(name, handler);
    },
    once(name, handler) {
      const remove = this.on(name, payload => {
        remove();
        handler(payload);
      });
      return remove;
    },
    off(name, handler) {
      listeners.get(name)?.delete(handler);
    },
    emit(name, payload) {
      (listeners.get(name) || []).forEach(handler => {
        try { handler(payload); }
        catch (error) { console.error(`[Teacher HQ] Event ${name} failed:`, error); }
      });
    }
  };

  hq.services = {
    register(name, service, { replace = false } = {}) {
      assertName(name, "Service");
      if (services.has(name) && !replace) throw new Error(`Service already registered: ${name}`);
      services.set(name, service);
      return service;
    },
    get(name) { return services.get(name); },
    has(name) { return services.has(name); },
    list() { return [...services.keys()]; }
  };

  hq.commands = {
    register(name, handler, { replace = false } = {}) {
      assertName(name, "Command");
      if (typeof handler !== "function") throw new TypeError("Command handler must be a function.");
      if (commands.has(name) && !replace) throw new Error(`Command already registered: ${name}`);
      commands.set(name, handler);
      return handler;
    },
    has(name) { return commands.has(name); },
    async run(name, ...args) {
      const handler = commands.get(name);
      if (!handler) throw new Error(`Unknown Teacher HQ command: ${name}`);
      return handler(...args);
    },
    list() { return [...commands.keys()]; }
  };

  hq.styles = {
    replace(name, cssText = "") {
      assertName(name, "Style");
      let node = styleNodes.get(name) || document.querySelector(`style[data-teacher-hq-style="${CSS.escape(name)}"]`);
      if (!node) {
        node = document.createElement("style");
        node.dataset.teacherHqStyle = name;
        document.head.appendChild(node);
        styleNodes.set(name, node);
      }
      node.textContent = String(cssText || "");
      return node;
    },
    remove(name) {
      const node = styleNodes.get(name);
      node?.remove();
      styleNodes.delete(name);
    }
  };

  hq.features = {
    register(definition) {
      if (!definition || typeof definition !== "object") throw new TypeError("Feature definition must be an object.");
      const name = definition.name;
      assertName(name, "Feature");
      if (features.has(name)) throw new Error(`Feature already registered: ${name}`);
      features.set(name, Object.freeze({
        dependencies: [],
        owns: [],
        transitionalLegacyFiles: [],
        ...definition,
        name
      }));
      return features.get(name);
    },
    get(name) { return features.get(name); },
    list() { return [...features.values()]; },
    async init(name) {
      if (initialized.has(name)) return;
      const feature = features.get(name);
      if (!feature) throw new Error(`Unknown Teacher HQ feature: ${name}`);
      for (const dependency of feature.dependencies || []) await this.init(dependency);
      if (typeof feature.init === "function") await feature.init(hq);
      initialized.add(name);
      hq.events.emit(`feature:${name}:ready`, { feature });
    },
    isInitialized(name) { return initialized.has(name); }
  };

  hq.dom = {
    byId(id) { return document.getElementById(id); },
    one(selector, root = document) { return root.querySelector(selector); },
    all(selector, root = document) { return [...root.querySelectorAll(selector)]; }
  };

  hq.util = {
    clone(value) {
      if (typeof structuredClone === "function") return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    },
    makeId(prefix = "item") {
      if (window.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
  };

  hq.boot = async function boot() {
    if (hq.booted) return;
    for (const feature of hq.features.list()) await hq.features.init(feature.name);
    hq.booted = true;
    hq.events.emit("hq:ready", { version: hq.loaderVersion || "unknown" });
  };

  hq.debug = {
    summary() {
      return {
        version: hq.loaderVersion || "unknown",
        features: hq.features.list().map(feature => ({
          name: feature.name,
          initialized: hq.features.isInitialized(feature.name),
          owns: feature.owns,
          transitionalLegacyFiles: feature.transitionalLegacyFiles
        })),
        services: hq.services.list(),
        commands: hq.commands.list()
      };
    }
  };

  hq.coreReady = true;
})();
