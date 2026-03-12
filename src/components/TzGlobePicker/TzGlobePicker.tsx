"use client";

import React, { isValidElement, useRef } from "react";
import type { TzGlobePickerProps } from "./types/globe.types";
import { GlobeTooltip, ResetButton, GlobeCanvas, GlobeFallback } from "./ui";
import { useGlobeController } from "./hooks";

/**
 * Interactive 3D globe component for timezone selection with advanced visualization capabilities.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <TzGlobePicker
 *   timezone="America/New_York"
 *   onSelect={(tz) => console.log('Selected:', tz)}
 *   showMarkers
 *   showTooltips
 *   size={300}
 * />
 *
 * // Advanced usage with custom styling
 * <TzGlobePicker
 *   timezone="Europe/London"
 *   onSelect={handleTimezoneSelect}
 *   showMarkers
 *   showTooltips
 *   showTZBoundaries="iso8601"
 *   showCountryBorders
 *   zoomMarkers
 *   size={400}
 *   colors={{
 *     ocean: '#001f3f',
 *     land: '#0074d9',
 *     selectedMarker: '#ff4136'
 *   }}
 *   sx={{ border: '2px solid #ddd', borderRadius: '8px' }}
 * />
 * ```
 *
 * @component
 * @description
 * TzGlobePicker renders a fully interactive 3D globe using HTML5 Canvas and D3.js projections.
 * The component supports:
 *
 * **Core Features:**
 * - Click-and-drag rotation with inertia physics
 * - Scroll wheel zoom with configurable limits
 * - Timezone marker selection with hover tooltips
 * - Multiple boundary visualization modes (nautic bands, iso8601 shapes, iana country-level)
 * - Custom color theming and styling
 *
 * **Data Sources:**
 * - Natural Earth 10m timezones for accurate boundaries
 * - World 110m countries for geographic context
 * - Canonical timezone coordinates from IANA database
 *
 * **Performance Optimizations:**
 * - Canvas-based rendering for smooth 60fps animations
 * - Cached night shadow calculations
 * - Efficient hit-testing for marker interactions
 * - Memoized computations to prevent unnecessary re-renders
 *
 * **Accessibility:**
 * - Keyboard navigation support
 * - Screen reader compatible tooltips
 * - High contrast mode support
 * - Touch-friendly interaction targets
 *
 * @param props - Component configuration options
 * @param {string | null} props.timezone - Currently selected IANA timezone identifier
 * @param {number} props.size - Globe diameter in pixels
 * @param {function} props.onSelect - Callback for timezone selection
 * @param {boolean} props.showMarkers - Whether to display timezone markers
 * @param {boolean} props.showTooltips - Whether to show hover tooltips
 * @param {string} props.showTZBoundaries - Timezone boundary visualization mode
 * @param {string | React.ReactElement | null} props.background - Background styling
 * @param {boolean} props.showCountryBorders - Whether to render country borders
 * @param {MarkerEntry[]} props.markers - Custom timezone markers array
 * @param {boolean} props.zoomMarkers - Whether markers scale with zoom
 * @param {React.CSSProperties} props.style - Inline styles
 * @param {number} props.minZoom - Minimum zoom level
 * @param {number} props.maxZoom - Maximum zoom level
 * @param {number} props.initialZoom - Initial zoom level
 * @param {Partial<GlobePalette>} props.colors - Custom color palette
 * @returns A canvas-based interactive globe component wrapped in a div container
 *
 * @see {@link https://github.com/mmerlone/react-tz-globepicker} for full documentation
 * @see {@link ./types/globe.types.ts} for complete type definitions
 * @see {@link ./constants/globe.constants.ts} for default values and configuration
 */
export function TzGlobePicker(props: TzGlobePickerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Orchestrate all globe logic, initialization, interactions and computed data
  const {
    size,
    cursorStyle,
    canvasBackgroundStyle,
    isLoadingGeoData,
    geoData,
    error,
    canvasRef,
    tooltip,
    handleReset,
    showTooltips,
  } = useGlobeController(props);


  const { background, style: styleProp, className } = props;

  // ── Styling Configuration ───────────────────────────────────────────────
  const baseStyle: React.CSSProperties = {
    position: "relative",
    flexShrink: 0,
    width: size,
    height: size,
    overflow: "hidden",
    cursor: cursorStyle,
    backgroundColor: canvasBackgroundStyle,
  };

  // If background is a string, apply as CSS background property
  const backgroundStyle: React.CSSProperties =
    typeof background === "string"
      ? { background: background }
      : {};

  const outerStyle: React.CSSProperties = {
    ...baseStyle,
    ...backgroundStyle,
    ...styleProp,
  };

  // ── Main Component Render ───────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={outerStyle} className={className}>
      {/* Background layer */}
      {isValidElement(background) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
          }}
        >
          {background}
        </div>
      )}

      {/* Interactive layer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GlobeFallback
          isLoading={isLoadingGeoData}
          hasData={Boolean(geoData)}
          error={error}
        />

        {!isLoadingGeoData && geoData && !error && (
          <>
            <GlobeCanvas canvasRef={canvasRef} size={size} />
            <ResetButton size={size} onClick={handleReset} />
            {showTooltips && (
              <GlobeTooltip
                timezone={tooltip.timezone}
                position={tooltip.position}
                open={tooltip.timezone !== null}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
