import { useRef, useState, useEffect } from "react";
import { AsciiBackground } from "./components/AsciiBackground";
import { ControlPanel } from "./components/ControlPanel";
import { DrawCanvas, type DrawCanvasHandle } from "./components/DrawCanvas";
import { PresetBar, MAX_PRESETS, type DrawPreset } from "./components/PresetBar";
import { ExportModal } from "./components/ExportModal";

export interface Settings {
  dimension: "flat" | "flat-anim" | "3d";
  pattern: "organic" | "grid" | "dots" | "lines" | "image";
  charSet: "standard" | "dots_set" | "steps" | "lines_only" | "binary" | "boxes" | "light" | "numbers" | "letters" | "custom";
  customChars: string;
  density: number;      // 0.4–2.0
  speed: number;        // 0.2–3.0
  baseSize: number;     // 4–32px
  minSize: number;      // 4–20px (3D only)
  sizeRange: boolean;   // 3D only
  zoom: number;         // Legacy export field; visual scale is controlled by baseSize
  colorMode: "mono" | "duo" | "trio";
  color1: string;
  color2: string;
  color3: string;
  gradientDir: "diagonal" | "horizontal" | "vertical" | "radial";
  colorOpacity: number;    // 0.1–1.0
  colorSaturation: number; // 0–2.0 (1 = natural)
  angle: number;           // 0–360° — whole pattern rotation
  charAngle: number;       // 0–360° — per-character rotation
  bgMode: "solid" | "gradient";
  bgColor1: string;
  bgColor2: string;
}

export interface ImageDensityMap {
  data: number[];
  w: number;
  h: number;
}

const SETTINGS_KEY = "ascii-bg-settings-v1";

