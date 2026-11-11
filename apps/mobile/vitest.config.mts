import { defineConfig } from "vitest/config";

// Unit tests for plain TypeScript modules (no React Native imports). Screens are tested on device.
export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
