/* An engraved hedge maze, drawn from the same cells used by the simulation. */
(() => {
  "use strict";
  const { MAP, SIZE, TUNNEL, DIRECTIONS } = MoonGarden;
  const SIDE = 600, CELL = SIDE / SIZE;
  const PALETTES = [
    { floor: "#142e34", hedge: "#2d4940", edge: "#8aa17a", petal: "#b6c496", title: "The Moon Garden" },
    { floor: "#192e3c", hedge: "#304d56", edge: "#91b5aa", petal: "#afcfbf", title: "The Blue Hour" },
    { floor: "#302c3d", hedge: "#4c4650", edge: "#b2a58e", petal: "#d8bf9d", title: "The Violet Hour" },
  ];
  const wall = (x, y) => MAP[y]?.[x] === "#";
  const point = (p) => ({ x: (p.x + .5) * CELL, y: (p.y + .5) * CELL });
  const interpolate = (from, to, t) => {
    let dx = to.x - from.x;
    if (Math.abs(dx) > SIZE / 2) dx -= Math.sign(dx) * SIZE;
    return { x: ((from.x + dx * t) % SIZE + SIZE) % SIZE, y: from.y + (to.y - from.y) * t };
  };

  function hedgeContours() {
    const edges = new Map(), id = (x, y) => `${x},${y}`;
    const add = (x, y, nx, ny) => {
      const k = id(x, y); if (!edges.has(k)) edges.set(k, []);
      edges.get(k).push([{ x, y }, { x: nx, y: ny }]);
    };
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (wall(x, y)) {
      if (!wall(x, y - 1)) add(x, y, x + 1, y);
      if (!wall(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!wall(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!wall(x - 1, y)) add(x, y + 1, x, y);
    }
    const contours = [];
    while (edges.size) {
      const first = edges.values().next().value[0], start = id(first[0].x, first[0].y), path = [];
      let edge = first;
      do {
        path.push(edge[0]);
        const k = id(edge[0].x, edge[0].y), list = edges.get(k);
        list.splice(list.indexOf(edge), 1); if (!list.length) edges.delete(k);
        const end = id(edge[1].x, edge[1].y);
        if (end === start) break;
        const options = edges.get(end);
        if (!options) break;
        const dx = edge[1].x - edge[0].x, dy = edge[1].y - edge[0].y;
        edge = options.find(([a, b]) => (b.x - a.x) === -dy && (b.y - a.y) === dx) || options[0];
      } while (edge);
      if (path.length > 2) contours.push(path);
    }
    return contours;
  }
  const CONTOURS = hedgeContours();

  function roundedContour(ctx, points) {
    const radius = CELL * .23;
    const toward = (a, b) => {
      const distance = Math.hypot(b.x - a.x, b.y - a.y), r = Math.min(radius, distance / 2);
      return { x: a.x + (b.x - a.x) / distance * r, y: a.y + (b.y - a.y) / distance * r };
    };
    for (let i = 0; i < points.length; i++) {
      const p = { x: points[i].x * CELL, y: points[i].y * CELL };
      const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      const a = toward(p, { x: prev.x * CELL, y: prev.y * CELL }), b = toward(p, { x: next.x * CELL, y: next.y * CELL });
      if (!i) ctx.moveTo(a.x, a.y); else ctx.lineTo(a.x, a.y);
      ctx.quadraticCurveTo(p.x, p.y, b.x, b.y);
    }
    ctx.closePath();
  }

  class PacRenderer {
    constructor(canvas, garden) { this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.garden = garden; this.clock = 0; this.effects = []; this.background = null; this.paletteIndex = -1; }
    reset() { this.clock = 0; this.effects = []; }
    getPalette(level) { return PALETTES[(level - 1) % PALETTES.length]; }
    makeBackground(level) {
      this.paletteIndex = (level - 1) % PALETTES.length;
      const palette = this.getPalette(level), background = document.createElement("canvas"); background.width = background.height = SIDE;
      const ctx = background.getContext("2d");
      ctx.fillStyle = palette.floor; ctx.fillRect(0, 0, SIDE, SIDE);
      ctx.beginPath(); CONTOURS.forEach((path) => roundedContour(ctx, path));
      ctx.fillStyle = palette.hedge; ctx.fill("evenodd");
      ctx.strokeStyle = "#0c2429"; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = palette.edge; ctx.lineWidth = 1.3; ctx.stroke();
      // Small carved leaves live inside the hedges, away from playable paths.
      ctx.strokeStyle = palette.petal; ctx.globalAlpha = .35; ctx.lineWidth = 1;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (wall(x, y) && (x * 3 + y * 5) % 7 === 0) {
        const p = point({ x, y }); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((x + y) % 2 ? -.45 : .45);
        ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.moveTo(0, 1); ctx.quadraticCurveTo(-5, 0, -4, -4); ctx.moveTo(0, -1); ctx.quadraticCurveTo(5, -2, 4, -6); ctx.stroke(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // The ghosts' glasshouse has its own brass gate and leaded windows.
      ctx.fillStyle = "#234248"; ctx.fillRect(9 * CELL, 11 * CELL, 5 * CELL, CELL);
      ctx.strokeStyle = "#7a9a8c"; ctx.lineWidth = 1; ctx.globalAlpha = .5;
      for (let x = 9; x <= 14; x++) { ctx.beginPath(); ctx.moveTo(x * CELL + 2, 11 * CELL + 3); ctx.lineTo(x * CELL + 2, 12 * CELL - 3); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.strokeStyle = "#e8cd89"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(11 * CELL + 2, 10.5 * CELL); ctx.lineTo(12 * CELL - 2, 10.5 * CELL); ctx.stroke();
      ctx.fillStyle = "#bfcbad"; ctx.font = "7px 'Courier New', monospace"; ctx.textAlign = "center"; ctx.fillText("THE GLASSHOUSE", SIDE / 2, 12.65 * CELL);
      for (const x of [CELL * .2, SIDE - CELL * .2]) {
        ctx.strokeStyle = "#e8cd89"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x, (TUNNEL + .3) * CELL); ctx.lineTo(x + (x < SIDE / 2 ? 4 : -4), (TUNNEL + .5) * CELL); ctx.lineTo(x, (TUNNEL + .7) * CELL); ctx.stroke();
      }
      this.background = background;
    }
    player(ctx, x, y, r, angle = 0, mouth = .3) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = "#f5cf69"; ctx.strokeStyle = "#172f32"; ctx.lineWidth = Math.max(1, r * .09);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#243c35"; ctx.beginPath(); ctx.ellipse(r * .12, -r * .52, r * .095, r * .135, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff0b2"; ctx.lineWidth = Math.max(.7, r * .055); ctx.beginPath(); ctx.arc(0, 0, r * .78, Math.PI * .96, Math.PI * 1.35); ctx.stroke(); ctx.restore();
    }
    ghost(ctx, x, y, r, ghost, frightened = false, warning = false) {
      ctx.save(); ctx.translate(x, y);
      if (ghost.mode !== "eyes") {
        ctx.fillStyle = frightened ? "#83aeb9" : ghost.color; ctx.strokeStyle = "#142c33"; ctx.lineWidth = Math.max(1, r * .085);
        ctx.beginPath(); ctx.moveTo(-r, r * .82); ctx.lineTo(-r, -.05 * r);
        ctx.bezierCurveTo(-r, -1.4 * r, r, -1.4 * r, r, -.05 * r); ctx.lineTo(r, r * .82);
        for (let i = 0; i < 3; i++) ctx.quadraticCurveTo(r - (i * 2 + 1) * r / 3, r * .34, r - (i * 2 + 2) * r / 3, r * .82);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (frightened) {
          ctx.strokeStyle = "#fff3cd"; ctx.lineWidth = 1.2; ctx.beginPath();
          ctx.moveTo(-r * .55, r * .35); for (let i = 1; i <= 4; i++) ctx.lineTo((- .55 + i * .275) * r, r * (i % 2 ? .18 : .35)); ctx.stroke();
          if (warning) { ctx.strokeStyle = "#fff3cd"; ctx.beginPath(); ctx.arc(0, -.1 * r, r * .83, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        } else {
          ctx.strokeStyle = "#fff3cd77"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(r * .64, r * .05); ctx.lineTo(r * .64, r * .42); ctx.moveTo(r * .78, r * .16); ctx.lineTo(r * .78, r * .46); ctx.stroke();
        }
      }
      const delta = DIRECTIONS[ghost.direction] || { x: 0, y: 0 };
      for (const sign of [-1, 1]) {
        ctx.fillStyle = "#fff5d9"; ctx.beginPath(); ctx.ellipse(sign * r * .37, -r * .17, r * .28, r * .36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#24343d"; ctx.beginPath(); ctx.ellipse(sign * r * .37 + delta.x * r * .12, -r * .17 + delta.y * r * .13, r * .12, r * .18, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    lantern(ctx, x, y, r) {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = "#f2d78c";
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -r * .73, r * .24, r * .45, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#fff2bf"; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a9d79"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    fruit(ctx, fruit, x, y, size) {
      if (fruit.kind === "strawberry") return this.garden.sprite(ctx, "strawberry", x, y, size, size);
      ctx.save(); ctx.translate(x, y);
      if (fruit.kind === "cherries") {
        ctx.strokeStyle = "#9dbd86"; ctx.lineWidth = size * .07; ctx.beginPath(); ctx.moveTo(-size * .2, size * .16); ctx.quadraticCurveTo(-size * .1, -size * .45, size * .2, -size * .42); ctx.quadraticCurveTo(size * .05, -size * .18, size * .23, size * .17); ctx.stroke();
        ctx.fillStyle = "#e38875";
        for (const sign of [-1, 1]) { ctx.beginPath(); ctx.arc(sign * size * .23, size * .2, size * .24, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f2b39a"; ctx.beginPath(); ctx.arc(sign * size * .23 - size * .07, size * .12, size * .055, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e38875"; }
      } else {
        ctx.fillStyle = "#efd16c"; ctx.beginPath(); ctx.ellipse(0, 0, size * .42, size * .28, -.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#9dbd86"; ctx.beginPath(); ctx.ellipse(size * .22, -size * .31, size * .16, size * .07, -.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    paintGameIcon(canvas) {
      const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      this.ghost(ctx, w * .26, h * .6, h * .24, { ...MoonGarden.GHOSTS[2], direction: "right" });
      this.player(ctx, w * .64, h * .48, h * .34, 0, .48);
    }
    paintGhostIcon(canvas, index) {
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.ghost(ctx, canvas.width / 2, canvas.height * .53, canvas.height * .38, { ...MoonGarden.GHOSTS[index], direction: "right" });
    }
    paintTicketIcon(canvas, power) {
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (power) this.lantern(ctx, canvas.width / 2, canvas.height / 2, canvas.width * .32);
      else this.player(ctx, canvas.width / 2, canvas.height / 2, canvas.width * .4, 0, .45);
    }
    paintLives(canvas, lives) {
      const ctx = canvas.getContext("2d"), shown = Math.min(4, lives); ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < shown; i++) this.player(ctx, 17 + i * 28, canvas.height / 2, 11, 0, .48);
      if (lives > 4) { ctx.fillStyle = "#3d625a"; ctx.font = "bold 13px monospace"; ctx.fillText(`+${lives - 4}`, 123, 25); }
    }
    addEvent(event, gentle) {
      if (gentle || !["capture", "fruit", "power"].includes(event.type)) return;
      const p = point(event.cell); this.effects.push({ ...p, label: `+${event.points}`, life: 900 }); this.effects = this.effects.slice(-8);
    }
    draw(game, alpha, dt, settings) {
      const ctx = this.ctx;
      if (game.status === "playing") this.clock += dt;
      if (settings.gentle) this.effects = [];
      if (!this.background || this.paletteIndex !== (game.level - 1) % PALETTES.length) this.makeBackground(game.level);
      ctx.setTransform(this.canvas.width / SIDE, 0, 0, this.canvas.height / SIDE, 0, 0); ctx.clearRect(0, 0, SIDE, SIDE); ctx.drawImage(this.background, 0, 0);
      for (const [id, kind] of game.pellets) {
        const p = point({ x: id % SIZE, y: Math.floor(id / SIZE) });
        if (kind === "power") this.lantern(ctx, p.x, p.y, CELL * (settings.gentle ? .29 : .29 + Math.sin(this.clock / 550) * .025));
        else { ctx.fillStyle = "#e8dbac"; ctx.beginPath(); ctx.arc(p.x, p.y, CELL * .075, 0, Math.PI * 2); ctx.fill(); }
      }
      if (game.fruit) { const p = point(game.fruit); this.fruit(ctx, game.fruit, p.x, p.y, CELL * .9); }
      const t = game.status === "playing" && !settings.gentle ? alpha : 1;
      const p = point(interpolate(game.previous.player, game.player, t));
      const delta = DIRECTIONS[game.player.direction];
      const mouth = settings.gentle || game.waitMs || game.status !== "playing" ? .32 : .12 + (Math.sin(this.clock / 63) + 1) * .23;
      for (const offset of [-SIDE, 0, SIDE]) this.player(ctx, p.x + offset, p.y, CELL * .43, Math.atan2(delta.y, delta.x), mouth);
      game.ghosts.forEach((ghost, i) => {
        const p = point(interpolate(game.previous.ghosts[i], ghost, t));
        for (const offset of [-SIDE, 0, SIDE]) this.ghost(ctx, p.x + offset, p.y, CELL * .42, ghost, game.powerMs > 0 && ghost.mode === "roam", game.powerMs < 2000);
      });
      for (const effect of this.effects) {
        effect.life -= dt; effect.y -= dt * .018; ctx.globalAlpha = Math.max(0, effect.life / 900);
        ctx.fillStyle = "#ffe5a0"; ctx.font = "bold 16px Georgia"; ctx.textAlign = "center"; ctx.fillText(effect.label, effect.x, effect.y - 14);
      }
      ctx.globalAlpha = 1; this.effects = this.effects.filter((effect) => effect.life > 0);
      if (game.waitMs > 0 && game.status === "playing") {
        ctx.fillStyle = "#f8efcf"; ctx.strokeStyle = "#a7b795"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(SIDE / 2 - 112, CELL * 13.7, 224, 55, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#294741"; ctx.textAlign = "center"; ctx.font = "bold 25px Georgia";
        ctx.fillText(game.intermission === "level" ? "A clean plate." : game.intermission === "life" ? "One more bite." : "After you.", SIDE / 2, CELL * 13.7 + 35);
      }
    }
  }
  PacRenderer.CONTOURS = CONTOURS;
  window.PacRenderer = PacRenderer;
})();
