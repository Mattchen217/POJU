/**
 * Companion output locale — same native-speaker / high-school bar as delivery body-polish.
 */

export const COMPANION_LOCALES = ["zh", "en", "fr", "es"] as const;
export type CompanionLocale = (typeof COMPANION_LOCALES)[number];

export function normalizeCompanionLocale(locale: string): CompanionLocale {
  const raw = (locale || "zh").trim().toLowerCase();
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("en")) return "en";
  return "en";
}

export function companionOutputLanguageLabel(locale: CompanionLocale): string {
  switch (locale) {
    case "en":
      return "English (US)";
    case "fr":
      return "français (France)";
    case "es":
      return "español (US / LatAm-friendly US Spanish)";
    default:
      return "简体中文";
  }
}

/** Native-speaker writer + high-school reader (same bar as delivery polish). */
export function companionTranslatorPersona(locale: CompanionLocale): string {
  switch (locale) {
    case "en":
      return [
        `You are an American native English speaker writing this reminder.`,
        `The reader is a native-English US high-schooler (~15–16, grades 10–11).`,
        `Write the way you would explain this face-to-face — natural English, not a translation of Chinese scaffolding.`,
        `Ban word-for-word Chinese calques, fortune-telling tone, and essay/HR jargon.`,
      ].join("\n");
    case "es":
      return [
        `Eres hablante nativo de español (contexto EE.UU.) escribiendo este recordatorio.`,
        `El lector es un estudiante de secundaria hispanohablante (~15–16 años).`,
        `Escribe como se lo explicarías en persona — español natural, no calco del chino.`,
        `Prohibido calco palabra por palabra, tono de horóscopo y jerga de ensayo/RR.HH.`,
      ].join("\n");
    case "fr":
      return [
        `Tu es Français, français langue maternelle, et tu rédiges ce rappel.`,
        `Le lecteur est un lycéen francophone (~15–16 ans, seconde/première).`,
        `Écris comme tu lui expliquerais en face — français naturel, pas un calque du chinois.`,
        `Interdit calque mot à mot, ton horoscope, jargon dissertation/RH.`,
      ].join("\n");
    default:
      return [
        `你是中文母语编辑，写给能读完整句的高中生读者。`,
        `用当面讲清楚的白话写；禁论文腔开场、禁日运恐吓腔、禁把命理专名堆进可见四段。`,
      ].join("\n");
  }
}

export function companionNativeVoiceBlock(locale: CompanionLocale): string {
  switch (locale) {
    case "en":
      return [
        `## Native voice · anti-calque`,
        `- Speak out loud to a 15–16yo. If it sounds translated, rewrite.`,
        `- Ban Chinese scaffolding calques: energy structure / supply line / relationship beam / intense heat (as weather).`,
        `- "Energy picture" OK once with a short gloss the first time; don't build jargon paragraphs around it.`,
        `- Face slots = decision / energy / pace coaching only. No luck, doom, fate, or daily-horoscope tone.`,
      ].join("\n");
    case "es":
      return [
        `## Voz nativa · anti-calco`,
        `- Habla como a un estudiante de 15–16. Si suena traducido, reescribe.`,
        `- Prohibido calco chino: estructura energética / línea de suministro / viga de la relación / calor intenso (como clima).`,
        `- "Mapa de fuerzas" / cuadro energético: primera vez con glosa corta; no jerga alrededor.`,
        `- Los cuatro campos visibles = decisión / energía / ritmo. Sin horóscopo ni miedo.`,
      ].join("\n");
    case "fr":
      return [
        `## Voix native · anti-calque`,
        `- Parle comme à un lycéen de 15–16 ans. Si ça sonne traduit, réécris.`,
        `- Interdit calque chinois: structure énergétique / ligne d’approvisionnement / poutre relationnelle / chaleur intense (météo).`,
        `- « Tableau énergétique »: première fois avec glose courte; pas de jargon autour.`,
        `- Les quatre champs visibles = décision / énergie / rythme. Pas d’horoscope ni intimidation.`,
      ].join("\n");
    default:
      return [
        `## 母语可读`,
        `- 像当面讲；禁论文腔堆砌、禁日运/恐吓腔。`,
        `- 前四段决策/精力/节奏白话；「能量画像」可留作扎根，勿堆玄学说明书。`,
        `- 禁裸命理专名进可见四段（十神/干支报幕/用喜忌/奇门原名等整类）。`,
      ].join("\n");
  }
}

export type CompanionUiLabels = {
  today: string;
  suitable: string;
  unsuitable: string;
  suggestion: string;
  evidence: string;
  title: (dateKey: string, dayN: number) => string;
  anchor: (primary: string, backup: string) => string;
  emailIntro: string;
  favorsPrefix: string;
  holdPrefix: string;
  suggestionPrefix: string;
};

export function companionUiLabels(locale: CompanionLocale): CompanionUiLabels {
  switch (locale) {
    case "en":
      return {
        today: "What today is",
        suitable: "Favors today",
        unsuitable: "Hold back today",
        suggestion: "Suggestion",
        evidence: "Why today",
        title: (dateKey, dayN) => `Eastern OS · Daily reminder · ${dateKey} (day ${dayN}/30)`,
        anchor: (p, b) => `Anchored primary: ${p} · backup: ${b}`,
        emailIntro: "Attached is today's Eastern OS reminder — open in a browser.",
        favorsPrefix: "Favors: ",
        holdPrefix: "Hold: ",
        suggestionPrefix: "Suggestion: ",
      };
    case "es":
      return {
        today: "Qué es hoy",
        suitable: "Hoy conviene",
        unsuitable: "Hoy mejor no",
        suggestion: "Sugerencia",
        evidence: "Por qué hoy",
        title: (dateKey, dayN) => `Eastern OS · Recordatorio diario · ${dateKey} (día ${dayN}/30)`,
        anchor: (p, b) => `Anclado principal: ${p} · respaldo: ${b}`,
        emailIntro: "Adjunto el recordatorio Eastern OS de hoy — ábrelo en el navegador.",
        favorsPrefix: "Conviene: ",
        holdPrefix: "Mejor no: ",
        suggestionPrefix: "Sugerencia: ",
      };
    case "fr":
      return {
        today: "Ce qu’est aujourd’hui",
        suitable: "Aujourd’hui, plutôt",
        unsuitable: "Aujourd’hui, éviter",
        suggestion: "Suggestion",
        evidence: "Pourquoi aujourd’hui",
        title: (dateKey, dayN) => `Eastern OS · Rappel du jour · ${dateKey} (jour ${dayN}/30)`,
        anchor: (p, b) => `Ancré principal : ${p} · secours : ${b}`,
        emailIntro: "Pièce jointe : le rappel Eastern OS du jour — ouvrir dans un navigateur.",
        favorsPrefix: "Plutôt : ",
        holdPrefix: "Éviter : ",
        suggestionPrefix: "Suggestion : ",
      };
    default:
      return {
        today: "今天是什么",
        suitable: "今天适合",
        unsuitable: "今天不宜",
        suggestion: "建议",
        evidence: "今日依据",
        title: (dateKey, dayN) => `Eastern OS · 每日提醒 · ${dateKey}（第 ${dayN}/30 日）`,
        anchor: (p, b) => `锚定主：${p} · 辅：${b}`,
        emailIntro: "附件是今日 Eastern OS 提醒页，请用浏览器打开。",
        favorsPrefix: "适合：",
        holdPrefix: "不宜：",
        suggestionPrefix: "建议：",
      };
  }
}
