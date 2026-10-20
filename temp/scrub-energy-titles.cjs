const fs=require("fs");
const patches={
  en:{
    "base_analysis_view.eyebrow":"Decision session structure",
    "base_analysis_view.title":"Decision session structure",
    "wait_ritual.bazi.subtitle":"Structuring your decision session… Deep reasoning in progress—please wait (about 5 minutes).",
  },
  zh:{
    "base_analysis_view.eyebrow":"决策会话结构",
    "base_analysis_view.title":"决策会话结构",
    "wait_ritual.bazi.subtitle":"正在结构化本次决策会话…深度推理进行中，请稍候（约 5 分钟）。",
  },
  es:{
    "base_analysis_view.eyebrow":"Estructura de la sesión de decisión",
    "base_analysis_view.title":"Estructura de la sesión de decisión",
    "wait_ritual.bazi.subtitle":"Estructurando tu sesión de decisión… Razonamiento profundo en curso—espera un momento (unos 5 minutos).",
  },
  fr:{
    "base_analysis_view.eyebrow":"Structure de la session de décision",
    "base_analysis_view.title":"Structure de la session de décision",
    "wait_ritual.bazi.subtitle":"Structuration de ta session de décision… Raisonnement approfondi en cours—patiente un instant (environ 5 minutes).",
  },
};
function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
for (const loc of Object.keys(patches)) {
  const p=`messages/${loc}.json`;
  const j=JSON.parse(fs.readFileSync(p,"utf8"));
  for (const [k,v] of Object.entries(patches[loc])) setPath(j,k,v);
  // also clear atmos hero if still set
  if (j.workspace?.blurb) j.workspace.blurb.atmos = "";
  if (j.workspace?.atmos?.hero) j.workspace.atmos.hero.heading = "";
  fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n","utf8");
  console.log("patched",loc);
}
