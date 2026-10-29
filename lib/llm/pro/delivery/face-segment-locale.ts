/**
 * Reader-facing face segment labels by locale.
 * DECISION_PAGE_SCHEMAS labels stay ZH authoring SoT — chrome uses this table.
 */

import type { DecisionPageId, PageSegmentId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { deliveryLocaleBucket, type DeliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";

type SegLabels = Partial<Record<PageSegmentId, string>>;

const FACE_SEGMENT_LABELS: Record<
  DecisionPageId,
  Record<DeliveryLocaleBucket, SegLabels>
> = {
  "01": {
    zh: { A: "主推荐", B: "成立条件", C: "不选什么", D: "依据指针" },
    en: {
      A: "Main recommendation",
      B: "Conditions",
      C: "What not to choose",
      D: "Evidence pointer",
    },
    es: {
      A: "Recomendación principal",
      B: "Condiciones",
      C: "Qué no elegir",
      D: "Puntero de evidencia",
    },
    de: {
      A: "Hauptempfehlung",
      B: "Bedingungen",
      C: "Was nicht wählen",
      D: "Hinweis auf Belege",
    },
    fr: {
      A: "Recommandation principale",
      B: "Conditions",
      C: "Ce qu'il ne faut pas choisir",
      D: "Pointeur de preuves",
    },
  },
  "02": {
    zh: { A: "命理理由", B: "科学机制", C: "汇合", D: "可核对锚" },
    en: {
      A: "Destiny reason",
      B: "Science mechanism",
      C: "Convergence",
      D: "Checkable anchors",
    },
    es: {
      A: "Razón metafísica",
      B: "Mecanismo científico",
      C: "Convergencia",
      D: "Anclas verificables",
    },
    de: {
      A: "Schicksalsgrund",
      B: "Wissenschaftlicher Mechanismus",
      C: "Konvergenz",
      D: "Prüfbare Anker",
    },
    fr: {
      A: "Raison métaphysique",
      B: "Mécanisme scientifique",
      C: "Convergence",
      D: "Ancres vérifiables",
    },
  },
  "04": {
    zh: { A: "卡点命名", B: "表现", C: "若硬顶", D: "依据折叠" },
    en: {
      A: "Block name",
      B: "How it shows up",
      C: "If you force it",
      D: "Evidence (fold)",
    },
    es: {
      A: "Nombre del bloqueo",
      B: "Cómo aparece",
      C: "Si fuerzas",
      D: "Evidencia (plegable)",
    },
    de: {
      A: "Blockname",
      B: "Erscheinung",
      C: "Bei Zwang",
      D: "Belege (faltbar)",
    },
    fr: {
      A: "Nom du blocage",
      B: "Manifestation",
      C: "Si vous forcez",
      D: "Preuves (repliables)",
    },
  },
  "05": {
    zh: { A: "首选", B: "次选", C: "慎选", D: "切轨/停止", E: "对照" },
    en: {
      A: "First choice",
      B: "Second choice",
      C: "Use with caution",
      D: "Switch or stop",
      E: "Contrast",
    },
    es: {
      A: "Primera opción",
      B: "Segunda opción",
      C: "Con cautela",
      D: "Cambiar o parar",
      E: "Contraste",
    },
    de: {
      A: "Erste Wahl",
      B: "Zweite Wahl",
      C: "Vorsicht",
      D: "Wechseln oder stoppen",
      E: "Kontrast",
    },
    fr: {
      A: "Premier choix",
      B: "Deuxième choix",
      C: "Avec prudence",
      D: "Changer ou arrêter",
      E: "Contraste",
    },
  },
  "06": {
    zh: { A: "近步原则", B: "阶段气候", C: "自我调频", D: "节奏提醒" },
    en: {
      A: "Near-step principle",
      B: "Stage climate",
      C: "Self-retune",
      D: "Rhythm note",
    },
    es: {
      A: "Principio del próximo paso",
      B: "Clima de etapa",
      C: "Autoajuste",
      D: "Nota de ritmo",
    },
    de: {
      A: "Nächster-Schritt-Prinzip",
      B: "Phasenklima",
      C: "Selbstabstimmung",
      D: "Rhythmusnotiz",
    },
    fr: {
      A: "Principe du prochain pas",
      B: "Climat d'étape",
      C: "Auto-réglage",
      D: "Note de rythme",
    },
  },
  "07": {
    zh: { A: "场域判断", B: "关系/互动", C: "依据折叠", D: "与 01/05 对齐" },
    en: {
      A: "Field judgment",
      B: "Relation / interaction",
      C: "Evidence (fold)",
      D: "Align with 01/05",
    },
    es: {
      A: "Juicio del campo",
      B: "Relación / interacción",
      C: "Evidencia (plegable)",
      D: "Alinear con 01/05",
    },
    de: {
      A: "Feldurteil",
      B: "Beziehung / Interaktion",
      C: "Belege (faltbar)",
      D: "Mit 01/05 abstimmen",
    },
    fr: {
      A: "Jugement du champ",
      B: "Relation / interaction",
      C: "Preuves (repliables)",
      D: "Aligner avec 01/05",
    },
  },
  "08": {
    zh: { A: "红灯信号", B: "复盘问句", C: "何时重跑本题" },
    en: {
      A: "Red-light signals",
      B: "Review questions",
      C: "When to rerun",
    },
    es: {
      A: "Señales de alerta",
      B: "Preguntas de revisión",
      C: "Cuándo volver a ejecutar",
    },
    de: {
      A: "Rotlicht-Signale",
      B: "Rückblick-Fragen",
      C: "Wann neu laufen",
    },
    fr: {
      A: "Signaux d'alerte",
      B: "Questions de revue",
      C: "Quand relancer",
    },
  },
  "03": {
    zh: { A: "八字本题切片", B: "紫微本题切片", C: "对照一句" },
    en: {
      A: "Bazi slice for this question",
      B: "Ziwei slice for this question",
      C: "One-line contrast",
    },
    es: {
      A: "Corte Bazi de esta pregunta",
      B: "Corte Ziwei de esta pregunta",
      C: "Contraste en una línea",
    },
    de: {
      A: "Bazi-Schnitt zu dieser Frage",
      B: "Ziwei-Schnitt zu dieser Frage",
      C: "Einzeiliger Kontrast",
    },
    fr: {
      A: "Tranche Bazi pour cette question",
      B: "Tranche Ziwei pour cette question",
      C: "Contraste en une ligne",
    },
  },
};

export function faceSegmentLabel(
  pageId: DecisionPageId,
  segmentId: PageSegmentId | string,
  locale: string,
): string {
  const bucket = deliveryLocaleBucket(locale);
  const fromTable = FACE_SEGMENT_LABELS[pageId]?.[bucket]?.[segmentId as PageSegmentId];
  if (fromTable) return fromTable;
  const seg = DECISION_PAGE_SCHEMAS[pageId].segments.find((s) => s.id === segmentId);
  return seg?.label ?? segmentId;
}

export function faceSegmentLabels(
  pageId: DecisionPageId,
  locale: string,
): { id: PageSegmentId; label: string; duty: string }[] {
  return DECISION_PAGE_SCHEMAS[pageId].segments.map((s) => ({
    id: s.id,
    label: faceSegmentLabel(pageId, s.id, locale),
    duty: s.duty,
  }));
}
