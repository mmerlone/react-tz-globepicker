import { useMemo } from "react";
import { getUtcOffsetMinutes } from "../../../utils/timezoneMapping";
import { computeHighlightedData } from "../renderers";
import type { HighlightedData } from "../renderers/BoundaryRenderer";
import {
  TZ_BOUNDARY_MODES,
  type GeoData,
  type TzBoundaryMode,
} from "../types/globe.types";
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
    // Do not attempt to build offsets while data is loading. Return empty map silently.
    if (!geoData?.ianaTimezones) return new Map<string, number>();

    const offsetMap = new Map<string, number>();
    const uniqueTzids = new Set<string>();
    geoData.ianaTimezones.features.forEach((f) => {
      const tzid = f.properties?.tzid as string;
      if (tzid) uniqueTzids.add(tzid);
    });

    logger.info(
      { count: uniqueTzids.size, sample: Array.from(uniqueTzids).slice(0, 5) },
      "Building feature offsets from geoData.ianaTimezones",
    );

    uniqueTzids.forEach((tzid) => {
      offsetMap.set(tzid, getUtcOffsetMinutes(tzid));
    });
    return offsetMap;
  }, [geoData, logger]);

  // ── Highlighted Feature Computation ────────────────────────────────────────
  const highlightedData = useMemo(() => {
    if (!geoData) {
      logger.info({}, "No geoData available for highlightedData computation");
      return null;
    }

    // Fail-fast checks for explicit mode requirements
    if (
      showTZBoundaries === TZ_BOUNDARY_MODES.IANA &&
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

    if (showTZBoundaries === TZ_BOUNDARY_MODES.ISO8601 && !geoData.topology) {
      logger.error(
        { hasTopology: Boolean(geoData.topology), mode: "iso8601" },
        "[TzGlobePicker] showTZBoundaries='iso8601' but required topology is missing",
      );
      return null;
    }

    if (
      showTZBoundaries === TZ_BOUNDARY_MODES.NAUTIC &&
      !geoData.ianaTimezones
    ) {
      logger.error(
        { hasIana: Boolean(geoData.ianaTimezones), mode: "nautic" },
        "[TzGlobePicker] showTZBoundaries='nautic' but required ianaTimezones data is missing",
      );
      return null;
    }

    if (showTZBoundaries !== TZ_BOUNDARY_MODES.NONE) {
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
