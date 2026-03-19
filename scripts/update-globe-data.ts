import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import * as topojsonServer from "topojson-server";
import * as topojsonClient from "topojson-client";
import * as topojsonSimplify from "topojson-simplify";
import { geoArea } from "d3-geo";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
  Position,
} from "geojson";
import type { Topology, Objects } from "topojson-specification";
import { safeJsonParse } from "@/utils/json";
import {
  getTimezoneCenter,
  TIMEZONE_COORDINATES,
} from "../src/utils/timezoneCoordinates";

// Debug entry marker to confirm script execution when run via `pnpm run gen:globe`
console.log("[update-globe-data] entry");

// Handle process.exit properly for Node.js environment
const processExit = (code: number): never => {
  process.exit(code);
};

/** Directory where generated timezone-related files live (src/data) */
const TZ_OUTPUT_DIR = path.join(process.cwd(), "src", "data");
const ETCGMT_OUTPUT_DIR = path.join(TZ_OUTPUT_DIR, "etcgmt-offset-geometries");
const IANA_TIMEZONES_OUTPUT_DIR = path.join(TZ_OUTPUT_DIR, "iana-timezones");
const CANONICAL_MARKERS_OUTPUT_PATH = path.join(
  TZ_OUTPUT_DIR,
  "canonical-markers.ts",
);
const COUNTRIES_OUTPUT_PATH = path.join(TZ_OUTPUT_DIR, "globe-countries.json");
const GEOGRAPHIC_IDL_OUTPUT_PATH = path.join(
  TZ_OUTPUT_DIR,
  "geographic-idl.json",
);

/** Directory where raw downloaded files are cached (src/data/raw) */
const RAW_DATA_DIR = path.join(TZ_OUTPUT_DIR, "raw");

/**
 * Ensure the raw data directory exists
 */
function ensureRawDataDir(): void {
  if (!fs.existsSync(RAW_DATA_DIR)) {
    fs.mkdirSync(RAW_DATA_DIR, { recursive: true });
  }
}

/**
 * Replace a generated directory with a clean copy.
 */
function resetGeneratedDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Get the cache file path for a URL
 */
function getCacheFilePath(url: string): string {
  // Create a safe filename from the URL
  const urlObj = new URL(url);
  const filename = urlObj.pathname.split("/").pop() || "unknown";
  return path.join(RAW_DATA_DIR, filename);
}

/**
 * Check if a cached file exists
 */
function getCachedFile(url: string): Buffer | null {
  const cachePath = getCacheFilePath(url);
  if (fs.existsSync(cachePath)) {
    console.log(`  Using cached: ${cachePath}`);
    return fs.readFileSync(cachePath);
  }
  return null;
}

/**
 * Save content to cache
 */
function saveToCache(url: string, content: Buffer): void {
  ensureRawDataDir();
  const cachePath = getCacheFilePath(url);
  fs.writeFileSync(cachePath, content);
  console.log(`  Cached: ${cachePath}`);
}

/**
 * Convert an offset key like `UTC+05:30` into a stable file stem.
 */
