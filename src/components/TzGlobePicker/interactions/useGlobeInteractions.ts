"use client";

import React, { useRef, useCallback, useState } from "react";
import type { GeoProjection } from "d3-geo";
import { select } from "d3-selection";
import { drag, type D3DragEvent } from "d3-drag";
import type { MarkerEntry, GeoData } from "../types/globe.types";
import { hitTestMarker } from "../renderers/MarkerRenderer";
import { HIT_RADIUS } from "../constants/globe.constants";
import type { GlobeState } from "../hooks/useGlobeState";
import { buildLogger } from "../../../logger/client";

const logger = buildLogger("globe-interactions");

/**
 * Props for the useGlobeInteractions hook
 */
interface UseGlobeInteractionsProps {
  /** Reference to the canvas element */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Reference to the D3 geo projection */
  projectionRef: React.RefObject<GeoProjection>;
  /** Reference to the canvas 2D rendering context */
  ctxRef: React.RefObject<CanvasRenderingContext2D>;
  /** Reference to the render function */
  renderRef: React.RefObject<
    (projection: GeoProjection, ctx: CanvasRenderingContext2D) => void
  >;
  /** Array of active timezone markers */
  activeMarkers: MarkerEntry[];
  /** Whether markers should be shown */
  effectiveShowMarkers: boolean;
  /** Whether tooltips should be displayed on hover */
  showTooltips: boolean;
  /** Globe state containing interaction handlers */
  globe: GlobeState;
  /** Optional callback when a timezone is selected */
  onSelect?: (timezone: string) => void;
  /** Geographic data for the globe */
  geoData: GeoData | null;
}

/**
 * State for tooltip display
 */
interface TooltipState {
  /** Timezone identifier being displayed, or null if no tooltip */
  timezone: string | null;
  /** Screen position of the tooltip */
  position: { x: number; y: number };
}

/**
 * Hook for managing globe interactions including drag, zoom, hover, and tooltips.
 *
 * This hook sets up event listeners for mouse interactions and manages:
 * - Dragging the globe with inertia
 * - Zooming with mouse wheel
 * - Hover detection on timezone markers
 * - Tooltip display and positioning
 * - Click selection of timezones
 *
 * @param props - Configuration props for interactions
 * @returns Object containing tooltip state and cursor style
 */
