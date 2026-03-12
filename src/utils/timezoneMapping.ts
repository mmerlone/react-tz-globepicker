/**
 * Timezone Mapping Utilities
 *
 * Maps any IANA timezone identifier to one of the 64 canonical timezone regions
 * used by the TzGlobePicker component's boundary polygons, and provides UTC offset
 * computation for the simplified band rendering mode.
 *
 * The 64 canonical regions come from the timezone-boundary-builder "now" variant,
 * which groups all IANA timezones by their current observance rules.
 *
 * @module timezoneMapping
 * @see {@link https://github.com/evansiroky/timezone-boundary-builder}
 */

import { CANONICAL_TZ_REGIONS } from "./canonicalTzRegions.generated";

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
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
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
  // Direct match — skip the offset computation
  if (CANONICAL_TZ_REGIONS.some((r) => r === timezone)) {
    return timezone;
  }

  const targetOffset = getUtcOffsetMinutes(timezone);

  // Find the canonical region with the closest UTC offset
  const firstRegion = CANONICAL_TZ_REGIONS[0];
  let bestMatch: string = firstRegion;
  let bestDiff = Infinity;

  for (const canonical of CANONICAL_TZ_REGIONS) {
    const canonicalOffset = getUtcOffsetMinutes(canonical);
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
