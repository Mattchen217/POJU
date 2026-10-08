import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";
import {
  PLAIN_FALLBACK_BODY_SINGLES,
  PLAIN_FALLBACK_COMPOUNDS,
  SSOT_DERIVED_FALLBACK,
} from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  shapeMarkEvidenceForLocale,
  type ShapedMarkEvidence,
} from "@/lib/llm/pro/delivery/mark-evidence-opaque";

/**
 * Mark-step mode:
 * - combined: one connective call in the **delivery locale** (zh or target language).
 * - split: kept for env compatibility; same as combined (body translation is separate).
 *
 * Pipeline (P5): evidence LLM writes `⟦w:真词⟧` → this step rewrites connective only
 * while keeping every word-slot → code encodes to `⟦t:slug|…⟧` after mark succeeds.
 */
export type DeliveryMarkMode = "combined" | "split";

export type MarkEvidenceContext = {
  /** User's original question / dilemma — drives situational connective prose. */
  original_question?: string | null;
  /**
   * Attempt-2 acceptance corrective (category · Lab/production 1+1).
   * Appended to user; never case-phrase bans.
   */
  acceptance_corrective?: string | null;
};

export type MarkEvidenceArgInput = {
  /** Narrative argument body (for situational gloss). */
  body: string;
  /** Raw evidence with `⟦w:真词⟧` slots — mark only rewrites connective between slots. */
  evidence: string;
};

export function resolveDeliveryMarkMode(
  env: Record<string, string | undefined> = process.env,
): DeliveryMarkMode {
  return env.DELIVERY_MARK_MODE?.trim() === "split" ? "split" : "combined";
}

export function isZhLocale(locale: string): boolean {
  return locale.trim().toLowerCase().startsWith("zh");
}

/**
 * Same native-speaker bar as P2 body-polish: L1 writer + high-school reader, no calque.
 * Connective only — do not paste sample plots.
 */
function connectiveTranslatorPersona(locale: string): string {
  const lang = locale.trim().toLowerCase() || "en";
  if (lang.startsWith("es")) {
    return `Eres de Estados Unidos y el español es tu lengua materna. Escribes para un estudiante de secundaria en EE.UU. cuya lengua materna es el español (unos 15–16 años).
No traduzcas el chino de las costuras palabra por palabra, ni dejes muebles de carta en inglés/español técnico (pilares, «en tu carta»). Entre ranuras de cinco elementos, di qué hace ese refuerzo a tu capacidad o a las voces que compiten — no un verbo cíclico de una sola palabra. Dilo como se lo explicarías en voz alta.`;
  }
  if (lang.startsWith("fr")) {
    return `Tu es français(e). Le français est ta langue maternelle. Tu écris pour un lycéen français dont c’est aussi la langue maternelle (vers 15–16 ans).
Ne traduis pas le chinois des interstices mot à mot, et n’y laisse pas le jargon de carte (piliers, « dans ton thème »). Entre marques des cinq éléments, dis ce que ce renfort fait à ta capacité ou aux voix qui se disputent — pas un verbe de cycle d’un seul mot. Dis-le comme tu l’expliquerais à voix haute.`;
  }
  return `You are an American. English is your first language. Write for a native-English US high school student (about 15–16, 10th–11th grade).
Do not calque the Chinese between slots — do not give each mechanism verb (泄/扶/透/藏/生 and the like) a one-word English stand-in, and do not leave English chart furniture in the connective (pillars / "in your chart" / palace-as-label). Between five-element slots, say what that feed does to capacity or competing voices — not a one-word cycle gloss. Say it the way you would actually explain out loud: what drains capacity, what restores steadiness, why this person stalls on the choice at hand.`;
}

/**
 * Soft/mark does **not** feed the user question — connective rewrites judgment
 * seams from body + slots only. Long dilemma essays burn high-effort CoT.
 */

/** FROZEN · DO NOT APPEND — legacy gate helper only; never dump into mark system prompt. */
const MARK_PLAIN_EXTRA_BAN_ZH = [
  "食神",
  "伤官",
  "七杀",
  "偏官",
  "正官",
  "正印",
  "偏印",
  "枭神",
  "正财",
  "偏财",
  "比肩",
  "劫财",
  "比劫",
  "印星",
  "官星",
  "财星",
  "杀星",
  "才星",
  "生扶",
  "泄身",
  "泄秀",
  "吐秀",
  "化杀",
  "制食",
  "生身",
  "克身",
  "攻身",
  "克泄",
  "当令",
  "失令",
  "透干",
  "无强根",
  "通根",
  "双透",
  "合化",
  "乙庚",
  "贵人",
  "才华星",
  "压力星",
  "支持星",
] as const;

