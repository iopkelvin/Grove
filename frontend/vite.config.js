/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The /api proxy is what lets VITE_API_URL stay empty in development: the
// browser talks to the Vite dev server on :5173, which forwards to Flask on
// :5000, so there is no cross-origin request and therefore no CORS to
// configure before anything works.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Traceable production errors. The alternative is stack traces against
    // minified output that nobody can act on.
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/test/**", "src/main.jsx"],
    },
  },
});
