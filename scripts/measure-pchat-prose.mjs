/**
 * Measures POJU flat chat layout (.pchat__body scroll on main pane).
 * Run: node scripts/measure-pchat-prose.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const v2 = readFileSync(join(__dirname, "../styles/poju-chat-v2.css"), "utf8");
const tw = `.prose{color:#ddd;max-width:65ch}.prose p{margin:1.25em 0}`;

function shell(inner) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${tw}\n${v2}</style></head>
<body style="margin:0;font-family:system-ui,sans-serif">
<div class="pchat">
  <aside class="pchat__sidebar"><div class="pchat__sidebar-body">S</div></aside>
  <div class="pchat__main">
    <header class="pchat__header"><p class="pchat__header-title">Title</p></header>
    <div class="pchat__body">${inner}</div>
    <div class="pchat__composer"><div class="pchat__inputwrap"><textarea class="pchat__textarea" rows="1"></textarea></div></div>
  </div>
</div></body></html>`;
}

async function measure(label, html) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE,
    args: ["--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setContent(html, { waitUntil: "load" });
  const result = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        maxWidth: cs.maxWidth,
        overflowY: cs.overflowY,
        fontSize: cs.fontSize,
        className: el.className,
      };
    };
    const main = document.querySelector(".pchat__main");
    const body = document.querySelector(".pchat__body");
    const mainRect = main?.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    return {
      sidebar: pick(".pchat__sidebar"),
      mainWidth: mainRect ? Math.round(mainRect.width) : null,
      body: pick(".pchat__body"),
      bodyVsMainSameWidth:
        mainRect && bodyRect ? Math.round(mainRect.width) === Math.round(bodyRect.width) : null,
      paragraph: pick(".pchat__msg--ai p"),
      inputwrap: pick(".pchat__inputwrap"),
    };
  });
  await browser.close();
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

const plain = shell(`
  <div class="pchat__msg pchat__msg--ai">
    <p>### Action 1: Traditional Fengshui Remedy</p>
  </div>`);

await measure("Flat body (plain p)", plain);
