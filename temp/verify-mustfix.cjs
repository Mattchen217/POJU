const fs=require("fs");
const faq=fs.readFileSync("public/v2/faq-i18n.js","utf8");
const landing=fs.readFileSync("public/v2-landing.html","utf8");
const en=JSON.parse(fs.readFileSync("messages/en.json","utf8"));
const zh=JSON.parse(fs.readFileSync("messages/zh.json","utf8"));
const es=JSON.parse(fs.readFileSync("messages/es.json","utf8"));
const fr=JSON.parse(fs.readFileSync("messages/fr.json","utf8"));
const contactEn=JSON.parse(fs.readFileSync("messages/en/contact.json","utf8"));

const checks=[];
function ck(name, ok, detail=""){ checks.push({name, ok, detail}); console.log((ok?"OK  ":"FAIL")+" "+name+(detail?" | "+detail:"")); }

// FAQ
ck("EN P1 no paren", !faq.includes("Core Answer（"));
ck("ES P1 Respuesta central", faq.includes("P1 · Respuesta central"));
ck("FR P1 Réponse centrale", faq.includes("P1 · Réponse centrale"));
ck("ZH P6", faq.includes("今晚与收尾") && !faq.includes("出门仪式"));
ck("ZH q9", faq.includes("购买/账单收据邮件"));
ck("q10 EN refund", faq.includes("unused purchased Passes can be refunded in PASS details"));
ck("q10 ZH refund", faq.includes("未使用的已购买 Pass 可在 PASS 详情申请退款"));
ck("no one-click anytime", !/one-click refund anytime/i.test(faq));

// Landing ES/FR
ck("ES decisiones", landing.includes("decisiones de alto riesgo"));
ck("ES no llamadas alto", !landing.includes("llamadas de alto riesgo"));
ck("ES más ajustado", landing.includes("más ajustado"));
ck("ES no más tenso", !landing.includes("más tenso"));
ck("FR session complète", landing.includes("session complète"));
ck("FR no course complète", !landing.includes("course complète"));
ck("FR bifurcations", landing.includes("bifurcations"));
ck("FR tempo near struct", /structurelle[\s\S]{0,80}bifurcations[\s\S]{0,40}tempo/.test(landing) || landing.includes("bifurcations"));
// FR chat scrub sample
ck("FR Ta conversation", landing.includes("Ta conversation et le rapport") || !landing.includes("Ton chat et le rapport"));
ck("pricing L4 EN", landing.includes("Unused one-time Passes can be refunded in PASS details"));
ck("pricing L4 ZH", landing.includes("未使用的一次性 Pass 可在 PASS 详情申请退款"));
ck("ZH roles", landing.includes("创始人兼首席执行官") && landing.includes("首席系统架构师") && landing.includes("产品与体验负责人"));
ck("hero CSS", landing.includes("Must-fix 10: hide energy/cosmic"));
ck("no Personal Energy Profile text", !landing.includes("Personal Energy Profile"));
ck("no Daily Cosmic Resonance text", !landing.includes("Daily Cosmic Resonance"));

// messages
for (const [loc,j] of [["en",en],["zh",zh],["es",es],["fr",fr]]) {
  ck(loc+" balanceAria", !!j.workspace?.passRow?.balanceAria);
  ck(loc+" buyAria", !!j.workspace?.passRow?.buyAria);
  ck(loc+" balance chip", j.workspace?.passRow?.balance === "PASS·{n}");
  ck(loc+" planPersonal", ["Subscription","订阅","Suscripción","Abonnement"].includes(j.account?.planPersonal));
  ck(loc+" planFlex", /Pass/i.test(j.account?.planFlex||""));
  ck(loc+" planTeam empty", j.account?.planTeam === "");
  ck(loc+" no true solar expl1", !/true solar|真太阳|hora solar|temps solaire vrai/i.test(j.profile?.birth_location?.explanation_1||""));
  ck(loc+" passCardHint dialogue", /dialogue|对话|diálogo/i.test(j.account?.passCardHint||""));
}
ck("contact EN PASS", contactEn.billing.title.includes("PASS"));
ck("contact no five-engine", !/Pivot|Glyph|Match|Atmos|Syncro|Token|Monthly Pass|five-engine/i.test(JSON.stringify(contactEn)));

const fail=checks.filter(c=>!c.ok);
console.log("\n"+checks.filter(c=>c.ok).length+"/"+checks.length+" passed; fails="+fail.length);
if(fail.length) fail.forEach(f=>console.log(" - "+f.name));
