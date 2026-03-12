import { useState, useEffect, useMemo } from "react";
import { buildLogger } from "../../../logger/client";
import type { GeoData } from "../types/globe.types";
import {
  convertToStandardTopology,
  extractFeatures,
} from "../utils/topologyConversion";

/**
 * Hook for loading and managing geographic data for the globe.
 *
 * Provides centralized state management for topology data including timezone
 * boundaries and optional country boundaries. Handles dynamic loading with
 * error states and loading indicators.
 *
 * @returns Object containing geo data, loading state, and error state
 * @returns {GeoData | null} geoData - Loaded geographic data or null if not loaded
 * @returns {boolean} isLoading - Whether data is currently being loaded
 * @returns {Error | null} error - Any error that occurred during loading
 *
 * @example
 * ```typescript
 * const { geoData, isLoading, error } = useGeoData();
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (geoData) return <GlobeComponent data={geoData} />;
 * ```
 */
export function useGeoData(): {
  geoData: GeoData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const logger = useMemo(() => buildLogger("useGeoData"), []);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBundledData = async (): Promise<void> => {
      if (geoData) {
        logger.info({}, "geoData already loaded, skipping reload");
        return;
      }

      setError(null);
      logger.info({}, "Starting bundled globe data load");

      try {
        if (!isMounted) return;

        // Import JSON data dynamically inside useEffect
        const globeDataRawModule =
          await import("../../../data/globe-data.json");
        const globeDataRaw = globeDataRawModule.default;

        // Convert generated topology to standard Topology type
        const topology = convertToStandardTopology(globeDataRaw);

        // Extract features using utility function
        const timezones = extractFeatures(topology, "timezones");
        if (!timezones) {
          logger.error({}, "Failed to extract timezone features from topology");
          throw new Error("Failed to extract timezone features from topology");
        }

        // Parse countries (optional context)
        const countries = extractFeatures(topology, "countries");

        logger.info(
          {
            hasCountries: Boolean(countries),
            hasTimezones: Boolean(timezones),
          },
          "Extracted features from topology",
        );
        if (!isMounted) return;
        setGeoData({ timezones, countries, topology });
        logger.info(
          { component: "useGeoData" },
          "Successfully loaded bundled globe data",
        );
      } catch (loadError: unknown) {
        if (!isMounted) return;
        const dataError =
          loadError instanceof Error ? loadError : new Error(String(loadError));
        setError(dataError);
        logger.error(
          { err: dataError, component: "useGeoData" },
          "Failed to load bundled globe data",
        );
      } finally {
        if (isMounted) setIsLoading(false);
        logger.info({}, "Finished bundled globe data load");
      }
    };

    loadBundledData().catch(() => {});
    return (): void => {
      isMounted = false;
    };
  }, [logger, geoData]);

  return { geoData, isLoading, error };
}
