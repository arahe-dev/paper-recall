// @ts-check
import { chromium } from "playwright";
import { preview } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

async function main() {
  const server = await preview({
    root,
    configFile: resolve(root, "vite.config.ts"),
    preview: { port: 4173, host: true },
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });

  page.on("console", (msg) => console.log("[browser]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!(window.__RECALL_API__ && window.__RECALL_API__.loadScene), { timeout: 30000 });

  const json = JSON.parse(readFileSync(resolve(root, "control-systems-reduction", "step-01-original.excalidraw.json"), "utf-8"));

  await page.evaluate((scene) => {
    window.__RECALL_API__.loadScene(scene);
  }, json);

  await page.waitForTimeout(1000);

  const sceneInfo = await page.evaluate(() => {
    const api = window.__RECALL_API__;
    const snap = api.getSceneSnapshot();
    const els = snap.elements;
    return {
      elementCount: els.length,
      types: els.reduce((acc, el) => { acc[el.type] = (acc[el.type]||0)+1; return acc; }, {}),
      bounds: els.length > 0 ? els.map(e => ({id: e.id, type: e.type, x: e.x, y: e.y, w: e.width, h: e.height})) : [],
      appState: snap.appState,
    };
  });

  console.log("Scene info:", JSON.stringify(sceneInfo, null, 2));

  await page.screenshot({ path: resolve(root, "control-systems-reduction", "png", "debug.png"), fullPage: false });

  await browser.close();
  await new Promise((res) => server.httpServer.close(res));
}

main().catch((err) => { console.error(err); process.exit(1); });
