import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const MOCK_GEMINI_PORT = 3999;
/** App server wired to the mock Gemini (see webServer); used by @ai-mock specs. */
export const AI_MOCK_BASE_URL = `http://localhost:${PORT + 1}`;

/**
 * E2E config (PHASE_1 Step 12). Specs needing a real Supabase stack (sign-up, onboarding, app
 * shell) only run when E2E_SUPABASE=1 — CI sets this after `supabase start`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  // Default server has no AI key (fallback path). A second server on PORT+1 talks to a local
  // Gemini stand-in so @ai-mock specs exercise the real AI code path without a key or network.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `npm run start -- --port ${PORT}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { GEMINI_API_KEY: "" },
        },
        {
          command: "node tests/e2e/mock-gemini.mjs",
          url: `http://127.0.0.1:${MOCK_GEMINI_PORT}`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          env: { MOCK_GEMINI_PORT: String(MOCK_GEMINI_PORT) },
        },
        {
          command: `npm run start -- --port ${PORT + 1}`,
          url: AI_MOCK_BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { GEMINI_API_KEY: "e2e-mock-key", GEMINI_BASE_URL: `http://127.0.0.1:${MOCK_GEMINI_PORT}` },
        },
      ],
});
