# ASCII Generator

A fully interactive, real-time generative ASCII art background builder — a creative tool for designers and developers to craft animated character-based visuals and export them as production-ready code for any website.

---

## Features

### Two Rendering Modes

**Flat Mode** renders a static 2D grid of ASCII characters shaped by Fractional Brownian Motion (FBM) noise — a multi-octave value noise function that creates organic cloud-like density fields. The grid redraws only when settings change, keeping performance overhead near zero.

**3D Particle Mode** builds clusters of floating characters projected through a perspective camera. Clusters drift via sine oscillation and particles orbit their cluster centers independently. A continuous Y-axis rotation sweeps the whole scene so characters cycle between foreground and background, naturally changing apparent size through perspective depth scaling.

### Five Pattern Types

| Pattern | Description |
|---------|-------------|
| **Organic** | Randomly placed clusters with Gaussian radial spread and rejection sampling for natural spacing |
| **Grid** | Evenly distributed clusters in a rows × columns layout with subtle jitter |
| **Dots** | Concentric ring formations radiating from five anchor points across the canvas |
| **Lines** | Sine-wave-shaped strips of clusters flowing horizontally |
| **Image** | Upload a photo or image — it's downsampled to a density map that drives where characters appear, proportional to luminance |

### Draw Feature

Paint directly onto the canvas with a soft radial brush to sculpt the character pattern by hand. The draw layer sits above the ASCII background without erasing it.

- **Stroke painting** — brush interpolation fills gaps between mouse frames so strokes are always smooth
- **Preset slots** — save up to 3 painted patterns as thumbnail presets; click any preset to reapply it instantly
- **Non-destructive clear** — clearing brush strokes removes the paint without touching the ASCII background underneath
- **Brush size control** — adjustable from 10px to 120px

Painted strokes go through the same density-map pipeline as uploaded images, so drawn shapes and photos are rendered with identical logic.

### Viewport Navigation

- **Scroll to zoom** — cursor-centered zoom keeps the point under your mouse fixed as you scale in and out
- **Space + drag to pan** — hold Space and drag to move around the canvas freely
- **Reset View** — a HUD button restores the original position and shows the current zoom level

### Adjustment Controls

**Pattern Angle** rotates the entire flat character grid around the canvas center. The grid is extended beyond visible bounds to prevent gaps at rotated edges.

**Char Angle** rotates each character individually around its own center — separate from the overall pattern rotation.

**Scale / Spacing** (Flat mode) — Scale changes character pixel size; Spacing controls the gap between characters.

**Zoom / Speed** (3D mode) — Zoom scales projected positions around canvas center; Speed controls animation and oscillation rate.

**Size Range** (3D mode) — enables min/max font size variation driven by perspective depth, so nearer characters appear larger. Decoupled from cluster membership so switching patterns never changes character scale.

### Color System

Three color modes — Mono, Duo, Trio — blend into a 256-entry gradient lookup table sampled per character based on screen position. Four gradient directions: diagonal, horizontal, vertical, radial.

Additional controls: opacity, color saturation (0 = grayscale → 1 = natural → 2 = vivid), background color (solid or gradient).

### Export

Generate a fully self-contained, dependency-free file with all current settings, colors, patterns, and drawn/uploaded density maps baked in — ready to drop into any project:

- **React / Next.js (.tsx)** — a named export component with `"use client"` directive, complete rendering engine inlined, works in any Next.js or React app with no additional setup
- **Standalone HTML (.html)** — a single file with vanilla JavaScript, open in any browser with no build step required

---

## Control Panel

Five collapsible sections organized around the creative workflow:

1. **Shape** — pattern type, image upload (appears only when Image pattern is selected), density
2. **Character** — character set, custom char editor, live preview, size, dimension (Flat / 3D), size range
3. **Draw** — draw mode toggle, brush size
4. **Motion** — scale/zoom, spacing/speed, pattern angle, char angle
5. **Colors** — color mode, pickers, gradient preview, direction, opacity, saturation, background

