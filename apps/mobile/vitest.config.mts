import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for plain TypeScript modules (no React Native imports). Screens are tested on device.
export default defineConfig({
  resolve: { alias: { "@": path.join(import.meta.dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
