# Plan: Control Panel Reorganization

## Context

The current control panel has three collapsible sections (MEDIA SETTINGS, ASCII SETTINGS, COLORS), all open by default. The layout doesn't match the natural authoring workflow — image upload is buried inside the first section, draw tool is mixed with shape settings, and all sections expanded at once creates cognitive overload. The user wants a restructured panel with clearer section headings, logical ordering that mirrors the creative workflow, and sections collapsed by default so users open only what they need.

## Goal

- Reorder controls into 5 logical sections matching the creative workflow sequence
- All sections **collapsed by default** (open only on user click)
- **Bigger, more legible section headers** (replace the tiny 10px uppercase labels)
- Image upload lives inside SHAPE (since "Image" is a pattern type)
- Draw tool gets its own dedicated DRAW section
- Reduce visual clutter / cognitive overload

## New Section Order & Contents

### 1. SHAPE
- Pattern type selector: Organic | Grid | Dots | Lines | Image
- Image upload area + thumbnail preview — visible only when "Image" pattern is selected
- Density slider

### 2. CHARACTER
- Character set dropdown (Numbers, Standard, Dots, Steps, Lines, Binary, Boxes, Light, Letters, Custom)
- Custom chars text input + char counter (when Custom selected)
- Character preview bar
- Size slider (4–32px)
- Dimension: Flat | 3D button group
- Enable Size Range toggle (3D only)
- Min / Max dual sliders (3D + sizeRange only)

### 3. DRAW
- Draw Pattern toggle
- Brush Size slider (visible only when Draw is on)

### 4. MOTION
- Scale / Zoom slider — label switches by dimension ("Scale" in Flat, "Zoom" in 3D)
- Spacing / Speed slider — label switches by dimension ("Spacing" in Flat, "Speed" in 3D)
- Pattern Angle slider (0–360°)
- Char Angle slider (0–360°)

### 5. COLORS
- Color mode: Mono | Duo | Trio
- Color pickers (1–3 based on mode)
- Gradient preview bar
- Gradient direction: Diagonal | Horizontal | Vertical | Radial
- Opacity slider
- Saturation slider
- Background sub-section: Gradient toggle + color pickers + preview bar

## Section Header Style Change

Replace the current `CollapseSection` heading style (10px, uppercase, faint) with a more prominent style:
- Font size: **13px** (up from 10px)
- Font weight: **600**
- Color: **rgba(255,255,255,0.88)** (up from ~0.55 TEXT_SEC)
- Subtle left accent bar: `borderLeft: "2px solid rgba(74,108,247,0.7)"`, padding-left 10px
- Keep ∨ / › expand chevron on the right

## Default State Change

All 5 sections start **closed**. Change all `useState(true)` → `useState(false)` for the section open/close state variables. Rename: `shapesOpen` → `shapeOpen`, add `charOpen`, `drawOpen`, `motionOpen`, keep `colorsOpen`.

## File to Modify

**`src/app/components/ControlPanel.tsx`** — all changes contained here:
1. Update `CollapseSection` sub-component for the new heading style
2. Change all section `useState` initial values to `false`
3. Rename/add the 5 state variables for the 5 sections
4. Reorder JSX into the 5 sections above — no logic changes, structural only
5. Move image upload block inside SHAPE (conditioned on `s.pattern === "image"`)
6. Move Draw toggle + Brush Size into dedicated DRAW section
7. Group Scale/Zoom, Spacing/Speed, and both Angle sliders into MOTION section
8. Keep the Export button fixed at the bottom outside all sections

## Verification

1. Panel renders with all 5 sections collapsed on load — only bold titles visible
2. Clicking a section header expands it and shows its controls
3. Image upload appears only when "Image" pattern is selected (inside SHAPE)
4. Brush Size appears only when Draw toggle is on (inside DRAW)
5. Scale/Spacing labels switch correctly between Flat and 3D modes
6. Export button remains visible at the bottom at all times