const DEFAULT_SETTINGS: Settings = {
  dimension: "flat",
  pattern: "organic",
  charSet: "numbers",
  customChars: "▲△■□●○◆◇",
  density: 1,
  speed: 1,
  baseSize: 14,
  minSize: 6,
  sizeRange: true,
  zoom: 100,
  colorMode: "duo",
  color1: "#e040fb",
  color2: "#40c4ff",
  color3: "#ffffff",
  gradientDir: "diagonal",
  colorOpacity: 1,
  colorSaturation: 1,
  angle: 0,
  charAngle: 0,
  bgMode: "solid",
  bgColor1: "#06071a",
  bgColor2: "#1a0a2e",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    // Merge saved over defaults so new keys always have a value
    return { ...DEFAULT_SETTINGS, ...saved, zoom: 100 };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const imageDensityMapRef = useRef<ImageDensityMap | null>(null);

  const [rebuildTrigger, setRebuildTrigger] = useState(0);
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDrawMode,   setIsDrawMode]   = useState(false);
  const [brushSize,    setBrushSize]    = useState(40);
  const [showExport,   setShowExport]   = useState(false);

  // Draw canvas imperative handle
  const drawCanvasRef    = useRef<DrawCanvasHandle>(null);
  // Presets
  const [presets, setPresets] = useState<DrawPreset[]>([]);
  const presetCounterRef = useRef(0);

  // ── Viewport pan / zoom ────────────────────────────────────────────────────
  const [viewport,     setViewport]     = useState({ panX: 0, panY: 0, zoom: 1 });
  const [isSpaceDown,  setIsSpaceDown]  = useState(false);
  const [isPanning,    setIsPanning]    = useState(false);
  const outerRef      = useRef<HTMLDivElement>(null);
  const isSpaceRef    = useRef(false);
  const isPanRef      = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });

  // Keyboard: Space key enters pan mode
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        isSpaceRef.current = true;
        setIsSpaceDown(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceRef.current = false;
        isPanRef.current   = false;
        setIsSpaceDown(false);
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // Mouse wheel: cursor-centred zoom (non-passive so preventDefault works)
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.pow(1.001, -e.deltaY);
      const rect   = el.getBoundingClientRect();
      const mx     = e.clientX - rect.left;
      const my     = e.clientY - rect.top;
      setViewport(prev => {
        const newZoom = Math.max(0.05, Math.min(20, prev.zoom * factor));
        const f = newZoom / prev.zoom;
        return { zoom: newZoom, panX: mx - (mx - prev.panX) * f, panY: my - (my - prev.panY) * f };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function handlePanStart(e: React.MouseEvent) {
    isPanRef.current = true;
    setIsPanning(true);
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
  }
  function handlePanMove(e: React.MouseEvent) {
    if (!isPanRef.current) return;
    const dx = e.clientX - lastPanPosRef.current.x;
    const dy = e.clientY - lastPanPosRef.current.y;
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    setViewport(p => ({ ...p, panX: p.panX + dx, panY: p.panY + dy }));
  }
  function handlePanEnd() {
    isPanRef.current = false;
    setIsPanning(false);
  }
  function resetView() { setViewport({ panX: 0, panY: 0, zoom: 1 }); }

  const isViewMoved = viewport.zoom !== 1 || viewport.panX !== 0 || viewport.panY !== 0;
  const FONT = "'Inter', system-ui, sans-serif";

  function updateSettings(updates: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      settingsRef.current = next;
      return next;
    });
    if ("pattern" in updates || "density" in updates) {
      if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
      rebuildTimerRef.current = setTimeout(() => setRebuildTrigger(t => t + 1), 140);
    }
  }

  // ── Draw preset handlers ───────────────────────────────────────────────────
  function handleToggleDrawMode() {
    const turningOff = isDrawMode;
    setIsDrawMode(d => !d);
    // When turning draw off, revert from the image pattern it applied
    if (turningOff && settingsRef.current.pattern === "image") {
      imageDensityMapRef.current = null;
      setSettings(prev => {
        const next = { ...prev, pattern: "organic" as const };
        settingsRef.current = next;
        return next;
      });
      setRebuildTrigger(t => t + 1);
    }
  }

  function handleClearStrokes() {
    drawCanvasRef.current?.clearCanvas();
    imageDensityMapRef.current = null;
    // Revert pattern if stuck in image mode from a previous draw
    if (settingsRef.current.pattern === "image") {
      setSettings(prev => {
        const next = { ...prev, pattern: "organic" as const };
        settingsRef.current = next;
        return next;
      });
    }
    setRebuildTrigger(t => t + 1);
  }

  function handleSavePreset() {
    if (presets.length >= MAX_PRESETS) return;
    const snap = drawCanvasRef.current?.buildSnapshot();
    if (!snap) return;
    presetCounterRef.current++;
    setPresets(p => [...p, { id: presetCounterRef.current, ...snap }]);
  }

  function handleApplyPreset(preset: DrawPreset) {
    drawCanvasRef.current?.loadPreset(preset.thumbnail);
    handleImageUpload(preset.map);
  }

  function handleDeletePreset(id: number) {
    setPresets(p => p.filter(x => x.id !== id));
  }

  function handleImageUpload(map: ImageDensityMap) {
    imageDensityMapRef.current = map;
    setSettings(prev => {
      const next = { ...prev, pattern: "image" as const };
      settingsRef.current = next;
      return next;
    });
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    setRebuildTrigger(t => t + 1);
  }

  return (
    <div ref={outerRef} className="relative size-full" style={{ background: settings.bgColor1, overflow: "hidden" }}>

      {/* ── Transformed viewport ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        transformOrigin: "0 0",
        transform: `translate(${viewport.panX}px,${viewport.panY}px) scale(${viewport.zoom})`,
        width: "100%", height: "100%",
      }}>
        <AsciiBackground
          settingsRef={settingsRef}
          rebuildTrigger={rebuildTrigger}
          imageDensityMapRef={imageDensityMapRef}
        />
        {isDrawMode && (
          <DrawCanvas
            ref={drawCanvasRef}
            onDraw={handleImageUpload}
            brushSize={brushSize}
          />
        )}
      </div>

      {/* ── Space-hold pan overlay (sits above everything incl. draw canvas) */}
      {isSpaceDown && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 200, cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
        />
      )}

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 18, left: 20, zIndex: 201,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
        pointerEvents: "none",
      }}>
        {isSpaceDown && (
          <div style={{
            background: "rgba(6,7,26,0.72)", border: "1px solid rgba(255,255,255,0.13)",
            color: "rgba(255,255,255,0.72)", fontFamily: FONT, fontSize: 11,
            padding: "5px 14px", borderRadius: 20, letterSpacing: "0.09em",
            backdropFilter: "blur(8px)", whiteSpace: "nowrap",
          }}>
            HOLD SPACE + DRAG TO PAN
          </div>
        )}
        {isViewMoved && (
          <button
            onClick={resetView}
            style={{
              pointerEvents: "auto",
              background: "rgba(6,7,26,0.72)", border: "1px solid rgba(255,255,255,0.13)",
              color: "rgba(255,255,255,0.72)", fontFamily: FONT, fontSize: 11,
              padding: "5px 14px", borderRadius: 20, letterSpacing: "0.09em",
              backdropFilter: "blur(8px)", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Reset view · {Math.round(viewport.zoom * 100)}%
          </button>
        )}
      </div>

      {/* ── Draw mode hint ───────────────────────────────────────────────── */}
      {isDrawMode && !isSpaceDown && (
        <div style={{
          position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
          zIndex: 201, pointerEvents: "none",
          background: "rgba(6,7,26,0.70)", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.70)", fontFamily: FONT, fontSize: 11,
          padding: "5px 18px", borderRadius: 20, letterSpacing: "0.09em",
          backdropFilter: "blur(8px)", whiteSpace: "nowrap",
        }}>
          DRAW MODE · paint to sculpt · release mouse to apply
        </div>
      )}

      {/* ── Preset bar (only in draw mode) ───────────────────────────────── */}
      {isDrawMode && (
        <PresetBar
          presets={presets}
          canSave={presets.length < MAX_PRESETS}
          onSave={handleSavePreset}
          onApply={handleApplyPreset}
          onDelete={handleDeletePreset}
          onClear={handleClearStrokes}
        />
      )}

      <ControlPanel
        settings={settings}
        onUpdate={updateSettings}
        onImageUpload={handleImageUpload}
        isDrawMode={isDrawMode}
        onToggleDrawMode={handleToggleDrawMode}
        brushSize={brushSize}
        onBrushSize={setBrushSize}
        onExport={() => setShowExport(true)}
      />

      {showExport && (
        <ExportModal
          settings={settings}
          imageMap={imageDensityMapRef.current}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
