import { geoGraticule } from "d3-geo";

/**
 * Globe constants for TzGlobePicker
 */

/** Globe axial tilt in degrees (Earth's obliquity ≈ 23.44°) */
export const TILT = -23.44;

/** Sensitivity factor for drag-to-rotate (degrees per pixel) */
export const DRAG_SENSITIVITY = 0.4;

/** Inertia friction factor (0–1, lower = more friction) */
export const INERTIA_FRICTION = 0.92;

/** Minimum velocity to continue inertia animation (degrees/frame) */
export const INERTIA_MIN_VELOCITY = 0.1;

/** Clamp latitude so the globe never flips over during drag/inertia */
export const MAX_LATITUDE = 60;

/** Pixel radius for marker hit-test */
export const HIT_RADIUS = 10;

/** Drag distance threshold (pixels) to distinguish click from drag */
export const CLICK_THRESHOLD = 4;

/** Minimum zoom multiplier (1× = default globe scale from fitSize) */
export const MIN_ZOOM = 1;

/** Maximum zoom multiplier */
export const MAX_ZOOM = 5;

/** Wheel delta to zoom multiplier sensitivity */
export const ZOOM_SENSITIVITY = 0.002;

/**
 * Maximum spherical area (in steradians) for a boundary feature to be
 * considered a real country-level polygon.
 */
export const MAX_BOUNDARY_AREA = 1.0;

/** Base opacity for the twilight gradient */
export const TWILIGHT_OPACITY = 0.7;

/** RGB components for night shadow base color (used with varying opacity) */
export const NIGHT_COLOR_RGB = "0,0,40";

/** Duration of fly-to animation in milliseconds */
export const FLY_DURATION = 600;

/** Colors for globe rendering */
export const COLORS = {
  ocean: "#22476eff",
  land: "#91ff9a9a",
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
} as const;

/** Graticule step size [longitude, latitude] in degrees */
export const GRATICULE_STEP: [number, number] = [15, 15];

/** Pre-generated graticule data for globe rendering */
export const GRATICULE_DATA = geoGraticule().step(GRATICULE_STEP)();

/** Line widths for different elements */
export const LINE_WIDTHS = {
  graticule: 0.5,
  border: 0.5,
  marker: 0.5,
  markerHovered: 1,
  markerSelected: 1.5,
  highlight: 1,
  rim: 1,
} as const;
