import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth/billing routes read cookies — keep classic dynamic rendering for MVP.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
