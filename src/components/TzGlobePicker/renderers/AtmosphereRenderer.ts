import {
  geoPath,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import { getColor } from "../utils/globeUtils";
import type { GlobePalette } from "../types/globe.types";

export const ATMOSPHERE_THICKNESS = 30;

/**
 * Props for atmosphere rendering functionality.
 */
interface AtmosphereRendererProps {
  /** D3.js projection for coordinate transformation */
  projection: GeoProjection;
  /** Canvas 2D rendering context for drawing operations */
  ctx: CanvasRenderingContext2D;
  /** Color palette for styling atmospheric elements */
  colors: GlobePalette;
}

/**
 * Renders atmospheric glow rim around the globe.
 *
 * Creates a subtle atmospheric effect by drawing a circular gradient
 * that simulates Earth's atmosphere at the edge of space.
 *
 * @param props - Rendering configuration containing projection, context, and colors
 *
 * @example
 * ```typescript
 * renderAtmosphere({
 *   projection: orthographicProjection,
 *   ctx: canvasContext,
 *   colors: { rim: '#001144' }
 * });
 * ```
 */
export function renderAtmosphere({
  projection,
  ctx,
  colors,
}: AtmosphereRendererProps): void {
  // Save original scale before modification
  const originalScale = projection.scale();

  // Expand scale so the stroke extends beyond the globe edge
  projection.scale(originalScale + ATMOSPHERE_THICKNESS / 2);

  // Create path generator AFTER scale is set
  const pathGen = geoPath(projection, ctx);

  // Draw outer rim using sphere geometry
  ctx.beginPath();
  pathGen({ type: "Sphere" } as GeoPermissibleObjects);
  ctx.strokeStyle = getColor(colors, "rim");
  ctx.lineWidth = ATMOSPHERE_THICKNESS;
  ctx.stroke();

  // Restore original projection scale
  projection.scale(originalScale);
}
