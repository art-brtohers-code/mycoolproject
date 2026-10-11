(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./wardrobe.js") : root.GardenWardrobe);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GardenStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Wardrobe) {
  "use strict";
  const KEY = "plot-twist-v1";
  const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const validRecord = /^v\d+:(?:(?:harvest|endless):(allotment|orchard|greenhouse)|daily:\d{4}-\d{2}-\d{2}|pacman:moon-garden)$/;

  function sanitize(raw = {}, defaults = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    const input = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    const settings = {
      volume: typeof input.volume === "number" && Number.isFinite(input.volume) ? Math.max(0, Math.min(100, input.volume)) : 35,
      muted: typeof input.muted === "boolean" ? input.muted : !!defaults.muted,
      grid: typeof input.grid === "boolean" ? input.grid : true,
      gentle: typeof input.gentle === "boolean" ? input.gentle : !!defaults.gentle,
      controls: typeof input.controls === "boolean" ? input.controls : !!defaults.controls,
      game: input.game === "pacman" ? "pacman" : "snake",
      mode: ["harvest", "endless", "practice", "daily"].includes(input.mode) ? input.mode : "harvest",
      plot: ["allotment", "orchard", "greenhouse"].includes(input.plot) ? input.plot : "allotment",
      pattern: "ribbon",
      hat: "sprout",
    };
    const lifetimeCrops = count(raw.lifetimeCrops);
    const maxOrders = count(raw.maxOrders);
    if (input.pattern === "speckled" && lifetimeCrops >= 25) settings.pattern = "speckled";
    if (input.pattern === "banded" && maxOrders >= 5) settings.pattern = "banded";
    const records = {};
    if (raw.records && typeof raw.records === "object") {
      const entries = Object.entries(raw.records).filter(([key, value]) => validRecord.test(key) && count(value) === value);
      const daily = entries.filter(([key]) => key.includes(":daily:")).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30);
      for (const [key, value] of [...entries.filter(([key]) => !key.includes(":daily:")), ...daily]) records[key] = value;
    }
    const result = { version: 1, settings, records, lifetimeCrops, maxOrders,
      totalOrders: Math.max(count(raw.totalOrders), maxOrders),
      bestCombo: Math.min(5, count(raw.bestCombo)),
      bestScore: Math.max(count(raw.bestScore), 0, ...Object.entries(records).filter(([key]) => !key.includes(":pacman:")).map(([, score]) => score)),
      legacyBest: count(raw.legacyBest) || count(defaults.legacyBest) };
    if (Wardrobe.canEquip(result, input.hat)) settings.hat = input.hat;
    return result;
  }

  function load(storage, defaults = {}) {
    try {
      defaults = { ...defaults, muted: storage.getItem("snake-farm-muted") === "1", legacyBest: Number(storage.getItem("snake-farm-best")) || 0 };
      return { data: sanitize(JSON.parse(storage.getItem(KEY) || "{}"), defaults), available: true };
    } catch { return { data: sanitize({}, defaults), available: false }; }
  }

  function save(storage, data) {
    try { storage.setItem(KEY, JSON.stringify(sanitize(data))); return true; } catch { return false; }
  }
  return { KEY, sanitize, load, save };
});