/**
 * FROZEN · DO NOT APPEND（铁律 · 禁止逐步加长禁表）。
 * Legacy post-hoc scanner for connective outside `⟦w:⟧` only — not a prompt teaching list.
 * Lab 新失败 → 加厚 mark 身份/任务/类别禁区，禁止再往本表加词。
 * 槽内真词不受影响（扫描前会先剥槽）。
 */
export const MARK_MINGLI_CHENGYU_BAN_ZH = [
  // --- 1. 十神与格局生克 ---
  "官印相生",
  "杀印相生",
  "财官相生",
  "食神制杀",
  "食神生财",
  "伤官生财",
  "伤官见官",
  "伤官配印",
  "比劫夺财",
  "比劫争财",
  "比劫帮身",
  "官杀混杂",
  "羊刃驾杀",
  "贪财坏印",
  "财星破印",
  "枭神夺食",
  "偏印夺食",
  "七杀攻身",
  "七杀缠身",
  "伤官伤尽",
  "财杀相生",
  "财生官杀",
  "食伤泄秀",
  "化杀为权",
  "以杀化权",
  "印绶护身",
  "印来护身",
  "官来克身",

  // --- 2. 身强身弱与状态 ---
  "财多身弱",
  "财多身旺",
  "印旺身强",
  "印旺身弱",
  "杀重身轻",
  "身杀两停",
  "从财而化",
  "克泄交加",
  "生扶无力",
  "通关无力",
  "通关有力",
  "身旺无依",
  "身弱难支",
  "身弱不胜",
  "财官双美",
  "通根得地",
  "透干得令",
  "日坐羊刃",

  // --- 3. 五行象形与调候 ---
  "火旺木焚",
  "水旺木浮",
  "水泛木浮",
  "土多金埋",
  "土重埋金",
  "金寒水冷",
  "木火通明",
  "水火既济",
  "燥土焦金",
  "湿木无焰",
  "水多土荡",
  "水大土崩",
  "火烈土燥",
  "火多土焦",
  "火炎土燥",
  "木多火塞",
  "木塞火熄",
  "金水相涵",
  "金水聪明",
  "金多水浊",
  "金沉水底",
  "寒木向阳",
  "木旺土崩",

  // --- 4. 神煞类（槽外禁写标签；槽内真词仍可保留）---
  "驿马星动",
  "驿马奔波",
  "天乙贵人",
  "文昌贵人",
  "天罗地网",
  "华盖入命",
  "孤辰寡宿",
  "咸池桃花",
  "羊刃倒戈",
  "桃花入命",
  "劫煞入命",
  "亡神入命",
  "空亡入命",
  "天德月德",
  "红鸾天喜",
  "阴差阳错",
  "阴阳差错",
  "十恶大败",
  "孤鸾入命",
  "血刃入命",
  "元辰入命",

  // --- 5. 岁运与刑冲合害 ---
  "天克地冲",
  "天冲地克",
  "天合地合",
  "天合地冲",
  "干合支冲",
  "岁运并临",
  "伏吟反吟",
  "双重伏吟",
  "三刑会冲",
  "丑未戌刑",
  "寅巳申刑",
  "盖头截脚",
  "三合会局",
  "半合会局",
  "子午相冲",
  "卯酉相冲",
  "辰戌相冲",
  "丑未相冲",
  "寅申相冲",
  "巳亥相冲",
  "流年冲命",
  "大运冲命",
  "交脱之际",
  "火局泄木",
  "火旺木焚",
  "水多木漂",
  "土重埋金",
  "金寒水冷",
] as const;

/**
 * FROZEN · DO NOT APPEND（铁律 · 禁止逐步加长禁表）。
 * Legacy scanner for short jargon left in connective after a slot split.
 */
export const MARK_CONNECTIVE_SHORT_JARGON_ZH = [
  "制杀",
  "泄木",
  "泄身",
  "火局",
  "合官",
  "合身",
  "见官",
  "攻身",
  "夺食",
  "夺财",
  "破印",
  "化杀",
  "化权",
  "护身",
  "克身",
  "帮身",
  "生扶",
  "通根",
  "得根",
  "失令",
  "得令",
  "身弱",
  "身强",
  "日主",
  "用神",
  "忌神",
  "喜神",
  "七杀",
  "正官",
  "伤官",
  "食神",
  "正印",
  "偏印",
  "比肩",
  "劫财",
  "正财",
  "偏财",
] as const;

