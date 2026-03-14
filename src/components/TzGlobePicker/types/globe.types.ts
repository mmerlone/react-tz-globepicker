/**
 * TzGlobePicker types
 *
 * Conventions:
 * - `Coordinate`: [longitude, latitude] (matches D3 / GeoJSON order)
 * - `LatLng`: [latitude, longitude] (used for convenience in marker data)
 *
 * Be careful: both tuple shapes exist in this codebase to match external
 * data sources and D3 expectations — double-check the type when passing
 * coordinates between utils and renderers.
 */
import type { FeatureCollection, Feature } from "geojson";
import type { GeoProjection } from "d3-geo";
import type { Topology } from "topojson-specification";
import type { CSSProperties, ReactElement } from "react";

/** Coordinate tuple [longitude, latitude] used throughout the component (D3/GeoJSON convention) */
export type Coordinate = [number, number];

/** Coordinate tuple [latitude, longitude] used for geographic locations (e.g. marker positions) */
export type LatLng = [number, number];

/** Rotation tuple [longitude, latitude, tilt] */
export type Rotation = [number, number, number];

/** Render function signature for canvas render callbacks */
export type RenderFn = (
  projection: GeoProjection,
  ctx: CanvasRenderingContext2D,
) => void;

/** Geographic data loaded from unified source (globe-data.json) */
export interface GeoData {
  /** IANA timezone boundaries (accurate land boundaries from timezone-boundary-builder) */
  ianaTimezones: FeatureCollection;
  /** ISO8601 timezone polygons (includes ocean areas from Natural Earth) */
  iso8601Timezones: FeatureCollection;
  /** Legacy property - now points to ianaTimezones for backward compatibility */
  timezones: FeatureCollection;
  /** World 110m countries (context layer) */
  countries?: FeatureCollection | null;
  /** Original TopoJSON topology for advanced operations (merge, mesh) */
  topology?: Topology;
}

/**
 * Color palette interface for globe rendering.
 *
 * Defines all color properties used throughout the globe component
 * for consistent theming and type safety.
 */
export interface GlobePalette {
  /** Ocean background color */
  ocean: string;
  /** Land/continent color */
  land: string;
  /** Country border color */
  border: string;
  /** Graticule (grid lines) color */
  graticule: string;
  /** Globe rim/edge glow color */
  rim: string;
  /** Default marker fill color */
  defaultMarker: string;
  /** Default marker stroke color */
  defaultMarkerStroke: string;
  /** Selected marker fill color */
  selectedMarker: string;
  /** Selected marker stroke color */
  selectedMarkerStroke: string;
  /** Hovered marker fill color */
  hoveredMarker: string;
  /** Hovered marker stroke color */
  hoveredMarkerStroke: string;
  /** Highlight fill color for regions */
  highlightFill: string;
  /** Highlight stroke color for regions */
  highlightStroke: string;
  /** Highlighted country border color */
  highlightCountryBorder: string;
}

/** State tracking during drag operations */
export interface DragState {
  startRotation: Rotation;
  startX: number;
  startY: number;
  totalDistance: number;
}

/** Pre-computed marker entry for fast iteration during render/hit-test */
export interface MarkerEntry {
  /** IANA timezone identifier */
  tz: string;
  /** Geographic coordinates [latitude, longitude] */
  coords: LatLng;
}

/** Tooltip position state */
export interface TooltipPosition {
  x: number;
  y: number;
}

/** Cached timezone boundary for performance */
export interface CachedBoundary {
  tz: string;
  feature: Feature | null;
  bucket?: FeatureCollection | null;
}

/** Cached night circle for performance */
export interface CachedNight {
  minute: number;
  center: Coordinate | null;
}

/** Canonical boundary visualization mode values. */
export const TZ_BOUNDARY_MODES = {
  /** 15-degree longitudinal band centered on timezone's canonical longitude. Fast to compute, but less accurate. */
  NAUTIC: "nautic",
  /** Merged high-level timezone shape based on ISO8601 standard. */
  ISO8601: "iso8601",
  /** Individual country-level polygons based on IANA timezone data. */
  IANA: "iana",
  /** No boundaries or highlights. */
  NONE: "none",
} as const;

/** String union of supported boundary visualization modes. */
export type TzBoundaryMode =
  (typeof TZ_BOUNDARY_MODES)[keyof typeof TZ_BOUNDARY_MODES];

/** Props for TzGlobePicker component */
export interface TzGlobePickerProps {
  /** IANA timezone identifier (e.g. "America/New_York"). */
  timezone?: string | null;
  /** Globe diameter in pixels. Defaults to 250. */
  size?: number;
  /** Called when a timezone marker is clicked on the globe. */
  onSelect?: (timezone: string) => void;
  /** Whether to render timezone markers on the globe. Defaults to false, unless markers is provided. */
  showMarkers?: boolean;
  /** Whether to show hover tooltips on markers. Defaults to false. */
  showTooltips?: boolean;
  /**
   * When true, markers scale with zoom level (grow when zoomed in).
   * When false, markers stay at a fixed screen size. Defaults to false.
   */
  zoomMarkers?: boolean;
  /** Minimum zoom level. Defaults to MIN_ZOOM constant. */
  minZoom?: number;
  /** Maximum zoom level. Defaults to MAX_ZOOM constant. */
  maxZoom?: number;
  /** Initial zoom level. Defaults to 1. */
  initialZoom?: number;
  /**
   * Optional externally-controlled zoom value. When provided, the component
   * will follow this value and update its internal projection scale accordingly.
   */
  zoom?: number;
  /**
   * Called whenever the globe's zoom changes due to user interaction or
   * programmatic animation. Useful for keeping external UI in sync.
   */
  onZoomChange?: (zoom: number) => void;
  /**
   * Timezone boundary visualization mode.
   * - 'nautic': 15-degree longitudinal band.
   * - 'iso8601': Merged high-level timezone shape.
   * - 'iana': Individual country-level polygons.
   * - 'none': No boundaries or highlights.
   * Defaults to 'none'.
   */
  showTZBoundaries?: TzBoundaryMode;
  /** Whether to render country borders. Defaults to false. */
  showCountryBorders?: boolean;
  /**
   * Geographic lines – Polar circles, tropical circles, equator, and International Date Line.
   * @link https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-geographic-lines/
   */
  showGeographic?: boolean;
  /** Globe background: solid color string, JSX element, or null/undefined for transparent
   * TODO: add 'default' option to use the SpaceBackground component.
   */
  background?: string | ReactElement | null | undefined;
  /** Optional explicit marker list to render. If omitted, the globe uses canonical markers by default. */
  markers?: MarkerEntry[];
  /** Optional inline styles applied to the outer wrapper div */
  style?: CSSProperties;
  /** Optional CSS class name applied to the outer wrapper div */
  className?: string;
  /** Colors for globe rendering. Defaults to COLORS constant. */
  colors?: Partial<GlobePalette>;
  /**
   * Timestamp that triggers a flyTo animation to the current timezone when changed.
   * Use this to programmatically reset the view to the selected timezone.
   */
  flyToTrigger?: number;
}
