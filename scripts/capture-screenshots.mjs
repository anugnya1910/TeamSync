// Captures UI screenshots for the docs: node scripts/capture-screenshots.mjs <baseUrl> <outDir> [path ...]
// Each path is captured in light & dark, desktop (1280×800) & mobile (390×844).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const [baseUrl = "http://localhost:3000", outDir = "docs/screenshots/phase1", ...paths] = process.argv.slice(2);
const targets = paths.length ? paths : ["/", "/login", "/signup", "/dev/design"];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];
for (const scheme of ["light", "dark"]) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: scheme,
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    for (const p of targets) {
      await page.goto(baseUrl + p, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const slug = p === "/" ? "landing" : p.replace(/^\//, "").replace(/[/[\]]/g, "-");
      const file = path.join(outDir, `${slug}-${vp.name}-${scheme}.png`);
      await page.screenshot({ path: file, fullPage: p === "/dev/design" || p === "/" });
      console.log("saved", file);
    }
    await ctx.close();
  }
}
await browser.close();
