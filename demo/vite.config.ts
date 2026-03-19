import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve to library source for live development (no build step needed)
      "react-tz-globepicker": path.resolve(__dirname, "../src/index.ts"),
    },
  },
  server: {
    port: 3333,
  },
  build: {
    modulePreload: {
      resolveDependencies(_filename: string, dependencies: string[]): string[] {
        return dependencies.filter(
          (dependency) =>
            !dependency.includes("iana-geometry-loaders") &&
            !dependency.includes("etcgmt-geometry-loaders"),
        );
      },
    },
    rollupOptions: {
      output: {
        // Manual chunks to split large data files for better code-splitting
        // Use function form to match chunks by module ID containing the data files
        manualChunks(id: string) {
          if (id.includes("globe-countries.json")) {
            return "globe-countries";
          }
          if (id.includes("geographic-idl.json")) {
            return "geographic-idl";
          }
          if (id.includes("iana-timezones/index.ts")) {
            return "iana-geometry-loaders";
          }
          // Keep the generated geometry loader separate, but let each
          // dynamically imported geometry JSON stay in its own chunk.
          if (id.includes("etcgmt-offset-geometries/index.ts")) {
            return "etcgmt-geometry-loaders";
          }
          // Split ETC/GMT IANA mapping into its own chunk
          if (id.includes("etcgmt-iana-to-offset")) {
            return "etcgmt-mapping";
          }
          // Split D3 and related geo libraries
          if (id.includes("node_modules/d3")) {
            return "d3-vendor";
          }
          if (id.includes("node_modules/topojson")) {
            return "topojson-vendor";
          }
        },
      },
    },
  },
});
