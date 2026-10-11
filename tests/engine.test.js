"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Game, SIZE, dailyDate, dailyPlot, recordKey, DIRECTIONS } = require("../engine.js");

function game(options = {}) {
  const g = new Game({ seed: "test-garden", ...options });
  g.start(); return g;
}
function snapshot(g) {
  return JSON.stringify({ ...g, rng: undefined });
}
function cycle() {
  const cells = [{ x: 0, y: 0 }];
  for (let x = 0; x < SIZE; x++) {
    if (x % 2 === 0) for (let y = 1; y < SIZE; y++) cells.push({ x, y });
    else for (let y = SIZE - 1; y > 0; y--) cells.push({ x, y });
  }
  for (let x = SIZE - 1; x > 0; x--) cells.push({ x, y: 0 });
  return cells;
}
function nearFull(length = 399) {
  const g = game();
  g.snake = cycle().slice(0, length); g.previous = g.snake.map((p) => ({ ...p }));
  g.foods = []; g.rocks = []; g.warnings = []; g.bonus = null; g.direction = "right";
  return g;
}

test("two buffered turns register in order; reversals and duplicate inputs do not", () => {
  const g = game(); g.foods = [];
  assert.equal(g.steer("left"), false);
  assert.equal(g.steer("up"), true);
  assert.equal(g.steer("up"), false);
  assert.equal(g.steer("down"), false);
  assert.equal(g.steer("left"), true);
  assert.equal(g.steer("down"), false);
  g.step(); assert.deepEqual(g.snake[0], { x: 10, y: 15 });
  g.step(); assert.deepEqual(g.snake[0], { x: 9, y: 15 });
});

test("a vacating tail cell is safe when the snake is not growing", () => {
  const g = game();
  g.snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }];
  g.foods = []; g.step();
  assert.equal(g.status, "playing"); assert.deepEqual(g.snake[0], { x: 2, y: 1 });
});

test("growth preserves the tail, so growing into it is a collision", () => {
  const g = game();
  g.snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }];
  g.foods = [{ x: 2, y: 1, kind: "carrot" }]; g.step();
  assert.equal(g.status, "over"); assert.match(g.cause, /own path/);
});

test("walls, stones, and body collisions report the specific cause", () => {
  const wall = game(); wall.snake[0] = { x: 19, y: 16 }; wall.step(); assert.match(wall.cause, /edge/);
  const stone = game(); stone.rocks.push({ x: 11, y: 16 }); stone.step(); assert.match(stone.cause, /stone/);
  const body = game(); body.snake = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]; body.step(); assert.match(body.cause, /own path/);
});

test("harvest starts with three distinct crops and an available order requirement", () => {
  for (let i = 0; i < 40; i++) {
    const g = game({ seed: `harvest-${i}` });
    assert.equal(g.foods.length, 3);
    assert.equal(new Set(g.foods.map((f) => `${f.x},${f.y}`)).size, 3);
    assert.ok(g.foods.some((f) => g.isNeeded(f.kind)));
  }
});

test("an order gives its bonus once and supplies a crop for the next ticket", () => {
  const g = game();
  g.order = { number: 1, bonus: 10, items: [{ kind: "carrot", needed: 2, collected: 1 }, { kind: "tomato", needed: 1, collected: 1 }] };
  g.foods = [{ x: 11, y: 16, kind: "carrot" }];
  g.step();
  assert.equal(g.score, 11); assert.equal(g.delivered, 1); assert.equal(g.snake.length, 6);
  assert.equal(g.order.number, 2); assert.equal(g.drain().filter((e) => e.type === "delivery").length, 1);
  assert.ok(g.foods.some((f) => g.isNeeded(f.kind)));
});

