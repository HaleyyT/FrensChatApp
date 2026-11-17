import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    coverage: {
      include: ["src/**/*.{js,jsx}"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
