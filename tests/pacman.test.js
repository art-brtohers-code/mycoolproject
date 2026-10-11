"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { PacGame, MAP, SIZE, TUNNEL, TICK, RECORD, DIRECTIONS, walkable, neighbor, distances } = require("../pacman-engine.js");
const { sanitize, save, load } = require("../storage.js");
const key = (cell) => cell.y * SIZE + cell.x;
function game() { const g = new PacGame(); g.start(); g.waitMs = 0; return g; }
function parkGhosts(g) { g.ghosts.forEach((ghost) => { ghost.mode = "house"; ghost.releaseAt = Infinity; }); }
function place(a, x, y, direction = "left") { Object.assign(a, { x, y, cell: { x, y }, from: { x, y }, to: { x, y }, direction, progress: 1 }); }
function ticks(g, count) { for (let i = 0; i < count; i++) g.step(); }

test("the authored maze is symmetric, bounded, and every pellet and tunnel is reachable", () => {
  assert.equal(MAP.length, SIZE);
  for (const row of MAP) { assert.equal(row.length, SIZE); assert.equal(row, [...row].reverse().join("")); }
  const g = game(), reached = new Set([key(g.player.cell)]), queue = [g.player.cell];
  for (let i = 0; i < queue.length; i++) for (const direction of Object.keys(DIRECTIONS)) {
    const next = neighbor(queue[i], direction);
    if (next && !reached.has(key(next))) { reached.add(key(next)); queue.push(next); }
  }
  for (const id of g.pellets.keys()) assert.ok(reached.has(id), `Unreachable pellet ${id}`);
  assert.ok(reached.has(TUNNEL * SIZE)); assert.ok(reached.has(TUNNEL * SIZE + SIZE - 1));
  assert.equal([...g.pellets.values()].filter((kind) => kind === "power").length, 4);
  assert.equal(walkable({ x: 11, y: 11 }), false); assert.equal(walkable({ x: 11, y: 11 }, true), true);
});

test("movement is continuous, scores each pellet once, and stops at walls", () => {
  const g = game(); parkGhosts(g); place(g.player, 1, 3, "up"); g.wanted = "up";
  g.step(); assert.ok(g.player.y < 3 && g.player.y > 2); assert.equal(g.score, 0);
  ticks(g, 8); assert.equal(g.player.y, 2); assert.equal(g.score, 10);
  ticks(g, 9); assert.equal(g.player.y, 1); assert.equal(g.score, 60);
  ticks(g, 20); assert.equal(g.player.y, 1); assert.equal(g.score, 60);
});

test("an early turn stays buffered until the next legal junction", () => {
  const g = game(); parkGhosts(g); place(g.player, 6, 3, "right"); g.wanted = "right";
  g.step(); g.steer("down"); ticks(g, 8);
  assert.deepEqual(g.player.cell, { x: 7, y: 3 });
  assert.equal(g.playerChoice(), "right", "down is blocked at x7; continue to the next open turn");
  ticks(g, 27);
  assert.deepEqual(g.player.cell, { x: 9, y: 4 });
});

test("opposite directions are legal and the side tunnel wraps both ways", () => {
  const g = game(); parkGhosts(g); place(g.player, 0, TUNNEL, "left"); g.wanted = "left";
  ticks(g, 9); assert.deepEqual(g.player.cell, { x: SIZE - 1, y: TUNNEL });
  g.steer("right"); ticks(g, 9); assert.deepEqual(g.player.cell, { x: 0, y: TUNNEL });
  assert.equal(neighbor({ x: 0, y: 1 }, "left"), null);
});

test("power pellets score 50 and reset the capture chain and timer", () => {
  const g = game(); parkGhosts(g); place(g.player, 1, 2, "up"); g.wanted = "up"; g.captureChain = 3;
  ticks(g, 9);
  assert.equal(g.score, 50); assert.equal(g.powerMs, g.powerDuration); assert.equal(g.captureChain, 0);
  assert.equal(g.drain().filter((event) => event.type === "power").length, 1);
});

