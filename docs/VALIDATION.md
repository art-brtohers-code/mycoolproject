**Two-game arcade — 10 October 2026**

The current edition adds Pac-Man alongside Snake, an illustrated game selector, an original moon-garden poster, and a custom 23 × 23 hedge maze. Both games share input, dialogs, audio, and preferences. Switching retains each run in a paused state for the current page visit.

Checks completed:

- All 58 tests pass. Nineteen new checks cover maze symmetry and pellet reachability, continuous movement, buffered turns, tunnel wrapping, power pellets, the 200/400/800/1600 capture chain, life loss and game over, tunnel-seam collisions, frozen pause timers, ghost release and return, single clear bonuses, progressing nights, fruit, extra lives, bounded speeds, isolated records, deterministic routes, and an automated sweep of the entire real maze.
- All seven application scripts pass JavaScript syntax checks.
- All 90 HTML IDs are unique; literal script ID references and linked assets resolve.
- A temporary mocked DOM/canvas check executes the real interface and renderer code. It exercises selecting Pac-Man, switching between two active runs without resuming either automatically, retaining Snake results and earned hat rewards, resuming Pac-Man, saving its live score separately from Snake milestones, and retaining Pac-Man results after switching away and back. It also repeats the previous hat workflow checks.
- All 529 cell centres were compared against the renderer’s hedge contours: their filled/empty classification agrees with the collision map in every cell. Atlas drawing rectangles remain within their source images.
- The original 1024 × 1536 Pac-Man poster was inspected and confirmed to have an alpha channel. It is bundled locally. Maze geometry and small characters are drawn directly in Canvas, without external graphics libraries or network requests.

**Live browser rendering is unverified in this edition.** The mocked interface check does not establish responsive appearance, native dialog focus, touch behavior, subjective audio quality, or actual canvas rendering. Review at 1280 × 900, 860 × 900, 390 × 844, and 360 × 740, with particular attention to the two game tickets, small maze sprites, compact lives display, portrait poster, and switching while paused.

---

**Previous potting-shed collection — 10 October 2026**

The current edition adds eight illustrated milestone hats, live progress saving, persistent equipment, locked-hat previews, reward notifications, results rewards, and decorated controls.

Checks completed:

- All 39 simulation, storage, and wardrobe tests pass. The ten new checks cover exact thresholds, locked equipment, checkpoint counting, cumulative versus single-run goals, golden-bonus score rewards, old-save migration, equipment round-trips, malformed progress, permanent earned hats, and unchanged daily simulation randomness.
- JavaScript syntax checks pass for all five application scripts.
- All 79 HTML IDs are unique. Literal JavaScript ID references and linked assets resolve.
- A temporary mocked DOM/canvas smoke check executes the actual interface and renderer scripts. It checks startup, a locked crown preview, a live straw-hat unlock, pausing to open the shed, equipping and persisting a hat, staying paused on close, resuming, collision results with earned rewards, avoiding duplicate crop counting on finish, and removing a hat. Every atlas crop is within its source image. This is an interface wiring check, not a real browser-rendering test.
- The 1254 × 1254 hat atlas was visually inspected and its PNG alpha transparency confirmed. Connected ink bounds were inspected to preserve the complete silhouettes and remove the two neighbouring sprite slivers.

**Real browser validation is pending.** No new browser screenshots were captured. Check the collection dialog at 1280 × 900, 860 × 900, 390 × 844, and 360 × 740, including native dialog focus, scrolling, the equipped hat at all four turns, and physical-device touch input.

---

**Previous Plot Twist visual redesign — 10 October 2026**

The garden-arcade edition replaces the previous layout with a three-column illustrated poster, playing field, and market desk. It includes two new original transparent PNGs, a new color system, revised menu and ticket styling, compact phone layouts, and updated start/pause copy.

Checks completed for this edition:

