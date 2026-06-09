import type { ImageDensityMap } from "../App";

const FONT = "'Inter', system-ui, -apple-system, sans-serif";
export const MAX_PRESETS = 3;

export interface DrawPreset {
  id:        number;
  thumbnail: string;        // data URL
  map:       ImageDensityMap;
}

interface Props {
  presets:  DrawPreset[];
  canSave:  boolean;
  onSave:   () => void;
  onApply:  (preset: DrawPreset) => void;
  onDelete: (id: number) => void;
  onClear:  () => void;
}

export function PresetBar({ presets, canSave, onSave, onApply, onDelete, onClear }: Props) {
  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 201, userSelect: "none",
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(6,7,26,0.84)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 14, padding: "10px 14px",
      backdropFilter: "blur(14px)",
      boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
      fontFamily: FONT,
    }}>

      {/* Clear strokes */}
      <PillBtn onClick={onClear} color="rgba(80,80,120,0.9)">Clear</PillBtn>

      <Sep />

      {/* Save to preset */}
      <PillBtn onClick={onSave} color={canSave ? "#4a6cf7" : "rgba(50,50,80,0.7)"} disabled={!canSave}
        title={canSave ? "Save current strokes as a preset" : "All 3 preset slots are full — delete one first"}>
        Save
      </PillBtn>

      <Sep />

      {/* Preset slots */}
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: MAX_PRESETS }, (_, i) => {
          const preset = presets[i];
          return (
            <div key={i} title={preset ? `Apply preset ${i + 1}` : `Empty slot ${i + 1}`} style={{
              position: "relative", width: 84, height: 54, borderRadius: 8,
              border: `1.5px solid ${preset ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.09)"}`,
              background: preset ? "transparent" : "rgba(255,255,255,0.03)",
              overflow: "hidden", cursor: preset ? "pointer" : "default", flexShrink: 0,
              transition: "border-color 0.15s",
            }}>
              {preset ? (
                <>
                  {/* Thumbnail — click to apply */}
                  <img
                    src={preset.thumbnail}
                    onClick={() => onApply(preset)}
                    alt={`Preset ${i + 1}`}
                    style={{
                      width: "100%", height: "100%", objectFit: "cover", display: "block",
                      filter: "brightness(1.5) contrast(1.15)",
                    }}
                  />
                  {/* Apply overlay on hover */}
                  <div onClick={() => onApply(preset)} style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(6,7,26,0)",
                    color: "rgba(255,255,255,0)",
                    fontSize: 10, fontFamily: FONT, letterSpacing: "0.08em",
                    transition: "background 0.15s, color 0.15s",
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(6,7,26,0.6)";
                      (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.85)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(6,7,26,0)";
                      (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0)";
                    }}
                  >
                    APPLY
                  </div>
                  {/* Delete × */}
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(preset.id); }}
                    style={{
                      position: "absolute", top: 3, right: 3, width: 17, height: 17,
                      borderRadius: "50%", background: "rgba(0,0,0,0.70)",
                      color: "rgba(255,255,255,0.80)", border: "none", cursor: "pointer",
                      fontSize: 11, lineHeight: "17px", textAlign: "center", padding: 0,
                    }}
                  >×</button>
                  {/* Slot number */}
                  <span style={{
                    position: "absolute", bottom: 3, left: 5,
                    fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em",
                  }}>{i + 1}</span>
                </>
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 2, color: "rgba(255,255,255,0.18)",
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 9, letterSpacing: "0.06em" }}>{i + 1}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PillBtn({ onClick, color, disabled, title, children }: {
  onClick: () => void; color: string; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      padding: "7px 15px", borderRadius: 8, border: "none",
      background: color, color: disabled ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.88)",
      fontFamily: FONT, fontSize: 11, fontWeight: 500, letterSpacing: "0.07em",
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      transition: "opacity 0.15s",
    }}>
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.11)", flexShrink: 0 }} />;
}
