const fs = require("fs");
const { execSync } = require("child_process");

function walk(o, p, re, out) {
  if (typeof o === "string") {
    if (re.test(o)) out.push(p + ": " + o.slice(0, 140));
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => walk(v, p + "[" + i + "]", re, out));
  } else if (o && typeof o === "object") {
    for (const k of Object.keys(o)) walk(o[k], p ? p + "." + k : k, re, out);
  }
}

const fr = JSON.parse(fs.readFileSync("messages/fr.json", "utf8"));
const zh = JSON.parse(fs.readFileSync("messages/zh.json", "utf8"));
const en = JSON.parse(fs.readFileSync("messages/en.json", "utf8"));

const frCourse = [], frChat = [], zhSolar = [], enBad = [];
walk(fr, "", /\bcourse\b/, frCourse);
walk(fr, "", /\bchats?\b/i, frChat);
walk(zh, "", /真太阳时/, zhSolar);
walk(en, "", /True-solar|Welcome to Pivot/, enBad);

console.log("=== GREP PROOF ===");
console.log("FR course:", frCourse.length ? frCourse : "ZERO");
console.log("FR chat product:", frChat.length ? frChat : "ZERO");
console.log("ZH 真太阳时:", zhSolar.length ? zhSolar : "ZERO");
console.log("EN True-solar/Pivot welcome:", enBad.length ? enBad : "ZERO");
console.log("en.session_prep.welcome_title:", en.session_prep.welcome_title);
console.log("en.poju_matrix.card.welcome.title:", en.poju_matrix.card.welcome.title);
console.log("en.poju_matrix.card.hero_solar:", en.poju_matrix.card.hero_solar);
console.log("zh.hero_solar:", zh.poju_matrix.card.hero_solar);
console.log("fr.flexFeatures[0]:", fr.passPurchase.flexFeatures[0]);
console.log("fr.personalFeatures[0]:", fr.passPurchase.personalFeatures[0]);
console.log("fr.side_isolation_title:", fr.birth_picker.side_isolation_title);
console.log("fr.promises.card1 starts:", fr.home.promises.card1.content.slice(0, 40));

const faq = fs.readFileSync("public/v2/faq-i18n.js", "utf8");
// Extract fr section roughly
const frStart = faq.indexOf('fr: {');
const frChunk = faq.slice(frStart, frStart + 25000);
const faqHits = [...frChunk.matchAll(/\bcourse\b|\bchats?\b/gi)].map((m) => m[0] + " @" + m.index);
console.log("faq-i18n FR course/chat hits:", faqHits.length ? faqHits : "ZERO");

const landing = fs.readFileSync("public/v2-landing.html", "utf8");
const landFrHits = [];
// find fr privacy/pricing
for (const re of [/une course/g, /Ton chat/g, /historique de chat/g, /True-solar/g, /Welcome to Pivot/g]) {
  let m;
  while ((m = re.exec(landing))) landFrHits.push(m[0]);
}
console.log("landing banned hits:", landFrHits.length ? landFrHits : "ZERO");

const mb = fs.readFileSync("components/poju/MessageBubble.tsx", "utf8");
const cp = fs.readFileSync("components/chat/chat-page-client.tsx", "utf8");
console.log("MessageBubble title:", (mb.match(/pchat__welcome-title">([^<]+)/) || [])[1]);
console.log("chat-page title:", (cp.match(/Welcome to [^<]+/) || [])[0]);
