const fs = require("fs");

// Verify FR FAQ remaining course/chat
const faq = fs.readFileSync("public/v2/faq-i18n.js", "utf8");
// Extract FR block roughly
const frStart = faq.indexOf("\n  fr:");
const frEnd = faq.indexOf("\n};", frStart);
const fr = faq.slice(frStart, frEnd > 0 ? frEnd : undefined);
const lines = fr.split(/\n/);
console.log("==== FR course/chat hits ====");
lines.forEach((l,i) => {
  if (/\bcourse\b|\bchat\b/i.test(l)) console.log(l.trim().slice(0,220));
});

// Verify landing
const html = fs.readFileSync("public/v2-landing.html","utf8");
console.log("==== landing FR chat/course ====");
const htmlLines = html.split(/\n/);
htmlLines.forEach((l,i) => {
  if (/fr:|stage4|c1\.body|course|\bchat\b/i.test(l) && (/\bcourse\b|\bchat\b|conversation|placeholder|v2\.png|V3\.png/i.test(l))) {
    if (i > 2300) console.log((i+1)+": "+l.trim().slice(0,180));
  }
});
console.log("has placeholder?", html.includes("v2-product-placeholder__title"));
console.log("still has v2.png img?", /src="\/v2\/v2\.png"/.test(html));
console.log("still has V3.png img?", /src="\/v2\/V3\.png"/.test(html));
