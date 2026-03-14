import fs from "fs";
import { feature } from "topojson-client";
import { computeHighlightedData } from "../src/components/TzGlobePicker/renderers/BoundaryRenderer";
import { getUtcOffsetMinutes } from "../src/utils/timezoneMapping";
import { TZ_BOUNDARY_MODES } from "../src/components/TzGlobePicker/types/globe.types";
import { geoArea } from "d3-geo";

async function run() {
  const topo = JSON.parse(fs.readFileSync("src/data/globe-data.json", "utf8"));
  const timezones = feature(topo, topo.objects.iana_timezones) as any;
  const iso = feature(topo, topo.objects.iso8601_timezones) as any;
  const countries = feature(topo, topo.objects.countries) as any;

  const geoData = {
    ianaTimezones: timezones,
    iso8601Timezones: iso,
    countries,
    topology: topo,
  } as any;

  const featureOffsets = new Map<string, number>();
  for (const f of geoData.ianaTimezones.features) {
    const tz = f.properties?.tzid as string | undefined;
    if (tz) featureOffsets.set(tz, getUtcOffsetMinutes(tz));
  }

  const tests = ["America/New_York", "Asia/Baku"];
  for (const tz of tests) {
    console.log(`\n== ISO8601 merge test: ${tz} ==`);
    const res = computeHighlightedData({
      geoData,
      timezone: tz,
      featureOffsets,
      mode: TZ_BOUNDARY_MODES.ISO8601,
    });
    if (!res) {
      console.log("result: null");
      continue;
    }
    console.log("matching IANA features:", res.features.length);
    if (res.merged) {
      try {
        // merged may be a FeatureCollection
        const area = geoArea(res.merged as any);
        console.log("merged geoArea (steradians):", area);
      } catch (e) {
        console.log("merged geometry present but geoArea failed:", e);
      }
    } else {
      console.log("no merged geometry returned");
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
