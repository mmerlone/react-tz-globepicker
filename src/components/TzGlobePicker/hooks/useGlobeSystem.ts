import { useEffect, useCallback } from "react";
import {
  geoOrthographic,
  type GeoProjection,
  type GeoPermissibleObjects,
} from "d3-geo";

import {
  renderBaseLayers,
  renderBoundaries,
  renderMarkers,
  renderAtmosphere,
} from "../renderers";
import {
  createWebGLRenderer,
  disposeWebGLRenderer,
  type WebGLRendererProgram,
} from "../renderers/WebGLPenumbraRenderer";
import {
  type RenderFn,
  type MarkerEntry,
  type CachedNight,
  type GlobePalette,
  type GeoData,
  type TzBoundaryMode,
  TZ_BOUNDARY_MODES,
} from "../types/globe.types";
import type { HighlightedData } from "../renderers/BoundaryRenderer";
import type { GlobeState } from "./useGlobeState";
import { type buildLogger } from "../../../logger/client";

interface UseGlobeSystemOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  projectionRef: React.MutableRefObject<GeoProjection | null>;
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  webglRendererRef: React.MutableRefObject<WebGLRendererProgram | null>;
  renderRef: React.MutableRefObject<RenderFn>;
  cachedNightRef: React.MutableRefObject<CachedNight>;

  size: number;
  isLoadingGeoData: boolean;

  globe: GlobeState;

  geoData: GeoData | null;
  colors: GlobePalette;
  showCountryBorders: boolean;
  timezone: string | null;
  showTZBoundaries: TzBoundaryMode;
  highlightedData: HighlightedData | null;
  activeMarkers: MarkerEntry[];
  tooltipTimezone: string | null;
  effectiveShowMarkers: boolean;
  zoomMarkers: boolean;
  logger: ReturnType<typeof buildLogger>;
}

/**
 * Encapsulates the configuration of the D3 projection, HTML5 Canvas dimensions,
 * WebGL renderer setup, and the central `render()` function that paints all layers.
 */
/**
 * System hook that initializes the D3 projection, canvas sizing, optional
 * WebGL penumbra renderer and the central `render` function used by the
 * component.
 *
 * Responsibilities:
 * - Configure canvas size and device-pixel-ratio backing store
 * - Create / dispose a WebGL-based penumbra renderer when available
 * - Populate `renderRef.current` with the composed render function
 *
 * Note: this hook owns the lifecycle of the WebGL renderer returned via
 * `createWebGLRenderer` and will dispose it on cleanup.
 */
