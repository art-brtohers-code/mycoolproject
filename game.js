(() => {
  "use strict";
  const { Game, CROPS, MODES, PLOTS, dailyDate, recordKey } = PlotTwist;
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const renderer = new GardenRenderer(canvas);
  const pacRenderer = new PacRenderer(canvas, renderer);
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
  let previewHat = settings.hat;
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
  let assetsReady = false;
  let assetFailure = false;
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
    $("record-note").textContent = storageAvailable ? "Best scores stay in this browser." : "Scores last for this visit. Browser storage is unavailable.";
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
    if (isPac()) return "Clear the paths. The side tunnels join across the garden.";
    if (game.mode === "practice") return "Easy does it. There’s no clock to beat.";
    if (game.mode === "daily") return `${game.date} · The next plot arrives at 00:00 UTC.`;
    if (game.mode === "endless") return "An appetite with no off switch.";
    return game.crops ? "Marked crops fill your market order." : "Mind the walls. Follow your appetite.";
  }

  function createIcon(kind) {
    const icon = document.createElement("canvas");
    icon.width = 100; icon.height = 110; icon.className = "crop-art";
    icon.setAttribute("aria-hidden", "true");
    renderer.paintIcon(icon, kind);
    return icon;
  }

  function updateOrder() {
    if (isPac()) {
      const signature = `${game.level}:${game.pellets.size}:${Math.ceil(game.powerMs / 1000)}:${assetsReady}`;
      if (signature === lastOrder) return;
      lastOrder = signature;
      $("order-title").textContent = "Midnight snack.";
      $("order-description").textContent = "A moonlit maze. Four uninvited guests.";
      $("order-number").textContent = `Night ${pad(game.level, 2)}`;
      document.querySelector(".ticket-top .eyebrow").textContent = "Moon garden";
      $("order-items").replaceChildren();
      for (const [label, value, power] of [["Pellets left", game.pellets.size, false], ["Lantern power", game.powerMs > 0 ? `${Math.ceil(game.powerMs / 1000)}s` : "—", true]]) {
        const row = document.createElement("div"); row.className = "order-item";
        const icon = document.createElement("canvas"); icon.width = icon.height = 100; icon.className = "crop-art"; icon.setAttribute("aria-hidden", "true"); pacRenderer.paintTicketIcon(icon, power);
        const name = document.createElement("span"); name.className = "crop-name"; name.textContent = label;
        const count = document.createElement("span"); count.className = "crop-count"; count.textContent = value;
        row.append(icon, name, count); $("order-items").append(row);
      }
      $("order-reward-label").textContent = "A clean plate"; $("order-reward").textContent = "+500 pts";
      $("order-note").textContent = "Light a lantern. Give the ghosts a little fright.";
      return;
    }
    const signature = JSON.stringify(game.order) + assetsReady + game.mode;
    if (signature === lastOrder) return;
    lastOrder = signature;
    document.querySelector(".ticket-top .eyebrow").textContent = "Market order";
    const container = $("order-items");
    container.replaceChildren();
    if (game.order) {
      $("order-title").textContent = "For the kitchen.";
      $("order-description").textContent = "Fresh from your little patch.";
      $("order-number").textContent = `No. ${pad(game.order.number)}`;
      $("order-reward-label").textContent = "Delivery bonus";
      $("order-reward").textContent = "+10 pts";
      $("order-note").textContent = "Pick the marked crops. We’ll take the lot.";
      for (const item of game.order.items) {
        const crop = CROPS.find((c) => c.id === item.kind);
        const row = document.createElement("div");
        row.className = `order-item${item.collected === item.needed ? " complete" : ""}`;
        const name = document.createElement("span"); name.className = "crop-name"; name.textContent = crop.name;
        const count = document.createElement("span"); count.className = "crop-count"; count.textContent = `${item.collected} / ${item.needed}`;
        count.setAttribute("aria-label", `${item.collected} of ${item.needed} ${crop.plural} collected`);
        row.append(createIcon(item.kind), name, count); container.append(row);
      }
    } else {
      $("order-title").textContent = "À la carte.";
      $("order-description").textContent = "No orders. Just a growing appetite.";
      $("order-number").textContent = "Free to roam";
      const item = document.createElement("div"); item.className = "ticket-endless";
      const text = document.createElement("span"); text.textContent = "Everything’s on the menu.";
      item.append(createIcon("carrot"), text); container.append(item);
      $("order-reward-label").textContent = "Maximum crop multiplier";
      $("order-reward").textContent = "×5";
      $("order-note").textContent = "Keep picking to keep your rhythm.";
    }
  }

  function updateHUD() {
    $("score").textContent = pad(game.score);
    $("best").textContent = game.mode === "practice" ? "—" : pad(Math.max(best(), game.score));
    $("best-label").textContent = game.mode === "daily" ? "Daily best" : game.mode === "practice" ? "No pressure" : "Personal best";
    $("score-label").textContent = isPac() ? "Night score" : "Your harvest";
    $("chain-label").textContent = isPac() ? "Your lives" : "Your rhythm";
    if (isPac()) {
      pacRenderer.paintLives($("pacman-lives"), game.lives);
      $("pacman-lives").setAttribute("aria-label", `${game.lives} lives remaining`);
    } else $("combo-value").textContent = `×${Math.max(1, game.combo)}`;
    $("delivery-count").textContent = pad(isPac() ? game.cleared : game.delivered, 2);
    $("desk-count-label").innerHTML = isPac() ? "gardens cleared<br><small>The night is still young.</small>" : "baskets delivered<br><small>A good day’s work.</small>";
    $("run-time").textContent = timeText(game.duration);
    updateOrder();
  }

  function updateModeUI() {
    const active = game.status === "playing" || game.status === "paused";
    document.documentElement.classList.toggle("pacman-theme", isPac());
    gameButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.game === settings.game)));
    canvas.setAttribute("aria-label", isPac() ? "Pac-Man moon garden maze. Use arrows or W A S D to move. Clear pellets and avoid ghosts." : "Snake garden field. Use arrows or W A S D to steer.");
    const art = document.querySelector(".poster-art"), source = isPac() ? "assets/moon-garden-poster.png" : "assets/garden-mascot.png";
    if (art.getAttribute("src") !== source) art.src = source;
    art.alt = isPac() ? "Golden Pac-Man and three garden ghosts among lemon branches, moonflowers, and a crescent moon." : "An olive-green snake wrapped around an enormous tomato, with radishes and leaves at its tail.";
    document.querySelector(".poster-description").textContent = isPac() ? "Pac-Man / The moon garden" : "A garden snake game";
    document.querySelector(".poster-eyebrow").textContent = isPac() ? "Open late. Come hungry." : "Locally grown. Dangerously moreish.";
    document.querySelector(".poster-motto").innerHTML = isPac() ? "Midnight snack.<br>Moonlit mischief." : "A little appetite.<br>A lot of trouble.";
    document.querySelector(".screen-admission").textContent = isPac() ? "Admit one midnight snacker" : "Admit one hungry snake";
    if (isPac()) $("field-name").textContent = `${pad(game.level, 2)} / ${pacRenderer.getPalette(game.level).title}`;
    else {
      modeButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === game.mode));
        button.disabled = active;
      });
      $("plot").value = game.plot;
      $("plot").disabled = active || ["daily", "practice"].includes(game.mode);
      $("plot-note").textContent = game.mode === "daily" ? "Today's layout is part of the challenge." : game.mode === "practice" ? "A clear field. No stones, no hurry." : PLOTS[game.plot].description;
      $("mode-note").textContent = active ? "Finish this run, or pause and return to the garden to change modes." : {
        harvest: "Pick to order. Deliver a basket. Repeat.", endless: "No shopping list. Just a very long lunch.",
        practice: "Slow and steady. No stones and no ranked score.", daily: `${game.date} · Resets at midnight UTC. Retry as often as you like.`,
      }[game.mode];
      $("field-name").textContent = `${pad(Object.keys(PLOTS).indexOf(game.plot) + 1, 2)} / The ${game.plot}`;
    }
    $("pause").disabled = !active;
    $("pause").replaceChildren(document.createTextNode(game.status === "paused" ? "Resume " : "Pause "));
    const key = document.createElement("kbd"); key.textContent = "P"; $("pause").append(key);
  }

  function showScreen(kind, focus = false) {
    const screen = $("board-screen");
    screen.hidden = false;
    screen.dataset.state = kind;
    screen.classList.toggle("results", kind === "results");
    $("receipt").hidden = kind !== "results";
    $("secondary-action").hidden = kind === "ready";
    $("restart-run").hidden = kind !== "paused";
    if (kind === "ready") {
      screen.setAttribute("aria-label", "Start a run");
      document.querySelector(".screen-serial").textContent = "The garden is open";
      $("screen-kicker").textContent = game.mode === "daily" ? `Today's plot / ${game.date}` : game.mode === "practice" ? "No hurry. No pressure." : "Come on in, hungry snake";
      $("screen-title").innerHTML = game.mode === "daily" ? "Daily<br>greens." : game.mode === "practice" ? "Take it<br>slow." : game.mode === "endless" ? "Big<br>appetite." : "Lettuce<br>begin.";
      $("screen-copy").textContent = game.order ? "Collect the crops on your ticket. Leave yourself a way out." : "Follow your appetite. Keep picking, and keep your tail out of trouble.";
      $("primary-action").textContent = game.mode === "daily" ? "Play today's plot" : game.mode === "practice" ? "Take a practice run" : game.mode === "endless" ? "Dig in" : "Let’s play";
      $("screen-hint").textContent = touch.matches ? "Swipe or use the direction buttons to steer" : "or press Space to dig in";
      if (isPac()) {
        document.querySelector(".screen-serial").textContent = "Moon garden / After hours";
        $("screen-kicker").textContent = "Pac-Man · The night shift";
        $("screen-title").innerHTML = "Midnight<br>snack.";
        $("screen-copy").textContent = "Clear every pellet. Light a lantern, then turn the chase around.";
        $("primary-action").textContent = "Into the maze";
      }
    } else if (kind === "paused") {
      screen.setAttribute("aria-label", "Game paused");
      document.querySelector(".screen-serial").textContent = "Back in a little bit";
      $("screen-kicker").textContent = "The garden can wait";
      $("screen-title").innerHTML = "Snack<br>break.";
      $("screen-copy").textContent = "Your patch is right where you left it.";
      $("primary-action").textContent = "Back to it";
      $("secondary-action").textContent = "Return to garden";
      $("screen-hint").textContent = touch.matches ? "Tap Back to it when you're ready" : "Space or P to resume";
    }
    if (!assetsReady && kind === "ready") {
      $("primary-action").disabled = true;
      $("screen-hint").textContent = assetFailure ? "Artwork could not load. Reload to try again." : "Unpacking the garden…";
    } else $("primary-action").disabled = false;
    updateModeUI();
    if (focus) $("primary-action").focus({ preventScroll: true });
  }

  function resetRun() {
    const seed = window.crypto?.getRandomValues ? String(crypto.getRandomValues(new Uint32Array(1))[0]) : String(Date.now());
    game = isPac() ? new MoonGarden.PacGame() : new Game({ mode: settings.mode, plot: settings.plot, seed });
    accumulator = 0; runSaved = false; stampLeft = 0; messageLeft = 0; lastOrder = "";
    checkpoint = { crops: 0, delivered: 0 }; runHats = [];
    runStart = { crops: data.lifetimeCrops, orders: data.maxOrders, best: best() };
    $("run-rewards").hidden = true;
    $("delivery-stamp").hidden = true;
    renderer.reset(); pacRenderer.reset();
    showMessage(normalMessage(), 0);
    updateHUD(); updateModeUI(); showScreen("ready");
  }

  function mainAction() {
    if (modalOpen() || !assetsReady) return;
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
    announce(isPac() ? `Pac-Man started. ${game.lives} lives remaining. Clear every pellet, and use flower lanterns to catch ghosts.` : `${MODES[game.mode].name} started. ${game.order ? "Collect the marked crops to fill your ticket." : "Collect crops and avoid the edges."}`);
  }

  function pause(focus = true) {
    if (game.status !== "playing") return;
    game.pause(); showScreen("paused", focus); announce("Game paused.");
  }

  function steer(direction) {
    if (modalOpen() || !assetsReady) return;
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
    renderer.reset(); pacRenderer.reset();
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
    const other = isPac() ? "snake" : "pacman";
    $("game-switch-note").textContent = sessions[other]?.game.status === "paused" ? `${isPac() ? "Snake" : "Pac-Man"} is waiting, paused. Pick it again to return.` : "Switch any time. Your other game waits, paused.";
    $("primary-action").focus({ preventScroll: true });
    announce(`${isPac() ? "Pac-Man" : "Snake"} selected.${game.status === "paused" ? " Your run is paused. Resume when you are ready." : ""}`);
  }

  function updateCollection() {
    const options = $("snake-pattern").options;
    options[1].disabled = data.lifetimeCrops < 25;
    options[1].textContent = data.lifetimeCrops >= 25 ? "Seed freckles" : `Seed freckles — ${data.lifetimeCrops}/25 crops`;
    options[2].disabled = data.maxOrders < 5;
    options[2].textContent = data.maxOrders >= 5 ? "Garden bands" : `Garden bands — ${data.maxOrders}/5 orders in one run`;
    $("collection-note").textContent = `${data.lifetimeCrops} crops picked. ${earned(data).length} of ${HATS.length} hats collected — visit Hats to try them on.`;
  }

  function hatArt(id, className = "hat-art") {
    const art = document.createElement("canvas");
    art.width = art.height = 180; art.className = className;
    art.setAttribute("aria-hidden", "true"); renderer.paintHat(art, id);
    return art;
  }

  function progressText(hat) {
    const p = progress(data, hat);
    return hat.unit === "rhythm" ? `×${p.value} / ×${p.target} rhythm` : `${p.value} / ${p.target} ${hat.unit}`;
  }

  function buildWardrobe() {
    for (const hat of HATS) {
      const card = document.createElement("button");
      card.type = "button"; card.className = "hat-card"; card.dataset.hat = hat.id;
      const serial = document.createElement("span"); serial.className = "hat-serial"; serial.textContent = `No. ${pad(hat.tile + 1, 2)}`; serial.setAttribute("aria-hidden", "true");
      const name = document.createElement("strong"); name.textContent = hat.name;
      const goal = document.createElement("span"); goal.className = "hat-goal"; goal.textContent = hat.goal;
      const bar = document.createElement("span"); bar.className = "hat-card-track"; bar.setAttribute("aria-hidden", "true"); bar.append(document.createElement("span"));
      const state = document.createElement("span"); state.className = "hat-card-state";
      card.append(serial, hatArt(hat.id), name, goal, bar, state);
      card.addEventListener("click", () => {
        previewHat = hat.id;
        if (canEquip(data, hat.id)) {
          settings.hat = hat.id; persist();
          $("wardrobe-feedback").textContent = `${hat.name} equipped. Looking good.`;
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
    renderer.paintHat($("nav-hat"), settings.hat === "none" ? "straw" : settings.hat);
    renderer.paintPreview($("desk-snake"), settings.hat, settings.pattern);
    renderer.paintPreview($("snake-game-art"), settings.hat, settings.pattern);
    const next = HATS.find((hat) => !unlocked(data, hat));
    $("next-hat-label").textContent = next ? `Next: ${next.name}` : "The whole hat rack. Yours.";
    $("next-hat-count").textContent = next ? progressText(next) : `${count} / ${HATS.length}`;
    const nextProgress = $("next-hat-progress");
    const p = next ? progress(data, next) : { value: HATS.length, target: HATS.length, percent: 100 };
    nextProgress.setAttribute("aria-valuemax", p.target);
    nextProgress.setAttribute("aria-valuenow", p.value);
    nextProgress.setAttribute("aria-label", next ? next.goal : "All hats collected");
    nextProgress.firstElementChild.style.width = `${p.percent}%`;
    const preview = HATS.find((hat) => hat.id === previewHat);
    $("preview-name").textContent = preview ? preview.name : "Au naturel.";
    $("preview-note").textContent = preview ? preview.note : "A good head of greens needs no dressing.";
    $("hat-preview").setAttribute("aria-label", preview ? `Snake preview wearing ${preview.name}${unlocked(data, preview) ? "" : ", not yet earned"}` : "Your snake without a hat");
    renderer.paintPreview($("hat-preview"), previewHat, settings.pattern);
    $("remove-hat").setAttribute("aria-pressed", String(settings.hat === "none"));
    for (const card of $("hat-collection").children) {
      const hat = HATS.find((item) => item.id === card.dataset.hat);
      const owned = unlocked(data, hat), equipped = settings.hat === hat.id;
      card.classList.toggle("is-locked", !owned);
      card.classList.toggle("is-previewed", previewHat === hat.id);
      card.setAttribute("aria-pressed", String(equipped));
      card.setAttribute("aria-label", `${hat.name}. ${equipped ? "Equipped" : owned ? "Earned. Select to equip" : `Locked. Select to preview. ${hat.goal}. ${progressText(hat)}`}.`);
      card.querySelector(".hat-card-state").textContent = equipped ? "✓ On your snake" : owned ? "Wear this hat ↗" : progressText(hat);
      card.querySelector(".hat-card-track > span").style.width = `${progress(data, hat).percent}%`;
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
    renderer.paintHat($("toast-hat"), hat.id);
    $("toast-name").textContent = hat.name;
    $("hat-toast").hidden = false; toastLeft = 6000;
    sound("bonus");
  }

  function openWardrobe() {
    previewHat = settings.hat;
    $("wardrobe-feedback").textContent = "Choose a hat to wear it. Select an unearned hat for a preview.";
    toastLeft = 0; toastQueue.length = 0; $("hat-toast").hidden = true;
    updateWardrobe(); openDialog("wardrobe-dialog");
  }

  function finishRun() {
    if (runSaved) return;
    runSaved = true;
    const newBest = (isPac() || MODES[game.mode].ranked) && game.score > runStart.best;
    const oldCrops = runStart.crops, oldOrders = runStart.orders;
    saveProgress();
    if (newBest) data.records[recordId()] = game.score;
    persist(); updateCollection(); updateHUD();
    $("screen-kicker").textContent = newBest ? "A new personal best" : isPac() ? "Your night shift receipt" : game.mode === "practice" ? "Practice makes progress" : "Your harvest receipt";
    $("screen-title").textContent = isPac() ? "Good night." : game.status === "won" ? "The plot is yours." : "That’s a wrap.";
    $("screen-copy").textContent = game.cause;
    const receipt = $("receipt"); receipt.replaceChildren();
    const rows = isPac() ? [["Night score", pad(game.score)], ["Pellets eaten", game.eaten], ["Ghosts caught", game.ghostsEaten], ["Gardens cleared", game.cleared]] : [["Harvest score", pad(game.score)], ["Crops picked", game.crops]];
    if (game.order) rows.push(["Baskets delivered", game.delivered]);
    if (!isPac()) rows.push(["Best rhythm", `×${Math.max(1, game.bestCombo)}`]);
    rows.push(["Time in the garden", timeText(game.duration)]);
    for (const [label, value] of rows) {
      const row = document.createElement("div"), term = document.createElement("dt"), detail = document.createElement("dd");
      term.textContent = label; detail.textContent = value; row.append(term, detail); receipt.append(row);
    }
    $("primary-action").textContent = isPac() ? "One more night" : game.mode === "daily" ? "Try today's plot again" : "Plant another run";
    $("secondary-action").textContent = "Back to the garden";
    $("screen-hint").textContent = isPac() ? "The moon garden will be here when you’re hungry." : oldOrders < 5 && data.maxOrders >= 5 ? "Unlocked: Garden bands. Find them in Settings." : oldCrops < 25 && data.lifetimeCrops >= 25 ? "Unlocked: Seed freckles. Find them in Settings." : "Still hungry? There’s always another round.";
    $("board-screen").setAttribute("aria-label", "Run results");
    showScreen("results", true);
    if (runHats.length) {
      const rewards = $("run-rewards"); rewards.replaceChildren();
      const label = document.createElement("span");
      label.textContent = `${runHats.length === 1 ? runHats[0].name : `${runHats.length} new hats`} earned. Try ${runHats.length === 1 ? "it" : "them"} on ↗`;
      rewards.append(hatArt(runHats[0].id), label); rewards.hidden = false;
    }
    $("delivery-stamp").hidden = true;
    sound("finish");
    announce(`${game.cause} Score ${game.score}. ${isPac() ? `${game.cleared} gardens cleared.` : `${game.delivered} baskets delivered.`}${newBest ? " A new personal best." : ""}`);
  }

  function handlePacEvents() {
    const events = game.drain();
    if (!events.length) return;
    for (const event of events) {
      pacRenderer.addEvent(event, gentle());
      if (event.type === "pellet") sound("eat", 1 + game.eaten % 2);
      else if (event.type === "power") { sound("bonus"); showMessage("Lantern lit. Your turn to do the chasing."); announce(`Lantern power for ${Math.round(game.powerDuration / 1000)} seconds. Ghosts are edible.`); }
      else if (event.type === "capture") { sound("bonus"); showMessage(`${event.name} caught. +${event.points} points.`); }
      else if (event.type === "fruit-ready") showMessage("A midnight treat is waiting near your starting point.");
      else if (event.type === "fruit") { sound("delivery"); showMessage(`A sweet detour. +${event.points} points.`); }
      else if (event.type === "clear") { sound("delivery"); showMessage(`Garden cleared. +500. A new night is on its way.`); announce("Maze cleared. Five hundred bonus points. The next night starts shortly."); }
      else if (event.type === "night") { sound("start"); showMessage(`Night ${game.level}. ${pacRenderer.getPalette(game.level).title}.`); }
      else if (event.type === "life") { sound("finish"); showMessage(`${event.lives} ${event.lives === 1 ? "life" : "lives"} left. A fresh start at the gate.`); announce(`${event.lives} lives remaining.`); }
      else if (event.type === "extra-life") { sound("delivery"); showMessage("Ten thousand well-earned points. An extra life."); announce(`Extra life earned. ${event.lives} lives remaining.`); }
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
      renderer.addEvent(event, gentle());
      if (event.type === "eat") {
        sound("eat", game.combo);
        if (!gentle()) $("score").animate([{ transform: "translateY(-2px)" }, { transform: "translateY(0)" }], { duration: 180 });
      } else if (event.type === "delivery") {
        sound("delivery"); stampLeft = 1600; $("delivery-stamp").hidden = false;
        showMessage(`Basket ${event.number} delivered. A fresh ticket is ready.`);
        announce(`Basket ${event.number} delivered. Ten bonus points. A new harvest ticket is ready.`);
      } else if (event.type === "bonus") { sound("bonus"); showMessage("A golden find. Five extra points."); }
      else if (event.type === "warning") { showMessage("Mind the outline. A stone is settling in."); announce("A new stone is marked on the field before it appears."); }
      else if (event.type === "finish") finishRun();
    }
    updateHUD();
  }

  function applySettings() {
    document.documentElement.classList.toggle("gentle", gentle());
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
    settings.hat = "none"; previewHat = "none"; persist(); updateWardrobe();
    $("wardrobe-feedback").textContent = "Hat off. Ready for the garden.";
  });
  $("primary-action").addEventListener("click", mainAction);
  $("restart-run").addEventListener("click", () => {
    if (game.status !== "paused") return;
    game.finish("over", isPac() ? "You started a fresh night." : "You planted a fresh run."); handleEvents(); resetRun(); mainAction();
  });
  $("secondary-action").addEventListener("click", () => {
    if (game.status === "paused") { game.finish("over", isPac() ? "You closed the garden for the night." : "You called it a day."); handleEvents(); }
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

  // One ticket moves with the layout; its accessible name and progress remain intact.
  const compact = matchMedia("(max-width: 690px)");
  function placeTicket() {
    const ticket = $("order-ticket");
    if (compact.matches) document.querySelector(".play-area").insertBefore(ticket, document.querySelector(".field-heading"));
    else document.querySelector(".garden-desk").prepend(ticket);
  }
  compact.addEventListener("change", placeTicket);
  placeTicket();
  $("edition-date").textContent = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  if (data.legacyBest) { $("legacy-best").hidden = false; $("legacy-best").textContent = `Your original Snake: Farm Edition best: ${data.legacyBest}. Preserved separately because the scoring has changed.`; }
  buildWardrobe(); applySettings(); resetRun();
  pacRenderer.paintGameIcon($("pacman-game-art"));
  pacRenderer.paintTicketIcon($("lantern-legend"), true);
  for (const icon of document.querySelectorAll("[data-ghost]")) pacRenderer.paintGhostIcon(icon, Number(icon.dataset.ghost));
  renderer.ready.then(() => {
    assetsReady = true; lastOrder = ""; updateOrder();
    for (const icon of document.querySelectorAll("[data-art]")) renderer.paintIcon(icon, icon.dataset.art);
    for (const card of $("hat-collection").children) renderer.paintHat(card.querySelector("canvas"), card.dataset.hat);
    updateWardrobe();
    if (game.status === "ready") showScreen("ready");
  }).catch(() => {
    assetFailure = true;
    $("asset-message").hidden = false;
    $("asset-message").textContent = "The illustration sheet could not load. Keep the assets folder beside index.html, then reload the page.";
    showScreen("ready");
  });

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
    $("combo-fill").style.width = `${isPac() ? game.powerMs / game.powerDuration * 100 : Math.max(0, game.comboLeft - progress) / game.comboWindow * 100}%`;
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
