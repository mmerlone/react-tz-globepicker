import React from "react";
import { TZ_BOUNDARY_MODES } from "react-tz-globepicker";
import type { TzBoundaryMode } from "react-tz-globepicker";
import { Toggle } from "./Toggle";
import { NumberInput } from "./NumberInput";
import { ColorInput } from "./ColorInput";
import { RadioGroup } from "./RadioGroup";
import { Select } from "./Select";
import { Section } from "./Section";

interface ColorPalette {
  ocean: string;
  land: string;
  border: string;
  graticule: string;
  rim: string;
  defaultMarker: string;
  defaultMarkerStroke: string;
  selectedMarker: string;
  selectedMarkerStroke: string;
  hoveredMarker: string;
  hoveredMarkerStroke: string;
  highlightFill: string;
  highlightStroke: string;
  highlightCountryBorder: string;
}

// Props interface
interface ControlPanelProps {
  timezone: string | null;
  onTimezoneChange: (tz: string | null) => void;
  size: number;
  onSizeChange: (size: number) => void;
  showMarkers: boolean;
  onShowMarkersChange: (show: boolean) => void;
  showTooltips: boolean;
  onShowTooltipsChange: (show: boolean) => void;
  zoomMarkers: boolean;
  onZoomMarkersChange: (zoom: boolean) => void;
  minZoom: number;
  onMinZoomChange: (min: number) => void;
  maxZoom: number;
  onMaxZoomChange: (max: number) => void;
  initialZoom: number;
  onInitialZoomChange: (zoom: number) => void;
  showTZBoundaries: TzBoundaryMode;
  onShowTZBoundariesChange: (mode: TzBoundaryMode) => void;
  showCountryBorders: boolean;
  onShowCountryBordersChange: (show: boolean) => void;
  background: string | null;
  onBackgroundChange: (bg: string | null) => void;
  colors: ColorPalette;
  onColorsChange: (colors: ColorPalette) => void;
  onReset: () => void;
  timezoneOptions: string[];
}

// Color palette keys
const COLOR_KEYS: (keyof ColorPalette)[] = [
  "ocean",
  "land",
  "border",
  "graticule",
  "rim",
  "defaultMarker",
  "defaultMarkerStroke",
  "selectedMarker",
  "selectedMarkerStroke",
  "hoveredMarker",
  "hoveredMarkerStroke",
  "highlightFill",
  "highlightStroke",
  "highlightCountryBorder",
];

