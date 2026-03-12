import { TIMEZONE_COORDINATES } from "./timezoneCoordinates";
import { CANONICAL_TZ_REGIONS } from "./canonicalTzRegions.generated";
import type { MarkerEntry } from "../components/TzGlobePicker/types/globe.types";

/** Build the list of markers from TIMEZONE_COORDINATES.
 * If `allowed` is provided, only markers whose tz id is in `allowed` are included.
 * Excludes UTC/GMT/Etc entries that map to [0, 0].
 */
export function buildMarkerList(allowed?: Iterable<string>): MarkerEntry[] {
  const entries: MarkerEntry[] = [];
  const allowedSet = allowed ? new Set(allowed) : null;
  for (const [tz, [lat, lng]] of Object.entries(TIMEZONE_COORDINATES)) {
    if (tz === "UTC" || tz === "GMT" || tz.startsWith("Etc/")) continue;
    if (allowedSet && !allowedSet.has(tz)) continue;
    entries.push({ tz, coords: [lat, lng] });
  }
  return entries;
}

/** Subset of markers filtered to only canonical timezone regions (~64 entries) */
export const CANONICAL_MARKERS: MarkerEntry[] =
  buildMarkerList(CANONICAL_TZ_REGIONS);
