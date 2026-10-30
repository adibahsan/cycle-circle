import tseslint from "typescript-eslint";
import { bangladeshDayConfig, bangladeshDayServerConfig, dateFnsLocalDayConfig } from "./eslint/bangladesh-day.mjs";

export default [
  tseslint.configs.base,
  bangladeshDayConfig,
  bangladeshDayServerConfig,
  dateFnsLocalDayConfig(["src/**/*.{ts,tsx,mjs,js}"]),
  { ignores: ["node_modules/**", "prisma/migrations/**", "coverage/**"] },
];
