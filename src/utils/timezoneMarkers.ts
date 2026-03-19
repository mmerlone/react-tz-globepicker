import { TIMEZONE_COORDINATES } from "./timezoneCoordinates";
import { CANONICAL_MARKERS } from "../data/canonical-markers";
import type { MarkerEntry } from "../globe/types/globe.types";
import { ianaToEtc } from "./timezoneMapping";

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
    let etcKey: string | undefined;
    try {
      etcKey = ianaToEtc(tz);
    } catch {
      etcKey = undefined;
    }
    entries.push({ tz, coords: [lat, lng], etcgmtOffsetKey: etcKey });
  }
  return entries;
}

export function getCanonicalMarkers(): MarkerEntry[] {
  return CANONICAL_MARKERS;
}

export { CANONICAL_MARKERS };