function rankedMarkPlainBanZh(): string[] {
  const fromSsot = [...BANNED_TERMS_ZH].filter((w) => w.length >= 2);
  return [...new Set([...fromSsot, ...MARK_PLAIN_EXTRA_BAN_ZH])].sort(
    (a, b) => b.length - a.length,
  );
}

const MARK_PLAIN_BAN_RANKED_ZH = rankedMarkPlainBanZh();

/** Strip `⟦w:…⟧` / `⟦词:…⟧` so bans apply only to connective vernacular. */
export function stripWordSlotsForBanScan(text: string): string {
  return (text ?? "").replace(/⟦(?:w|词):[^⟧]*⟧/g, "");
}

/** First hit of a 命理四字格 in connective (outside word-slots), or null. */
export function findMingliChengyuOutsideSlots(text: string): string | null {
  const connective = stripWordSlotsForBanScan(text);
  // Longer phrases first so「双重伏吟」等不被短词误伤匹配顺序干扰。
  const ranked = [...MARK_MINGLI_CHENGYU_BAN_ZH].sort((a, b) => b.length - a.length);
  for (const phrase of ranked) {
    if (connective.includes(phrase)) return phrase;
  }
  return null;
}

/** First short 命理 fragment in connective outside slots, or null. */
export function findConnectiveShortJargonOutsideSlots(text: string): string | null {
  const connective = stripWordSlotsForBanScan(text);
  const ranked = [...MARK_CONNECTIVE_SHORT_JARGON_ZH].sort((a, b) => b.length - a.length);
  for (const phrase of ranked) {
    if (connective.includes(phrase)) return phrase;
  }
  return null;
}

/** First 闭集裸专名 in connective (outside `⟦w:⟧`), or null. */
export function findConnectiveBannedTermOutsideSlots(text: string): string | null {
  const connective = stripWordSlotsForBanScan(text);
  for (const phrase of MARK_PLAIN_BAN_RANKED_ZH) {
    if (phrase.length < 2) continue;
    if (connective.includes(phrase)) return phrase;
  }
  return null;
}

/**
 * Non-zh connective: English chart furniture / one-word five-element cycle gloss
 * between slots (same category as mark foreign persona — not a Lab-sentence ban table).
 */
export function findForeignChartFurnitureOutsideSlots(text: string): string | null {
  const connective = stripWordSlotsForBanScan(text);
  const furniture: Array<{ re: RegExp; label: string }> = [
    { re: /\bpillars?\b/i, label: "pillars" },
    { re: /\bin your chart\b/i, label: "in your chart" },
    { re: /\bin the chart\b/i, label: "in the chart" },
  ];
  for (const f of furniture) {
    if (f.re.test(connective)) return f.label;
  }
  return null;
}

/** Gap that is only a one-word 生/泄 cycle gloss (produces / nourishes the / …). */
export function findForeignOneWordCycleGap(text: string): string | null {
  const re =
    /⟧(\s*(?:(?:the|which\s+is)\s+)?(?:produces|producing|generates|generating|nourishes|nourishing|feeds|feeding)(?:\s+the)?\s*)⟦/gi;
  const m = re.exec(text ?? "");
  if (!m) return null;
  const gap = (m[1] ?? "").trim().toLowerCase();
  return gap || "cycle_gloss";
}

function lookupMarkPlainFallback(term: string): string | undefined {
  return (
    PLAIN_FALLBACK_COMPOUNDS[term] ??
    PLAIN_FALLBACK_BODY_SINGLES[term] ??
    SSOT_DERIVED_FALLBACK.get(term)
  );
}

/**
 * Replace known connective jargon outside `⟦w:⟧` / `⟦词:⟧` / `⟦t:⟧`
 * using plain-fallback map — zero LLM.
 * Covers short jargon + plain-ban terms that already have a fallback
 * (e.g. 官星/财星合称 leaked from body). Unknown hits stay for the gate.
 * Does **not** grow ban tables — only rewrites when a fallback already exists.
 */
