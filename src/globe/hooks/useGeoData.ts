import { useState, useEffect, useMemo, useRef } from "react";
import type { FeatureCollection } from "geojson";
import { buildLogger } from "../../logger/client";
import {
  type GeoData,
  TZ_BOUNDARY_MODES,
  type TzBoundaryMode,
} from "../types/globe.types";
import { ETCGMT_OFFSET_KEYS } from "../../data/etcgmt-offset-geometries";
import { COMMON_TIMEZONES } from "../../constants";

interface UseGeoDataOptions {
  /**
   * The timezone boundary visualization mode.
   * Determines which additional data files to load:
   * - NONE: only core globe data (~2MB)
   * - NAUTIC: core + IANA mapping (~2MB + 12KB)
   * - IANA: core + selected timezone geometry on demand
   * - ETCGMT: core + IANA mapping + one selected offset geometry on demand
   */
  boundaryMode?: TzBoundaryMode;
  /** Active timezone used to resolve the ETC/GMT offset bucket on demand. */
  timezone?: string;
}

type BaseGeoData = Pick<GeoData, "countries" | "geographic_idl">;
type IanaGeometryLoaderModule = {
  loadIanaTimezoneGeometry: (
    timezone: string,
  ) => Promise<FeatureCollection | null>;
};
type EtcGmtGeometryLoaderModule = {
  loadEtcGmtOffsetGeometry: (
    offsetKey: string,
  ) => Promise<FeatureCollection | null>;
};

let baseGeoDataPromise: Promise<BaseGeoData> | null = null;
let etcgmtIanaToOffsetPromise: Promise<Record<string, string>> | null = null;
let ianaGeometryLoaderModulePromise: Promise<IanaGeometryLoaderModule> | null =
  null;
let etcgmtGeometryLoaderModulePromise: Promise<EtcGmtGeometryLoaderModule> | null =
  null;
const ianaTimezonePromiseCache = new Map<
  string,
  Promise<FeatureCollection | null>
>();
const etcgmtGeometryPromiseCache = new Map<
  string,
  Promise<FeatureCollection | null>
>();

function isFeatureCollection(value: unknown): value is FeatureCollection {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    features?: unknown;
    type?: unknown;
  };
  return (
    candidate.type === "FeatureCollection" && Array.isArray(candidate.features)
  );
}

async function loadBaseGeoData(): Promise<BaseGeoData> {
  baseGeoDataPromise ??= (async (): Promise<BaseGeoData> => {
    const [countriesModule, geographicIdlModule] = await Promise.all([
      import("../../data/globe-countries.json"),
      import("../../data/geographic-idl.json"),
    ]);
    const countries = countriesModule.default as unknown;
    const geographicIdl = geographicIdlModule.default as unknown;

    if (!isFeatureCollection(countries)) {
      throw new Error("Invalid countries feature collection");
    }
    if (!isFeatureCollection(geographicIdl)) {
      throw new Error("Invalid geographic IDL feature collection");
    }

    return {
      countries,
      geographic_idl: geographicIdl,
    };
  })();

  return baseGeoDataPromise;
}

async function loadIanaGeometryForTimezone(
  timezone: string,
): Promise<FeatureCollection | null> {
  const cachedPromise = ianaTimezonePromiseCache.get(timezone);
  if (cachedPromise) {
    return cachedPromise;
  }

  ianaGeometryLoaderModulePromise ??= import("../../data/iana-timezones");
  const geometryPromise = ianaGeometryLoaderModulePromise.then(
    (loaderModule): Promise<FeatureCollection | null> =>
      loaderModule.loadIanaTimezoneGeometry(timezone),
  );
  ianaTimezonePromiseCache.set(timezone, geometryPromise);
  return geometryPromise;
}

async function loadEtcgmtIanaToOffset(): Promise<Record<string, string>> {
  etcgmtIanaToOffsetPromise ??= (async (): Promise<Record<string, string>> => {
    const mapModule = await import("../../data/etcgmt-iana-to-offset.json");
    return mapModule.default as Record<string, string>;
  })();

  return etcgmtIanaToOffsetPromise;
}

