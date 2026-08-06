/**
 * Delivery TTS helpers — locale labels for tests / future styled engines.
 * Hot path (Kokoro) speaks plain text only; no director prefix.
 */

export type DeliveryTtsLang = "zh" | "en" | "fr" | "es";

export function resolveDeliveryTtsLang(locale: string): DeliveryTtsLang {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("es")) return "es";
  return "en";
}

export function deliveryTtsLanguageLabel(lang: DeliveryTtsLang): string {
  switch (lang) {
    case "zh":
      return "中文（普通话）";
    case "fr":
      return "français";
    case "es":
      return "español";
    default:
      return "English";
  }
}

/** Kept for scripts; production Kokoro path does not prepend this. */
export function buildDeliveryTtsDirectorPrompt(
  locale: string,
  role: "title" | "body" = "body",
): string {
  const lang = resolveDeliveryTtsLang(locale);
  const spoken = deliveryTtsLanguageLabel(lang);

  const roleZh =
    role === "title"
      ? "本段只朗读一个小节小标题：咬字清楚、略沉一点，读完即停，不要扩展成段落。"
      : "本段只朗读报告正文：清晰陈述事实与判断，不要讲故事腔。";
  const roleEn =
    role === "title"
      ? "Read only this section heading: clear, slightly weighty, then stop. Do not expand into a paragraph."
      : "Read only this report body: clear analytical statement, not storytelling.";

  switch (lang) {
    case "zh":
      return [
        "目标：宣读一份正式的个人决策分析报告。",
        "身份：专业分析顾问，不是小说朗读者，也不是广播剧旁白。",
        "语气：沉稳、克制、咬字清楚；音量始终稳定，不要渐弱、不要耳语、不要添噪音感。",
        `语言：严格用${spoken}；与文本一致，不翻译、不中英夹杂。`,
        roleZh,
        "边界：只读分隔线后的文字；不加开场白、结束语、解释或评价性口头禅。",
      ].join(" ");

    case "fr":
      return [
        "Objectif : lire un rapport d’analyse formel.",
        "Identité : conseiller analytique professionnel — pas un conteur.",
        "Ton : posé, retenu, articulé ; volume constant, sans murmure ni fade.",
        `Langue : ${spoken} uniquement.`,
        role === "title"
          ? "Lire uniquement le titre de section, puis s’arrêter."
          : "Lire uniquement le corps du rapport, sans récit dramatisé.",
        "Limites : uniquement le texte après le séparateur.",
      ].join(" ");

    case "es":
      return [
        "Objetivo: leer un informe de análisis formal.",
        "Identidad: asesor analítico profesional, no un narrador de historias.",
        "Tono: firme, contenido, claro; volumen constante, sin susurro ni desvanecimiento.",
        `Idioma: solo ${spoken}.`,
        role === "title"
          ? "Lee solo el título de la sección y detente."
          : "Lee solo el cuerpo del informe, sin tono narrativo.",
        "Límites: solo el texto después del separador.",
      ].join(" ");

    default:
      return [
        "Goal: Narrate a formal personal decision-analysis report.",
        "Identity: a professional analytical advisor — not a storyteller or audiobook narrator.",
        "Tone: steady, restrained, clearly articulated; keep volume constant — no fade, whisper, or noise floor.",
        `Language: speak only in ${spoken}, matching the text.`,
        roleEn,
        "Boundary: read ONLY the text after the separator; no intro, outro, or ad-lib.",
      ].join(" ");
  }
}

export function buildDeliveryTtsSpeechInput(
  text: string,
  locale: string,
  role: "title" | "body" = "body",
): string {
  const body = text.replace(/\r\n/g, "\n").trim();
  const director = buildDeliveryTtsDirectorPrompt(locale, role);
  return `${director}\n\n---REPORT---\n\n${body}`;
}
