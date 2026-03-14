import fs from "fs";
import { feature } from "topojson-client";
import { computeHighlightedData } from "../src/components/TzGlobePicker/renderers/BoundaryRenderer";
import { getUtcOffsetMinutes } from "../src/utils/timezoneMapping";
import { TZ_BOUNDARY_MODES } from "../src/components/TzGlobePicker/types/globe.types";

async function run() {
  const topo = JSON.parse(fs.readFileSync("src/data/globe-data.json", "utf8"));
  if (!topo.objects?.iana_timezones) {
    console.error("Topology missing required 'iana_timezones' object");
    process.exit(1);
  }
  const timezones = feature(topo, topo.objects.iana_timezones) as any;
  const iso = feature(topo, topo.objects.iso8601_timezones) as any;
  const countries = feature(topo, topo.objects.countries) as any;

  const geoData: any = {
    ianaTimezones: timezones,
    iso8601Timezones: iso,
    timezones: timezones,
    countries,
    topology: topo,
  };

  const featureOffsets = new Map<string, number>();
  for (const f of geoData.ianaTimezones.features) {
    const tz = f.properties?.tzid;
    if (tz) featureOffsets.set(tz, getUtcOffsetMinutes(tz));
  }

  const tests = [
    "America/New_York",
    "America/Belem",
    "America/Bahia",
    "Asia/Yakutsk",
  ];
  for (const tz of tests) {
    try {
      const res = computeHighlightedData({
        geoData,
        timezone: tz,
        featureOffsets,
        mode: TZ_BOUNDARY_MODES.IANA,
      });
      console.log("\n==", tz, "==");
      if (!res) {
        console.log("result: null");
        continue;
      }
      console.log("matching country count:", res.features.length);
      console.log(
        "sample countries:",
        res.features
          .slice(0, 10)
          .map(
            (f: any) => f.properties?.name || f.properties?.ADMIN || "unknown",
          ),
      );

      // Also inspect the original matching timezone feature(s)
      const matchingTzFeatures = geoData.ianaTimezones.features.filter(
        (f: any) => f.properties?.tzid === tz,
      );
      if (matchingTzFeatures.length) {
        const mf = matchingTzFeatures[0];
        console.log(
          "matched timezone feature geometry type:",
          mf.geometry?.type,
        );
        if (mf.geometry?.type === "MultiPolygon") {
          console.log(
            "multiPolygon parts:",
            (mf.geometry.coordinates || []).length,
          );
          const sample = mf.geometry.coordinates?.[0]?.[0]?.[0];
          if (sample)
            console.log(
              "sample coord:",
              sample,
              "-> lon abs>",
              Math.abs(sample[0]),
              "lat abs>",
              Math.abs(sample[1]),
            );
        } else if (mf.geometry?.type === "Polygon") {
          console.log("polygon rings:", (mf.geometry.coordinates || []).length);
          const sample = mf.geometry.coordinates?.[0]?.[0];
          if (sample)
            console.log(
              "sample coord:",
              sample,
              "-> lon abs>",
              Math.abs(sample[0]),
              "lat abs>",
              Math.abs(sample[1]),
            );
        }
      } else {
        console.log("no direct timezone feature found with exact tzid match");
      }
    } catch (err) {
      console.error("error for", tz, err);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