test("edible ghosts award 200/400/800/1600 once and return as harmless eyes", () => {
  const g = game(); g.powerMs = 7000;
  for (const ghost of g.ghosts) { place(ghost, g.player.x, g.player.y); ghost.mode = "roam"; }
  g.checkCollisions();
  assert.equal(g.score, 3000); assert.equal(g.ghostsEaten, 4); assert.equal(g.lives, 3);
  assert.ok(g.ghosts.every((ghost) => ghost.mode === "eyes"));
  g.checkCollisions(); assert.equal(g.score, 3000);
  assert.deepEqual(g.drain().filter((event) => event.type === "capture").map((event) => event.points), [200, 400, 800, 1600]);
});

test("a dangerous collision costs exactly one life and preserves the harvest", () => {
  const g = game(); g.score = 200; g.pellets.delete(24);
  place(g.ghosts[0], g.player.x, g.player.y); g.ghosts[0].mode = "roam";
  assert.equal(g.checkCollisions(), true); assert.equal(g.lives, 2); assert.equal(g.score, 200);
  assert.equal(g.pellets.has(24), false); assert.equal(g.intermission, "life");
  assert.equal(g.checkCollisions(), false, "reset ghosts cannot take a second life during the break");
});

test("the final life ends the game once and further ticks are frozen", () => {
  const g = game(); g.lives = 1; place(g.ghosts[0], g.player.x, g.player.y); g.ghosts[0].mode = "roam";
  g.checkCollisions(); assert.equal(g.status, "over"); assert.equal(g.lives, 0);
  const duration = g.duration; ticks(g, 100); assert.equal(g.duration, duration);
  assert.equal(g.drain().filter((event) => event.type === "finish").length, 1);
});

test("collisions also work across the tunnel seam", () => {
  const g = game(); place(g.player, .1, TUNNEL); place(g.ghosts[0], SIZE - .1, TUNNEL); g.ghosts[0].mode = "roam";
  assert.equal(g.checkCollisions(), true); assert.equal(g.lives, 2);
});

test("pause freezes actors, frightened time, fruit, and level transitions", () => {
  const g = game(); g.powerMs = 3000; g.fruit = { x: 11, y: 17, remaining: 9000 }; g.waitMs = 1000; g.intermission = "level";
  g.pause(); const snapshot = JSON.stringify(g); ticks(g, 100);
  assert.equal(JSON.stringify(g), snapshot); assert.equal(g.steer("up"), false);
  g.resume(); g.step(); assert.ok(g.waitMs < 1000); assert.equal(g.powerMs, 3000);
});

test("ghosts leave through the glasshouse gate and normal ghosts cannot return through it", () => {
  const g = game(); place(g.player, 1, 1, "up"); g.wanted = "up"; g.powerMs = 100000;
  ticks(g, 500);
  assert.ok(g.ghosts.some((ghost) => ghost.mode === "roam"));
  const ghost = g.ghosts[0]; place(ghost, 11, 9, "down"); ghost.mode = "roam"; ghost.reverse = true;
  assert.notEqual(g.ghostChoice(ghost), "down");
});

test("eyes find the gate and become waiting ghosts in their own home", () => {
  const g = game(); parkGhosts(g); const ghost = g.ghosts[0];
  place(ghost, 11, 9, "down"); ghost.mode = "eyes";
  let arrived = false;
  for (let i = 0; i < 100; i++) { g.step(); if (ghost.mode === "house") { arrived = true; break; } }
  assert.equal(arrived, true); assert.deepEqual(ghost.cell, ghost.home); assert.ok(ghost.releaseAt > g.levelAge);
});

