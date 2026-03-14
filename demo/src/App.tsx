import React, { useState, useMemo } from "react";
import {
  TzGlobePicker,
  TzGlobePreloader,
  CANONICAL_MARKERS,
  SpaceBackground,
  TZ_BOUNDARY_MODES,
  type TzGlobePickerProps,
  type GlobePalette,
} from "react-tz-globepicker";
import CustomBackground from "./components/CustomBackground";
import { ControlPanel } from "./components/ControlPanel";

const CUSTOM_COLORS: GlobePalette = {
  ocean: "#94c8ff",
  land: "#21912a",
  border: "#4d8950ff",
  graticule: "rgba(255,255,255,0.28)",
  rim: "rgba(255,255,255,0.25)",
  defaultMarker: "#e0e1dd",
  defaultMarkerStroke: "#1b263b",
  selectedMarker: "#ffb300",
  selectedMarkerStroke: "#ffffff",
  hoveredMarker: "#ffca28",
  hoveredMarkerStroke: "#ffffff",
  highlightFill: "rgba(255, 179, 0, 0.4)",
  highlightStroke: "#ff8f00",
  highlightCountryBorder: "rgba(255,255,255,0.3)",
};

const DEFAULT_OPTIONS: TzGlobePickerProps = {
  timezone: "America/New_York",
  size: 800,
  showMarkers: true,
  showTooltips: true,
  zoomMarkers: true,
  minZoom: 0.1,
  maxZoom: 10,
  initialZoom: 0.8,
  showTZBoundaries: TZ_BOUNDARY_MODES.ISO8601,
  showCountryBorders: true,
  background: null,
  colors: CUSTOM_COLORS,
};

// Timezone options from CANONICAL_MARKERS
const TIMEZONE_OPTIONS: string[] = CANONICAL_MARKERS.map((m): string => m.tz);

function App(): React.ReactElement {
  // Form state
  const [timezone, setTimezone] = useState<string | null>(
    DEFAULT_OPTIONS.timezone ?? null,
  );
  const [size, setSize] = useState(DEFAULT_OPTIONS.size ?? 800);
  const [showMarkers, setShowMarkers] = useState(
    DEFAULT_OPTIONS.showMarkers ?? true,
  );
  const [showTooltips, setShowTooltips] = useState(
    DEFAULT_OPTIONS.showTooltips ?? true,
  );
  const [zoomMarkers, setZoomMarkers] = useState(
    DEFAULT_OPTIONS.zoomMarkers ?? true,
  );
  const [minZoom, setMinZoom] = useState(DEFAULT_OPTIONS.minZoom ?? 0.1);
  const [maxZoom, setMaxZoom] = useState(DEFAULT_OPTIONS.maxZoom ?? 10);
  const [initialZoom, setInitialZoom] = useState(
    DEFAULT_OPTIONS.initialZoom ?? 0.8,
  );
  const [currentZoom, setCurrentZoom] = useState(
    DEFAULT_OPTIONS.initialZoom ?? 0.8,
  );
  const [showTZBoundaries, setShowTZBoundaries] = useState(
    DEFAULT_OPTIONS.showTZBoundaries ?? TZ_BOUNDARY_MODES.ISO8601,
  );
  const [showCountryBorders, setShowCountryBorders] = useState(
    DEFAULT_OPTIONS.showCountryBorders ?? true,
  );
  type BackgroundType = "transparent" | "color" | "space" | "custom";
  const [backgroundType, setBackgroundType] =
    useState<BackgroundType>("transparent");
  const [backgroundValue, setBackgroundValue] = useState<string | null>(null);
  const [colors, setColors] = useState<GlobePalette>(
    (DEFAULT_OPTIONS.colors as GlobePalette) ?? CUSTOM_COLORS,
  );
  const [flyToTrigger, setFlyToTrigger] = useState<number>(0);

  // Compute background prop passed to TzGlobePicker
  const backgroundProp = useMemo((): React.ReactElement | string | null => {
    if (backgroundType === "transparent") return null;
    if (backgroundType === "color") return backgroundValue;
    if (backgroundType === "space") return <SpaceBackground />;
    if (backgroundType === "custom") return <CustomBackground />;
    return null;
  }, [backgroundType, backgroundValue]);

  // Reset handler
  const handleReset = (): void => {
    setTimezone(DEFAULT_OPTIONS.timezone ?? null);
    setSize(DEFAULT_OPTIONS.size ?? 800);
    setShowMarkers(DEFAULT_OPTIONS.showMarkers ?? true);
    setShowTooltips(DEFAULT_OPTIONS.showTooltips ?? true);
    setZoomMarkers(DEFAULT_OPTIONS.zoomMarkers ?? true);
    setMinZoom(DEFAULT_OPTIONS.minZoom ?? 0.1);
    setMaxZoom(DEFAULT_OPTIONS.maxZoom ?? 10);
    setInitialZoom(DEFAULT_OPTIONS.initialZoom ?? 0.8);
    setCurrentZoom(DEFAULT_OPTIONS.initialZoom ?? 0.8);
    setShowTZBoundaries(
      DEFAULT_OPTIONS.showTZBoundaries ?? TZ_BOUNDARY_MODES.ISO8601,
    );
    setShowCountryBorders(DEFAULT_OPTIONS.showCountryBorders ?? true);
    setBackgroundType("transparent");
    setBackgroundValue(null);
    setColors((DEFAULT_OPTIONS.colors as GlobePalette) ?? CUSTOM_COLORS);
    // Trigger flyTo to the selected timezone
    setFlyToTrigger(Date.now());
  };

  return (
    <>
      <TzGlobePreloader />
      <div
        id="TzGlobeWrapper"
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 500 }}>
              react-tz-globepicker
            </h1>

            <TzGlobePicker
              timezone={timezone}
              size={size}
              onSelect={(tz: string | null) => setTimezone(tz)}
              showMarkers={showMarkers}
              showTooltips={showTooltips}
              zoomMarkers={zoomMarkers}
              minZoom={minZoom}
              maxZoom={maxZoom}
              initialZoom={initialZoom}
              zoom={currentZoom}
              onZoomChange={setCurrentZoom}
              showTZBoundaries={showTZBoundaries}
              showCountryBorders={showCountryBorders}
              background={backgroundProp}
              colors={colors}
              flyToTrigger={flyToTrigger}
            />

            <p style={{ margin: 0, fontSize: "0.95rem", opacity: 0.8 }}>
              Selected:{" "}
              <strong style={{ color: "#64b5f6" }}>{timezone ?? "none"}</strong>
            </p>
          </div>

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
            currentZoom={currentZoom}
            onCurrentZoomChange={setCurrentZoom}
            showTZBoundaries={showTZBoundaries}
            onShowTZBoundariesChange={setShowTZBoundaries}
            showCountryBorders={showCountryBorders}
            onShowCountryBordersChange={setShowCountryBorders}
            backgroundType={backgroundType}
            backgroundValue={backgroundValue}
            onBackgroundTypeChange={setBackgroundType}
            onBackgroundValueChange={setBackgroundValue}
            colors={colors}
            onColorsChange={setColors}
            onReset={handleReset}
            timezoneOptions={TIMEZONE_OPTIONS}
            inline
          />
        </div>
      </div>
    </>
  );
}

export default App;
