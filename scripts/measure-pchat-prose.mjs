/**
 * Measures POJU chat layout per poju-chat.css spec.
 * Run: node scripts/measure-pchat-prose.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "../components/poju/poju-chat.css"), "utf8");
const tw = `.prose{color:#ddd;max-width:65ch}.prose p{margin:1.25em 0}`;

function shell(inner) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${tw}\n${css}</style></head>
<body style="margin:0;font-family:system-ui,sans-serif">
<div class="pchat">
  <aside class="pchat__sidebar"><div class="pchat__sidebar-body">S</div></aside>
  <div class="pchat__main">
    <header class="pchat__header"><p class="pchat__header-title">Title</p></header>
    <div class="pchat__scroll">
      <div class="pchat__messages">${inner}</div>
    </div>
    <div class="pchat__inputbar"><div class="pchat__inputwrap"><textarea class="pchat__textarea" rows="1"></textarea></div></div>
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
    const scroll = document.querySelector(".pchat__scroll");
    const mainRect = main?.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    return {
      sidebar: pick(".pchat__sidebar"),
      messages: pick(".pchat__messages"),
      ai: pick(".pchat__ai"),
      paragraph: pick(".pchat__ai p"),
      inputwrap: pick(".pchat__inputwrap"),
      mainWidth: mainRect ? Math.round(mainRect.width) : null,
      scrollWidth: scrollRect ? Math.round(scrollRect.width) : null,
      scrollOverflowY: scroll ? getComputedStyle(scroll).overflowY : null,
    };
  });
  await browser.close();
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

const plain = shell(`
  <div class="pchat__ai">
    <p>### Action 1: Traditional Fengshui Remedy</p>
    <p>Body paragraph text for width measurement.</p>
  </div>`);

await measure("Spec layout (poju-chat.css)", plain);
