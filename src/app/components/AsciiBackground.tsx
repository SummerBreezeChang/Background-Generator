import { useEffect, useRef, MutableRefObject } from "react";
import type { Settings, ImageDensityMap } from "../App";

// ─── Gradient color system ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

function buildGradientLUT(
  mode: Settings["colorMode"],
  c1: string, c2: string, c3: string,
  saturation = 1
): string[] {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = mode !== "mono" ? hexToRgb(c2) : [r1, g1, b1];
  const [r3, g3, b3] = mode === "trio" ? hexToRgb(c3) : [r2, g2, b2];

  return Array.from({ length: 256 }, (_, i) => {
    const t = i / 255;
    let r: number, g: number, b: number;
    if (mode === "mono") {
      [r, g, b] = [r1, g1, b1];
    } else if (mode === "duo") {
      r = Math.round(r1 + (r2 - r1) * t);
      g = Math.round(g1 + (g2 - g1) * t);
      b = Math.round(b1 + (b2 - b1) * t);
    } else {
      if (t < 0.5) {
        const tt = t * 2;
        r = Math.round(r1 + (r2 - r1) * tt);
        g = Math.round(g1 + (g2 - g1) * tt);
        b = Math.round(b1 + (b2 - b1) * tt);
      } else {
        const tt = (t - 0.5) * 2;
        r = Math.round(r2 + (r3 - r2) * tt);
        g = Math.round(g2 + (g3 - g2) * tt);
        b = Math.round(b2 + (b3 - b2) * tt);
      }
    }
    // Apply saturation via luma-weighted blend (sat=0 → grayscale, sat=1 → natural, sat=2 → vivid)
    if (saturation !== 1) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      r = clamp(Math.round(luma + (r - luma) * saturation), 0, 255);
      g = clamp(Math.round(luma + (g - luma) * saturation), 0, 255);
      b = clamp(Math.round(luma + (b - luma) * saturation), 0, 255);
    }
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  });
}

function lutKey(s: Settings) {
  return `${s.colorMode}|${s.color1}|${s.color2}|${s.color3}|${s.colorSaturation}`;
}

// ─── 2D Value Noise (for flat mode cloud shapes) ──────────────────────────────

function hash21(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx); // smoothstep
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix,     iy);
  const b = hash21(ix + 1, iy);
  const c = hash21(ix,     iy + 1);
  const d = hash21(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (d - b - c + a) * ux * uy;
}

function fbm(x: number, y: number, octaves = 5): number {
  let v = 0, amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    v   += valueNoise(x * freq, y * freq) * amp;
    sum += amp;
    amp  *= 0.5;
    freq *= 2.0;
  }
  return v / sum;
}

// ─── Character sets ───────────────────────────────────────────────────────────

const CHAR_SETS: Partial<Record<Settings["charSet"], string>> = {
  standard:   ".,~-:;=!*#@",
  dots_set:   "·:.,;·",
  steps:      " .:;=+*#@",
  lines_only: "|/-\\+",
  binary:     "01",
  boxes:      "█▓▒░ ",
  light:      " .-=:",
  numbers:    "0123456789",
  letters:    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
};

function charPool(s: Settings): string {
  if (s.charSet === "custom") return s.customChars.trim() || "0123456789";
  return CHAR_SETS[s.charSet] ?? "0123456789";
}

