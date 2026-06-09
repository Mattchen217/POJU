/**
 * Runtime proof: PojuChat DOM + computed widths (isolated HTML, same CSS as production component).
 * Run: node scripts/prove-pchat-dom.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "../components/poju/poju-chat.css"), "utf8");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
.prose{max-width:65ch;color:#ccc}
${css}
</style></head><body>
<div class="pchat">
  <aside class="pchat__sidebar"><div class="pchat__brand">POJU</div></aside>
  <main class="pchat__main">
    <header class="pchat__header"><span class="pchat__header-title">Test</span></header>
    <div class="pchat__scroll">
      <div class="pchat__messages">
        <div class="pchat__msg pchat__msg--ai">
          <div class="pchat__ai"><p id="probe">Measurement paragraph for width proof.</p></div>
        </div>
      </div>
    </div>
    <div class="pchat__inputbar"><div class="pchat__inputwrap"><textarea class="pchat__textarea"></textarea></div></div>
  </main>
</div>
</body></html>`;

const outDir = join(__dirname, "../tmp/pchat-proof");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "proof.html"), html);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: EDGE,
  args: ["--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setContent(html, { waitUntil: "load" });

const domTree = await page.evaluate(() => {
  const root = document.querySelector(".pchat");
  if (!root) return { error: "NO .pchat ROOT" };
  function node(el, depth = 0) {
    if (!el || depth > 6) return "";
    const tag = el.tagName.toLowerCase();
    const cls = el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : "";
    const line = `${"  ".repeat(depth)}<${tag}${cls}>`;
    return [line, ...Array.from(el.children).map((c) => node(c, depth + 1))].join("\n");
  }
  return node(root);
});

const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      exists: true,
      width: Math.round(r.width),
      maxWidth: cs.maxWidth,
      fontSize: cs.fontSize,
      overflowY: cs.overflowY,
    };
  };
  return {
    hasPchatRoot: !!document.querySelector(".pchat"),
    hasMessages: !!document.querySelector(".pchat__messages"),
    sidebar: pick(".pchat__sidebar"),
    messages: pick(".pchat__messages"),
    ai: pick(".pchat__ai"),
    paragraph: pick(".pchat__ai p"),
    scroll: pick(".pchat__scroll"),
  };
});

await page.screenshot({ path: join(outDir, "dom-screenshot.png"), fullPage: false });
await browser.close();

console.log("=== DOM TREE (from .pchat) ===");
console.log(domTree);
console.log("\n=== COMPUTED METRICS @ 1440px viewport ===");
console.log(JSON.stringify(metrics, null, 2));
console.log(`\nArtifacts: ${outDir}`);
