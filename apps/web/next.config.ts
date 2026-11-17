import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Shared workspace code is TypeScript source, so Next compiles it like app code.
  transpilePackages: ["@squad-six/shared"],
  turbopack: {
    // Monorepo: the lockfile and packages/ live two levels up.
    root: path.join(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
