/**
 * Boundary rendering utilities for timezone visualization on the globe.
 *
 * This module provides functions to render different types of timezone boundaries:
 * - Nautic longitudinal bands (15-degree strips)
 * - ISO-8601 offset polygon shapes
 * - IANA country-level boundaries grouped by timezone
 *
 * @fileoverview Boundary rendering and timezone highlighting functionality
 * @since 1.0.0
 */

import {
  geoPath,
  geoContains,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import { merge } from "topojson-client";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import type {
  GeometryCollection,
  Polygon,
  MultiPolygon,
} from "topojson-specification";
import { getUtcOffsetHour } from "../../../utils/timezoneMapping";
import { getTimezoneCenter } from "../../../utils/timezoneCoordinates";
import {
  TZ_BOUNDARY_MODES,
  type GeoData,
  type GlobePalette,
  type TzBoundaryMode,
} from "../types/globe.types";
import { getColor } from "../utils/globeUtils";
import { buildLogger } from "../../../logger/client";

const logger = buildLogger("BoundaryRenderer");

/**
 * Computed highlighted timezone data for boundary visualization.
 *
 * Contains both individual features and merged geometry for different
 * rendering modes (iana vs iso8601 boundaries).
 */
export interface HighlightedData {
  /** Features used for active rendering mode (iana: country polygons) */
  features: Feature[];
  /** Merged geometry combining all matching features (for iso8601 mode) */
  merged: unknown;
  /** Optional exclusion geometries (GeoJSON features) used to subtract areas from nautic band */
  exclusions?: Feature[];
}

/**
 * Props for the boundary rendering function.
 *
 * Contains all necessary data and configuration for rendering timezone
 * boundaries and highlights on the globe surface.
 */
interface BoundaryRendererProps {
  /** D3.js projection for coordinate transformation */
  projection: GeoProjection;
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** Currently selected timezone identifier (e.g., "America/New_York") */
  timezone: string | null;
  /** Visualization mode for timezone boundaries */
  showTZBoundaries: TzBoundaryMode;
  /** Color palette for rendering boundaries and highlights */
  colors: GlobePalette;
  /** Pre-computed highlighted data for the selected timezone */
  highlightedData: HighlightedData | null;
}

/**
 * Renders timezone boundary visualizations based on the selected mode.
 *
 * Supports three visualization modes:
 * - **nautic**: 15-degree longitudinal band centered on the timezone's UTC offset
 * - **iso8601**: High-resolution timezone polygon shapes with merged boundaries
 * - **iana**: Individual country polygons grouped by timezone with visible borders
 *
 * @param props - Boundary rendering configuration
 *
 * @example
 * ```typescript
 * // Render nautic timezone band
 * renderBoundaries({
 *   projection: orthographicProjection,
 *   ctx: canvasContext,
 *   timezone: "America/New_York",
 *   showTZBoundaries: "nautic",
 *   colors: defaultPalette,
 *   highlightedData: computedData,
 *   geoData,
 *   featureOffsets
 * });
 *
 * // Render iso8601 timezone boundaries
 * renderBoundaries({
 *   projection: orthographicProjection,
 *   ctx: canvasContext,
 *   timezone: "Europe/Paris",
 *   showTZBoundaries: "iso8601",
 *   colors: customPalette,
 *   highlightedData: computedData,
 *   geoData,
 *   featureOffsets
 * });
 * ```
 *
 * @param props - Boundary rendering configuration
 * @returns void - Renders directly to the provided canvas context
 */
export function renderBoundaries({
  projection,
  ctx,
  timezone,
  showTZBoundaries,
  colors,
  highlightedData,
}: BoundaryRendererProps): void {
  if (!timezone) return;

  // Create path generator for the current projection and canvas context
  const pathGen = geoPath(projection, ctx);

  // ── Nautic Mode (15-degree longitudinal strip) ────────────────────────────
  if (showTZBoundaries === TZ_BOUNDARY_MODES.NAUTIC) {
    // Calculate center longitude based on timezone's UTC offset (15 degrees per hour)
    const centerLng = getUtcOffsetHour(timezone) * 15;

    // Define a pole-to-pole longitudinal strip (7.5 degrees on each side)
    const band = {
      type: "Polygon" as const,
      coordinates: [
        [
          [centerLng - 7.5, 89], // Top-left
          [centerLng + 7.5, 89], // Top-right
          [centerLng + 7.5, -89], // Bottom-right
          [centerLng - 7.5, -89], // Bottom-left
          [centerLng - 7.5, 89], // Close polygon
        ],
      ],
    };
    ctx.beginPath();
    pathGen(band as GeoPermissibleObjects);
    ctx.fillStyle = getColor(colors, "highlightFill");
    ctx.fill();
  }

  // ── IANA Mode (Individual country boundaries) ─────────────────────────────
  // Draw country polygons that fall within the selected timezone footprint.
  if (showTZBoundaries === TZ_BOUNDARY_MODES.IANA) {
    if (!highlightedData?.features) {
      logger.error(
        { timezone, mode: "iana" },
        "No highlighted features found for 'iana' mode. This is a data or matching error.",
      );
      return;
    }
    logger.debug(
      { timezone, mode: "iana" },
      "Drawing highlighted features for 'iana' mode",
    );

    for (const highlightedFeature of highlightedData.features) {
      ctx.beginPath();
      pathGen(highlightedFeature as GeoPermissibleObjects);
      ctx.fillStyle = getColor(colors, "highlightFill");
      ctx.fill();
      ctx.strokeStyle = getColor(colors, "highlightStroke");
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // ── ISO8601 Mode (Merged timezone boundaries) ─────────────────────────────
  // Draw merged shape without internal country lines for cleaner visualization
  if (showTZBoundaries === TZ_BOUNDARY_MODES.ISO8601) {
    if (!highlightedData?.merged) {
      logger.error(
        { timezone, mode: "iso8601" },
        "No merged geometry found for 'iso8601' mode. This is a data or matching error.",
      );
      return;
    }
    logger.debug(
      { timezone, mode: "iso8601" },
      "Drawing merged boundary feature",
    );

    // Expect merged to be a FeatureCollection: [mergedIana, nauticBand]
    const mc = highlightedData.merged as FeatureCollection;
    const mergedFeatures: Feature[] = mc?.features ?? [];
    const mergedIana = mergedFeatures[0];
    const nauticBand = mergedFeatures[1];

    // Compose highlight into a single painted image to avoid visible
    // seam/overlap between nautic band and merged IANA geometry. We render
    // into an offscreen canvas, perform subtraction of exclusions there,
    // then blit the result to the main context in a single draw call.
    const canMakeOffscreen = typeof document !== "undefined" && ctx?.canvas;
    if (canMakeOffscreen) {
      try {
        const off = document.createElement("canvas");
        off.width = ctx.canvas.width;
        off.height = ctx.canvas.height;
        const offCtx = off.getContext("2d");
        if (offCtx) {
          const offPath = geoPath(projection, offCtx);

          // Draw nautic band + merged IANA into a single path so overlaps
          // are filled only once (no double-painted areas).
          offCtx.beginPath();
          if (nauticBand) offPath(nauticBand as GeoPermissibleObjects);
          if (mergedIana) offPath(mergedIana as GeoPermissibleObjects);
          offCtx.fillStyle = getColor(colors, "highlightFill");
          offCtx.fill();
          offCtx.strokeStyle = getColor(colors, "highlightStroke");
          offCtx.lineWidth = 1.2;
          offCtx.stroke();

          // Subtract exclusions *after* filling both shapes so they are
          // removed from the combined highlight, producing a single merged
          // painted area.
          if (highlightedData.exclusions?.length) {
            offCtx.globalCompositeOperation = "destination-out";
            for (const ex of highlightedData.exclusions) {
              offCtx.beginPath();
              offPath(ex as GeoPermissibleObjects);
              offCtx.fill();
            }
            offCtx.globalCompositeOperation = "source-over";
          }

          // Blit composed highlight as a single image
          ctx.drawImage(off, 0, 0);
          return;
        }
      } catch (err) {
        // Fall through to the immediate-draw behavior below if offscreen fails
        logger.debug(
          { err },
          "Offscreen composition failed, falling back to direct draw",
        );
      }
    }

    // Fallback: draw as before (nautic then subtract then merged IANA)
    if (nauticBand) {
      ctx.save();
      ctx.beginPath();
      pathGen(nauticBand as GeoPermissibleObjects);
      ctx.fillStyle = getColor(colors, "highlightFill");
      ctx.fill();

      if (highlightedData.exclusions?.length) {
        ctx.globalCompositeOperation = "destination-out";
        for (const ex of highlightedData.exclusions) {
          ctx.beginPath();
          pathGen(ex as GeoPermissibleObjects);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    if (mergedIana) {
      ctx.beginPath();
      pathGen(mergedIana as GeoPermissibleObjects);
      ctx.fillStyle = getColor(colors, "highlightFill");
      ctx.fill();
      ctx.strokeStyle = getColor(colors, "highlightStroke");
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}

/**
 * Computes highlighted features for a given timezone.
 *
 * This function performs sophisticated matching to find all geographic features
 * that should be highlighted for a selected timezone:
 *
 * 1. **Exact match**: Features with the same timezone identifier
 * 2. **Offset match**: Features with the same UTC offset (iso8601 mode only)
 * 3. **Containment fallback**: Features that contain the timezone's center point
 *
 * The result includes both individual features (for iana mode) and
 * merged geometry (for iso8601 mode).
 *
 * @param geoData - Geographic data containing timezone features and topology
 * @param timezone - Target timezone identifier to highlight
 * @param featureOffsets - Map of timezone IDs to their UTC offset minutes
 * @returns Highlighted data containing features and merged geometry, or null if no matches
 *
 * @example
 * ```typescript
 * const highlightedData = computeHighlightedData({
 *   geoData: loadedGeoData,
 *   timezone: "Europe/Paris",
 *   featureOffsets: timezoneOffsetMap
 * });
 *
 * if (highlightedData) {
 *   console.log(`Found ${highlightedData.features.length} matching features`);
 * }
 * ```
 */
export function computeHighlightedData({
  geoData,
  timezone,
  featureOffsets,
  mode,
}: {
  geoData: GeoData;
  timezone: string;
  featureOffsets: Map<string, number>;
  mode: TzBoundaryMode;
}): HighlightedData | null {
  // Validate required data: require explicit IANA or ISO8601 collections depending on mode
  if (!geoData?.topology || !timezone) {
    logger.error(
      {
        hasTopology: Boolean(geoData?.topology),
      },
      "Missing required geoData.topology or timezone",
    );
    return null;
  }

  // For robust ISO8601 behavior we always match against IANA features for
  // exact-id and offset-based grouping. The ISO8601 topology/iso polygons are
  // used only for rendering coverage (ocean inclusion) if desired; matching
  // must rely on IANA features which contain tzid properties.
  if (!geoData.ianaTimezones) {
    logger.error({ hasIana: false, mode }, "Missing geoData.ianaTimezones");
    return null;
  }

  // Get target UTC offset for offset-based matching
  const targetOffset = featureOffsets.get(timezone) ?? 0;

  // Step 1: Find IANA features by exact ID or UTC offset match
  const matchingFeatures = geoData.ianaTimezones.features.filter((f) => {
    const fTzid = f.properties?.tzid as string;
    if (!fTzid) return false;
    if (fTzid === timezone) return true;
    if (mode === TZ_BOUNDARY_MODES.ISO8601) {
      return featureOffsets.get(fTzid) === targetOffset;
    }
    return false;
  });

  // ── Step 2: Fallback to geographic containment ───────────────────────────────
  // If no features found by ID or offset, try finding which feature contains
  // the timezone's center coordinate point
  if (matchingFeatures.length === 0) {
    const [cLat, cLng] = getTimezoneCenter(timezone);

    // Skip containment check for invalid coordinates (except UTC)
    if (!(cLat === 0 && cLng === 0 && timezone !== "UTC")) {
      const point: [number, number] = [cLng, cLat];
      const found = geoData.ianaTimezones.features.find((f) =>
        geoContains(f, point),
      );
      if (found) matchingFeatures.push(found);
    }
  }

  // Return null if no matching features found at all
  if (matchingFeatures.length === 0) {
    logger.warn(
      { timezone, mode },
      "No matching timezone features found - returning null",
    );
    return null;
  }

  logger.debug(
    { timezone, mode, matchingFeaturesCount: matchingFeatures.length },
    "Found matching timezone features",
  );

  if (mode === TZ_BOUNDARY_MODES.IANA) {
    // IANA mode: return the timezone polygon(s) themselves (no country translation).
    // Fail fast if no matching timezone polygon was found.
    if (matchingFeatures.length === 0) {
      logger.warn(
        { timezone },
        "IANA mode: no matching IANA polygon features found",
      );
      return null;
    }
    return {
      features: matchingFeatures,
      merged: null,
    };
  }
  // For ISO8601 mode we want to return a merged geometry that is the union
  // of all IANA zones sharing the same offset plus the nautic band. We'll
  // find corresponding topology geometries in the `iana_timezones` topology
  // and merge them with topojson-client. If no topology is present, return
  // matching features only.
  if (mode === TZ_BOUNDARY_MODES.ISO8601) {
    if (!geoData.topology?.objects?.iana_timezones) {
      logger.error(
        { hasTopology: Boolean(geoData.topology) },
        "Missing topology for ISO8601 merged geometry",
      );
      return { features: matchingFeatures, merged: null };
    }

    const ianaObjs = geoData.topology.objects.iana_timezones as
      | GeometryCollection
      | undefined;
    if (!ianaObjs) {
      logger.error({ mode }, "Topology missing iana_timezones object");
      return { features: matchingFeatures, merged: null };
    }

    // Map matching tzids for quick lookup
    const matchSet = new Set(
      matchingFeatures.map((f) => (f.properties?.tzid as string) ?? ""),
    );

    const matchingGeoms = ianaObjs.geometries.filter(
      (g): g is Polygon | MultiPolygon => {
        if (!g || !("properties" in g) || !g.properties) return false;
        const props = g.properties as Record<string, unknown>;
        const gTz = (props.tzid as string) || "";
        if (!gTz) return false;
        return (
          matchSet.has(gTz) &&
          (g.type === "Polygon" || g.type === "MultiPolygon")
        );
      },
    );

    // Use GeoJSON `Geometry` to represent the merged result; topojson-client's
    // `merge` return types are sometimes declared as topojson-spec types which
    // don't match the GeoJSON types used elsewhere. Use a safe unknown cast.
    let mergedIanaGeom: Geometry | null = null;
    try {
      if (matchingGeoms.length > 0) {
        mergedIanaGeom = merge(geoData.topology, matchingGeoms);
      }
    } catch (err) {
      logger.error(
        { err },
        "topojson.merge failed for matching IANA geometries",
      );
      mergedIanaGeom = null;
    }

    // Build nautic band (same as NAUTIC mode)
    const centerLng = getUtcOffsetHour(timezone) * 15;
    const nauticBand = {
      type: "Polygon" as const,
      coordinates: [
        [
          [centerLng - 7.5, 89],
          [centerLng + 7.5, 89],
          [centerLng + 7.5, -89],
          [centerLng - 7.5, -89],
          [centerLng - 7.5, 89],
        ],
      ],
    };

    // Compose final merged geometry as a GeoJSON FeatureCollection containing
    // the merged IANA geometry (if present) and the nautic band. Renderer
    // can draw the collection to achieve the desired union effect.
    const mergedCollection: Feature[] = [];
    if (mergedIanaGeom) {
      mergedCollection.push({
        type: "Feature",
        properties: { role: "mergedIana" },
        geometry: mergedIanaGeom,
      });
    }
    mergedCollection.push({
      type: "Feature",
      properties: { role: "mergedIana" },
      geometry: nauticBand,
    });

    return {
      features: matchingFeatures,
      merged: { type: "FeatureCollection", features: mergedCollection },
    };
  }

  // For other modes that reach here return match-only
  return { features: matchingFeatures, merged: null };
}