function offsetKeyToFileStem(offsetKey: string): string {
  const match = offsetKey.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Unsupported ETC/GMT offset key: ${offsetKey}`);
  }

  const [, sign, hours, minutes] = match;
  const signName = sign === "+" ? "plus" : "minus";
  return `utc-${signName}-${hours}-${minutes}`;
}

/**
 * Generate a typed loader module so bundlers can code-split each geometry file.
 */
function buildEtcgmtLoaderModule(offsetKeys: string[]): string {
  const imports = offsetKeys
    .map((offsetKey) => {
      const fileStem = offsetKeyToFileStem(offsetKey);
      return `  ${JSON.stringify(offsetKey)}: () => import("./${fileStem}.json"),`;
    })
    .join("\n");

  return `import type { FeatureCollection } from "geojson";

export type EtcGmtOffsetGeometryLoader = () => Promise<unknown>;

export const ETCGMT_OFFSET_KEYS = ${JSON.stringify(offsetKeys, null, 2)} as const;

export const ETCGMT_OFFSET_GEOMETRY_LOADERS: Record<
  string,
  EtcGmtOffsetGeometryLoader
> = {
${imports}
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
`;
}

function tzidToFileStem(tzid: string): string {
  const encoded = encodeURIComponent(tzid).replace(/%/g, "_");
  return `tz-${encoded}`;
}

/**
 * Generate a typed loader module so bundlers can code-split each IANA file.
 */
function buildIanaLoaderModule(tzids: string[]): string {
  const imports = tzids
    .map((tzid) => {
      const fileStem = tzidToFileStem(tzid);
      return `  ${JSON.stringify(tzid)}: () => import("./${fileStem}.json"),`;
    })
    .join("\n");

  return `import type { FeatureCollection } from "geojson";

export type IanaTimezoneGeometryLoader = () => Promise<unknown>;

export const IANA_TIMEZONE_KEYS = ${JSON.stringify(tzids, null, 2)} as const;

export const IANA_TIMEZONE_GEOMETRY_LOADERS: Record<
  string,
  IanaTimezoneGeometryLoader
> = {
${imports}
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

export async function loadIanaTimezoneGeometry(
  tzid: string,
): Promise<FeatureCollection | null> {
  const loader = IANA_TIMEZONE_GEOMETRY_LOADERS[tzid];
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
`;
}

function buildCanonicalMarkersModule(
  markers: Array<{
    tz: string;
    coords: [number, number];
    etcgmtOffsetKey?: string;
  }>,
  generatedAt: string,
): string {
  return `// Generated by scripts/update-globe-data.ts
// Generated At: ${generatedAt}

import type { MarkerEntry } from "../globe/types/globe.types";

export const CANONICAL_MARKERS: MarkerEntry[] = ${JSON.stringify(markers, null, 2)};
`;
}

function formatOffsetMinutesToIsoKey(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(minutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const remainingMinutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${remainingMinutes}`;
}

function ianaToEtcForGeneration(iana: string): string {
  if (!iana || typeof iana !== "string") {
    throw new Error(`ianaToEtc: invalid timezone '${String(iana)}'`);
  }

  try {
    let latitude = 0;
    try {
      latitude = getTimezoneCenter(iana)[0] ?? 0;
    } catch {
      latitude = 0;
    }

    const sampleDate =
      latitude < 0
        ? new Date(Date.UTC(2020, 6, 1, 12, 0, 0))
        : new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(sampleDate);
    const timezonePart =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const offsetMatch = timezonePart.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!offsetMatch) {
      return "UTC+00:00";
    }

    const [, signChar, hoursStr, minutesStr] = offsetMatch;
    const sign = signChar === "+" ? 1 : -1;
    const hours = parseInt(hoursStr ?? "0", 10);
    const minutes = parseInt(minutesStr ?? "0", 10);
    return formatOffsetMinutesToIsoKey(sign * (hours * 60 + minutes));
  } catch (error) {
    throw new Error(
      `ianaToEtc: failed to compute offset for '${iana}': ${String(error)}`,
    );
  }
}

function offsetKeyFromEtcForGeneration(etcZone: string): string {
  if (!etcZone || typeof etcZone !== "string") {
    throw new Error(`offsetKeyFromEtc: invalid etcZone '${String(etcZone)}'`);
  }

  if (/^UTC[+-]\d{2}:\d{2}$/.test(etcZone)) {
    return etcZone;
  }
  if (/^(Etc\/)?(GMT|UTC)$/.test(etcZone)) {
    return "UTC+00:00";
  }

  const etcMatch = etcZone.match(/Etc\/GMT([+-])(\d{1,2})$/);
  if (etcMatch) {
    const [, signChar, numberStr] = etcMatch;
    const hours = parseInt(numberStr ?? "0", 10);
    const totalMinutes = signChar === "+" ? -hours * 60 : hours * 60;
    return formatOffsetMinutesToIsoKey(totalMinutes);
  }

  const gmtMatch = etcZone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (gmtMatch) {
    const [, signChar, hoursStr, minutesStr] = gmtMatch;
    const hours = parseInt(hoursStr ?? "0", 10);
    const minutes = minutesStr ? parseInt(minutesStr, 10) : 0;
    const sign = signChar === "+" ? 1 : -1;
    return formatOffsetMinutesToIsoKey(sign * (hours * 60 + minutes));
  }

  throw new Error(`offsetKeyFromEtc: unsupported etcZone '${etcZone}'`);
}

/** Directory where generated timezone-related files live (src/data)
 * We'll emit `src/data/iana-data.ts` as the canonical module for IANA regions.
 */

/** Path to the visionscarto-world-atlas 110m TopoJSON in node_modules */
const WORLD_SOURCE = path.join(
  process.cwd(),
  "node_modules",
  "visionscarto-world-atlas",
  "world",
  "110m.json",
);

/**
 * IANA Timezone Boundaries (accurate IANA timezone polygons)
 * Source: https://github.com/evansiroky/timezone-boundary-builder
 * This provides accurate IANA timezone boundaries without ocean areas.
 * Use this for TZ_BOUNDARY_MODES.IANA
 */
const IANA_TZ_URL =
  "https://github.com/evansiroky/timezone-boundary-builder/releases/download/2026a/timezones.geojson.zip";

/**
 * ETC/GMT Timezone Polygons (simplified, includes ocean areas)
 * Source: https://github.com/nvkelso/natural-earth-vector
 * Standard source for high-quality, closed polygon timezone data.
 * Use this for TZ_BOUNDARY_MODES.ETCGMT
 */
const ETCGMT_TZ_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson";

/** Natural Earth: geographic-lines (110m) - contains International Date Line feature(s) */
const GEOGRAPHIC_LINES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_geographic_lines.geojson";

/**
 * Feature flag to control how offset geometries are generated for TZ_BOUNDARY_MODES.ETCGMT.
 *
 * Options:
 * - "iana-only": Group IANA timezones by offset (default, recommended)
 *   - Uses IANA timezone boundaries which are accurate
 *   - Includes all IANA timezones (e.g., 15 timezones for UTC+07:00)
 * - "natural-earth": Use Natural Earth data grouped by offset
 *   - Only has ~100 representative timezones
 *   - Missing many IANA timezones like Asia/Krasnoyarsk
 * - "merge": Merge both Natural Earth and IANA data
 *   - Combines both sources for maximum coverage
 */
const ETCGMT_OFFSET_SOURCE: "iana-only" | "natural-earth" | "merge" = "merge";
// const ETCGMT_OFFSET_SOURCE: "iana-only" | "natural-earth" | "merge" = "merge";
// const ETCGMT_OFFSET_SOURCE: "iana-only" | "natural-earth" | "merge" = "merge";
// ── Yauzl type definitions (yauzl doesn't have TypeScript types) ──

interface YauzlEntry {
  fileName: string;
}

interface YauzlZipFile {
  on(event: "entry", listener: (entry: YauzlEntry) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  openReadStream(
    entry: YauzlEntry,
    callback: (
      err: Error | undefined,
      readStream: Readable | undefined,
    ) => void,
  ): void;
}

interface Yauzl {
  fromBuffer(
    buffer: Buffer,
    callback: (err: Error | undefined, zipFile: YauzlZipFile) => void,
  ): void;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Download and unzip a GeoJSON file from a URL using yauzl
 * Uses caching to avoid re-downloading
 */
async function downloadAndUnzipGeoJson(
  url: string,
): Promise<FeatureCollection> {
  // Check cache first
  const cached = getCachedFile(url);
  let buffer = cached;

  if (!buffer) {
    console.log(`  Downloading: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }

    // Get the array buffer
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);

    // Save to cache
    saveToCache(url, buffer);
  } else {
    console.log(`  Using cached: ${getCacheFilePath(url)}`);
  }

  // The zip file format: first 2 bytes = PK (0x50 0x4B)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;

  let jsonText: string;

  if (isZip) {
    console.log(`  Extracting zip file...`);

    // Dynamically import yauzl for zip handling (ESM compatible)
    const yauzlModule = await import("yauzl");
    const yauzl = yauzlModule.default as Yauzl;

    const zip = await new Promise<YauzlZipFile>((resolve, reject) => {
      yauzl.fromBuffer(
        buffer,
        (err: Error | undefined, zipFile: YauzlZipFile | undefined) => {
          if (err) reject(err);
          else if (zipFile) resolve(zipFile);
          else reject(new Error("Failed to open zip file"));
        },
      );
    });

    let geojsonData: Buffer | null = null;

    // Use readEntry to iterate over entries (yauzl v3 API)
    const entries: YauzlEntry[] = [];

    await new Promise<void>((resolve, reject) => {
      zip.on("entry", (entry: YauzlEntry) => {
        entries.push(entry);
      });
      zip.on("end", () => resolve());
      zip.on("error", reject);
    });

    for (const entry of entries) {
      // The timezone-boundary-builder zip contains combined.json
      if (
        entry.fileName.endsWith(".json") ||
        entry.fileName.endsWith(".geojson")
      ) {
        geojsonData = await new Promise<Buffer>((resolve, reject) => {
          zip.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }
            if (!readStream) {
              reject(new Error("Failed to open read stream"));
              return;
            }
            const chunks: Buffer[] = [];
            readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
            readStream.on("end", () => resolve(Buffer.concat(chunks)));
            readStream.on("error", reject);
          });
        });
        break;
      }
    }

    if (!geojsonData) {
      throw new Error("No .json or .geojson file found in zip");
    }

    jsonText = geojsonData.toString("utf-8");
  } else if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    // Handle gzip file
    jsonText = zlib.gunzipSync(buffer).toString("utf-8");
  } else {
    // Assume it's plain JSON
    jsonText = buffer.toString("utf-8");
  }

  const parsed = safeJsonParse<FeatureCollection>(jsonText);
  if (parsed === null) {
    throw new Error(`Failed to parse JSON from ${url}`);
  }
  return parsed;
}

/**
 * Download a regular GeoJSON file (not zipped)
 * Uses caching to avoid re-downloading
 */
async function downloadFile(url: string): Promise<FeatureCollection> {
  // Check cache first
  const cached = getCachedFile(url);
  if (cached) {
    console.log(`  Using cached: ${getCacheFilePath(url)}`);
    const jsonText = cached.toString("utf-8");
    const parsed = safeJsonParse<FeatureCollection>(jsonText);
    if (parsed === null) {
      throw new Error(`Failed to parse cached JSON from ${url}`);
    }
    return parsed;
  }

  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  const jsonText = await response.text();

  // Save to cache
  saveToCache(url, Buffer.from(jsonText, "utf-8"));

  const parsed = safeJsonParse<FeatureCollection>(jsonText);
  if (parsed === null) {
    throw new Error(`Failed to parse JSON from ${url}`);
  }
  return parsed;
}

/**
 * Simplify topology while preserving shared borders.
 */
function simplifyTopology(topology: Topology, quantileVal = 0.05): Topology {
  // The topojson-simplify library expects Objects<object> but we have Objects<GeoJsonProperties>
  // Cast to satisfy library requirements while maintaining our type structure
  const topologyForLib = topology as Topology<Objects<object>>;
  const presimplified = topojsonSimplify.presimplify(topologyForLib);
  const minWeight = topojsonSimplify.quantile(presimplified, quantileVal);
  const simplified = topojsonSimplify.simplify(presimplified, minWeight);
  // Cast back to our original Topology type
  return simplified as Topology;
}

/**
 * Process timezone features - normalize IDs and reduce properties
 */
function processTimezoneFeatures(
  features: Feature<Geometry, GeoJsonProperties>[],
  source: "iana" | "etcgmt",
): Feature<Geometry, GeoJsonProperties>[] {
  return features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;

    let tzid = "";
    if (source === "iana") {
      // IANA source: use tzid directly from properties
      tzid = (p.tzid as string) ?? (p.timezone as string) ?? "";
    } else {
      // Natural Earth source: prefer canonical IANA name from tz_name1st
      // Fall back to UTC format labels and then display name
      tzid =
        (p.tz_name1st as string) ??
        (p.time_zone as string) ??
        (p.name as string) ??
        "";
    }

    return {
      ...f,
      properties: {
        tzid,
        name: (p.name as string) ?? "",
        source, // Track which source this feature came from
      },
    };
  });
}

/**
 * Normalize geometry for a feature in-place.
 * - Ensure polygon rings are closed
 * - If area is abnormally large (sign of inverted winding or malformed geometry),
 *   reverse ring orders for Polygon/MultiPolygon parts
 */
function normalizeFeatureGeo(
  feature: Feature<Geometry, GeoJsonProperties> | { geometry?: Geometry },
) {
  if (!feature?.geometry) return feature;
  const geom = feature.geometry;

  function closeRing(ring: Position[]) {
    if (!Array.isArray(ring) || ring.length === 0) return ring;
    const first = ring[0] as Position;
    const last = ring[ring.length - 1] as Position;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]] as Position);
    }
    return ring;
  }

  if (geom.type === "Polygon") {
    geom.coordinates = geom.coordinates.map((ring) => closeRing(ring));
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates = geom.coordinates.map((poly) =>
      poly.map((ring) => closeRing(ring)),
    );
  }

  // Use d3-geo's geoArea to detect obviously invalid/inverted geometries
  try {
    const area = Math.abs(
      geoArea(feature as Feature<Geometry, GeoJsonProperties>),
    );
    // Steradian of full sphere ≈ 4π. If area is absurdly large (greater than half the sphere),
    // treat as an indicator of inverted or malformed winding and attempt to reverse rings.
    if (area > Math.PI * 2) {
      if (geom.type === "Polygon") {
        geom.coordinates = geom.coordinates.map((ring) => [...ring].reverse());
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates = geom.coordinates.map((poly) =>
          poly.map((ring) => [...ring].reverse()),
        );
      }
    }
  } catch (e) {
    // Non-fatal: normalization best-effort
  }

  return feature;
}

// ── Main ──────────────────────────────────────────────────────────

export async function generateGlobeData(): Promise<void> {
  console.log("🌍 Generating split globe artifacts...\n");
  console.log(
    "  IANA Timezones: timezone-boundary-builder (accurate IANA boundaries)",
  );
  console.log(
    "  ETC/GMT Timezones: Natural Earth 10m (includes ocean areas)\n",
  );

  fs.mkdirSync(TZ_OUTPUT_DIR, { recursive: true });

  try {
    // 1. Load World 110m (Countries)
    if (!fs.existsSync(WORLD_SOURCE)) {
      throw new Error(`visionscarto-world-atlas not found at ${WORLD_SOURCE}`);
    }
    console.log("📦 Step 1: Loading World 110m (Countries)...");
    const worldData = fs.readFileSync(WORLD_SOURCE, "utf-8");
    const worldTopoParsed = safeJsonParse(worldData);
    if (worldTopoParsed === null) {
      throw new Error(`Failed to parse world topology from ${WORLD_SOURCE}`);
    }
    const worldTopo = worldTopoParsed as Topology;
    // Extract logical "countries" layer
    const countriesObject = worldTopo.objects["countries"];
    if (!countriesObject) {
      throw new Error("Countries object not found in world topology");
    }
    const countriesGeo = topojsonClient.feature(
      worldTopo,
      countriesObject,
    ) as FeatureCollection<Geometry, GeoJsonProperties>;

    // 2. Download IANA Timezone Boundaries (accurate, no oceans)
    console.log("\n📦 Step 2: Downloading IANA Timezone Boundaries...");
    console.log(`  Source: ${IANA_TZ_URL}`);
    const ianaTimezonesGeo = await downloadAndUnzipGeoJson(IANA_TZ_URL);
    console.log(
      `  Parsed ${ianaTimezonesGeo.features.length} IANA timezone features`,
    );

    // 3. Download ETC/GMT Timezone Polygons (Natural Earth, includes oceans)
    console.log("\n📦 Step 3: Downloading ETC/GMT Timezone Polygons...");
    console.log(`  Source: ${ETCGMT_TZ_URL}`);
    const etcgmtTimezonesGeo = await downloadFile(ETCGMT_TZ_URL);
    console.log(
      `  Parsed ${etcgmtTimezonesGeo.features.length} ETC/GMT timezone features`,
    );

    // 3.b Download Natural Earth geographic-lines (110m) to extract IDL
    console.log(
      "\n📦 Step 3b: Downloading Natural Earth geographic-lines (110m) …",
    );
    console.log(`  Source: ${GEOGRAPHIC_LINES_URL}`);
    const geographicLinesGeo = await downloadFile(GEOGRAPHIC_LINES_URL);
    console.log(
      `  Parsed ${geographicLinesGeo.features.length} geographic-lines features`,
    );

    // Persist raw geographic-lines to scripts/tmp for inspection
    try {
      const tmpDir = path.join(process.cwd(), "scripts", "tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const rawPath = path.join(tmpDir, "geographic-lines-110m.geojson");
      fs.writeFileSync(rawPath, JSON.stringify(geographicLinesGeo, null, 2));
      console.log(`  ✅ Persisted geographic-lines to ${rawPath}`);
    } catch (e) {
      console.warn(
        "  ⚠️  Failed to persist geographic-lines for inspection:",
        e,
      );
    }

    // Identify International Date Line feature(s) in the geographic-lines file.
    // Heuristic: match on name, featurecla, or any property containing 'date'+'line'.
    const idlMatchRegex =
      /international.*date\s*-?\s*line|date\s*-?\s*line|dateline/i;
    const geographicIdlFeatures = geographicLinesGeo.features.filter((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(p)) {
        const v = String(p[key] ?? "");
        if (idlMatchRegex.test(v)) return true;
      }
      // Also check common name fields
      if (typeof p.name === "string" && idlMatchRegex.test(p.name)) return true;
      if (typeof p.featurecla === "string" && idlMatchRegex.test(p.featurecla))
        return true;
      return false;
    });

    const geographicIdlFc: FeatureCollection = {
      type: "FeatureCollection",
      features: geographicIdlFeatures,
    };
    console.log(
      `  Extracted ${geographicIdlFeatures.length} candidate geographic_idl feature(s)`,
    );

    // 4. Process both timezone sources
    console.log("\n📦 Step 4: Processing timezone features...");

    // Process IANA timezones
    const processedIanaFeatures = processTimezoneFeatures(
      ianaTimezonesGeo.features,
      "iana",
    );
    // Normalize IANA geometry features to ensure closed rings and reasonable winding
    for (const f of processedIanaFeatures) normalizeFeatureGeo(f);
    console.log(
      `  Processed ${processedIanaFeatures.length} IANA timezone features`,
    );

    // Process ETC/GMT timezones
    const processedEtcgmtFeatures = processTimezoneFeatures(
      etcgmtTimezonesGeo.features,
      "etcgmt",
    );
    console.log(
      `  Processed ${processedEtcgmtFeatures.length} ETC/GMT timezone features`,
    );

    // 5. Create Combined Topology with both timezone sources
    console.log(
      "\n📦 Step 5: Building internal TopoJSON for simplification...",
    );

    // Create FeatureCollections for topology
    const ianaFc: FeatureCollection = {
      type: "FeatureCollection",
      features: processedIanaFeatures,
    };
    const combinedTopology = topojsonServer.topology({
      countries: countriesGeo,
      iana_timezones: ianaFc,
      geographic_idl: geographicIdlFc,
    });

    // 6. Simplify
    // Reduce simplification aggressiveness to preserve finer IANA boundary detail.
    // Lower quantile leads to less simplification; 0.04 preserves more vertices.
    console.log("  Simplifying topology (quantile=0.04)...");
    const simplified = simplifyTopology(combinedTopology, 0.04);

    // Extract simplified IANA features for use in offset geometries
    // (The detailed IANA features are too large to serialize to JSON)
    const ianaTimezonesObj = simplified.objects.iana_timezones;
    if (!ianaTimezonesObj) {
      throw new Error("Topology missing iana_timezones object");
    }
    const simplifiedIanaFc = topojsonClient.feature(
      simplified,
      ianaTimezonesObj,
    ) as unknown as FeatureCollection;
    console.log(
      `  Extracted ${simplifiedIanaFc.features.length} simplified IANA features for offset geometries`,
    );

    // 7. Generate runtime artifacts
    const generatedAt = new Date().toISOString();

    // 8. Verify required topology objects exist in the simplified topology
    const requiredObjects = ["iana_timezones"];
    for (const objName of requiredObjects) {
      if (!simplified.objects || !simplified.objects[objName]) {
        throw new Error(`Topology missing required object: ${objName}`);
      }
    }
    fs.rmSync(path.join(TZ_OUTPUT_DIR, "globe-data.json"), { force: true });

    const runtimeCountriesObject = simplified.objects.countries;
    const runtimeIanaTimezonesObject = simplified.objects.iana_timezones;
    if (!runtimeCountriesObject || !runtimeIanaTimezonesObject) {
      throw new Error(
        "Topology missing required objects for runtime artifacts",
      );
    }

    const countriesFeatureCollection = topojsonClient.feature(
      simplified,
      runtimeCountriesObject,
    ) as unknown as FeatureCollection;
    const ianaTimezonesFeatureCollection = topojsonClient.feature(
      simplified,
      runtimeIanaTimezonesObject,
    ) as unknown as FeatureCollection;
    const geographicIdlFeatureCollection = simplified.objects.geographic_idl
      ? (topojsonClient.feature(
          simplified,
          simplified.objects.geographic_idl,
        ) as unknown as FeatureCollection)
      : { type: "FeatureCollection", features: [] };

    fs.writeFileSync(
      COUNTRIES_OUTPUT_PATH,
      JSON.stringify(countriesFeatureCollection),
    );
    fs.writeFileSync(
      GEOGRAPHIC_IDL_OUTPUT_PATH,
      JSON.stringify(geographicIdlFeatureCollection),
    );
    console.log(`  ✅ Generated: ${COUNTRIES_OUTPUT_PATH}`);
    console.log(`  ✅ Generated: ${GEOGRAPHIC_IDL_OUTPUT_PATH}`);

    const ianaFeatureCollectionsByTzid = new Map<string, FeatureCollection>();
    let skippedIanaRuntimeFeatures = 0;
    for (const feature of ianaTimezonesFeatureCollection.features) {
      const tzid = feature.properties?.tzid;
      if (typeof tzid !== "string" || tzid.length === 0) {
        skippedIanaRuntimeFeatures++;
        continue;
      }

      const existingFeatureCollection = ianaFeatureCollectionsByTzid.get(tzid);
      if (existingFeatureCollection) {
        existingFeatureCollection.features.push(feature);
        continue;
      }

      ianaFeatureCollectionsByTzid.set(tzid, {
        type: "FeatureCollection",
        features: [feature],
      });
    }

    resetGeneratedDir(IANA_TIMEZONES_OUTPUT_DIR);
    const sortedIanaTzids = Array.from(
      ianaFeatureCollectionsByTzid.keys(),
    ).sort();
    for (const tzid of sortedIanaTzids) {
      const fileStem = tzidToFileStem(tzid);
      const featurePath = path.join(
        IANA_TIMEZONES_OUTPUT_DIR,
        `${fileStem}.json`,
      );
      const featureCollection = ianaFeatureCollectionsByTzid.get(tzid);
      if (!featureCollection) {
        continue;
      }

      fs.writeFileSync(featurePath, JSON.stringify(featureCollection, null, 2));
    }

    const ianaLoaderModulePath = path.join(
      IANA_TIMEZONES_OUTPUT_DIR,
      "index.ts",
    );
    fs.writeFileSync(
      ianaLoaderModulePath,
      buildIanaLoaderModule(sortedIanaTzids),
    );

    fs.rmSync(path.join(TZ_OUTPUT_DIR, "iana-timezones.json"), { force: true });

    console.log(
      `  ✅ Generated: ${IANA_TIMEZONES_OUTPUT_DIR} (${sortedIanaTzids.length} timezone files)`,
    );
    if (skippedIanaRuntimeFeatures > 0) {
      console.warn(
        `  ⚠️  Skipped ${skippedIanaRuntimeFeatures} IANA runtime feature(s) without a tzid.`,
      );
    }

    // 8. Generate canonical IANA module: `src/data/iana-data.ts`
    console.log(
      "\n📦 Step 8: Generating canonical IANA module (src/data/iana-data.ts)…",
    );
    const uniqueRegions = new Set<string>();
    for (const f of processedIanaFeatures) {
      const tzid = f.properties?.tzid as string | undefined;
      if (tzid && tzid.length > 0) uniqueRegions.add(tzid);
    }
    if (uniqueRegions.size === 0) {
      throw new Error(
        "No IANA timezone regions were extracted — aborting canonical module generation.",
      );
    }

    const sortedRegions = Array.from(uniqueRegions).sort();
    // Validate canonical regions: drop any region names that Intl cannot resolve.
    const validRegions: string[] = [];
    for (const tz of sortedRegions) {
      try {
        // validate by attempting to compute canonical ETC key
        ianaToEtcForGeneration(tz);
        validRegions.push(tz);
      } catch (err) {
        console.warn(
          `  ⚠️  Skipping invalid IANA region during generation: ${tz}`,
          err,
        );
      }
    }
    const usedRegions = validRegions;
    const ianaModulePath = path.join(TZ_OUTPUT_DIR, "iana-data.ts");
    const ianaModuleContent = `// Generated by scripts/update-globe-data.ts
// Generated At: ${generatedAt}
// IANA Source: ${IANA_TZ_URL}
// ETC/GMT Source: ${ETCGMT_TZ_URL}

export const IANA_TZ_METADATA = {
  generatedAt: "${generatedAt}",
  generator: "scripts/update-globe-data.ts",
  source: {
    iana: "${IANA_TZ_URL}",
    etcgmt: "${ETCGMT_TZ_URL}",
  },
  regionCount: ${usedRegions.length},
} as const

export const IANA_TZ_DATA = ${JSON.stringify(usedRegions, null, 2)} as const

export type IanaTzRegion = typeof IANA_TZ_DATA[number]
`;
    fs.writeFileSync(ianaModulePath, ianaModuleContent);
    console.log(
      `  ✅ Generated: ${ianaModulePath} (${sortedRegions.length} regions)`,
    );

    const canonicalMarkers = usedRegions.flatMap((tzid) => {
      const coords = TIMEZONE_COORDINATES[tzid];
      if (!coords) {
        return [];
      }

      const [lat, lng] = coords;
      let etcgmtOffsetKey: string | undefined;
      try {
        etcgmtOffsetKey = ianaToEtcForGeneration(tzid);
      } catch {
        etcgmtOffsetKey = undefined;
      }

      return [
        {
          tz: tzid,
          coords: [lat, lng] as [number, number],
          ...(etcgmtOffsetKey ? { etcgmtOffsetKey } : {}),
        },
      ];
    });
    fs.writeFileSync(
      CANONICAL_MARKERS_OUTPUT_PATH,
      buildCanonicalMarkersModule(canonicalMarkers, generatedAt),
    );
    console.log(
      `  ✅ Generated: ${CANONICAL_MARKERS_OUTPUT_PATH} (${canonicalMarkers.length} markers)`,
    );

    // 9. Generate ETCGMT artifacts
    console.log("\n📦 Step 9: Generating ETCGMT artifacts...");
    console.log(`  Mode: ETCGMT_OFFSET_SOURCE = "${ETCGMT_OFFSET_SOURCE}"`);

    // Build map: isoKey (UTC±HH:MM) -> FeatureCollection
    const etcMap = new Map<string, FeatureCollection>();
    let skippedEtcFeatures = 0;
    let totalFeaturesAdded = 0;

    // Helper to add a feature to the offset map
    const addToOffsetMap = (f: Feature, isoKey: string) => {
      if (!etcMap.has(isoKey)) {
        etcMap.set(isoKey, { type: "FeatureCollection", features: [] });
      }
      const collection = etcMap.get(isoKey);
      if (!collection) return;
      collection.features.push(f);
      totalFeaturesAdded++;
    };

    // Option 1: "iana-only" - Group IANA timezones by offset (default, recommended)
    if (ETCGMT_OFFSET_SOURCE === "iana-only") {
      console.log("  Using IANA timezones grouped by offset...");
      for (const f of simplifiedIanaFc.features) {
        const tzid = (f.properties?.tzid as string) ?? "";
        if (!tzid) continue;

        try {
          const isoKey = ianaToEtcForGeneration(tzid);
          addToOffsetMap(f, isoKey);
        } catch (e) {
          skippedEtcFeatures++;
        }
      }
    }
    // Option 2: "natural-earth" - Use Natural Earth data grouped by offset
    else if (ETCGMT_OFFSET_SOURCE === "natural-earth") {
      console.log("  Using Natural Earth data grouped by offset...");
      for (const f of processedEtcgmtFeatures) {
        const tzid = (f.properties?.tzid as string) ?? "";
        let isoKey: string | null = null;

        // Attempt: first treat as IANA (some Natural Earth features use canonical names)
        try {
          isoKey = ianaToEtcForGeneration(tzid);
        } catch (e) {
          try {
            // Try parse as Etc/GMT or GMT labels
            isoKey = offsetKeyFromEtcForGeneration(tzid);
          } catch (e2) {
            // Unable to derive offset key for this ETC/GMT feature — log and skip.
            console.warn(
              "Skipping ETCGMT feature without offset mapping:",
              tzid,
              { properties: f.properties },
            );
            skippedEtcFeatures++;
            continue;
          }
        }

        if (!isoKey) {
          console.warn("Skipping ETCGMT feature with empty isoKey:", tzid);
          skippedEtcFeatures++;
          continue;
        }

        addToOffsetMap(f, isoKey);
      }
    }
    // Option 3: "merge" - Merge both Natural Earth and IANA data
    else if (ETCGMT_OFFSET_SOURCE === "merge") {
      console.log("  Merging Natural Earth + IANA data...");

      // First add IANA timezones
      for (const f of simplifiedIanaFc.features) {
        const tzid = (f.properties?.tzid as string) ?? "";
        if (!tzid) continue;

        try {
          const isoKey = ianaToEtcForGeneration(tzid);
          addToOffsetMap(f, isoKey);
        } catch (e) {
          skippedEtcFeatures++;
        }
      }

      // Then add Natural Earth timezones (skipping duplicates by tzid)
      const addedTzids = new Set<string>();
      for (const [, fc] of etcMap.entries()) {
        for (const f of fc.features) {
          const tzid = f.properties?.tzid as string | undefined;
          if (tzid) addedTzids.add(tzid);
        }
      }

      for (const f of processedEtcgmtFeatures) {
        const tzid = (f.properties?.tzid as string) ?? "";
        if (!tzid) continue;

        // Do not skip Natural Earth features even if a tzid was already added from IANA.
        // Include Natural Earth polygons (often larger / oceanic) so merged ETCGMT
        // offset geometries contain ocean areas as expected.

        let isoKey: string | null = null;
        try {
          isoKey = ianaToEtcForGeneration(tzid);
        } catch (e) {
          try {
            isoKey = offsetKeyFromEtcForGeneration(tzid);
          } catch (e2) {
            skippedEtcFeatures++;
            continue;
          }
        }

        if (isoKey) {
          addToOffsetMap(f, isoKey);
          addedTzids.add(tzid);
        }
      }
    }

    const etcObj: Record<string, FeatureCollection> = {};
    for (const [k, v] of etcMap.entries()) etcObj[k] = v;

    resetGeneratedDir(ETCGMT_OUTPUT_DIR);
    const sortedOffsetKeys = Object.keys(etcObj).sort();

    for (const offsetKey of sortedOffsetKeys) {
      const fileStem = offsetKeyToFileStem(offsetKey);
      const featureCollection = etcObj[offsetKey];
      const featurePath = path.join(ETCGMT_OUTPUT_DIR, `${fileStem}.json`);
      fs.writeFileSync(featurePath, JSON.stringify(featureCollection, null, 2));
    }

    const etcGeomLoaderPath = path.join(ETCGMT_OUTPUT_DIR, "index.ts");
    fs.writeFileSync(
      etcGeomLoaderPath,
      buildEtcgmtLoaderModule(sortedOffsetKeys),
    );

    fs.rmSync(path.join(TZ_OUTPUT_DIR, "etcgmt-offset-geometries.json"), {
      force: true,
    });

    console.log(
      `  ✅ Generated: ${ETCGMT_OUTPUT_DIR} (${sortedOffsetKeys.length} offset buckets, ${totalFeaturesAdded} features)`,
    );
    if (skippedEtcFeatures > 0) {
      console.warn(
        `  ⚠️  Skipped ${skippedEtcFeatures} feature(s) that could not be mapped to an offset key.`,
      );
    }

    // Build IANA -> offset mapping for all validated canonical regions
    const ianaToOffset: Record<string, string> = {};
    for (const tz of usedRegions) {
      try {
        ianaToOffset[tz] = ianaToEtcForGeneration(tz);
      } catch (e) {
        console.warn(
          `  ⚠️  Skipping IANA region during offset mapping (unresolvable): ${tz}`,
          e,
        );
        // Skip but continue building the mapping for other regions
      }
    }
    const ianaMapPath = path.join(TZ_OUTPUT_DIR, "etcgmt-iana-to-offset.json");
    fs.writeFileSync(ianaMapPath, JSON.stringify(ianaToOffset, null, 2));
    console.log(
      `  ✅ Generated: ${ianaMapPath} (${Object.keys(ianaToOffset).length} mappings)`,
    );

    console.log("\n🎉 Globe data generation complete!");
    console.log("\nData Usage:");
    console.log(
      "  - TZ_BOUNDARY_MODES.IANA: Uses src/data/iana-timezones/* (timezone-keyed IANA geometries loaded on demand)",
    );
    console.log(
      "  - TZ_BOUNDARY_MODES.ETCGMT: Uses src/data/etcgmt-offset-geometries/* (offset-keyed ETC/GMT geometries loaded on demand)",
    );
  } catch (err) {
    console.error("❌ Error generating globe data:", err);
    processExit(1);
  }
}

// If this script is executed directly, run the generator.
// Robust entry detection when executed via `tsx` or node. If the process argv
// includes the script filename, treat this as the main entry and run the
// generator. This keeps `generateGlobeData` importable for programmatic use.
const invokedAsScript = process.argv.some(
  (a) =>
    a.endsWith("update-globe-data.ts") || a.endsWith("update-globe-data.js"),
);
if (invokedAsScript) {
  generateGlobeData().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
}
