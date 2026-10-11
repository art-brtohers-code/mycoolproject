(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GardenWardrobe = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const HATS = Object.freeze([
    { id: "sprout", name: "Little sprout", note: "Every gardener starts somewhere.", metric: "lifetimeCrops", target: 0, goal: "A welcome gift", unit: "crops", tile: 0 },
    { id: "straw", name: "Sunday straw", note: "Made for a long lunch outside.", metric: "lifetimeCrops", target: 10, goal: "Pick 10 crops in total", unit: "crops", tile: 1 },
    { id: "tomato", name: "Tomato beret", note: "Very ripe. Very continental.", metric: "lifetimeCrops", target: 25, goal: "Pick 25 crops in total", unit: "crops", tile: 2 },
    { id: "chef", name: "Yes, chef!", note: "Compliments to the gardener.", metric: "totalOrders", target: 1, goal: "Deliver your first basket", unit: "baskets", tile: 3 },
    { id: "mushroom", name: "Fun guy", note: "A little shade for your greens.", metric: "lifetimeCrops", target: 75, goal: "Pick 75 crops in total", unit: "crops", tile: 4 },
    { id: "beekeeper", name: "Busy bee", note: "The market’s most regular regular.", metric: "totalOrders", target: 10, goal: "Deliver 10 baskets in total", unit: "baskets", tile: 5 },
    { id: "wizard", name: "Garden wizard", note: "A few turns ahead of the rest.", metric: "bestCombo", target: 5, goal: "Reach a ×5 rhythm in one run", unit: "rhythm", tile: 6 },
    { id: "crown", name: "Crop royalty", note: "All hail the head of the cabbage.", metric: "bestScore", target: 100, goal: "Score 100 points in one run", unit: "points", tile: 7 },
  ].map(Object.freeze));
  const safeCount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const unlocked = (data, hat) => safeCount(data[hat.metric]) >= hat.target;
  const earned = (data) => HATS.filter((hat) => unlocked(data, hat));
  const canEquip = (data, id) => id === "none" || HATS.some((hat) => hat.id === id && unlocked(data, hat));
  function progress(data, hat) {
    const value = Math.min(hat.target, safeCount(data[hat.metric]));
    return { value, target: hat.target, percent: hat.target ? value / hat.target * 100 : 100, unlocked: unlocked(data, hat) };
  }
  // Checkpoints count only the new part of a run, including after pause/restart.
  // Cosmetic progress never reads or advances the simulation's random stream.
  function recordProgress(data, run, checkpoint = {}) {
    const before = new Set(earned(data).map((hat) => hat.id));
    const crops = safeCount(run.crops), delivered = safeCount(run.delivered);
    data.lifetimeCrops = Math.min(Number.MAX_SAFE_INTEGER, safeCount(data.lifetimeCrops) + Math.max(0, crops - safeCount(checkpoint.crops)));
    data.totalOrders = Math.min(Number.MAX_SAFE_INTEGER, safeCount(data.totalOrders) + Math.max(0, delivered - safeCount(checkpoint.delivered)));
    data.maxOrders = Math.max(safeCount(data.maxOrders), delivered);
    data.bestCombo = Math.min(5, Math.max(safeCount(data.bestCombo), safeCount(run.bestCombo)));
    data.bestScore = Math.max(safeCount(data.bestScore), safeCount(run.score));
    return { checkpoint: { crops, delivered }, gained: earned(data).filter((hat) => !before.has(hat.id)) };
  }
  return { HATS, unlocked, earned, canEquip, progress, recordProgress };
});
