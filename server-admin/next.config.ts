import type { NextConfig } from "next";

const serverAppUrl = process.env.SERVER_APP_URL ?? "http://localhost:3001";

// Rewrites are compiled into the build, so a deployment without the variable would proxy to localhost.
if (process.env.VERCEL_ENV && !process.env.SERVER_APP_URL) {
  throw new Error("SERVER_APP_URL is required to build on Vercel");
}

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: simple request-time rendering for this CRUD app.
  transpilePackages: ["server-app"],
  // The browser only talks to this origin; /api/* is proxied to server-app.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${serverAppUrl}/api/:path*` }];
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
