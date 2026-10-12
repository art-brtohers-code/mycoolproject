(() => {
  "use strict";
  const { Game, CROPS, MODES, PLOTS, dailyDate, recordKey } = PlotTwist;
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const renderer = new GardenRenderer(canvas);
  const pacRenderer = new PacRenderer(canvas);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const touch = matchMedia("(pointer: coarse)");
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const saved = GardenStorage.load(storage, { gentle: reducedMotion.matches, controls: touch.matches });
  const data = saved.data;
  const settings = data.settings;
  const { HATS, earned, unlocked, progress, canEquip, recordProgress } = GardenWardrobe;
  let checkpoint = { crops: 0, delivered: 0 };
  let runHats = [];
  let runStart = {};
  let toastLeft = 0;
  const toastQueue = [];
  let storageAvailable = saved.available;
  let game;
  let accumulator = 0;
  let previousFrame = null;
  let lastOrder = "";
  let runSaved = false;
  let stampLeft = 0;
  let messageLeft = 0;
  let hudWait = 0;
  let audioContext;
  let dialogFocus;
  const keys = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left", w: "up", d: "right", s: "down", a: "left" };
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const gameButtons = [...document.querySelectorAll("[data-game]")];
  const sessions = {};
  const isPac = () => settings.game === "pacman";
  const pad = (number, length = 3) => String(number).padStart(length, "0");
  const timeText = (ms) => `${pad(Math.floor(ms / 60000), 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}`;
  const gentle = () => settings.gentle || reducedMotion.matches;
  const recordId = () => isPac() ? MoonGarden.RECORD : recordKey(game.mode, game.plot, game.date);
  const best = () => data.records[recordId()] || 0;
  const modalOpen = () => ["settings-dialog", "help-dialog", "wardrobe-dialog"].some((id) => $(id).open);

  function announce(text) { $("announcer").textContent = text; }
  function persist() {
    storageAvailable = GardenStorage.save(storage, data);
    $("record-note").textContent = storageAvailable ? "Best scores are saved in this browser." : "Scores last for this visit. Browser storage is unavailable.";
  }

  function sound(name, level = 1) {
    if (settings.muted || !settings.volume) return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      const notes = name === "delivery" ? [392, 494, 587, 784] : name === "bonus" ? [523, 784] : name === "start" ? [294, 392] : name === "finish" ? [220, 165] : [330 * Math.pow(2, (level - 1) / 6)];
      notes.forEach((frequency, i) => {
        const start = audioContext.currentTime + i * .065;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, start);
        if (name === "finish") oscillator.frequency.exponentialRampToValueAtTime(frequency * .65, start + .22);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.07 * settings.volume / 100, start + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .22);
        oscillator.connect(gain); gain.connect(audioContext.destination);
        oscillator.start(start); oscillator.stop(start + .23);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Play remains available when the device cannot produce audio. */ }
  }

  function showMessage(text, duration = 3500) {
    $("field-status").textContent = text;
    messageLeft = duration;
  }

  function normalMessage() {
    if (isPac()) return "Eat the dots. The side tunnels connect.";
    if (game.mode === "practice") return "Practice mode: slower speed, no rocks.";
    if (game.mode === "daily") return `${game.date}. Resets at midnight UTC.`;
    if (game.mode === "endless") return "Collect food and beat your best score.";
    return game.crops ? "Outlined food counts toward your order." : "Avoid the walls and your tail.";
  }

  function updateOrder() {
    if (isPac()) {
      const signature = `${game.level}:${game.pellets.size}:${Math.ceil(game.powerMs / 1000)}`;
      if (signature === lastOrder) return;
      lastOrder = signature;
      $("order-title").textContent = "Level progress";
      $("order-description").textContent = "Eat all the dots to finish the level.";
      $("order-number").textContent = `Level ${game.level}`;
      document.querySelector(".ticket-top .eyebrow").textContent = "Pac-Man";
      $("order-items").replaceChildren();
      for (const [label, value] of [["Pellets left", game.pellets.size], ["Ghost power", game.powerMs > 0 ? `${Math.ceil(game.powerMs / 1000)}s` : "None"]]) {
        const row = document.createElement("div"); row.className = "order-item";
        const name = document.createElement("span"); name.className = "crop-name"; name.textContent = label;
        const count = document.createElement("span"); count.className = "crop-count"; count.textContent = value;
        row.append(name, count); $("order-items").append(row);
      }
      $("order-reward-label").textContent = "Level bonus"; $("order-reward").textContent = "+500 pts";
      $("order-note").textContent = "Big dots let you catch ghosts.";
      return;
    }
    const signature = JSON.stringify(game.order) + game.mode;
    if (signature === lastOrder) return;
    lastOrder = signature;
    document.querySelector(".ticket-top .eyebrow").textContent = "Order";
    const container = $("order-items");
    container.replaceChildren();
    if (game.order) {
      $("order-title").textContent = "Collect these";
      $("order-description").textContent = "Fill the order for extra points.";
      $("order-number").textContent = `#${game.order.number}`;
      $("order-reward-label").textContent = "Order bonus";
      $("order-reward").textContent = "+10 pts";
      $("order-note").textContent = "Needed food has an outline.";
      for (const item of game.order.items) {
        const crop = CROPS.find((c) => c.id === item.kind);
        const row = document.createElement("div");
        row.className = `order-item${item.collected === item.needed ? " complete" : ""}`;
        const name = document.createElement("span"); name.className = "crop-name"; name.textContent = crop.name;
        const count = document.createElement("span"); count.className = "crop-count"; count.textContent = `${item.collected} / ${item.needed}`;
        count.setAttribute("aria-label", `${item.collected} of ${item.needed} ${crop.plural} collected`);
        row.append(name, count); container.append(row);
      }
    } else {
      $("order-title").textContent = "Endless mode";
      $("order-description").textContent = "Collect any food to score points.";
      $("order-number").textContent = "No orders";
      const item = document.createElement("div"); item.className = "ticket-endless";
      const text = document.createElement("span"); text.textContent = "Any food counts.";
      item.append(text); container.append(item);
      $("order-reward-label").textContent = "Max multiplier";
      $("order-reward").textContent = "x5";
      $("order-note").textContent = "Collect food quickly to keep the multiplier.";
    }
  }

  function updateHUD() {
    $("score").textContent = game.score;
    $("best").textContent = game.mode === "practice" ? "-" : Math.max(best(), game.score);
    $("best-label").textContent = game.mode === "daily" ? "Daily best" : game.mode === "practice" ? "Unranked" : "Best";
    $("score-label").textContent = "Score";
    $("chain-label").textContent = isPac() ? "Lives" : "Multiplier";
    if (isPac()) {
      $("pacman-lives").textContent = game.lives;
      $("pacman-lives").setAttribute("aria-label", `${game.lives} lives remaining`);
    } else $("combo-value").textContent = `x${Math.max(1, game.combo)}`;
    $("delivery-count").textContent = isPac() ? game.cleared : game.delivered;
    $("desk-count-label").textContent = isPac() ? "levels cleared" : "orders completed";
    $("run-time").textContent = timeText(game.duration);
    updateOrder();
  }

  function updateModeUI() {
    const active = game.status === "playing" || game.status === "paused";
    document.documentElement.classList.toggle("pacman-theme", isPac());
    gameButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.game === settings.game)));
    canvas.setAttribute("aria-label", isPac() ? "Pac-Man maze. Use arrows or W A S D to move. Clear pellets and avoid ghosts." : "Snake board. Use arrows or W A S D to steer.");
    if (isPac()) $("field-name").textContent = `Level ${game.level}`;
    else {
      modeButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === game.mode));
        button.disabled = active;
      });
      $("plot").value = game.plot;
      $("plot").disabled = active || ["daily", "practice"].includes(game.mode);
      $("plot-note").textContent = game.mode === "daily" ? "Today's layout is part of the challenge." : game.mode === "practice" ? "An open map with no rocks." : { allotment: "An open map.", orchard: "Blocks of rocks.", greenhouse: "Rows of rocks with narrow gaps." }[game.plot];
      $("mode-note").textContent = active ? "End this run to change mode or map." : {
        harvest: "Collect food to fill orders.", endless: "No orders. Play for a high score.",
        practice: "Slower speed, no rocks or best score.", daily: `${game.date}. Resets at midnight UTC.`,
      }[game.mode];
      $("field-name").textContent = PLOTS[game.plot].name;
    }
    $("pause").disabled = !active;
    $("pause").replaceChildren(document.createTextNode(game.status === "paused" ? "Resume " : "Pause "));
    const key = document.createElement("kbd"); key.textContent = "P"; $("pause").append(key);
  }

  function showScreen(kind, focus = false) {
    const screen = $("board-screen");
    screen.hidden = false;
    $("receipt").hidden = kind !== "results";
    $("secondary-action").hidden = kind === "ready";
    $("restart-run").hidden = kind !== "paused";
    if (kind === "ready") {
      screen.setAttribute("aria-label", "Start a run");
      $("screen-kicker").textContent = isPac() ? "Pac-Man" : MODES[game.mode].name;
      $("screen-title").textContent = "Ready?";
      $("screen-copy").textContent = isPac() ? "Eat all the dots and avoid ghosts." : game.order ? "Collect the outlined food to fill your order." : "Collect food. Avoid walls and your tail.";
      $("primary-action").textContent = "Start";
      $("screen-hint").textContent = touch.matches ? "Swipe to move, or enable buttons in Settings" : "Press Space to start";
    } else if (kind === "paused") {
      screen.setAttribute("aria-label", "Game paused");
      $("screen-kicker").textContent = isPac() ? "Pac-Man" : "Snake";
      $("screen-title").textContent = "Paused";
      $("screen-copy").textContent = "Continue when you are ready.";
      $("primary-action").textContent = "Resume";
      $("secondary-action").textContent = "Back to menu";
      $("screen-hint").textContent = touch.matches ? "Tap Resume to continue" : "Space or P to resume";
    }
    updateModeUI();
    if (focus) $("primary-action").focus({ preventScroll: true });
  }

  function resetRun() {
    const seed = window.crypto?.getRandomValues ? String(crypto.getRandomValues(new Uint32Array(1))[0]) : String(Date.now());
    game = isPac() ? new MoonGarden.PacGame() : new Game({ mode: settings.mode, plot: settings.plot, seed });
    accumulator = 0; runSaved = false; stampLeft = 0; messageLeft = 0; lastOrder = "";
    checkpoint = { crops: 0, delivered: 0 }; runHats = [];
    runStart = { best: best() };
    $("run-rewards").hidden = true;
    $("delivery-stamp").hidden = true;
    pacRenderer.reset();
    showMessage(normalMessage(), 0);
    updateHUD(); updateModeUI(); showScreen("ready");
  }

  function mainAction() {
    if (modalOpen()) return;
    if (["over", "won"].includes(game.status)) resetRun();
    if (game.status === "ready") {
      // Pin each daily run to the UTC day on which it actually starts.
      if (game.mode === "daily" && game.date !== dailyDate()) resetRun();
      game.start(); sound("start");
    } else if (game.status === "paused") game.resume();
    else return pause();
    $("board-screen").hidden = true;
    updateModeUI();
    canvas.focus({ preventScroll: true });
    announce(isPac() ? `Pac-Man started. ${game.lives} lives remaining. Clear every pellet, and use big dots to catch ghosts.` : `${MODES[game.mode].name} started. ${game.order ? "Collect the marked crops to fill your ticket." : "Collect crops and avoid the edges."}`);
  }

  function pause(focus = true) {
    if (game.status !== "playing") return;
    game.pause(); showScreen("paused", focus); announce("Game paused.");
  }

  function steer(direction) {
    if (modalOpen()) return;
    if (game.status === "ready") mainAction();
    if (game.status === "playing") { game.steer(direction); canvas.focus({ preventScroll: true }); }
  }

  function switchGame(id) {
    if (!["snake", "pacman"].includes(id) || id === settings.game || modalOpen()) return;
    pause(false);
    const resultFields = ["screen-kicker", "screen-title", "screen-copy", "screen-hint", "primary-action", "secondary-action"];
    sessions[settings.game] = {
      game, accumulator, runSaved, checkpoint, runStart, runHats, messageLeft,
      message: $("field-status").textContent,
      fields: Object.fromEntries(resultFields.map((key) => [key, $(key).textContent])),
      receipt: [...$("receipt").children], rewards: [...$("run-rewards").children], rewardsHidden: $("run-rewards").hidden,
    };
    settings.game = id; persist();
    toastLeft = 0; toastQueue.length = 0; $("hat-toast").hidden = true;
    stampLeft = 0; $("delivery-stamp").hidden = true;
    pacRenderer.reset();
    const session = sessions[id];
    if (!session) resetRun();
    else {
      ({ game, accumulator, runSaved, checkpoint, runStart, runHats, messageLeft } = session);
      lastOrder = ""; $("field-status").textContent = session.message;
      updateHUD();
      showScreen(game.status === "paused" ? "paused" : ["over", "won"].includes(game.status) ? "results" : "ready");
      if (["over", "won"].includes(game.status)) {
        for (const [key, text] of Object.entries(session.fields)) $(key).textContent = text;
        $("receipt").replaceChildren(...session.receipt);
        $("run-rewards").replaceChildren(...session.rewards); $("run-rewards").hidden = session.rewardsHidden;
      } else $("run-rewards").hidden = true;
    }
    $("primary-action").focus({ preventScroll: true });
    announce(`${isPac() ? "Pac-Man" : "Snake"} selected.${game.status === "paused" ? " Your run is paused. Resume when you are ready." : ""}`);
  }

  function updateCollection() {
    const options = $("snake-pattern").options;
    options[1].disabled = data.lifetimeCrops < 25;
    options[1].textContent = data.lifetimeCrops >= 25 ? "Dots" : `Dots - ${data.lifetimeCrops}/25 crops`;
    options[2].disabled = data.maxOrders < 5;
    options[2].textContent = data.maxOrders >= 5 ? "Stripes" : `Stripes - ${data.maxOrders}/5 orders in one run`;
    $("collection-note").textContent = `${data.lifetimeCrops} crops picked. ${earned(data).length} of ${HATS.length} hats collected - visit Hats to try them on.`;
  }

  function progressText(hat) {
    const p = progress(data, hat);
    return hat.unit === "rhythm" ? `x${p.value} / x${p.target} rhythm` : `${p.value} / ${p.target} ${hat.unit}`;
  }

  function buildWardrobe() {
    for (const hat of HATS) {
      const card = document.createElement("button");
      card.type = "button"; card.className = "hat-card"; card.dataset.hat = hat.id;
      const name = document.createElement("strong"); name.textContent = hat.name;
      const goal = document.createElement("span"); goal.className = "hat-goal"; goal.textContent = hat.goal;
      const state = document.createElement("span"); state.className = "hat-card-state";
      card.append(name, goal, state);
      card.addEventListener("click", () => {
        if (canEquip(data, hat.id)) {
          settings.hat = hat.id; persist();
          $("wardrobe-feedback").textContent = `${hat.name} equipped.`;
          announce(`${hat.name} equipped on your snake.`);
        } else {
          $("wardrobe-feedback").textContent = `${hat.goal} to earn this hat. ${progressText(hat)} so far.`;
        }
        updateWardrobe();
      });
      $("hat-collection").append(card);
    }
  }

  function updateWardrobe() {
    const count = earned(data).length;
    const equipped = HATS.find((hat) => hat.id === settings.hat);
    $("nav-hat-count").textContent = `${count}/${HATS.length}`;
    $("wardrobe-count").textContent = `${count} of ${HATS.length} collected`;
    $("equipped-name").textContent = equipped ? equipped.name : "Bareheaded";
    const next = HATS.find((hat) => !unlocked(data, hat));
    $("next-hat-label").textContent = next ? `Next: ${next.name}` : "All hats unlocked.";
    $("next-hat-count").textContent = next ? progressText(next) : `${count} / ${HATS.length}`;
    $("remove-hat").setAttribute("aria-pressed", String(settings.hat === "none"));
    for (const card of $("hat-collection").children) {
      const hat = HATS.find((item) => item.id === card.dataset.hat);
      const owned = unlocked(data, hat), equipped = settings.hat === hat.id;
      card.classList.toggle("is-locked", !owned);
      card.setAttribute("aria-pressed", String(equipped));
      card.setAttribute("aria-label", `${hat.name}. ${equipped ? "Equipped" : owned ? "Earned. Select to equip" : `Locked. ${hat.goal}. ${progressText(hat)}`}.`);
      card.querySelector(".hat-card-state").textContent = equipped ? "Equipped" : owned ? "Wear hat" : `Locked: ${progressText(hat)}`;
    }
  }

  function saveProgress() {
    if (isPac()) return;
    const result = recordProgress(data, game, checkpoint);
    checkpoint = result.checkpoint;
    if (result.gained.length) {
      runHats.push(...result.gained); toastQueue.push(...result.gained);
      announce(`Hat${result.gained.length > 1 ? "s" : ""} unlocked: ${result.gained.map((hat) => hat.name).join(", ")}. Open Hats to equip.`);
      showNextHatToast();
    }
    persist(); updateCollection(); updateWardrobe();
  }

  function showNextHatToast() {
    if (toastLeft > 0 || !toastQueue.length) return;
    const hat = toastQueue.shift();
    $("toast-name").textContent = hat.name;
    $("hat-toast").hidden = false; toastLeft = 6000;
    sound("bonus");
  }

  function openWardrobe() {
    $("wardrobe-feedback").textContent = "Choose an unlocked hat to wear it.";
    toastLeft = 0; toastQueue.length = 0; $("hat-toast").hidden = true;
    updateWardrobe(); openDialog("wardrobe-dialog");
  }

  function finishRun() {
    if (runSaved) return;
    runSaved = true;
    const newBest = (isPac() || MODES[game.mode].ranked) && game.score > runStart.best;
    saveProgress();
    if (newBest) data.records[recordId()] = game.score;
    persist(); updateCollection(); updateHUD();
    $("screen-kicker").textContent = newBest ? "New best score!" : "Results";
    $("screen-title").textContent = game.status === "won" ? "You won!" : "Game over";
    $("screen-copy").textContent = game.cause;
    const receipt = $("receipt"); receipt.replaceChildren();
    const rows = isPac() ? [["Score", game.score], ["Pellets eaten", game.eaten], ["Ghosts caught", game.ghostsEaten], ["Levels cleared", game.cleared]] : [["Score", game.score], ["Crops picked", game.crops]];
    if (game.order) rows.push(["Orders completed", game.delivered]);
    if (!isPac()) rows.push(["Best multiplier", `x${Math.max(1, game.bestCombo)}`]);
    rows.push(["Time", timeText(game.duration)]);
    for (const [label, value] of rows) {
      const row = document.createElement("div"), term = document.createElement("dt"), detail = document.createElement("dd");
      term.textContent = label; detail.textContent = value; row.append(term, detail); receipt.append(row);
    }
    $("primary-action").textContent = "Play again";
    $("secondary-action").textContent = "Back to menu";
    $("screen-hint").textContent = "Try again or choose another game.";
    $("board-screen").setAttribute("aria-label", "Run results");
    showScreen("results", true);
    if (runHats.length) {
      const rewards = $("run-rewards"); rewards.replaceChildren();
      const label = document.createElement("span");
      label.textContent = `${runHats.length === 1 ? runHats[0].name : `${runHats.length} new hats`} earned. Open Hats to equip.`;
      rewards.append(label); rewards.hidden = false;
    }
    $("delivery-stamp").hidden = true;
    sound("finish");
    announce(`${game.cause} Score ${game.score}. ${isPac() ? `${game.cleared} gardens cleared.` : `${game.delivered} baskets delivered.`}${newBest ? " A new personal best." : ""}`);
  }

  function handlePacEvents() {
    const events = game.drain();
    if (!events.length) return;
    for (const event of events) {
      if (event.type === "pellet") sound("eat", 1 + game.eaten % 2);
      else if (event.type === "power") { sound("bonus"); showMessage("Power active. Catch the blue ghosts."); announce(`Ghost power for ${Math.round(game.powerDuration / 1000)} seconds. Ghosts are edible.`); }
      else if (event.type === "capture") { sound("bonus"); showMessage(`${event.name} caught. +${event.points} points.`); }
      else if (event.type === "fruit-ready") showMessage("Bonus fruit appeared near the start.");
      else if (event.type === "fruit") { sound("delivery"); showMessage(`Fruit collected. +${event.points} points.`); }
      else if (event.type === "clear") { sound("delivery"); showMessage(`Level complete! +500 points.`); announce("Maze cleared. Five hundred bonus points. The next level starts shortly."); }
      else if (event.type === "night") { sound("start"); showMessage(`Level ${game.level}.`); }
      else if (event.type === "life") { sound("finish"); showMessage(`${event.lives} ${event.lives === 1 ? "life" : "lives"} left. Starting again.`); announce(`${event.lives} lives remaining.`); }
      else if (event.type === "extra-life") { sound("delivery"); showMessage("Extra life earned!"); announce(`Extra life earned. ${event.lives} lives remaining.`); }
      else if (event.type === "finish") finishRun();
    }
    if (game.score > best()) { data.records[recordId()] = game.score; persist(); }
    updateHUD();
    if (events.some((event) => event.type === "night")) updateModeUI();
  }

  function handleEvents() {
    if (isPac()) return handlePacEvents();
    const events = game.drain();
    if (events.some((event) => ["eat", "delivery", "bonus"].includes(event.type))) saveProgress();
    for (const event of events) {
      if (event.type === "eat") {
        sound("eat", game.combo);
      } else if (event.type === "delivery") {
        sound("delivery"); stampLeft = 1600; $("delivery-stamp").hidden = false;
        showMessage(`Order ${event.number} complete. +10 points.`);
        announce(`Basket ${event.number} delivered. Ten bonus points. A new harvest ticket is ready.`);
      } else if (event.type === "bonus") { sound("bonus"); showMessage("Bonus food! +5 points."); }
      else if (event.type === "warning") { showMessage("A rock will appear inside the red outline."); announce("A new stone is marked on the field before it appears."); }
      else if (event.type === "finish") finishRun();
    }
    updateHUD();
  }

  function applySettings() {
    $("touch-controls").classList.toggle("visible", settings.controls);
    $("sound-button").textContent = settings.muted || !settings.volume ? "Sound off" : "Sound on";
    $("sound-button").setAttribute("aria-pressed", String(settings.muted || !settings.volume));
    $("sound-button").setAttribute("aria-label", settings.muted || !settings.volume ? "Turn sound on" : "Turn sound off");
    $("volume").value = settings.volume;
    $("volume-value").textContent = `${settings.volume}%`;
    $("show-grid").checked = settings.grid;
    $("gentle-motion").checked = gentle();
    $("gentle-motion").disabled = reducedMotion.matches;
    $("show-controls").checked = settings.controls;
    $("snake-pattern").value = settings.pattern;
    if (!storageAvailable) $("record-note").textContent = "Scores last for this visit. Browser storage is unavailable.";
    updateCollection();
    updateWardrobe();
  }

  function toggleSound() {
    settings.muted = !(settings.muted || !settings.volume);
    if (!settings.muted && !settings.volume) settings.volume = 35;
    applySettings(); persist();
    if (!settings.muted) sound("eat");
  }

  function openDialog(id) {
    dialogFocus = document.activeElement;
    pause(false);
    $(id).showModal();
  }
  ["settings-dialog", "help-dialog", "wardrobe-dialog"].forEach((id) => {
    $(id).addEventListener("close", () => {
      if (game.status === "paused") $("primary-action").focus({ preventScroll: true });
      else if (dialogFocus?.isConnected) dialogFocus.focus({ preventScroll: true });
    });
  });
  $("settings-button").addEventListener("click", () => openDialog("settings-dialog"));
  $("help-button").addEventListener("click", () => openDialog("help-dialog"));
  ["hats-button", "wardrobe-button", "hat-toast", "run-rewards"].forEach((id) => $(id).addEventListener("click", openWardrobe));
  $("remove-hat").addEventListener("click", () => {
    settings.hat = "none"; persist(); updateWardrobe();
    $("wardrobe-feedback").textContent = "Hat removed.";
  });
  $("primary-action").addEventListener("click", mainAction);
  $("restart-run").addEventListener("click", () => {
    if (game.status !== "paused") return;
    game.finish("over", isPac() ? "You restarted." : "You restarted."); handleEvents(); resetRun(); mainAction();
  });
  $("secondary-action").addEventListener("click", () => {
    if (game.status === "paused") { game.finish("over", isPac() ? "You ended the run." : "You ended the run."); handleEvents(); }
    resetRun(); $("primary-action").focus({ preventScroll: true });
  });
  $("pause").addEventListener("click", mainAction);
  $("sound-button").addEventListener("click", toggleSound);
  modeButtons.forEach((button) => button.addEventListener("click", () => {
    if (isPac()) return;
    if (["playing", "paused"].includes(game.status)) return;
    settings.mode = button.dataset.mode; persist(); resetRun();
  }));
  gameButtons.forEach((button) => button.addEventListener("click", () => switchGame(button.dataset.game)));
  $("plot").addEventListener("change", () => { settings.plot = $("plot").value; persist(); resetRun(); });
  $("volume").addEventListener("input", () => {
    settings.volume = Number($("volume").value); settings.muted = settings.volume === 0; applySettings(); persist();
  });
  $("volume").addEventListener("change", () => sound("eat"));
  [["show-grid", "grid"], ["gentle-motion", "gentle"], ["show-controls", "controls"]].forEach(([id, key]) => {
    $(id).addEventListener("change", () => { settings[key] = $(id).checked; applySettings(); persist(); });
  });
  $("snake-pattern").addEventListener("change", () => { settings.pattern = $("snake-pattern").value; persist(); updateWardrobe(); });
  reducedMotion.addEventListener("change", applySettings);

  document.addEventListener("keydown", (event) => {
    if (modalOpen() || event.altKey || event.ctrlKey || event.metaKey || event.target.closest("input, select, textarea, [contenteditable]")) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["p", "Escape"].includes(key) && ["playing", "paused"].includes(game.status)) {
      event.preventDefault(); if (!event.repeat) mainAction(); return;
    }
    if (event.target.closest("button, a")) return;
    if (keys[key]) { event.preventDefault(); if (!event.repeat) steer(keys[key]); }
    else if ([" ", "Enter", "p", "Escape"].includes(key)) {
      event.preventDefault();
      if (!event.repeat && (!["p", "Escape"].includes(key) || ["playing", "paused"].includes(game.status))) mainAction();
    } else if (key === "m" && !event.repeat) { event.preventDefault(); toggleSound(); }
  });
  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); steer(button.dataset.direction); });
    button.addEventListener("click", (event) => { if (!event.detail) steer(button.dataset.direction); });
  });
  let pointer = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (game.status !== "playing") return;
    pointer = { x: event.clientX, y: event.clientY, swiped: false, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(12, canvas.clientWidth * .035)) return;
    steer(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up");
    pointer.x = event.clientX; pointer.y = event.clientY; pointer.swiped = true;
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const tapped = !pointer.swiped; pointer = null;
    if (tapped) pause();
  });
  canvas.addEventListener("pointercancel", () => { pointer = null; });
  canvas.addEventListener("lostpointercapture", () => { pointer = null; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(false); });
  window.addEventListener("blur", () => pause(false));
  window.addEventListener("resize", () => renderer.resize());

  if (data.legacyBest) { $("legacy-best").hidden = false; $("legacy-best").textContent = `Your original Snake: Farm Edition best: ${data.legacyBest}. Preserved separately because the scoring has changed.`; }
  buildWardrobe(); applySettings(); resetRun();

  function frame(timestamp) {
    const delta = previousFrame === null ? 0 : Math.min(150, timestamp - previousFrame);
    previousFrame = timestamp;
    if (game.status === "playing") {
      accumulator += delta;
      while (game.status === "playing" && accumulator >= game.speed) {
        const stepDuration = game.speed;
        accumulator -= stepDuration; game.step(); handleEvents();
      }
      if (stampLeft > 0) { stampLeft -= delta; if (stampLeft <= 0) $("delivery-stamp").hidden = true; }
      if (messageLeft > 0) { messageLeft -= delta; if (messageLeft <= 0) $("field-status").textContent = normalMessage(); }
    }
    const progress = Math.min(1, accumulator / game.speed);
    if (toastLeft > 0 && !modalOpen()) {
      toastLeft -= delta;
      if (toastLeft <= 0) { $("hat-toast").hidden = true; showNextHatToast(); }
    }
    if (isPac()) {
      hudWait += delta;
      if (hudWait >= 200) { hudWait %= 200; updateHUD(); }
    }
    const view = isPac() ? pacRenderer : renderer;
    view.draw(game, progress, game.status === "paused" || modalOpen() ? 0 : delta, { ...settings, gentle: gentle() });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
