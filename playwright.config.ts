import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Smoke tests only: they must pass with no database and no real secrets, so CI stays free and safe.
// The dummy values below let the app boot; no test touches the database.
const dummyEnv = {
  DATABASE_URL: "postgresql://test:test@localhost:6543/test",
  DIRECT_URL: "postgresql://test:test@localhost:5432/test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "dummy",
  BETTER_AUTH_SECRET: "dummy-secret-for-smoke-tests-only-0123456789",
  BETTER_AUTH_URL: `http://localhost:${PORT}`,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Build once (CI does it in its own step), then serve the production build.
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: dummyEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