test("unrequested crops grow the snake without advancing an order", () => {
  const g = game();
  g.order = { number: 1, bonus: 10, items: [{ kind: "carrot", needed: 2, collected: 0 }, { kind: "tomato", needed: 1, collected: 0 }] };
  g.foods = [{ x: 11, y: 16, kind: "radish" }]; g.step();
  assert.equal(g.crops, 1); assert.equal(g.score, 1); assert.equal(g.order.items[0].collected, 0); assert.equal(g.order.items[1].collected, 0);
});

test("completed requirements stop counting until a new ticket is issued", () => {
  const g = game();
  g.order = { number: 1, bonus: 10, items: [{ kind: "carrot", needed: 2, collected: 2 }, { kind: "tomato", needed: 1, collected: 0 }] };
  g.foods = [{ x: 11, y: 16, kind: "carrot" }]; g.step();
  assert.equal(g.order.items[0].collected, 2); assert.equal(g.delivered, 0);
});

test("combos cap at five and reset when their simulation window expires", () => {
  const g = game({ mode: "endless" }); g.combo = 5; g.comboLeft = 5;
  g.foods = [{ x: 11, y: 16, kind: "carrot" }]; g.step();
  assert.equal(g.combo, 5); assert.equal(g.score, 5);
  g.comboLeft = 1; g.foods = [{ x: 12, y: 16, kind: "carrot" }]; g.step();
  assert.equal(g.combo, 1); assert.equal(g.score, 6);
});

test("golden crops award five points without growing the snake", () => {
  const g = game(); g.foods = []; g.bonus = { x: 11, y: 16, remaining: 65, total: 65 };
  const length = g.snake.length; g.step();
  assert.equal(g.score, 5); assert.equal(g.snake.length, length); assert.equal(g.bonus, null);
});

test("pause freezes the complete simulation, including bonus and combo timers", () => {
  const g = game(); g.bonus = { x: 1, y: 1, remaining: 9, total: 65 }; g.comboLeft = 15; g.steer("up"); g.pause();
  const before = snapshot(g); g.step(); g.steer("left");
  assert.equal(snapshot(g), before); assert.equal(g.turns.length, 0);
  g.resume(); g.step(); assert.equal(g.bonus.remaining, 8);
});

test("practice stays slow, has no obstacles, and still offers orders", () => {
  const g = game({ mode: "practice", plot: "greenhouse" });
  const speed = g.speed; g.crops = 100; g.scheduleRock();
  assert.equal(g.speed, speed); assert.equal(g.rocks.length, 0); assert.equal(g.warnings.length, 0); assert.ok(g.order);
});

test("Endless has one crop and no ticket", () => {
  const g = game({ mode: "endless" }); assert.equal(g.foods.length, 1); assert.equal(g.order, null);
});

test("a warning waits eight moves before becoming a stone", () => {
  const g = game(); g.foods = [];
  g.warnings = [{ x: 1, y: 1, remaining: 8, deferred: 0 }];
  for (let i = 0; i < 7; i++) g.step();
  assert.equal(g.rocks.length, 0); g.step();
  assert.equal(g.rocks.length, 1); assert.equal(g.warnings.length, 0);
});

test("a stone defers rather than activating under the snake", () => {
  const g = game(); g.foods = [];
  g.warnings = [{ x: 11, y: 16, remaining: 1, deferred: 0 }]; g.step();
  assert.equal(g.status, "playing"); assert.equal(g.rocks.length, 0); assert.equal(g.warnings[0].deferred, 1);
});

test("new stones cannot split a plot into disconnected regions", () => {
  const g = game(); g.snake = [{ x: 3, y: 15 }, { x: 2, y: 15 }, { x: 1, y: 15 }]; g.foods = [];
  g.rocks = Array.from({ length: 20 }, (_, y) => ({ x: 10, y })).filter((p) => p.y !== 10);
  assert.equal(g.canPlaceRock({ x: 10, y: 10 }), false);
});

