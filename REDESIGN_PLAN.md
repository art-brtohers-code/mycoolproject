**Snake redesign plan — printed garden direction**

The goal is a small game with a recognizable identity, satisfying movement, and a reason to play another run. The selected direction is cream paper, dark ink, and custom crop artwork. Working title: **PLOT TWIST**, with the plain descriptor “A garden snake game.”

Implementation status, 9 October 2026: the printed garden redesign, harvest orders, practice, Endless, Daily Plot, three field layouts, cosmetic patterns, settings, and local records are implemented. The original plan below records the design decisions. See [README.md](README.md) for the shipped behavior and [docs/VALIDATION.md](docs/VALIDATION.md) for tests, browser review, screenshots, and remaining verification limits.

The existing game has useful foundations: a 20 × 20 field, buffered turns, interpolated movement, combos, timed bonuses, obstacles, synthesized sound, touch controls, saved best score, and automatic pause. Those are existing features. The redesign should preserve their useful behavior while improving their presentation and adding a specific gameplay identity.

The source points to these priorities:

| Current implementation | Why it matters | Planned response |
| --- | --- | --- |
| Emoji crops and stars, a shaded canvas snake, and separately drawn rocks in `game.js` | Objects use different visual languages. | One coordinated art sheet with consistent outlines, proportions, light direction, and texture. |
| Green radial background, rounded score cards and legend pills in `style.css` | The interface relies on common component styling to carry its personality. | A printed garden composition with ink rules, a distinctive title, an order slip, and restrained color. |
| Entire layout capped at 412px | The board cannot make good use of a larger display. | Size the field for both viewport width and height, with a compact mobile arrangement. |
| Start, pause, and results reuse a text overlay in `index.html` and `game.js` | Important states have little differentiation and lack explicit action buttons. | Purposeful start, pause, and results layouts with real keyboard-accessible controls. |
| Six crop appearances share identical behavior | The farm theme does little to shape decisions. | Harvest orders that make choosing a route and crop matter. |
| Reduced motion only suppresses screen shake | Other decorative motion remains enabled. | A complete reduced-motion treatment for bobbing, score bumps, bursts, blinking, and transitions. |

The art direction should feel like a small illustrated seed catalogue brought to life. The field remains the largest and clearest element. Texture belongs mainly on the surrounding paper; the playable cells need to stay easy to read.

| Element | Specification |
| --- | --- |
| Palette | Paper `#F3ECD9`, ink `#243A2C`, leaf `#567447`, tomato `#BD4935`, ochre `#C79A35`. Treat these as starting swatches; verify contrast in the rendered UI. |
| Typography | A heavy, characterful slab serif for the title; one readable text face for controls and instructions; tabular score figures. Choose and self-host appropriately licensed fonts during the art pass. |
| Composition | A prominent wordmark, a thin score strip, the field, and one small harvest order slip. Use ink dividers and deliberate spacing. |
| Field | A pale soil or sage surface, quiet grid markings, and an illustrated garden boundary. Keep ornamental leaves and tools outside collision space. |
| Snake | A recognizable head, cream markings, a tapered tail, and a restrained eating expression. Create head, straight body, corner, and tail artwork that joins cleanly during movement. |
| Crops and hazards | Six crop illustrations, one golden bonus crop, and clearly distinct stone silhouettes. All must remain recognizable at the smallest supported cell size. |
| Texture | One subtle paper texture and consistent ink irregularity. Never animate the paper grain or let distress obscure numbers and object edges. |
| Controls | Clear labels, consistent simple icons, visible focus, and generous touch targets. Match icons to the ink style. |

The first art deliverable should put the snake, all crops, a stone, the bonus, the title, and a sample order on the same sheet. Inspect it at actual gameplay size before producing a full asset set. All artwork needs selection and cleanup into a consistent set, transparent exports where appropriate, predictable dimensions, and recorded provenance. Asset quality is a core deliverable.

