const fs=require("fs");
console.log("SHA tip evidence");
// FR
const faq=fs.readFileSync("public/v2/faq-i18n.js","utf8").split(/\n/);
[351,356,393,402,403,435].forEach(n=>console.log("FAQ"+n+": "+(faq[n-1]||"").trim().slice(0,120)));
const html=fs.readFileSync("public/v2-landing.html","utf8");
console.log("stage4 FR:", (html.match(/stage4\.youGet": "[^"]*conversation[^"]*/)||[])[0]);
console.log("privacy FR C1 starts Ta conversation:", /"c1\.body": "Ta conversation/.test(html));
console.log("carousel v2/V3/v4 src gone:", !/src="\/v2\/[Vv][234]\.png"/.test(html));
console.log("placeholder:", html.includes("Decision dialogue preview"));
for (const loc of ["en","zh","es","fr"]) {
  const j=JSON.parse(fs.readFileSync("messages/"+loc+".json","utf8"));
  console.log(loc, "|", j.session_prep.welcome_title, "|", j.poju_matrix.card.hero_solar, "|", j.poju.chat.thinking_wait);
}
const c=JSON.parse(fs.readFileSync("messages/en/contact.json","utf8"));
console.log("contact billing:", c.billing.title, "| Token?", /Token|Monthly Pass/.test(JSON.stringify(c)));
console.log("LEGAL contact:", fs.readFileSync("lib/i18n/pathname-without-locale.ts","utf8").includes('"contact"'));