- All 29 existing simulation and persistence tests pass.
- JavaScript syntax checks pass for the updated interface and renderer.
- All 55 HTML IDs are unique. JavaScript ID references, accessible label/description references, image dimensions, image alt attributes, local scripts, styles, and image paths were checked.
- PostCSS parses the stylesheet successfully. The mobile order-ticket breakpoint agrees between CSS and JavaScript.
- Main text combinations meet 4.5:1 contrast: rust/page 5.26:1, primary button 6.17:1, body/ticket 10.78:1, muted/page 4.97:1, and poster small print 6.28:1. This is a token-level contrast check, not a complete accessibility audit.
- The mascot (1024 × 1536) and wordmark (1254 × 1254) were visually inspected and confirmed to include alpha transparency. Their project copies are present and referenced locally.

**Visual browser validation is pending for this edition.** No new browser screenshots were taken, and no live desktop/mobile interaction or overflow claims are made for the October 10 layout. In particular, review the tablet transition, the compact phone result ticket, the long crop names, and the start/pause layouts at 1280 × 900, 860 × 900, 390 × 844, and 360 × 740.

The checks and captures below are historical evidence for the previous design, not the current interface.

---

**Previous Plot Twist validation — 9 October 2026**

Result: passed for the implementation checks described below.

The local HTTP preview was reviewed in Chrome. The interface was inspected at the normal browser size, 1280 × 900, 390 × 844, and 360 × 740. The smallest viewport had no horizontal overflow; the field and the enabled direction controls fit vertically. The artwork and the rendered crop and snake graphics were inspected at gameplay size.

Browser checks covered starting Harvest, steering with the keyboard, pausing and resuming with P, opening settings during play, retaining pause after closing a dialog, restarting from the pause menu, collision results, switching to Daily Plot and Practice, and choosing the Greenhouse. Volume, grid, motion, and direction-button preferences were changed and verified after reload, then restored. The Daily Plot showed the UTC date and locked its assigned field; Practice showed an unranked score and a clear field. No browser console errors or warnings were observed in the reviewed session.

The browser review led to adjustments to the medium-width start card, the narrow-screen wordmark, the order ticket's mobile placement, the desktop header height, and the contrast of muted text. The game field fits within the tested 900px-high desktop viewport. The printed interface, artwork, and controls were rechecked after those changes.

Automated checks:

- All 29 tests pass with `node --test tests/*.test.js`.
- JavaScript syntax checks pass for the simulation, persistence, renderer, and interface.
- All 55 HTML IDs are unique, the interface's referenced IDs exist, and all five linked script/stylesheet files resolve.
- Simulation coverage includes buffered turns, illegal reversals, a vacating tail, growth collisions, distinct collision causes, order completion and replenishment, multiplier expiry, bonus collection, frozen pause timers, safe warning activation, field connectivity, nearly full fields, and a 3,500-move simulated harvest.
- Daily runs reproduce the same state for the same seed and inputs, independent of unrelated random calls. Records are separated by mode, field, and date.
- Persistence coverage includes malformed data, unavailable storage, legacy-score migration, cosmetic unlocks, preference round-trips, and bounded daily history.

Saved browser captures:

| Capture | State |
| --- | --- |
| [Desktop start](screenshots/01-desktop-start.png) | Printed title, harvest ticket, and start card |
| [Desktop play](screenshots/02-desktop-playing.png) | Greenhouse layout and a turning snake |
| [Phone results](screenshots/03-mobile-results.png) | Completed run and harvest receipt |
| [Phone start](screenshots/04-mobile-start.png) | Ticket above the field at 390px |
| [Small phone](screenshots/05-small-phone.png) | 360px layout with direction controls enabled |

Limits: phone layouts were checked through browser viewport sizing, not on physical touch devices. Swipe input needs a real-device check. Full screen-reader navigation, subjective sound quality, long-session mobile performance, and gameplay balance need broader playtesting. These checks do not establish complete accessibility compliance or a cross-browser certification. Online sharing and deployment were outside this task.
