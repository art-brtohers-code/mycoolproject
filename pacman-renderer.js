(() => {
  "use strict";
  const { MAP, SIZE, DIRECTIONS } = MoonGarden;
  const SIDE = 600;
  const CELL = SIDE / SIZE;

  // Use the shortest distance when an actor crosses a side tunnel.
  function position(from, to, progress) {
    let dx = to.x - from.x;
    if (Math.abs(dx) > SIZE / 2) dx -= Math.sign(dx) * SIZE;
    const x = ((from.x + dx * progress) % SIZE + SIZE) % SIZE;
    const y = from.y + (to.y - from.y) * progress;
    return { x: (x + .5) * CELL, y: (y + .5) * CELL };
  }

  class PacRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.clock = 0;
      this.background = document.createElement("canvas");
      this.background.width = this.background.height = SIDE;
      const ctx = this.background.getContext("2d");
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, SIDE, SIDE);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (MAP[y][x] === "#") {
            ctx.fillStyle = "#2946b5";
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          } else if (MAP[y][x] === "-") {
            ctx.fillStyle = "#e8a4c9";
            ctx.fillRect(x * CELL, (y + .45) * CELL, CELL, 3);
          }
        }
      }
    }

    reset() { this.clock = 0; }

    player(ctx, x, y, radius, angle = 0, mouth = .35) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "#ffdf00";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, mouth, Math.PI * 2 - mouth);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ghost(ctx, x, y, radius, ghost, frightened) {
      if (ghost.mode !== "eyes") {
        ctx.fillStyle = frightened ? "#5684ee" : ghost.color;
        ctx.beginPath();
        ctx.arc(x, y, radius, Math.PI, 0);
        ctx.lineTo(x + radius, y + radius);
        ctx.lineTo(x - radius, y + radius);
        ctx.closePath();
        ctx.fill();
      }
      const delta = DIRECTIONS[ghost.direction];
      for (const side of [-1, 1]) {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x + side * radius * .4, y, radius * .3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(x + side * radius * .4 + delta.x * radius * .1, y + delta.y * radius * .1, radius * .14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    draw(game, progress, dt, settings) {
      const ctx = this.ctx;
      if (game.status === "playing") this.clock += dt;
      ctx.setTransform(this.canvas.width / SIDE, 0, 0, this.canvas.height / SIDE, 0, 0);
      ctx.drawImage(this.background, 0, 0);
      ctx.fillStyle = "#f4e4c1";
      for (const [id, kind] of game.pellets) {
        const x = (id % SIZE + .5) * CELL;
        const y = (Math.floor(id / SIZE) + .5) * CELL;
        ctx.beginPath();
        ctx.arc(x, y, CELL * (kind === "power" ? .25 : .08), 0, Math.PI * 2);
        ctx.fill();
      }
      if (game.fruit) {
        ctx.fillStyle = "#f04e45";
        ctx.beginPath();
        ctx.arc((game.fruit.x + .5) * CELL, (game.fruit.y + .5) * CELL, CELL * .3, 0, Math.PI * 2);
        ctx.fill();
      }
      const t = game.status === "playing" && !settings.gentle ? progress : 1;
      const player = position(game.previous.player, game.player, t);
      const delta = DIRECTIONS[game.player.direction];
      const mouth = settings.gentle ? .35 : .15 + (Math.sin(this.clock / 70) + 1) * .2;
      for (const offset of [-SIDE, 0, SIDE]) {
        this.player(ctx, player.x + offset, player.y, CELL * .42, Math.atan2(delta.y, delta.x), mouth);
      }
      game.ghosts.forEach((ghost, i) => {
        const p = position(game.previous.ghosts[i], ghost, t);
        for (const offset of [-SIDE, 0, SIDE]) this.ghost(ctx, p.x + offset, p.y, CELL * .4, ghost, game.powerMs > 0 && ghost.mode === "roam");
      });
      if (game.waitMs > 0 && game.status === "playing") {
        ctx.fillStyle = "#111";
        ctx.fillRect(SIDE / 2 - 100, CELL * 13.6, 200, 38);
        ctx.fillStyle = "#ffdf00";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(game.intermission === "level" ? "Level complete!" : "Ready!", SIDE / 2, CELL * 13.6 + 27);
      }
    }
  }
  window.PacRenderer = PacRenderer;
})();