function pickChar(s: Settings): string {
  const pool = charPool(s);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Deterministic char per grid cell (no flicker on non-char-setting changes)
function cellChar(col: number, row: number, pool: string): string {
  const h = Math.abs(Math.sin(col * 127.1 + row * 311.7) * 43758.5453);
  return pool[Math.floor((h - Math.floor(h)) * pool.length)];
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AsciiParticle {
  x: number; y: number;
  baseX: number; baseY: number;
  z: number;
  vx: number; vy: number;
  char: string;
  fontSize: number;
  normT: number;
  opacity: number;
  phaseX: number; phaseY: number;
  freqX: number; freqY: number;
  ampX: number; ampY: number;
  charRefreshAt: number;
}

interface ClusterCenter {
  x: number; y: number;
  baseX: number; baseY: number;
  radius: number;
  phase: number; speed: number;
  ampX: number; ampY: number;
  particleCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function makeCluster(x: number, y: number, radius: number, particleCount: number, ampX: number, ampY: number): ClusterCenter {
  return { x, y, baseX: x, baseY: y, radius, phase: Math.random() * Math.PI * 2, speed: 0.00012 + Math.random() * 0.0003, ampX, ampY, particleCount };
}

function capTotal(clusters: ClusterCenter[], density: number) {
  const max = Math.floor(4000 * Math.min(density, 2));
  const total = clusters.reduce((s, c) => s + c.particleCount, 0);
  if (total > max) {
    const sc = max / total;
    for (const c of clusters) c.particleCount = Math.max(8, Math.floor(c.particleCount * sc));
  }
}

// ─── Cluster builders ─────────────────────────────────────────────────────────

function buildOrganicClusters(w: number, h: number, d: number): ClusterCenter[] {
  const count = Math.round(10 + d * 3), minDist = Math.min(w, h) * 0.13, margin = 60;
  const clusters: ClusterCenter[] = [];
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let a = 0; a < 60; a++) {
      const cx = margin + Math.random() * (w - 2 * margin), cy = margin + Math.random() * (h - 2 * margin);
      if (clusters.every(e => Math.hypot(cx - e.baseX, cy - e.baseY) >= minDist)) {
        const r = 70 + Math.random() * 160;
        clusters.push(makeCluster(cx, cy, r, clamp(Math.floor(r * r * 0.03 * d), 80, 500), 25 + Math.random() * 55, 18 + Math.random() * 42));
        placed = true; break;
      }
    }
    if (!placed) {
      const r = 60 + Math.random() * 100;
      clusters.push(makeCluster(margin + Math.random() * (w - 2 * margin), margin + Math.random() * (h - 2 * margin), r, clamp(Math.floor(r * r * 0.03 * d), 50, 300), 20 + Math.random() * 40, 15 + Math.random() * 30));
    }
  }
  capTotal(clusters, d); return clusters;
}

function buildGridClusters(w: number, h: number, d: number): ClusterCenter[] {
  const cols = Math.round(4 + d * 2), rows = Math.round(3 + d * 1.5);
  const clusters: ClusterCenter[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = (c + 0.5) / cols * w + (Math.random() - 0.5) * 28;
    const cy = (r + 0.5) / rows * h + (Math.random() - 0.5) * 20;
    clusters.push(makeCluster(cx, cy, 38 + Math.random() * 38, clamp(Math.floor(90 * d), 50, 220), 10 + Math.random() * 18, 8 + Math.random() * 14));
  }
  capTotal(clusters, d); return clusters;
}

function buildDotClusters(w: number, h: number, d: number): ClusterCenter[] {
  const origins = [[w * 0.25, h * 0.35], [w * 0.75, h * 0.65], [w * 0.5, h * 0.5], [w * 0.15, h * 0.72], [w * 0.85, h * 0.28]];
  const clusters: ClusterCenter[] = [];
  const step = clamp(Math.min(w, h) * 0.09, 45, 130);
  for (const [ox, oy] of origins) {
    clusters.push(makeCluster(ox, oy, 28 + Math.random() * 20, clamp(Math.floor(90 * d), 40, 180), 8 + Math.random() * 12, 6 + Math.random() * 10));
    const rings = Math.round(2 + d * 1.5);
    for (let ring = 1; ring <= rings; ring++) {
      const pts = Math.max(4, Math.round(ring * 5));
      for (let p = 0; p < pts; p++) {
        const angle = (p / pts) * Math.PI * 2;
        const cx = ox + Math.cos(angle) * ring * step, cy = oy + Math.sin(angle) * ring * step;
        if (cx >= 0 && cx <= w && cy >= 0 && cy <= h)
          clusters.push(makeCluster(cx, cy, 18 + Math.random() * 22, clamp(Math.floor(55 * d), 25, 130), 6 + Math.random() * 10, 5 + Math.random() * 8));
      }
    }
  }
  capTotal(clusters, d); return clusters;
}

function buildLineClusters(w: number, h: number, d: number): ClusterCenter[] {
  const lineCount = Math.round(4 + d * 2);
  const clusters: ClusterCenter[] = [];
  for (let l = 0; l < lineCount; l++) {
    const y0 = (l + 0.5) / lineCount * h, amp = 25 + Math.random() * 70;
    const freq = 0.003 + Math.random() * 0.005, phase = Math.random() * Math.PI * 2;
    const pts = Math.round(7 + d * 5);
    for (let p = 0; p < pts; p++) {
      const cx = (p + 0.5) / pts * w;
      clusters.push(makeCluster(cx, y0 + Math.sin(cx * freq + phase) * amp, 16 + Math.random() * 22, clamp(Math.floor(75 * d), 28, 160), 5 + Math.random() * 8, 18 + Math.random() * 30));
    }
  }
  capTotal(clusters, d); return clusters;
}

function buildImageClusters(map: ImageDensityMap, w: number, h: number, d: number): ClusterCenter[] {
  const { data, w: mw, h: mh } = map;
  const clusters: ClusterCenter[] = [];
  const THRESHOLD = 0.18;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const val = data[y * mw + x];
      if (val > THRESHOLD && Math.random() < val * 0.8) {
        const cx = ((x + 0.5) / mw) * w;
        const cy = ((y + 0.5) / mh) * h;
        const r = 14 + val * 48;
        clusters.push(makeCluster(cx, cy, r, clamp(Math.floor(val * 75 * d), 16, 200), 5 + val * 20, 4 + val * 15));
      }
    }
  }
  if (clusters.length === 0) return buildOrganicClusters(w, h, d);
  capTotal(clusters, d);
  return clusters;
}