test("all three authored plots are connected and pickups are reachable", () => {
  for (const plot of ["allotment", "orchard", "greenhouse"]) {
    const g = game({ plot });
    assert.equal(g.reachable(null, false).size, SIZE * SIZE - g.rocks.length);
    for (const crop of g.foods) assert.ok(g.reachable().has(crop.y * SIZE + crop.x));
  }
});

test("food count contracts to the available space near a full field", () => {
  const g = nearFull(398); g.fillFood(); assert.equal(g.foods.length, 2);
  assert.ok(g.foods.some((f) => g.isNeeded(f.kind)));
});

test("filling the final playable cell wins immediately", () => {
  const g = nearFull(); g.foods = [{ x: 1, y: 0, kind: "carrot" }]; g.step();
  assert.equal(g.status, "won"); assert.equal(g.snake.length, 400); assert.equal(g.foods.length, 0);
  assert.equal(g.drain().filter((e) => e.type === "finish").length, 1);
  g.step(); assert.equal(g.drain().length, 0);
});

test("a stone cannot consume the last growable cell", () => {
  const g = nearFull(); assert.equal(g.canPlaceRock({ x: 1, y: 0 }), false);
});

test("daily layout and seed ignore non-daily options and use the pinned UTC date", () => {
  const a = game({ mode: "daily", date: "2026-10-09", seed: "a", plot: "orchard" });
  const b = game({ mode: "daily", date: "2026-10-09", seed: "b", plot: "greenhouse" });
  assert.equal(snapshot(a), snapshot(b)); assert.equal(a.plot, dailyPlot(a.date));
  assert.equal(dailyDate(new Date("2026-10-10T01:30:00+03:00")), "2026-10-09");
  assert.notEqual(a.seed, game({ mode: "daily", date: "2026-10-10" }).seed);
});

test("same seed and turns reproduce a run despite unrelated random calls", () => {
  const a = game({ mode: "daily", date: "2026-10-09" });
  const b = game({ mode: "daily", date: "2026-10-09" });
  for (let i = 0; i < 200; i++) {
    const name = ["up", "left", "down", "right"][Math.floor(i / 4) % 4];
    a.steer(name); a.step();
    for (let j = 0; j < 10; j++) Math.random();
    b.steer(name); b.step();
    assert.equal(snapshot(a), snapshot(b));
    if (a.status !== "playing") break;
  }
});

test("records are isolated by mode, plot, and daily date", () => {
  const keys = [recordKey("harvest", "allotment"), recordKey("harvest", "orchard"), recordKey("endless", "allotment"), recordKey("daily", "allotment", "2026-10-09"), recordKey("daily", "orchard", "2026-10-10")];
  assert.equal(new Set(keys).size, keys.length);
});

test("spawns stay separate and on the board across a long seeded harvest", () => {
  // A conservative controller follows the Hamiltonian perimeter of the entire field.
  const path = cycle(); const g = game({ mode: "practice", seed: "long-harvest" });
  g.snake = [path[4], path[3], path[2], path[1], path[0]];
  g.previous = g.snake.map((p) => ({ ...p })); g.direction = "down"; g.foods = []; g.fillFood();
  let position = 4;
  for (let i = 0; i < 3500 && g.status === "playing"; i++) {
    const target = path[(position + 1) % path.length];
    const head = g.snake[0];
    const direction = Object.keys(DIRECTIONS).find((name) => DIRECTIONS[name].x === target.x - head.x && DIRECTIONS[name].y === target.y - head.y);
    g.steer(direction); g.step(); g.drain(); position = (position + 1) % path.length;
    assert.notEqual(g.status, "over");
    const objects = [...g.snake, ...g.rocks, ...g.foods, ...(g.bonus ? [g.bonus] : [])];
    assert.equal(new Set(objects.map((p) => p.y * SIZE + p.x)).size, objects.length);
    assert.ok(objects.every((p) => p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE));
    assert.ok(g.foods.some((f) => g.isNeeded(f.kind)) || g.status === "won");
  }
  assert.ok(g.crops > 15); assert.ok(g.delivered > 0);
});
