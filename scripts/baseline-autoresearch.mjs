// @ts-check
/**
 * Baseline autoresearch script: render benchmarks and save PNG + scene JSON.
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

const outputDir = resolve(process.argv[2] || "research-output/iteration-latest");

async function main() {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const server = await createServer({
    root,
    configFile: resolve(root, "vite.config.ts"),
    server: { port: 0, host: true },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  const url = `http://localhost:${port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!(window.__RECALL_API__ && window.__RECALL_API__.loadGraph));

  for (const name of benchmarks) {
    const benchPath = resolve(root, "benchmarks", name);
    const json = JSON.parse(readFileSync(benchPath, "utf-8"));

    const result = await page.evaluate(async (data) => {
      return await window.__RECALL_API__.loadGraph(data);
    }, json);

    if (!result.success) {
      console.error(`Failed ${name}:`, result.errors);
      continue;
    }

    await page.waitForTimeout(1200);

    const base = name.replace(/\.json$/, "");
    const pngPath = resolve(outputDir, `${base}.png`);
    await page.screenshot({ path: pngPath, fullPage: false });

    const snapshot = await page.evaluate(() => window.__RECALL_API__.getSceneSnapshot());
    writeFileSync(resolve(outputDir, `${base}.excalidraw.json`), JSON.stringify(snapshot, null, 2));

    console.log(`Saved ${base}.png + ${base}.excalidraw.json`);
  }

  await browser.close();
  await server.close();
  console.log("Done.", outputDir);
}

main().catch((err) => { console.error(err); process.exit(1); });