function buildClusters(w: number, h: number, s: Settings, imageMap: ImageDensityMap | null): ClusterCenter[] {
  switch (s.pattern) {
    case "grid":  return buildGridClusters(w, h, s.density);
    case "dots":  return buildDotClusters(w, h, s.density);
    case "lines": return buildLineClusters(w, h, s.density);
    case "image": return imageMap ? buildImageClusters(imageMap, w, h, s.density) : buildOrganicClusters(w, h, s.density);
    default:      return buildOrganicClusters(w, h, s.density);
  }
}

// ─── Particle builder ─────────────────────────────────────────────────────────

function buildParticles(clusters: ClusterCenter[], s: Settings, now: number): AsciiParticle[] {
  const particles: AsciiParticle[] = [];
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const u1 = Math.max(Math.random(), 1e-9), u2 = Math.random();
      const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const r = Math.min(Math.abs(gauss) * 0.42, 1.0) * cluster.radius;
      const distNorm = r / cluster.radius;
      const normT = clamp(1 - distNorm, 0, 1);
      const bx = cluster.baseX + Math.cos(angle) * r;
      const by = cluster.baseY + Math.sin(angle) * r;
      const fontSize = clamp(lerp(22, 7, distNorm * distNorm) + (Math.random() - 0.5) * 2, 7, 22);
      const opacity = clamp(lerp(0.88, 0.08, distNorm) * (0.55 + Math.random() * 0.45), 0.06, 0.92);
      particles.push({
        x: bx, y: by, baseX: bx, baseY: by,
        z: (Math.random() - 0.5) * 600,
        vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.09,
        char: pickChar(s),
        fontSize: Math.round(fontSize), normT, opacity,
        phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2,
        freqX: 0.0003 + Math.random() * 0.0005, freqY: 0.0002 + Math.random() * 0.0004,
        ampX: 4 + Math.random() * 15, ampY: 3 + Math.random() * 12,
        charRefreshAt: now + 8000 + Math.random() * 7000,
      });
    }
  }
  particles.sort((a, b) => a.fontSize - b.fontSize);
  return particles;
}

// ─── Flat mode renderer ───────────────────────────────────────────────────────

