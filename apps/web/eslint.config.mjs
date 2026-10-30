import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { bangladeshDayConfig, deviceDayImportConfig } from "@vesta/shared/eslint/bangladesh-day";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  bangladeshDayConfig, // no server/device-clock days; see #115
  deviceDayImportConfig,
  {
    rules: {
      // Next 16 ESLint defaults are stricter than legacy `next lint`; keep warnings until cleaned up.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "@next/next/no-html-link-for-pages": "warn",
      "react-compiler/react-compiler": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
