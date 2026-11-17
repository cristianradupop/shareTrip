import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // server-admin only talks to server-app over HTTP; the sole shared code is server-app/shared (types and validators).
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^server-app(/(?!shared$).*)?$",
              message: "Import from server-app/shared only; everything else in server-app is backend code.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
