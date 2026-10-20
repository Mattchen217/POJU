const fs = require("fs");

const COPIES = {
  glyph: {
    en: {
      subtitle: "A quick reflective mirror",
      body: "Glyph is a short reflective draw for moments when a full decision session is more than you need. It pairs one classical Eastern metaphor with where you are stuck, then unpacks how that image meets your situation. Not a prediction—a structured prompt for clearer self-awareness before you choose.",
    },
    zh: {
      subtitle: "快速映照",
      body: "Glyph 是一次短促的映照：当完整决策对话对这一刻来说太重时，用一则东方经典隐喻对齐你卡住的地方，再拆开这幅象与当下处境的关系。不是预测——而是帮你看清、再做选择的结构化提示。",
    },
    es: {
      subtitle: "Un espejo reflexivo breve",
      body: "Glyph es una lectura breve para cuando una sesión de decisión completa es más de lo que este momento pide. Une una metáfora clásica oriental con aquello en lo que estás atascado y desglosa cómo esa imagen habla de tu situación. No es una predicción: es un marco estructurado para verse con más claridad antes de elegir.",
    },
    fr: {
      subtitle: "Un miroir réflexif court",
      body: "Glyph est un tirage réflexif court quand une session de décision complète est trop pour l’instant. Il associe une métaphore classique orientale à ce qui te bloque, puis déplie comment cette image croise ta situation. Pas une prédiction—un cadre structuré pour y voir plus clair avant de choisir.",
    },
  },
  syncro: {
    en: {
      subtitle: "24-hour timing & direction",
      body: "Syncro is a location-aware 24-hour map for one concrete task. Using your current place and session context, it rates eight directions by support vs friction—Open, Following, Stillwater, Crosscurrent, Undertow—so you can choose when and which way to move. Not fortune-telling: timing and orientation for the next day of work.",
    },
    zh: {
      subtitle: "24 小时时机与方位",
      body: "Syncro 是面向一件具体事务的、带位置语境的 24 小时地图。结合你当下所在地与会话情境，它在八个方位上标出顺势、应时、守静、横阻与险滞，帮你选择何时、朝哪边推进。不是择吉——是接下来一天怎么动更顺的时机与方位参考。",
    },
    es: {
      subtitle: "Momento y dirección a 24 h",
      body: "Syncro es un mapa de 24 horas con contexto de ubicación para una tarea concreta. Con tu lugar actual y el contexto de la sesión, valora ocho direcciones por apoyo frente a fricción—Abierta, Favorable, Aguas quietas, Contracorriente, Resaca—para elegir cuándo y hacia dónde moverte. No es adivinación: timing y orientación para el próximo día de trabajo.",
    },
    fr: {
      subtitle: "Timing et direction sur 24 h",
      body: "Syncro est une carte 24 h ancrée sur le lieu pour une tâche concrète. Avec ta position et le contexte de session, elle note huit directions selon soutien vs friction—Ouvert, Porteur, Eaux calmes, Contre-courant, Ressac—pour choisir quand et vers où avancer. Pas de voyance: timing et orientation pour la journée à venir.",
    },
  },
  match: {
    en: {
      subtitle: "Two-person decision frame",
      body: "Match is a focused two-person read for one relationship question. It compares how two profiles meet on communication, partnership, or shared life—where you resonate and where friction builds—without fatalistic compatibility scores. A coaching frame so both sides can choose clearer next steps together.",
    },
    zh: {
      subtitle: "双人决策框架",
      body: "Match 是针对一个关系问题的双人对照阅读。它比较两份档案在沟通、合作或共同生活上如何相遇——哪里同频、哪里易摩擦——不做宿命式合不合打分。这是教练式框架，帮双方把下一步想清楚、一起选。",
    },
    es: {
      subtitle: "Marco de decisión para dos",
      body: "Match es una lectura enfocada de dos personas para una pregunta de relación. Compara cómo se encuentran dos perfiles en comunicación, colaboración o vida compartida—dónde resuenan y dónde crece la fricción—sin veredictos fatalistas de compatibilidad. Un marco de coaching para que ambos elijan pasos más claros juntos.",
    },
    fr: {
      subtitle: "Cadre de décision à deux",
      body: "Match est une lecture à deux, ciblée sur une question relationnelle. Elle compare comment deux profils se croisent en communication, partenariat ou vie partagée—où ça résonne, où la friction monte—sans scores fatalistes de compatibilité. Un cadre de coaching pour choisir ensemble des prochaines étapes plus claires.",
    },
  },
};

