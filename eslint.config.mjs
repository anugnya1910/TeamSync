import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const adminImportRestriction = {
  paths: [
    {
      name: "@/lib/supabase/admin",
      message:
        "The service-role client bypasses RLS. Only /api/cron/* and the account-deletion server flow may import it.",
    },
  ],
  patterns: [
    {
      group: ["**/lib/supabase/admin", "**/supabase/admin"],
      message: "The service-role client may not be imported here.",
    },
  ],
};

/**
 * Custom rule: forbid the admin client in any file that starts with 'use client'
 * (`no-restricted-imports` cannot see directives, so this small inline rule does).
 */
const teamsyncPlugin = {
  rules: {
    "no-admin-in-client": {
      meta: { type: "problem", schema: [] },
      create(context) {
        let isClient = false;
        return {
          Program(node) {
            const first = node.body[0];
            isClient =
              first?.type === "ExpressionStatement" &&
              first.expression.type === "Literal" &&
              first.expression.value === "use client";
          },
          ImportDeclaration(node) {
            if (isClient && /(^|\/)supabase\/admin$/.test(String(node.source.value))) {
              context.report({
                node,
                message: "Client components must never import the service-role Supabase client.",
              });
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { teamsync: teamsyncPlugin },
    rules: {
      "teamsync/no-admin-in-client": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", adminImportRestriction] },
  },
  {
    files: ["src/lib/logger.ts", "scripts/**", "tests/**"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "src/types/database.ts",
  ]),
]);

export default eslintConfig;
