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
  geoCentroid,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import { merge } from "topojson-client";
import type { Feature } from "geojson";
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
    logger.info(
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
    logger.info(
      { timezone, mode: "iso8601" },
      "Drawing merged boundary feature",
    );
    ctx.beginPath();
    pathGen(highlightedData.merged as GeoPermissibleObjects);
    ctx.fillStyle = getColor(colors, "highlightFill");
    ctx.fill();
    ctx.strokeStyle = getColor(colors, "highlightStroke");
    ctx.lineWidth = 1.2;
    ctx.stroke();
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
  // Validate required data
  if (!geoData?.timezones || !geoData?.topology || !timezone) return null;

  // Get target UTC offset for offset-based matching
  const targetOffset = featureOffsets.get(timezone) ?? 0;

  // ── Step 1: Find features by exact ID or UTC offset match ───────────────────
  const matchingFeatures = geoData.timezones.features.filter((f) => {
    const fTzid = f.properties?.tzid as string;
    if (!fTzid) return false;

    // Priority 1: Exact timezone identifier match
    if (fTzid === timezone) return true;

    // Priority 2: Same UTC offset (for similar timezones), iso8601 mode only.
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
      const found = geoData.timezones.features.find((f) =>
        geoContains(f, point),
      );
      if (found) matchingFeatures.push(found);
    }
  }

  // Return null if no matching features found at all
  if (matchingFeatures.length === 0) return null;

  if (mode === TZ_BOUNDARY_MODES.IANA) {
    if (!geoData.countries) return null;

    const matchingCountryFeatures = geoData.countries.features.filter((f) => {
      const centroid = geoCentroid(f);
      if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) {
        return false;
      }

      return matchingFeatures.some((tzFeature) =>
        geoContains(tzFeature, centroid),
      );
    });

    return {
      features: matchingCountryFeatures,
      merged: null,
    };
  }

  // ── Step 3: Create merged geometry for iso8601 mode ───────────────────────
  const objects = geoData.topology.objects.timezones as GeometryCollection;

  // Filter geometries that match our criteria using type assertions
  const matchingGeoms = objects.geometries.filter(
    (g): g is Polygon | MultiPolygon => {
      // Type guard to check if geometry has properties
      if (!("properties" in g) || !g.properties) return false;

      const gProperties = g.properties as Record<string, unknown>;
      const gTzid = gProperties.tzid as string;
      if (!gTzid) return false;

      // Apply same matching logic as features (exact ID or offset match)
      const isMatch =
        gTzid === timezone ||
        (mode === TZ_BOUNDARY_MODES.ISO8601 &&
          featureOffsets.get(gTzid) === targetOffset);

      // Only include polygon geometries (skip points, lines, etc.)
      return isMatch && (g.type === "Polygon" || g.type === "MultiPolygon");
    },
  );

  // Return both individual features and merged geometry
  return {
    features: matchingFeatures,
    merged: merge(geoData.topology, matchingGeoms),
  };
}