function drawFlatMode(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  s: Settings,
  lut: string[],
  drawingMap: { data: number[]; w: number; h: number } | null = null
) {
  // Background — always diagonal gradient when in gradient mode
  if (s.bgMode === "gradient") {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, s.bgColor1);
    grad.addColorStop(1, s.bgColor2);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = s.bgColor1;
  }
  ctx.fillRect(0, 0, w, h);

  // Scale (zoom) controls character size; Spacing (speed) controls gap between characters
  const scaleFactor   = s.zoom / 100;
  const spacingFactor = clamp(s.speed, 0.2, 3.0);
  const charPx = Math.round(s.baseSize * scaleFactor);
  const cellW  = s.baseSize * 1.1 * scaleFactor * spacingFactor;
  const cellH  = s.baseSize * 1.6 * scaleFactor * spacingFactor;

  // Visible grid dimensions (no rotation padding)
  const visCols = Math.ceil(w / cellW) + 1;
  const visRows = Math.ceil(h / cellH) + 1;
  const nsx = 2.0 / Math.max(1, visCols);
  const nsy = 2.0 / Math.max(1, visRows);
  const threshold = lerp(0.65, 0.22, (s.density - 0.4) / 1.6);

  // Angle: rotate context around canvas center; extend grid to fill all edges
  const angleRad     = ((s.angle     ?? 0) * Math.PI) / 180;
  const charAngleRad = ((s.charAngle ?? 0) * Math.PI) / 180;
  const useCharRot   = Math.abs(charAngleRad) > 0.001;
  const diag     = Math.sqrt(w * w + h * h);
  const padCols  = Math.ceil((diag - w) / 2 / cellW) + 2;
  const padRows  = Math.ceil((diag - h) / 2 / cellH) + 2;

  ctx.font = `${charPx}px 'Courier New', monospace`;
  const pool = charPool(s);
  const ccx = visCols / 2, ccy = visRows / 2;
  let lastFill = "";

  ctx.save();
  if (Math.abs(angleRad) > 0.001) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angleRad);
    ctx.translate(-w / 2, -h / 2);
  }

  const colStart = -padCols, colEnd = visCols + padCols;
  const rowStart = -padRows, rowEnd = visRows + padRows;

  for (let row = rowStart; row < rowEnd; row++) {
    for (let col = colStart; col < colEnd; col++) {
      let strength: number;

      if (drawingMap) {
        const mx  = clamp(Math.floor((col / visCols) * drawingMap.w), 0, drawingMap.w - 1);
        const my  = clamp(Math.floor((row / visRows) * drawingMap.h), 0, drawingMap.h - 1);
        const val = drawingMap.data[my * drawingMap.w + mx] ?? 0;
        if (val < 0.04) continue;
        strength = val;
      } else {
        const n = fbm(col * nsx, row * nsy, 5);
        if (n < threshold) continue;
        strength = (n - threshold) / (1.0 - threshold);
      }

      // Gradient direction → LUT index (using visible-normalised coords)
      let tGrad: number;
      switch (s.gradientDir) {
        case "horizontal": tGrad = clamp(col / visCols, 0, 1); break;
        case "vertical":   tGrad = clamp(row / visRows, 0, 1); break;
        case "radial": {
          const dx = (col - ccx) / (visCols * 0.5), dy = (row - ccy) / (visRows * 0.5);
          tGrad = clamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1);
          break;
        }
        default: tGrad = clamp((col / visCols) * 0.5 + (row / visRows) * 0.5, 0, 1);
      }
      const lutIdx = Math.round(tGrad * 255);

      const opacity = clamp((strength * 0.35 + 0.75) * s.colorOpacity, 0.02, 1.0);

      const fill = lut[lutIdx] ?? lut[0];

      if (useCharRot) {
        // Rotate each character around its visual centre; save/restore isolates the transform
        const tx = col * cellW + charPx * 0.3;
        const ty = row * cellH + charPx * 0.45;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle   = fill;
        ctx.translate(tx, ty);
        ctx.rotate(charAngleRad);
        ctx.fillText(cellChar(col, row, pool), -charPx * 0.3, charPx * 0.45);
        ctx.restore();
      } else {
        if (fill !== lastFill) { ctx.fillStyle = fill; lastFill = fill; }
        ctx.globalAlpha = opacity;
        ctx.fillText(cellChar(col, row, pool), col * cellW, row * cellH + charPx);
      }
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  settingsRef: MutableRefObject<Settings>;
  rebuildTrigger: number;
  imageDensityMapRef: MutableRefObject<ImageDensityMap | null>;
}

