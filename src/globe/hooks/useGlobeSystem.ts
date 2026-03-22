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
} from "../render";

import {
  createWebGLRenderer,
  disposeWebGLRenderer,
  type WebGLRendererProgram,
} from "../render/WebGLPenumbraRenderer";
import {
  type RenderFn,
  type MarkerEntry,
  type CachedNight,
  type GlobePalette,
  type GeoData,
  type TzBoundaryMode,
  TZ_BOUNDARY_MODES,
} from "../types/globe.types";
import type { HighlightedData } from "../render/BoundaryRenderer";
import type { GlobeState } from "./useGlobeState";
import { type buildLogger } from "../../logger/client";

interface UseGlobeSystemOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  projectionRef: React.MutableRefObject<GeoProjection | null>;
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  webglRendererRef: React.MutableRefObject<WebGLRendererProgram | null>;
  renderRef: React.MutableRefObject<RenderFn>;
  cachedNightRef: React.MutableRefObject<CachedNight>;

  size: number;
  hasGeoData: boolean;

  globe: GlobeState;

  geoData: GeoData | null;
  colors: GlobePalette;
  showCountryBorders: boolean;
  showGeographic: boolean;
  timezone: string | null;
  showTZBoundaries: TzBoundaryMode;
  highlightedData: HighlightedData | null;
  activeMarkers: MarkerEntry[];
  tooltipTimezone: string | null;
  effectiveShowMarkers: boolean;
  zoomMarkers: boolean;
  logger: ReturnType<typeof buildLogger>;
  simulatedDate?: Date;
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
  hasGeoData,
  globe,
  geoData,
  colors,
  showCountryBorders,
  showGeographic,
  timezone,
  showTZBoundaries,
  highlightedData,
  activeMarkers,
  tooltipTimezone,
  effectiveShowMarkers,
  zoomMarkers,
  logger,
  simulatedDate,
}: UseGlobeSystemOptions): void {
  const { zoomRef, baseScaleRef } = globe;

  // ── Core Render Function ───────────────────────────────────────────────
  const render = useCallback((): void => {
    const projection = projectionRef.current;
    const ctx = ctxRef.current;
    if (!projection || !ctx || !geoData) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

    // Clear the entire backing store (device pixels)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Base layers (ocean, land, graticule, night shadow, country borders, geographic lines)
    renderBaseLayers({
      projection,
      ctx,
      canvas: ctx.canvas,
      geoData,
      colors,
      cachedNightRef,
      showCountryBorders,
      showGeographic,
      webglRenderer: webglRendererRef,
      simulatedDate,
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
      // Prefer build-time mapping when available to avoid runtime Intl calls.
      const selectedEtc: string | null =
        geoData?.etcgmtIanaToOffset?.[timezone as string] ?? null;
      renderMarkers({
        projection,
        ctx,
        activeMarkers,
        selectedTimezone: timezone ?? null,
        selectedEtcOffsetKey: selectedEtc,
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
  }, [
    geoData,
    colors,
    showCountryBorders,
    showGeographic,
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
    simulatedDate,
  ]);

  // ── Render Reference Management ───────────────────────────────────────────
  useEffect(() => {
    renderRef.current = render;

    // Trigger a render when dependencies change, UNLESS an animation/interaction loop is already owning the render sequence.
    if (geoData && projectionRef.current && ctxRef.current) {
      if (
        !globe.isAnimatingRef.current &&
        !globe.dragStateRef.current &&
        !globe.inertiaFrameRef.current
      ) {
        if (globe.renderFrameRef.current) {
          cancelAnimationFrame(globe.renderFrameRef.current);
        }
        globe.renderFrameRef.current = requestAnimationFrame(() => {
          renderRef.current();
        });
      }
    }
  }, [render, geoData, globe]);

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
  }, [size, hasGeoData]);

  // Redundant synchronous render effects removed; handled by Render Reference Management effect.

  // ── Fly to timezone on prop change or initial data load ─────────────────
  // Triggers on page load (when geoData first arrives) and on external timezone
  // prop changes (e.g. control panel or marker clicks via onSelect callback).
  // Note: Marker clicks only call onSelect, which updates the timezone prop,
  // and this effect handles the flyTo animation.
  const { flyTo } = globe;
  useEffect(() => {
    if (timezone && geoData && projectionRef.current && ctxRef.current) {
      // Defer flyTo animation until the required boundary shapes are loaded into state
      // This prevents the JS main-thread JSON parser from freezing the screen mid-spin
      if (showTZBoundaries === TZ_BOUNDARY_MODES.ETCGMT) {
        const requiredOffset = geoData.etcgmtIanaToOffset?.[timezone];
        if (
          requiredOffset &&
          !geoData.etcgmtOffsetGeometries?.[requiredOffset]
        ) {
          return;
        }
      }

      if (
        showTZBoundaries === TZ_BOUNDARY_MODES.IANA &&
        !geoData.ianaTimezones
      ) {
        return;
      }

      flyTo(timezone);
    }
  }, [timezone, geoData, flyTo, showTZBoundaries]);
}
