import { useState, useMemo } from "react";
import {
  TzGlobePicker,
  TzGlobePreloader,
  CANONICAL_MARKERS,
  COLORS,
  TZ_BOUNDARY_MODES,
} from "react-tz-globepicker";
import { ControlPanel } from "./components/ControlPanel";
import type { MarkerEntry, TzBoundaryMode } from "react-tz-globepicker";

// Color palette type
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

// Default options matching the original demo setup
const DEFAULT_OPTIONS = {
  timezone: "America/New_York",
  size: 800,
  showMarkers: true,
  showTooltips: true,
  zoomMarkers: true,
  minZoom: 0.1,
  maxZoom: 10,
  initialZoom: 0.8,
  showTZBoundaries: TZ_BOUNDARY_MODES.IANA as TzBoundaryMode,
  showCountryBorders: true,
  background: null as string | null,
  colors: { ...COLORS } as ColorPalette,
};

// Timezone options from CANONICAL_MARKERS
const TIMEZONE_OPTIONS = CANONICAL_MARKERS.map((m: MarkerEntry) => m.tz);

function App() {
  // Form state
  const [timezone, setTimezone] = useState<string | null>(
    DEFAULT_OPTIONS.timezone,
  );
  const [size, setSize] = useState(DEFAULT_OPTIONS.size);
  const [showMarkers, setShowMarkers] = useState(DEFAULT_OPTIONS.showMarkers);
  const [showTooltips, setShowTooltips] = useState(
    DEFAULT_OPTIONS.showTooltips,
  );
  const [zoomMarkers, setZoomMarkers] = useState(DEFAULT_OPTIONS.zoomMarkers);
  const [minZoom, setMinZoom] = useState(DEFAULT_OPTIONS.minZoom);
  const [maxZoom, setMaxZoom] = useState(DEFAULT_OPTIONS.maxZoom);
  const [initialZoom, setInitialZoom] = useState(DEFAULT_OPTIONS.initialZoom);
  const [showTZBoundaries, setShowTZBoundaries] = useState<TzBoundaryMode>(
    DEFAULT_OPTIONS.showTZBoundaries,
  );
  const [showCountryBorders, setShowCountryBorders] = useState(
    DEFAULT_OPTIONS.showCountryBorders,
  );
  const [background, setBackground] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorPalette>(DEFAULT_OPTIONS.colors);

  // Determine background value
  const backgroundValue = useMemo(() => {
    return background;
  }, [background]);

  // Reset handler
  const handleReset = () => {
    setTimezone(DEFAULT_OPTIONS.timezone);
    setSize(DEFAULT_OPTIONS.size);
    setShowMarkers(DEFAULT_OPTIONS.showMarkers);
    setShowTooltips(DEFAULT_OPTIONS.showTooltips);
    setZoomMarkers(DEFAULT_OPTIONS.zoomMarkers);
    setMinZoom(DEFAULT_OPTIONS.minZoom);
    setMaxZoom(DEFAULT_OPTIONS.maxZoom);
    setInitialZoom(DEFAULT_OPTIONS.initialZoom);
    setShowTZBoundaries(DEFAULT_OPTIONS.showTZBoundaries);
    setShowCountryBorders(DEFAULT_OPTIONS.showCountryBorders);
    setBackground(null);
    setColors(DEFAULT_OPTIONS.colors);
  };

  return (
    <>
      <TzGlobePreloader />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 500 }}>
          react-tz-globepicker
        </h1>

        <TzGlobePicker
          timezone={timezone}
          size={size}
          onSelect={(tz) => setTimezone(tz)}
          showMarkers={showMarkers}
          showTooltips={showTooltips}
          zoomMarkers={zoomMarkers}
          minZoom={minZoom}
          maxZoom={maxZoom}
          initialZoom={initialZoom}
          showTZBoundaries={showTZBoundaries}
          showCountryBorders={showCountryBorders}
          background={backgroundValue}
          colors={colors}
        />

        <p style={{ margin: 0, fontSize: "0.95rem", opacity: 0.8 }}>
          Selected:{" "}
          <strong style={{ color: "#64b5f6" }}>{timezone ?? "none"}</strong>
        </p>

        <ControlPanel
          timezone={timezone}
          onTimezoneChange={setTimezone}
          size={size}
          onSizeChange={setSize}
          showMarkers={showMarkers}
          onShowMarkersChange={setShowMarkers}
          showTooltips={showTooltips}
          onShowTooltipsChange={setShowTooltips}
          zoomMarkers={zoomMarkers}
          onZoomMarkersChange={setZoomMarkers}
          minZoom={minZoom}
          onMinZoomChange={setMinZoom}
          maxZoom={maxZoom}
          onMaxZoomChange={setMaxZoom}
          initialZoom={initialZoom}
          onInitialZoomChange={setInitialZoom}
          showTZBoundaries={showTZBoundaries}
          onShowTZBoundariesChange={setShowTZBoundaries}
          showCountryBorders={showCountryBorders}
          onShowCountryBordersChange={setShowCountryBorders}
          background={background}
          onBackgroundChange={setBackground}
          colors={colors}
          onColorsChange={setColors}
          onReset={handleReset}
          timezoneOptions={TIMEZONE_OPTIONS}
        />
      </div>
    </>
  );
}

export default App;
