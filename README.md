# Plot Twist

A garden arcade with two games: **Snake** and **Pac-Man**. Grow a snake through the allotment by day, or chase ghosts through the Moon Garden after hours. Both share the illustrated seed-packet identity, controls, sound, and local preferences.

The October 10 arcade edition adds an illustrated game selector, an original Pac-Man poster, and a custom hedge maze with a glasshouse, flower lanterns, and four garden ghosts. Snake retains its eight collectible hats, market orders, and four play modes. The desktop layout puts the poster beside the playing field; on phones, it becomes a compact masthead. Artwork notes are in [assets/CREDITS.md](assets/CREDITS.md).

## Play online

**[Play Plot Twist in your browser](https://art-brtohers-code.github.io/mycoolproject/)** — hosted on GitHub Pages, no install needed.

## Play locally

Open `index.html` in your browser. Keep the files and `assets` folder together. There is no installation or build step, and the game makes no external network requests.

For a local HTTP preview, run this from the project directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8765>. Records belong to the browser and origin where you played; opening the file directly and using an HTTP preview can have separate records.

## Pick a game

Choose **Snake** or **Pac-Man** above the field. Switching pauses the game you leave. When you return, select **Back to it** to resume. Both paused runs remain available during the current page visit; reloading starts a fresh run. Your selected game, personal bests, settings, and earned Snake hats remain saved locally.

## Pac-Man: the Moon Garden

The 23 × 23 maze is deliberately drawn and mirrored, with connected loops, four flower lanterns, side tunnels that join across the field, and a central glasshouse for the ghosts. The hedge contours are derived from the collision map. Clear a night to begin a faster one, cycling through Moon Garden, Blue Hour, and Violet Hour ink palettes.

- Small pellets earn 10 points. Flower lanterns earn 50 and make roaming ghosts edible for seven seconds on the first night; the window gradually shortens to 3.5 seconds.
- Catch ghosts during one lantern window for 200, 400, 800, then 1,600 points. Their eyes return to the glasshouse, wait briefly, and rejoin the chase.
- Start with three lives. A ghost takes one life and resets the characters while preserving your score and remaining pellets. Earn another life at each 10,000 points.
- Clear every pellet to earn 500 bonus points and start the next night. Lives and score carry forward.
- Fruit appears near your starting point at 35% and 70% of each maze’s pellets. Cherries earn 100 points, lemons 300 on night two, and strawberries 500 from night three. Each fruit lasts 12 seconds of active play.

Pip chases your current position. Moth aims ahead of you. Plum flanks using Pip’s position. Marigold retreats when you get close. The ghosts alternate between short patrols and chasing; flower lanterns make them flee. Their routes use the maze itself, rather than walking through walls.

Arrows, WASD, swipes, and direction buttons all work. An early turn stays buffered until a legal junction opens. Space, P, Escape, tapping the field, dialogs, and switching windows pause both games. Pac-Man uses a fixed 60 Hz simulation with continuous movement. Its personal best saves as points are earned and stays separate from Snake scores and hat milestones.

## Snake: four ways to grow

| Mode | Rules |
| --- | --- |
| Harvest | Up to three crops are available. Complete the two crop requirements on each ticket for 10 extra points. New stones appear as the run progresses. |
| Daily plot | Harvest rules with a shared seed and an assigned field. The challenge resets at midnight UTC. Unlimited retries; your best is saved locally for that day. |
| Endless | One crop at a time, no orders, and an increasing challenge. |
| Practice | Slower fixed speed, harvest tickets, and a clear field with no stones. Practice does not set ranked records. |

Harvest and Endless let you choose the open Allotment, the Orchard's stone islands, or the Greenhouse's narrow rows. Best scores are separate for each mode and field.

Every crop grows the snake and earns 1–5 points, depending on your combo. Collect another within 32 moves to build your rhythm; the bar shows the time left. A golden beet earns 5 points without growing the snake. Its ring shows how long it will remain.

Corner marks identify crops your current order still needs. Other crops still earn points and grow the snake. Orders do not expire. The order bonus stays at 10 points and is not multiplied.

A new stone is outlined for at least eight moves before it becomes solid. It waits if the snake or another item occupies its cell, and placement checks preserve connections through the field. Hit a wall, a stone, or your body to end the run. Your moving tail's vacated cell is safe. Fill every playable cell to win.

## Controls

| Action | Keyboard | Pointer / touch |
| --- | --- | --- |
| Start or play again | Space or Enter on the main action | Start / replay button |
| Steer | Arrow keys or WASD | Swipe the field or use direction buttons |
| Pause / resume | Space, P, or Escape | Pause / Resume; tapping the field also pauses |
| Restart | Pause, then activate Restart run | Pause, then Restart run |
| Sound | M while the field has focus | Sound on/off in the footer |

Opening Hats, Settings, or Field guide pauses either game. Closing a dialog leaves it paused so it cannot restart unexpectedly. Switching tabs or windows also pauses the game. Sound, reduced motion, and direction-button preferences apply to both games. The grid and coat settings apply to Snake. The system reduced-motion preference always takes precedence.

## A hat for the harvest

Open **Hats** in the header or **The potting shed** beside the field. Select an earned hat to equip it immediately; select a locked hat to preview it and see its goal. The hat sits on the snake’s head and follows its turns. **Go bareheaded** removes it.

| Hat | Milestone |
| --- | --- |
| Little sprout | Welcome gift |
| Sunday straw | Pick 10 crops in total |
| Tomato beret | Pick 25 crops in total |
| Yes, chef! | Deliver your first basket |
| Fun guy | Pick 75 crops in total |
| Busy bee | Deliver 10 baskets in total |
| Garden wizard | Reach a ×5 rhythm in one run |
| Crop royalty | Score 100 points in one run |

All Snake modes, including Practice, count. Crop and basket totals carry between runs; rhythm and score goals require a single run. New hats appear in a small reward notification and on the results receipt. Progress saves as you collect crops and bonuses, so an earned hat survives a reload even before the run finishes. Your equipped hat is remembered. Hats are purely cosmetic and do not affect collisions, scoring, or the daily seed. Pac-Man has its own score system and does not contribute to Snake milestones.

Existing saves receive hats supported by their crop totals, best basket count, and saved scores. Older saves did not store total deliveries, so the previous best basket count supplies a conservative starting total. Original Snake: Farm Edition legacy scores remain separate.

Picking 25 crops also unlocks the Seed freckles coat. Deliver five orders in one run to unlock Garden bands. These coats remain in Settings.

Saved records and preferences use local storage. The game remains usable when storage is blocked, but progress then lasts only for the current visit. The original Snake: Farm Edition best is preserved in Settings as a legacy record because scoring has changed.

## Project files

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic menus, controls, ticket, dialogs, and results receipt |
| `style.css` | Illustrated poster, arcade frame, paper tickets, responsive layout, focus, and motion preferences |
| `engine.js` | Grid simulation, orders, collision rules, seeded spawning, modes, and layouts |
| `pacman-engine.js` | Authored maze, continuous movement, ghost routes, power windows, fruit, lives, and nights |
| `renderer.js` | Atlas mapping, continuous snake rendering, field, and bounded visual effects |
| `pacman-renderer.js` | Rounded hedge contours, glasshouse, characters, lanterns, fruit, and night palettes |
| `storage.js` | Validated preferences, versioned records, legacy data, and storage fallbacks |
| `wardrobe.js` | Hat catalogue, milestone progress, equipment validation, and run checkpoints |
| `game.js` | Game selection, paused sessions, input, interface state, audio, persistence, and the animation loop |
| `assets/` | Crop and hat atlases, Snake and Pac-Man posters, custom wordmark, control details, and asset credits |
| `tests/` | Simulation and persistence tests using Node's built-in test runner |

The simulation consumes its own seeded random stream. Cosmetic effects cannot change the daily challenge. The daily seed includes a rules version; identical seeds and inputs reproduce the same simulation. There is no global leaderboard, account, or server-side persistence.

## Check the rules

With a recent Node.js version installed:

```sh
node --test tests/*.test.js
```

All 58 tests cover both simulations, save data, and hat progress. Pac-Man coverage includes full-map reachability and a complete maze sweep, continuous movement, early turns, tunnels, frightened scoring, collisions, pause, ghost release and return, fruit, extra lives, night transitions, deterministic routes, and isolated records. Current verification and historical browser checks are documented in `docs/VALIDATION.md`.

## Artwork

The crop and hat atlases, posters, and wordmark were made for this game. The leaf and tool details are project-local SVG artwork. Asset notes are in [assets/CREDITS.md](assets/CREDITS.md). All assets are bundled locally, and no web fonts or remote runtime dependencies are required.
