(() => {
  "use strict";
  const SIZE = PlotTwist.SIZE;
  const SIDE = 600;
  const CELL = SIDE / SIZE;
  const FOOD_COLORS = {
    carrot: "#e68a30", tomato: "#e24739", radish: "#a647a0",
    cabbage: "#71a546", strawberry: "#e24772", pumpkin: "#d89b24", golden: "#ffca28",
  };

  class GardenRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.resize();
    }

    resize() {
      const width = this.canvas.clientWidth;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = this.canvas.height = Math.max(1, Math.round(width * scale));
    }

    drawFood(ctx, kind, x, y, size) {
      ctx.fillStyle = FOOD_COLORS[kind];
      ctx.beginPath();
      if (kind === "carrot" || kind === "strawberry") {
        ctx.moveTo(x - size / 2, y - size / 3);
        ctx.lineTo(x + size / 2, y - size / 3);
        ctx.lineTo(x, y + size / 2);
        ctx.closePath();
      } else {
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = "#397a37";
      ctx.fillRect(x - size / 10, y - size / 2 - size / 10, size / 5, size / 4);
    }

    drawHat(ctx, id, x, y, width) {
      if (id === "none") return;
      ctx.save();
      ctx.translate(x - width / 2, y - width / 2);
      ctx.scale(width / 100, width / 100);
      if (id === "sprout") {
        ctx.fillStyle = "#388b3c";
        ctx.fillRect(47, 35, 6, 50);
        ctx.beginPath();
        ctx.ellipse(32, 35, 23, 12, .5, 0, Math.PI * 2);
        ctx.ellipse(68, 25, 23, 12, -.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === "wizard" || id === "crown") {
        ctx.fillStyle = id === "wizard" ? "#6952b4" : "#e5b525";
        ctx.beginPath();
        ctx.moveTo(10, 85);
        if (id === "crown") {
          ctx.lineTo(10, 25); ctx.lineTo(30, 50);
          ctx.lineTo(50, 10); ctx.lineTo(70, 50); ctx.lineTo(90, 25);
        } else ctx.lineTo(50, 10);
        ctx.lineTo(90, 85);
        ctx.closePath();
        ctx.fill();
      } else {
        const colors = { straw: "#d1ad5b", tomato: "#dd493c", chef: "#ddd", mushroom: "#d65444", beekeeper: "#e3c451" };
        ctx.fillStyle = colors[id] || "#888";
        ctx.fillRect(22, 28, 56, 45);
        ctx.fillRect(8, 70, 84, 12);
        if (id === "chef" || id === "mushroom") {
          ctx.beginPath();
          ctx.arc(50, 35, 35, Math.PI, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawBlock(ctx, x, y, size, head, direction, pattern) {
      ctx.fillStyle = head ? "#327737" : "#65a35a";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      if (head) {
        ctx.save();
        ctx.translate(x, y);
        const delta = PlotTwist.DIRECTIONS[direction];
        ctx.rotate(Math.atan2(delta.y, delta.x));
        ctx.fillStyle = "white";
        ctx.fillRect(size * .1, -size * .3, size * .2, size * .2);
        ctx.fillRect(size * .1, size * .1, size * .2, size * .2);
        ctx.restore();
      } else if (pattern !== "ribbon") {
        ctx.fillStyle = "#d2e8c8";
        if (pattern === "speckled") ctx.fillRect(x - size * .1, y - size * .1, size * .2, size * .2);
        else ctx.fillRect(x - size * .1, y - size / 2, size * .2, size);
      }
    }

    draw(game, progress, dt, settings) {
      const ctx = this.ctx;
      ctx.setTransform(this.canvas.width / SIDE, 0, 0, this.canvas.height / SIDE, 0, 0);
      ctx.fillStyle = "#f4f7ed";
      ctx.fillRect(0, 0, SIDE, SIDE);
      if (settings.grid) {
        ctx.strokeStyle = "#dde3d5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < SIZE; i++) {
          ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIDE);
          ctx.moveTo(0, i * CELL); ctx.lineTo(SIDE, i * CELL);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#888";
      for (const rock of game.rocks) ctx.fillRect(rock.x * CELL + 2, rock.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = "#c73535";
      ctx.lineWidth = 2;
      for (const warning of game.warnings) ctx.strokeRect(warning.x * CELL + 2, warning.y * CELL + 2, CELL - 4, CELL - 4);
      for (const food of game.foods) {
        const x = (food.x + .5) * CELL;
        const y = (food.y + .5) * CELL;
        this.drawFood(ctx, food.kind, x, y, CELL * .6);
        if (game.isNeeded(food.kind)) {
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 1;
          ctx.strokeRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6);
        }
      }
      if (game.bonus) this.drawFood(ctx, "golden", (game.bonus.x + .5) * CELL, (game.bonus.y + .5) * CELL, CELL * .7);
      for (let i = game.snake.length - 1; i >= 0; i--) {
        const part = game.snake[i];
        this.drawBlock(ctx, (part.x + .5) * CELL, (part.y + .5) * CELL, CELL - 2, i === 0, game.direction, settings.pattern);
      }
      const head = game.snake[0];
      this.drawHat(ctx, settings.hat, (head.x + .5) * CELL, (head.y + .05) * CELL, CELL * .75);
    }
  }
  window.GardenRenderer = GardenRenderer;
})();
