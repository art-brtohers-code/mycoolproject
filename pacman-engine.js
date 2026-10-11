(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MoonGarden = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SIZE = 23, TUNNEL = 11, TICK = 1000 / 60;
  const RECORD = "v1:pacman:moon-garden";
  // A deliberately drawn, mirrored garden. Every pellet belongs to one
  // connected network of loops; h is the glasshouse and - is its one-way gate.
  const MAP = Object.freeze([
    "#######################",
    "#o.........#.........o#",
    "#.###.###.###.###.###.#",
    "#...#.............#...#",
    "###.#.###.###.###.#.###",
    "#...#...#.....#...#...#",
    "#.#####.#.###.#.#####.#",
    "#.....#.........#.....#",
    "#####.#.###.###.#.#####",
    "#.....#.........#.....#",
    "#.###.#.###-###.#.###.#",
    "......#.#hhhhh#.#......",
    "#.###.#.#######.#.###.#",
    "#.....#.........#.....#",
    "###.#.###.###.###.#.###",
    "#...#.............#...#",
    "#.###.###.###.###.###.#",
    "#...#...... ......#...#",
    "#.#.#.###.###.###.#.#.#",
    "#.#...#.........#...#.#",
    "#.#####.#.###.#.#####.#",
    "#o......#.....#......o#",
    "#######################",
  ]);
  const DIRECTIONS = Object.freeze({ up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 } });
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  const GHOSTS = Object.freeze([
    { name: "Pip", color: "#e68c79", corner: { x: 21, y: 1 }, habit: "Follows your footsteps" },
    { name: "Moth", color: "#9ecdb8", corner: { x: 1, y: 1 }, habit: "Waits around the next bend" },
    { name: "Plum", color: "#b6a0d0", corner: { x: 21, y: 21 }, habit: "Takes the scenic route" },
    { name: "Marigold", color: "#e9b86e", corner: { x: 1, y: 21 }, habit: "Brave until you get close" },
  ].map(Object.freeze));
  const key = (cell) => cell.y * SIZE + cell.x;
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const actor = (cell, direction) => ({ x: cell.x, y: cell.y, cell: { ...cell }, from: { ...cell }, to: { ...cell }, progress: 1, direction });
  const copy = (a) => ({ x: a.x, y: a.y });

  function walkable(cell, ghost = false) {
    if (!cell || cell.x < 0 || cell.x >= SIZE || cell.y < 0 || cell.y >= SIZE) return false;
    const tile = MAP[cell.y][cell.x];
    return tile !== "#" && (ghost || (tile !== "h" && tile !== "-"));
  }
  function neighbor(cell, direction, ghost = false) {
    const delta = DIRECTIONS[direction];
    if (!delta) return null;
    const next = { x: cell.x + delta.x, y: cell.y + delta.y };
    if (cell.y === TUNNEL && delta.x) next.x = (next.x + SIZE) % SIZE;
    return walkable(next, ghost) ? next : null;
  }
  function nearestCell(target) {
    let best = null, distance = Infinity;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!walkable({ x, y }, true)) continue;
      const d = Math.abs(x - target.x) + Math.abs(y - target.y);
      if (d < distance) { best = { x, y }; distance = d; }
    }
    return best;
  }
  function distances(target) {
    const cells = new Int16Array(SIZE * SIZE).fill(-1);
    const first = nearestCell(target), queue = [first]; cells[key(first)] = 0;
    for (let i = 0; i < queue.length; i++) {
      for (const direction of Object.keys(DIRECTIONS)) {
        const cell = neighbor(queue[i], direction, true);
        if (cell && cells[key(cell)] === -1) { cells[key(cell)] = cells[key(queue[i])] + 1; queue.push(cell); }
      }
    }
    return cells;
  }

  class PacGame {
    constructor() {
      this.mode = "pacman"; this.status = "ready";
      this.score = 0; this.lives = 3; this.level = 1; this.cleared = 0;
      this.duration = 0; this.ticks = 0; this.eaten = 0; this.ghostsEaten = 0;
      this.events = []; this.cause = ""; this.waitMs = 0; this.intermission = "ready";
      this.extraLifeAt = 10000;
      this.buildLevel(); this.resetActors();
    }
    get speed() { return TICK; }
    get playerPace() { return Math.max(105, 150 - (this.level - 1) * 4); }
    get ghostPace() { return Math.max(120, 195 - (this.level - 1) * 7); }
    get powerDuration() { return Math.max(3500, 7000 - (this.level - 1) * 350); }
    get phase() { return this.levelAge % 27000 < 6500 ? "scatter" : "chase"; }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drain() { return this.events.splice(0); }
    start() { if (this.status === "ready") { this.status = "playing"; this.waitMs = 900; } }
    pause() { if (this.status === "playing") this.status = "paused"; }
    resume() { if (this.status === "paused") this.status = "playing"; }
    finish(status, cause) { this.status = status; this.cause = cause; this.emit("finish", { status, cause }); }
    steer(direction) {
      if (this.status !== "playing" || !DIRECTIONS[direction]) return false;
      this.wanted = direction; return true;
    }
    buildLevel() {
      this.pellets = new Map();
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (MAP[y][x] === "." || MAP[y][x] === "o") this.pellets.set(y * SIZE + x, MAP[y][x] === "o" ? "power" : "dot");
      }
      this.totalPellets = this.pellets.size; this.levelEaten = 0; this.levelAge = 0;
      this.powerMs = 0; this.captureChain = 0; this.fruit = null; this.fruitIndex = 0; this.lastPhase = "scatter";
    }
    resetActors() {
      this.player = actor({ x: 11, y: 17 }, "left"); this.wanted = "left";
      this.ghosts = GHOSTS.map((info, i) => {
        const home = { x: 9 + i, y: 11 };
        return { ...actor(home, "up"), ...info, index: i, home, mode: "house", releaseAt: this.levelAge + 800 + i * 1700, reverse: false };
      });
      this.previous = { player: copy(this.player), ghosts: this.ghosts.map(copy) };
    }
    playerChoice() {
      if (neighbor(this.player.cell, this.wanted)) return this.wanted;
      return neighbor(this.player.cell, this.player.direction) ? this.player.direction : null;
    }
    ghostTarget(ghost) {
      if (ghost.mode === "eyes") return ghost.home;
      if (ghost.mode === "house") return { x: 11, y: 9 };
      if (this.phase === "scatter") return ghost.corner;
      const player = this.player.cell, delta = DIRECTIONS[this.player.direction];
      if (ghost.index === 0) return player;
      if (ghost.index === 1) return { x: player.x + delta.x * 4, y: player.y + delta.y * 4 };
      if (ghost.index === 2) {
        const lead = this.ghosts[0].cell;
        return { x: (player.x + delta.x * 2) * 2 - lead.x, y: (player.y + delta.y * 2) * 2 - lead.y };
      }
      return distances(player)[key(ghost.cell)] < 6 ? ghost.corner : player;
    }
    ghostChoice(ghost) {
      if (ghost.mode === "house" && this.levelAge < ghost.releaseAt) return null;
      let options = Object.keys(DIRECTIONS).filter((name) => {
        const next = neighbor(ghost.cell, name, true);
        return next && (ghost.mode !== "roam" || !"h-".includes(MAP[next.y][next.x]));
      });
      const reverse = OPPOSITE[ghost.direction];
      if (ghost.reverse && options.includes(reverse)) { ghost.reverse = false; return reverse; }
      ghost.reverse = false;
      if (options.length > 1) options = options.filter((name) => name !== reverse);
      const frightened = this.powerMs > 0 && ghost.mode === "roam";
      const field = distances(frightened ? this.player.cell : this.ghostTarget(ghost));
      options.sort((a, b) => {
        const da = field[key(neighbor(ghost.cell, a, true))], db = field[key(neighbor(ghost.cell, b, true))];
        return frightened ? db - da : da - db;
      });
      return options[0] || null;
    }
    advance(a, travel, choose, arrive, ghost = false) {
      while (travel > 1e-8) {
        if (a.progress >= 1) {
          const direction = choose(a);
          if (!direction) break;
          a.direction = direction; a.from = { ...a.cell };
          a.to = neighbor(a.cell, direction, ghost); a.progress = 0;
        }
        const amount = Math.min(travel, 1 - a.progress);
        a.progress += amount; travel -= amount;
        const delta = DIRECTIONS[a.direction];
        a.x = (a.from.x + delta.x * a.progress + SIZE) % SIZE;
        a.y = a.from.y + delta.y * a.progress;
        if (a.progress >= 1 - 1e-8) {
          a.progress = 1; a.cell = { ...a.to }; a.x = a.cell.x; a.y = a.cell.y;
          arrive(a);
          if (this.waitMs > 0 || this.status !== "playing") break;
        }
      }
    }
    eat() {
      const id = key(this.player.cell), pellet = this.pellets.get(id);
      if (pellet) {
        this.pellets.delete(id); this.eaten++; this.levelEaten++;
        const points = pellet === "power" ? 50 : 10; this.score += points;
        this.emit(pellet === "power" ? "power" : "pellet", { points, cell: { ...this.player.cell } });
        if (pellet === "power") {
          this.powerMs = this.powerDuration; this.captureChain = 0;
          this.ghosts.filter((g) => g.mode === "roam").forEach((g) => { g.reverse = true; });
        }
      }
      if (this.fruit && same(this.player.cell, this.fruit)) {
        this.score += this.fruit.points;
        this.emit("fruit", { points: this.fruit.points, kind: this.fruit.kind, cell: { ...this.player.cell } });
        this.fruit = null;
      }
      if (!this.pellets.size) {
        this.cleared++; this.score += 500; this.powerMs = 0; this.fruit = null;
        this.waitMs = 1900; this.intermission = "level";
        this.emit("clear", { level: this.level, points: 500 });
      }
      this.awardExtraLives();
    }
    awardExtraLives() {
      while (this.score >= this.extraLifeAt) {
        this.lives++; this.extraLifeAt += 10000; this.emit("extra-life", { lives: this.lives });
      }
    }
    checkCollisions() {
      for (const ghost of this.ghosts) {
        if (ghost.mode !== "roam") continue;
        let dx = Math.abs(this.player.x - ghost.x);
        if (Math.abs(this.player.y - TUNNEL) < .5 && Math.abs(ghost.y - TUNNEL) < .5) dx = Math.min(dx, SIZE - dx);
        if (Math.hypot(dx, this.player.y - ghost.y) >= .68) continue;
        if (this.powerMs > 0) {
          ghost.mode = "eyes"; ghost.reverse = false;
          const points = 200 * 2 ** Math.min(3, this.captureChain++);
          this.score += points; this.ghostsEaten++;
          this.emit("capture", { points, name: ghost.name, cell: copy(ghost) });
        } else {
          this.lives--; this.powerMs = 0;
          this.emit("life", { lives: this.lives });
          if (!this.lives) this.finish("over", "The garden has closed for the night.");
          else { this.resetActors(); this.waitMs = 1700; this.intermission = "life"; }
          return true;
        }
      }
      return false;
    }
    step() {
      if (this.status !== "playing") return;
      this.duration += TICK; this.ticks++;
      this.previous = { player: copy(this.player), ghosts: this.ghosts.map(copy) };
      if (this.waitMs > 0) {
        this.waitMs = Math.max(0, this.waitMs - TICK);
        if (!this.waitMs && this.intermission === "level") { this.level++; this.buildLevel(); this.resetActors(); this.emit("night", { level: this.level }); }
        return;
      }
      this.levelAge += TICK; this.powerMs = Math.max(0, this.powerMs - TICK);
      if (this.lastPhase !== this.phase) {
        this.lastPhase = this.phase;
        this.ghosts.filter((g) => g.mode === "roam").forEach((g) => { g.reverse = true; });
      }
      if (this.fruit) { this.fruit.remaining -= TICK; if (this.fruit.remaining <= 0) this.fruit = null; }
      if (!this.fruit && this.fruitIndex < 2 && this.levelEaten >= this.totalPellets * [.35, .7][this.fruitIndex]) {
        const kinds = ["cherries", "lemon", "strawberry"], points = [100, 300, 500];
        const index = Math.min(2, this.level - 1);
        this.fruit = { x: 11, y: 17, remaining: 12000, kind: kinds[index], points: points[index] }; this.fruitIndex++;
        this.emit("fruit-ready", { kind: this.fruit.kind });
      }
      this.advance(this.player, TICK / this.playerPace, () => this.playerChoice(), () => this.eat());
      if (this.waitMs > 0 || this.checkCollisions()) return;
      for (const ghost of this.ghosts) {
        const pace = ghost.mode === "eyes" ? 85 : this.ghostPace * (this.powerMs > 0 && ghost.mode === "roam" ? 1.45 : 1);
        this.advance(ghost, TICK / pace, (g) => this.ghostChoice(g), (g) => {
          if (g.mode === "house" && g.cell.y <= 9) g.mode = "roam";
          else if (g.mode === "eyes" && same(g.cell, g.home)) { g.mode = "house"; g.releaseAt = this.levelAge + 1100; }
        }, true);
        if (this.checkCollisions()) return;
      }
      this.awardExtraLives();
    }
  }
  return { PacGame, MAP, SIZE, TUNNEL, TICK, RECORD, DIRECTIONS, GHOSTS, walkable, neighbor, distances };
});