export function useGlobeSystem({
  canvasRef,
  projectionRef,
  ctxRef,
  webglRendererRef,
  renderRef,
  cachedNightRef,
  size,
  isLoadingGeoData,
  globe,
  geoData,
  colors,
  showCountryBorders,
  timezone,
  showTZBoundaries,
  highlightedData,
  activeMarkers,
  tooltipTimezone,
  effectiveShowMarkers,
  zoomMarkers,
  logger,
}: UseGlobeSystemOptions): void {
  const { zoomRef, baseScaleRef } = globe;

  // ── Core Render Function ───────────────────────────────────────────────
  const render = useCallback(
    (projection: GeoProjection, ctx: CanvasRenderingContext2D): void => {
      if (!geoData) {
        logger.warn({}, "No geoData available for rendering");
        return;
      }

      logger.info(
        { hasCountries: Boolean(geoData.countries) },
        "Rendering globe",
      );

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

      // Clear the entire backing store (device pixels)
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Base layers (ocean, land, graticule, night shadow, country borders)
      renderBaseLayers({
        projection,
        ctx,
        canvas: ctx.canvas,
        geoData,
        colors,
        cachedNightRef,
        showCountryBorders,
        webglRenderer: webglRendererRef,
      });

      // 2. Timezone boundaries
      if (showTZBoundaries !== TZ_BOUNDARY_MODES.NONE) {
        renderBoundaries({
          projection,
          ctx,
          timezone: timezone ?? null,
          showTZBoundaries,
          colors,
          highlightedData,
        });
      }

      // 3. Markers

      if (effectiveShowMarkers) {
        renderMarkers({
          projection,
          ctx,
          activeMarkers,
          selectedTimezone: timezone ?? null,
          hoveredTimezone: tooltipTimezone,
          colors,
          size,
          zoom: zoomRef.current,
          zoomMarkers,
        });
      }

      // 4. Atmosphere (outer rim)
      renderAtmosphere({
        projection,
        ctx,
        colors,
      });

      ctx.restore();
    },
    [
      geoData,
      colors,
      showCountryBorders,
      timezone,
      showTZBoundaries,
      highlightedData,
      activeMarkers,
      tooltipTimezone,
      effectiveShowMarkers,
      size,
      zoomRef,
      zoomMarkers,
      baseScaleRef,
    ],
  );

  // ── Render Reference Management ───────────────────────────────────────────
  useEffect(() => {
    renderRef.current = render;

    // Trigger a render when colors change
    if (geoData && projectionRef.current && ctxRef.current) {
      renderRef.current(projectionRef.current, ctxRef.current);
    }
  }, [render, geoData, projectionRef, ctxRef]);

  // ── Canvas & Projection Initialization ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    logger.info({ size }, "Initializing canvas");

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      logger.error({ size }, "Failed to get 2D context");
      return;
    }

    logger.info({ size }, "Canvas 2D context initialized");

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;

    const webglRenderer = createWebGLRenderer(offscreenCanvas);
    if (webglRenderer) {
      webglRendererRef.current = webglRenderer;
      logger.info({ size }, "WebGL renderer initialized successfully");
    } else {
      logger.warn({ size }, "WebGL not available, using Canvas fallback");
    }

    const projection = geoOrthographic()
      .fitSize([size, size], { type: "Sphere" } as GeoPermissibleObjects)
      .precision(1);

    baseScaleRef.current = projection.scale();
    projection.scale(baseScaleRef.current * zoomRef.current);

    logger.info(
      {
        baseScale: baseScaleRef.current,
        finalScale: projection.scale(),
        zoom: zoomRef.current,
      },
      "Projection initialized",
    );

    projectionRef.current = projection;
    ctxRef.current = ctx;

    return (): void => {
      if (webglRendererRef.current) {
        disposeWebGLRenderer(webglRendererRef.current);
        webglRendererRef.current = null;
      }
    };
  }, [size, isLoadingGeoData]);

  // ── Initial Render Trigger ───────────────────────────────────────────────
  useEffect(() => {
    if (geoData && projectionRef.current && ctxRef.current) {
      renderRef.current(projectionRef.current, ctxRef.current);
    }
  }, [size, timezone, geoData, highlightedData]);

  // ── Re-render when marker visibility or marker set changes
  // Ensures toggling `showMarkers` immediately updates the canvas.
  useEffect(() => {
    if (geoData && projectionRef.current && ctxRef.current) {
      renderRef.current(projectionRef.current, ctxRef.current);
    }
  }, [effectiveShowMarkers, activeMarkers]);

  // Re-render when zoom marker scaling changes so marker sizes update live
  useEffect(() => {
    if (geoData && projectionRef.current && ctxRef.current) {
      renderRef.current(projectionRef.current, ctxRef.current);
    }
  }, [zoomMarkers]);

  // Re-render when country borders visibility changes so the border
  // stroke is drawn/removed immediately when toggled.
  useEffect(() => {
    if (geoData && projectionRef.current && ctxRef.current) {
      renderRef.current(projectionRef.current, ctxRef.current);
    }
  }, [showCountryBorders]);

  // ── Data Change Trigger ─────────────────────────────────────────────────
  useEffect(() => {
    if (geoData && projectionRef.current && ctxRef.current) {
      renderRef.current(projectionRef.current, ctxRef.current);
    }
  }, [geoData]);

  // ── Fly to timezone on prop change or initial data load ─────────────────
  // Triggers on page load (when geoData first arrives) and on external timezone
  // prop changes (e.g. control panel). Marker clicks are handled separately in
  // useGlobeInteractions but the double-flyTo is harmless (same target).
  const { flyTo } = globe;
  useEffect(() => {
    if (timezone && geoData && projectionRef.current && ctxRef.current) {
      flyTo(timezone);
    }
  }, [timezone, geoData, flyTo]);
}