const HOW = {
  en: "How Eastern OS works",
  zh: "Eastern OS 如何运作",
  es: "Cómo funciona Eastern OS",
  fr: "Comment Eastern OS fonctionne",
  de: "So funktioniert Eastern OS",
};

const COMPANION = {
  en: { title: "Between Eastern OS sessions", description: "Use Syncro between deeper Eastern OS conversations to notice how your situation evolves." },
  zh: { title: "在 Eastern OS 深谈之间", description: "在两次 Eastern OS 深谈之间用 Syncro，留意处境如何慢慢变化。" },
  es: { title: "Entre sesiones de Eastern OS", description: "Usa Syncro entre conversaciones más profundas de Eastern OS para notar cómo evoluciona tu situación." },
  fr: { title: "Entre les sessions Eastern OS", description: "Utilise Syncro entre des conversations Eastern OS plus profondes pour voir comment ta situation évolue." },
  de: { title: "Zwischen Eastern-OS-Sitzungen", description: "Nutze Syncro zwischen tieferen Eastern-OS-Gesprächen, um zu sehen, wie sich deine Lage entwickelt." },
};

const DE_POJU_WHAT = {
  title: "Was ist Eastern OS?",
  subtitle: "Entscheidungsdialog-Kern",
  body: "Eastern OS ist ein mehrstufiger Entscheidungsdialog für eine feststeckende Wahl. Geburtskoordinaten strukturieren diese Sitzung—kein Wahrsagen. In einem vollständigen Durchlauf erhältst du: den Dialog; einen Haupt- und einen Alternativweg; einen Entscheidungsbericht, den du in diesem Browser erneut öffnen kannst; und 30-Tage-Erinnerungen auf derselben Linie. Genau dort, wo du gerade feststeckst, klären wir Schritt für Schritt.",
};

const DE_BIRTH = {
  explanation_1: "Der Geburtsort hilft Eastern OS, diese Entscheidungssitzung aus deinen Koordinaten zu strukturieren—keine Wahrsagekarte.",
  explanation_2: "Standort präzisiert, wie diese Sitzung deinen Zeit- und Ortskontext einordnet.",
  explanation_example: "Beispiel: Derselbe Uhrzeitstempel kann je nach Ort unterschiedlich eingeordnet werden—deshalb zählt der Geburtsort.",
  location_required_note: "Bestätige deinen Geburtsort oder suche einen anderen. Eastern OS nutzt den Ort, um diese Sitzung präzise einzuordnen.",
};

const changed = [];

