# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla Tetris implementation using HTML5 Canvas — no build step, no dependencies, no package.json. Three files: `index.html` (DOM/canvas structure), `style.css` (dark retro theme), `game.js` (all game logic, ~300 lines).

## Running / testing

There is no build or test suite. To run the game, just open `index.html` in a browser, or serve it statically:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npx serve .
```

There is no linter configured. Verify changes by loading the page and playing (movement, rotation, line clears, pause, game over/restart).

## Architecture

All logic lives in `game.js` as module-level state + functions (no classes, no build-time modules — everything is global `const`/`let` in one script).

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece-color index `1–7`.
- **Pieces**: `PIECES` are square matrices (see `game.js:18-27`). Rotation is done by `rotateCW`, a transpose + row-reverse — there is no per-piece rotation state table (no SRS), just a single generic matrix rotation.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until a non-colliding position is found, else the rotation is discarded.
- **Collision** (`collide`): checks board bounds and existing locked cells; a shape row/col with `0` is treated as empty and never collides.
- **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time in `dropAccum` and advances the piece one row once `dropInterval` is exceeded.
- **Locking a piece** (`lockPiece`): `merge()` bakes the current piece into `board`, then `clearLines()`, then `spawn()`.
- **Line clear / scoring** (`clearLines`): scans bottom-up, removes full rows, unshifts empty rows at the top. Score uses `LINE_SCORES = [0,100,300,500,800]` multiplied by `level`; `level` increases every 10 lines, and `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Ghost piece**: `ghostY()` projects the current piece straight down until it would collide; drawn at `globalAlpha = 0.2`.
- **Game over**: detected in `spawn()` when the newly spawned piece already collides at its start position; triggers `endGame()` and shows the overlay.

Flow: `init()` builds the board, seeds `next` via `randomPiece()`, calls `spawn()`, and starts `loop()`. Keydown handler dispatches move/rotate/soft-drop/hard-drop/pause; `Space` and `P` are the hard-drop and pause keys respectively.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell size), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, the `<canvas id="board">` `width`/`height` in `index.html` must be updated to match (`COLS×BLOCK` by `ROWS×BLOCK`).
