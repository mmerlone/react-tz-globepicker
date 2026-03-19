import {
  geoPath,
  type GeoProjection,
  type GeoPermissibleObjects,
} from "d3-geo";
import type { FeatureCollection, Feature, Polygon } from "geojson";
import {
  TZ_BOUNDARY_MODES,
  type GeoData,
  type TzBoundaryMode,
  type GlobePalette,
  type TzFeatureProperties,
} from "../types/globe.types";
import { logger } from "../../logger/client";

/** Shape returned by computeHighlightedData used by rendering system */
export interface HighlightedData {
  mode: TzBoundaryMode;
  etcOffsetKey?: string | null;
  featureCollection?: FeatureCollection | null;
  ianaFeature?: FeatureCollection | null;
}

interface ComputeArgs {
  geoData: GeoData;
  timezone: string;
  mode: TzBoundaryMode;
}

/**
 * Compute highlighted data for the selected timezone and mode.
 * - NAUTIC: computes a 15-degree longitudinal band based on UTC offset
 * - ETCGMT: attempts to lookup the offset-keyed FeatureCollection
 * - IANA: attempts to find the matching IANA feature
 */
export function computeHighlightedData({
  geoData,
  timezone,
  mode,
}: ComputeArgs): HighlightedData | null {
  if (!timezone) return null;

  // NAUTIC mode: compute a 15-degree band based on UTC offset
  if (mode === TZ_BOUNDARY_MODES.NAUTIC) {
    // Look up the canonical (non-DST) UTC offset from the pre-computed mapping
    const offsetString = geoData.etcgmtIanaToOffset?.[timezone];

    // Parse the offset string (e.g., "UTC-5:00" or "UTC+5:30")
    if (offsetString) {
      // Extract hours and minutes from the offset string
      const match = offsetString.match(/UTC(?:([+-])(\d{1,2}))?(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === "-" ? -1 : 1;
        const hours = parseInt(match[2] ?? "0", 10);
        const minutes = parseInt(match[3] ?? "0", 10);
        const offsetDegrees = sign * (hours + minutes / 60) * 15;

        // Create a polygon that covers a 15-degree band around the offset longitude
        const minLng = offsetDegrees - 7.5;
        const maxLng = offsetDegrees + 7.5;

        // Create polygon coordinates: go around the band from -90 to +90 latitude
        const polygon: Polygon = {
          type: "Polygon",
          coordinates: [
            [
              [minLng, -90],
              [minLng, -45],
              [minLng, 0],
              [minLng, 45],
              [minLng, 90],
              [maxLng, 90],
              [maxLng, 45],
              [maxLng, 0],
              [maxLng, -45],
              [maxLng, -90],
              [minLng, -90],
            ],
          ],
        };

        const nauticFeature: Feature<Polygon, Record<string, unknown>> = {
          type: "Feature",
          properties: { tzid: timezone },
          geometry: polygon,
        };

        return {
          mode,
          featureCollection: {
            type: "FeatureCollection",
            features: [nauticFeature],
          },
        };
      }
    }

    // Fallback: if no offset mapping found, return null
    logger.warn(
      { timezone },
      "Failed to parse offset string for NAUTIC mode; no highlighted data will be shown",
    );
    return null;
  }

  // ETC/GMT mode: prefer explicit mapping produced at build time
  if (mode === TZ_BOUNDARY_MODES.ETCGMT) {
    const mappingKey = geoData.etcgmtIanaToOffset?.[timezone];
    if (mappingKey && geoData.etcgmtOffsetGeometries?.[mappingKey]) {
      return {
        mode,
        etcOffsetKey: mappingKey,
        featureCollection: geoData.etcgmtOffsetGeometries[mappingKey],
      };
    }

    // No fallback computation here — prefer the build-time mapping. Return null
    // when a mapping is not available.
    logger.warn(
      { timezone },
      "Failed to find mapping for ETC/GMT mode; no highlighted data will be shown",
    );
    return null;
  }

  // IANA mode: find the feature whose tzid matches the timezone
  if (mode === TZ_BOUNDARY_MODES.IANA && geoData.ianaTimezones) {
    const f = geoData.ianaTimezones.features.find((feat) => {
      const props = feat.properties as TzFeatureProperties | undefined;
      const tzid = props?.tzid;
      return typeof tzid === "string" && tzid === timezone;
    });
    if (f) {
      return {
        mode,
        ianaFeature: { type: "FeatureCollection", features: [f] },
      };
    }
  }

  return null;
}

interface RenderBoundariesProps {
  projection: GeoProjection;
  ctx: CanvasRenderingContext2D;
  timezone: string | null;
  showTZBoundaries: TzBoundaryMode;
  colors: GlobePalette;
  highlightedData: HighlightedData | null;
}

export function renderBoundaries({
  projection,
  ctx,
  timezone: _timezone,
  showTZBoundaries: _showTZBoundaries,
  colors,
  highlightedData,
}: RenderBoundariesProps): void {
  // Mark unused params so linters don't complain when rendering only uses
  // highlightedData.
  void _timezone;
  void _showTZBoundaries;
  const pathGen = geoPath(projection, ctx);

  // Draw highlighted ETC/GMT bucket if available
  try {
    if (highlightedData?.featureCollection) {
      ctx.beginPath();
      pathGen(highlightedData.featureCollection as GeoPermissibleObjects);
      ctx.fillStyle = colors.highlightFill;
      ctx.fill();
      ctx.strokeStyle = colors.highlightStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return;
    }

    // Draw IANA feature if present
    if (highlightedData?.ianaFeature) {
      ctx.beginPath();
      pathGen(highlightedData.ianaFeature);
      ctx.fillStyle = colors.highlightFill;
      ctx.fill();
      ctx.strokeStyle = colors.highlightStroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      return;
    }

    // No highlighted data: draw nothing (mode-specific meshes are expensive)
  } catch (err) {
    // Non-fatal rendering error
    logger.debug({ err }, "Non-fatal rendering error in renderBoundaries");
  }
}
