// @ts-check
import { chromium } from "playwright";
import { preview } from "vite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const boardsDir = resolve(root, "control-systems-reduction");
const outDir = resolve(boardsDir, "png");

import { mkdirSync } from "fs";
mkdirSync(outDir, { recursive: true });

const boardFiles = readdirSync(boardsDir)
  .filter((f) => f.endsWith(".excalidraw.json"))
  .sort();

async function main() {
  const server = await preview({
    root,
    configFile: resolve(root, "vite.config.ts"),
    preview: { port: 4173, host: true },
  });
  const url = `http://localhost:4173`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  page.on("console", (msg) => console.log("[browser]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!(window.__RECALL_API__ && window.__RECALL_API__.loadScene), { timeout: 30000 });

  for (const file of boardFiles) {
    const json = JSON.parse(readFileSync(resolve(boardsDir, file), "utf-8"));

    await page.evaluate((scene) => {
      window.__RECALL_API__.loadScene(scene);
    }, json);

    await page.waitForTimeout(2000);

    const base = file.replace(/\.excalidraw\.json$/, "");
    const pngPath = resolve(outDir, `${base}.png`);
    await page.screenshot({ path: pngPath, fullPage: false });
    console.log(`Saved ${base}.png`);
  }

  await browser.close();
  await new Promise((res) => server.httpServer.close(res));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
