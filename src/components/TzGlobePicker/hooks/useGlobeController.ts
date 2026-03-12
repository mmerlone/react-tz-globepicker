import { useMemo, useRef, isValidElement } from "react";
import type { GeoProjection } from "d3-geo";

import { buildLogger } from "../../../logger/client";
import { CANONICAL_MARKERS } from "../../../utils/timezoneMarkers";

import { useGeoData } from "../data";
import { useGlobeInteractions } from "../interactions";
import { useGlobeState, useComputedGlobeData, useGlobeSystem } from ".";

import type {
  TzGlobePickerProps,
  RenderFn,
  MarkerEntry,
  CachedNight,
  GeoData,
} from "../types/globe.types";
import { COLORS, MIN_ZOOM, MAX_ZOOM } from "../constants/globe.constants";
import type { WebGLRendererProgram } from "../renderers/WebGLPenumbraRenderer";

export interface GlobeControllerState {
  size: number;
  cursorStyle: string;
  canvasBackgroundStyle: React.CSSProperties["backgroundColor"];
  isLoadingGeoData: boolean;
  geoData: GeoData | null;
  error: Error | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  tooltip: {
    timezone: string | null;
    position: { x: number; y: number };
  };
  handleReset: () => void;
  showTooltips: boolean;
}

/**
 * Controller hook that orchestrates all globe state, data loading, system initialization,
 * and user interactions.
 */
export function useGlobeController(
  props: TzGlobePickerProps,
): GlobeControllerState {
  const {
    timezone: tzProp,
    size = 250,
    onSelect,
    showMarkers = false,
    showTooltips = false,
    showTZBoundaries = "none",
    background,
    showCountryBorders = false,
    markers,
    zoomMarkers = false,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
    initialZoom = 1,
    colors: colorsProp,
  } = props;

  // ── Core State & Refs ─────────────────────────────────────────────
  const logger = useMemo(() => buildLogger("GlobeController"), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projectionRef = useRef<GeoProjection | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const webglRendererRef = useRef<WebGLRendererProgram | null>(null);
  const renderRef = useRef<RenderFn>(() => {});

  // ── Data Loading & Resolution ────────────────────────────────────────
  const { geoData, isLoading: isLoadingGeoData, error } = useGeoData();
  const tz = tzProp ?? "UTC";

  // ── Color Configuration ─────────────────────────────────────────────
  const colors = useMemo(() => ({ ...COLORS, ...colorsProp }), [colorsProp]);

  // ── Performance Optimization ───────────────────────────────────────────
  const cachedNightRef = useRef<CachedNight>({ minute: -1, center: null });

  // ── Globe State Management ────────────────────────────────────────────
  const globe = useGlobeState({
    timezone: tz,
    projectionRef,
    ctxRef,
    renderRef,
    logger,
    minZoom,
    maxZoom,
    initialZoom,
  });

  // ── Marker Configuration Logic ─────────────────────────────────────────
  const effectiveShowMarkers = markers?.length ? true : showMarkers;
  const activeMarkers = useMemo((): MarkerEntry[] => {
    if (markers?.length) return markers;
    return CANONICAL_MARKERS;
  }, [markers]);

  // ── Computed Geographic Data ──────────────────────────────────────────────
  const { highlightedData } = useComputedGlobeData({
    geoData,
    timezone: tz,
    showTZBoundaries,
    logger,
  });

  // ── Interaction Setup ────────────────────────────────────────────────
  const { tooltip, cursorStyle } = useGlobeInteractions({
    canvasRef,
    projectionRef,
    ctxRef,
    renderRef,
    activeMarkers,
    effectiveShowMarkers,
    showTooltips,
    globe,
    onSelect,
    geoData,
  });

  // ── System Initialization & Rendering ──────────────────────────────────
  useGlobeSystem({
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
    timezone: tz,
    showTZBoundaries,
    highlightedData,
    activeMarkers,
    tooltipTimezone: tooltip.timezone,
    effectiveShowMarkers,
    zoomMarkers,
    logger,
  });

  // ── Canvas Background Configuration ───────────────────────────────────────
  const canvasBackgroundStyle = useMemo(() => {
    if (isValidElement(background)) return "transparent";
    if (background === null) return "transparent";
    if (typeof background === "string") return background;
    return "transparent";
  }, [background]);

  return {
    // Props needed for rendering outer containers
    size,
    cursorStyle,
    canvasBackgroundStyle,

    // Loading/Error states
    isLoadingGeoData,
    geoData,
    error,

    // Render refs
    canvasRef,

    // UI elements state
    tooltip,
    handleReset: globe.handleReset,
    showTooltips,
  };
}
