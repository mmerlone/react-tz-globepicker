import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import * as topojsonServer from "topojson-server";
import * as topojsonClient from "topojson-client";
import * as topojsonSimplify from "topojson-simplify";
import { geoArea } from "d3-geo";
import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import type { Topology, Objects } from "topojson-specification";
import { safeJsonParse } from "@/utils/json";

// Debug entry marker to confirm script execution when run via `pnpm run gen:globe`
console.log("[update-globe-data] entry");

// Handle process.exit properly for Node.js environment
const processExit = (code: number): never => {
  process.exit(code);
};

/** Directory where generated timezone-related files live (src/data) */
const TZ_OUTPUT_DIR = path.join(process.cwd(), "src", "data");

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
 * ISO8601 Timezone Polygons (simplified, includes ocean areas)
 * Source: https://github.com/nvkelso/natural-earth-vector
 * Standard source for high-quality, closed polygon timezone data.
 * Use this for TZ_BOUNDARY_MODES.ISO8601
 */
const ISO8601_TZ_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson";

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
 */
async function downloadAndUnzipGeoJson(
  url: string,
): Promise<FeatureCollection> {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  // Get the array buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

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

  const parsed = safeJsonParse(jsonText);
  if (parsed === null) {
    throw new Error(`Failed to parse JSON from ${url}`);
  }

  return parsed as FeatureCollection;
}

/**
 * Download a regular GeoJSON file (not zipped)
 */
