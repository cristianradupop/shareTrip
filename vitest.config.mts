import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // src/db/client.ts throws at import when DATABASE_URL is missing; tests never connect (db is mocked).
    env: { DATABASE_URL: "postgresql://test:test@localhost:6543/test" },
  },
});
