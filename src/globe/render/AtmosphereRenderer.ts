import {
  geoPath,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import { getColor } from "../utils/globeUtils";
import type { GlobePalette } from "../types/globe.types";

/**
 * Base atmosphere thickness as a fraction of the globe radius.
 * This makes the atmosphere scale proportionally with zoom.
 */
const ATMOSPHERE_THICKNESS_RATIO = 0.06;

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
 * The atmosphere thickness scales with the projection scale, so it
 * automatically adapts when the globe is zoomed in or out.
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
  // Current scale already includes zoom applied
  const currentScale = projection.scale();

  // Calculate atmosphere thickness as a percentage of current scale
  // This ensures it scales with zoom automatically
  const atmosphereThickness = currentScale * ATMOSPHERE_THICKNESS_RATIO;

  // Save original scale
  const originalScale = projection.scale();

  try {
    // Expand scale so the stroke extends beyond the globe edge
    projection.scale(originalScale + atmosphereThickness / 2);

    // Create path generator AFTER scale is set
    const pathGen = geoPath(projection, ctx);

    // Draw outer rim using sphere geometry
    ctx.beginPath();
    pathGen({ type: "Sphere" } as GeoPermissibleObjects);
    ctx.strokeStyle = getColor(colors, "rim");
    ctx.lineWidth = atmosphereThickness;
    ctx.stroke();
  } finally {
    // Restore original projection scale
    projection.scale(originalScale);
  }
}
