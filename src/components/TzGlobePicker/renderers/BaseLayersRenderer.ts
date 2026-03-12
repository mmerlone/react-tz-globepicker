import {
  geoPath,
  geoCircle,
  geoRotation,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import {
  GRATICULE_DATA,
  TWILIGHT_OPACITY,
  NIGHT_COLOR_RGB,
  LINE_WIDTHS,
} from "../constants/globe.constants";
import {
  getSubsolarPoint,
  getColor,
  normalizeLongitude,
} from "../utils/globeUtils";
import type { CachedNight, GeoData, GlobePalette } from "../types/globe.types";
import {
  renderWebGLPenumbra,
  type WebGLRendererProgram,
} from "./WebGLPenumbraRenderer";

/**
 * Props for base layers rendering functionality.
 */
interface BaseLayersRendererProps {
  /** D3.js projection for coordinate transformation */
  projection: GeoProjection;
  /** Canvas 2D rendering context for drawing operations */
  ctx: CanvasRenderingContext2D;
  /** Canvas element for WebGL rendering */
  canvas: HTMLCanvasElement;
  /** Geographic data containing timezone and country boundaries */
  geoData: GeoData;
  /** Color palette for styling globe elements */
  colors: GlobePalette;
  /** Reference to cached night shadow data for performance optimization */
  cachedNightRef: React.MutableRefObject<CachedNight>;
  /** Whether to render country borders on the globe surface */
  showCountryBorders: boolean;
  /** WebGL renderer instance for penumbra */
  webglRenderer: React.MutableRefObject<WebGLRendererProgram | null>;
}

/**
 * Renders the base layers of the globe: ocean, land, graticule, night shadow, and rim.
 *
 * This function creates the foundational visual elements of the globe:
 * - **Ocean Sphere**: Full sphere filled with ocean color
 * - **Land Mass**: Continental shapes filled with land color (using country data)
 * - **Graticule**: Geographic coordinate grid lines
 * - **Night Shadow**: Dynamic shadow based on sun position with opacity gradients
 * - **Outer Rim**: Atmospheric glow effect around the globe edge
 *
 * The rendering follows a specific layer order to ensure proper visual hierarchy:
 * 1. Ocean (bottom layer)
 * 2. Land
 * 3. Graticule
 * 4. Night shadow
 * 5. Country borders (if enabled)
 * 6. Rim (top layer)
 *
 * @param props - Rendering configuration containing all necessary data and settings
 *
 * @example
 * ```typescript
 * renderBaseLayers({
 *   projection: orthographicProjection,
 *   ctx: canvasContext,
 *   geoData: timezoneData,
 *   colors: customPalette,
 *   cachedNightRef: nightRef,
 *   showCountryBorders: true
 * });
 * ```
 */
export function renderBaseLayers({
  projection,
  ctx,
  canvas,
  geoData,
  colors,
  cachedNightRef,
  showCountryBorders,
  webglRenderer,
}: BaseLayersRendererProps): void {
  const pathGen = geoPath(projection, ctx);

  const SHOW_PENUMBRA = true;

  // 1. Ocean Sphere - Fills entire globe with ocean color
  ctx.beginPath();
  pathGen({ type: "Sphere" } as GeoPermissibleObjects);
  ctx.fillStyle = getColor(colors, "ocean");
  ctx.fill();

  // 2. Land Mass - Fill only, using countries to avoid maritime TZ polygons
  if (geoData.countries) {
    ctx.beginPath();
    pathGen(geoData.countries as GeoPermissibleObjects);
    ctx.fillStyle = getColor(colors, "land");
    ctx.fill();
  }

  // 3. Graticule - Geographic coordinate grid
  ctx.beginPath();
  pathGen(GRATICULE_DATA);
  ctx.strokeStyle = getColor(colors, "graticule");
  ctx.lineWidth = LINE_WIDTHS.graticule;
  ctx.stroke();

  if (SHOW_PENUMBRA) {
    // 4. Penumbra (Atmospheric Night Shadow) - WebGL Lambertian lighting
    const nowMinute = Math.floor(Date.now() / 60_000);

    // Update cached sun direction if minute changed (performance optimization)
    if (cachedNightRef.current.minute !== nowMinute) {
      const subsolarPoint = getSubsolarPoint(); // [lng, lat]
      cachedNightRef.current = { minute: nowMinute, center: subsolarPoint };
    }

    // Ensure center is defined (fallback for edge cases)
    const sunCenter = cachedNightRef.current.center ?? getSubsolarPoint();

    // Render penumbra using WebGL if available, otherwise fallback to Canvas
    if (webglRenderer.current) {
      const renderer = webglRenderer.current;

      // Calculate sun direction in view space by applying the current projection rotation
      const rotator = geoRotation(projection.rotate());
      const [viewSunLng, viewSunLat] = rotator(sunCenter);

      // Convert to Cartesian view-space vector [x, y, z]
      // where Z+ is towards the viewer, X+ is right, Y+ is up
      const lngRad = (viewSunLng * Math.PI) / 180;
      const latRad = (viewSunLat * Math.PI) / 180;

      const vx = Math.cos(latRad) * Math.sin(lngRad);
      const vy = Math.sin(latRad);
      const vz = Math.cos(latRad) * Math.cos(lngRad);

      const viewSunDirection: [number, number, number] = [vx, vy, vz];

      // Render to the offscreen WebGL canvas
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
      renderWebGLPenumbra(
        renderer,
        renderer.canvas,
        projection.scale() * dpr,
        viewSunDirection,
        colors,
        TWILIGHT_OPACITY,
      );

      // Composite the WebGL result onto the main 2D context
      // We need to account for the scale because we scaled the ctx by DPR earlier
      // But the offscreen canvas is already at device pixel size (size * DPR)
      // So we draw it at [0,0] and it will fill the scaled context??
      // Wait, ctx is scaled by DPR. renderer.canvas.width is size * DPR.
      // drawImage(img, dx, dy, dw, dh)
      // If we draw it at [0,0, size, size], the DPR scale on ctx will make it size*DPR pixels.
      const size =
        canvas.width /
        (typeof window !== "undefined" ? window.devicePixelRatio : 1);
      ctx.drawImage(renderer.canvas, 0, 0, size, size);
    } else {
      // Fallback: Simple Canvas hemisphere (no gradient for performance)
      const [sunLng, sunLat] = getSubsolarPoint();
      const nightLng = normalizeLongitude(sunLng + 180);
      const nightCenter: [number, number] = [nightLng, -sunLat];

      const nightCircle = geoCircle().center(nightCenter).radius(90)();
      ctx.beginPath();
      pathGen(nightCircle as GeoPermissibleObjects);
      ctx.fillStyle = `rgba(${NIGHT_COLOR_RGB},${TWILIGHT_OPACITY})`;
      ctx.fill();
    }
  }

  // 5. Outer Rim (Atmospheric Glow) - Always visible per PRD
  ctx.beginPath();
  pathGen({ type: "Sphere" } as GeoPermissibleObjects);
  ctx.strokeStyle = getColor(colors, "rim");
  ctx.lineWidth = 2;
  ctx.stroke();

  // 6. Country Borders (Political) - Optional feature for geographic context
  if (showCountryBorders && geoData.countries) {
    ctx.beginPath();
    pathGen(geoData.countries as GeoPermissibleObjects);
    ctx.strokeStyle = getColor(colors, "border");
    ctx.lineWidth = LINE_WIDTHS.graticule;
    ctx.stroke();
  }
}
