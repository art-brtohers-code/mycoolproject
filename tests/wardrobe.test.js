"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { HATS, earned, unlocked, canEquip, progress, recordProgress } = require("../wardrobe.js");
const { sanitize, save, load } = require("../storage.js");
const { Game } = require("../engine.js");

test("a new gardener gets a sprout hat; locked hats cannot be equipped", () => {
  const data = sanitize({ settings: { hat: "crown" } });
  assert.deepEqual(earned(data).map((hat) => hat.id), ["sprout"]);
  assert.equal(data.settings.hat, "sprout");
  assert.equal(canEquip(data, "crown"), false);
  assert.equal(canEquip(data, "invented"), false);
  assert.equal(canEquip(data, "none"), true);
});

test("every milestone awards its hat at the exact threshold", () => {
  for (const hat of HATS.filter((hat) => hat.target > 0)) {
    assert.equal(unlocked({ [hat.metric]: hat.target - 1 }, hat), false, hat.id);
    assert.equal(unlocked({ [hat.metric]: hat.target }, hat), true, hat.id);
    assert.equal(progress({ [hat.metric]: hat.target + 20 }, hat).percent, 100, hat.id);
  }
});

test("live crop checkpoints award once and finishing cannot count a crop again", () => {
  const data = sanitize({ lifetimeCrops: 8 });
  let result = recordProgress(data, { crops: 1 });
  assert.equal(data.lifetimeCrops, 9); assert.deepEqual(result.gained, []);
  result = recordProgress(data, { crops: 2 }, result.checkpoint);
  assert.equal(data.lifetimeCrops, 10); assert.deepEqual(result.gained.map((hat) => hat.id), ["straw"]);
  result = recordProgress(data, { crops: 2 }, result.checkpoint);
  assert.equal(data.lifetimeCrops, 10); assert.deepEqual(result.gained, []);
});

test("fresh runs accumulate crops and deliveries while one-run goals use maxima", () => {
  const data = sanitize();
  recordProgress(data, { crops: 12, delivered: 4, bestCombo: 3, score: 40 });
  const result = recordProgress(data, { crops: 13, delivered: 6, bestCombo: 5, score: 70 });
  assert.equal(data.lifetimeCrops, 25); assert.equal(data.totalOrders, 10);
  assert.equal(data.maxOrders, 6); assert.equal(data.bestScore, 70); assert.equal(data.bestCombo, 5);
  assert.deepEqual(result.gained.map((hat) => hat.id), ["tomato", "beekeeper", "wizard"]);
  assert.equal(canEquip(data, "crown"), false, "scores from separate runs cannot earn the crown");
});

test("a golden bonus can earn a score milestone without a crop or basket", () => {
  const data = sanitize({ bestScore: 99 });
  const result = recordProgress(data, { crops: 0, delivered: 0, score: 100 });
  assert.equal(data.lifetimeCrops, 0); assert.equal(data.totalOrders, 0);
  assert.deepEqual(result.gained.map((hat) => hat.id), ["crown"]);
});

test("old saves preserve coats and records and receive matching hats", () => {
  const data = sanitize({ lifetimeCrops: 75, maxOrders: 10, settings: { pattern: "banded" }, records: { "v1:harvest:allotment": 120 } });
  assert.equal(data.settings.pattern, "banded");
  assert.equal(data.totalOrders, 10); assert.equal(data.bestScore, 120);
  assert.deepEqual(earned(data).map((hat) => hat.id), ["sprout", "straw", "tomato", "chef", "mushroom", "beekeeper", "crown"]);
});

test("earned hats and bareheaded preference survive saving and reloading", () => {
  let value;
  const storage = { getItem: () => value ?? null, setItem: (key, item) => { value = item; } };
  for (const hat of HATS) {
    const data = sanitize({ lifetimeCrops: 75, totalOrders: 10, bestCombo: 5, bestScore: 100, settings: { hat: hat.id } });
    assert.equal(save(storage, data), true);
    assert.equal(load(storage).data.settings.hat, hat.id);
    assert.equal(earned(load(storage).data).length, 8);
  }
  assert.equal(save(storage, sanitize({ settings: { hat: "none" } })), true);
  assert.equal(load(storage).data.settings.hat, "none");
});

test("malformed milestone data cannot unlock hats or remove valid old progress", () => {
  const data = sanitize({ totalOrders: -10, maxOrders: 3, bestCombo: Infinity, bestScore: "100", settings: { hat: "wizard" } });
  assert.equal(data.totalOrders, 3); assert.equal(data.bestCombo, 0); assert.equal(data.bestScore, 0);
  assert.equal(data.settings.hat, "sprout");
  assert.equal(canEquip(data, "chef"), true);
});

test("lower later runs preserve previously earned hats", () => {
  const data = sanitize({ lifetimeCrops: 75, totalOrders: 10, bestCombo: 5, bestScore: 100 });
  recordProgress(data, { crops: 0, delivered: 0, bestCombo: 1, score: 1 });
  assert.equal(earned(data).length, 8);
});

test("milestone tracking leaves daily simulation state and randomness unchanged", () => {
  const a = new Game({ mode: "daily", date: "2026-10-10" });
  const b = new Game({ mode: "daily", date: "2026-10-10" });
  a.start(); b.start();
  const data = sanitize(); let checkpoint = {};
  for (let i = 0; i < 50; i++) {
    const direction = ["up", "left", "down", "right"][Math.floor(i / 3) % 4];
    a.steer(direction); b.steer(direction); a.step(); b.step();
    checkpoint = recordProgress(data, a, checkpoint).checkpoint;
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
    if (a.status !== "playing") break;
  }
  assert.equal(a.rng(), b.rng());
});
