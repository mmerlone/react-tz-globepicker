/**
 * Timezone Mapping Utilities
 *
 * Maps any IANA timezone identifier to one of the 419 canonical timezone regions
 * used by the TzGlobePicker component's boundary polygons, and provides UTC offset
 * computation for the simplified band rendering mode.
 *
 * The 419 canonical regions come from the timezone-boundary-builder "now" variant,
 * which groups all IANA timezones by their current observance rules.
 *
 * @module timezoneMapping
 * @see {@link https://github.com/evansiroky/timezone-boundary-builder}
 */

import { IANA_TZ_DATA } from "../data/iana-data";
import { getTimezoneCenter } from "./timezoneCoordinates";

/**
 * Internal implementation of UTC offset calculation without caching.
 */
function getUtcOffsetMinutesUncached(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";

    // Parse "GMT+05:30" or "GMT-05:00" or "GMT"
    const match = tzPart.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0; // GMT/UTC

    const [, signChar, hoursStr, minutesStr] = match;
    if (!signChar || !hoursStr || !minutesStr) return 0;

    const sign = signChar === "+" ? 1 : -1;
    const hours = parseInt(hoursStr ?? "0", 10);
    const minutes = parseInt(minutesStr ?? "0", 10);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

// Cache for UTC offset calculations - avoids repeated Intl API calls
const offsetCache = new Map<string, number>();

let canonicalTzSet: Set<string> | null = null;
let canonicalOffsets: Map<string, number> | null = null;

function getCanonicalTzSet(): Set<string> {
  canonicalTzSet ??= new Set<string>(IANA_TZ_DATA);
  return canonicalTzSet;
}

function getCanonicalOffsets(): Map<string, number> {
  if (canonicalOffsets) {
    return canonicalOffsets;
  }

  const nextOffsets = new Map<string, number>();
  for (const tz of IANA_TZ_DATA) {
    nextOffsets.set(tz, getUtcOffsetMinutesUncached(tz));
  }
  canonicalOffsets = nextOffsets;
  return canonicalOffsets;
}

/**
 * Get the current UTC offset in minutes for a given IANA timezone.
 * Uses the Intl API to parse the UTC offset string.
 *
 * @param timezone - IANA timezone identifier (e.g. "America/New_York")
 * @returns UTC offset in minutes (e.g. -300 for EST, 330 for IST)
 *
 * @example
 * ```typescript
 * getUtcOffsetMinutes('America/New_York') // -300 (UTC-5) or -240 (UTC-4 during DST)
 * getUtcOffsetMinutes('Asia/Kolkata')     // 330 (UTC+5:30)
 * ```
 */
export function getUtcOffsetMinutes(timezone: string): number {
  // Check cache first
  if (offsetCache.has(timezone)) {
    return offsetCache.get(timezone) ?? 0;
  }

  const offset = getUtcOffsetMinutesUncached(timezone);
  offsetCache.set(timezone, offset);
  return offset;
}

/**
 * Get the current UTC offset expressed as hours (minutes/60).
 * This returns a fractional hour value (e.g. 5.5 for IST) and is suitable
 * for calculations that require sub-hour offsets (e.g. converting to
 * longitude: hour * 15).
 *
 * @param timezone - IANA timezone identifier
 * @returns UTC offset in hours (fractional, e.g. 5.5)
 *
 * @example
 * ```typescript
 * getUtcOffsetHour('America/New_York') // -5 (or -4 during DST)
 * getUtcOffsetHour('Asia/Kolkata')     // 5.5
 * ```
 */
export function getUtcOffsetHour(timezone: string): number {
  const minutes = getUtcOffsetMinutes(timezone);
  // Return a float hour value (e.g. 5.5 for IST) instead of rounding.
  return minutes / 60;
}

/**
 * Map any IANA timezone to its canonical timezone-boundary-builder region.
 *
 * This works by computing the current UTC offset for both the input timezone
 * and each canonical region, then finding the best match. If the input timezone
 * IS one of the canonical regions, it's returned directly.
 *
 * @param timezone - Any IANA timezone identifier (e.g. "America/Indiana/Indianapolis")
 * @returns The matching canonical region ID (e.g. "America/New_York")
 *
 * @example
 * ```typescript
 * mapToCanonicalTz('America/Indiana/Indianapolis') // "America/New_York"
 * mapToCanonicalTz('Europe/Berlin')                // "Europe/Paris"
 * mapToCanonicalTz('Asia/Shanghai')                // "Asia/Manila"
 * mapToCanonicalTz('America/Sao_Paulo')            // "America/Sao_Paulo" (already canonical)
 * ```
 */
export function mapToCanonicalTz(timezone: string): string {
  // O(1) lookup using Set instead of O(n) array.some()
  if (getCanonicalTzSet().has(timezone)) {
    return timezone;
  }

  const targetOffset = getUtcOffsetMinutes(timezone);
  const offsetsByTimezone = getCanonicalOffsets();

  // Find the canonical region with the closest UTC offset
  // Using pre-computed offsets for O(1) lookup per iteration
  let bestMatch: string = IANA_TZ_DATA[0];
  let bestDiff = Infinity;

  for (const canonical of IANA_TZ_DATA) {
    const canonicalOffset = offsetsByTimezone.get(canonical) ?? 0;
    const diff = Math.abs(canonicalOffset - targetOffset);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = canonical;
    }
    if (diff === 0) break; // Exact match
  }

  return bestMatch;
}

