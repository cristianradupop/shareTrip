import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

// Lints the root-level files only (e2e/, playwright.config.ts, vitest.config.mts); server-admin has its own config.
const eslintConfig = defineConfig([
  ...nextTs,
  globalIgnores(["server-admin/**", "node_modules/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