// Boundary options
const BOUNDARY_OPTIONS: { value: TzBoundaryMode; label: string }[] = [
  { value: TZ_BOUNDARY_MODES.NONE, label: "None" },
  { value: TZ_BOUNDARY_MODES.NAUTIC, label: "Nautic (bands)" },
  { value: TZ_BOUNDARY_MODES.ISO8601, label: "ISO 8601" },
  { value: TZ_BOUNDARY_MODES.IANA, label: "IANA" },
];

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
  initialZoom,
  onInitialZoomChange,
  showTZBoundaries,
  onShowTZBoundariesChange,
  showCountryBorders,
  onShowCountryBordersChange,
  background,
  onBackgroundChange,
  colors,
  onColorsChange,
  onReset,
  timezoneOptions,
}: ControlPanelProps) {
  const BREAKPOINT = 900;
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= BREAKPOINT : true,
  );
  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= BREAKPOINT : true,
  );
  const [activeSection, setActiveSection] = React.useState<string>("basic");

  React.useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= BREAKPOINT;
      setIsDesktop(desktop);
      if (desktop) {
        setIsSidebarOpen(true);
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleColorChange = (key: keyof ColorPalette, value: string) => {
    onColorsChange({ ...colors, [key]: value });
  };

  const timezoneSelectOptions = [
    { value: "", label: "None" },
    ...timezoneOptions.map((tz) => ({ value: tz, label: tz })),
  ];

  const toggleSection = (section: string) => {
    setActiveSection((prev) => (prev === section ? "" : section));
  };

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
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          width: sidebarWidth,
          maxWidth: "calc(100vw - 12px)",
          overflowY: "auto",
          backgroundColor: "rgba(30, 30, 46, 0.95)",
          padding: 16,
          color: "#e0e0e0",
          fontSize: "0.8rem",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: 1000,
          transform: isSidebarOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.2s ease",
        }}
      >
        {/* Panel Header */}
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
          {/* Basic Section */}
          <Section
            title="Basic"
            isOpen={activeSection === "basic"}
            onToggle={() => toggleSection("basic")}
          >
            <Select
              label="Timezone"
              value={timezone ?? ""}
              options={timezoneSelectOptions}
              onChange={(v) => onTimezoneChange(v || null)}
            />
            <NumberInput
              label="Size (px)"
              value={size}
              onChange={onSizeChange}
              min={100}
              max={1200}
              step={50}
            />
          </Section>

          {/* Markers Section */}
          <Section
            title="Markers"
            isOpen={activeSection === "markers"}
            onToggle={() => toggleSection("markers")}
          >
            <Toggle
              label="Show Markers"
              checked={showMarkers}
              onChange={onShowMarkersChange}
            />
            <Toggle
              label="Show Tooltips"
              checked={showTooltips}
              onChange={onShowTooltipsChange}
            />
            <Toggle
              label="Zoom Markers"
              checked={zoomMarkers}
              onChange={onZoomMarkersChange}
            />
          </Section>

          {/* Zoom Section */}
          <Section
            title="Zoom"
            isOpen={activeSection === "zoom"}
            onToggle={() => toggleSection("zoom")}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 8,
                alignItems: "start",
              }}
            >
              <NumberInput
                label="Min"
                value={minZoom}
                onChange={onMinZoomChange}
                step={0.1}
              />
              <NumberInput
                label="Max"
                value={maxZoom}
                onChange={onMaxZoomChange}
                step={0.5}
              />
              <NumberInput
                label="Initial"
                value={initialZoom}
                onChange={onInitialZoomChange}
                step={0.1}
                min={0.1}
              />
            </div>
          </Section>

          {/* Boundaries Section */}
          <Section
            title="Boundaries"
            isOpen={activeSection === "boundaries"}
            onToggle={() => toggleSection("boundaries")}
          >
            <RadioGroup
              label="Timezone Boundaries"
              name="showTZBoundaries"
              value={showTZBoundaries}
              options={BOUNDARY_OPTIONS}
              onChange={onShowTZBoundariesChange}
            />
            <Toggle
              label="Show Country Borders"
              checked={showCountryBorders}
              onChange={onShowCountryBordersChange}
            />
          </Section>

          {/* Background Section */}
          <Section
            title="Background"
            isOpen={activeSection === "background"}
            onToggle={() => toggleSection("background")}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <input
                  type="radio"
                  name="background"
                  checked={background === null}
                  onChange={() => onBackgroundChange(null)}
                />
                Transparent
              </label>
              <input
                type="color"
                value={background ?? "#000000"}
                onChange={(e) => onBackgroundChange(e.target.value)}
                disabled={background === null}
                style={{
                  width: 28,
                  height: 24,
                  padding: 0,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: 4,
                  cursor: background === null ? "not-allowed" : "pointer",
                  opacity: background === null ? 0.5 : 1,
                }}
              />
            </div>
          </Section>

          {/* Colors Section */}
          <Section
            title="Colors"
            isOpen={activeSection === "colors"}
            onToggle={() => toggleSection("colors")}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
                gap: 6,
              }}
            >
              {COLOR_KEYS.map((key) => (
                <ColorInput
                  key={key}
                  label={key}
                  value={colors[key]}
                  onChange={(v) => handleColorChange(key, v)}
                />
              ))}
            </div>
          </Section>

          {/* Reset Button */}
          <button
            onClick={onReset}
            style={{
              padding: "10px",
              borderRadius: 6,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: "#e0e0e0",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.2)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.1)";
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </aside>
    </>
  );
}
