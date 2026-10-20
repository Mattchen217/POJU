const fs = require("fs");

const HIW = {
  en: {
    steps: {
      "1": { title: "Share where you’re stuck", description: "Name the specific dilemma or decision weighing on you right now." },
      "2": { title: "Deep multi-turn dialogue", description: "Work through a reflective conversation as Eastern OS helps you align the full context of your situation." },
      "3": { title: "Situation mapping", description: "Eastern OS keeps a running map of your situation as the dialogue unfolds—so the thread stays clear." },
      "4": { title: "Structure the choice", description: "Birth coordinates and dialogue context structure this session—not fortune-telling—so the stuck choice becomes workable." },
      "5": { title: "Report & next moves", description: "Receive a decision report with a main path, a backup, and actions you can reopen in this browser." },
      "6": { title: "30-day same-line follow-up", description: "As you try the path, return with updates. Eastern OS stays with the same question for up to 30 days." },
    },
    footer: {
      title: "30-day single-question window",
      description: "Real clarity takes time. For the one challenge you bring today, you get a dedicated 30-day dialogue window. As things shift, come back to update and refine. Same line, step by step.",
    },
  },
  zh: {
    steps: {
      "1": { title: "说出你卡住的地方", description: "提出当下最让你迷茫、焦虑或无法抉择的那个具体问题。" },
      "2": { title: "多轮深度对话", description: "在反思式对话里，Eastern OS 陪你把处境信息逐步对齐、理清核心。" },
      "3": { title: "处境对齐", description: "对话过程中持续对齐你的处境脉络，让主线始终清楚。" },
      "4": { title: "结构化这次抉择", description: "以出生坐标与对话语境结构化本次会话——不是算命——把卡住的选择变成可推进的路径。" },
      "5": { title: "报告与下一步", description: "得到决策报告：主路径、备用，以及可在本浏览器重开的行动建议。" },
      "6": { title: "30 天同线跟进", description: "你去实践时随时回来更新。Eastern OS 就这一题陪你最多 30 天。" },
    },
    footer: {
      title: "30 天单题守护",
      description: "深层卡住的事不是一次说完就结束。针对你提出的这一个核心问题，Eastern OS 提供最长 30 天的同线对话窗口。局势怎么变，你都可以回来更新；一步步陪你复盘到底。",
    },
  },
};

const TAG = {
  en: { brand_tag: "Eastern OS", tagline: "Eastern OS is a thinking partner. The decisions remain yours.", cta: null },
  zh: { brand_tag: "Eastern OS", tagline: "Eastern OS 是思考伙伴。决定永远是你的。", cta: null },
  es: { brand_tag: "Eastern OS", tagline: "Eastern OS es un compañero de pensamiento. Las decisiones siguen siendo tuyas.", cta: null },
  fr: { brand_tag: "Eastern OS", tagline: "Eastern OS est un partenaire de réflexion. Les décisions restent les vôtres.", cta: null },
  de: { brand_tag: "Eastern OS", tagline: "Eastern OS ist ein Denkpartner. Die Entscheidungen bleiben bei dir.", cta: null },
};

const changed = [];
for (const loc of ["en", "zh", "es", "fr", "de"]) {
  const path = `messages/${loc}.json`;
  const j = JSON.parse(fs.readFileSync(path, "utf8"));
  const poju = j.marketingSite.poju;

  if (HIW[loc]) {
    for (const id of Object.keys(HIW[loc].steps)) {
      poju.how_it_works.steps[id].title = HIW[loc].steps[id].title;
      poju.how_it_works.steps[id].description = HIW[loc].steps[id].description;
    }
    poju.how_it_works.footer.title = HIW[loc].footer.title;
    poju.how_it_works.footer.description = HIW[loc].footer.description;
    changed.push(`${loc}:marketingSite.poju.how_it_works.steps+footer`);
  } else {
    // ES/FR/DE still English-cloned steps — replace Pivot→Eastern OS and energetic blueprint phrases lightly
    const s = JSON.stringify(poju.how_it_works);
    let next = s
      .replace(/as Pivot guides you/g, "as Eastern OS guides you")
      .replace(/Pivot tracks/g, "Eastern OS tracks")
      .replace(/Pivot /g, "Eastern OS ")
      .replace(/personal energetic blueprint/g, "situation map")
      .replace(/algorithmic matrix of the I Ching and Five Elements \(Wu Xing\)/g, "session structure from your coordinates and dialogue");
    if (next !== s) {
      poju.how_it_works = JSON.parse(next);
      changed.push(`${loc}:marketingSite.poju.how_it_works Pivot scrub`);
    }
  }

  if (poju.hero && TAG[loc]) {
    if (poju.hero.brand_tag !== TAG[loc].brand_tag) {
      poju.hero.brand_tag = TAG[loc].brand_tag;
      changed.push(`${loc}:marketingSite.poju.hero.brand_tag`);
    }
  }
  if (poju.two_columns && TAG[loc]) {
    if (poju.two_columns.tagline && poju.two_columns.tagline !== TAG[loc].tagline) {
      poju.two_columns.tagline = TAG[loc].tagline;
      changed.push(`${loc}:marketingSite.poju.two_columns.tagline`);
    }
  }

  fs.writeFileSync(path, JSON.stringify(j, null, 2) + "\n", "utf8");
}

console.log(changed.join("\n"));

// Final verify
const zh = JSON.parse(fs.readFileSync("messages/zh.json", "utf8"));
const en = JSON.parse(fs.readFileSync("messages/en.json", "utf8"));
const zhStr = JSON.stringify(zh);
console.log("zh title", zh.marketingSite.poju.what_is.title);
console.log("zh has 什么是 Pivot?", zhStr.includes("什么是 Pivot"));
console.log("zh has 什么是 Eastern OS?", zhStr.includes("什么是 Eastern OS？"));
console.log("en asking", en.syncro.location.asking_message);
console.log("en true solar in syncro.location?", /true solar/i.test(JSON.stringify(en.syncro.location)));
console.log("en glyph subtitle", en.marketingSite.glyph.what_is.subtitle);
console.log("zh how heading", zh.marketingSite.poju.how_it_works.heading);
console.log("zh step2", zh.marketingSite.poju.how_it_works.steps["2"].description);
