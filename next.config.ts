import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: simple request-time rendering for this CRUD app.
  experimental: {
    // Signup uploads a profile photo (max 2 MB) through a Server Action.
    serverActions: { bodySizeLimit: "3mb" },
  },
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
