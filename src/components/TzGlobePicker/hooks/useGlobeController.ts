import { useMemo, useRef, useEffect, isValidElement } from "react";
import type { GeoProjection } from "d3-geo";

import { buildLogger } from "../../../logger/client";
import { CANONICAL_MARKERS } from "../../../utils/timezoneMarkers";

import { useGeoData } from "../data";
import { useGlobeInteractions } from "../interactions";
import { useGlobeState, useComputedGlobeData, useGlobeSystem } from ".";

import {
  type TzGlobePickerProps,
  type RenderFn,
  type MarkerEntry,
  type CachedNight,
  type GeoData,
  TZ_BOUNDARY_MODES,
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
 * Controller hook that orchestrates globe state, data loading, system
 * initialization, and user interactions.
 *
 * The hook wires together data loading (`useGeoData`), interaction handlers
 * (`useGlobeInteractions`), and the low-level globe state (`useGlobeState`),
 * and owns the `canvasRef` used for rendering.
 *
 * @param props - Props forwarded from the `TzGlobePicker` component
 * @returns GlobeControllerState - lightweight view-model used by the render layer
 * @remarks
 * - `canvasRef` is provided so callers can embed the canvas element into the DOM.
 * - The hook drives rendering via `useGlobeSystem` and will trigger re-renders
 *   when data, markers or UI state changes.
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
    showTZBoundaries = TZ_BOUNDARY_MODES.NONE,
    background,
    showCountryBorders = false,
    markers,
    zoomMarkers = false,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
    initialZoom = 1,
    zoom: externalZoom,
    onZoomChange,
    colors: colorsProp,
    flyToTrigger,
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
    externalZoom,
    onZoomChange,
  });

  // ── FlyTo Trigger ────────────────────────────────────────────────────────
  // Trigger flyTo when flyToTrigger prop changes
  useEffect(() => {
    if (flyToTrigger && globe.flyTo && tz) {
      globe.flyTo(tz, true);
    }
  }, [flyToTrigger, globe.flyTo, tz]);

  // ── Marker Configuration Logic ─────────────────────────────────────────
  // Determine whether a non-empty `markers` prop was provided. An empty
  // array is treated as "not provided" so the component can fallback to
  // canonical markers when `showMarkers` is true.
  const hasNonEmptyMarkers = Array.isArray(markers) && markers.length > 0;

  // Markers are shown when there are non-empty provided markers OR when
  // `showMarkers` is explicitly true.
  const effectiveShowMarkers = hasNonEmptyMarkers || showMarkers === true;

  // Resolve the active markers list:
  // - If a non-empty `markers` prop was provided, use it.
  // - Otherwise, if `showMarkers` is true, fallback to canonical markers.
  // - Otherwise return an empty array (no markers).
  const activeMarkers = useMemo((): MarkerEntry[] => {
    const providedMarkers = markers ?? [];
    if (hasNonEmptyMarkers) return providedMarkers;
    if (showMarkers) return CANONICAL_MARKERS;
    return [];
  }, [markers, showMarkers, hasNonEmptyMarkers]);

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