---

## How It Was Built

### Canvas Engine

The renderer uses the HTML5 Canvas API with `requestAnimationFrame` for the animation loop. All animation state lives in mutable refs rather than React state, so the render loop never triggers React re-renders. The canvas is sized at `clientWidth × min(devicePixelRatio, 2)` and the context is set via `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` on every resize — never cumulative scaling.

**Gradient LUT** — a 256-entry pre-baked hex string array is built once when colors change. Every character samples this table with a single array lookup, avoiding per-character color math inside the hot render loop.

**Font batching** — particles are sorted by font size at build time, so `ctx.font` is set only ~8 times per frame instead of once per particle. `ctx.fillStyle` is skipped when the LUT index hasn't changed. No `ctx.save/restore` or `ctx.shadowBlur` in the render loop.

**fKey invalidation** — flat mode uses a fingerprint string of all settings that affect the static render. The canvas only redraws when the key changes, keeping flat mode at near-zero CPU between interactions.

### 3D Particle System

Clusters are built per pattern type, each with a center position, radius, drift amplitude, and particle count. Particles are spawned via Box-Muller Gaussian sampling within each cluster radius.

Per frame: clusters update their center via `sin/cos` drift, particles oscillate around cluster centers, then each particle is projected through a Y-axis rotation matrix and a perspective divide (`focal / depth`). Font size scales with perspective; opacity scales with depth to reinforce the 3D illusion.

Character rotation in 3D uses `ctx.translate/rotate/fillText` then `ctx.setTransform(dpr,0,0,dpr,0,0)` to reset only the transform matrix — this avoids the cost of `ctx.save/restore` which would also reset fill style, alpha, and font.

### Flat Mode Renderer

Fractional Brownian Motion noise (`fbm`) sums multiple octaves of 2D value noise to produce smooth organic density fields. A threshold gates which cells render a character. Pattern angle extends the grid by `ceil((diagonal − width) / 2 / cellWidth) + 2` in each direction so rotated edges never show gaps.

Deterministic character assignment (`cellChar`) uses a hash of column and row so characters don't flicker on non-character-setting changes.

### Draw Canvas

`DrawCanvas` uses `forwardRef` + `useImperativeHandle` to expose an imperative API (`clearCanvas`, `buildSnapshot`, `loadPreset`) to the parent without prop drilling. The brush is a radial gradient painted with `ctx.createRadialGradient`. Stroke continuity is maintained by stepping along the line between the previous and current mouse position in increments of `0.35 × brushRadius`.

Snapshots capture a PNG thumbnail via `canvas.toDataURL` and a 64×64 density map via `getImageData` downsampled from the full canvas. Both are stored in preset slots and the density map feeds directly into `buildImageClusters` — the same function used for uploaded images.

### Viewport Pan / Zoom

The canvas and draw overlay are wrapped in a CSS-transformed div. Zoom is cursor-centered by adjusting pan on each wheel tick: `panX = cursorX − (cursorX − panX) × newZoom/oldZoom`. The wheel listener is attached as a non-passive DOM event so `preventDefault()` works. Space-hold pan uses a transparent overlay div that sits above everything including the draw canvas, capturing mouse events only while Space is held.

### Export Code Generation

The exporter serializes the current `Settings` object into a `const C = {...}` block, resolves the character pool to a plain string constant, and serializes the density map as inline data if the current pattern is image/draw. The full rendering engine — noise functions, LUT builder, cluster builders, particle builder, animation loop, and ResizeObserver — is then inlined into the output file. No runtime dependencies. The React variant wraps everything in a named export functional component; the HTML variant uses an IIFE with vanilla JS.

---

## Tech Stack

- **React 18 + TypeScript**
- **HTML5 Canvas API** — no canvas libraries
- **Vite** — dev server and build tooling
- **Tailwind CSS v4** — minimal use; panel UI uses inline styles for precision
- **pnpm** — package management
