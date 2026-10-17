const fs = require("fs");
const path = "public/v2-landing.html";
let html = fs.readFileSync(path, "utf8");

function ensureHiddenAttr(src, idAttr) {
  const re = new RegExp(
    "(<(?:main|section|div)\\b)([^>]*\\bid=\"" + idAttr + "\"[^>]*)(>)",
    "i"
  );
  const m = src.match(re);
  if (!m) throw new Error("not found #" + idAttr);
  let mid = m[2];
  // HTML boolean attribute "hidden" as whole attr, not class overflow-hidden
  if (!/(?:^|\s)hidden(?:\s|=|>|$)/.test(m[1] + mid + m[3]) && !/(?:^|\s)hidden(?:\s|=|$)/.test(mid)) {
    // more precise: attribute boundary
  }
  const full = m[0];
  const hasAttr = /(?:\s|^)hidden(?:\s|\/|>)/.test(full.replace(/class="[^"]*"/g, 'class=""'));
  if (!hasAttr) {
    mid = mid + " hidden";
  }
  if (!/style\s*=/.test(mid)) {
    mid += ' style="display:none"';
  } else if (!/display\s*:\s*none/i.test(mid)) {
    mid = mid.replace(/style\s*=\s*"([^"]*)"/i, (a, s) => {
      const sep = (!s.trim() || s.trim().endsWith(";")) ? "" : ";";
      return 'style="' + s + sep + 'display:none"';
    });
  }
  return src.replace(re, m[1] + mid + m[3]);
}

["v2-hero", "v2-engines", "v2-pricing", "v2-scenarios", "v2-product-preview"].forEach((id) => {
  html = ensureHiddenAttr(html, id);
});

// Fix broken Ready-to-begin opening tag (missing >)
html = html.replace(
  /<section class="py-24 relative overflow-hidden animate-fade-in-up" hidden style="display:none"(\s*<div class="max-w-7xl mx-auto px-6">)/,
  '<section class="py-24 relative overflow-hidden animate-fade-in-up" hidden style="display:none"$1'.replace("$1", ">$1")
);
// clearer:
html = html.replace(
  /<section class="py-24 relative overflow-hidden animate-fade-in-up" hidden style="display:none"(\s*)<div class="max-w-7xl mx-auto px-6">/,
  '<section class="py-24 relative overflow-hidden animate-fade-in-up" hidden style="display:none">$1<div class="max-w-7xl mx-auto px-6">'
);

if ((html.match(/\$9\.99/g) || []).length) throw new Error("$9.99 still present");
if (!html.includes('id="eos-landing-v2-top"')) throw new Error("eos missing");

fs.writeFileSync(path, html, "utf8");

function describe(id) {
  const re = new RegExp("<(?:main|section|div)\\b[^>]*\\bid=\"" + id + "\"[^>]*>", "i");
  const m = html.match(re);
  if (!m) return null;
  const stripped = m[0].replace(/class="[^"]*"/g, 'class=""');
  return {
    tag: m[0].slice(0, 200),
    hasHiddenAttr: /(?:\s)hidden(?:\s|\/|>)/.test(stripped),
    hasDisplayNone: /display:\s*none/i.test(m[0]),
  };
}

const ready = html.match(/<section class="py-24 relative overflow-hidden animate-fade-in-up"[^>]*>[\s\S]{0,200}Ready to begin/);
console.log(JSON.stringify({
  hero: describe("v2-hero"),
  engines: describe("v2-engines"),
  pricing: describe("v2-pricing"),
  scenarios: describe("v2-scenarios"),
  preview: describe("v2-product-preview"),
  readySnippet: ready && ready[0].slice(0, 180),
  nineNine: (html.match(/\$9\.99/g) || []).length,
}, null, 2));
