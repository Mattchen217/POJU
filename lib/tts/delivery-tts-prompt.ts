/**
 * Director / style prompt for delivery-report TTS (Gemini via OpenRouter).
 * Gemini steers delivery via the input preface: `{prompt}: {text}` pattern.
 */

export type DeliveryTtsLang = "zh" | "en" | "fr" | "es" | "de";

export function resolveDeliveryTtsLang(locale: string): DeliveryTtsLang {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("de")) return "de";
  return "en";
}

/** Human-readable language name for the spoken report. */
export function deliveryTtsLanguageLabel(lang: DeliveryTtsLang): string {
  switch (lang) {
    case "zh":
      return "中文（普通话）";
    case "fr":
      return "français";
    case "es":
      return "español";
    case "de":
      return "Deutsch";
    default:
      return "English";
  }
}

/**
 * Style director (goal + task). Kept concise for cost; language-specific.
 * Instructs warm mentor tone for a formal analysis report.
 */
export function buildDeliveryTtsDirectorPrompt(locale: string): string {
  const lang = resolveDeliveryTtsLang(locale);
  const spoken = deliveryTtsLanguageLabel(lang);

  switch (lang) {
    case "zh":
      return [
        "目标：把下面这份正式的个人能量决策分析报告，朗读给用户听。",
        "任务：用自然、有温度、沉稳清晰的女声，完整朗读报告正文；像一位可信赖的人生导师在认真交付结论，而不是播音腔、广告腔或表演腔。",
        `语言：严格用${spoken}朗读；与正文语言一致，不要翻译，不要中英混读。`,
        "节奏：段落之间短暂停顿；结论句稍慢；情绪克制而真诚，不要夸张或卖萌。",
        "边界：只朗读分隔线之后的正文；不要添加开场白、章标题旁白、解释或结束语；不要朗读不存在于正文的内容。",
      ].join(" ");

    case "fr":
      return [
        "Objectif : lire à voix haute le rapport d’analyse formel ci-dessous pour l’auditeur.",
        "Mission : voix féminine chaleureuse, calme et claire — comme une mentor de vie qui livre des conclusions soignées, ni speaker journalistique ni ton publicitaire.",
        `Langue : lire strictement en ${spoken}, comme le texte ; ne pas traduire ni mélanger les langues.`,
        "Rythme : brèves pauses entre les paragraphes ; ralentir légèrement sur les conclusions ; empathique mais retenue.",
        "Limites : lire uniquement le corps du rapport après le séparateur ; pas d’intro, d’outro ni de commentaires ajoutés.",
      ].join(" ");

    case "es":
      return [
        "Objetivo: narrar en voz alta el siguiente informe de análisis formal para el oyente.",
        "Tarea: voz femenina cálida, calmada y clara — como una mentora de vida que entrega conclusiones cuidadas, no como noticiero ni anuncio.",
        `Idioma: leer estrictamente en ${spoken}, igual que el texto; no traduzcas ni mezcles idiomas.`,
        "Ritmo: pausas breves entre párrafos; un poco más despacio en las conclusiones; empática pero contenida.",
        "Límites: lee solo el cuerpo del informe después del separador; sin intro, cierre ni comentarios añadidos.",
      ].join(" ");

    case "de":
      return [
        "Ziel: den folgenden formellen Analysebericht für die hörende Person vorlesen.",
        "Aufgabe: warme, ruhige, klare weibliche Stimme — wie eine vertrauenswürdige Lebensmentorin mit sorgfältigen Schlussfolgerungen, nicht Nachrichtensprecherin und nicht Werbung.",
        `Sprache: strikt auf ${spoken} vorlesen, wie der Text; nicht übersetzen und nicht mischen.`,
        "Tempo: kurze Pausen zwischen Absätzen; Schlussfolgerungen etwas langsamer; empathisch, aber zurückhaltend.",
        "Grenze: nur den Berichtstext nach dem Trenner vorlesen; keine Intro-, Outro- oder Zusatzkommentare.",
      ].join(" ");

    default:
      return [
        "Goal: Narrate the following formal personal analysis report aloud for the listener.",
        "Task: Use a warm, calm, clear female voice — like a trusted life mentor delivering careful conclusions, not a newsreader, ad voice, or theatrical performance.",
        `Language: Speak strictly in ${spoken}, matching the report text; do not translate or code-switch.`,
        "Pacing: Brief pauses between paragraphs; slightly slower on key conclusions; empathetic but restrained.",
        "Boundary: Read ONLY the report body after the separator. Do not add an introduction, chapter asides, explanations, or closing remarks that are not in the text.",
      ].join(" ");
  }
}

/**
 * Full OpenRouter `input`: director preface + verbatim main body.
 * Gemini Voice treats the leading instruction as style, then speaks the body.
 */
export function buildDeliveryTtsSpeechInput(mainText: string, locale: string): string {
  const body = mainText.replace(/\r\n/g, "\n").trim();
  const director = buildDeliveryTtsDirectorPrompt(locale);
  return `${director}\n\n---REPORT---\n\n${body}`;
}
