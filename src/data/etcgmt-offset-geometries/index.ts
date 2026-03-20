import type { FeatureCollection } from "geojson";

export type EtcGmtOffsetGeometryLoader = () => Promise<unknown>;

export const ETCGMT_OFFSET_KEYS = [
  "UTC+00:00",
  "UTC+01:00",
  "UTC+02:00",
  "UTC+03:00",
  "UTC+03:30",
  "UTC+04:00",
  "UTC+04:30",
  "UTC+05:00",
  "UTC+05:30",
  "UTC+05:45",
  "UTC+06:00",
  "UTC+06:30",
  "UTC+07:00",
  "UTC+08:00",
  "UTC+08:45",
  "UTC+09:00",
  "UTC+09:30",
  "UTC+10:00",
  "UTC+10:30",
  "UTC+11:00",
  "UTC+12:00",
  "UTC+12:45",
  "UTC+13:00",
  "UTC+14:00",
  "UTC-01:00",
  "UTC-02:00",
  "UTC-03:00",
  "UTC-03:30",
  "UTC-04:00",
  "UTC-05:00",
  "UTC-06:00",
  "UTC-07:00",
  "UTC-08:00",
  "UTC-09:00",
  "UTC-09:30",
  "UTC-10:00",
  "UTC-11:00",
  "UTC-12:00"
] as const;

export const ETCGMT_OFFSET_GEOMETRY_LOADERS: Record<
  string,
  EtcGmtOffsetGeometryLoader
> = {
  "UTC+00:00": () => import("./utc-plus-00-00.json"),
  "UTC+01:00": () => import("./utc-plus-01-00.json"),
  "UTC+02:00": () => import("./utc-plus-02-00.json"),
  "UTC+03:00": () => import("./utc-plus-03-00.json"),
  "UTC+03:30": () => import("./utc-plus-03-30.json"),
  "UTC+04:00": () => import("./utc-plus-04-00.json"),
  "UTC+04:30": () => import("./utc-plus-04-30.json"),
  "UTC+05:00": () => import("./utc-plus-05-00.json"),
  "UTC+05:30": () => import("./utc-plus-05-30.json"),
  "UTC+05:45": () => import("./utc-plus-05-45.json"),
  "UTC+06:00": () => import("./utc-plus-06-00.json"),
  "UTC+06:30": () => import("./utc-plus-06-30.json"),
  "UTC+07:00": () => import("./utc-plus-07-00.json"),
  "UTC+08:00": () => import("./utc-plus-08-00.json"),
  "UTC+08:45": () => import("./utc-plus-08-45.json"),
  "UTC+09:00": () => import("./utc-plus-09-00.json"),
  "UTC+09:30": () => import("./utc-plus-09-30.json"),
  "UTC+10:00": () => import("./utc-plus-10-00.json"),
  "UTC+10:30": () => import("./utc-plus-10-30.json"),
  "UTC+11:00": () => import("./utc-plus-11-00.json"),
  "UTC+12:00": () => import("./utc-plus-12-00.json"),
  "UTC+12:45": () => import("./utc-plus-12-45.json"),
  "UTC+13:00": () => import("./utc-plus-13-00.json"),
  "UTC+14:00": () => import("./utc-plus-14-00.json"),
  "UTC-01:00": () => import("./utc-minus-01-00.json"),
  "UTC-02:00": () => import("./utc-minus-02-00.json"),
  "UTC-03:00": () => import("./utc-minus-03-00.json"),
  "UTC-03:30": () => import("./utc-minus-03-30.json"),
  "UTC-04:00": () => import("./utc-minus-04-00.json"),
  "UTC-05:00": () => import("./utc-minus-05-00.json"),
  "UTC-06:00": () => import("./utc-minus-06-00.json"),
  "UTC-07:00": () => import("./utc-minus-07-00.json"),
  "UTC-08:00": () => import("./utc-minus-08-00.json"),
  "UTC-09:00": () => import("./utc-minus-09-00.json"),
  "UTC-09:30": () => import("./utc-minus-09-30.json"),
  "UTC-10:00": () => import("./utc-minus-10-00.json"),
  "UTC-11:00": () => import("./utc-minus-11-00.json"),
  "UTC-12:00": () => import("./utc-minus-12-00.json"),
};

function isFeatureCollection(value: unknown): value is FeatureCollection {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "FeatureCollection" &&
    Array.isArray(candidate.features)
  );
}

export async function loadEtcGmtOffsetGeometry(
  offsetKey: string,
): Promise<FeatureCollection | null> {
  const loader = ETCGMT_OFFSET_GEOMETRY_LOADERS[offsetKey];
  if (!loader) {
    return null;
  }

  const loadedModule = await loader();
  if (
    typeof loadedModule === "object" &&
    loadedModule !== null &&
    "default" in loadedModule
  ) {
    const defaultExport = (loadedModule as { default: unknown }).default;
    if (isFeatureCollection(defaultExport)) {
      return defaultExport;
    }
  }

  return isFeatureCollection(loadedModule) ? loadedModule : null;
}
