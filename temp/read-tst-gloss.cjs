const fs=require("fs");
const t=fs.readFileSync("lib/glossary/pojulife-terms.ts","utf8");
const idx=t.indexOf('slug: "tm_true_solar_time"');
console.log(t.slice(idx, idx+800));
