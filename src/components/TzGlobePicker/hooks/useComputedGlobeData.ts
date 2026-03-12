import { useMemo } from "react";
import { getUtcOffsetMinutes } from "../../../utils/timezoneMapping";
import { computeHighlightedData } from "../renderers";
import type { HighlightedData } from "../renderers/BoundaryRenderer";
import type { GeoData, TzBoundaryMode } from "../types/globe.types";
import { type buildLogger } from "../../../logger/client";

interface UseComputedGlobeDataArgs {
  geoData: GeoData | null;
  timezone: string;
  showTZBoundaries: TzBoundaryMode;
  logger: ReturnType<typeof buildLogger>;
}

interface UseComputedGlobeDataResult {
  featureOffsets: Map<string, number>;
  highlightedData: HighlightedData | null;
}

/**
 * Hook to encapsulate the heavy computation of timezone feature offsets
 * and highlighted boundary data.
 */
export function useComputedGlobeData({
  geoData,
  timezone,
  showTZBoundaries,
  logger,
}: UseComputedGlobeDataArgs): UseComputedGlobeDataResult {
  // ── UTC Offset Pre-computation ───────────────────────────────────────────
  const featureOffsets = useMemo(() => {
    if (!geoData?.timezones) return new Map<string, number>();
    const offsetMap = new Map<string, number>();
    const uniqueTzids = new Set<string>();
    geoData.timezones.features.forEach((f) => {
      const tzid = f.properties?.tzid as string;
      if (tzid) uniqueTzids.add(tzid);
    });

    uniqueTzids.forEach((tzid) => {
      offsetMap.set(tzid, getUtcOffsetMinutes(tzid));
    });
    return offsetMap;
  }, [geoData]);

  // ── Highlighted Feature Computation ────────────────────────────────────────
  const highlightedData = useMemo(() => {
    if (!geoData) {
      logger.info({}, "No geoData available for highlightedData computation");
      return null;
    }
    // Fail fast for all modes, log only presence/absence
    if (
      showTZBoundaries === "iana" &&
      (!geoData.countries || !geoData.topology)
    ) {
      logger.error(
        {
          hasCountries: Boolean(geoData.countries),
          hasTopology: Boolean(geoData.topology),
          mode: "iana",
        },
        "[TzGlobePicker] showTZBoundaries='iana' but required country or topology data is missing",
      );
      return null;
    }
    if (showTZBoundaries === "iso8601" && !geoData.topology) {
      logger.error(
        { hasTopology: Boolean(geoData.topology), mode: "iso8601" },
        "[TzGlobePicker] showTZBoundaries='iso8601' but required topology data is missing",
      );
      return null;
    }
    if (showTZBoundaries === "nautic" && !geoData.timezones) {
      logger.error(
        { hasTimezones: Boolean(geoData.timezones), mode: "nautic" },
        "[TzGlobePicker] showTZBoundaries='nautic' but required timezones data is missing",
      );
      return null;
    }

    if (showTZBoundaries !== "none") {
      logger.info({ showTZBoundaries }, "Computing highlightedData");
    }

    return computeHighlightedData({
      geoData,
      timezone,
      featureOffsets,
      mode: showTZBoundaries,
    });
  }, [geoData, timezone, featureOffsets, showTZBoundaries, logger]);

  return { featureOffsets, highlightedData };
}