async function downloadFile(url: string): Promise<FeatureCollection> {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  const jsonText = await response.text();
  const parsed = safeJsonParse(jsonText);
  if (parsed === null) {
    throw new Error(`Failed to parse JSON from ${url}`);
  }

  return parsed as FeatureCollection;
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
  features: FeatureCollection["features"],
  source: "iana" | "iso8601",
): FeatureCollection["features"] {
  return features.map((f) => {
    const p = f.properties ?? {};

    let tzid: string;
    if (source === "iana") {
      // IANA source: use tzid directly from properties
      tzid = (p.tzid as string) ?? (p.timezone as string) ?? "";
    } else {
      // Natural Earth source: prefer canonical IANA name from tz_name1st
      // Fall back to UTC format labels and then display name
      tzid = (p.tz_name1st ?? p.time_zone ?? p.name ?? "") as string;
    }

    return {
      ...f,
      properties: {
        tzid,
        name: p.name as string,
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
function normalizeFeatureGeo(feature: any) {
  if (!feature?.geometry) return feature;
  const geom = feature.geometry;

  function closeRing(ring: any[]) {
    if (!Array.isArray(ring) || ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }
    return ring;
  }

  if (geom.type === "Polygon") {
    geom.coordinates = geom.coordinates.map((ring: any[]) => closeRing(ring));
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates = geom.coordinates.map((poly: any[]) =>
      poly.map((ring: any[]) => closeRing(ring)),
    );
  }

  // Use d3-geo's geoArea to detect obviously invalid/inverted geometries
  try {
    const area = Math.abs(geoArea(feature));
    // Steradian of full sphere ≈ 4π. If area is absurdly large (greater than half the sphere),
    // treat as an indicator of inverted or malformed winding and attempt to reverse rings.
    if (area > Math.PI * 2) {
      if (geom.type === "Polygon") {
        geom.coordinates = geom.coordinates.map((ring: any[]) =>
          ring.reverse(),
        );
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates = geom.coordinates.map((poly: any[]) =>
          poly.map((ring: any[]) => ring.reverse()),
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
  console.log("🌍 Generating unified globe data...\n");
  console.log(
    "  IANA Timezones: timezone-boundary-builder (accurate IANA boundaries)",
  );
  console.log(
    "  ISO8601 Timezones: Natural Earth 10m (includes ocean areas)\n",
  );

  if (!fs.existsSync(TZ_OUTPUT_DIR)) {
    fs.mkdirSync(TZ_OUTPUT_DIR, { recursive: true });
  }

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

    // 3. Download ISO8601 Timezone Polygons (Natural Earth, includes oceans)
    console.log("\n📦 Step 3: Downloading ISO8601 Timezone Polygons...");
    console.log(`  Source: ${ISO8601_TZ_URL}`);
    const iso8601TimezonesGeo = await downloadFile(ISO8601_TZ_URL);
    console.log(
      `  Parsed ${iso8601TimezonesGeo.features.length} ISO8601 timezone features`,
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

    // Process ISO8601 timezones
    const processedIso8601Features = processTimezoneFeatures(
      iso8601TimezonesGeo.features,
      "iso8601",
    );
    console.log(
      `  Processed ${processedIso8601Features.length} ISO8601 timezone features`,
    );

    // 5. Create Combined Topology with both timezone sources
    console.log(
      "\n📦 Step 5: Creating TopoJSON (Countries + IANA Timezones + ISO8601 Timezones)...",
    );

    // Create FeatureCollections for topology
    const ianaFc: FeatureCollection = {
      type: "FeatureCollection",
      features: processedIanaFeatures,
    };
    const iso8601Fc: FeatureCollection = {
      type: "FeatureCollection",
      features: processedIso8601Features,
    };

    const combinedTopology = topojsonServer.topology({
      countries: countriesGeo,
      iana_timezones: ianaFc,
      iso8601_timezones: iso8601Fc,
    });

    // 6. Simplify
    // Reduce simplification aggressiveness to preserve finer IANA boundary detail.
    // Lower quantile leads to less simplification; 0.02 preserves more vertices.
    console.log("  Simplifying topology (quantile=0.02)...");
    const simplified = simplifyTopology(combinedTopology, 0.02);

    // 7. Write Output
    const generatedAt = new Date().toISOString();

    // Attach generation metadata to the topology JSON so consumers can verify provenance.
    const topologyWithMeta = {
      generated: {
        generatedAt,
        generator: "scripts/update-globe-data.ts",
        sources: {
          iana: IANA_TZ_URL,
          iso8601: ISO8601_TZ_URL,
          world: WORLD_SOURCE,
        },
        ianaRegionCount: processedIanaFeatures.length,
      },
      ...simplified,
    } as unknown;

    // 8. Verify required topology objects exist in the simplified topology
    const requiredObjects = ["iana_timezones", "iso8601_timezones"];
    for (const objName of requiredObjects) {
      if (!simplified.objects || !simplified.objects[objName]) {
        throw new Error(`Topology missing required object: ${objName}`);
      }
    }

    const outputPath = path.join(TZ_OUTPUT_DIR, "globe-data.json");
    const outputJson = JSON.stringify(topologyWithMeta);
    fs.writeFileSync(outputPath, outputJson);
    const sizeMB = (Buffer.byteLength(outputJson) / 1024 / 1024).toFixed(2);
    console.log(`  ✅ Saved unified data: ${outputPath}`);
    console.log(`     Size: ${sizeMB} MB`);

    // 9. Verify Size Warning
    if (parseFloat(sizeMB) > 5) {
      console.warn(
        "  ⚠️  Warning: File size > 5MB. Consider reducing quantile or stripping properties.",
      );
    }

    // 10. Generate canonical IANA module: `src/data/iana-data.ts`
    console.log(
      "\n📦 Step 6: Generating canonical IANA module (src/data/iana-data.ts)…",
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
    const ianaModulePath = path.join(TZ_OUTPUT_DIR, "iana-data.ts");
    const ianaModuleContent = `// Generated by scripts/update-globe-data.ts
// Generated At: ${generatedAt}
// IANA Source: ${IANA_TZ_URL}
// ISO8601 Source: ${ISO8601_TZ_URL}

export const IANA_TZ_METADATA = {
  generatedAt: "${generatedAt}",
  generator: "scripts/update-globe-data.ts",
  source: {
    iana: "${IANA_TZ_URL}",
    iso8601: "${ISO8601_TZ_URL}",
  },
  regionCount: ${sortedRegions.length},
} as const

export const IANA_TZ_DATA = ${JSON.stringify(sortedRegions, null, 2)} as const

export type IanaTzRegion = typeof IANA_TZ_DATA[number]
`;
    fs.writeFileSync(ianaModulePath, ianaModuleContent);
    console.log(
      `  ✅ Generated: ${ianaModulePath} (${sortedRegions.length} regions)`,
    );

    console.log("\n🎉 Globe data generation complete!");
    console.log("\nData Usage:");
    console.log(
      "  - TZ_BOUNDARY_MODES.IANA: Uses iana_timezones (accurate IANA boundaries)",
    );
    console.log(
      "  - TZ_BOUNDARY_MODES.ISO8601: Uses iso8601_timezones (includes ocean areas)",
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
