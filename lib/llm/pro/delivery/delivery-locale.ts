/**
 * Delivery book chrome locale SSOT (zh/en/es/de/fr).
 * Internal generation stays Chinese; only shell labels + body translate target differ.
 */

import {
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
  zh: "手段",
  en: "Methods",
  es: "Métodos",
  de: "Methods",
  fr: "Méthodes",
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
  termsNote: string;
  /** Lead above the code-collected evidence gold-term list. */
  evidenceGlossaryLead: string;
  /** Appendix glossary table column: term. */
  termCol: string;
  /** Appendix glossary table column: explanation. */
  glossCol: string;
  notProvided: string;
};

const APPENDIX: Record<DeliveryLocaleBucket, DeliveryAppendixCopy> = {
  zh: {
    heading: "附录 · 结构数据与术语说明",
    emptyBody: "(本次未附硬数据表。正文依据层已含关键金字解释。)",
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
    termsNote:
      "术语解释见正文各论点「依据与推理」中的金字气泡；闭集术语以引擎真算为准。",
    evidenceGlossaryLead: "以下为本报告依据层出现过的金字及其释义。",
    termCol: "术语",
    glossCol: "说明",
    notProvided: "(未提供)",
  },
  en: {
    heading: "Appendix · Structural Data & Terms",
    emptyBody: "(No structured chart attached. Evidence layers include key term glosses.)",
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
    termsNote:
      "Term glosses appear in each argument’s Evidence & reasoning gold marks.",
    evidenceGlossaryLead: "Gold terms from this report’s evidence layers, with definitions.",
    termCol: "Term",
    glossCol: "Explanation",
    notProvided: "(n/a)",
  },
  es: {
    heading: "Apéndice · Datos estructurales y términos",
    emptyBody:
      "(No se adjunta carta estructurada. Las capas de evidencia incluyen glosas de términos clave.)",
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
    termsNote:
      "Las glosas aparecen en las marcas doradas de Evidencia y razonamiento de cada argumento.",
    evidenceGlossaryLead:
      "Términos dorados de las capas de evidencia de este informe, con definiciones.",
    termCol: "Término",
    glossCol: "Explicación",
    notProvided: "(n/d)",
  },
  de: {
    heading: "Anhang · Strukturdaten & Begriffe",
    emptyBody:
      "(Keine strukturierte Karte beigefügt. Evidenzebenen enthalten Begriffsglossen.)",
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
    termsNote:
      "Begriffsglossen erscheinen in den goldenen Markierungen unter Beweis & Schlussfolgerung.",
    evidenceGlossaryLead:
      "Goldene Begriffe aus den Evidenzebenen dieses Berichts, mit Definitionen.",
    termCol: "Begriff",
    glossCol: "Erklärung",
    notProvided: "(k. A.)",
  },
  fr: {
    heading: "Annexe · Données structurelles et termes",
    emptyBody:
      "(Aucune carte structurée jointe. Les couches de preuves incluent des gloses de termes clés.)",
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
    termsNote:
      "Les gloses apparaissent dans les marques dorées de Preuves et raisonnement de chaque argument.",
    evidenceGlossaryLead:
      "Termes dorés issus des couches de preuves de ce rapport, avec définitions.",
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
