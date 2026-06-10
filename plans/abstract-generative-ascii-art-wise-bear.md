# Plan: Animated Flat Mode ("Live" Dimension)

## Context

The app currently has two dimension modes: **Flat** (static 2D grid, redraws only when settings change) and **3D** (animated floating particles). The user wants a third mode between them — a **live 2D grid** that keeps the flat character grid but adds continuous, pattern-linked animation. Each pattern type gets its own animation style so the motion feels native to the shape (pulse, fabric warp, ripple rings, equalizer bars, shimmer).

## New Dimension Option

Add `"flat-anim"` to the `dimension` union in `Settings` (`src/app/App.tsx`):
```ts
dimension: "flat" | "flat-anim" | "3d"
```

ControlPanel Dimension buttons change from `["flat","3d"]` to `["flat","flat-anim","3d"]` with display labels `["Flat","Live","3D"]`.

**Motion section label logic** after the change:
- Scale slider: label = `"Scale"` when `dimension !== "3d"`, else `"Zoom"`
- Speed slider: label = `"Spacing"` when `dimension === "flat"` only, else `"Speed"`
- Size Range / min / max: visible only when `dimension === "3d"` (unchanged)

## Per-Pattern Animation Styles

`t = ts × 0.001 × s.speed` (timestamp in seconds × user speed control)

| Pattern  | Name         | Effect |
|----------|-------------|--------|
| Organic  | **Pulse**   | `animOpacity = 0.35 + 0.65 × (0.5 + 0.5 × sin(t + fbm(col/visCols×3, row/visRows×3) × 6.28))` — cells pulse at different phases driven by their noise value, organic breathing |
| Grid     | **Fabric**  | `dx = sin(t×0.9 + row×0.4) × cellW×0.6`, `dy = cos(t×0.7 + col×0.35) × cellH×0.4`; `animOpacity = 0.6 + 0.4 × sin(t + col×0.2 + row×0.15)` — grid warps like crumpled fabric |
| Dots     | **Ripple**  | 5 fixed anchors `[w×0.25,h×0.35]`, `[w×0.75,h×0.65]`, `[w×0.5,h×0.5]`, `[w×0.15,h×0.72]`, `[w×0.85,h×0.28]`; `animOpacity = 0.5 + 0.5 × sin(minDist×0.04 − t×2.5)` using pixel-space distance to nearest anchor |
| Lines    | **Equalizer**| `barFill = 0.5 + 0.5 × sin(t×1.8 + col×0.2)`; render char only if `row >= visRows × (1 − barFill)` — bars rise from bottom per column like an audio spectrum |
| Image    | **Shimmer** | `phase = frac(sin(col×127.1 + row×311.7) × 43758.5453) × 6.28`; `animOpacity = 0.4 + 0.6 × (0.5 + 0.5 × sin(t×1.5 + phase))` — density map shape holds; individual chars shimmer independently |

## Files to Modify

### 1. `src/app/App.tsx`
- Extend `dimension` type: `"flat" | "flat-anim" | "3d"`

### 2. `src/app/components/AsciiBackground.tsx`

**Add `drawFlatAnimMode(ctx, w, h, s, lut, ts, drawingMap)`** after the existing `drawFlatMode`:
- Identical background fill + scale/spacing/cell-size/rotation/padding setup as `drawFlatMode`
- Uses `fbm` (already defined in the file) for Organic phase offsets
- Uses the same hash function (`Math.sin(col*127.1 + row*311.7) * 43758.5453`) for Shimmer per-cell phases
- Inside the grid loop: compute per-pattern `animOpacity` and `dx`/`dy` using the table above
- Final opacity: `clamp(strength × animOpacity × s.colorOpacity, 0, 1)`
- Draw at `(drawX + dx, drawY + dy)` — charAngle rotation path unchanged
- The equalizer branch: skip drawing entirely when row is above the bar height

**Update RAF `tick` function** — add branch between flat and 3D:
```ts
if (s.dimension === "flat") {
  // existing fKey branch — unchanged
} else if (s.dimension === "flat-anim") {
  wasFlatRef.current = false;
  drawFlatAnimMode(ctx, w, h, s, gradientLUTRef.current, ts, imageMap);
  if (!reducedMotion) rafRef.current = requestAnimationFrame(tick);
  return;
} else {
  // existing 3D branch — unchanged
}
```
`reducedMotion` / visibility pause guards apply identically to the new branch.

### 3. `src/app/components/ControlPanel.tsx`
- Dimension button array: `["flat","flat-anim","3d"]`, labels `["Flat","Live","3D"]`
- Scale slider label: `s.dimension === "3d" ? "Zoom" : "Scale"`
- Speed slider label: `s.dimension === "flat" ? "Spacing" : "Speed"`
- Size Range / min / max guard: `s.dimension === "3d"` (currently `!isFlat` — update to `s.dimension === "3d"`)

## Verification

1. Three buttons in Dimension row: Flat · Live · 3D — all three selectable
2. Live mode runs a continuous animation loop; switching to Flat freezes it immediately
3. Each pattern produces a distinct animation:
   - Organic → soft organic breathing across the field
   - Grid → grid surface distorts like fabric/cloth
   - Dots → concentric ring waves from the 5 anchor points
   - Lines → per-column equalizer bars rising and falling
   - Image/Draw → characters shimmer while density-map shape is preserved
4. Speed slider changes animation rate visibly in Live mode
5. All other controls (colors, angle, density, char set) work correctly in Live mode
6. `prefers-reduced-motion` stops Live animation (one static frame rendered, then stopped)
7. Tab visibility pause/resume works correctly in Live mode