/**
 * Get the longitude center for a UTC offset band.
 * Each UTC hour offset corresponds to a 15°-wide longitude band.
 *
 * @param utcOffset - Integer UTC offset (-12 to +14)
 * @returns Center longitude in degrees (-180 to +180)
 *
 * @example
 * ```typescript
 * utcOffsetToLongitude(0)   // 0    (Greenwich)
 * utcOffsetToLongitude(-5)  // -75  (Eastern US)
 * utcOffsetToLongitude(9)   // 135  (Japan)
 * ```
 */
export function utcOffsetToLongitude(utcOffset: number): number {
  const longitude = utcOffset * 15;
  // Normalize to -180 to +180 range
  if (longitude > 180) return longitude - 360;
  if (longitude < -180) return longitude + 360;
  return longitude;
}

/** Format minutes offset into canonical `UTC±HH:MM` string. */
function formatOffsetMinutesToIsoKey(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Compute canonical `UTC±HH:MM` key for an IANA timezone using a fixed winter date
 * to avoid DST ambiguity. Throws on invalid/unknown timezone.
 */
export function ianaToEtc(iana: string): string {
  if (!iana || typeof iana !== "string") {
    throw new Error(`ianaToEtc: invalid timezone '${String(iana)}'`);
  }

  try {
    // Choose sample date based on approximate hemisphere: Jan 1 for northern
    // hemisphere, Jul 1 for southern hemisphere. This yields the standard
    // (non-DST) offset for most timezones.
    // Use try-catch in case timezone is not in TIMEZONE_COORDINATES.
    let lat = 0;
    try {
      lat = getTimezoneCenter(iana)[0] ?? 0;
    } catch {
      // Default to northern hemisphere if timezone center lookup fails
      lat = 0;
    }
    const sample =
      lat < 0
        ? new Date(Date.UTC(2020, 6, 1, 12, 0, 0))
        : new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "longOffset",
    });
    const parts = fmt.formatToParts(sample);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = tzPart.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return "UTC+00:00";
    const [, signChar, hoursStr, minutesStr] = m;
    const sign = signChar === "+" ? 1 : -1;
    const hours = parseInt(hoursStr ?? "0", 10);
    const mins = parseInt(minutesStr ?? "0", 10);
    return formatOffsetMinutesToIsoKey(sign * (hours * 60 + mins));
  } catch (err) {
    throw new Error(
      `ianaToEtc: failed to compute offset for '${iana}': ${String(err)}`,
    );
  }
}

/**
 * Convert an `Etc/GMT` or `GMT` style label into canonical `UTC±HH:MM` key.
 * Examples:
 * - `Etc/GMT+5` -> `UTC-05:00` (note reversed sign semantics)
 * - `Etc/GMT-3` -> `UTC+03:00`
 * - `GMT+05:30` -> `UTC+05:30`
 * - `UTC+02:00` -> `UTC+02:00`
 */
export function offsetKeyFromEtc(etcZone: string): string {
  if (!etcZone || typeof etcZone !== "string") {
    throw new Error(`offsetKeyFromEtc: invalid etcZone '${String(etcZone)}'`);
  }
  // Already in canonical form
  if (/^UTC[+-]\d{2}:\d{2}$/.test(etcZone)) return etcZone;

  // Handle plain UTC/GMT variants
  if (/^(Etc\/)?(GMT|UTC)$/.test(etcZone)) return "UTC+00:00";

  // Handle Etc/GMT+N semantics first (note reversed sign)
  const etcMatch = etcZone.match(/Etc\/GMT([+-])(\d{1,2})$/);
  if (etcMatch) {
    const [, signChar, numStr] = etcMatch;
    const n = parseInt(numStr ?? "0", 10);
    // Etc/GMT+N -> UTC-(N:00)
    const total = signChar === "+" ? -n * 60 : n * 60;
    return formatOffsetMinutesToIsoKey(total);
  }

  // Handle GMT+/-HH:MM patterns (e.g. GMT+05:30)
  const gmtMatch = etcZone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (gmtMatch) {
    const [, signChar, hoursStr, minutesStr] = gmtMatch;
    const hours = parseInt(hoursStr ?? "0", 10);
    const minutes = minutesStr ? parseInt(minutesStr, 10) : 0;
    const sign = signChar === "+" ? 1 : -1;
    const total = sign * (hours * 60 + minutes);
    return formatOffsetMinutesToIsoKey(total);
  }

  throw new Error(`offsetKeyFromEtc: cannot parse '${etcZone}'`);
}

export function etcToOffset(etcZone: string): { isoKey: string } {
  return { isoKey: offsetKeyFromEtc(etcZone) };
}
