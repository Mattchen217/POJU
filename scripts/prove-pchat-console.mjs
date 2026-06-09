/**
 * Print the exact F12 console check for .pchat__messages max-width.
 * Run: node scripts/prove-pchat-console.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "../components/poju/poju-chat.css"), "utf8");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="pchat"><aside class="pchat__sidebar"></aside><main class="pchat__main">
<div class="pchat__scroll"><div class="pchat__messages"><p>probe</p></div></div>
</main></div></body></html>`;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: EDGE,
  args: ["--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setContent(html, { waitUntil: "load" });

const maxWidth = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".pchat__messages")).maxWidth,
);

await page.screenshot({
  path: join(__dirname, "../tmp/pchat-proof/console-proof-960.png"),
  fullPage: false,
});
await browser.close();

console.log('getComputedStyle(document.querySelector(".pchat__messages")).maxWidth');
console.log(`→ "${maxWidth}"`);
