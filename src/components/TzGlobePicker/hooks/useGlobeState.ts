"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { GeoProjection } from "d3-geo";
import { normalizeRotation, shortestDelta } from "../utils/globeUtils";
import { getTimezoneCenter } from "../../../utils/timezoneCoordinates";
import {
  TILT,
  DRAG_SENSITIVITY,
  INERTIA_FRICTION,
  INERTIA_MIN_VELOCITY,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SENSITIVITY,
  FLY_DURATION,
  CLICK_THRESHOLD,
} from "../constants/globe.constants";
import type {
  Coordinate,
  Rotation,
  RenderFn,
  DragState,
} from "../types/globe.types";

export interface GlobeState {
  // Refs
  rotationRef: React.MutableRefObject<Rotation>;
  velocityRef: React.MutableRefObject<Coordinate>;
  zoomRef: React.MutableRefObject<number>;
  baseScaleRef: React.MutableRefObject<number>;
  dragStateRef: React.MutableRefObject<DragState | null>;
  hoveredTzRef: React.MutableRefObject<string | null>;
  isAnimatingRef: React.MutableRefObject<boolean>;
  inertiaFrameRef: React.MutableRefObject<number>;
  flyToFrameRef: React.MutableRefObject<number>;
  renderFrameRef: React.MutableRefObject<number>;

  // React state
  cursorStyle: "grab" | "pointer";
  setCursorStyle: (style: "grab" | "pointer") => void;

  // Actions
  flyTo: (targetTz: string, resetZoom?: boolean) => void;
  handleReset: () => void;
  startDrag: (eventX: number, eventY: number) => void;
  updateDrag: (
    eventX: number,
    eventY: number,
    eventDx: number,
    eventDy: number,
  ) => void;
  endDrag: () => { wasClick: boolean };
  applyInertia: (
    projection: GeoProjection,
    ctx: CanvasRenderingContext2D,
    renderFn: RenderFn,
  ) => void;
  handleWheel: (
    deltaY: number,
    projection: GeoProjection,
    ctx: CanvasRenderingContext2D,
    renderFn: RenderFn,
  ) => void;
  setHoveredTimezone: (tz: string | null) => void;
}

interface UseGlobeStateOptions {
  timezone: string | null | undefined;
  projectionRef: React.MutableRefObject<GeoProjection | null>;
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  renderRef: React.MutableRefObject<RenderFn>;
  logger: { error: (obj: Record<string, unknown>, msg: string) => void };
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}

