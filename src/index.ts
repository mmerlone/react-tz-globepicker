/**
 * react-tz-globepicker public entry
 *
 * Exposes the main components, hooks, types and small utilities intended for
 * library consumers. Import from the package root to access the public API.
 *
 * Example:
 * ```ts
 * import { TzGlobePicker, getTimezoneCenter } from 'react-tz-globepicker'
 * ```
 */
// Main exports
export { TzGlobePicker } from "./TzGlobePicker";

// Types
export type {
  TzGlobePickerProps,
  TzBoundaryMode,
  MarkerEntry,
  Coordinate,
  LatLng,
  Rotation,
  GeoData,
  RenderFn,
  GlobePalette,
} from "./globe/types/globe.types";

export { TZ_BOUNDARY_MODES } from "./globe/types/globe.types";

// Constants
export {
  COLORS,
  TILT,
  GRATICULE_STEP,
  MAX_BOUNDARY_AREA,
  HIT_RADIUS,
  CLICK_THRESHOLD,
  FLY_DURATION,
  DRAG_SENSITIVITY,
  INERTIA_FRICTION,
  INERTIA_MIN_VELOCITY,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SENSITIVITY,
  MAX_LATITUDE,
} from "./globe/constants/globe.constants";

// Utils
export {
  formatUtcOffset,
  getSubsolarPoint,
} from "./globe/utils/globeUtils";
export {
  getTimezoneCenter,
  TIMEZONE_COORDINATES,
} from "./utils/timezoneCoordinates";
export { IANA_TZ_DATA } from "./data/iana-data";
export {
  getUtcOffsetMinutes,
  getUtcOffsetHour,
  ianaToEtc,
  etcToOffset,
  offsetKeyFromEtc,
  mapToCanonicalTz,
  utcOffsetToLongitude,
} from "./utils/timezoneMapping";
export {
  buildMarkerList,
  CANONICAL_MARKERS,
  getCanonicalMarkers,
} from "./utils/timezoneMarkers";

// Hook (if needed)
export {
  useGlobeState,
  type GlobeState,
} from "./globe/hooks/useGlobeState";
export { SpaceBackground, ResetButton } from "./globe/ui";
