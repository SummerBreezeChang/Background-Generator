import { useState, useEffect, useRef, type ReactNode } from "react";
import type { Settings, ImageDensityMap } from "../App";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PATTERNS: { id: Settings["pattern"]; label: string }[] = [
  { id: "organic", label: "Organic" },
  { id: "grid",    label: "Grid"    },
  { id: "dots",    label: "Dots"    },
  { id: "lines",   label: "Lines"   },
  { id: "image",   label: "Image"   },
];

interface CharOption { id: Settings["charSet"]; label: string; preview: string }
const CHAR_OPTIONS: CharOption[] = [
  { id: "numbers",    label: "Numbers",  preview: "0123456789"  },
  { id: "standard",   label: "Standard", preview: ".,~-:;=!*#@" },
  { id: "dots_set",   label: "Dots",     preview: "·:.,;·"      },
  { id: "steps",      label: "Steps",    preview: ".:;=+*#@"    },
  { id: "lines_only", label: "Lines",    preview: "|/-\\+"      },
  { id: "binary",     label: "Binary",   preview: "0 1"         },
  { id: "boxes",      label: "Boxes",    preview: "█▓▒░ "       },
  { id: "light",      label: "Light",    preview: " .-=:"       },
  { id: "letters",    label: "Letters",  preview: "ABCDEFGHIJ"  },
  { id: "custom",     label: "Custom",   preview: ""            },
];

// ─── Design tokens ─────────────────────────────────────────────────────────────

const PANEL_BG = "#e6e6ef";
const ITEM_BG  = "#d0d0dc";
const WELL_BG  = "rgba(0,0,0,0.06)";
const TEXT_PRI = "#18182a";
const TEXT_SEC = "#6b6b88";
const TEXT_MUT = "#9999b2";
const DIVIDER  = "rgba(0,0,0,0.09)";
const BLUE_ON  = "#4a6cf7";
const FONT     = "'Inter', system-ui, -apple-system, sans-serif";

// ─── Image processing ─────────────────────────────────────────────────────────

function processImageToMap(file: File): Promise<ImageDensityMap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const SZ = 40;
      const offscreen = document.createElement("canvas");
      offscreen.width = SZ; offscreen.height = SZ;
      const ctx = offscreen.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SZ, SZ);
      ctx.drawImage(img, 0, 0, SZ, SZ);
      const imgData = ctx.getImageData(0, 0, SZ, SZ);
      URL.revokeObjectURL(url);
      const data: number[] = [];
      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i], g = imgData.data[i + 1], b = imgData.data[i + 2];
        data.push(1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255);
      }
      resolve({ data, w: SZ, h: SZ });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load")); };
    img.src = url;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  settings: Settings;
  onUpdate: (u: Partial<Settings>) => void;
  onImageUpload: (map: ImageDensityMap) => void;
  isDrawMode: boolean;
  onToggleDrawMode: () => void;
  brushSize: number;
  onBrushSize: (v: number) => void;
  onExport: () => void;
}

