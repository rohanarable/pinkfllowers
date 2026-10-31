# A Little Garden, Just for You

A dreamy, interactive pink flower garden built with vanilla HTML, CSS, Canvas 2D, and JavaScript. It has no build step or dependencies. Music is a built-in soft melody, off by default, and never starts automatically.

## Files

```
index.html   accessible page, garden controls, and dialogs
style.css    twilight botanical styling and responsive layouts
script.js    CONFIG, procedural garden, interactions, and generated ambient music
README.md    setup, controls, and GitHub Pages instructions
```

## Make it yours

Edit the `CONFIG` object at the top of `script.js`:

- `name`: optional name; leave empty to hide the For line.
- `opening`, `growButton`, `mainMessage`, `subMessage`, `moreButton`, `hiddenMessage`, `replayButton`, and `signature`: opening and final copy.
- `petalColors`: pink shades used by cached Canvas flower sprites.
- `flowerDensity`, `windStrength`, `maxPlants`, `initialPlants`, and `duration`: garden size and message timing.
- `audio`: show or hide the Music button.
- `features`: toggle the garden tools and features.

## Play

- **Music**: tap **Music: Off ♪** to start the built-in soft melody. It uses sine oscillators, a gentle pentatonic pattern, a low pad every few beats, and notes that fade in and out. It is off by default, uses no files or network requests, pauses while the tab is hidden, and can be toggled repeatedly.
- **Plant**, **Wind**, **Water**, **Pick**, and **Wish**: tend the garden with the toolbar tools.
- **Day/night**: toggle between warm daylight and softly glowing moonlight.
- **Save picture**: download the canvas as a PNG.
- **Clear**: remove plants; choose Plant and tap the garden to start again.
- **Replay**: return to the opening scene and grow a fresh garden.

Keyboard shortcuts: **P** Plant, **W** Wind, **R** Water, **K** Pick, **S** Wish, **N** Day/night, **B** Bouquet, **C** Clear, **Escape** close a dialog. Focus the canvas to use arrow keys and Enter/Space for its selected tool.

The canvas uses a seeded recursive branching pattern, cached flower sprites, pooled particles, and a device-pixel-ratio-aware drawing surface. It respects reduced motion, pauses while the tab is hidden, and adapts to phone orientation and screen size.

## Publish with GitHub Pages

1. Put `index.html`, `style.css`, `script.js`, and `README.md` in the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Under Build and deployment, choose Deploy from a branch.
4. Select branch **main** and folder **/ (root)**, then click Save.

All local paths are relative. For a quick local preview, use Live Server or another HTTP static server.
