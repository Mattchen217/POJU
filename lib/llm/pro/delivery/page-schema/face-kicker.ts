/**
 * Locale-facing Decision report kickers (TOC tag / gold eyebrow).
 * Schema `DECISION_PAGE_SCHEMAS[].title` stays the ZH authoring SoT — do not use it as reader chrome.
 */

import {
  DECISION_PAGE_IDS,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";

type FaceKickerRow = {
  en: string;
  zh: string;
  es?: string;
  fr?: string;
};

const FACE_KICKERS: Record<DecisionPageId, FaceKickerRow> = {
  "01": {
    en: "The call",
    zh: "本题断语",
    es: "La llamada",
    fr: "L'appel",
  },
  "02": {
    en: "Why this holds",
    zh: "为何如此",
    es: "Por qué se sostiene",
    fr: "Pourquoi ça tient",
  },
  "03": {
    en: "Chart appendix",
    zh: "盘面附录",
    es: "Apéndice del mapa",
    fr: "Annexe du thème",
  },
  "04": {
    en: "The real block",
    zh: "真正卡点",
    es: "El verdadero bloqueo",
    fr: "Le vrai blocage",
  },
  "05": {
    en: "Path order",
    zh: "路径排序",
    es: "Orden de caminos",
    fr: "Ordre des chemins",
  },
  "06": {
    en: "How to land it",
    zh: "怎么落地",
    es: "Cómo aterrizarlo",
    fr: "Comment l'ancrer",
  },
  "07": {
    en: "Field and relationship",
    zh: "场域与关系",
    es: "Campo y relación",
    fr: "Champ et relation",
  },
  "08": {
    en: "Self-check",
    zh: "自检清单",
    es: "Autocomprobación",
    fr: "Auto-vérification",
  },
};

export function isDecisionFaceId(id: string): id is DecisionPageId {
  return (DECISION_PAGE_IDS as readonly string[]).includes(id);
}

/** Reader-facing fixed kicker for TOC / gold eyebrow. */
export function decisionFaceKicker(pageId: string, locale: string): string {
  if (!isDecisionFaceId(pageId)) return pageId;
  const row = FACE_KICKERS[pageId];
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return row.zh;
  if (l.startsWith("es") && row.es) return row.es;
  if (l.startsWith("fr") && row.fr) return row.fr;
  return row.en;
}