test("the last pellet awards a single 500-point clear bonus and carries lives/score into the next night", () => {
  const g = game(); parkGhosts(g); g.lives = 2;
  g.pellets = new Map([[17 * SIZE + 10, "dot"]]); g.totalPellets = 1;
  ticks(g, 9); assert.equal(g.score, 510); assert.equal(g.cleared, 1); assert.equal(g.intermission, "level");
  ticks(g, Math.ceil(1900 / TICK) + 2);
  assert.equal(g.level, 2); assert.equal(g.lives, 2); assert.equal(g.score, 510);
  assert.equal(g.pellets.size, new PacGame().pellets.size); assert.ok(g.playerPace < 150);
  assert.equal(g.drain().filter((event) => event.type === "clear").length, 1);
});

test("fruit appears twice per level, expires, and awards its own points", () => {
  const g = game(); parkGhosts(g); g.levelEaten = Math.ceil(g.totalPellets * .35); g.step();
  assert.equal(g.fruit.kind, "cherries"); assert.equal(g.fruitIndex, 1);
  place(g.player, 11, 17); g.eat(); assert.equal(g.score, 100); assert.equal(g.fruit, null);
  g.levelEaten = Math.ceil(g.totalPellets * .7); g.step(); assert.equal(g.fruitIndex, 2);
  g.fruit.remaining = 1; g.step(); assert.equal(g.fruit, null); g.step(); assert.equal(g.fruit, null);
});

test("each 10,000 points awards one extra life before a same-tick collision", () => {
  const g = game(); parkGhosts(g); g.score = 9990;
  ticks(g, 9); assert.equal(g.score, 10000); assert.equal(g.lives, 4); assert.equal(g.extraLifeAt, 20000);
  ticks(g, 9); assert.equal(g.lives, 4);
});

test("frightened power expires and later nights retain playable speeds", () => {
  const g = game(); parkGhosts(g); g.powerMs = TICK / 2; g.step(); assert.equal(g.powerMs, 0);
  g.level = 100; assert.ok(g.playerPace >= 100); assert.ok(g.ghostPace >= 115); assert.ok(g.powerDuration >= 3000);
});

test("Pac-Man records and last-selected game survive saving without unlocking Snake hats", () => {
  let json; const storage = { getItem: (key) => key === "plot-twist-v1" ? json ?? null : null, setItem: (key, value) => { json = value; } };
  const data = sanitize({ settings: { game: "pacman" }, records: { [RECORD]: 12345, "v1:harvest:allotment": 20 } });
  assert.equal(data.bestScore, 20); assert.equal(data.settings.hat, "sprout");
  save(storage, data); assert.deepEqual(load(storage).data, data);
  assert.equal(sanitize({ settings: { game: "bad" } }).settings.game, "snake");
});

test("identical inputs reproduce identical ghost routes and scores", () => {
  const a = game(), b = game();
  for (let i = 0; i < 1000; i++) {
    const name = Object.keys(DIRECTIONS)[Math.floor(i / 35) % 4];
    a.steer(name); b.steer(name); a.step(); b.step();
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});

test("a full sweep clears the real maze without stranding a pellet", () => {
  const g = game(); parkGhosts(g);
  for (let tick = 0; tick < 16000 && !g.cleared; tick++) {
    if (g.player.progress >= 1) {
      const queue = [{ cell: g.player.cell, first: null }], reached = new Set([key(g.player.cell)]);
      let nextTurn;
      for (let i = 0; i < queue.length && !nextTurn; i++) {
        const { cell, first } = queue[i];
        if (first && g.pellets.has(key(cell))) { nextTurn = first; break; }
        for (const direction of Object.keys(DIRECTIONS)) {
          const next = neighbor(cell, direction);
          if (next && !reached.has(key(next))) { reached.add(key(next)); queue.push({ cell: next, first: first || direction }); }
        }
      }
      if (nextTurn) g.steer(nextTurn);
    }
    g.step();
    assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.y));
    assert.ok(walkable(g.player.cell));
  }
  assert.equal(g.cleared, 1); assert.equal(g.pellets.size, 0);
});