export function repairMarkConnectivePlainJargon(text: string): {
  text: string;
  repaired_terms: string[];
} {
  if (!text?.trim()) return { text: text ?? "", repaired_terms: [] };

  const slots: string[] = [];
  let work = text.replace(/⟦(?:w|词|t):[^⟧]*⟧/g, (m) => {
    const i = slots.length;
    slots.push(m);
    return `\u0000S${i}\u0000`;
  });

  const candidates = [
    ...new Set([...MARK_CONNECTIVE_SHORT_JARGON_ZH, ...MARK_PLAIN_BAN_RANKED_ZH]),
  ].sort((a, b) => b.length - a.length);

  const repaired_terms: string[] = [];
  for (let n = 0; n < 24; n++) {
    let hit: string | null = null;
    for (const phrase of candidates) {
      if (phrase.length < 2) continue;
      if (work.includes(phrase) && lookupMarkPlainFallback(phrase)) {
        hit = phrase;
        break;
      }
    }
    if (!hit) break;
    const plain = lookupMarkPlainFallback(hit)!;
    if (/^[年月日時][支柱]$/.test(hit)) {
      work = work.replace(new RegExp(`${hit}(?!出)`, "g"), plain);
    } else {
      work = work.split(hit).join(plain);
    }
    if (!repaired_terms.includes(hit)) repaired_terms.push(hit);
  }

  const restored = work.replace(/\u0000S(\d+)\u0000/g, (_, i: string) => slots[Number(i)] ?? "");
  return { text: restored, repaired_terms };
}

/**
 * Adjacent word-slots with insufficient connective (金字贴死 / 虚缝).
 * zh: gap must have ≥{@link MIN_ADJACENT_VERNACULAR_HAN} Han.
 * en/es/fr: gap must have ≥{@link MIN_ADJACENT_VERNACULAR_LATIN} letters
 * (same idea as body-polish: do not score Latin connective with Han compactLen).
 */
export const MIN_ADJACENT_VERNACULAR_HAN = 4;
export const MIN_ADJACENT_VERNACULAR_LATIN = 4;

export function countHanChars(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

export function countLatinLetters(text: string): number {
  return (text.match(/[A-Za-zÀ-ÿĀ-ž]/g) ?? []).length;
}

export function countGapVernacularUnits(gap: string, locale = "zh"): number {
  return isZhLocale(locale) ? countHanChars(gap) : countLatinLetters(gap);
}

export function minAdjacentVernacular(locale = "zh"): number {
  return isZhLocale(locale) ? MIN_ADJACENT_VERNACULAR_HAN : MIN_ADJACENT_VERNACULAR_LATIN;
}

export function hasAdjacentWordSlotsWithoutVernacular(
  text: string,
  locale = "zh",
): boolean {
  const t = text ?? "";
  const floor = minAdjacentVernacular(locale);
  const re = /⟧([^⟦]*)⟦/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const gap = m[1] ?? "";
    if (countGapVernacularUnits(gap, locale) < floor) return true;
  }
  return false;
}

/** Gaps that will fail {@link hasAdjacentWordSlotsWithoutVernacular} — for mark duty, not a ban table. */
export function listThinWordSlotGaps(text: string): Array<{
  left: string;
  gap: string;
  right: string;
  han: number;
}> {
  const slots = [...(text ?? "").matchAll(/⟦(?:w|词):([^⟧]+)⟧/g)].map((m) =>
    String(m[1] ?? ""),
  );
  const out: Array<{ left: string; gap: string; right: string; han: number }> = [];
  const gapRe = /⟧([^⟦]*)⟦/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = gapRe.exec(text ?? "")) !== null) {
    const gap = m[1] ?? "";
    const han = countHanChars(gap);
    if (han < MIN_ADJACENT_VERNACULAR_HAN) {
      out.push({
        left: slots[i] ?? "",
        gap,
        right: slots[i + 1] ?? "",
        han,
      });
    }
    i += 1;
  }
  return out;
}

/**
 * Input seams that mention Chinese time/柱 furniture outside slots.
 * Foreign mark often calques 月年 → "month and year pillars" — duty must flag them
 * even when the gap already has ≥4 Han (so they never appear in thin-seam list).
 */
const ZH_TIME_FURNITURE_IN_GAP =
  /月年|年月|年柱|月柱|日柱|时柱|年干|月干|日干|时干|年支|月支|日支|时支/;

export function listChineseTimeFurnitureGaps(text: string): Array<{
  left: string;
  gap: string;
  right: string;
  hit: string;
}> {
  const slots = [...(text ?? "").matchAll(/⟦(?:w|词):([^⟧]+)⟧/g)].map((m) =>
    String(m[1] ?? ""),
  );
  const out: Array<{ left: string; gap: string; right: string; hit: string }> = [];
  const gapRe = /⟧([^⟦]*)⟦/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = gapRe.exec(text ?? "")) !== null) {
    const gap = m[1] ?? "";
    const hit = gap.match(ZH_TIME_FURNITURE_IN_GAP)?.[0];
    if (hit) {
      out.push({
        left: slots[i] ?? "",
        gap,
        right: slots[i + 1] ?? "",
        hit,
      });
    }
    i += 1;
  }
  return out;
}

