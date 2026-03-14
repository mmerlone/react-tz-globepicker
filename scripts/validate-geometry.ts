import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { feature as topoFeature } from "topojson-client";
import { geoContains, geoCentroid, geoArea } from "d3-geo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GLOBE_PATH = path.resolve(__dirname, "../src/data/globe-data.json");

function flattenCoords(geom: any, out: Array<[number, number]> = []) {
  if (!geom) return out;
  const type = geom.type;
  const coords = geom.coordinates;
  if (!coords) return out;

  function walk(arr: any) {
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

function analyzeFeature(feat: any, countriesFeat: any) {
  const geom = feat.geometry;
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

  // containment: count how many country centroids are contained in this tz feature
  let containedCountries = 0;
  const containedSample: string[] = [];
  if (countriesFeat) {
    for (const c of countriesFeat.features) {
      const centroid = geoCentroid(c);
      try {
        if (geoContains(feat, centroid)) {
          containedCountries++;
          containedSample.push(
            c.properties?.name || c.properties?.ADMIN || "unknown",
          );
          if (containedSample.length >= 5) break;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  return {
    geomType: geom.type,
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

async function main() {
  if (!fs.existsSync(GLOBE_PATH)) {
    console.error("globe-data.json not found at", GLOBE_PATH);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(GLOBE_PATH, "utf8"));
  const topo = raw;

  // Require explicit IANA timezone object in topology
  if (!topo.objects?.iana_timezones) {
    console.error("Topology missing required 'iana_timezones' object");
    process.exit(1);
  }

  const tzFc = topoFeature(topo, topo.objects.iana_timezones) as any;
  const countriesFc = topo.objects.countries
    ? topoFeature(topo, topo.objects.countries)
    : null;

  const targets = [
    "America/New_York",
    "America/Belem",
    "America/Bahia",
    "Asia/Yakutsk",
  ];

  for (const tz of targets) {
    console.log("\n==", tz, "==");
    const matches = tzFc.features.filter(
      (f: any) =>
        (f.properties?.tzid || f.properties?.TZID || f.properties?.timezone) ===
        tz,
    );
    console.log("matching features:", matches.length);
    if (matches.length === 0) {
      console.log("No exact features for", tz);
      continue;
    }
    for (const m of matches) {
      const r = analyzeFeature(m, countriesFc);
      const area = geoArea(m);
      console.log("geomType:", r.geomType);
      console.log("totalCoords:", r.totalCoords);
      console.log("geoArea (steradians):", area);
      console.log("sampleCoord:", r.sampleCoord);
      console.log(
        "firstAbsGt90:",
        r.firstAbsGt90,
        "secondAbsGt90:",
        r.secondAbsGt90,
      );
      console.log("minFirst..maxFirst:", r.minFirst, "..", r.maxFirst);
      console.log("minSecond..maxSecond:", r.minSecond, "..", r.maxSecond);
      console.log(
        "containedCountries (centroid test):",
        r.containedCountries,
        "sample:",
        r.containedSample,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
