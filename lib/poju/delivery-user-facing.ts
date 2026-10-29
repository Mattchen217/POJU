/**
 * User-facing delivery markdown cleanup.
 * Stored books keep Chinese argument chrome (`### 核心判定`) and schema fences.
 * The flip viewer and offline HTML re-label / strip those at render time.
 */

import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  extractPageSchemaFromMarkdown,
  pageSchemaToArgumentBodies,
  signalsCloseSealBodyIndexes,
  stripPageSchemaFence,
} from "@/lib/llm/pro/delivery/page-schema/render";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { splitSectionBlocks } from "@/lib/poju/delivery-report-v2-split";

type Chrome = {
  coreJudgment: string;
  primaryPath: string;
  backupPath: string;
  chip: string;
  corePlay: string;
  why: string;
  condition: string;
  surface: string;
  essence: string;
  upside: string;
  cost: string;
  risk: string;
  reversible: string;
  when: string;
  exit: string;
  opening: string;
  primaryScience: string;
  backupScience: string;
  actions: string;
  metrics: string;
  strategy: string;
  related: string;
  redLight: string;
  trap: string;
  switchBackup: string;
  protection: string;
  appear: string;
  thenDo: string;
  watch: string;
  forbid: string;
  identity: string;
  before: string;
  after: string;
  whyShift: string;
  quote: string;
  howToUse: string;
  tonight: string;
  doneLooks: string;
  whyTonight: string;
  day7: string;
  whyShort: string;
  tick: string;
  takeaways: string;
  week: string;
  checklist: string;
};