Give the snake small, intentional reactions: a brief gulp on pickup, a tiny leaf burst, a satisfying stamp when an order is delivered, and a clear indication of the collision cell when a run ends. Tune these effects to preserve steering responsiveness. Sound should use a coordinated set of soft plucks, taps, and short delivery cues. Keep persistent mute and add a volume control in settings.

Every state should belong to the same game:

| State | Intended experience |
| --- | --- |
| Start | Show the field and snake, a short explanation, a visible “Start a run” button, and the selected mode. Put detailed rules behind “How to play.” |
| Playing | Keep score, combo, order progress, and pause visible. Show each new mechanic briefly when it first appears. Keep ordinary movement unobstructed. |
| Paused | A compact paper menu with Resume, Restart, and Settings. Freeze gameplay timers and restore focus correctly on exit. |
| Results | A harvest receipt showing score, crops, orders delivered, best combo, run duration, and cause of death. Make “Try again” the primary action. |
| Mobile | Put the order above the field and controls below it. Provide swipe and directional-button options, plus a visible pause button. Fit the field and essential controls within common phone heights. |

For desktop, start with a field around 560–640px wide when the viewport permits it, with the order beside it. At narrow widths, use a single column. Preserve the square field and size its canvas backing store to the actual displayed dimensions and device pixel ratio. Validate short landscape windows as well as portrait phones.

The feature priorities are:

1. **Harvest orders — the signature feature, first release.** Place up to three crops on the board and show a simple request such as “2 carrots + 1 tomato.” Every crop grows the snake and earns the existing combo-based points. Requested crops also advance the order; completing it initially awards a fixed 10-point bonus and produces the next order. These values are tuning defaults. Orders do not expire in the first version, so the existing combo already supplies time pressure. Keep at least one outstanding requested crop available whenever space permits. Needed crops use a visible mark as well as color. Refill collected slots without reshuffling unrelated pickups. Reduce pickup count gracefully near a full field and define the win condition around occupied playable cells.

2. **Fair hazards and useful feedback — first release.** Introduce new rocks with an outlined warning and a short countdown measured in simulation steps. Activate only if the cell remains safe; defer otherwise. Avoid cutting the static field into inaccessible regions or placing pickups in isolated pockets. Show what ended the run. Replace the blinking star with a custom golden crop and a clear lifetime indicator. Retain its existing bonus role.

3. **Practice mode and complete menus — first release.** Offer a slower fixed speed, no new rocks, and an optional grid aid. Exclude practice results from competitive records. Preserve an Endless mode for the existing score-chasing rules, and give each mode its own best score. Include accessible settings, a brief interactive introduction, and a restart action that works consistently with keyboard and touch.

4. **Daily Plot — follow-up release.** Use a UTC date, explicit rules version, and deterministic gameplay seed for a daily layout and ruleset. Show the reset time clearly. Allow retries and keep a local daily best; a server is unnecessary for that scope. Separate gameplay randomness from particles, texture, and audio so cosmetic changes cannot alter the challenge. A shared seed means the same starting challenge and reproducible outcomes for the same inputs, not identical runs for different routes.

5. **A small collection of authored plots and cosmetic rewards — follow-up release.** Add three distinct layouts: an open allotment, an orchard with fixed islands, and a greenhouse with lanes. Each must change routing and pass reachability checks. Unlock a handful of snake patterns or illustrated seed stamps for specific accomplishments, such as delivering five orders in one run. Keep unlocks cosmetic and preserve readability. Store progress locally.

Hold online leaderboards, accounts, multiplayer, shops, and an extensive upgrade tree outside the first release. They add systems and maintenance before the main experience has been proven. The first release already has a substantial visual overhaul, a new route-planning mechanic, practice, clearer hazards, and complete menus.

Build in this order:

| Stage | Work | Completion evidence |
| --- | --- | --- |
| 1. Establish the visual target | Create composition studies within the selected printed garden style, an art sheet, and desktop/mobile play-screen mockups. Resolve the title, palette, character, crop scale, and order placement. | The snake, crops, HUD, and controls read clearly at actual sizes; one coherent target is selected for implementation. |
| 2. Finish one playable field | Implement the new renderer and page composition with existing gameplay. Complete start, pause, and results states. Add final assets, focus states, and responsive sizing. | A complete start → play → pause → resume → lose → restart flow looks consistent on desktop and phone. |
| 3. Add the first-release mechanics | Implement multiple crops, harvest orders, safe hazard warnings, practice, and separate records. Tune speed and rewards through playtesting. | Players can explain their crop choices; orders always remain completable when space permits; difficulty rises predictably. |
| 4. Add replay value | Introduce versioned deterministic challenges, Daily Plot, authored layouts, and a modest cosmetic collection. | Identical seed and input sequences reproduce the same simulation; records and unlocks survive reloads. |
| 5. Finish the project | Review audio, animation, accessibility, loading behavior, documentation, and all visible copy. Capture final screenshots and compare each state against the chosen art target. | The quality checks below pass and the README describes the shipped game accurately. |

Keep the current HTML, CSS, Canvas, and JavaScript foundation. Introduce only the separation needed for these features: simulation and rules, rendering and assets, UI/input, audio, and persistence. Keep scoring and spawning independent of DOM updates so they can be tested directly. A framework migration is unnecessary for this scope. If native modules are introduced, document the resulting local HTTP-server requirement; the current README promises direct file opening.

The implementation touches the existing files deliberately:

| Location | Planned changes |
| --- | --- |
| `index.html` | Semantic start/menu/results controls, order display, mode selection, settings, and revised mobile layout. |
| `style.css` | Shared palette and typography rules, responsive composition, focus states, and motion preferences. |
| `game.js` | Replace emoji rendering; separate simulation from effects; extend `step`, `eat`, and spawning for multiple crops and orders; report collision causes; introduce mode and challenge state. |
| New asset files | Coordinated snake/crop/stone artwork, paper texture, fonts, and appropriate credits. |
| Persistence | Version records by mode and rules. Preserve the old best as a legacy Endless record rather than comparing it directly with new scoring. Retain mute preferences and handle unavailable or corrupt storage. |
| `README.md` | Explain the actual game, controls, modes, and launch instructions; add real screenshots and asset credits; remove the placeholder deployment URL. Retain relevant provenance honestly. |

Quality checks should cover both the game and its presentation:

- **Art consistency:** all gameplay objects use the same visual treatment. Every crop and hazard is identifiable at phone size. Decorations cannot be mistaken for collision objects.
- **Visual hierarchy:** the field dominates; score and order progress remain readable during movement; title, menus, and results use the same composition rules.
- **Input and accessibility:** verify keyboard focus and button activation, swipe steering, directional buttons, and pause/resume. Restrict game shortcuts so they do not intercept focused menu controls. Use shape and labels alongside color. Expose meaningful menu and result text outside the canvas without announcing every movement tick.
- **Motion and sound:** reduced motion suppresses decorative motion while preserving understandable movement. Pause freezes simulation-based countdowns. Sound preferences persist and effects do not clip or overwhelm the game.
- **Simulation:** test buffered turns, reversal prevention, moving into a vacating tail cell, growth collisions, order counting, duplicate pickups, near-full-board wins, deferred hazards, and reachable spawning. Verify that rendering cannot consume gameplay randomness.
- **State reliability:** test rapid restart, pause during a countdown, automatic pause, rule-version changes, daily date boundaries, and storage failures. Scope delayed UI callbacks to the run that created them.
- **Responsive rendering:** review start, play, pause, and results at representative 360px and 390px phone widths, a tablet, desktop, and a short landscape viewport. Verify high-density canvas sharpness and legibility after zooming.
- **Performance:** profile a long snake with the maximum obstacle count and active effects. Keep effects bounded, reuse static artwork, and confirm responsive steering on an actual phone.

The implementation has passed automated simulation/persistence checks and desktop/mobile browser review. Physical touch-device testing, a full assistive-technology review, and broader gameplay balancing remain follow-up work; the validation report documents that scope.

The first implementation milestone is one finished playable field with the printed garden artwork and complete start, pause, and results states. Add harvest orders once that visual foundation works at desktop and phone sizes.