for (const loc of ["en", "zh", "es", "fr", "de"]) {
  const path = `messages/${loc}.json`;
  const j = JSON.parse(fs.readFileSync(path, "utf8"));

  if (loc !== "de") {
    for (const prod of ["glyph", "syncro"]) {
      const before = JSON.stringify(j.marketingSite[prod].what_is);
      j.marketingSite[prod].what_is.subtitle = COPIES[prod][loc].subtitle;
      j.marketingSite[prod].what_is.body = COPIES[prod][loc].body;
      // keep product title "What is Glyph?" etc.
      if (JSON.stringify(j.marketingSite[prod].what_is) !== before) {
        changed.push(`${loc}:marketingSite.${prod}.what_is.subtitle/body`);
      }
    }
    const mb = JSON.stringify(j.match.home.what_is);
    j.match.home.what_is.subtitle = COPIES.match[loc].subtitle;
    j.match.home.what_is.body = COPIES.match[loc].body;
    if (JSON.stringify(j.match.home.what_is) !== mb) {
      changed.push(`${loc}:match.home.what_is.subtitle/body`);
    }
  }

  if (j.marketingSite?.poju?.how_it_works?.heading) {
    const prev = j.marketingSite.poju.how_it_works.heading;
    if (HOW[loc] && prev !== HOW[loc]) {
      j.marketingSite.poju.how_it_works.heading = HOW[loc];
      changed.push(`${loc}:marketingSite.poju.how_it_works.heading (${prev} → ${HOW[loc]})`);
    }
  }

  if (j.marketingSite?.syncro?.use_cases?.poju_companion && COMPANION[loc]) {
    const prevT = j.marketingSite.syncro.use_cases.poju_companion.title;
    const prevD = j.marketingSite.syncro.use_cases.poju_companion.description;
    j.marketingSite.syncro.use_cases.poju_companion.title = COMPANION[loc].title;
    j.marketingSite.syncro.use_cases.poju_companion.description = COMPANION[loc].description;
    if (prevT !== COMPANION[loc].title || prevD !== COMPANION[loc].description) {
      changed.push(`${loc}:marketingSite.syncro.use_cases.poju_companion`);
    }
  }

  if (loc === "de") {
    const prev = JSON.stringify(j.marketingSite.poju.what_is);
    j.marketingSite.poju.what_is.title = DE_POJU_WHAT.title;
    j.marketingSite.poju.what_is.subtitle = DE_POJU_WHAT.subtitle;
    j.marketingSite.poju.what_is.body = DE_POJU_WHAT.body;
    if (JSON.stringify(j.marketingSite.poju.what_is) !== prev) {
      changed.push("de:marketingSite.poju.what_is.title/subtitle/body");
    }
    // feature_definition if still Pivot-era
    if (j.poju?.branding?.feature_definition && /Pivot|POJU \(Strategic|wahren Sonnenzeit/.test(j.poju.branding.feature_definition)) {
      j.poju.branding.feature_definition = DE_POJU_WHAT.body;
      changed.push("de:poju.branding.feature_definition");
    }
    if (j.profile?.birth_location) {
      for (const [k, v] of Object.entries(DE_BIRTH)) {
        if (j.profile.birth_location[k] !== undefined && j.profile.birth_location[k] !== v) {
          j.profile.birth_location[k] = v;
          changed.push(`de:profile.birth_location.${k}`);
        }
      }
    }
    if (j.profile?.why_explanation && /Sonnenzeit|true solar/i.test(j.profile.why_explanation)) {
      j.profile.why_explanation = DE_BIRTH.explanation_1;
      changed.push("de:profile.why_explanation");
    }
    // also why_explanation under birth flows
    function scrubSolar(obj, p) {
      if (!obj || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj)) {
        const np = p ? p + "." + k : k;
        if (typeof v === "string" && /true solar|wahre Sonnenzeit/i.test(v) && /explanation|note|why_/i.test(k + np)) {
          // only user-facing explanation strings already listed; skip labels like true_solar_time key names used in ops
          if (k === "why_explanation" || k === "location_required_note" || /^explanation_/.test(k)) {
            if (k === "why_explanation" || k === "explanation_1") obj[k] = DE_BIRTH.explanation_1;
            else if (k === "explanation_2") obj[k] = DE_BIRTH.explanation_2;
            else if (k === "explanation_example") obj[k] = DE_BIRTH.explanation_example;
            else if (k === "location_required_note") obj[k] = DE_BIRTH.location_required_note;
            changed.push(`de:${np}`);
          }
        } else if (typeof v === "object") scrubSolar(v, np);
      }
    }
    scrubSolar(j, "");
  }

  fs.writeFileSync(path, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("wrote", path);
}

console.log("\nCHANGED:");
changed.forEach((c) => console.log(" -", c));

// Verify
const zh = JSON.parse(fs.readFileSync("messages/zh.json", "utf8"));
const en = JSON.parse(fs.readFileSync("messages/en.json", "utf8"));
function assert(cond, msg) { if (!cond) { console.error("FAIL", msg); process.exitCode = 1; } else console.log("OK", msg); }
assert(zh.marketingSite.poju.what_is.title === "什么是 Eastern OS？", "zh what_is.title");
assert(!JSON.stringify(zh).includes("什么是 Pivot"), "zh zero 什么是 Pivot");
assert(!JSON.stringify(en).includes("What is Pivot"), "en zero What is Pivot");
assert(!/true solar/i.test(en.syncro.location.asking_message), "en syncro ask no true solar");
assert(!/true solar/i.test(JSON.stringify(en.marketingSite.syncro)), "en syncro marketing no true solar");
assert(en.marketingSite.poju.how_it_works.heading === "How Eastern OS works", "en how_it_works");
assert(zh.marketingSite.glyph.what_is.body.includes("不是预测"), "zh glyph rewritten");
assert(en.marketingSite.syncro.what_is.body.includes("location-aware"), "en syncro rewritten");
console.log("done");
