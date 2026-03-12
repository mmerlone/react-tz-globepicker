import { geoDistance, type GeoProjection } from "d3-geo";
import { getUtcOffsetMinutes } from "../../../utils/timezoneMapping";
import { MAX_LATITUDE, TILT, COLORS } from "../constants/globe.constants";
import type { Coordinate, Rotation, GlobePalette } from "../types/globe.types";

/**
 * Normalize longitude to the [-180, 180] range.
 *
 * @param lng - Longitude value in degrees (may be outside valid range)
 * @returns Normalized longitude in [-180, 180] range
 *
 * @example
 * ```typescript
 * normalizeLongitude(190) // returns -170
 * normalizeLongitude(-200) // returns 160
 * ```
 */
export function normalizeLongitude(lng: number): number {
  return (((lng % 360) + 540) % 360) - 180;
}

/**
 * Clamp latitude to a safe range for globe rendering.
 *
 * @param lat - Latitude value in degrees
 * @returns Clamped latitude in [-MAX_LATITUDE, MAX_LATITUDE] range
 *
 * @example
 * ```typescript
 * clampLatitude(95) // returns MAX_LATITUDE
 * clampLatitude(-100) // returns -MAX_LATITUDE
 * ```
 */
export function clampLatitude(lat: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
}

/**
 * Normalize a full rotation tuple to valid ranges.
 *
 * @param rotation - Rotation tuple [lambda, phi, gamma]
 * @returns Normalized rotation with longitude and latitude clamped
 *
 * @example
 * ```typescript
 * normalizeRotation([190, 95, 0]) // returns [-170, MAX_LATITUDE, 0]
 * ```
 */
export function normalizeRotation(rotation: Rotation): Rotation {
  return [
    normalizeLongitude(rotation[0]),
    clampLatitude(rotation[1]),
    rotation[2],
  ];
}

/**
 * Compute shortest angular delta between two angles, handling wraparound.
 *
 * @param from - Starting angle in degrees
 * @param to - Target angle in degrees
 * @returns Shortest delta in [-180, 180] range
 *
 * @example
 * ```typescript
 * shortestDelta(10, 350) // returns -20
 * shortestDelta(-170, 170) // returns -20
 * ```
 */
export function shortestDelta(from: number, to: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/**
 * Check whether a geographic point is on the visible (front) hemisphere
 * of an orthographic projection.
 *
 * @param projection - D3 geo projection instance
 * @param point - Coordinate to check visibility for [lng, lat]
 * @returns True if point is visible, false otherwise
 *
 * @example
 * ```typescript
 * const projection = geoOrthographic().rotate([0, 0]);
 * isPointVisible(projection, [0, 0]) // returns true
 * isPointVisible(projection, [0, 180]) // returns false
 * ```
 */
export function isPointVisible(
  projection: GeoProjection,
  point: Coordinate,
): boolean {
  const rotation = projection.rotate();
  const center: Coordinate = [-rotation[0], -rotation[1]];
  return geoDistance(center, point) <= Math.PI / 2;
}

/**
 * Compute the subsolar point (latitude/longitude where the sun is directly overhead)
 * for the current moment in time.
 *
 * @returns Coordinate of subsolar point [longitude, latitude] following D3/GeoJSON convention
 *
 * @example
 * ```typescript
 * // Returns current sun position
 * const subsolar = getSubsolarPoint();
 * console.log(`Sun is at ${subsolar[0]}° longitude, ${subsolar[1]}° latitude`);
 * ```
 */
export function getSubsolarPoint(): Coordinate {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const declination =
    TILT * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.25);
  const utcHours =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const solarLng = -((utcHours - 12) * 15);
  // Return as [longitude, latitude] to match Coordinate type
  return [solarLng, declination];
}

/**
 * Format a UTC offset label for display in tooltips and UI.
 *
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Formatted UTC offset string (e.g., "UTC-5", "UTC+5:30")
 *
 * @example
 * ```typescript
 * formatUtcOffset("America/New_York") // returns "UTC-5" (EST)
 * formatUtcOffset("Asia/Kolkata") // returns "UTC+5:30" (IST)
 * formatUtcOffset("UTC") // returns "UTC"
 * ```
 */
export function formatUtcOffset(timezone: string): string {
  const minutes = getUtcOffsetMinutes(timezone);
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "-";
  const absMinutes = Math.abs(minutes);
  const h = Math.floor(absMinutes / 60);
  const m = absMinutes % 60;
  return m === 0
    ? `UTC${sign}${h}`
    : `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Map an IANA timezone identifier to a GMT bucket key used by the
 * timezone data generator (`GMT+N` / `GMT-N`). The generator rounds minute offsets to
 * the nearest hour when creating per-GMT bucket files, so we mirror that
 * behavior here.
 *
 * @param tzid - IANA timezone identifier
 * @returns GMT bucket string (e.g., "GMT+0", "GMT-5")
 *
 * @example
 * ```typescript
 * tzidToGmtBucket("UTC") // returns "GMT+0"
 * tzidToGmtBucket("America/New_York") // returns "GMT-5"
 * tzidToGmtBucket("Asia/Kolkata") // returns "GMT+6"
 * ```
 */
export function tzidToGmtBucket(tzid: string): string {
  // Special-case exact UTC
  if (tzid === "UTC") return "GMT+0";
  const minutes = getUtcOffsetMinutes(tzid);
  const hour = Math.round(minutes / 60);
  return `GMT${hour >= 0 ? "+" : ""}${hour}`;
}

/**
 * Safely get a color value from a palette with fallback to defaults.
 *
 * This function provides resilience by falling back to the default COLORS
 * constant when a color is missing from the provided palette.
 *
 * @param colors - Color palette (complete or partial)
 * @param key - Color property to retrieve from palette
 * @returns Color value as string (from palette or defaults)
 * @throws Error if color is missing from both palette and default COLORS
 *
 * @example
 * ```typescript
 * // Works with both complete and partial palettes:
 * const oceanColor = getColor(colors, 'ocean');
 * const selectedColor = getColor(props.colors, 'selectedMarker');
 *
 * // With partial palette (falls back to defaults):
 * const partialPalette = { ocean: '#001122' };
 * const landColor = getColor(partialPalette, 'land'); // Uses default land color
 * ```
 */
export function getColor(
  colors: Partial<GlobePalette> | GlobePalette,
  key: keyof GlobePalette,
): string {
  // Try provided colors first, then fall back to defaults
  const color = colors[key] ?? COLORS[key];

  if (color === undefined) {
    throw new Error(
      `Color '${String(key)}' is missing from both palette and default COLORS`,
    );
  }

  return color;
}
