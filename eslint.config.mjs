import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
    // Ignore folders with generated or third-party code
  {
    ignores: [
      "node_modules/**",
      "src/generated/**", // your prisma / wasm generated files
      ".next/**",         // Next.js build folder
    ],
  },
  
];

export default eslintConfig;