export function ControlPanel({ settings, onUpdate, onImageUpload, isDrawMode, onToggleDrawMode, brushSize, onBrushSize, onExport }: Props) {
  const [open,            setOpen]        = useState(true);
  const [charDropOpen,    setCharDropOpen]    = useState(false);
  const [patternDropOpen, setPatternDropOpen] = useState(false);

  // Character open by default so users can start experimenting immediately
  const [shapeOpen,  setShapeOpen]  = useState(false);
  const [charOpen,   setCharOpen]   = useState(true);  // open
  const [drawOpen,   setDrawOpen]   = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);

  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const charDropRef    = useRef<HTMLDivElement>(null);
  const patternDropRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const activeChar    = CHAR_OPTIONS.find(c => c.id === settings.charSet)!;
  const activePattern = PATTERNS.find(p => p.id === settings.pattern)!;
  const densityPct    = Math.round(((settings.density - 0.4) / 1.6) * 100);
  const isFlat        = settings.dimension === "flat";
  const isCustomChar  = settings.charSet === "custom";

  const charPreview = isCustomChar
    ? (settings.customChars || "▲△■□●○◆◇")
    : (activeChar?.preview ?? "");

  // Inject styles
  useEffect(() => {
    if (document.getElementById("cp-styles")) return;
    const el = document.createElement("style");
    el.id = "cp-styles";
    el.textContent = `
      .cp-slider{-webkit-appearance:none;appearance:none;outline:none;border:none;background:transparent;width:100%;cursor:pointer;height:20px}
      .cp-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;margin-top:-5.5px}
      .cp-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);border:none;cursor:pointer}
      .cp-slider::-webkit-slider-runnable-track{height:3px;border-radius:2px}
      .cp-slider::-moz-range-track{height:3px;border-radius:2px}
      .cp-text-input{width:100%;background:${ITEM_BG};border:none;outline:none;border-radius:7px;padding:7px 10px;font-family:'Courier New',monospace;font-size:12px;color:${TEXT_PRI};box-sizing:border-box}
      .cp-text-input:focus{box-shadow:0 0 0 2px ${TEXT_PRI}22}
    `;
    document.head.appendChild(el);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (charDropRef.current    && !charDropRef.current.contains(e.target as Node))    setCharDropOpen(false);
      if (patternDropRef.current && !patternDropRef.current.contains(e.target as Node)) setPatternDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const prev = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(prev);
    try {
      const map = await processImageToMap(file);
      onImageUpload(map);
    } catch {
      setUploadError("Could not process image.");
    }
    e.target.value = "";
  }

  // Particle gradient preview CSS
  const gradientCSS = (() => {
    if (settings.colorMode === "mono") return settings.color1;
    if (settings.colorMode === "duo")  return `linear-gradient(90deg,${settings.color1},${settings.color2})`;
    return `linear-gradient(90deg,${settings.color1},${settings.color2},${settings.color3})`;
  })();

  // BG preview
  const bgPreviewCSS = settings.bgMode === "gradient"
    ? `linear-gradient(135deg,${settings.bgColor1},${settings.bgColor2})`
    : settings.bgColor1;

  return (
    <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 100, display: "flex", pointerEvents: "none" }}>
      {/* Collapse tab */}
      <div style={{ display: "flex", alignItems: "center", pointerEvents: "auto" }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: 18, height: 48, borderRadius: "5px 0 0 5px",
          background: PANEL_BG, border: `1px solid ${DIVIDER}`, borderRight: "none",
          color: TEXT_SEC, cursor: "pointer", fontSize: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "-2px 0 8px rgba(0,0,0,0.18)",
        }}>
          {open ? "›" : "‹"}
        </button>
      </div>

      {/* Panel */}
      <div style={{ width: open ? 240 : 0, overflow: "hidden", transition: "width 0.22s cubic-bezier(.4,0,.2,1)", pointerEvents: open ? "auto" : "none" }}>
        <div style={{
          width: 240, height: "100%", display: "flex", flexDirection: "column",
          background: PANEL_BG, fontFamily: FONT, color: TEXT_PRI, fontSize: 13,
          boxShadow: "-4px 0 20px rgba(0,0,0,0.28)",
        }}>
          {/* Header */}
          <div style={{ padding: "13px 16px 11px", borderBottom: `1px solid ${DIVIDER}`, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e040fb", boxShadow: "0 0 6px #e040fb88" }} />
            <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: "0.07em", color: TEXT_PRI }}>ASCII GENERATOR</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>

            {/* ── 1. SHAPE ── */}
            <Section title="Shape" open={shapeOpen} onToggle={() => setShapeOpen(o => !o)}>

              {/* Pattern type */}
              <Field label="Type">
                <div ref={patternDropRef} style={{ position: "relative" }}>
                  <DropBtn onClick={() => setPatternDropOpen(o => !o)} isOpen={patternDropOpen}>
                    {activePattern.label}
                  </DropBtn>
                  {patternDropOpen && (
                    <DropList>
                      {PATTERNS.map(p => (
                        <DropItem key={p.id} selected={settings.pattern === p.id}
                          onClick={() => { onUpdate({ pattern: p.id }); setPatternDropOpen(false); }}>
                          {p.label}
                        </DropItem>
                      ))}
                    </DropList>
                  )}
                </div>
              </Field>

              {/* Image upload — only visible when Image pattern is selected */}
              {settings.pattern === "image" && (
                <div style={{ padding: "6px 16px 10px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 7, cursor: "pointer", border: "none",
                        background: ITEM_BG, color: TEXT_SEC, fontFamily: FONT, fontSize: 11, fontWeight: 500,
                      }}>
                      Upload Image
                    </button>
                    {previewUrl && (
                      <div style={{ width: 36, height: 36, borderRadius: 5, overflow: "hidden", flexShrink: 0, border: `1px solid ${DIVIDER}` }}>
                        <img src={previewUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                  {uploadError && <div style={{ fontSize: 10, color: "#e57373", marginTop: 4 }}>{uploadError}</div>}
                  <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 5 }}>PNG, JPG, SVG, GIF</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Density */}
              <SliderField label="Density" value={densityPct} min={0} max={100} step={1}
                display={`${densityPct}%`} onChange={v => onUpdate({ density: 0.4 + (v / 100) * 1.6 })} />

            </Section>

            <Sep />

            {/* ── 2. CHARACTER ── */}
            <Section title="Character" open={charOpen} onToggle={() => setCharOpen(o => !o)}>

              {/* Character set dropdown */}
              <div ref={charDropRef} style={{ position: "relative", padding: "0 16px 8px" }}>
                <DropBtn onClick={() => setCharDropOpen(o => !o)} isOpen={charDropOpen} wide>
                  <span>{activeChar?.label ?? "Custom"}</span>
                  <span style={{ color: TEXT_MUT, fontSize: 10, marginLeft: 6, fontFamily: "'Courier New', monospace" }}>
                    {charPreview.slice(0, 8)}
                  </span>
                </DropBtn>
                {charDropOpen && (
                  <DropList>
                    {CHAR_OPTIONS.map(opt => (
                      <DropItem key={opt.id} selected={settings.charSet === opt.id}
                        onClick={() => { onUpdate({ charSet: opt.id }); setCharDropOpen(false); }}>
                        <span>{opt.label}</span>
                        <span style={{ color: TEXT_MUT, fontSize: 10, fontFamily: "'Courier New', monospace", marginLeft: "auto", paddingLeft: 8 }}>
                          {opt.id === "custom" ? (settings.customChars.slice(0, 7) || "…") : opt.preview.slice(0, 7)}
                        </span>
                      </DropItem>
                    ))}
                  </DropList>
                )}
              </div>

              {/* Custom character editor */}
              {isCustomChar && (
                <div style={{ padding: "0 16px 10px" }}>
                  <div style={{ fontSize: 10, color: TEXT_MUT, marginBottom: 5, letterSpacing: "0.08em" }}>Edit characters</div>
                  <input
                    type="text"
                    className="cp-text-input"
                    value={settings.customChars}
                    placeholder="Type your characters…"
                    onChange={e => onUpdate({ customChars: e.target.value })}
                  />
                  <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 3 }}>
                    {settings.customChars.length} chars — used at random
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{ padding: "0 16px 10px" }}>
                <div style={{
                  fontFamily: "'Courier New', monospace", fontSize: 13, color: TEXT_PRI,
                  background: WELL_BG, borderRadius: 6, padding: "8px 10px",
                  letterSpacing: "0.12em", wordBreak: "break-all", minHeight: 34,
                }}>
                  {charPreview.slice(0, 24) || <span style={{ color: TEXT_MUT }}>No chars set</span>}
                </div>
              </div>

              {/* Size */}
              <SliderField label="Size" value={settings.baseSize} min={4} max={32} step={1}
                display={`${settings.baseSize}px`} onChange={v => onUpdate({ baseSize: v })} />

              {/* Dimension */}
              <Field label="Dimension">
                <div style={{ display: "flex", gap: 4 }}>
                  {(["flat", "3d"] as const).map(d => (
                    <button key={d} onClick={() => onUpdate({ dimension: d })} style={{
                      padding: "4px 11px", borderRadius: 6, cursor: "pointer",
                      background: settings.dimension === d ? TEXT_PRI : WELL_BG,
                      color: settings.dimension === d ? "#fff" : TEXT_SEC,
                      border: "none", fontFamily: FONT, fontSize: 11, fontWeight: 500,
                    }}>
                      {d === "flat" ? "Flat" : "3D"}
                    </button>
                  ))}
                </div>
              </Field>

              {!isFlat && (
                <Field label="Size Range">
                  <Toggle on={settings.sizeRange} onToggle={() => onUpdate({ sizeRange: !settings.sizeRange })} />
                </Field>
              )}

              {!isFlat && settings.sizeRange && (
                <div style={{ padding: "2px 16px 6px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <Slider value={settings.minSize} min={4} max={Math.max(4, settings.baseSize - 2)} step={1}
                        onChange={v => onUpdate({ minSize: v })} />
                      <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 2 }}>Min: {settings.minSize}px</div>
                    </div>
                    <div>
                      <Slider value={settings.baseSize} min={Math.min(32, settings.minSize + 2)} max={32} step={1}
                        onChange={v => onUpdate({ baseSize: v })} />
                      <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 2, textAlign: "right" }}>Max: {settings.baseSize}px</div>
                    </div>
                  </div>
                </div>
              )}

            </Section>

            <Sep />

            {/* ── 3. DRAW ── */}
            <Section title="Draw" open={drawOpen} onToggle={() => setDrawOpen(o => !o)}>
              <div style={{ padding: "4px 16px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isDrawMode ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 12, color: TEXT_PRI, fontWeight: 500 }}>Draw Pattern</div>
                    <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 2 }}>Paint on canvas to sculpt</div>
                  </div>
                  <Toggle on={isDrawMode} onToggle={onToggleDrawMode} />
                </div>
                {isDrawMode && (
                  <>
                    <div style={{ height: 1, background: DIVIDER, margin: "0 0 10px" }} />
                    <SliderField
                      label="Brush Size"
                      value={brushSize}
                      min={10} max={120} step={5}
                      display={`${brushSize}px`}
                      onChange={onBrushSize}
                    />
                    <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 2 }}>
                      Draw strokes, release to apply. Use "Clear" on screen to reset.
                    </div>
                  </>
                )}
              </div>
            </Section>

            <Sep />

            {/* ── 4. MOTION ── */}
            <Section title="Motion" open={motionOpen} onToggle={() => setMotionOpen(o => !o)}>

              <SliderField
                label={isFlat ? "Scale" : "Zoom"}
                value={settings.zoom} min={50} max={400} step={5}
                display={`${Math.round(settings.zoom)}%`}
                onChange={v => onUpdate({ zoom: v })}
              />

              <SliderField
                label={isFlat ? "Spacing" : "Speed"}
                value={settings.speed} min={0.2} max={3.0} step={0.1}
                display={`${settings.speed.toFixed(1)}×`}
                onChange={v => onUpdate({ speed: v })}
              />

              <SliderField
                label="Pattern Angle"
                value={settings.angle} min={0} max={360} step={1}
                display={`${Math.round(settings.angle)}°`}
                onChange={v => onUpdate({ angle: v })}
              />

              <SliderField
                label="Char Angle"
                value={settings.charAngle} min={0} max={360} step={1}
                display={`${Math.round(settings.charAngle)}°`}
                onChange={v => onUpdate({ charAngle: v })}
              />

            </Section>

            <Sep />

            {/* ── 5. COLORS ── */}
            <Section title="Colors" open={colorsOpen} onToggle={() => setColorsOpen(o => !o)}>

              {/* Color mode */}
              <div style={{ padding: "4px 16px 10px" }}>
                <div style={{ fontSize: 10, color: TEXT_MUT, marginBottom: 7, letterSpacing: "0.08em" }}>Mode</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {(["mono", "duo", "trio"] as const).map(mode => (
                    <button key={mode} onClick={() => onUpdate({ colorMode: mode })} style={{
                      flex: 1, padding: "6px 0", borderRadius: 7, cursor: "pointer", border: "none",
                      background: settings.colorMode === mode ? TEXT_PRI : ITEM_BG,
                      color: settings.colorMode === mode ? "#fff" : TEXT_SEC,
                      fontFamily: FONT, fontSize: 11, fontWeight: 500, textTransform: "capitalize",
                    }}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color pickers */}
              <div style={{ padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                <ColorPickerRow label="Color 1" value={settings.color1} onChange={v => onUpdate({ color1: v })} />
                {settings.colorMode !== "mono" && (
                  <ColorPickerRow label="Color 2" value={settings.color2} onChange={v => onUpdate({ color2: v })} />
                )}
                {settings.colorMode === "trio" && (
                  <ColorPickerRow label="Color 3" value={settings.color3} onChange={v => onUpdate({ color3: v })} />
                )}
              </div>

              {/* Gradient preview */}
              <div style={{ padding: "0 16px 10px" }}>
                <div style={{ height: 18, borderRadius: 8, background: gradientCSS, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>

              {/* Gradient direction */}
              <div style={{ padding: "0 16px 12px" }}>
                <div style={{ fontSize: 10, color: TEXT_MUT, marginBottom: 7, letterSpacing: "0.08em" }}>Direction</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
                  {([
                    { id: "diagonal",   cssBg: `linear-gradient(135deg, ${settings.color1}, ${settings.colorMode === "mono" ? settings.color1 : settings.color2})`, label: "↘" },
                    { id: "horizontal", cssBg: `linear-gradient(90deg,  ${settings.color1}, ${settings.colorMode === "mono" ? settings.color1 : settings.color2})`, label: "→" },
                    { id: "vertical",   cssBg: `linear-gradient(180deg, ${settings.color1}, ${settings.colorMode === "mono" ? settings.color1 : settings.color2})`, label: "↓" },
                    { id: "radial",     cssBg: `radial-gradient(circle, ${settings.color1}, ${settings.colorMode === "mono" ? settings.color1 : settings.color2})`, label: "◎" },
                  ] as const).map(({ id, cssBg, label }) => {
                    const active = settings.gradientDir === id;
                    return (
                      <button key={id} onClick={() => onUpdate({ gradientDir: id })} title={id.charAt(0).toUpperCase() + id.slice(1)} style={{
                        height: 32, borderRadius: 6, cursor: "pointer", position: "relative", overflow: "hidden",
                        background: cssBg,
                        border: active ? `2px solid ${TEXT_PRI}` : "2px solid transparent",
                        outline: "none", padding: 0,
                        boxShadow: active ? `0 0 0 1px ${TEXT_PRI}` : "none",
                      }}>
                        <span style={{
                          position: "absolute", bottom: 2, right: 3,
                          fontSize: 9, color: "rgba(255,255,255,0.85)",
                          textShadow: "0 1px 3px rgba(0,0,0,0.7)", fontFamily: FONT,
                        }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opacity */}
              <SliderField
                label="Opacity"
                value={Math.round(settings.colorOpacity * 100)}
                min={10} max={100} step={1}
                display={`${Math.round(settings.colorOpacity * 100)}%`}
                onChange={v => onUpdate({ colorOpacity: v / 100 })}
              />

              {/* Saturation */}
              <SliderField
                label="Saturation"
                value={Math.round(settings.colorSaturation * 100)}
                min={0} max={200} step={5}
                display={`${Math.round(settings.colorSaturation * 100)}%`}
                onChange={v => onUpdate({ colorSaturation: v / 100 })}
              />

              <Sep />

              {/* Background */}
              <div style={{ padding: "8px 16px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: TEXT_PRI, fontWeight: 500 }}>Background</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: TEXT_SEC }}>Gradient</span>
                    <Toggle on={settings.bgMode === "gradient"} onToggle={() => onUpdate({ bgMode: settings.bgMode === "gradient" ? "solid" : "gradient" })} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <ColorPickerRow
                    label={settings.bgMode === "gradient" ? "Start" : "Color"}
                    value={settings.bgColor1}
                    onChange={v => onUpdate({ bgColor1: v })}
                  />
                  {settings.bgMode === "gradient" && (
                    <ColorPickerRow label="End" value={settings.bgColor2} onChange={v => onUpdate({ bgColor2: v })} />
                  )}
                </div>

                <div style={{ height: 13, borderRadius: 5, marginTop: 10, background: bgPreviewCSS, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)" }} />
              </div>

            </Section>

          </div>

          {/* Export button */}
          <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${DIVIDER}` }}>
            <button
              onClick={onExport}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg,#4a6cf7,#9c40f7)",
                color: "#fff", fontFamily: FONT, fontSize: 12, fontWeight: 600,
                letterSpacing: "0.06em", cursor: "pointer",
                boxShadow: "0 2px 10px rgba(74,108,247,0.35)",
              }}
            >
              Export Background
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px 11px 14px",
        borderTop: "none", borderRight: "none", borderBottom: "none",
        borderLeft: `2px solid ${open ? "rgba(74,108,247,0.75)" : "transparent"}`,
        background: open ? "rgba(0,0,0,0.04)" : "transparent",
        cursor: "pointer", fontFamily: FONT,
        fontSize: 13, fontWeight: 600,
        color: open ? TEXT_PRI : "rgba(24,24,42,0.72)",
        transition: "color 0.15s, background 0.15s",
        textAlign: "left",
      }}>
        {title}
        <span style={{
          fontSize: 10, color: open ? BLUE_ON : TEXT_MUT,
          display: "inline-block",
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 0.18s, color 0.15s",
        }}>›</span>
      </button>
      {open && (
        <div style={{ paddingTop: 4, paddingBottom: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <div style={{ height: 1, background: DIVIDER, margin: "2px 0" }} />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 16px" }}>
      <span style={{ fontSize: 12, color: TEXT_PRI }}>{label}</span>
      {children}
    </div>
  );
}

function SliderField({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: "4px 16px 6px" }}>
      <div style={{ fontSize: 12, color: TEXT_PRI, marginBottom: 3 }}>{label}</div>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
      <div style={{ fontSize: 10, color: TEXT_MUT, marginTop: 1 }}>{display}</div>
    </div>
  );
}

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min) * 100).toFixed(1);
  return (
    <input type="range" className="cp-slider" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ height: 3, borderRadius: 2, background: `linear-gradient(to right,${TEXT_PRI} ${pct}%,${ITEM_BG} ${pct}%)` }}
    />
  );
}

function DropBtn({ onClick, isOpen, wide, children }: { onClick: () => void; isOpen: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: wide ? "100%" : "auto", minWidth: 90, display: "flex", alignItems: "center", justifyContent: "space-between",
      background: ITEM_BG, border: "none", borderRadius: 7, padding: "7px 10px", cursor: "pointer",
      fontFamily: FONT, fontSize: 12, color: TEXT_PRI,
      boxShadow: isOpen ? `0 0 0 2px ${TEXT_PRI}22` : "none",
    }}>
      <span style={{ display: "flex", alignItems: "center", flex: 1 }}>{children}</span>
      <span style={{ fontSize: 8, color: TEXT_MUT, marginLeft: 6 }}>{isOpen ? "▲" : "▼"}</span>
    </button>
  );
}

function DropList({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 300,
      background: PANEL_BG, borderRadius: 8, overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.22),0 0 0 1px rgba(0,0,0,0.10)",
    }}>
      {children}
    </div>
  );
}

function DropItem({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center",
      padding: "8px 12px", border: "none", cursor: "pointer",
      background: selected ? ITEM_BG : "transparent",
      fontFamily: FONT, fontSize: 12, color: TEXT_PRI,
    }}>
      {children}
    </button>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 36, height: 20, borderRadius: 10, cursor: "pointer", border: "none", outline: "none",
      background: on ? BLUE_ON : ITEM_BG, position: "relative",
      transition: "background 0.2s", flexShrink: 0, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
    }}>
      <div style={{
        position: "absolute", top: 3, left: on ? 19 : 3, width: 14, height: 14,
        borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

function ColorPickerRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: TEXT_PRI }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 10, color: TEXT_MUT, fontFamily: "'Courier New', monospace" }}>{value}</span>
        <div style={{ position: "relative", width: 36, height: 22, borderRadius: 6, flexShrink: 0,
          background: value,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.12)",
        }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              opacity: 0, cursor: "pointer",
              border: "none", padding: 0, margin: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}