export function AsciiBackground({ settingsRef, rebuildTrigger, imageDensityMapRef }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<AsciiParticle[]>([]);
  const clustersRef  = useRef<ClusterCenter[]>([]);
  const rafRef       = useRef<number>(0);

  const activeCharSetRef     = useRef<Settings["charSet"]>("numbers");
  const activeCustomCharsRef = useRef<string>("");
  const gradientLUTRef       = useRef<string[]>([]);
  const activeLUTKeyRef      = useRef<string>("");

  // 3D background cache
  const bgKeyRef      = useRef<string>("");
  const bgGradientRef = useRef<CanvasGradient | null>(null);

  // Flat mode: track last drawn state to avoid redundant redraws
  const activeFlatKeyRef = useRef<string>("");
  const wasFlatRef       = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current, wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function init() {
      const w = wrapper!.clientWidth, h = wrapper!.clientHeight;
      if (w === 0 || h === 0) return;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = settingsRef.current;
      activeCharSetRef.current = s.charSet;
      activeCustomCharsRef.current = s.customChars;
      gradientLUTRef.current = buildGradientLUT(s.colorMode, s.color1, s.color2, s.color3, s.colorSaturation);
      activeLUTKeyRef.current = lutKey(s);
      bgKeyRef.current = "";
      activeFlatKeyRef.current = ""; // force redraw after resize/rebuild
      // Always build 3D particles so switching modes is seamless
      const now = performance.now();
      clustersRef.current = buildClusters(w, h, s, imageDensityMapRef.current);
      particlesRef.current = buildParticles(clustersRef.current, s, now);
    }

    init();

    let lastFontSize = -1;
    let lastLutIdx   = -1;

    function tick(ts: number) {
      const canvas = canvasRef.current, wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(tick); return; }

      const s = settingsRef.current;
      const isFlat = s.dimension === "flat";

      // Always keep LUT current (used by both modes)
      const key = lutKey(s);
      if (key !== activeLUTKeyRef.current) {
        gradientLUTRef.current = buildGradientLUT(s.colorMode, s.color1, s.color2, s.color3, s.colorSaturation);
        activeLUTKeyRef.current = key;
        lastLutIdx = -1;
        activeFlatKeyRef.current = ""; // force flat redraw on color change
      }

      // ── FLAT MODE ─────────────────────────────────────────────────────────
      if (isFlat) {
        // Force redraw when transitioning from 3D → flat
        if (!wasFlatRef.current) {
          activeFlatKeyRef.current = "";
          wasFlatRef.current = true;
        }

        const fKey = [
          w, h, s.baseSize, s.density, s.zoom, s.speed, s.angle, s.charAngle, s.gradientDir,
          s.pattern, s.charSet, s.customChars,
          s.colorMode, s.color1, s.color2, s.color3,
          s.colorOpacity, s.colorSaturation,
          s.bgMode, s.bgColor1, s.bgColor2,
        ].join("|");

        if (fKey !== activeFlatKeyRef.current) {
          activeFlatKeyRef.current = fKey;
          const flatDrawMap = s.pattern === "image" ? imageDensityMapRef.current : null;
          drawFlatMode(ctx, w, h, s, gradientLUTRef.current, flatDrawMap);
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── 3D PARTICLE MODE ──────────────────────────────────────────────────
      wasFlatRef.current = false;

      // Live re-char on charSet / customChars change
      const customCharsChanged = s.charSet === "custom" && s.customChars !== activeCustomCharsRef.current;
      if (s.charSet !== activeCharSetRef.current || customCharsChanged) {
        const now = performance.now();
        for (const p of particlesRef.current) {
          p.char = pickChar(s);
          p.charRefreshAt = now + 8000 + Math.random() * 7000;
        }
        activeCharSetRef.current = s.charSet;
        activeCustomCharsRef.current = s.customChars;
      }

      const { speed, baseSize, minSize, sizeRange, zoom } = s;
      const focal = 500, cx = w / 2, cy = h / 2;
      const angleOffset    = ((s.angle     ?? 0) * Math.PI) / 180;
      const charAngle3d    = ((s.charAngle ?? 0) * Math.PI) / 180;
      const useCharRot3d   = Math.abs(charAngle3d) > 0.001;
      const rotAngle = ts * 0.00004 * speed + angleOffset;
      const cosA = Math.cos(rotAngle), sinA = Math.sin(rotAngle);
      const zoomFactor = zoom / 100;

      // Background
      const bgKey = `${s.bgMode}|${s.bgColor1}|${s.bgColor2}|${w}|${h}`;
      if (bgKey !== bgKeyRef.current) {
        bgKeyRef.current = bgKey;
        if (s.bgMode === "gradient") {
          // Always diagonal: top-left → bottom-right
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, s.bgColor1);
          grad.addColorStop(1, s.bgColor2);
          bgGradientRef.current = grad;
        } else {
          bgGradientRef.current = null;
        }
      }

      if (s.bgMode === "gradient" && bgGradientRef.current) {
        ctx.fillStyle = bgGradientRef.current;
      } else {
        ctx.fillStyle = s.bgColor1;
      }
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      lastFontSize = -1; lastLutIdx = -1;

      const clusters = clustersRef.current, particles = particlesRef.current;
      const lut = gradientLUTRef.current;

      for (const c of clusters) {
        c.x = c.baseX + Math.sin(ts * c.speed * speed + c.phase) * c.ampX;
        c.y = c.baseY + Math.cos(ts * c.speed * speed * 0.7 + c.phase) * c.ampY;
      }

      for (const p of particles) {
        const ox = Math.sin(ts * p.freqX * speed + p.phaseX) * p.ampX;
        const oy = Math.cos(ts * p.freqY * speed + p.phaseY) * p.ampY;
        p.baseX += p.vx * speed; p.baseY += p.vy * speed;
        const margin = 50;
        if (p.baseX < -margin) p.baseX += w + margin * 2;
        else if (p.baseX > w + margin) p.baseX -= w + margin * 2;
        if (p.baseY < -margin) p.baseY += h + margin * 2;
        else if (p.baseY > h + margin) p.baseY -= h + margin * 2;
        p.x = p.baseX + ox; p.y = p.baseY + oy;

        if (ts >= p.charRefreshAt) {
          p.char = pickChar(s);
          p.charRefreshAt = ts + 8000 + Math.random() * 7000;
        }

        // 3D perspective rotation
        const relX = p.x - cx;
        const rotX = relX * cosA - p.z * sinA;
        const rotZ = relX * sinA + p.z * cosA;
        const depth = focal + rotZ;
        const scale = focal / Math.max(depth, 50);
        let drawX = cx + rotX * scale;
        let drawY = cy + (p.y - cy) * scale;
        // Size driven by perspective depth only (not cluster membership),
        // so switching patterns never changes character scale.
        const depthT = sizeRange ? clamp((scale - 0.5) / 1.5, 0, 1) : 1;
        const baseFS = lerp(minSize, baseSize, depthT);
        const drawFontSize = Math.max(4, baseFS * zoomFactor);
        const drawAlpha = clamp(p.opacity * Math.min(1.5, scale * 1.1) * s.colorOpacity, 0.02, 1);

        // Zoom around canvas center
        drawX = cx + (drawX - cx) * zoomFactor;
        drawY = cy + (drawY - cy) * zoomFactor;

        // Gradient direction
        let tGrad: number;
        switch (s.gradientDir) {
          case "horizontal": tGrad = clamp(drawX / w, 0, 1); break;
          case "vertical":   tGrad = clamp(drawY / h, 0, 1); break;
          case "radial": {
            const dx = (drawX - cx) / (w * 0.5), dy = (drawY - cy) / (h * 0.5);
            tGrad = clamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1);
            break;
          }
          default: tGrad = clamp((drawX / w) * 0.5 + (drawY / h) * 0.5, 0, 1);
        }
        const lutIdx = Math.round(tGrad * 255);

        const roundedSize = Math.round(drawFontSize);
        if (roundedSize !== lastFontSize) {
          ctx.font = `${roundedSize}px 'Courier New', monospace`;
          lastFontSize = roundedSize;
        }

        ctx.globalAlpha = drawAlpha;

        if (lutIdx !== lastLutIdx) {
          ctx.fillStyle = lut[lutIdx] ?? lut[0];
          lastLutIdx = lutIdx;
        }

        if (useCharRot3d) {
          // Translate to char centre, rotate, draw, reset transform (setTransform
          // is fast and doesn't reset fillStyle / globalAlpha / font)
          const tx = drawX + roundedSize * 0.3;
          const ty = drawY - roundedSize * 0.4;
          ctx.translate(tx, ty);
          ctx.rotate(charAngle3d);
          ctx.fillText(p.char, -roundedSize * 0.3, roundedSize * 0.4);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else {
          ctx.fillText(p.char, drawX, drawY);
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      init();
      rafRef.current = requestAnimationFrame(tick);
    });
    ro.observe(wrapper);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildTrigger]);

  return (
    <div ref={wrapperRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