/** Runs of ≥3 slots chained by seams shorter than the stack-break floor (叠金墙). */
export function listShortStackRuns(
  text: string,
  locale = "zh",
): Array<{ startSlot: number; endSlot: number; shortGaps: number[] }> {
  const floor = minStackBreakVernacular(locale);
  const maxRun = maxTermMarkersPerClause(locale);
  const gapLens: number[] = [];
  const gapRe = /⟧([^⟦]*)⟦/g;
  let m: RegExpExecArray | null;
  while ((m = gapRe.exec(text ?? "")) !== null) {
    gapLens.push(countGapVernacularUnits(m[1] ?? "", locale));
  }
  const out: Array<{ startSlot: number; endSlot: number; shortGaps: number[] }> =
    [];
  let runStart = 0;
  let run = 1;
  for (let i = 0; i < gapLens.length; i++) {
    if (gapLens[i]! < floor) {
      run += 1;
      if (run > maxRun) {
        // emit/extend current stack covering slots [runStart .. i+1]
        const last = out[out.length - 1];
        if (last && last.endSlot === i) {
          last.endSlot = i + 1;
          last.shortGaps.push(gapLens[i]!);
        } else {
          out.push({
            startSlot: runStart,
            endSlot: i + 1,
            shortGaps: gapLens.slice(runStart, i + 1),
          });
        }
      }
    } else {
      run = 1;
      runStart = i + 1;
    }
  }
  return out;
}

function thinGapDutyBlock(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  outLocale = "zh",
): string {
  const lines: string[] = [];
  const zh = isZhLocale(outLocale);
  const lang = outLocale.trim() || "en";
  for (const [k, pack] of Object.entries(segments)) {
    (pack.arguments ?? []).forEach((a, i) => {
      const ev = a.evidence ?? "";
      const thin = listThinWordSlotGaps(ev);
      if (thin.length > 0) {
        lines.push(
          zh
            ? `- ${k}[${i}] 下面这些缝太薄了（空着、只有逗号、或只剩虚词/半文言）——请各改写成一小句完整人话，讲清谁对谁做了什么；书签整段原样不动:`
            : `- ${k}[${i}] these seams are too thin — rewrite each as a full short clause in ${lang} (keep slots):`,
        );
        for (const g of thin) {
          const shown = g.gap.trim() ? `「${g.gap}」` : "（中间是空的）";
          const mech = /^[生泄扶透藏克制]+$/.test(g.gap.trim());
          if (!zh && mech) {
            lines.push(
              `  · ${g.left} … ${shown} … ${g.right} → say what that does to capacity / competing voices; never leave only feeds/produces/drains`,
            );
          } else {
            lines.push(`  · ${g.left} … ${shown} … ${g.right}`);
          }
        }
      }
      // Stack wall: one line per dense arg — do not list every seam (burns CoT counting).
      if (zh) {
        const stacks = listShortStackRuns(ev, outLocale);
        if (stacks.length > 0) {
          lines.push(
            `- ${k}[${i}] 这一条书签很密，读起来会像金字墙——请在中间插入更完整的因果句（谁耗力气、谁加压），别用一连串短缝硬拼`,
          );
        }
      }
      if (!zh) {
        const timeSeams = listChineseTimeFurnitureGaps(ev);
        if (timeSeams.length > 0) {
          lines.push(
            `- ${k}[${i}] Chinese time/柱 words outside slots — rewrite as spoken calendar/time (this year / these months), NEVER "pillars" / "in your chart" / palace labels (keep slots exactly):`,
          );
          for (const g of timeSeams) {
            lines.push(`  · ${g.left} … 「${g.gap.trim()}」(hit「${g.hit}」) … ${g.right}`);
          }
        }
      }
    });
  }
  if (lines.length === 0) return "";
  const heading = zh
    ? "\n\n# 提醒（对着下面清单改，别跳过）\n输入里这些地方的连接还太薄或太密。请按条加厚成完整人话；书签一个字都别改。\n"
    : "\n\n# Reminder: these input seams are too thin — thicken them\n";
  return `${heading}${lines.join("\n")}\n`;
}

