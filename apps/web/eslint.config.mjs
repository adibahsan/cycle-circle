import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { bangladeshDayComponentConfig, bangladeshDayConfig, dateFnsLocalDayConfig } from "@vesta/shared/eslint/bangladesh-day";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  bangladeshDayConfig, // no server/device-clock days; see #115
  bangladeshDayComponentConfig(["src/components/**/*.{ts,tsx}"]), // components take today/now as props; see #220
  dateFnsLocalDayConfig(["src/app/api/**/*.{ts,tsx}", "src/app/actions/**/*.{ts,tsx}", "src/lib/server/**/*.{ts,tsx}"]), // server code: no local-time day functions
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
