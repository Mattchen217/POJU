/** Quick layout proof — run: node scripts/prove-pchat-layout.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "../components/poju/poju-chat.css"), "utf8");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;font-size:15px}${css}
</style></head><body>
<div class="pchat">
<aside class="pchat__sidebar"><div class="pchat__brand">POJU</div>
<div class="pchat__session"><span class="pchat__session-title">Jun 9 session title</span></div></aside>
<main class="pchat__main"><div class="pchat__scroll"><div class="pchat__messages">
<div class="pchat__ai"><p id="p">Body paragraph for measurement.</p></div>
</div></div></main></div></body></html>`;

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.setContent(html, { waitUntil: "load" });
const m = await page.evaluate(() => ({
  sidebar: Math.round(document.querySelector(".pchat__sidebar").getBoundingClientRect().width),
  messagesMax: getComputedStyle(document.querySelector(".pchat__messages")).maxWidth,
  pFont: getComputedStyle(document.querySelector("#p")).fontSize,
  pWidth: Math.round(document.querySelector("#p").getBoundingClientRect().width),
  sessionFont: getComputedStyle(document.querySelector(".pchat__session")).fontSize,
}));
await browser.close();
console.log(JSON.stringify(m, null, 2));
