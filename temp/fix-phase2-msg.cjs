const fs = require("fs");

const PASTE = {
  en: {
    welcome: {
      title: "Welcome to Eastern OS",
      body: "Eastern OS uses the baseline structure calibrated from your birth coordinates to support this decision dialogue. For where you’re stuck right now, we’ll work through it step by step.",
      guide: "Type the dilemma you can’t settle yet below, then send. Your first question starts the decision session.",
      loading: "Eastern OS is getting ready…",
    },
    session_prep: {
      welcome_title: "Welcome to Eastern OS.",
      welcome_desc: "Eastern OS is your thinking partner for a stuck decision—main path, backup, and a report you can reopen, with 30-day same-line reminders *provided together*. Birth date, time, and place structure **this** decision session—not fortune-telling.",
    },
    chat: {
      thinking_wait: "Eastern OS is thinking…",
      replying_wait: "Eastern OS is composing a reply…",
      birth_flow_intro_title: "Birth details for this decision session",
      birth_flow_intro_body: "To structure this decision session, we need birth date, time, and place (and gender if asked). Saved only on this device—not on our servers. Not fortune-telling.",
      birth_flow_intro_cta_hint: "When you’ve read Eastern OS’s note above, continue here to enter birth details (saved on this device only).",
    },
    hero_solar: "Location adjust",
  },
  zh: {
    welcome: {
      title: "欢迎来到 Eastern OS",
      body: "Eastern OS 以你的出生坐标校准出的基础结构，支撑本次决策对话。针对你现在卡住的地方，一步步帮你理清楚。",
      guide: "在下方写下你暂时定不了的那个困境，然后发送。发出第一个问题，决策会话就开始了。",
      loading: "Eastern OS 正在准备…",
    },
    session_prep: {
      welcome_title: "欢迎来到 Eastern OS。",
      welcome_desc: "Eastern OS 是你卡住时的思考伙伴——主路径、备用与可重开的报告，以及同行的 30 天同线提醒（*同步提供*）。出生日期、时间与地点用于结构化**本次**决策会话——不是算命。",
    },
    chat: {
      thinking_wait: "Eastern OS 正在思考…",
      replying_wait: "Eastern OS 正在回复…",
      birth_flow_intro_title: "本次决策会话的出生信息",
      birth_flow_intro_body: "为结构化本次决策会话，需要出生日期、时间与地点（如询问则含性别）。仅保存在本机——不上服务器。不是算命。",
      birth_flow_intro_cta_hint: "请先阅读上方 Eastern OS 的说明，然后在此继续填写出生信息（仅保存在本机）。",
    },
    hero_solar: "按出生地调整",
  },
  es: {
    welcome: {
      title: "Bienvenido a Eastern OS",
      body: "Eastern OS usa la estructura base calibrada con tus coordenadas de nacimiento para sostener este diálogo de decisión. Sobre lo que te tiene atorado ahora, lo vamos a aclarar paso a paso.",
      guide: "Escribe abajo el dilema que aún no puedes decidir, luego envía. Tu primera pregunta abre la sesión de decisión.",
      loading: "Eastern OS se está preparando…",
    },
    session_prep: {
      welcome_title: "Bienvenido a Eastern OS.",
      welcome_desc: "Eastern OS es tu compañero de pensamiento para una decisión atascada—ruta principal, respaldo e informe que puedes reabrir, con recordatorios de 30 días en la misma línea *proporcionados juntos*. Fecha, hora y lugar de nacimiento estructuran **esta** sesión de decisión—no es adivinación.",
    },
    chat: {
      thinking_wait: "Eastern OS está pensando…",
      replying_wait: "Eastern OS está redactando la respuesta…",
      birth_flow_intro_title: "Datos de nacimiento para esta sesión de decisión",
      birth_flow_intro_body: "Para estructurar esta sesión de decisión, necesitamos fecha, hora y lugar de nacimiento (y género si se pide). Solo en este dispositivo—no en nuestros servidores. No es adivinación.",
      birth_flow_intro_cta_hint: "Cuando hayas leído la nota de Eastern OS arriba, continúa aquí para introducir los datos de nacimiento (solo en este dispositivo).",
    },
    hero_solar: "Ajuste por ubicación",
  },
  fr: {
    welcome: {
      title: "Bienvenue sur Eastern OS",
      body: "Eastern OS s’appuie sur la structure de base calibrée à partir de tes coordonnées de naissance pour porter ce dialogue de décision. Sur ce qui te bloque maintenant, on clarifie étape par étape.",
      guide: "Écris en bas le dilemme que tu n’arrives pas encore à trancher, puis envoie. Ta première question lance la session de décision.",
      loading: "Eastern OS se prépare…",
    },
    session_prep: {
      welcome_title: "Bienvenue sur Eastern OS.",
      welcome_desc: "Eastern OS est ton partenaire de réflexion pour une décision bloquée—voie principale, secours et rapport à rouvrir, avec rappels 30 jours sur la même ligne *fournis ensemble*. Date, heure et lieu de naissance structurent **cette** session de décision—pas de voyance.",
    },
    chat: {
      thinking_wait: "Eastern OS réfléchit…",
      replying_wait: "Eastern OS rédige sa réponse…",
      birth_flow_intro_title: "Infos de naissance pour cette session de décision",
      birth_flow_intro_body: "Pour structurer cette session de décision, il faut date, heure et lieu de naissance (et le genre si demandé). Uniquement sur cet appareil—pas sur nos serveurs. Pas de voyance.",
      birth_flow_intro_cta_hint: "Quand tu as lu la note d’Eastern OS ci-dessus, continue ici pour saisir les infos de naissance (uniquement sur cet appareil).",
    },
    hero_solar: "Ajustement selon le lieu",
  },
};