/**
 * Max consecutive dense marker run (checklist F: 连续堆叠 ≤2).
 * 3+ slots in one sentence are OK when each gap has real connective vernacular.
 * Non-zh allows one more short prepositional hop — Latin "appears at / and since"
 * is normal grammar, not a zh-style gold wall of 的/和 pads.
 */
export const MAX_TERM_MARKERS_PER_CLAUSE = 2;
export const MAX_TERM_MARKERS_PER_CLAUSE_LATIN = 3;

export function maxTermMarkersPerClause(locale = "zh"): number {
  return isZhLocale(locale)
    ? MAX_TERM_MARKERS_PER_CLAUSE
    : MAX_TERM_MARKERS_PER_CLAUSE_LATIN;
}

/**
 * Gaps shorter than this still count as "stacked" (passes adjacent ≥4 but L276-style).
 * A gap with ≥ this many units (Han in zh, Latin letters otherwise) breaks the run.
 * Latin uses the same 2× adjacent ratio as zh (4→8), not a harsher 12-letter floor
 * that mistook ordinary EN prepositional seams for gold walls.
 */
export const MIN_STACK_BREAK_VERNACULAR_HAN = 8;
export const MIN_STACK_BREAK_VERNACULAR_LATIN = 8;

export function minStackBreakVernacular(locale = "zh"): number {
  return isZhLocale(locale)
    ? MIN_STACK_BREAK_VERNACULAR_HAN
    : MIN_STACK_BREAK_VERNACULAR_LATIN;
}

/**
 * True when any dense consecutive run of ⟦w:⟧/⟦t:⟧ exceeds
 * {@link MAX_TERM_MARKERS_PER_CLAUSE} (L276-style gold walls of short pads).
 * Does **not** ban 3+ markers that are separated by ≥{@link MIN_STACK_BREAK_VERNACULAR_HAN} Han.
 */
