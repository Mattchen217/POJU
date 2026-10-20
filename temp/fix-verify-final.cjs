const fs=require("fs");

// Update glossary term display (user-facing SoftTermHover) away from True solar / Solar Precision
let g=fs.readFileSync("lib/glossary/pojulife-terms.ts","utf8");
const old=`slug: "tm_true_solar_time",
    traditional: "真太陽時",
    aliases: ["真太阳时"],
    polarity: "neutral",
    term: {
      zh: "曜准",
      en: "Solar Precision",
      es: "Sintonía Solar",
      de: "Solare Einstimmung",
      fr: "Syntonie Solaire",
    },`;
const neu=`slug: "tm_true_solar_time",
    traditional: "出生地校准",
    aliases: ["真太阳时", "True solar", "True Solar"],
    polarity: "neutral",
    term: {
      zh: "出生地校准",
      en: "Location adjust",
      es: "Ajuste por ubicación",
      de: "Standortanpassung",
      fr: "Ajustement selon le lieu",
    },`;
if (g.includes(old)) {
  g=g.replace(old, neu);
  fs.writeFileSync("lib/glossary/pojulife-terms.ts", g, "utf8");
  console.log("glossary term retitled");
} else {
  console.log("glossary pattern miss — trying softer");
  if (g.includes('en: "Solar Precision"')) {
    g=g.replace('en: "Solar Precision"', 'en: "Location adjust"')
      .replace('zh: "曜准"', 'zh: "出生地校准"')
      .replace('es: "Sintonía Solar"', 'es: "Ajuste por ubicación"')
      .replace('fr: "Syntonie Solaire"', 'fr: "Ajustement selon le lieu"');
    fs.writeFileSync("lib/glossary/pojulife-terms.ts", g, "utf8");
    console.log("glossary softer replace done");
  }
}

// Verify keys
for (const loc of ["en","zh","es","fr"]) {
  const j=JSON.parse(fs.readFileSync("messages/"+loc+".json","utf8"));
  const bad=[];
  const check=(label,v)=>{
    if (typeof v!=="string") return;
    if (/Pivot|POJU|True-solar|True solar|真太阳时|Personal Energy|energy matrix|Welcome to Pivot|欢迎来到 Pivot/i.test(v))
      bad.push(label+": "+v.slice(0,80));
  };
  check("welcome.title", j.poju_matrix?.card?.welcome?.title);
  check("welcome.body", j.poju_matrix?.card?.welcome?.body);
  check("welcome.loading", j.poju_matrix?.card?.welcome?.loading);
  check("hero_solar", j.poju_matrix?.card?.hero_solar);
  check("session_prep.title", j.session_prep?.welcome_title);
  check("session_prep.desc", j.session_prep?.welcome_desc);
  check("thinking", j.poju?.chat?.thinking_wait);
  check("replying", j.poju?.chat?.replying_wait);
  check("birth_title", j.poju?.chat?.birth_flow_intro_title);
  check("birth_body", j.poju?.chat?.birth_flow_intro_body);
  check("birth_cta", j.poju?.chat?.birth_flow_intro_cta_hint);
  console.log(loc, bad.length? "FAIL\n  "+bad.join("\n  ") : "OK welcome/birth chrome");
  console.log("  ", j.session_prep?.welcome_title, "|", j.poju_matrix?.card?.hero_solar, "|", j.poju?.chat?.thinking_wait);
}

// FR FAQ
const faq=fs.readFileSync("public/v2/faq-i18n.js","utf8");
const frBit=faq.slice(faq.indexOf('  fr:'), faq.indexOf('  fr:')+1);
// simpler: any course/chat between fr block
let inFr=false; let hits=[];
faq.split(/\n/).forEach((l,i)=>{
  if(/^\s*fr:\s*\{/.test(l) || /"fr"\s*:\s*\{/.test(l) || /^\s*fr:\s*$/.test(l)) inFr=true;
  if(inFr && /^\s*(en|zh|es|de):\s*\{/.test(l)) inFr=false;
  if(inFr && /\b(course|chat)\b/i.test(l)) hits.push((i+1)+": "+l.trim().slice(0,100));
});
// Detect fr block by line range ~340-450 from earlier
hits=[];
faq.split(/\n/).forEach((l,i)=>{
  if(i>=340 && i<=450 && /\b(course|chat)\b/i.test(l)) hits.push((i+1)+": "+l.trim().slice(0,100));
});
console.log("FR FAQ course/chat in 340-450:", hits.length? hits : "NONE");

// contact nav
const pathTs=fs.readFileSync("lib/i18n/pathname-without-locale.ts","utf8");
console.log("contact in LEGAL?", pathTs.includes('"contact"'));
const mainNav=fs.readFileSync("components/layout/MainNav.tsx","utf8");
console.log("MainNav five-engine only on !legal?", mainNav.includes("NAV_ITEMS") && mainNav.includes("LEGAL_NAV_ITEMS"));
console.log("MainNav has /contact?", mainNav.includes('"/contact"'));

// hero
const html=fs.readFileSync("public/v2-landing.html","utf8");
console.log("hero imgs omitted?", !/src="\/v2\/v2\.png"/.test(html) && !/src="\/v2\/V3\.png"/.test(html));
console.log("placeholder present?", html.includes("Decision dialogue preview"));
console.log("FR stage4 conversation?", html.includes('pas une <strong>conversation</strong> qui disparaît'));
