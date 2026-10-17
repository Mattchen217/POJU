const fs = require("fs");
const path = "public/v2-landing.html";
let html = fs.readFileSync(path, "utf8");
const before999 = (html.match(/\$9\.99/g) || []).length;

function hideOpenTag(src, idAttr) {
  const re = new RegExp(
    "(<(?:main|section|div)\\b[^>]*\\bid=\"" + idAttr + "\"[^>]*)(>)",
    "i"
  );
  const m = src.match(re);
  if (!m) throw new Error("open tag not found for #" + idAttr);
  let open = m[1];
  if (!/\bhidden\b/.test(open)) open += " hidden";
  if (!/style\s*=/.test(open)) {
    open += ' style="display:none"';
  } else if (!/display\s*:\s*none/i.test(open)) {
    open = open.replace(/style\s*=\s*"([^"]*)"/i, (a, s) => {
      const sep = (!s.trim() || s.trim().endsWith(";")) ? "" : ";";
      return 'style="' + s + sep + 'display:none"';
    });
  }
  return src.replace(re, open + m[2]);
}

html = hideOpenTag(html, "v2-hero");
html = hideOpenTag(html, "v2-engines");
html = hideOpenTag(html, "v2-pricing");
html = hideOpenTag(html, "v2-scenarios");
html = hideOpenTag(html, "v2-product-preview");

const readyRe = /<section class="py-24 relative overflow-hidden animate-fade-in-up">(\s*<div class="max-w-7xl mx-auto px-6">\s*<div class="text-center mb-16">\s*<h2 class="text-3xl md:text-5xl font-display font-bold mb-6">Ready to begin\?<\/h2>)/;
if (!readyRe.test(html)) throw new Error("Ready to begin section not found");
html = html.replace(
  readyRe,
  '<section class="py-24 relative overflow-hidden animate-fade-in-up" hidden style="display:none"$1'
);

html = html.split("$9.99").join("$19.99");

if (!html.includes('id="eos-landing-v2-top"')) throw new Error("eos-landing-v2-top missing");
if ((html.match(/\$9\.99/g) || []).length !== 0) throw new Error("still has $9.99");

fs.writeFileSync(path, html, "utf8");

function tagHasHide(id) {
  const re = new RegExp("<(?:main|section|div)\\b[^>]*\\bid=\"" + id + "\"[^>]*>", "i");
  const m = html.match(re);
  if (!m) return false;
  return /\bhidden\b/.test(m[0]) && /display:\s*none/i.test(m[0]);
}

console.log(JSON.stringify({
  before999,
  after999: (html.match(/\$9\.99/g) || []).length,
  count1999: (html.match(/\$19\.99/g) || []).length,
  eosOk: html.includes('id="eos-landing-v2-top"'),
  heroHidden: tagHasHide("v2-hero"),
  enginesHidden: tagHasHide("v2-engines"),
  pricingHidden: tagHasHide("v2-pricing"),
  scenariosHidden: tagHasHide("v2-scenarios"),
  previewHidden: tagHasHide("v2-product-preview"),
  readyHidden: /Ready to begin\?<\/h2>/.test(html) && /animate-fade-in-up" hidden style="display:none"[\s\S]{0,400}Ready to begin/.test(html),
}, null, 2));
