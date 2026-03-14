import React from "react";
import {
  SpaceBackground,
  ResetButton,
  TZ_BOUNDARY_MODES,
  type TzBoundaryMode,
  type GlobePalette,
} from "react-tz-globepicker";
import CustomBackground from "./CustomBackground";
import { Select } from "./Select";
import { NumberInput } from "./NumberInput";
import { ColorInput } from "./ColorInput";
import { Toggle } from "./Toggle";

type BackgroundType = "transparent" | "color" | "space" | "custom";

type ControlPanelProps = {
  timezone: string | null;
  onTimezoneChange: (tz: string | null) => void;
  size: number;
  onSizeChange: (n: number) => void;
  showMarkers: boolean;
  onShowMarkersChange: (v: boolean) => void;
  showTooltips: boolean;
  onShowTooltipsChange: (v: boolean) => void;
  zoomMarkers: boolean;
  onZoomMarkersChange: (v: boolean) => void;
  minZoom: number;
  onMinZoomChange: (v: number) => void;
  maxZoom: number;
  onMaxZoomChange: (v: number) => void;
  currentZoom: number;
  onCurrentZoomChange: (v: number) => void;
  showTZBoundaries: TzBoundaryMode;
  onShowTZBoundariesChange: (m: TzBoundaryMode) => void;
  showCountryBorders: boolean;
  onShowCountryBordersChange: (v: boolean) => void;
  backgroundType: BackgroundType;
  backgroundValue: string | null;
  onBackgroundTypeChange: (t: BackgroundType) => void;
  onBackgroundValueChange: (v: string | null) => void;
  colors: GlobePalette;
  onColorsChange: (c: GlobePalette) => void;
  onReset: () => void;
  timezoneOptions: string[];
  inline?: boolean;
};

