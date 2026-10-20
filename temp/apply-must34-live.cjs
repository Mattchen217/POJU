const fs = require("fs");

const zhWhatIsBody =
  "Eastern OS 是面向卡住抉择的多轮决策对话。以你的出生坐标结构化本次会话——不是算命。一次完整对话你会得到：对话本身；主路径与备用；可在本浏览器重开的决策报告；以及同行的 30 天同线提醒（同步提供）。针对你现在卡住的地方，一步步帮你理清楚。";
const enWhatIsBody =
  "Eastern OS is a multi-turn decision dialogue for a stuck choice. Birth coordinates structure this session—not fortune-telling. In one full run you get: the dialogue; a main path and a backup; a decision report you can reopen in this browser; and 30-day same-line reminders provided together. For where you are stuck right now, we work through it step by step.";
const esWhatIsBody =
  "Eastern OS es un diálogo multiturno de decisión para una elección atascada. Las coordenadas de nacimiento estructuran esta sesión—no es adivinación. En una corrida completa obtienes: el diálogo; una ruta principal y un respaldo; un informe de decisión que puedes reabrir en este navegador; y recordatorios de 30 días en la misma línea proporcionados juntos. Sobre lo que te tiene atorado ahora, lo vamos a aclarar paso a paso.";
const frWhatIsBody =
  "Eastern OS est un dialogue multi-tours de décision pour un choix bloqué. Les coordonnées de naissance structurent cette session—pas de voyance. En une session complète tu obtiens : le dialogue ; une voie principale et une de secours ; un rapport de décision à rouvrir dans ce navigateur ; et des rappels 30 jours sur la même ligne fournis ensemble. Sur ce qui te bloque maintenant, on clarifie étape par étape.";

function scrubWhenToCome(w) {
  if (!w) return;
  if (typeof w.heading === "string") w.heading = w.heading.replace(/Pivot|POJU/g, "Eastern OS");
  if (w.direction && typeof w.direction.description === "string") {
    w.direction.description = w.direction.description.replace(/Pivot|POJU/g, "Eastern OS");
  }
}

function patchLocale(loc, title, subtitle, body, syncroAsk) {
  const p = "messages/" + loc + ".json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.marketingSite.poju.what_is.title = title;
  j.marketingSite.poju.what_is.subtitle = subtitle;
  j.marketingSite.poju.what_is.body = body;
  j.poju.branding.feature_definition = body;
  scrubWhenToCome(j.marketingSite.poju.when_to_come);
  if (syncroAsk) j.syncro.location.asking_message = syncroAsk;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("patched", p);
}

patchLocale("zh", "什么是 Eastern OS？", "决策对话内核", zhWhatIsBody, "Syncro 需要你的位置来校准方位与本地语境。");
patchLocale("en", "What is Eastern OS?", "Decision dialogue core", enWhatIsBody, "Syncro uses your location to align directions with local context.");
patchLocale("es", "¿Qué es Eastern OS?", "Núcleo de diálogo de decisión", esWhatIsBody, null);
patchLocale("fr", "Qu’est-ce qu’Eastern OS ?", "Noyau de dialogue de décision", frWhatIsBody, null);

// glossary aliases
const glossPath = "lib/glossary/pojulife-terms.ts";
let gloss = fs.readFileSync(glossPath, "utf8");
const re = /aliases:\s*\[\s*"真太阳时"\s*,\s*"True solar"\s*,\s*"True Solar"\s*\],/;
if (!re.test(gloss)) {
  console.log("WARN: glossary aliases pattern not found");
} else {
  gloss = gloss.replace(re, "aliases: [],");
  fs.writeFileSync(glossPath, gloss, "utf8");
  console.log("patched glossary aliases");
}

const lab = "app/ops/delivery-lab/_components/LabOpsBirthForm.tsx";
let labT = fs.readFileSync(lab, "utf8");
const labFrom = "须选具体城市（真太阳时要用经纬度），不能空。";
const labTo = "须选具体城市（需经纬度以校准出生地），不能空。";
if (labT.includes(labFrom)) {
  fs.writeFileSync(lab, labT.split(labFrom).join(labTo), "utf8");
  console.log("patched LabOpsBirthForm");
} else {
  console.log("LabOpsBirthForm already clean or pattern miss");
}

// verify
function walk(o, re, path, out) {
  if (typeof o === "string") {
    if (re.test(o)) out.push(path + ": " + o.slice(0, 120));
  } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, re, path + "[" + i + "]", out));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], re, path ? path + "." + k : k, out);
}
for (const loc of ["zh", "en", "es", "fr"]) {
  const j = JSON.parse(fs.readFileSync("messages/" + loc + ".json", "utf8"));
  const a = [], b = [], c = [];
  walk(j, /真太阳时/, "", a);
  walk(j, /什么是 Pivot|What is Pivot/, "", b);
  walk(j, /true solar time|True solar/i, "", c);
  console.log(loc, "solar", a.length || "ZERO", "pivotTitle", b.length || "ZERO", "trueSolarEN", c.length || "ZERO");
  if (a.length) console.log(a);
  if (b.length) console.log(b);
  if (c.length) console.log(c);
}
const fr = JSON.parse(fs.readFileSync("messages/fr.json", "utf8"));
const frBad = [];
walk(fr, /une course complète|historique de chat|Ton chat et le rapport|ne synchronisent pas les chats|sauvegarde du chat/, "", frBad);
console.log("FR banned", frBad.length || "ZERO");
const g2 = fs.readFileSync(glossPath, "utf8");
console.log("glossary still has 真太阳时 alias?", /aliases:\s*\[[^\]]*真太阳时/.test(g2));
console.log("DONE");
