/* The source atlas is deliberately mapped by artwork bounds, not equal grid cells. */
(() => {
  "use strict";
  const SPRITES = {
    carrot: [35, 24, 351, 443], tomato: [397, 77, 312, 324],
    radish: [734, 32, 334, 423], cabbage: [1074, 77, 348, 342],
    strawberry: [70, 466, 259, 324], pumpkin: [380, 468, 348, 327],
    golden: [778, 413, 319, 414], stone: [1100, 529, 320, 255],
    head: [26, 840, 356, 156], body: [409, 859, 321, 138],
    corner: [797, 850, 228, 200], tail: [1100, 853, 319, 149],
  };
  const SIDE = 600;
  // Actual ink bounds: the source print has generous, uneven transparent margins.
  const HAT_SPRITES = {
    sprout: [35, 306, 254, 314], straw: [303, 375, 335, 248],
    tomato: [638, 342, 313, 268], chef: [954, 306, 284, 317],
    mushroom: [6, 725, 309, 254], beekeeper: [320, 729, 314, 260],
    wizard: [622, 664, 310, 327], crown: [943, 692, 288, 293],
  };
  const CELL = SIDE / PlotTwist.SIZE;
  const center = (p) => ({ x: (p.x + .5) * CELL, y: (p.y + .5) * CELL });
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  class GardenRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.atlas = new Image();
      this.hats = new Image();
      this.hatsLoaded = false;
      this.loaded = false;
      this.effects = [];
      this.gulp = 0;
      this.clock = 0;
      this.background = null;
      this.grid = null;
      const cropsReady = new Promise((resolve, reject) => {
        this.atlas.onload = () => { this.loaded = true; this.makeBodyTexture(); resolve(); };
        this.atlas.onerror = () => reject(new Error("The garden artwork could not be loaded."));
      });
      const hatsReady = new Promise((resolve, reject) => {
        this.hats.onload = () => { this.hatsLoaded = true; resolve(); };
        this.hats.onerror = () => reject(new Error("The hat artwork could not be loaded."));
      });
      this.ready = Promise.all([cropsReady, hatsReady]);
      this.atlas.src = "assets/garden-atlas.png";
      this.hats.src = "assets/hat-atlas.png";
      this.resize();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }

    resize() {
      const pixels = Math.max(1, Math.round(this.canvas.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 3)));
      if (this.canvas.width !== pixels || this.canvas.height !== pixels) {
        this.canvas.width = pixels;
        this.canvas.height = pixels;
      }
    }

    makeBodyTexture() {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 32;
      tile.getContext("2d").drawImage(this.atlas, 450, 878, 32, 20, 0, 0, 32, 32);
      this.bodyTexture = this.ctx.createPattern(tile, "repeat");
    }

    sprite(ctx, name, x, y, width, height = width) {
      if (!this.loaded || !SPRITES[name]) return;
      const [sx, sy, sw, sh] = SPRITES[name];
      const scale = Math.min(width / sw, height / sh);
      const dw = sw * scale, dh = sh * scale;
      ctx.save();
      ctx.translate(x - dw / 2, y - dh / 2);
      // Two irregularly packed sprites have overlapping bounding rectangles.
      // Clip only the neighbouring object's sliver, preserving the actual artwork.
      if (name === "radish") {
        ctx.beginPath();
        [[0, 0], [334, 0], [334, 375], [150, 375], [116, 423], [0, 423]].forEach(([px, py], i) => i ? ctx.lineTo(px * scale, py * scale) : ctx.moveTo(px * scale, py * scale));
        ctx.closePath(); ctx.clip();
      } else if (name === "golden") {
        ctx.beginPath();
        [[0, 60], [116, 0], [319, 0], [319, 414], [0, 414]].forEach(([px, py], i) => i ? ctx.lineTo(px * scale, py * scale) : ctx.moveTo(px * scale, py * scale));
        ctx.closePath(); ctx.clip();
      }
      ctx.drawImage(this.atlas, sx, sy, sw, sh, 0, 0, dw, dh);
      ctx.restore();
    }

    paintIcon(canvas, kind) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.sprite(ctx, kind, canvas.width / 2, canvas.height / 2, canvas.width * .9, canvas.height * .9);
    }

    hat(ctx, id, x, y, width, height = width) {
      if (!this.hatsLoaded || !HAT_SPRITES[id]) return;
      const [sx, sy, sw, sh] = HAT_SPRITES[id];
      const scale = Math.min(width / sw, height / sh);
      ctx.save(); ctx.translate(x - sw * scale / 2, y - sh * scale / 2);
      // Remove a neighbouring hat's ink where their bounding boxes overlap.
      const cutout = id === "wizard" ? [0, 136, 12, 65] : id === "beekeeper" ? [302, 202, 12, 39] : null;
      if (cutout) {
        ctx.beginPath(); ctx.rect(0, 0, sw * scale, sh * scale);
        ctx.rect(...cutout.map((value) => value * scale)); ctx.clip("evenodd");
      }
      ctx.drawImage(this.hats, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
      ctx.restore();
    }

    paintHat(canvas, id) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.hat(ctx, id, canvas.width / 2, canvas.height / 2, canvas.width * .92, canvas.height * .92);
    }

    paintPreview(canvas, id, pattern = "ribbon") {
      const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(w * .12, h * .75);
      ctx.bezierCurveTo(w * .6, h * 1.02, w * .04, h * .57, w * .54, h * .65);
      ctx.strokeStyle = "#243a2c"; ctx.lineWidth = h * .16; ctx.stroke();
      ctx.strokeStyle = "#65754a"; ctx.lineWidth = h * .12; ctx.stroke();
      ctx.strokeStyle = "#f8efcb";
      if (pattern === "ribbon") { ctx.lineWidth = h * .018; ctx.stroke(); }
      else {
        ctx.setLineDash(pattern === "speckled" ? [h * .012, h * .09] : [h * .025, h * .11]);
        ctx.lineWidth = pattern === "speckled" ? h * .025 : h * .11;
        ctx.stroke(); ctx.setLineDash([]);
      }
      this.sprite(ctx, "head", w * .6, h * .65, w * .36, h * .24);
      const bounds = HAT_SPRITES[id];
      if (bounds) {
        const width = w * .31, height = Math.min(h * .4, width * bounds[3] / bounds[2]);
        this.hat(ctx, id, w * .53, h * .6 - height / 2, width, height);
      }
      ctx.restore();
    }

    makeBackground(grid) {
      this.grid = grid;
      this.background = document.createElement("canvas");
      this.background.width = this.background.height = SIDE;
      const ctx = this.background.getContext("2d");
      ctx.fillStyle = "#e1d9a8";
      ctx.fillRect(0, 0, SIDE, SIDE);
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        if ((x + y) % 2 === 0) { ctx.fillStyle = "#f6efc05c"; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
      }
      if (grid) {
        ctx.strokeStyle = "#68723e20";
        ctx.lineWidth = .7;
        ctx.beginPath();
        for (let i = 1; i < 20; i++) { ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIDE); ctx.moveTo(0, i * CELL); ctx.lineTo(SIDE, i * CELL); }
        ctx.stroke();
      }
      ctx.strokeStyle = "#69704465";
      ctx.lineWidth = 1;
      ctx.strokeRect(.5, .5, SIDE - 1, SIDE - 1);
    }

    addEvent(event, gentle) {
      if (gentle) return;
      if (event.type === "eat") this.gulp = 170;
      if (!["eat", "delivery", "bonus"].includes(event.type)) return;
      const pos = center(event.cell);
      const color = event.type === "eat" ? PlotTwist.CROPS.find((c) => c.id === event.kind).color : "#a87920";
      this.effects.push({ ...pos, label: `+${event.points}`, color, life: 700, total: 700 });
      for (let i = 0; i < 7; i++) {
        const angle = Math.random() * Math.PI * 2;
        this.effects.push({ ...pos, vx: Math.cos(angle) * (20 + Math.random() * 40), vy: Math.sin(angle) * 40, color, life: 450, total: 450 });
      }
      this.effects = this.effects.slice(-70);
    }

    reset() { this.effects = []; this.gulp = 0; this.clock = 0; }

    draw(game, progress, dt, settings) {
      const ctx = this.ctx;
      const moving = game.status === "playing";
      if (moving) this.clock += dt;
      this.gulp = Math.max(0, this.gulp - dt);
      if (settings.gentle) this.effects = [];
      if (!this.background || this.grid !== settings.grid) this.makeBackground(settings.grid);
      ctx.setTransform(this.canvas.width / SIDE, 0, 0, this.canvas.height / SIDE, 0, 0);
      ctx.clearRect(0, 0, SIDE, SIDE);
      ctx.drawImage(this.background, 0, 0);
      for (const rock of game.rocks) {
        const p = center(rock);
        this.sprite(ctx, "stone", p.x, p.y, CELL * .9, CELL * .84);
      }
      for (const warning of game.warnings) {
        const p = center(warning);
        ctx.save();
        ctx.globalAlpha = .3;
        this.sprite(ctx, "stone", p.x, p.y, CELL * .85);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#a64230";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(p.x - CELL * .43, p.y - CELL * .43, CELL * .86, CELL * .86);
        ctx.restore();
      }
      for (const food of game.foods) {
        const p = center(food);
        if (game.isNeeded(food.kind)) this.markNeeded(p);
        this.sprite(ctx, food.kind, p.x, p.y, CELL * .87, CELL * .98);
      }
      if (game.bonus) {
        const p = center(game.bonus);
        ctx.strokeStyle = "#a87920";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, CELL * .53, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * game.bonus.remaining / game.bonus.total);
        ctx.stroke();
        this.sprite(ctx, "golden", p.x, p.y, CELL * .9, CELL * .96);
      }
      this.drawSnake(game, progress, settings);
      if (game.collision) {
        const p = center({ x: Math.max(0, Math.min(19, game.collision.x)), y: Math.max(0, Math.min(19, game.collision.y)) });
        ctx.strokeStyle = "#a64230";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - CELL * .47, p.y - CELL * .47, CELL * .94, CELL * .94);
      }
      for (const effect of this.effects) {
        effect.life -= dt;
        ctx.globalAlpha = Math.max(0, effect.life / effect.total);
        ctx.fillStyle = effect.color;
        if (effect.label) {
          effect.y -= dt * .026;
          ctx.font = "bold 16px Georgia";
          ctx.textAlign = "center";
          ctx.fillText(effect.label, effect.x, effect.y - CELL * .5);
        } else {
          effect.x += effect.vx * dt / 1000; effect.y += effect.vy * dt / 1000;
          ctx.beginPath(); ctx.ellipse(effect.x, effect.y, 1.5, 3, .5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      this.effects = this.effects.filter((effect) => effect.life > 0);
    }

    markNeeded(p) {
      const ctx = this.ctx, r = CELL * .44, line = CELL * .14;
      ctx.strokeStyle = "#a73524";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        ctx.moveTo(p.x + dx * (r - line), p.y + dy * r);
        ctx.lineTo(p.x + dx * r, p.y + dy * r);
        ctx.lineTo(p.x + dx * r, p.y + dy * (r - line));
      }
      ctx.stroke();
    }

    drawSnake(game, progress, settings) {
      const ctx = this.ctx;
      const t = ["over", "won", "ready"].includes(game.status) ? 1 : progress;
      const head = center(mix(game.previous[0], game.snake[0], t));
      const last = game.snake.length - 1;
      const tail = center(mix(game.previous[Math.min(last, game.previous.length - 1)], game.snake[last], t));
      // Keep the centreline on the actual grid path, including the turn vertex.
      const points = [head, ...game.snake.slice(1).map(center), tail];
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = "#243a2c"; ctx.lineWidth = CELL * .7; ctx.stroke();
      ctx.strokeStyle = this.bodyTexture || "#5d783e"; ctx.lineWidth = CELL * .55; ctx.stroke();
      if (settings.pattern === "ribbon") {
        ctx.strokeStyle = "#eee3bf"; ctx.lineWidth = CELL * .095; ctx.stroke();
      } else {
        ctx.fillStyle = "#eee3bf";
        for (let i = 1; i < game.snake.length - 1; i++) {
          const p = center(mix(game.previous[Math.min(i, game.previous.length - 1)], game.snake[i], t));
          if (settings.pattern === "speckled") {
            ctx.beginPath(); ctx.ellipse(p.x, p.y, 2, 3, i * .7, 0, Math.PI * 2); ctx.fill();
          } else {
            const prev = game.snake[i - 1];
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(prev.y - game.snake[i].y, prev.x - game.snake[i].x));
            ctx.fillRect(-2, -CELL * .24, 4, CELL * .48); ctx.restore();
          }
        }
      }
      const lastDir = { x: game.snake[last].x - game.snake[last - 1].x, y: game.snake[last].y - game.snake[last - 1].y };
      ctx.save();
      ctx.translate(tail.x, tail.y); ctx.rotate(Math.atan2(lastDir.y, lastDir.x));
      this.sprite(ctx, "tail", CELL * .16, 0, CELL * 1.2, CELL * .7);
      ctx.restore();
      ctx.save();
      ctx.translate(head.x, head.y);
      const direction = PlotTwist.DIRECTIONS[game.direction];
      ctx.rotate(Math.atan2(direction.y, direction.x));
      const gulp = settings.gentle ? 0 : Math.sin(this.gulp / 170 * Math.PI) * .09;
      ctx.scale(1 + gulp, 1 + gulp);
      if (game.status === "over") ctx.filter = "saturate(.3)";
      this.sprite(ctx, "head", -CELL * .08, 0, CELL * 1.45, CELL * .76);
      const hatBounds = HAT_SPRITES[settings.hat];
      if (hatBounds) {
        const width = CELL * 1.12, height = Math.min(CELL * 1.18, width * hatBounds[3] / hatBounds[2]);
        // The brim rests on the head; the same transform follows every turn.
        this.hat(ctx, settings.hat, -CELL * .17, -CELL * .23 - height / 2, width, height);
      }
      ctx.restore();
    }
  }
  GardenRenderer.SPRITES = SPRITES;
  GardenRenderer.HAT_SPRITES = HAT_SPRITES;
  window.GardenRenderer = GardenRenderer;
})();