export function useGlobeInteractions({
  canvasRef,
  projectionRef,
  ctxRef,
  renderRef,
  activeMarkers,
  effectiveShowMarkers,
  showTooltips,
  globe,
  onSelect,
}: UseGlobeInteractionsProps): { tooltip: TooltipState; cursorStyle: string } {
  const [tooltip, setTooltip] = useState<TooltipState>({
    timezone: null,
    position: { x: 0, y: 0 },
  });

  const onSelectRef = useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const {
    velocityRef,
    zoomRef,
    dragStateRef,
    hoveredTzRef,
    inertiaFrameRef,
    flyToFrameRef,
    renderFrameRef,
    cursorStyle,
    setCursorStyle,
    flyTo,
    startDrag,
    updateDrag,
    endDrag,
    applyInertia,
    handleWheel,
  } = globe;

  /**
   * Mouse move handler for hover hit-testing and tooltip management
   *
   * Performs hit-testing on timezone markers to detect hover state,
   * updates cursor style, and manages tooltip display.
   *
   * @param event - Mouse move event
   */
  const handleMouseMove = useCallback(
    (event: MouseEvent): void => {
      try {
        const canvas = canvasRef.current;
        const projection = projectionRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !projection || !ctx) return;

        // Don't do hit-test during active drag or when markers are hidden
        if (dragStateRef.current || !effectiveShowMarkers) return;

        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        const hitResult = hitTestMarker(
          canvasX,
          canvasY,
          projection,
          activeMarkers,
          zoomRef.current,
          HIT_RADIUS,
        );
        const prevHovered = hoveredTzRef.current;

        if (hitResult.timezone !== prevHovered) {
          hoveredTzRef.current = hitResult.timezone;

          if (hitResult.timezone) {
            setCursorStyle("pointer");
            if (showTooltips) {
              setTooltip({
                timezone: hitResult.timezone,
                position: { x: event.clientX, y: event.clientY },
              });
            }
          } else {
            setCursorStyle("grab");
            setTooltip({ timezone: null, position: { x: 0, y: 0 } });
          }

          // Re-render to update marker highlight
          if (renderRef.current) {
            renderRef.current(projection, ctx);
          }
        } else if (hitResult.timezone && showTooltips) {
          // Update tooltip position while hovering same marker
          setTooltip((prev) => ({
            ...prev,
            position: { x: event.clientX, y: event.clientY },
          }));
        }
      } catch (error) {
        logger.error(
          { error, eventX: event.clientX, eventY: event.clientY },
          "Error in mouse move handler",
        );
      }
    },
    [
      activeMarkers,
      effectiveShowMarkers,
      showTooltips,
      dragStateRef,
      hoveredTzRef,
      setCursorStyle,
      zoomRef,
      canvasRef,
      projectionRef,
      ctxRef,
      renderRef,
    ],
  );

  /**
   * Mouse leave handler to clear hover state and hide tooltip
   */
  const handleMouseLeave = useCallback((): void => {
    const projection = projectionRef.current;
    const ctx = ctxRef.current;
    if (hoveredTzRef.current) {
      hoveredTzRef.current = null;
      setCursorStyle("grab");
      setTooltip({ timezone: null, position: { x: 0, y: 0 } });
      if (projection && ctx && renderRef.current) {
        renderRef.current(projection, ctx);
      }
    }
  }, [hoveredTzRef, setCursorStyle, projectionRef, ctxRef, renderRef]);

  /**
   * Setup drag and wheel interactions using D3 drag behavior
   *
   * Configures:
   * - Drag start: Cancels animations, starts drag state
   * - Drag: Updates globe rotation and renders
   * - Drag end: Handles clicks and applies inertia
   * - Wheel zoom: Handles mouse wheel zoom events
   */
  // Track canvas readiness to handle the race condition where canvas hasn't mounted yet
  const [canvasReady, setCanvasReady] = useState(false);

  // Detect when canvas becomes available - refs don't trigger re-renders when .current changes
  React.useEffect(() => {
    const MAX_WAIT_MS = 5000; // 5 second timeout
    const startTime = Date.now();

    if (canvasRef.current) {
      setCanvasReady(true);
    } else {
      // Poll for canvas availability with timeout to prevent infinite polling
      const intervalId = setInterval((): void => {
        if (canvasRef.current) {
          setCanvasReady(true);
          clearInterval(intervalId);
        } else if (Date.now() - startTime > MAX_WAIT_MS) {
          logger.warn(
            { waitTime: MAX_WAIT_MS },
            "Canvas not available after timeout - interactions may not work",
          );
          clearInterval(intervalId);
        }
      }, 50);
      return (): void => clearInterval(intervalId);
    }
  }, []);

  React.useEffect(() => {
    // Wait for canvas to be ready
    if (!canvasReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasSelection = select(canvas);

    // Apply drag behavior with proper typing
    const dragBehaviorTyped = drag<HTMLCanvasElement, unknown>()
      .on(
        "start",
        (event: D3DragEvent<HTMLCanvasElement, unknown, unknown>) => {
          if (inertiaFrameRef.current) {
            cancelAnimationFrame(inertiaFrameRef.current);
            inertiaFrameRef.current = 0;
          }
          if (flyToFrameRef.current) {
            cancelAnimationFrame(flyToFrameRef.current);
            flyToFrameRef.current = 0;
          }
          if (velocityRef) velocityRef.current = [0, 0];

          startDrag(event.x, event.y);

          if (hoveredTzRef.current) {
            hoveredTzRef.current = null;
            setTooltip({ timezone: null, position: { x: 0, y: 0 } });
          }
        },
      )
      .on("drag", (event: D3DragEvent<HTMLCanvasElement, unknown, unknown>) => {
        updateDrag(event.x, event.y, event.dx, event.dy);

        const proj = projectionRef.current;
        const ctx = ctxRef.current;
        if (!proj || !ctx) return;

        if (renderFrameRef.current) {
          cancelAnimationFrame(renderFrameRef.current);
        }
        renderFrameRef.current = requestAnimationFrame(() => {
          if (renderRef.current) {
            renderRef.current(proj, ctx);
          }
        });
      })
      .on("end", (event: D3DragEvent<HTMLCanvasElement, unknown, unknown>) => {
        const { wasClick } = endDrag();

        if (wasClick) {
          const sourceEvent = event.sourceEvent as MouseEvent;
          if (!(sourceEvent instanceof MouseEvent)) return;
          const rect = canvas.getBoundingClientRect();
          const canvasX = sourceEvent.clientX - rect.left;
          const canvasY = sourceEvent.clientY - rect.top;
          const projection = projectionRef.current;
          if (projection) {
            const hitResult = hitTestMarker(
              canvasX,
              canvasY,
              projection,
              activeMarkers,
              zoomRef.current,
              HIT_RADIUS,
            );

            if (hitResult.timezone) {
              onSelectRef.current?.(hitResult.timezone);
              flyTo(hitResult.timezone);
              return;
            }
          }
        }

        if (projectionRef.current && ctxRef.current && renderRef.current) {
          applyInertia(
            projectionRef.current,
            ctxRef.current,
            renderRef.current,
          );
        }
      });

    canvasSelection.call(dragBehaviorTyped);

    /**
     * Wheel event handler for zoom functionality
     *
     * @param event - Wheel event
     */
    const onWheel = (event: WheelEvent): void => {
      try {
        const rect = canvas.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          return;
        }
        event.preventDefault();

        if (!projectionRef.current || !ctxRef.current || !renderRef.current) {
          return;
        }
        handleWheel(
          event.deltaY,
          projectionRef.current,
          ctxRef.current,
          renderRef.current,
        );
      } catch (error) {
        logger.error({ error, deltaY: event.deltaY }, "Error in wheel handler");
      }
    };

    // Event listeners setup
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    /**
     * Cleanup function to remove event listeners and cancel animations
     */
    return (): void => {
      if (inertiaFrameRef.current) {
        cancelAnimationFrame(inertiaFrameRef.current);
      }
      if (flyToFrameRef.current) cancelAnimationFrame(flyToFrameRef.current);
      if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);
      canvasSelection.on(".drag", null);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [
    canvasReady,
    handleMouseMove,
    handleMouseLeave,
    handleWheel,
    activeMarkers,
    startDrag,
    updateDrag,
    endDrag,
    applyInertia,
    flyTo,
    inertiaFrameRef,
    flyToFrameRef,
    renderFrameRef,
    velocityRef,
    hoveredTzRef,
    projectionRef,
    ctxRef,
    renderRef,
    zoomRef,
    canvasRef,
  ]);

  /**
   * Returns the current tooltip state and cursor style
   */
  return {
    tooltip,
    cursorStyle,
  };
}