async function loadEtcgmtGeometryForOffset(
  offsetKey: string,
): Promise<FeatureCollection | null> {
  const cachedPromise = etcgmtGeometryPromiseCache.get(offsetKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  etcgmtGeometryLoaderModulePromise ??=
    import("../../data/etcgmt-offset-geometries");
  const geometryPromise = etcgmtGeometryLoaderModulePromise.then(
    (loaderModule): Promise<FeatureCollection | null> =>
      loaderModule.loadEtcGmtOffsetGeometry(offsetKey),
  );
  etcgmtGeometryPromiseCache.set(offsetKey, geometryPromise);
  return geometryPromise;
}

/**
 * Hook for loading and managing geographic data for the globe.
 *
 * Provides centralized state management for the split geographic artifacts used
 * by the globe. Data files are loaded dynamically based on the boundary mode.
 *
 * @param options - Configuration options for data loading
 * @param {TzBoundaryMode} options.boundaryMode - The boundary visualization mode
 * @returns Object containing geo data, loading state, and error state
 */
export function useGeoData(options?: UseGeoDataOptions): {
  geoData: GeoData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const logger = useMemo(() => buildLogger("useGeoData"), []);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Determine which data to load based on boundary mode
  const boundaryMode = options?.boundaryMode ?? TZ_BOUNDARY_MODES.NONE;
  const timezone = options?.timezone ?? "UTC";
  const needsEtcgmtMapping =
    boundaryMode === TZ_BOUNDARY_MODES.NAUTIC ||
    boundaryMode === TZ_BOUNDARY_MODES.ETCGMT;
  const needsEtcgmtGeometries = boundaryMode === TZ_BOUNDARY_MODES.ETCGMT;
  const needsIanaTimezones = boundaryMode === TZ_BOUNDARY_MODES.IANA;

  useEffect(() => {
    let isMounted = true;
    const shouldShowLoading = geoData === null;

    const loadData = async (): Promise<void> => {
      if (shouldShowLoading) {
        setIsLoading(true);
      }
      setError(null);
      logger.info(
        { boundaryMode, needsEtcgmtMapping, needsEtcgmtGeometries, timezone },
        "Starting globe data load",
      );

      try {
        const baseGeoData = await loadBaseGeoData();
        if (!isMounted) return;

        let ianaTimezones: FeatureCollection | undefined;
        if (needsIanaTimezones) {
          try {
            const loadedIanaGeometry =
              await loadIanaGeometryForTimezone(timezone);
            if (loadedIanaGeometry) {
              ianaTimezones = loadedIanaGeometry;
            } else {
              logger.warn(
                { timezone },
                "No IANA geometry file found for timezone",
              );
            }
          } catch (e) {
            logger.error({ err: e }, "Failed to load IANA timezone boundaries");
            setError(new Error("Failed to load IANA timezone boundaries"));
            return;
          }
        }

        // Load ETC/GMT IANA mapping only for modes that need offset lookup.
        let etcgmtIanaToOffset: Record<string, string> | undefined;
        if (needsEtcgmtMapping) {
          try {
            etcgmtIanaToOffset = await loadEtcgmtIanaToOffset();
            logger.info(
              { mappings: Object.keys(etcgmtIanaToOffset).length },
              "Loaded ETC/GMT IANA->offset mapping",
            );
          } catch (e) {
            logger.error(
              { err: e },
              "Failed to load ETC/GMT IANA->offset mapping",
            );
            setError(new Error("Failed to load ETC/GMT IANA->offset mapping"));
            return;
          }
        }

        // Load only the selected ETC/GMT offset geometry for ETCGMT mode.
        let loadedOffsetKey: string | null = null;
        let loadedGeometry: FeatureCollection | null = null;
        if (needsEtcgmtGeometries) {
          try {
            loadedOffsetKey = etcgmtIanaToOffset?.[timezone] ?? null;
            if (loadedOffsetKey) {
              loadedGeometry =
                await loadEtcgmtGeometryForOffset(loadedOffsetKey);
              logger.info(
                {
                  offsetKey: loadedOffsetKey,
                  hasGeometry: Boolean(loadedGeometry),
                },
                "Loaded selected ETC/GMT offset geometry",
              );
            } else {
              logger.warn(
                { timezone },
                "No ETC/GMT offset mapping found for timezone",
              );
            }
          } catch (e) {
            logger.error(
              { err: e, timezone, offsetKey: loadedOffsetKey },
              "Failed to load selected ETC/GMT offset geometry",
            );
            setError(
              new Error("Failed to load selected ETC/GMT offset geometry"),
            );
            return;
          }
        }

        logger.info(
          {
            hasCountries: Boolean(baseGeoData.countries),
            hasIanaTimezones: Boolean(ianaTimezones),
            hasEtcgmtMapping: Boolean(etcgmtIanaToOffset),
            loadedOffsetKey,
            hasEtcgmtGeometry: Boolean(loadedGeometry),
          },
          "Loaded geographic artifacts",
        );

        if (!isMounted) return;

        setGeoData((previousGeoData): GeoData => {
          const previousGeometries = previousGeoData?.etcgmtOffsetGeometries;
          const nextGeometries =
            loadedOffsetKey && loadedGeometry
              ? {
                  ...(previousGeometries ?? {}),
                  [loadedOffsetKey]: loadedGeometry,
                }
              : previousGeometries;
          const nextIanaTimezones = needsIanaTimezones
            ? ianaTimezones
            : previousGeoData?.ianaTimezones;

          return {
            ...baseGeoData,
            ianaTimezones: nextIanaTimezones,
            etcgmtOffsetGeometries: nextGeometries,
            etcgmtIanaToOffset:
              etcgmtIanaToOffset ?? previousGeoData?.etcgmtIanaToOffset,
          };
        });
        logger.info(
          { component: "useGeoData" },
          "Successfully loaded globe data",
        );
      } catch (loadError: unknown) {
        if (!isMounted) return;
        const dataError =
          loadError instanceof Error ? loadError : new Error(String(loadError));
        setError(dataError);
        logger.error(
          { err: dataError, component: "useGeoData" },
          "Failed to load globe data",
        );
      } finally {
        if (isMounted && shouldShowLoading) {
          setIsLoading(false);
        }
        logger.info({}, "Finished globe data load");
      }
    };

    loadData().catch((e) => {
      logger.error({ err: e }, "Unexpected error in loadData");
    });
    return (): void => {
      isMounted = false;
    };
  }, [
    logger,
    boundaryMode,
    needsEtcgmtMapping,
    needsEtcgmtGeometries,
    needsIanaTimezones,
    timezone,
  ]);

  // Pre-load timezone boundary data after initial render to speed up zone selection.
  // This runs independently of the main loading effect and populates the geometry cache.
  // Track promises to allow cleanup on unmount.
  const preLoadPromisesRef = useRef<Promise<unknown>[]>([]);

  useEffect(() => {
    // Pre-load all ETC/GMT offset geometries for ETCGMT mode (only 38 offsets).
    // This makes zone selection nearly instant after initial load.
    if (boundaryMode === TZ_BOUNDARY_MODES.ETCGMT) {
      ETCGMT_OFFSET_KEYS.forEach((offsetKey) => {
        if (!etcgmtGeometryPromiseCache.has(offsetKey)) {
          // Track promise for cleanup
          const promise = loadEtcgmtGeometryForOffset(offsetKey)
            .catch((e) => {
              logger.warn(
                { err: e, offsetKey },
                "Failed to pre-load ETC/GMT offset geometry",
              );
            })
            .then(() => {
              // Remove from tracked promises once resolved
              preLoadPromisesRef.current = preLoadPromisesRef.current.filter(
                (p) => p !== promise,
              );
            });
          preLoadPromisesRef.current.push(promise);
        }
      });
    }

    // Pre-load common IANA timezones for IANA mode to speed up frequent zone selections.
    // We only pre-load a curated set of popular timezones to avoid loading all 400+ zones.
    if (boundaryMode === TZ_BOUNDARY_MODES.IANA) {
      COMMON_TIMEZONES.forEach((tz) => {
        if (!ianaTimezonePromiseCache.has(tz)) {
          // Track promise for cleanup
          const promise = loadIanaGeometryForTimezone(tz)
            .catch((e) => {
              logger.warn(
                { err: e, timezone: tz },
                "Failed to pre-load IANA timezone geometry",
              );
            })
            .then(() => {
              // Remove from tracked promises once resolved
              preLoadPromisesRef.current = preLoadPromisesRef.current.filter(
                (p) => p !== promise,
              );
            });
          preLoadPromisesRef.current.push(promise);
        }
      });
    }

    // Cleanup: wait for any in-flight pre-load promises on unmount
    return (): void => {
      // We don't cancel the requests (they're fire-and-forget for caching)
      // but we clear the ref to prevent memory leaks
      preLoadPromisesRef.current = [];
    };
  }, [boundaryMode, logger]);

  return { geoData, isLoading, error };
}
