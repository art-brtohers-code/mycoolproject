(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PlotTwist = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIZE = 20;
  const RULES_VERSION = 1;
  const CROPS = [
    { id: "carrot", name: "Carrot", plural: "carrots", color: "#bd6338" },
    { id: "tomato", name: "Tomato", plural: "tomatoes", color: "#bd4935" },
    { id: "radish", name: "Radish", plural: "radishes", color: "#b04742" },
    { id: "cabbage", name: "Cabbage", plural: "cabbages", color: "#567447" },
    { id: "strawberry", name: "Strawberry", plural: "strawberries", color: "#bd4935" },
    { id: "pumpkin", name: "Pumpkin", plural: "pumpkins", color: "#c79a35" },
  ];
  const MODES = {
    harvest: { name: "Harvest", description: "Fill orders. Find your rhythm.", orders: true, ranked: true, speed: 165 },
    endless: { name: "Endless", description: "One crop. An ever-longer snake.", orders: false, ranked: true, speed: 150 },
    practice: { name: "Practice", description: "A slower pace, with no stones.", orders: true, ranked: false, speed: 230 },
    daily: { name: "Daily plot", description: "One shared plot. A fresh start every day.", orders: true, ranked: true, speed: 165 },
  };
  const PLOTS = {
    allotment: { name: "Allotment", description: "Room to find your feet." },
    orchard: { name: "Orchard", description: "Take the scenic route around the stones." },
    greenhouse: { name: "Greenhouse", description: "Long rows. A few tight turns." },
  };
  const DIRECTIONS = {
    up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
  };
  const key = (p) => p.y * SIZE + p.x;
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const outside = (p) => p.x < 0 || p.y < 0 || p.x >= SIZE || p.y >= SIZE;
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }

  function random(seed) {
    let value = hash(seed);
    return () => {
      value += 0x6d2b79f5;
      let n = Math.imul(value ^ (value >>> 15), 1 | value);
      n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dailyDate(date = new Date()) { return date.toISOString().slice(0, 10); }
  function dailySeed(date) { return `plot-twist-v${RULES_VERSION}:${date}`; }
  function dailyPlot(date) { return Object.keys(PLOTS)[hash(dailySeed(date)) % 3]; }
  function recordKey(mode, plot, date) {
    return mode === "daily" ? `v${RULES_VERSION}:daily:${date}` : `v${RULES_VERSION}:${mode}:${plot}`;
  }

  function layout(plot) {
    const rocks = [];
    if (plot === "orchard") {
      for (const x of [5, 13]) for (const y of [4, 9]) {
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) rocks.push({ x: x + dx, y: y + dy });
      }
    } else if (plot === "greenhouse") {
      for (const x of [5, 14]) for (let y = 3; y <= 11; y++) if (y !== 7) rocks.push({ x, y });
    }
    return rocks;
  }

  class Game {
    constructor(options = {}) {
      this.mode = MODES[options.mode] ? options.mode : "harvest";
      this.date = options.date || dailyDate();
      this.plot = this.mode === "daily" ? dailyPlot(this.date) : this.mode === "practice" ? "allotment" : PLOTS[options.plot] ? options.plot : "allotment";
      this.seed = this.mode === "daily" ? dailySeed(this.date) : String(options.seed ?? Date.now());
      this.rng = random(this.seed);
      this.events = [];
      this.status = "ready";
      this.snake = Array.from({ length: 5 }, (_, i) => ({ x: 10 - i, y: 16 }));
      this.previous = this.snake.map((p) => ({ ...p }));
      this.direction = "right";
      this.turns = [];
      this.rocks = layout(this.plot);
      this.initialRocks = this.rocks.length;
      this.warnings = [];
      this.foods = [];
      this.bonus = null;
      this.score = 0;
      this.crops = 0;
      this.delivered = 0;
      this.combo = 0;
      this.comboLeft = 0;
      this.bestCombo = 0;
      this.ticks = 0;
      this.duration = 0;
      this.cause = "";
      this.collision = null;
      this.order = MODES[this.mode].orders ? this.newOrder() : null;
      this.fillFood();
    }

    get speed() { return this.mode === "practice" ? 230 : Math.max(90, MODES[this.mode].speed - this.crops * 1.6); }
    get comboWindow() { return 32; }
    pick(list) { return list.length ? list[Math.floor(this.rng() * list.length)] : null; }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drain() { return this.events.splice(0); }

    start() { if (this.status === "ready") this.status = "playing"; }
    pause() { if (this.status === "playing") { this.status = "paused"; this.turns = []; } }
    resume() { if (this.status === "paused") this.status = "playing"; }

    steer(name) {
      if (this.status !== "playing" || !DIRECTIONS[name] || this.turns.length >= 2) return false;
      const last = DIRECTIONS[this.turns.at(-1) || this.direction];
      const next = DIRECTIONS[name];
      if (same(next, last) || (next.x === -last.x && next.y === -last.y)) return false;
      this.turns.push(name);
      return true;
    }

    newOrder() {
      const first = this.pick(CROPS).id;
      const second = this.pick(CROPS.filter((crop) => crop.id !== first)).id;
      return { number: this.delivered + 1, bonus: 10, items: [
        { kind: first, needed: 2, collected: 0 }, { kind: second, needed: 1, collected: 0 },
      ] };
    }

    neededKinds() { return this.order ? this.order.items.filter((i) => i.collected < i.needed).map((i) => i.kind) : []; }
    isNeeded(kind) { return this.neededKinds().includes(kind); }

    reachable(extraRock = null, blockBody = true) {
      const blocked = new Set(this.rocks.map(key));
      if (extraRock) blocked.add(key(extraRock));
      if (blockBody) for (const cell of this.snake.slice(1, -1)) blocked.add(key(cell));
      const head = this.snake[0];
      if (blocked.has(key(head))) return new Set();
      const reached = new Set([key(head)]);
      const queue = [head];
      for (let i = 0; i < queue.length; i++) {
        for (const d of Object.values(DIRECTIONS)) {
          const cell = { x: queue[i].x + d.x, y: queue[i].y + d.y };
          const id = key(cell);
          if (!outside(cell) && !blocked.has(id) && !reached.has(id)) { reached.add(id); queue.push(cell); }
        }
      }
      return reached;
    }

    freeCells(predicate = () => true) {
      const occupied = new Set([...this.snake, ...this.rocks, ...this.warnings, ...this.foods, ...(this.bonus ? [this.bonus] : [])].map(key));
      const reached = this.reachable();
      const cells = [];
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const cell = { x, y };
        if (!occupied.has(key(cell)) && reached.has(key(cell)) && predicate(cell)) cells.push(cell);
      }
      return cells;
    }

    fillFood() {
      const target = this.order ? 3 : 1;
      while (this.foods.length < target) {
        const cell = this.pick(this.freeCells());
        if (!cell) break;
        const needed = this.neededKinds();
        const mustSupply = needed.length && !this.foods.some((f) => needed.includes(f.kind));
        const kind = mustSupply ? this.pick(needed) : this.pick(CROPS).id;
        this.foods.push({ ...cell, kind, born: this.ticks });
      }
    }

    canPlaceRock(cell) {
      if (this.snake.length >= SIZE * SIZE - this.rocks.length - 1) return false;
      if (distance(cell, this.snake[0]) < 4 || [...this.snake, ...this.foods, ...(this.bonus ? [this.bonus] : [])].some((p) => same(p, cell))) return false;
      if (this.reachable(cell, false).size !== SIZE * SIZE - this.rocks.length - 1) return false;
      const reached = this.reachable(cell);
      return this.foods.every((f) => reached.has(key(f)));
    }

    scheduleRock() {
      if (this.mode === "practice" || this.rocks.length + this.warnings.length >= this.initialRocks + 12) return;
      const candidates = this.freeCells((cell) => distance(cell, this.snake[0]) >= 7);
      // Check candidates in a seeded order, avoiding extra RNG calls from the renderer.
      while (candidates.length) {
        const index = Math.floor(this.rng() * candidates.length);
        const cell = candidates.splice(index, 1)[0];
        if (this.canPlaceRock(cell)) {
          this.warnings.push({ ...cell, remaining: 8, deferred: 0 });
          this.emit("warning", { cell });
          return;
        }
      }
    }

    advanceHazards() {
      for (const warning of [...this.warnings]) {
        warning.remaining--;
        if (warning.remaining > 0) continue;
        if (this.canPlaceRock(warning)) {
          this.rocks.push({ x: warning.x, y: warning.y });
          this.warnings.splice(this.warnings.indexOf(warning), 1);
          this.emit("rock", { cell: warning });
        } else if (warning.deferred < 12) {
          warning.remaining = 3;
          warning.deferred++;
        } else this.warnings.splice(this.warnings.indexOf(warning), 1);
      }
    }

    finish(status, cause, collision = null) {
      this.status = status;
      this.cause = cause;
      this.collision = collision;
      this.turns = [];
      this.emit("finish", { status, cause });
    }

    step() {
      if (this.status !== "playing") return;
      this.duration += this.speed;
      this.ticks++;
      if (this.turns.length) this.direction = this.turns.shift();
      if (this.comboLeft > 0) this.comboLeft--;
      if (!this.comboLeft) this.combo = 0;
      const d = DIRECTIONS[this.direction];
      const head = { x: this.snake[0].x + d.x, y: this.snake[0].y + d.y };
      const foodIndex = this.foods.findIndex((f) => same(f, head));
      const growing = foodIndex >= 0;
      const body = growing ? this.snake : this.snake.slice(0, -1);
      if (outside(head)) return this.finish("over", "You reached the edge of the plot.", head);
      if (this.rocks.some((p) => same(p, head))) return this.finish("over", "A stone got in the way.", head);
      if (body.some((p) => same(p, head))) return this.finish("over", "You crossed your own path.", head);
      this.previous = this.snake.map((p) => ({ ...p }));
      this.snake.unshift(head);
      if (!growing) this.snake.pop();
      if (growing) {
        const food = this.foods.splice(foodIndex, 1)[0];
        this.crops++;
        this.combo = Math.min(5, this.combo + 1);
        this.comboLeft = this.comboWindow;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.score += this.combo;
        this.emit("eat", { cell: head, kind: food.kind, points: this.combo });
        const item = this.order?.items.find((i) => i.kind === food.kind && i.collected < i.needed);
        if (item) item.collected++;
        if (this.order && this.order.items.every((i) => i.collected === i.needed)) {
          this.score += this.order.bonus;
          this.delivered++;
          this.emit("delivery", { points: this.order.bonus, number: this.delivered, cell: head });
          this.order = this.newOrder();
        }
      }
      if (this.bonus) {
        if (same(head, this.bonus)) {
          this.score += 5;
          this.emit("bonus", { cell: head, points: 5 });
          this.bonus = null;
        } else if (--this.bonus.remaining <= 0) this.bonus = null;
      }
      if (this.snake.length === SIZE * SIZE - this.rocks.length) {
        this.foods = [];
        this.bonus = null;
        return this.finish("won", "Every inch of the garden is yours.");
      }
      // A nearly full board must always give normal food priority over a bonus.
      if (!this.foods.length && !this.freeCells().length) {
        this.bonus = null;
        // A warning must never reserve the only cell where normal food can grow.
        if (!this.freeCells().length) this.warnings = [];
      }
      this.fillFood();
      this.advanceHazards();
      if (growing && this.crops % 5 === 0) this.scheduleRock();
      if (growing && !this.bonus && this.rng() < 0.22) {
        const cell = this.pick(this.freeCells());
        if (cell) this.bonus = { ...cell, remaining: 65, total: 65 };
      }
    }
  }

  return { Game, SIZE, RULES_VERSION, CROPS, MODES, PLOTS, DIRECTIONS, hash, random, dailyDate, dailySeed, dailyPlot, recordKey, layout };
});
