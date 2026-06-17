import type { ToolName } from "@/lib/poju/types";

/** Static guide fallbacks when matrix-narrative LLM fails (mirrors messages tool_preview.guide). */
const TOOL_GUIDE_FALLBACK: Record<string, Record<ToolName, string>> = {
  en: {
    glyph:
      "Name the one decision on your mind — type it below and send before you draw.",
    match:
      "Describe the relationship question you want clarity on — type and send below.",
    syncro:
      "What do you need to do, and where? Type your task below and send.",
  },
  zh: {
    glyph: "写下你此刻最想问清的那一件事，在下方输入并发送后再抽签。",
    match: "写下你想解决的这段关系里的具体问题，在下方输入并发送。",
    syncro: "写下你要办的事和所在位置，在下方输入并发送。",
  },
  de: {
    glyph:
      "Nenne die eine Entscheidung, die dich beschäftigt — unten eingeben und senden.",
    match:
      "Beschreibe deine Beziehungsfrage — unten eingeben und senden.",
    syncro:
      "Was musst du tun, und wo? Aufgabe unten eingeben und senden.",
  },
  es: {
    glyph:
      "Escribe la decisión que más te pesa — envíala abajo antes de sacar.",
    match:
      "Describe la pregunta sobre la relación — escríbela abajo y envía.",
    syncro:
      "¿Qué necesitas hacer y dónde? Escríbelo abajo y envía.",
  },
  fr: {
    glyph:
      "Écrivez la décision qui vous préoccupe — envoyez-la ci-dessous avant de tirer.",
    match:
      "Décrivez votre question sur la relation — tapez et envoyez ci-dessous.",
    syncro:
      "Que devez-vous faire, et où ? Tapez la tâche ci-dessous et envoyez.",
  },
};

export function getStaticToolPreviewGuide(locale: string, product: ToolName): string {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return TOOL_GUIDE_FALLBACK[base]?.[product] ?? TOOL_GUIDE_FALLBACK.en![product]!;
}