export function hasExcessTermStackInClause(
  text: string,
  maxConsecutive: number = MAX_TERM_MARKERS_PER_CLAUSE,
  minBreak: number = MIN_STACK_BREAK_VERNACULAR_HAN,
  locale = "zh",
): boolean {
  const t = text ?? "";
  if (!t.trim()) return false;
  const floor = minBreak;
  const gapRe = /⟧([^⟦]*)⟦/g;
  let run = 1;
  let m: RegExpExecArray | null;
  while ((m = gapRe.exec(t)) !== null) {
    const gap = m[1] ?? "";
    if (countGapVernacularUnits(gap, locale) < floor) {
      run += 1;
      if (run > maxConsecutive) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/**
 * Local repair for dense short-pad stacks (mark_term_stack) — insert ≥8 Han
 * connective before a 3rd consecutive short gap so we don't burn another LLM mark.
 */
export function repairExcessTermStacks(
  text: string,
  maxConsecutive: number = MAX_TERM_MARKERS_PER_CLAUSE,
  minBreakHan: number = MIN_STACK_BREAK_VERNACULAR_HAN,
): string {
  const raw = text ?? "";
  if (!hasExcessTermStackInClause(raw, maxConsecutive, minBreakHan)) return raw;
  const STACK_BREAK_PAD = "这一环接着落到下一点";
  let run = 1;
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    const han = countHanChars(gap);
    if (han < minBreakHan) {
      run += 1;
      if (run > maxConsecutive) {
        run = 1;
        const trimmed = gap.trim();
        return trimmed
          ? `⟧${trimmed}${STACK_BREAK_PAD}⟦`
          : `⟧${STACK_BREAK_PAD}⟦`;
      }
      return `⟧${gap}⟦`;
    }
    run = 1;
    return `⟧${gap}⟦`;
  });
}

function buildMarkEvidencePromptZh(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  void ctx;
  const system = `# 你是谁、你在干什么
你是「依据软译员」。你的工作很单一：把已经打好书签的专业依据，改写成普通人能一口气读懂的句子。
用户看不见这些专业名词时会懵；书签（金字）留给后面折叠展示，你负责把书签**中间**的连接写成大白话，把因果讲清楚。
你不是在写人生建议，不是在回答用户的选择题，也不是在重写 body 里的主张——body 只是给你看懂这段在讲什么用的。

# 书签是什么、为什么碰不得（最重要）
输入里已经用 \`⟦w:…⟧\` 标好了关键术语，你可以把它想成贴在句子上的书签/便利贴。
规矩只有一条，但必须抠死：
1. **书签整段原样保留**：从左 \`⟦w:\` 到右 \`⟧\`，一个字符都不能改。
2. **不能删书签、不能少书签、不能多造书签、不能把两个书签拆开或合并。**
3. **不能改书签里面的字**：多写一个字、少写一个字、把尾字再叠一遍（比如把某个干支结尾字多抄一次），全都算错。
4. **抄写时整段照抄**：眼睛看一眼输入里的书签，手就原样打出来；不要凭记忆「补全」或「再念一遍」。
5. **书签外面不要再写书签里面已经出现过的专名**：旁边已经有书签了，外面就用「它 / 这一环 / 这边」或直接接动作，别把书签里的词再抄到外面当主语。

你只改书签和书签**之间**、以及首尾书签外侧的连接白话。

# 具体怎么做（按这个顺序想，别绕远）
1. 先安静读一遍这条的 body，弄懂「这段主张在说什么压力/链路」。读懂就行，**千万别把 body 原文抄进答案**。
2. 再看 evidence 里一串书签：谁先出现、谁接着压上来、最后为什么主张成立。
3. 用生活里听得懂的话把它们串起来，重点说三件事：
   - 什么在耗力气、拖节奏；
   - 什么让人更难稳住、回旋余地变小；
   - 所以这段主张为什么对这个人成立（讲机制，不讲鸡汤故事）。
4. 写完自己默读一遍：像不像一个普通人能听懂的解释？如果中间全是单字、逗号、半文言，就重写那一缝。

# 连接要写多厚（这里最容易翻车，请啰嗦一点写）
两个书签之间，请写成**半句完整人话**：讲清「谁对谁做了什么、带来什么压力」。
可以写得啰嗦一点，宁可多几个字，也不要用虚词糊过去。

这些都**不够**，单独拿来当缝会翻车：
- 空着、只剩逗号/顿号；
- 半文言单字连接（生 / 泄 / 克 / 冲 一类）；
- 很短的桥词糊过去（使得 / 而且 / 中的 / 缺少 / 带来了 / 会压制 / 引动了 单独当缝）。

一长串书签时，更要小心「金字墙」：如果中间连续好几道缝都又短又虚，读起来就像专名贴贴贴，普通人读不动。
正确做法是：每隔一小段就插入更完整的因果句——谁在耗力气、谁在加压、所以后面那一环为什么更难扛。
**不要**在心里逐缝数汉字、不要反复纠结「这个字算几个汉字」。卡住就换一种说法继续写；禁止同一句翻来覆去死循环。

# 书签外面能写什么、不能写什么
能写：精力、节奏、压力、回旋余地、稳住、拖垮、顶着扛、抢资源……这些生活里听得懂的说法。
不能写（写在书签外面就算错；书签里面的可以留着给后面展示）：
- 再报一遍命理专名、干支报幕；
- 用神 / 忌神 / 喜神一类报幕（它们若在书签里就留在书签里）；
- 十神合称报幕——body 里就算写了「财星 / 官星 / 印星」这类合称，书签外也别照抄；改成「资源这一头 / 制衡这一头 / 内在支持」；
- 格局口号、半文言生克套话（泄耗 / 克制 / 冲克 / 自坐 也尽量改成消耗 / 压制 / 冲撞 / 坐落在）；
- 十神攻防缩略——请改成「抢资源 / 顶着扛 / 互相较劲」这类生活说法。

记住分工：书签里 = 真词留给展示；书签外 = 只给人话连接。body 只用来理解意思，里面的专名合称不要搬进连接。

# 交卷格式（别发挥）
只输出一个 JSON，形状必须是：
\`{"arguments":[{"evidence":"..."},...]}\`
- 条数、顺序和输入完全一样；
- 每条对象里只填 evidence；
- 输入里本来是空的 evidence，就继续空着；
- 不要输出 body，不要包一层别的字段，不要写解释。
想清楚就写正文；推理里别写很长的内心独白，更别在推理里把书签尾字叠着念。
`;
  const payload = JSON.stringify(segments, null, 2);
  const corrective = ctx?.acceptance_corrective?.trim()
    ? `\n\n${ctx.acceptance_corrective.trim()}\n`
    : "";
  const user = `下面是要改写的依据。请只动书签中间的连接白话：
- 所有 \`⟦w:…⟧\` 整段原样保留（里面的字一个都不能多、不能少、不能叠尾字）；
- 不要抄 body；
- 每个缝写成半句完整人话，讲清谁对谁施压、带来什么负担；
- 别用短桥词或半文言单字糊缝；书签太密时插入更完整的因果句，打断金字墙；
- 书签外面只用生活白话，别再报命理专名或十神攻防缩略。

输出且只输出：{"arguments":[{"evidence":"..."},...]}。${corrective}${thinGapDutyBlock(segments)}\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

function buildMarkEvidencePromptForeign(
  shaped: ShapedMarkEvidence,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  void ctx;
  const lang = locale.trim() || "en";
  const system = `# What this job is
${connectiveTranslatorPersona(lang)}
Rewrite the words BETWEEN the numbered bookmarks \`⟦#1⟧\` \`⟦#2⟧\` … into plain spoken **${lang}**.
Do not change any bookmark. Do not copy body. Do not answer the user's life dilemma.

# How to write
Read the legend so you understand the cause chain. Then tell a clear story: what drains capacity, what squeezes room to steady, why this claim holds.
Between two bookmarks, write a full short clause — not glue like \`, and\` / \`of\` / \`to\`. In a long run of bookmarks, insert real causal beats so short pads do not stack.
Do not count letters in private reasoning — just write complete sentences.

# Outside bookmarks
No chart jargon. Observable work/body language only. Native ${lang}.

# Output
One JSON soon: \`{"arguments":[{"evidence":"..."},...]}\` (same length/order; empty stays empty).
`;
  const payload = JSON.stringify(shaped.promptSegments, null, 2);
  const corrective = ctx?.acceptance_corrective?.trim()
    ? `\n\n${ctx.acceptance_corrective.trim()}\n`
    : "";
  const user = `Rewrite connective only in ${lang}; keep every ⟦#N⟧; do not copy body.\nOutput {"arguments":[{"evidence":"..."},...]}.${corrective}${shaped.legendBlock}${thinGapDutyBlock(shaped.dutySegments, lang)}\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/**
 * Connective-only mark. Locale selects connective language (zh vs delivery language).
 * Input is `⟦w:真词⟧` evidence; foreign mark uses opaque `⟦#N⟧` in the LLM payload
 * (restored to `⟦w:⟧` before gate/encode). Code encodes to `⟦t:…⟧` after mark succeeds.
 */
export function buildMarkEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const shaped = shapeMarkEvidenceForLocale(segments, locale);
  return buildMarkEvidencePromptFromShaped(shaped, locale, ctx);
}

/** Same as {@link buildMarkEvidencePrompt} when shape was already computed (Lab + call share one shape). */
export function buildMarkEvidencePromptFromShaped(
  shaped: ShapedMarkEvidence,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  if (isZhLocale(locale)) {
    return buildMarkEvidencePromptZh(shaped.promptSegments, ctx);
  }
  return buildMarkEvidencePromptForeign(shaped, locale, ctx);
}

/** @deprecated Evidence is no longer translated in a separate pass — mark writes locale connective. */
export function buildTranslateEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你把依据里的【串联白话】译成地道 ${locale}。
【铁律】每个 \`⟦w:…⟧\` 原样保留;只译槽外连接文字。禁止发明新槽、禁止改槽内真词。禁止中文命理原词残留在槽外。

# 输出 JSON
\`{ "arguments": [ { "evidence": "…" }, ... ] }\` 长度与输入一致。
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `Translate connective prose only into ${locale}; keep all ⟦w:…⟧ intact.\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Alias — connective language follows delivery locale. */
export function buildMarkOnlyEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  return buildMarkEvidencePrompt(segments, locale, ctx);
}

/**
 * Pack argument tree for the mark step (body + evidence).
 * Never substitutes body for missing evidence.
 */
export function pickMarkEvidenceInput(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: MarkEvidenceArgInput[] }> {
  const out: Record<string, { arguments: MarkEvidenceArgInput[] }> = {};
  for (const k of paths) {
    const args = tree[k] ?? [];
    // Skip empty-evidence seals (P6 quote/takeaways) — they must not consume mark slots.
    const nonempty = args.filter((a) => (a.evidence ?? "").trim());
    if (nonempty.length === 0) continue;
    out[k] = {
      arguments: nonempty.map((a) => ({
        body: (a.body ?? "").trim(),
        evidence: (a.evidence ?? "").trim(),
      })),
    };
  }
  return out;
}

/** Evidence-only payload (legacy / tests). */
export function pickMarkEvidenceOnly(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: Array<{ evidence: string }> }> {
  const out: Record<string, { arguments: Array<{ evidence: string }> }> = {};
  for (const k of paths) {
    const args = tree[k] ?? [];
    if (args.length === 0) continue;
    out[k] = {
      arguments: args.map((a) => ({
        evidence: (a.evidence ?? "").trim(),
      })),
    };
  }
  return out;
}
