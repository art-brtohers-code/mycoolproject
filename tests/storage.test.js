"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { KEY, sanitize, load, save } = require("../storage.js");
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("missing, malformed and blocked storage leave the game usable", () => {
  assert.equal(load(memory()).data.settings.mode, "harvest");
  assert.equal(load(memory({ [KEY]: "broken json" })).data.lifetimeCrops, 0);
  assert.equal(load(null).available, false);
  assert.equal(save({ setItem() { throw new Error("quota"); } }, sanitize()), false);
});
test("invalid settings, scores and locked cosmetics are sanitized", () => {
  const data = sanitize({ settings: { volume: Infinity, mode: "fake", pattern: "banded" }, lifetimeCrops: -5, records: { "v1:harvest:allotment": -2, "v1:daily:2026-10-09": 30, junk: 500 } });
  assert.equal(data.settings.volume, 35); assert.equal(data.settings.mode, "harvest"); assert.equal(data.settings.pattern, "ribbon");
  assert.equal(data.lifetimeCrops, 0); assert.deepEqual(data.records, { "v1:daily:2026-10-09": 30 });
});
test("legacy best and mute are preserved without contaminating new records", () => {
  const { data } = load(memory({ "snake-farm-best": "123", "snake-farm-muted": "1" }));
  assert.equal(data.legacyBest, 123); assert.equal(data.settings.muted, true); assert.deepEqual(data.records, {});
});
test("settings, earned patterns, and records round-trip", () => {
  const storage = memory();
  const data = sanitize({ settings: { mode: "daily", pattern: "banded", grid: false, volume: 60 }, maxOrders: 5, lifetimeCrops: 31, records: { "v1:harvest:orchard": 58 } });
  assert.equal(save(storage, data), true); assert.deepEqual(load(storage).data, data);
});
test("old daily records are bounded while ordinary best scores remain", () => {
  const records = { "v1:harvest:allotment": 250 };
  for (let i = 1; i <= 31; i++) records[`v1:daily:2026-10-${String(i).padStart(2, "0")}`] = i;
  const result = sanitize({ records });
  assert.equal(Object.keys(result.records).length, 31); assert.equal(result.records["v1:daily:2026-10-01"], undefined);
  assert.equal(result.records["v1:harvest:allotment"], 250);
});
