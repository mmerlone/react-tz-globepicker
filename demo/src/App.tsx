import React, { useEffect, useMemo, useState } from "react";
import {
  TzGlobePicker,
  IANA_TZ_DATA,
  SpaceBackground,
  TZ_BOUNDARY_MODES,
  type TzGlobePickerProps,
  type GlobePalette,
  type TzGlobePickerRef,
} from "react-tz-globepicker";
import CustomBackground from "./components/CustomBackground";

const ControlPanel = React.lazy(async () => {
  const mod = await import("./components/ControlPanel");
  return { default: mod.ControlPanel };
});

const CUSTOM_COLORS: GlobePalette = {
  ocean: "#94c8ff",
  land: "#21912a",
  border: "#4d8950ff",
  graticule: "rgba(255,255,255,0.28)",
  geographic: "rgba(245, 6, 6, 0.15)",
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
  timezone: "America/Sao_Paulo",
  size: 800,
  showMarkers: true,
  showTooltips: true,
  zoomMarkers: true,
  minZoom: 0.1,
  maxZoom: 10,
  initialZoom: 0.8,
  showTZBoundaries: TZ_BOUNDARY_MODES.ETCGMT,
  showCountryBorders: true,
  showGeographic: true,
  background: null,
  colors: CUSTOM_COLORS,
};

function App(): React.ReactElement {
  const globeRef = React.useRef<TzGlobePickerRef>(null);
  const [shouldMountControlPanel, setShouldMountControlPanel] = useState(false);

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
    DEFAULT_OPTIONS.showTZBoundaries ?? TZ_BOUNDARY_MODES.ETCGMT,
  );
  const [showCountryBorders, setShowCountryBorders] = useState(
    DEFAULT_OPTIONS.showCountryBorders ?? true,
  );
  const [showGeographic, setShowGeographic] = useState<boolean>(
    DEFAULT_OPTIONS.showGeographic ?? true,
  );
  type BackgroundType = "transparent" | "color" | "space" | "custom";
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("space");
  const [backgroundValue, setBackgroundValue] = useState<string | null>(null);
  const [colors, setColors] = useState<GlobePalette>(
    (DEFAULT_OPTIONS.colors as GlobePalette) ?? CUSTOM_COLORS,
  );
  const [simulatedDate, setSimulatedDate] = useState<Date | undefined>(
    undefined,
  );

  useEffect((): (() => void) => {
    if (typeof window === "undefined") {
      setShouldMountControlPanel(true);
      return (): void => {};
    }

    const globalWindow = window as Window &
      typeof globalThis & {
        cancelIdleCallback?: (handle: number) => void;
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
      };
    const mountControls = (): void => {
      setShouldMountControlPanel(true);
    };

    const requestIdleCallback = globalWindow.requestIdleCallback;
    const cancelIdleCallback = globalWindow.cancelIdleCallback;

    if (
      typeof requestIdleCallback === "function" &&
      typeof cancelIdleCallback === "function"
    ) {
      const idleHandle = requestIdleCallback((): void => mountControls(), {
        timeout: 750,
      });

      return (): void => {
        cancelIdleCallback(idleHandle);
      };
    }

    const timeoutHandle = globalWindow.setTimeout(mountControls, 200);
    return (): void => {
      globalWindow.clearTimeout(timeoutHandle);
    };
  }, []);

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
    setShowTZBoundaries(
      DEFAULT_OPTIONS.showTZBoundaries ?? TZ_BOUNDARY_MODES.ETCGMT,
    );
    setShowCountryBorders(DEFAULT_OPTIONS.showCountryBorders ?? true);
    setBackgroundType("transparent");
    setBackgroundValue(null);
    setColors({ ...CUSTOM_COLORS, ...DEFAULT_OPTIONS.colors });

    const targetTz = DEFAULT_OPTIONS.timezone;
    const globe = globeRef.current;

    // Call the animated flyTo handle exposed by TzGlobePicker
    if (targetTz && globe) {
      globe.flyTo(targetTz, true);
    } else if (globe) {
      globe.reset();
    }
  };

  return (
    <>
      <div
        id="TzGlobeWrapper"
        style={{
          height: "100vh",
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
              ref={globeRef}
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
              showGeographic={showGeographic}
              background={backgroundProp}
              colors={colors}
              simulatedDate={simulatedDate}
            />

            <p style={{ margin: 0, fontSize: "0.95rem", opacity: 0.8 }}>
              Selected:{" "}
              <strong style={{ color: "#64b5f6" }}>{timezone ?? "none"}</strong>
            </p>
          </div>

          <div style={{ flex: "0 0 300px", minWidth: 0, height: "100vh" }}>
            {shouldMountControlPanel ? (
              <React.Suspense fallback={null}>
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
                  showGeographic={showGeographic}
                  onShowGeographicChange={setShowGeographic}
                  backgroundType={backgroundType}
                  backgroundValue={backgroundValue}
                  onBackgroundTypeChange={setBackgroundType}
                  onBackgroundValueChange={setBackgroundValue}
                  colors={colors}
                  onColorsChange={setColors}
                  onReset={handleReset}
                  timezoneOptions={IANA_TZ_DATA}
                  simulatedDate={simulatedDate}
                  onSimulatedDateChange={setSimulatedDate}
                />
              </React.Suspense>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
