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
});
