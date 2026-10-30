import tseslint from "typescript-eslint";
import { bangladeshDayConfig } from "./eslint/bangladesh-day.mjs";

export default [
  tseslint.configs.base,
  bangladeshDayConfig,
  { ignores: ["node_modules/**", "prisma/migrations/**", "coverage/**"] },
];
