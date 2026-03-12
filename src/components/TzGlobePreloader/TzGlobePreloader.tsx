"use client";

import { useEffect } from "react";
import { buildLogger } from "../../logger/client";

/**
 * Lazy preloader component for TzGlobePicker.
 *
 * Preloads the TzGlobePicker component to improve perceived performance
 * when the component is first rendered.
 *
 * @param props - Component props (currently none)
 * @returns null (renders nothing)
 *
 * @example
 * ```tsx
 * // In your app's root or layout
 * <TzGlobePreloader />
 * ```
 */
export function TzGlobePreloader(): null {
  useEffect(() => {
    const logger = buildLogger("TzGlobePreloader");
    const startTime = performance.now();

    // Development timing
    if (process.env.NODE_ENV === "development") {
      logger.info(
        { op: "preload_start", startTime },
        "Starting preload of TzGlobePicker and bundled data",
      );
    }

    // Preload component only (data is bundled)
    const preloadPromises = [
      // Preload the heavy component using relative import
      import("../TzGlobePicker").catch((error) => {
        const errorMsg = "Failed to preload TzGlobePicker component";
        logger.error({ error, op: "preload_component_error" }, errorMsg);
        return null;
      }),
    ];

    // Wait for preload to complete (or fail)
    Promise.allSettled(preloadPromises).catch(() => {}).finally(() => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (process.env.NODE_ENV === "development") {
        logger.info(
          { op: "preload_complete", duration, startTime, endTime },
          "TzGlobePreloader completed",
        );
      }
    });
  }, []);

  return null;
}
