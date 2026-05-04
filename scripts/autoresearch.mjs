// @ts-check
/**
 * Autoresearch automation script using Playwright.
 *
 * Usage:
 *   node scripts/autoresearch.mjs [output-dir]
 *
 * It starts a local preview server, opens the app in a headless browser,
 * loads each benchmark Recall Graph IR, and exports PNGs.
 */

import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const benchmarks = [
  "hierarchy_tree.json",
  "hub_spoke.json",
  "linear_pipeline.json",
  "branching_workflow.json",
  "mixed_complexity.json",
];

const outputDir = resolve(process.argv[2] || "research-output/iteration-0");

async function main() {
  // Ensure output dir exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Start preview server (serve the dist/ folder)
  const server = await createServer({
    root,
    configFile: resolve(root, "vite.config.ts"),
    server: { port: 0, host: true },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  const url = `http://localhost:${port}`;
  console.log(`Server running at ${url}`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto(url, { waitUntil: "networkidle" });
  // Wait for Excalidraw to initialize
  await page.waitForFunction(() => {
    return !!(window.__RECALL_API__ && window.__RECALL_API__.loadGraph);
  });

  for (const name of benchmarks) {
    const benchPath = resolve(root, "benchmarks", name);
    const json = JSON.parse(readFileSync(benchPath, "utf-8"));

    console.log(`Loading ${name}...`);
    const result = await page.evaluate(async (data) => {
      // @ts-ignore
      return await window.__RECALL_API__.loadGraph(data);
    }, json);

    if (!result.success) {
      console.error(`Failed to load ${name}:`, result.errors);
      continue;
    }

    // Wait a moment for layout/render to settle
    await page.waitForTimeout(1200);

    // Dump scene snapshot for debugging
    const snapshot = await page.evaluate(() => {
      // @ts-ignore
      return window.__RECALL_API__.getSceneSnapshot();
    });
    const snapshotPath = resolve(outputDir, name.replace(/\.json$/, "-snapshot.json"));
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

    // Export PNG via automation API
    const pngName = name.replace(/\.json$/, ".png");
    await page.evaluate(async (filename) => {
      // @ts-ignore
      await window.__RECALL_API__.exportPNG(filename);
    }, pngName);

    // Wait for download to complete (the page triggers a download)
    // Since exportPNG uses a client-side download, we can't easily capture it in Playwright.
    // Instead, we'll use the page's canvas to capture a screenshot.
    const screenshotPath = resolve(outputDir, pngName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  -> Saved screenshot to ${screenshotPath}`);
  }

  await browser.close();
  await server.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
