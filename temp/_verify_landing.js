const fs = require("fs");
const h = fs.readFileSync("public/v2-landing.html", "utf8");
const start = h.indexOf('id="eos-landing-v2-top"');
const end = h.indexOf("</div>\n<nav ", start);
const block = h.slice(start, end > 0 ? end : start + 15000);
const fiveTag = h.match(/<section[^>]*id="v2-engines"[^>]*>/);
const fiveTitleLine = h.match(/id="v2-engines-title"[^>]*>[\s\S]*?<\/h2>/);
console.log(JSON.stringify({
  eosHasUnstick: /Unstick it/i.test(block),
  eosHasPoKai: block.includes("破开它"),
  eosHas1999: /\$19\.99/.test(block),
  eosHas999: /\$9\.99/.test(block),
  eosWorkbenchHtml: /eos-v2-workbench|workbench tour|Workbench/i.test(block),
  file999: (h.match(/\$9\.99/g) || []).length,
  enginesTagHidden: fiveTag ? (/\bhidden\b/.test(fiveTag[0].replace(/class="[^"]*"/,"")) && /display:\s*none/i.test(fiveTag[0])) : false,
  fiveTitleStillInFile: !!fiveTitleLine,
  fiveTitleText: fiveTitleLine && fiveTitleLine[0].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(),
  workbenchCssOnly: (h.match(/workbench/gi) || []).length,
}, null, 2));
