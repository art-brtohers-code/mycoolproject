**Plot Twist artwork**

| Local asset | Dimensions | Use |
| --- | --- | --- |
| [garden-atlas.png](garden-atlas.png) | 1448 × 1086 RGBA | Six crops, golden beet, stone, and snake head, body, corner, and tail sprites |
| [hat-atlas.png](hat-atlas.png) | 1254 × 1254 RGBA | Eight collectible hats: sprout, straw, tomato beret, chef toque, mushroom, beekeeper, wizard, and harvest crown |
| [garden-mascot.png](garden-mascot.png) | 1024 × 1536 RGBA | Olive snake and tomato print on the desktop poster and compact mobile masthead |
| [moon-garden-poster.png](moon-garden-poster.png) | 1024 × 1536 RGBA | Golden Pac-Man and coral, lilac, and mint garden ghosts among lemons, moonflowers, and a crescent moon |
| [plot-twist-wordmark.png](plot-twist-wordmark.png) | 1254 × 1254 RGBA | Custom two-line lettering; the HTML heading supplies the accessible name |
| [garden-tools.svg](garden-tools.svg) | Vector | Control icons |
| [button-leaves.svg](button-leaves.svg) | Vector | Button decoration |

## Snake

`renderer.js` maps the actual illustration bounds in `garden-atlas.png` and clips two neighbouring sprite slivers when drawing; the source image is preserved. The moving snake's continuous path and game indicators are rendered with the Canvas API.

`hat-atlas.png` is mapped by its actual ink bounds, with two neighbouring slivers clipped where the beekeeper and wizard bounding boxes overlap. The same artwork is used in the collection, previews, reward notification, and on the moving snake.

## Pac-Man

The playable maze and small characters are project-native Canvas artwork in `pacman-renderer.js`: rounded hedge contours traced from the authored map, carved leaf details, leaded glasshouse windows, a brass gate, scalloped ghosts, flower lanterns, fruit, and three night palettes. The 23 × 23 map and game implementation are original project code; no third-party map or game assets were imported.

## Type and icons

Interface text uses local American Typewriter/Rockwell/Georgia fallbacks, Avenir/system sans, and Courier; the wordmark is a bundled image and does not depend on installed fonts. No icon font, remote images, or runtime dependencies are used.
