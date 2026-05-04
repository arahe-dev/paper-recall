// @ts-check
/**
 * Phase 2 autoresearch: render all benchmarks with all presets.
 *
 * Usage:
 *   node scripts/phase2-autoresearch.mjs
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

const presets = [
  "readable_compact",
  "readable_spacious",
  "readable_long",
  "readable_radial",
  "readable_dense",
];

const outputDir = resolve(root, "research-output", "phase2");

async function main() {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    return !!(window.__RECALL_API__ && window.__RECALL_API__.loadGraph);
  });

  const results = [];

  for (const preset of presets) {
    for (const name of benchmarks) {
      const benchPath = resolve(root, "benchmarks", name);
      const json = JSON.parse(readFileSync(benchPath, "utf-8"));
      json.layout = json.layout || {};
      json.layout.style = preset;

      console.log(`Loading ${name} with preset ${preset}...`);
      const result = await page.evaluate(async (data) => {
        // @ts-ignore
        return await window.__RECALL_API__.loadGraph(data);
      }, json);

      if (!result.success) {
        console.error(`  Failed:`, result.errors);
        continue;
      }

      await page.waitForTimeout(1200);

      const pngName = `${preset}__${name.replace(/\.json$/, ".png")}`;
      const screenshotPath = resolve(outputDir, pngName);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  -> Saved ${screenshotPath}`);

      // Also save snapshot for metrics
      const snapshot = await page.evaluate(() => {
        // @ts-ignore
        return window.__RECALL_API__.getSceneSnapshot();
      });
      const snapshotPath = resolve(outputDir, `${preset}__${name.replace(/\.json$/, "-snapshot.json")}`);
      writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

      // Compute metrics
      const elements = snapshot.elements || [];
      const nodes = elements.filter((e) => e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond");
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      }
      const width = maxX - minX;
      const height = maxY - minY;
      const fitZoom = Math.min(1600 / width, 1200 / height).toFixed(3);

      results.push({ preset, benchmark: name.replace(/\.json$/, ""), nodeCount: nodes.length, width: Math.round(width), height: Math.round(height), fitZoom });
    }
  }

  await browser.close();
  await server.close();

  // Write summary CSV
  const csv = ["preset,benchmark,nodes,width,height,fitZoom", ...results.map(r => `${r.preset},${r.benchmark},${r.nodeCount},${r.width},${r.height},${r.fitZoom}`)].join("\n");
  writeFileSync(resolve(outputDir, "metrics.csv"), csv);
  console.log("\nPhase 2 complete. Metrics saved to metrics.csv");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