export function ControlPanel({
  timezone,
  onTimezoneChange,
  size,
  onSizeChange,
  showMarkers,
  onShowMarkersChange,
  showTooltips,
  onShowTooltipsChange,
  zoomMarkers,
  onZoomMarkersChange,
  minZoom,
  onMinZoomChange,
  maxZoom,
  onMaxZoomChange,
  currentZoom,
  onCurrentZoomChange,
  showTZBoundaries,
  onShowTZBoundariesChange,
  showCountryBorders,
  onShowCountryBordersChange,
  backgroundType,
  backgroundValue,
  onBackgroundTypeChange,
  onBackgroundValueChange,
  colors,
  onColorsChange,
  onReset,
  timezoneOptions,
  inline = false,
}: ControlPanelProps): React.ReactElement {
  const BREAKPOINT = 900;
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= BREAKPOINT : true,
  );
  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= BREAKPOINT : true,
  );
  const [copyLabel, setCopyLabel] = React.useState<string>("Copy JSON");

  React.useEffect((): (() => void) => {
    const onResize = (): void => {
      const desktop = window.innerWidth >= BREAKPOINT;
      setIsDesktop(desktop);
      if (desktop) setIsSidebarOpen(true);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return (): void => window.removeEventListener("resize", onResize);
  }, []);

  const handleColorChange = (key: keyof GlobePalette, value: string): void => {
    onColorsChange({ ...colors, [key]: value });
  };

  const handleBackgroundTypeSelect = (t: BackgroundType): void => {
    onBackgroundTypeChange(t);
    if (t === "color") {
      if (!backgroundValue) onBackgroundValueChange("#000000");
    }
    if (t === "transparent") {
      if (backgroundValue) onBackgroundValueChange(null);
    }
  };

  const timezoneSelectOptions: Array<{ value: string; label: string }> = [
    { value: "", label: "None" },
    ...timezoneOptions.map((tz) => ({ value: tz, label: tz })),
  ];

  const sidebarWidth = isDesktop ? 320 : 280;

  return (
    <>
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 1001,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            backgroundColor: "rgba(30, 30, 46, 0.95)",
            color: "#e0e0e0",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Open Controls
        </button>
      )}

      <aside
        style={{
          position: inline ? "relative" : "fixed",
          top: inline ? undefined : 0,
          right: inline ? undefined : 0,
          height: "100dvh",
          width: inline ? (isSidebarOpen ? 300 : 0) : sidebarWidth,
          maxWidth: inline ? (isSidebarOpen ? 360 : 0) : "calc(100vw - 12px)",
          overflowY: inline ? (isSidebarOpen ? "visible" : "hidden") : "auto",
          backgroundColor: "rgba(30, 30, 46, 0.95)",
          padding: inline ? (isSidebarOpen ? 12 : 0) : 16,
          color: "#e0e0e0",
          fontSize: "0.8rem",
          boxShadow: inline ? "none" : "0 8px 32px rgba(0, 0, 0, 0.4)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: inline ? "auto" : 1000,
          display: inline ? (isSidebarOpen ? "block" : "none") : undefined,
          transform: inline
            ? undefined
            : isSidebarOpen
              ? "translateX(0)"
              : "translateX(100%)",
          transition: inline ? undefined : "transform 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Controls</span>
          <button
            onClick={() => setIsSidebarOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "#e0e0e0",
              cursor: "pointer",
              fontSize: "0.9rem",
              padding: "2px 6px",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Basic */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>Basic</div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
              }}
            >
              <div>
                <Select
                  label="Timezone"
                  value={timezone ?? ""}
                  options={timezoneSelectOptions}
                  onChange={(v) => onTimezoneChange(v ?? null)}
                />
              </div>
              <div>
                <NumberInput
                  label="Size (px)"
                  value={size}
                  onChange={onSizeChange}
                  min={100}
                  max={1200}
                  step={50}
                />
              </div>

              <div style={{ gridColumn: isDesktop ? "1 / span 2" : undefined }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      name="bgType"
                      checked={backgroundType === "transparent"}
                      onChange={() => handleBackgroundTypeSelect("transparent")}
                    />
                    Transparent
                  </label>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      name="bgType"
                      checked={backgroundType === "color"}
                      onChange={() => handleBackgroundTypeSelect("color")}
                    />
                    Solid Color
                  </label>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      name="bgType"
                      checked={backgroundType === "space"}
                      onChange={() => handleBackgroundTypeSelect("space")}
                    />
                    Space
                  </label>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      name="bgType"
                      checked={backgroundType === "custom"}
                      onChange={() => handleBackgroundTypeSelect("custom")}
                    />
                    Custom
                  </label>

                  <div
                    style={{
                      marginLeft: "auto",
                      width: "100%",
                      height: 60,
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 4,
                      overflow: "hidden",
                      position: "relative",
                    }}
                    aria-hidden
                  >
                    {backgroundType === "transparent" && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundImage:
                            "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                        }}
                      />
                    )}
                    {backgroundType === "color" && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: backgroundValue ?? "#000000",
                        }}
                      />
                    )}
                    {backgroundType === "space" && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          overflow: "hidden",
                        }}
                      >
                        <SpaceBackground />
                      </div>
                    )}
                    {backgroundType === "custom" && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          overflow: "hidden",
                        }}
                      >
                        <CustomBackground />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  {backgroundType === "color" && (
                    <input
                      type="color"
                      value={backgroundValue ?? "#000000"}
                      onChange={(e) => onBackgroundValueChange(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Markers */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>Markers</div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Toggle
                label="Show markers"
                checked={showMarkers}
                onChange={onShowMarkersChange}
              />

              <Toggle
                label="Show tooltips"
                checked={showTooltips}
                onChange={onShowTooltipsChange}
                disabled={!showMarkers}
              />

              <Toggle
                label="Zoom markers"
                checked={zoomMarkers}
                onChange={onZoomMarkersChange}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                <NumberInput
                  label="Min zoom"
                  value={minZoom}
                  onChange={onMinZoomChange}
                  min={0.01}
                  max={1}
                  step={0.01}
                  precision={2}
                />
                <NumberInput
                  label="Max zoom"
                  value={maxZoom}
                  onChange={onMaxZoomChange}
                  min={1}
                  max={20}
                  step={0.5}
                />
                <NumberInput
                  label="Zoom"
                  value={currentZoom}
                  onChange={onCurrentZoomChange}
                  min={0.1}
                  max={10}
                  step={0.1}
                  precision={2}
                />
              </div>
            </div>
          </div>

          {/* Boundaries */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>Boundaries</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="radio"
                    name="tzBoundaries"
                    checked={showTZBoundaries === TZ_BOUNDARY_MODES.NONE}
                    onChange={() =>
                      onShowTZBoundariesChange(TZ_BOUNDARY_MODES.NONE)
                    }
                  />
                  None
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="radio"
                    name="tzBoundaries"
                    checked={showTZBoundaries === TZ_BOUNDARY_MODES.NAUTIC}
                    onChange={() =>
                      onShowTZBoundariesChange(TZ_BOUNDARY_MODES.NAUTIC)
                    }
                  />
                  Nautic
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="radio"
                    name="tzBoundaries"
                    checked={showTZBoundaries === TZ_BOUNDARY_MODES.ISO8601}
                    onChange={() =>
                      onShowTZBoundariesChange(TZ_BOUNDARY_MODES.ISO8601)
                    }
                  />
                  ISO 8601
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="radio"
                    name="tzBoundaries"
                    checked={showTZBoundaries === TZ_BOUNDARY_MODES.IANA}
                    onChange={() =>
                      onShowTZBoundariesChange(TZ_BOUNDARY_MODES.IANA)
                    }
                  />
                  IANA
                </label>
              </div>

              <Toggle
                label="Show country borders"
                checked={showCountryBorders}
                onChange={onShowCountryBordersChange}
              />
            </div>
          </div>

          {/* Colors */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>Colors</div>
              <button
                onClick={() => onColorsChange({ ...colors })}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e0e0e0",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                Reset
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {(Object.keys(colors) as Array<keyof GlobePalette>).map((k) => (
                <ColorInput
                  key={k}
                  label={k}
                  value={colors[k]}
                  onChange={(v) => handleColorChange(k, v)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={async (): Promise<void> => {
                const json = JSON.stringify(colors, null, 2);
                await navigator.clipboard.writeText(json);
                setCopyLabel("✓ Copied!");
                setTimeout(() => setCopyLabel("Copy JSON"), 2000);
              }}
              style={{
                marginTop: 8,
                padding: "4px 8px",
                fontSize: "0.75rem",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4,
                color: "#e0e0e0",
                cursor: "pointer",
              }}
            >
              {copyLabel}
            </button>
          </div>

          {/* Actions */}
          <ResetButton size={40} onClick={onReset} />
        </div>
      </aside>
    </>
  );
}

export default ControlPanel;
