import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    ".codex-remote-attachments/**",
    "coverage/**",
    "drizzle/**",
  ]),
  {
    files: [
      "src/app/app/agenda/agenda-calendar.tsx",
      "src/app/app/agenda/customer-autofill.tsx",
      "src/app/app/customers/customer-directory-search.tsx",
    ],
    rules: {
      // These three interactive search/calendar components intentionally reset
      // local UI state when their external query inputs change.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