const CONTACT_STUB = {
  en: { meta: { title: "Contact — Eastern OS", description: "Questions about Eastern OS, PASS, or your account?" } },
  zh: { meta: { title: "联系我们 — Eastern OS", description: "关于 Eastern OS、PASS 或账户的问题？" } },
  es: { meta: { title: "Contacto — Eastern OS", description: "¿Preguntas sobre Eastern OS, PASS o tu cuenta?" } },
  fr: { meta: { title: "Contact — Eastern OS", description: "Questions sur Eastern OS, le PASS ou ton compte ?" } },
};

for (const loc of ["en","zh","es","fr"]) {
  const p = "messages/" + loc + ".json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const paste = PASTE[loc];

  // poju_matrix.card.welcome
  j.poju_matrix = j.poju_matrix || {};
  j.poju_matrix.card = j.poju_matrix.card || {};
  j.poju_matrix.card.welcome = j.poju_matrix.card.welcome || {};
  j.poju_matrix.card.welcome.title = paste.welcome.title;
  j.poju_matrix.card.welcome.body = paste.welcome.body;
  j.poju_matrix.card.welcome.guide = paste.welcome.guide;
  j.poju_matrix.card.welcome.loading = paste.welcome.loading;
  // keep note if present
  j.poju_matrix.card.hero_solar = paste.hero_solar;

  // true_solar labels → session language (already partly done); ensure no True solar / 真太阳时
  if (j.poju_matrix.card.true_solar_time_em) {
    const bad = /True|Solar|太阳|TSV|astronomy/i.test(j.poju_matrix.card.true_solar_time_em);
    if (bad) j.poju_matrix.card.true_solar_time_em = loc === "en" ? "session" : loc === "zh" ? "会话" : loc === "es" ? "sesión" : "session";
  }

  // session_prep
  j.session_prep = j.session_prep || {};
  j.session_prep.welcome_title = paste.session_prep.welcome_title;
  j.session_prep.welcome_desc = paste.session_prep.welcome_desc;

  // poju.chat
  j.poju = j.poju || {};
  j.poju.chat = j.poju.chat || {};
  Object.assign(j.poju.chat, paste.chat);

  // contact stub in monolith
  j.contact = CONTACT_STUB[loc];

  // Scrub remaining 真太阳时 / True-solar / True solar in welcome+birth chrome keys only
  const scrubPaths = [
    ["birth_form","true_solar_offset"],
    ["profile","upgrade","tst_diff_minutes"],
    ["poju_matrix","card","true_solar_time"],
    ["poju_matrix","card","true_solar"],
  ];
  // birth_form.true_solar_offset already location adjust — ok

  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("updated", p);
}

// Verify contact.json still PASS (no Token)
for (const loc of ["en","zh","es","fr"]) {
  const c = JSON.parse(fs.readFileSync("messages/"+loc+"/contact.json","utf8"));
  const s = JSON.stringify(c);
  console.log(loc, "contact Token?", /Token|Monthly Pass|communication nodes/.test(s), "billing:", c.billing.title);
}

console.log("phase2 messages done");
