import type { GeoProjection } from "d3-geo";
import { LINE_WIDTHS } from "../constants/globe.constants";
import { isPointVisible } from "../utils/globeUtils";
import type {
  MarkerEntry,
  Coordinate,
  GlobePalette,
} from "../types/globe.types";
import { buildLogger } from "../../../logger/client";

const logger = buildLogger("marker-renderer");

/**
 * Configuration properties for rendering timezone markers on the globe.
 *
 * Defines all the necessary props for the marker rendering system,
 * including projection context, marker data, visual states, and styling.
 * Supports both interactive and static rendering modes.
 */
interface MarkerRendererProps {
  /** D3 geographic projection for coordinate transformation */
  projection: GeoProjection;
  /** Canvas 2D rendering context for drawing operations */
  ctx: CanvasRenderingContext2D;
  /** Array of timezone markers to be rendered */
  activeMarkers: MarkerEntry[];
  /** Currently selected timezone identifier for emphasis */
  selectedTimezone: string | null;
  /** Currently hovered timezone identifier for highlighting */
  hoveredTimezone: string | null;
  /** Color configuration for different marker states */
  colors: GlobePalette;
  /** Diameter of the globe in pixels for scaling calculations */
  size: number;
  /** Current zoom level for marker scaling */
  zoom: number;
  /** Whether markers should scale with zoom level */
  zoomMarkers: boolean;
}

/**
 * Renders timezone markers on the globe with interactive states.
 *
 * Handles rendering of timezone markers with different visual states:
 * - Default markers (standard appearance)
 * - Hovered markers (highlighted appearance)
 * - Selected markers (emphasized appearance)
 *
 * Supports zoom-based scaling and optional marker display.
 * Includes error handling for rendering failures.
 *
 * @param props - Rendering configuration and state
 * @param {GeoProjection} props.projection - D3 geographic projection for coordinate transformation
 * @param {CanvasRenderingContext2D} props.ctx - Canvas 2D rendering context
 * @param {MarkerEntry[]} props.activeMarkers - Array of timezone markers to render
 * @param {string | null} props.selectedTimezone - Currently selected timezone identifier
 * @param {string | null} props.hoveredTimezone - Currently hovered timezone identifier
 * @param {Record<string, string>} props.colors - Color configuration for different marker states
 * @param {number} props.size - Diameter of the globe in pixels for scaling calculations
 * @param {number} props.zoom - Current zoom level for marker scaling
 * @param {boolean} props.zoomMarkers - Whether markers should scale with zoom
 *
 * @example
 * ```typescript
 * renderMarkers({
 *   projection,
 *   ctx,
 *   activeMarkers: timezoneMarkers,
 *   selectedTimezone: 'America/New_York',
 *   hoveredTimezone: null,
 *   colors: theme.colors,
 *   size: 400,
 *   zoom: 1.5,
 *   zoomMarkers: true
 * });
 * ```
 */
export function renderMarkers({
  projection,
  ctx,
  activeMarkers,
  selectedTimezone,
  hoveredTimezone,
  colors,
  size,
  zoom,
  zoomMarkers,
}: MarkerRendererProps): void {
  try {
    const zoomScale = zoomMarkers ? zoom : 1;
    const markerRadius = Math.max(1.5, size * 0.006) * zoomScale;
    const selectedRadius = markerRadius * 2.2;
    const hoveredRadius = markerRadius * 2;

    // Always render markers - the consumer decides whether to call this function
    for (const { tz: markerTz, coords } of activeMarkers) {
      const isSelected = markerTz === selectedTimezone;
      const [lat, lng] = coords;
      const geoPoint: Coordinate = [lng, lat];

      if (!isPointVisible(projection, geoPoint)) continue;
      const projected = projection(geoPoint);
      if (!projected) continue;

      const [px, py] = projected;
      const isHovered = markerTz === hoveredTimezone;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(px, py, selectedRadius, 0, 2 * Math.PI);
        ctx.fillStyle = colors.selectedMarker;
        ctx.fill();
        ctx.strokeStyle = colors.selectedMarkerStroke;
        ctx.lineWidth = LINE_WIDTHS.markerSelected;
        ctx.stroke();
      } else if (isHovered) {
        ctx.beginPath();
        ctx.arc(px, py, hoveredRadius, 0, 2 * Math.PI);
        ctx.fillStyle = colors.hoveredMarker;
        ctx.fill();
        ctx.strokeStyle = colors.hoveredMarkerStroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, markerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = colors.defaultMarker;
        ctx.fill();
        ctx.strokeStyle = colors.defaultMarkerStroke;
        ctx.lineWidth = LINE_WIDTHS.graticule;
        ctx.stroke();
      }
    }
  } catch (error) {
    logger.error(
      { error, activeMarkersCount: activeMarkers.length },
      "Error rendering markers",
    );
  }
}

/**
 * Result of hit testing operation for marker selection.
 *
 * Contains the nearest timezone to a given canvas point and the
 * distance from that point. Used for both hover and click interactions.
 */
interface HitTestResult {
  /** The nearest timezone identifier or null if no marker was hit */
  timezone: string | null;
  /** Distance from the canvas point to the nearest marker in pixels */
  distance: number;
}

/**
 * Performs hit testing to find the nearest visible marker to a canvas point.
 *
 * Uses distance-based selection to determine which timezone marker is closest
 * to the clicked/hovered canvas coordinates. Only considers markers that
 * are visible on the current globe projection (front-facing).
 *
 * Includes error handling that falls back to safe defaults if
 * the hit testing fails.
 *
 * @param canvasX - X coordinate in canvas space
 * @param canvasY - Y coordinate in canvas space
 * @param projection - D3 geographic projection for coordinate transformation
 * @param activeMarkers - Array of timezone markers to test against
 * @param zoom - Current zoom level for scaling hit radius
 * @param hitRadius - Base hit radius in pixels for marker detection
 *
 * @returns Object containing the nearest timezone and distance
 * @returns {string | null} timezone - Nearest timezone identifier or null if no hit
 * @returns {number} distance - Distance to the nearest marker in pixels
 *
 * @example
 * ```typescript
 * const result = hitTestMarker(
 *   150, 200, // canvas coordinates
 *   projection,
 *   timezoneMarkers,
 *   1.5, // zoom level
 *   10 // hit radius
 * );
 * if (result.timezone) {
 *   console.log(`Nearest timezone: ${result.timezone}`);
 * }
 * ```
 */
export function hitTestMarker(
  canvasX: number,
  canvasY: number,
  projection: GeoProjection,
  activeMarkers: MarkerEntry[],
  zoom: number,
  hitRadius: number,
): HitTestResult {
  try {
    // Scale hit radius with zoom so zoomed-in markers are easier to click
    const scaledHitRadius = hitRadius * zoom;
    let bestTz: string | null = null;
    let bestDist = scaledHitRadius;

    for (const { tz: markerTz, coords } of activeMarkers) {
      const [lat, lng] = coords;
      const geoPoint: Coordinate = [lng, lat];

      // Skip back-hemisphere points
      if (!isPointVisible(projection, geoPoint)) continue;

      const projected = projection(geoPoint);
      if (!projected) continue;

      const dx = projected[0] - canvasX;
      const dy = projected[1] - canvasY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTz = markerTz;
      }
    }

    return { timezone: bestTz, distance: bestDist };
  } catch (error) {
    logger.error(
      { error, canvasX, canvasY, zoom },
      "Error during marker hit testing",
    );
    return { timezone: null, distance: hitRadius * zoom };
  }
}
