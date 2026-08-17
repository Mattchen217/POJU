/**
 * Delivery book chrome locale SSOT (zh/en/es/de/fr).
 * Internal generation stays Chinese; only shell labels + body translate target differ.
 */

import {
  DELIVERY_PAGE_TAGS,
  DELIVERY_SECTION_HEADINGS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

export type DeliveryLocaleBucket = "zh" | "en" | "es" | "de" | "fr";

export function deliveryLocaleBucket(locale: string): DeliveryLocaleBucket {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  // German removed from product — fall back to English chrome/copy
  return "en";
}

/** Human language name for translate prompts (body only). */
export function deliveryTranslateTargetName(locale: string): string {
  switch (deliveryLocaleBucket(locale)) {
    case "zh":
      return "Chinese (Simplified)";
    case "es":
      return "Spanish";
    case "de":
      return "German";
    case "fr":
      return "French";
    default:
      return "English";
  }
}

/** Plain UI label for the evidence fold (no markdown). */
const EVIDENCE_LABEL_PLAIN: Record<DeliveryLocaleBucket, string> = {
  zh: "依据与推理",
  en: "Evidence & reasoning",
  es: "Evidencia y razonamiento",
  de: "Beweis & Schlussfolgerung",
  fr: "Preuves et raisonnement",
};

export function deliveryEvidenceLabelPlain(locale: string): string {
  return EVIDENCE_LABEL_PLAIN[deliveryLocaleBucket(locale)];
}

const RX_STRATEGY_LABEL: Record<DeliveryLocaleBucket, string> = {
  zh: "策略",
  en: "Strategy",
  es: "Estrategia",
  de: "Strategy",
  fr: "Stratégie",
};

const RX_METHODS_LABEL: Record<DeliveryLocaleBucket, string> = {
  zh: "行动",
  en: "Actions",
  es: "Acciones",
  de: "Actions",
  fr: "Actions",
};

export function deliveryRxStrategyLabel(locale: string): string {
  return RX_STRATEGY_LABEL[deliveryLocaleBucket(locale)];
}

export function deliveryRxMethodsLabel(locale: string): string {
  return RX_METHODS_LABEL[deliveryLocaleBucket(locale)];
}

/** Markdown lead as written into the book: `**Label:**` */
export function deliveryEvidenceLeadLabel(locale: string): string {
  return `**${deliveryEvidenceLabelPlain(locale)}:**`;
}

/** All plain evidence labels (for split / detect regex). */
export const DELIVERY_EVIDENCE_LABEL_PLAINS: readonly string[] = [
  EVIDENCE_LABEL_PLAIN.zh,
  EVIDENCE_LABEL_PLAIN.en,
  EVIDENCE_LABEL_PLAIN.es,
  EVIDENCE_LABEL_PLAIN.de,
  EVIDENCE_LABEL_PLAIN.fr,
];

/**
 * Match `**依据与推理:**` / `**Evidence & reasoning:**` / es/de/fr equivalents.
 * Keep in sync with EVIDENCE_LABEL_PLAIN.
 */
export const DELIVERY_V2_EVIDENCE_LABEL_RE =
  /\*\*(?:依据与推理|Evidence\s*&\s*reasoning|Evidencia\s+y\s+razonamiento|Beweis\s*&\s*Schlussfolgerung|Preuves\s+et\s+raisonnement)[:：]\*\*/;

export function deliverySectionHeading(key: DeliverySegmentKey, locale: string): string {
  const h = DELIVERY_SECTION_HEADINGS[key];
  const b = deliveryLocaleBucket(locale);
  if (b === "zh") return h.zh;
  if (b === "es") return h.es;
  if (b === "de") return h.de;
  if (b === "fr") return h.fr;
  return h.en;
}

/** Fixed page tag for TOC / eyebrow (not the dynamic page_title). */
export function deliveryPageTag(key: DeliverySegmentKey, locale: string): string {
  const h = DELIVERY_PAGE_TAGS[key];
  const b = deliveryLocaleBucket(locale);
  if (b === "zh") return h.zh;
  if (b === "es") return h.es;
  if (b === "de") return h.de;
  if (b === "fr") return h.fr;
  return h.en;
}

export type DeliveryCoverCopy = {
  fallbackQuestion: string;
  title: (q: string) => string;
  subtitle: string;
  metaLine: (id: string, date: string) => string;
  tocTitle: string;
};

const COVER: Record<DeliveryLocaleBucket, DeliveryCoverCopy> = {
  zh: {
    fallbackQuestion: "你的问题",
    title: (q) => `关于「${q}」的能量决策报告`,
    subtitle: "为你的人生关键决策，提供一份基于能量结构的深度分析",
    metaLine: (id, date) => `报告编号：${id} · 生成日期：${date}`,
    tocTitle: "目录",
  },
  en: {
    fallbackQuestion: "Your question",
    title: (q) => `Energy Decision Report · ${q}`,
    subtitle: "A structured energy analysis for a decision that matters",
    metaLine: (id, date) => `Report ID: ${id} · Date: ${date}`,
    tocTitle: "Contents",
  },
  es: {
    fallbackQuestion: "Tu pregunta",
    title: (q) => `Informe de decisión energética · ${q}`,
    subtitle: "Un análisis estructural de energía para una decisión que importa",
    metaLine: (id, date) => `ID del informe: ${id} · Fecha: ${date}`,
    tocTitle: "Índice",
  },
  de: {
    fallbackQuestion: "Deine Frage",
    title: (q) => `Energie-Entscheidungsbericht · ${q}`,
    subtitle: "Eine strukturierte Energieanalyse für eine Entscheidung, die zählt",
    metaLine: (id, date) => `Berichts-ID: ${id} · Datum: ${date}`,
    tocTitle: "Inhalt",
  },
  fr: {
    fallbackQuestion: "Votre question",
    title: (q) => `Rapport de décision énergétique · ${q}`,
    subtitle: "Une analyse énergétique structurée pour une décision qui compte",
    metaLine: (id, date) => `ID du rapport : ${id} · Date : ${date}`,
    tocTitle: "Sommaire",
  },
};

export function deliveryCoverCopy(locale: string): DeliveryCoverCopy {
  return COVER[deliveryLocaleBucket(locale)];
}

export type DeliveryAppendixCopy = {
  heading: string;
  emptyBody: string;
  timingWindow: string;
  approxYears: string;
  pathSnapshot: string;
  verdict: string;
  primaryPath: string;
  backupPath: string;
  chartSummary: string;
  pillars: string;
  dayMaster: string;
  strength: string;
  favorable: string;
  support: string;
  caution: string;
  pattern: string;
  shenSha: string;
  none: string;
  nA: string;
  engineInventory: string;
  empty: string;
  terms: string;
  goldTerms: string;
  termsNote: string;
  evidenceGlossaryLead: string;
  termCol: string;
  glossCol: string;
  notProvided: string;
};

const APPENDIX: Record<DeliveryLocaleBucket, DeliveryAppendixCopy> = {
  zh: {
    heading: "附录 · 结构数据与术语说明",
    emptyBody: "(本次未附硬数据表。正文依据层已含关键金字解释。)",
    timingWindow: "时机窗口",
    approxYears: "约",
    pathSnapshot: "本案路径摘要",
    verdict: "核心判定",
    primaryPath: "主路径",
    backupPath: "辅路径",
    chartSummary: "排盘摘要",
    pillars: "四柱",
    dayMaster: "日主",
    strength: "强弱",
    favorable: "用神",
    support: "喜",
    caution: "忌",
    pattern: "格局",
    shenSha: "神煞实例",
    none: "(无)",
    nA: "(未提供)",
    engineInventory: "实例清单(引擎)",
    empty: "(空)",
    terms: "术语说明",
    goldTerms: "本报告金字表",
    termsNote:
      "正文依据层出现过的金字，汇总见下方「本报告金字表」；闭集以引擎真算为准。",
    evidenceGlossaryLead:
      "仅收录本报告依据层实际出现过的金字（按首次出现排序），便于复查，不是术语百科。",
    termCol: "术语",
    glossCol: "说明",
    notProvided: "(未提供)",
  },
  en: {
    heading: "Appendix · Structural Data & Terms",
    emptyBody: "(No structured chart attached. Evidence layers include key term glosses.)",
    timingWindow: "Timing window",
    approxYears: "approx.",
    pathSnapshot: "Path snapshot",
    verdict: "Core judgment",
    primaryPath: "Primary path",
    backupPath: "Backup path",
    chartSummary: "Chart summary",
    pillars: "Pillars",
    dayMaster: "Day master",
    strength: "Strength",
    favorable: "Favorable",
    support: "Support",
    caution: "Caution",
    pattern: "Pattern",
    shenSha: "Shen Sha",
    none: "(none)",
    nA: "(n/a)",
    engineInventory: "Engine inventory",
    empty: "(empty)",
    terms: "Terms",
    goldTerms: "Gold terms in this report",
    termsNote:
      "Gold terms that appear in evidence folds are listed below in “Gold terms in this report”. Closed-set only.",
    evidenceGlossaryLead:
      "Only gold terms that actually appear in this report’s evidence layers (first-seen order) — a lookup table, not an encyclopedia.",
    termCol: "Term",
    glossCol: "Explanation",
    notProvided: "(n/a)",
  },
  es: {
    heading: "Apéndice · Datos estructurales y términos",
    emptyBody:
      "(No se adjunta carta estructurada. Las capas de evidencia incluyen glosas de términos clave.)",
    timingWindow: "Ventana de tiempo",
    approxYears: "aprox.",
    pathSnapshot: "Resumen de vías",
    verdict: "Juicio central",
    primaryPath: "Vía principal",
    backupPath: "Vía de reserva",
    chartSummary: "Resumen de la carta",
    pillars: "Pilares",
    dayMaster: "Maestro del día",
    strength: "Fuerza",
    favorable: "Favorable",
    support: "Apoyo",
    caution: "Precaución",
    pattern: "Patrón",
    shenSha: "Shen Sha",
    none: "(ninguno)",
    nA: "(n/d)",
    engineInventory: "Inventario del motor",
    empty: "(vacío)",
    terms: "Términos",
    goldTerms: "Términos dorados de este informe",
    termsNote:
      "Los términos dorados de las capas de evidencia se listan abajo en «Términos dorados de este informe».",
    evidenceGlossaryLead:
      "Solo términos dorados que aparecen en las capas de evidencia de este informe (orden de primera aparición) — tabla de consulta, no enciclopedia.",
    termCol: "Término",
    glossCol: "Explicación",
    notProvided: "(n/d)",
  },
  de: {
    heading: "Anhang · Strukturdaten & Begriffe",
    emptyBody:
      "(Keine strukturierte Karte beigefügt. Evidenzebenen enthalten Begriffsglossen.)",
    timingWindow: "Zeitfenster",
    approxYears: "ca.",
    pathSnapshot: "Pfad-Kurzfassung",
    verdict: "Kernurteil",
    primaryPath: "Hauptpfad",
    backupPath: "Ersatzpfad",
    chartSummary: "Kartenübersicht",
    pillars: "Säulen",
    dayMaster: "Tagesmeister",
    strength: "Stärke",
    favorable: "Günstig",
    support: "Unterstützung",
    caution: "Vorsicht",
    pattern: "Muster",
    shenSha: "Shen Sha",
    none: "(keine)",
    nA: "(k. A.)",
    engineInventory: "Motor-Inventar",
    empty: "(leer)",
    terms: "Begriffe",
    goldTerms: "Goldbegriffe in diesem Bericht",
    termsNote:
      "Goldbegriffe aus den Evidenzebenen stehen unten unter „Goldbegriffe in diesem Bericht“.",
    evidenceGlossaryLead:
      "Nur Goldbegriffe, die in den Evidenzebenen dieses Berichts vorkommen (Reihenfolge des Erstauftretens) — Nachschlagetabelle, keine Enzyklopädie.",
    termCol: "Begriff",
    glossCol: "Erklärung",
    notProvided: "(k. A.)",
  },
  fr: {
    heading: "Annexe · Données structurelles et termes",
    emptyBody:
      "(Aucune carte structurée jointe. Les couches de preuves incluent des gloses de termes clés.)",
    timingWindow: "Fenêtre de timing",
    approxYears: "env.",
    pathSnapshot: "Résumé des voies",
    verdict: "Jugement central",
    primaryPath: "Voie principale",
    backupPath: "Voie de secours",
    chartSummary: "Résumé de la carte",
    pillars: "Piliers",
    dayMaster: "Maître du jour",
    strength: "Force",
    favorable: "Favorable",
    support: "Soutien",
    caution: "Prudence",
    pattern: "Schéma",
    shenSha: "Shen Sha",
    none: "(aucun)",
    nA: "(n/d)",
    engineInventory: "Inventaire moteur",
    empty: "(vide)",
    terms: "Termes",
    goldTerms: "Termes dorés de ce rapport",
    termsNote:
      "Les termes dorés des couches de preuves sont listés ci-dessous dans « Termes dorés de ce rapport ».",
    evidenceGlossaryLead:
      "Uniquement les termes dorés réellement présents dans les couches de preuves de ce rapport (ordre de première apparition) — table de consultation, pas une encyclopédie.",
    termCol: "Terme",
    glossCol: "Explication",
    notProvided: "(n/d)",
  },
};

export function deliveryAppendixCopy(locale: string): DeliveryAppendixCopy {
  return APPENDIX[deliveryLocaleBucket(locale)];
}

/** Pending / failed evidence placeholder inside interleaved markdown. */
export function deliveryEvidencePendingPlaceholder(locale: string): string {
  switch (deliveryLocaleBucket(locale)) {
    case "zh":
      return "（本段依据生成失败，请重新生成）";
    case "es":
      return "(La evidencia de este bloque falló — vuelve a generar.)";
    case "de":
      return "(Evidenz für diesen Block fehlgeschlagen — bitte neu erzeugen.)";
    case "fr":
      return "(Échec de la preuve pour ce bloc — veuillez régénérer.)";
    default:
      return "(Evidence generation failed for this block — please regenerate.)";
  }
}

export function deliveryEvidencePendingDetectRe(): RegExp {
  return /^本段依据待补|^本段依据生成失败|^Evidence (for this section )?pending|La evidencia de este bloque falló|Evidenz für diesen Block fehlgeschlagen|Échec de la preuve pour ce bloc|Evidence generation failed/i;
}
