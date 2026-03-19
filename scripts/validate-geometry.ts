import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { geoContains, geoCentroid, geoArea } from "d3-geo";
import type {
  FeatureCollection,
  Feature,
  Geometry,
  GeoJsonProperties,
  Position,
} from "geojson";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COUNTRIES_PATH = path.resolve(__dirname, "../src/data/globe-countries.json");
const GEOGRAPHIC_IDL_PATH = path.resolve(
  __dirname,
  "../src/data/geographic-idl.json",
);
const IANA_TIMEZONES_DIR = path.resolve(__dirname, "../src/data/iana-timezones");

function tzidToFileStem(tzid: string): string {
  const encoded = encodeURIComponent(tzid).replace(/%/g, "_");
  return `tz-${encoded}`;
}

function readFeatureCollection(
  filePath: string,
): FeatureCollection<Geometry, GeoJsonProperties> {
  const parsed = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as FeatureCollection<Geometry, GeoJsonProperties>;

  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(`Invalid FeatureCollection at ${filePath}`);
  }

  return parsed;
}

function flattenCoords(
  geom: Geometry | null | undefined,
  out: Array<[number, number]> = [],
): Array<[number, number]> {
  if (!geom) return out;

  type CoordsUnion = Position | Position[] | Position[][] | Position[][][];
  function hasCoordinates(obj: unknown): obj is { coordinates: CoordsUnion } {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "coordinates" in (obj as Record<string, unknown>)
    );
  }

  if (!hasCoordinates(geom)) return out;
  const coords = geom.coordinates as CoordsUnion;

  function walk(arr: unknown): void {
    if (!Array.isArray(arr)) return;
    if (
      arr.length === 2 &&
      typeof arr[0] === "number" &&
      typeof arr[1] === "number"
    ) {
      out.push([arr[0], arr[1]]);
      return;
    }
    for (const c of arr) walk(c);
  }

  walk(coords);
  return out;
}

function analyzeFeature(
  feat: Feature<Geometry, GeoJsonProperties>,
  countriesFeat: FeatureCollection<Geometry, GeoJsonProperties> | null,
): {
  geomType: string;
  totalCoords: number;
  sampleCoord: [number, number] | undefined;
  firstAbsGt90: number;
  secondAbsGt90: number;
  minFirst: number;
  maxFirst: number;
  minSecond: number;
  maxSecond: number;
  containedCountries: number;
  containedSample: string[];
} {
  const geom = feat.geometry as Geometry | undefined;
  const coords = flattenCoords(geom);
  if (coords.length === 0) {
    return {
      geomType: geom?.type ?? "unknown",
      totalCoords: 0,
      sampleCoord: undefined,
      firstAbsGt90: 0,
      secondAbsGt90: 0,
      minFirst: NaN,
      maxFirst: NaN,
      minSecond: NaN,
      maxSecond: NaN,
      containedCountries: 0,
      containedSample: [],
    };
  }

  const sample = coords[0];
  const firstAbsGt90 = coords.filter(([a]) => Math.abs(a) > 90).length;
  const secondAbsGt90 = coords.filter(([, b]) => Math.abs(b) > 90).length;

  const minFirst = Math.min(...coords.map((c) => c[0]));
  const maxFirst = Math.max(...coords.map((c) => c[0]));
  const minSecond = Math.min(...coords.map((c) => c[1]));
  const maxSecond = Math.max(...coords.map((c) => c[1]));

  let containedCountries = 0;
  const containedSample: string[] = [];
  if (countriesFeat) {
    for (const country of countriesFeat.features) {
      const centroid = geoCentroid(country);
      try {
        if (geoContains(feat, centroid)) {
          containedCountries++;
          const properties = country.properties as Record<string, unknown> | null;
          const name = properties?.name ?? properties?.ADMIN ?? "unknown";
          containedSample.push(String(name));
          if (containedSample.length >= 5) break;
        }
      } catch {
        // Ignore invalid geometries during diagnostics.
      }
    }
  }

  return {
    geomType: geom?.type ?? "unknown",
    totalCoords: coords.length,
    sampleCoord: sample,
    firstAbsGt90,
    secondAbsGt90,
    minFirst,
    maxFirst,
    minSecond,
    maxSecond,
    containedCountries,
    containedSample,
  };
}

async function main(): Promise<void> {
  if (!fs.existsSync(COUNTRIES_PATH)) {
    console.error("globe-countries.json not found at", COUNTRIES_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(GEOGRAPHIC_IDL_PATH)) {
    console.error("geographic-idl.json not found at", GEOGRAPHIC_IDL_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(IANA_TIMEZONES_DIR)) {
    console.error("iana-timezones directory not found at", IANA_TIMEZONES_DIR);
    process.exit(1);
  }

  const countriesFc = readFeatureCollection(COUNTRIES_PATH);
  const geographicIdlFc = readFeatureCollection(GEOGRAPHIC_IDL_PATH);

  const targets = [
    "America/New_York",
    "America/Belem",
    "America/Bahia",
    "Asia/Yakutsk",
  ];

  for (const tz of targets) {
    console.log("\n==", tz, "==");
    const featurePath = path.join(IANA_TIMEZONES_DIR, `${tzidToFileStem(tz)}.json`);
    if (!fs.existsSync(featurePath)) {
      console.log("No split geometry file for", tz);
      continue;
    }

    const tzFc = readFeatureCollection(featurePath);
    console.log("matching features:", tzFc.features.length);

    for (const feature of tzFc.features) {
      const result = analyzeFeature(feature, countriesFc);
      const area = geoArea(feature);
      console.log("geomType:", result.geomType);
      console.log("totalCoords:", result.totalCoords);
      console.log("geoArea (steradians):", area);
      console.log("sampleCoord:", result.sampleCoord);
      console.log(
        "firstAbsGt90:",
        result.firstAbsGt90,
        "secondAbsGt90:",
        result.secondAbsGt90,
      );
      console.log("minFirst..maxFirst:", result.minFirst, "..", result.maxFirst);
      console.log(
        "minSecond..maxSecond:",
        result.minSecond,
        "..",
        result.maxSecond,
      );
      console.log(
        "containedCountries (centroid test):",
        result.containedCountries,
        "sample:",
        result.containedSample,
      );
    }
  }

  console.log("\n== geographic_idl ==");
  console.log("features:", geographicIdlFc.features.length);
  if (geographicIdlFc.features.length) {
    const sample = geographicIdlFc.features[0];
    if (sample) {
      console.log("sample properties:", sample.properties || {});
      const result = analyzeFeature(sample, countriesFc);
      console.log(
        "sample coord count:",
        result.totalCoords,
        "geomType:",
        result.geomType,
      );
      console.log("sample coord:", result.sampleCoord);
      console.log("minFirst..maxFirst:", result.minFirst, "..", result.maxFirst);
      console.log(
        "minSecond..maxSecond:",
        result.minSecond,
        "..",
        result.maxSecond,
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