export function useGlobeState(options: UseGlobeStateOptions): GlobeState {
  const {
    timezone: tz,
    projectionRef,
    ctxRef,
    renderRef,
    logger,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
    initialZoom = 1,
  } = options;

  // Core state refs
  const rotationRef = useRef<Rotation>([0, 0, TILT]);
  const velocityRef = useRef<Coordinate>([0, 0]);
  const zoomRef = useRef<number>(initialZoom);
  const baseScaleRef = useRef<number>(0);
  const dragStateRef = useRef<DragState | null>(null);
  const hoveredTzRef = useRef<string | null>(null);
  const isAnimatingRef = useRef<boolean>(false);

  // Animation frame refs
  const inertiaFrameRef = useRef<number>(0);
  const flyToFrameRef = useRef<number>(0);
  const renderFrameRef = useRef<number>(0);

  // Cleanup animation frames on unmount
  useEffect(() => {
    return (): void => {
      if (inertiaFrameRef.current) {
        cancelAnimationFrame(inertiaFrameRef.current);
      }
      if (flyToFrameRef.current) cancelAnimationFrame(flyToFrameRef.current);
      if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);
    };
  }, []);

  // React state for UI
  const [cursorStyle, setCursorStyle] = useState<"grab" | "pointer">("grab");

  // Cancel all animations
  const cancelAnimations = useCallback((): void => {
    if (inertiaFrameRef.current) {
      cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = 0;
    }
    if (flyToFrameRef.current) {
      cancelAnimationFrame(flyToFrameRef.current);
      flyToFrameRef.current = 0;
    }
    if (renderFrameRef.current) {
      cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = 0;
    }
    velocityRef.current = [0, 0];
  }, []);

  // Fly to a specific timezone
  const flyTo = useCallback(
    (targetTz: string, resetZoom = false): void => {
      cancelAnimations();
      isAnimatingRef.current = true;

      const projection = projectionRef.current;
      const ctx = ctxRef.current;
      if (!projection || !ctx) return;

      const [lat, lng] = getTimezoneCenter(targetTz);
      const targetRotation = normalizeRotation([-lng, -lat, TILT]);
      const startRotation = normalizeRotation([...rotationRef.current]);
      rotationRef.current = startRotation;
      projection.rotate(startRotation);

      const dLng = shortestDelta(startRotation[0], targetRotation[0]);
      const dLat = targetRotation[1] - startRotation[1];
      const dTilt = targetRotation[2] - startRotation[2];

      const startZoom = zoomRef.current;
      const targetZoom = resetZoom ? 1 : startZoom;
      const dZoom = targetZoom - startZoom;
      const baseScale = baseScaleRef.current;

      const startTime = performance.now();

      const animate = (now: number): void => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / FLY_DURATION, 1);
        // Ease-in-out cubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        rotationRef.current = [
          startRotation[0] + dLng * ease,
          startRotation[1] + dLat * ease,
          startRotation[2] + dTilt * ease,
        ];

        if (dZoom !== 0) {
          zoomRef.current = startZoom + dZoom * ease;
          projection.scale(baseScale * zoomRef.current);
        }

        projection.rotate(rotationRef.current);
        try {
          renderRef.current(projection, ctx);
        } catch (err) {
          logger.error(
            { err: err as Record<string, unknown> },
            "Globe render error during flyTo animation",
          );
        }

        if (t < 1) {
          flyToFrameRef.current = requestAnimationFrame(animate);
        } else {
          flyToFrameRef.current = 0;
          rotationRef.current = targetRotation;
          if (dZoom !== 0) {
            zoomRef.current = targetZoom;
            projection.scale(baseScale * targetZoom);
          }
          projection.rotate(targetRotation);
          try {
            renderRef.current(projection, ctx);
          } catch (err) {
            logger.error(
              { err: err as Record<string, unknown> },
              "Globe render error after flyTo animation",
            );
          }
          isAnimatingRef.current = false;
        }
      };

      flyToFrameRef.current = requestAnimationFrame(animate);
    },
    [cancelAnimations, projectionRef, ctxRef, renderRef, logger],
  );

  // Reset view to timezone center
  const handleReset = useCallback((): void => {
    if (tz) {
      flyTo(tz, true);
    } else {
      flyTo("UTC", true);
    }
  }, [tz, flyTo]);

  // Start drag operation
  const startDrag = useCallback(
    (eventX: number, eventY: number): void => {
      cancelAnimations();
      dragStateRef.current = {
        startRotation: normalizeRotation([...rotationRef.current]),
        startX: eventX,
        startY: eventY,
        totalDistance: 0,
      };
      hoveredTzRef.current = null;
    },
    [cancelAnimations],
  );

  // Update drag position
  const updateDrag = useCallback(
    (
      eventX: number,
      eventY: number,
      eventDx: number,
      eventDy: number,
    ): void => {
      const ds = dragStateRef.current;
      if (!ds) return;

      const zoomAdjustedSensitivity = DRAG_SENSITIVITY / zoomRef.current;
      const dx = (eventX - ds.startX) * zoomAdjustedSensitivity;
      const dy = (eventY - ds.startY) * zoomAdjustedSensitivity;

      ds.totalDistance += Math.abs(eventDx) + Math.abs(eventDy);

      const newRotation = normalizeRotation([
        ds.startRotation[0] + dx,
        ds.startRotation[1] - dy,
        ds.startRotation[2],
      ]);

      rotationRef.current = newRotation;
      // Use instantaneous per-frame deltas for inertia (not accumulated displacement)
      velocityRef.current = [
        eventDx * zoomAdjustedSensitivity * 0.3,
        eventDy * zoomAdjustedSensitivity * 0.3,
      ];

      const projection = projectionRef.current;
      if (projection) {
        projection.rotate(newRotation);
      }
    },
    [projectionRef],
  );

  // End drag operation
  const endDrag = useCallback((): { wasClick: boolean } => {
    const ds = dragStateRef.current;
    const wasClick = ds !== null && ds.totalDistance < CLICK_THRESHOLD;
    dragStateRef.current = null;
    return { wasClick };
  }, []);

  // Apply inertia animation
  const applyInertia = useCallback(
    (
      projection: GeoProjection,
      ctx: CanvasRenderingContext2D,
      renderFn: RenderFn,
    ): void => {
      const animate = (): void => {
        const [vx, vy] = velocityRef.current;

        if (
          Math.abs(vx) < INERTIA_MIN_VELOCITY &&
          Math.abs(vy) < INERTIA_MIN_VELOCITY
        ) {
          velocityRef.current = [0, 0];
          inertiaFrameRef.current = 0;
          return;
        }

        const [curLng, curLat, curTilt] = rotationRef.current;
        rotationRef.current = normalizeRotation([
          curLng + vx,
          curLat - vy,
          curTilt,
        ]);
        velocityRef.current = [vx * INERTIA_FRICTION, vy * INERTIA_FRICTION];

        projection.rotate(rotationRef.current);
        try {
          renderFn(projection, ctx);
        } catch {
          velocityRef.current = [0, 0];
          inertiaFrameRef.current = 0;
          return;
        }

        inertiaFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    },
    [],
  );

  // Handle wheel zoom
  const handleWheel = useCallback(
    (
      deltaY: number,
      projection: GeoProjection,
      ctx: CanvasRenderingContext2D,
      renderFn: RenderFn,
    ): void => {
      cancelAnimations();

      const delta = -deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.max(
        minZoom,
        Math.min(maxZoom, zoomRef.current * (1 + delta)),
      );
      zoomRef.current = newZoom;
      projection.scale(baseScaleRef.current * newZoom);

      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
      }
      renderFrameRef.current = requestAnimationFrame(() =>
        renderFn(projection, ctx),
      );
    },
    [cancelAnimations, minZoom, maxZoom],
  );

  // Set hovered timezone
  const setHoveredTimezone = useCallback((timezone: string | null): void => {
    hoveredTzRef.current = timezone;
  }, []);

  return {
    rotationRef,
    velocityRef,
    zoomRef,
    baseScaleRef,
    dragStateRef,
    hoveredTzRef,
    isAnimatingRef,
    inertiaFrameRef,
    flyToFrameRef,
    renderFrameRef,
    cursorStyle,
    setCursorStyle,
    flyTo,
    handleReset,
    startDrag,
    updateDrag,
    endDrag,
    applyInertia,
    handleWheel,
    setHoveredTimezone,
  };
}