const CHROME: Record<"en" | "es" | "fr", Chrome> = {
  en: {
    coreJudgment: "Core judgment",
    primaryPath: "Primary path",
    backupPath: "Backup path",
    chip: "Key chip",
    corePlay: "Core play",
    why: "Why",
    condition: "Condition",
    surface: "Surface",
    essence: "Essence",
    upside: "Upside",
    cost: "Cost",
    risk: "Risk",
    reversible: "Reversible",
    when: "When",
    exit: "Exit",
    opening: "Opening",
    primaryScience: "Primary · science",
    backupScience: "Backup · science",
    actions: "Actions",
    metrics: "Metrics",
    strategy: "Strategy",
    related: "Related angle",
    redLight: "Red light",
    trap: "Trap",
    switchBackup: "Switch to backup",
    protection: "Protection rule",
    appear: "Signal",
    thenDo: "Do",
    watch: "Watch",
    forbid: "Don't",
    identity: "Identity shift",
    before: "Before",
    after: "After",
    whyShift: "Why the shift",
    quote: "Steadying line",
    howToUse: "How to use it",
    tonight: "Tonight · one thing",
    doneLooks: "Done looks like",
    whyTonight: "Why tonight",
    day7: "Next 7 days",
    whyShort: "Why",
    tick: "Tick when",
    takeaways: "Three takeaways",
    week: "Week",
    checklist: "7-day checklist",
  },
  es: {
    coreJudgment: "Juicio central",
    primaryPath: "Vía principal",
    backupPath: "Vía de reserva",
    chip: "Ficha clave",
    corePlay: "Jugada central",
    why: "Por qué",
    condition: "Condición",
    surface: "Superficie",
    essence: "Esencia",
    upside: "Beneficio",
    cost: "Coste",
    risk: "Riesgo",
    reversible: "Reversible",
    when: "Cuándo",
    exit: "Salida",
    opening: "Apertura",
    primaryScience: "Principal · ciencia",
    backupScience: "Reserva · ciencia",
    actions: "Acciones",
    metrics: "Métricas",
    strategy: "Estrategia",
    related: "Ángulo relacionado",
    redLight: "Luz roja",
    trap: "Trampa",
    switchBackup: "Cambiar a reserva",
    protection: "Regla de protección",
    appear: "Señal",
    thenDo: "Hacer",
    watch: "Vigilar",
    forbid: "No hacer",
    identity: "Cambio de identidad",
    before: "Antes",
    after: "Después",
    whyShift: "Por qué el cambio",
    quote: "Frase de ancla",
    howToUse: "Cómo usarla",
    tonight: "Esta noche · una cosa",
    doneLooks: "Hecho se ve así",
    whyTonight: "Por qué esta noche",
    day7: "Próximos 7 días",
    whyShort: "Por qué",
    tick: "Marcar cuando",
    takeaways: "Tres cosas",
    week: "Semana",
    checklist: "Lista de 7 días",
  },
  fr: {
    coreJudgment: "Jugement central",
    primaryPath: "Voie principale",
    backupPath: "Voie de secours",
    chip: "Atout clé",
    corePlay: "Jeu central",
    why: "Pourquoi",
    condition: "Condition",
    surface: "Surface",
    essence: "Fond",
    upside: "Gain",
    cost: "Coût",
    risk: "Risque",
    reversible: "Réversible",
    when: "Quand",
    exit: "Sortie",
    opening: "Ouverture",
    primaryScience: "Principal · science",
    backupScience: "Secours · science",
    actions: "Actions",
    metrics: "Indicateurs",
    strategy: "Stratégie",
    related: "Angle lié",
    redLight: "Feu rouge",
    trap: "Piège",
    switchBackup: "Basculer vers le secours",
    protection: "Règle de protection",
    appear: "Signal",
    thenDo: "Faire",
    watch: "Surveiller",
    forbid: "Ne pas faire",
    identity: "Changement d'identité",
    before: "Avant",
    after: "Après",
    whyShift: "Pourquoi ce changement",
    quote: "Phrase d'ancrage",
    howToUse: "Comment l'utiliser",
    tonight: "Ce soir · une chose",
    doneLooks: "Fait ressemble à",
    whyTonight: "Pourquoi ce soir",
    day7: "7 prochains jours",
    whyShort: "Pourquoi",
    tick: "Cocher quand",
    takeaways: "Trois choses",
    week: "Semaine",
    checklist: "Liste des 7 jours",
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `### 核心判定` / `**表象:**` → locale chrome. Prose that merely mentions a word is left alone. */
export function relabelDeliveryMarkdownChrome(markdown: string, locale: string): string {
  const bucket = deliveryLocaleBucket(locale);
  if (bucket === "zh" || bucket === "de") return markdown;
  const L = CHROME[bucket];
  const pairs: Array<[string, string]> = [
    ["核心判定", L.coreJudgment],
    ["主路径", L.primaryPath],
    ["辅路径", L.backupPath],
    ["关键筹码", L.chip],
    ["核心打法", L.corePlay],
    ["为何切换", L.whyShift],
    ["为何今晚", L.whyTonight],
    ["做成什么样", L.doneLooks],
    ["今晚一件事", L.tonight],
    ["身份重塑", L.identity],
    ["带走三样", L.takeaways],
    ["切辅开关", L.switchBackup],
    ["防护法则", L.protection],
    ["主·科学", L.primaryScience],
    ["辅·科学", L.backupScience],
    ["相关维", L.related],
    ["硬指标", L.metrics],
    ["怎么用", L.howToUse],
    ["近7日", L.day7],
    ["特有坑", L.trap],
    ["开篇", L.opening],
    ["表象", L.surface],
    ["本质", L.essence],
    ["收益", L.upside],
    ["成本", L.cost],
    ["风险", L.risk],
    ["可逆", L.reversible],
    ["何时", L.when],
    ["退出", L.exit],
    ["行动", L.actions],
    ["策略", L.strategy],
    ["条件", L.condition],
    ["之前", L.before],
    ["之后", L.after],
    ["金句", L.quote],
    ["出现", L.appear],
    ["该做", L.thenDo],
    ["注意", L.watch],
    ["禁做", L.forbid],
    ["为何", L.why],
    ["勾选", L.tick],
    ["红灯", L.redLight],
  ];
  let out = markdown;
  out = out.replace(/###\s+第(\d+)周/g, `### ${L.week} $1`);
  out = out.replace(/###\s+近7日 checklist/g, `### ${L.checklist}`);
  for (const [zh, label] of pairs) {
    const zhRe = escapeRegExp(zh);
    out = out.replace(new RegExp(`###\\s+${zhRe}`, "g"), `### ${label}`);
    out = out.replace(new RegExp(`\\*\\*${zhRe}\\s*[:：]\\*\\*`, "g"), `**${label}:**`);
    out = out.replace(new RegExp(`([-*]\\s+)${zhRe}\\s*[:：]`, "g"), `$1${label}:`);
  }
  return out;
}

/** Shelf merge prefixes `## Section` onto a face that already has its own title. */
export function stripShelfMergeHeadings(markdown: string): string {
  return markdown.replace(/^##\s+[^\n]+\n+/gm, "");
}

/**
 * Markdown shown when a face has no page schema.
 * Never leaves a schema fence, a raw `##` merge heading, or Chinese slot labels.
 */
export function prepareUserFacingDeliveryMarkdown(markdown: string, locale: string): string {
  const stripped = stripShelfMergeHeadings(stripPageSchemaFence(markdown));
  return relabelDeliveryMarkdownChrome(stripped, locale);
}

const ENGINE_INVENTORY_TITLE =
  /^(?:engine inventory|实例清单(?:\(引擎\))?|inventario del motor|inventaire moteur|motor-inventar)\b/i;

/**
 * Appendix "engine inventory" is an internal Chinese closed-set for assign.
 * Non-zh readers get the gold-term table instead of that dump.
 */
export function isInternalEngineInventoryModule(
  title: string,
  body: string,
  locale: string,
): boolean {
  if (deliveryLocaleBucket(locale) === "zh") return false;
  const heading = title.trim();
  if (ENGINE_INVENTORY_TITLE.test(heading)) return true;
  const sample = `${heading}\n${body}`.slice(0, 800);
  return /十神|神煞|本命结构关系|大运干支|隐藏干/.test(sample);
}

export type FaceSchemaSlice = {
  schema: DeliveryPageData;
  /** Evidence strings aligned to pageSchemaToArgumentBodies indexes (seals stay empty). */
  evidence: string[];
};

function evidenceForSchema(schema: DeliveryPageData, region: string): string[] {
  let bodies: ReturnType<typeof pageSchemaToArgumentBodies>;
  try {
    bodies = pageSchemaToArgumentBodies(schema);
  } catch {
    return [];
  }
  const seals =
    schema.page === "validation_close"
      ? signalsCloseSealBodyIndexes(bodies.length)
      : new Set<number>();
  const blocks = splitSectionBlocks(stripPageSchemaFence(region));
  const found = blocks.filter((block) => block.kind === "evidence").map((block) => block.text);
  if (schema.page === "decision_brief") return bodies.map(() => "");
  const out = bodies.map(() => "");
  let cursor = 0;
  for (let i = 0; i < bodies.length; i++) {
    if (seals.has(i)) continue;
    out[i] = found[cursor] ?? "";
    cursor += 1;
  }
  return out;
}

/**
 * One shelf face can fold several papers. Each closed schema fence is one slot tree.
 * Evidence stays with the markdown that follows that fence, not the Chinese `###` labels.
 */
export function extractFaceSchemaSlices(markdown: string): FaceSchemaSlice[] {
  const source = markdown ?? "";
  const re = /```poju-page-schema\s*[\s\S]*?```/gi;
  const fences: Array<{ index: number; raw: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    fences.push({ index: match.index, raw: match[0] });
  }
  const slices: FaceSchemaSlice[] = [];
  for (let index = 0; index < fences.length; index++) {
    const fence = fences[index]!;
    const schema = extractPageSchemaFromMarkdown(fence.raw);
    if (!schema) continue;
    const start = fence.index + fence.raw.length;
    const end = fences[index + 1]?.index ?? source.length;
    const region = source.slice(start, end).replace(/\n##\s+[^\n]+\s*$/u, "").trim();
    slices.push({ schema, evidence: evidenceForSchema(schema, region) });
  }
  return slices;
}
