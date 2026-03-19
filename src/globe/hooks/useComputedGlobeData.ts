import { useEffect, useMemo } from "react";
import { computeHighlightedData } from "../render";
import type { HighlightedData } from "../render/BoundaryRenderer";
import {
  TZ_BOUNDARY_MODES,
  type GeoData,
  type TzBoundaryMode,
} from "../types/globe.types";
import { type buildLogger } from "../../logger/client";

interface UseComputedGlobeDataArgs {
  geoData: GeoData | null;
  timezone: string;
  showTZBoundaries: TzBoundaryMode;
  logger: ReturnType<typeof buildLogger>;
}

interface UseComputedGlobeDataResult {
  highlightedData: HighlightedData | null;
}

type HighlightedDataIssue = "missing-iana-timezones" | "missing-etcgmt-data";

interface HighlightedDataComputation {
  highlightedData: HighlightedData | null;
  issue: HighlightedDataIssue | null;
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
  // ── Highlighted Feature Computation ────────────────────────────────────────
  const { highlightedData, issue } = useMemo(
    (): HighlightedDataComputation => {
      if (!geoData) {
        return {
          highlightedData: null,
          issue: null,
        };
      }

      // Fail-fast checks for explicit mode requirements
      if (
        showTZBoundaries === TZ_BOUNDARY_MODES.IANA &&
        !geoData.ianaTimezones
      ) {
        return {
          highlightedData: null,
          issue: "missing-iana-timezones",
        };
      }

      if (
        showTZBoundaries === TZ_BOUNDARY_MODES.ETCGMT &&
        !geoData.etcgmtOffsetGeometries
      ) {
        return {
          highlightedData: null,
          issue: "missing-etcgmt-data",
        };
      }

      return {
        highlightedData: computeHighlightedData({
          geoData,
          timezone,
          mode: showTZBoundaries,
        }),
        issue: null,
      };
    },
    [geoData, timezone, showTZBoundaries],
  );

  useEffect((): void => {
    if (issue === "missing-iana-timezones") {
      logger.error(
        {
          hasIanaTimezones: Boolean(geoData?.ianaTimezones),
          mode: "iana",
        },
        "[TzGlobePicker] showTZBoundaries='iana' but required IANA timezone data is missing",
      );
      return;
    }

    if (issue === "missing-etcgmt-data") {
      logger.error(
        {
          hasEtcGmt: Boolean(geoData?.etcgmtOffsetGeometries),
          mode: "etcgmt",
        },
        "[TzGlobePicker] showTZBoundaries='etcgmt' but required ETC/GMT artifacts are missing",
      );
    }
  }, [geoData, issue, logger]);

  return { highlightedData };
}
