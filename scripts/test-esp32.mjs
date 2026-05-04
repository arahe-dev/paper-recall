// @ts-check
import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(".");
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

const json = JSON.parse(readFileSync(resolve(root, "benchmarks", "esp32_hub.json"), "utf-8"));
const result = await page.evaluate(async (data) => {
  // @ts-ignore
  return await window.__RECALL_API__.loadGraph(data);
}, json);

if (!result.success) {
  console.error("Failed:", result.errors);
  await browser.close();
  await server.close();
  process.exit(1);
}

await page.waitForTimeout(1200);

// Save screenshot
await page.screenshot({ path: resolve(root, "research-output", "iteration-arrow-fix", "esp32_hub.png"), fullPage: false });

// Verify arrows
const snap = await page.evaluate(() => {
  // @ts-ignore
  return window.__RECALL_API__.getSceneSnapshot();
});
const arrows = snap.elements.filter((e) => e.type === "arrow");
let ok = 0, bad = 0;
for (const a of arrows) {
  const pts = a.points;
  const dx = pts[1][0] - pts[0][0];
  const dy = pts[1][1] - pts[0][1];
  if (Math.sqrt(dx*dx + dy*dy) > 5) ok++; else bad++;
}
console.log("ESP32 hub: arrows=" + arrows.length + " ok=" + ok + " bad=" + bad);

await browser.close();
await server.close();
