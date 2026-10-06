import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".publish/**",
    ".tmp/**",
    ".tmp*/**",
    ".firecrawl/**",
    // Backend uses Python/Vue; public contains vendored browser runtimes, not Next source.
    "backend/**",
    "public/**",
    "deploy/**",
  ]),
]);

export default eslintConfig;
