/**
 * sliceForPage · 按 PageFeedMatrix 并集裁切一页喂料。
 *
 * 入参：八字 ChartFactPack、紫微 ZiweiFactPack、已有的 User.Q / expect / detail、可选 Sci.hooks、可选 topic。
 * 出参：该页并集里真正有值的短键。空值与未允许的键都不占位。
 *
 * 省略规则（相对 W0 空槽）：
 * - 缺包、null、空串、空数组、空对象：该键不出现。整组没有任何键时，连组名也不出现。
 * - `ziwei` 与 `zfp` 都缺，或允许键上没有可用值：`zfpOmitted`，切片不带 `zfp`。
 * - `otherChart` 为 null（joint 未做）时省略该键，不写成 null。
 * - 页的 sci 为 false，或没给 hooks：不写 `sci`，也不写 `sci: null`。
 * - ChartFactPack 只投影 dayMaster（day_master）、yongJi（用神/喜神/忌神三行）、dayunNow（当前大运一行）。
 *   text、ganzhi、shen_sha、流年、流月、合冲刑害、柱行不进切片。
 * - pathTags / shishenHit / conflictAnchors 只来自显式 `cfp` 短键。题相对，不从全文猜。
 * - 显式短键盖过图表投影。显式空值则去掉该键。
 * - topicPalace 默认用包内命宫。topic 可改指十二宫里的一宫，对宫用 palaces 下标 +6。
 *   切片只留这一宫的薄对象，不附带 palaces / source / role。
 * - `segments` 仍是 allowlist 元数据。填好的值只在 `slice` 上。
 */

import type { ChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import {
  FEED,
  PAGE_SEGMENT_ALLOWLISTS,
  PAGE_UNION_ALLOWLISTS,
  type CfpShortKey,
  type DecisionPageId,
  type FeedFieldCode,
  type PageSciMode,
  type PageUnionAllowlist,
  type SegmentAllowlist,
  type UserShortKey,
  type ZfpShortKey,
} from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

const CFP_SHORT = ["dayMaster", "yongJi", "shishenHit", "dayunNow", "pathTags", "conflictAnchors"] as const;
const ZFP_SHORT = [
  "topicPalace",
  "sihua",
  "daxian",
  "mingShen",
  "otherChart",
  "patternHits",
] as const;
const USER_SHORT = ["Q", "expect", "detail"] as const;
const DUMP_KEYS = new Set(["text", "ganzhi", "shen_sha", "palaces", "source", "day_master"]);

const PALACE_NAMES = new Set([
  "命宫",
  "兄弟",
  "夫妻",
  "子女",
  "财帛",
  "疾厄",
  "迁移",
  "仆役",
  "官禄",
  "田宅",
  "福德",
  "父母",
]);

/** topic 词 → 宫名。未列出的十二宫名也可直接当 topic。 */
const TOPIC_TO_PALACE: Record<string, string> = {
  general: "命宫",
  career_move: "官禄",
  relocation: "迁移",
  partnership: "仆役",
  relationship: "夫妻",
  joint: "夫妻",
  事业换场: "官禄",
  换场: "官禄",
  迁移: "迁移",
  合伙: "仆役",
  亲密: "夫妻",
  亲密关系: "夫妻",
};

const PAGE07_TOPICS = new Set([
  "career_move",
  "relocation",
  "partnership",
  "relationship",
  "joint",
  "事业换场",
  "换场",
  "迁移",
  "合伙",
  "亲密",
  "亲密关系",
]);

export type CfpShortInput = Partial<Record<CfpShortKey, string | readonly string[] | null>>;

export type PageFeedPacks = {
  /** 八字包。只投影三条短事实，不拷 text / ganzhi / shen_sha。 */
  chart?: ChartFactPack | null;
  /**
   * 短键覆盖，或再给一份 ChartFactPack（当 chart 缺时拿来投影）。
   * pathTags、shishenHit、conflictAnchors 只有写在这里才会进切片。
   */
  cfp?: CfpShortInput | ChartFactPack | null;
  /** 与 zfp 同义。两者都有时用这一份。 */
  ziwei?: ZiweiFactPack | null;
  /** ZiweiFactPack，或只含部分 ZFP 短键的对象。null / 省略 = 紫微未进本页。 */
  zfp?: ZiweiFactPack | Partial<ZiweiFactPack> | null;
  user?: Partial<Record<UserShortKey, string | null>> | null;
  sci?: { hooks?: string | readonly string[] | null } | null;
  /**
   * 本题指向。默认命宫。
   * career_move / relocation / partnership / relationship / joint 会改 topicPalace，并让 07 进入阅读序。
   */
  topic?: string | null;
};

export type SlicedTopicPalace = {
  palace: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: string[];
  oppositePalace: string;
  oppositeMajorStars: string[];
};

export type SlicedSihuaHit = {
  mutagen: string;
  star: string;
  palace: string;
};

export type SlicedDaxian = {
  palace: string;
  heavenlyStem: string;
  earthlyBranch: string;
  startAge?: number;
  endAge?: number;
  majorStars: string[];
  sihua: SlicedSihuaHit[];
  liunian?: {
    year?: number;
    heavenlyStem: string;
    earthlyBranch: string;
    palace: string;
    sihua: SlicedSihuaHit[];
  };
};

export type SlicedMingShen = {
  soul: string;
  body: string;
  mingBranch: string;
  shenBranch: string;
  shenPalace: string;
  fiveElementsClass: string;
};

/** Closed-set pattern hit on the page slice (no description). */
export type SlicedPatternHit = {
  name: string;
  level: string;
  palaces: string[];
  required?: string[];
  bonus?: string[];
  breaking?: string[];
  source?: string;
};

export type PageSlice = {
  cfp?: Partial<Record<CfpShortKey, string | readonly string[]>>;
  zfp?: {
    topicPalace?: SlicedTopicPalace | string;
    sihua?: readonly SlicedSihuaHit[] | string;
    daxian?: SlicedDaxian | string;
    mingShen?: SlicedMingShen | string;
    otherChart?: string | Record<string, unknown>;
    patternHits?: readonly SlicedPatternHit[];
  };
  user?: Partial<Record<UserShortKey, string>>;
  sci?: { hooks: string | readonly string[] };
};

export type PageSliceResult = {
  pageId: DecisionPageId;
  allowlist: PageUnionAllowlist;
  /** 段级 allowlist，不是填好的正文。 */
  segments: readonly SegmentAllowlist[];
  slice: PageSlice;
  /** 切片上没有 zfp 组。 */
  zfpOmitted: boolean;
};

/** 旧名。W0 空槽已换成按值裁切，类型仍指向同一次返回。 */
export type PageSliceStub = PageSliceResult;

type PalaceRow = {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: string[];
};

function isDecisionPageId(value: string): value is DecisionPageId {
  return Object.prototype.hasOwnProperty.call(PAGE_UNION_ALLOWLISTS, value);
}

function isChartFactPack(value: unknown): value is ChartFactPack {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.text === "string" && typeof row.day_master === "string";
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => str(item)).filter((item) => item.length > 0);
}

function labeledLine(text: string, label: string): string | undefined {
  const match = new RegExp(`^${label}：([^\\n]*)$`, "m").exec(text);
  const value = match?.[1]?.trim() ?? "";
  if (!value || value === "—" || value === "无") return undefined;
  return `${label}：${value}`;
}

function normalizeScalar(value: unknown): string | readonly string[] | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const list = stringList(value);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

function projectChart(pack: ChartFactPack | null): Partial<Record<CfpShortKey, string>> {
  if (!pack) return {};
  const out: Partial<Record<CfpShortKey, string>> = {};
  const dayMaster = pack.day_master.trim();
  if (dayMaster) out.dayMaster = dayMaster;
  const yongJi = ["用神", "喜神", "忌神"]
    .map((label) => labeledLine(pack.text, label))
    .filter((line): line is string => Boolean(line));
  if (yongJi.length > 0) out.yongJi = yongJi.join("\n");
  const dayunNow = labeledLine(pack.text, "当前大运");
  if (dayunNow) out.dayunNow = dayunNow;
  return out;
}

function shortKeys(codes: readonly string[]): Set<string> {
  return new Set(codes.map((code) => code.slice(code.indexOf(".") + 1)));
}

function buildCfp(allow: Set<string>, packs: PageFeedPacks | undefined): PageSlice["cfp"] | undefined {
  const chart = isChartFactPack(packs?.chart)
    ? packs.chart
    : isChartFactPack(packs?.cfp)
      ? packs.cfp
      : null;
  const overrides = packs?.cfp && !isChartFactPack(packs.cfp) ? packs.cfp : null;
  const merged: Partial<Record<CfpShortKey, string | readonly string[]>> = projectChart(chart);
  if (overrides) {
    for (const key of CFP_SHORT) {
      if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;
      const normalized = normalizeScalar(overrides[key]);
      if (normalized === undefined) delete merged[key];
      else merged[key] = normalized;
    }
  }
  const out: Partial<Record<CfpShortKey, string | readonly string[]>> = {};
  for (const key of CFP_SHORT) {
    if (!allow.has(key) || merged[key] === undefined) continue;
    out[key] = merged[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildUser(allow: Set<string>, user: PageFeedPacks["user"]): PageSlice["user"] | undefined {
  if (!user) return undefined;
  const out: Partial<Record<UserShortKey, string>> = {};
  for (const key of USER_SHORT) {
    if (!allow.has(key)) continue;
    const trimmed = str(user[key]);
    if (!trimmed) continue;
    out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildSci(mode: PageSciMode, sci: PageFeedPacks["sci"]): PageSlice["sci"] | undefined {
  if (mode === false || !sci) return undefined;
  const hooks = normalizeScalar(sci.hooks);
  if (!hooks) return undefined;
  return { hooks };
}

function projectSihua(value: unknown): readonly SlicedSihuaHit[] | string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!Array.isArray(value)) return undefined;
  const hits: SlicedSihuaHit[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const hit = { mutagen: str(row.mutagen), star: str(row.star), palace: str(row.palace) };
    if (!hit.mutagen && !hit.star && !hit.palace) continue;
    hits.push(hit);
  }
  return hits.length > 0 ? hits : undefined;
}

function projectLiunian(value: unknown): SlicedDaxian["liunian"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const sihua = projectSihua(row.sihua);
  const liunian = {
    ...(typeof row.year === "number" ? { year: row.year } : {}),
    heavenlyStem: str(row.heavenlyStem),
    earthlyBranch: str(row.earthlyBranch),
    palace: str(row.palace),
    sihua: Array.isArray(sihua) ? [...sihua] : [],
  };
  if (!liunian.heavenlyStem && !liunian.earthlyBranch && !liunian.palace && liunian.sihua.length === 0 && liunian.year == null) {
    return undefined;
  }
  return liunian;
}

function projectDaxian(value: unknown): SlicedDaxian | string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const sihua = projectSihua(row.sihua);
  const liunian = projectLiunian(row.liunian);
  const daxian: SlicedDaxian = {
    palace: str(row.palace),
    heavenlyStem: str(row.heavenlyStem),
    earthlyBranch: str(row.earthlyBranch),
    majorStars: stringList(row.majorStars),
    sihua: Array.isArray(sihua) ? [...sihua] : [],
    ...(typeof row.startAge === "number" ? { startAge: row.startAge } : {}),
    ...(typeof row.endAge === "number" ? { endAge: row.endAge } : {}),
    ...(liunian ? { liunian } : {}),
  };
  if (!daxian.palace && daxian.majorStars.length === 0 && daxian.sihua.length === 0 && !daxian.liunian) return undefined;
  return daxian;
}

function projectMingShen(value: unknown): SlicedMingShen | string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const mingShen: SlicedMingShen = {
    soul: str(row.soul),
    body: str(row.body),
    mingBranch: str(row.mingBranch),
    shenBranch: str(row.shenBranch),
    shenPalace: str(row.shenPalace),
    fiveElementsClass: str(row.fiveElementsClass),
  };
  if (!mingShen.soul && !mingShen.body && !mingShen.shenPalace && !mingShen.fiveElementsClass) return undefined;
  return mingShen;
}

function projectPatternHits(value: unknown): readonly SlicedPatternHit[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const out: SlicedPatternHit[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const name = str(r.name);
    if (!name) continue;
    const level = str(r.level) || "neutral";
    const palaces = stringList(r.palaces);
    const hit: SlicedPatternHit = { name, level, palaces };
    const required = stringList(r.required);
    const bonus = stringList(r.bonus);
    const breaking = stringList(r.breaking);
    if (required.length) hit.required = required;
    if (bonus.length) hit.bonus = bonus;
    if (breaking.length) hit.breaking = breaking;
    const source = str(r.source);
    if (source) hit.source = source;
    // Never copy description prose onto the slice.
    out.push(hit);
  }
  return out.length > 0 ? out : undefined;
}

function projectOther(value: unknown): string | Record<string, unknown> | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (DUMP_KEYS.has(key) || item == null) continue;
    if (typeof item === "string" && !item.trim()) continue;
    out[key] = item;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readPalaces(source: Record<string, unknown>): PalaceRow[] {
  if (!Array.isArray(source.palaces)) return [];
  const rows: PalaceRow[] = [];
  for (const item of source.palaces) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = str(row.name);
    if (!name) continue;
    rows.push({
      name,
      heavenlyStem: str(row.heavenlyStem),
      earthlyBranch: str(row.earthlyBranch),
      majorStars: stringList(row.majorStars),
    });
  }
  return rows;
}

function thinPalace(row: PalaceRow, opposite?: PalaceRow): SlicedTopicPalace {
  return {
    palace: row.name,
    heavenlyStem: row.heavenlyStem,
    earthlyBranch: row.earthlyBranch,
    majorStars: [...row.majorStars],
    oppositePalace: opposite?.name ?? "",
    oppositeMajorStars: opposite ? [...opposite.majorStars] : [],
  };
}

function projectGivenTopic(value: unknown): SlicedTopicPalace | string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const palace = str(row.palace);
  if (!palace) return undefined;
  return {
    palace,
    heavenlyStem: str(row.heavenlyStem),
    earthlyBranch: str(row.earthlyBranch),
    majorStars: stringList(row.majorStars),
    oppositePalace: str(row.oppositePalace),
    oppositeMajorStars: stringList(row.oppositeMajorStars),
  };
}

function palaceTarget(topic: string | null | undefined): string | null {
  if (!topic?.trim()) return null;
  const key = topic.trim();
  return TOPIC_TO_PALACE[key] ?? (PALACE_NAMES.has(key) ? key : null);
}

function projectTopic(source: Record<string, unknown>, topic: string | null | undefined): SlicedTopicPalace | string | undefined {
  const given = projectGivenTopic(source.topicPalace);
  const target = palaceTarget(topic);
  const palaces = readPalaces(source);
  if (!target || target === "命宫" || palaces.length === 0) return given;
  const index = palaces.findIndex((row) => row.name === target);
  if (index < 0) return given;
  const row = palaces[index];
  if (!row) return given;
  return thinPalace(row, palaces[(index + 6) % palaces.length]);
}

function zfpSource(packs: PageFeedPacks | undefined): Record<string, unknown> | null {
  const raw = packs?.ziwei != null ? packs.ziwei : packs?.zfp;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function buildZfp(
  allow: Set<string>,
  source: Record<string, unknown> | null,
  topic: string | null | undefined,
): PageSlice["zfp"] | undefined {
  if (!source) return undefined;
  const out: NonNullable<PageSlice["zfp"]> = {};
  if (allow.has("topicPalace")) {
    const topicPalace = projectTopic(source, topic);
    if (topicPalace) out.topicPalace = topicPalace;
  }
  if (allow.has("sihua")) {
    const sihua = projectSihua(source.sihua);
    if (sihua) out.sihua = sihua;
  }
  if (allow.has("daxian")) {
    const daxian = projectDaxian(source.daxian);
    if (daxian) out.daxian = daxian;
  }
  if (allow.has("mingShen")) {
    const mingShen = projectMingShen(source.mingShen);
    if (mingShen) out.mingShen = mingShen;
  }
  if (allow.has("otherChart")) {
    const otherChart = projectOther(source.otherChart);
    if (otherChart) out.otherChart = otherChart;
  }
  if (allow.has("patternHits")) {
    const patternHits = projectPatternHits(source.patternHits);
    if (patternHits) out.patternHits = patternHits;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 事业换场 / 迁移 / 合伙 / 亲密 / joint 才插入 07。单写宫名（除「迁移」）不插页。 */
export function page07Applies(topic?: string | null): boolean {
  if (!topic?.trim()) return false;
  return PAGE07_TOPICS.has(topic.trim());
}

export type DeliveryShelfTopicSignals = {
  /** Already-classified topic code, when the caller has one. */
  topic?: string | null;
  /** User question. A known 07 stem inside it opens the gate. */
  question?: string | null;
  pivotChartPath?: "solo" | "dyad" | null;
  partnerBazi?: "present" | "absent" | null;
  /** Joint decision session. Opens 07 as `joint` when the question has no finer stem. */
  joint?: boolean | null;
};

/** Longest known 07 stem inside the text. Palace names such as 官禄 do not match. */
export function matchPage07Topic(text?: string | null): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  if (PAGE07_TOPICS.has(raw)) return raw;
  const stems = [...PAGE07_TOPICS].sort((a, b) => b.length - a.length);
  for (const stem of stems) {
    if (raw.includes(stem)) return stem;
  }
  return null;
}

/**
 * Live shelf topic. Question stems win, then a joint/dyad signal, then an explicit topic.
 * `general` / `官禄` / `career` stay closed unless a 07 stem or joint signal is also present.
 */
export function deliveryTopicFromSignals(input: DeliveryShelfTopicSignals): string | null {
  const fromQuestion = matchPage07Topic(input.question);
  if (fromQuestion) return fromQuestion;
  const fromTopic = matchPage07Topic(input.topic);
  if (fromTopic) return fromTopic;
  if (input.joint || input.pivotChartPath === "dyad" || input.partnerBazi === "present") {
    return "joint";
  }
  const explicit = input.topic?.trim();
  return explicit || null;
}

/** 主叙事阅读序，07 按题插入，03 固定在包尾。 */
export function readingOrderForTopic(topic?: string | null): DecisionPageId[] {
  const order: DecisionPageId[] = ["01", "02", "04", "05", "06"];
  if (page07Applies(topic)) order.push("07");
  order.push("08", "03");
  return order;
}

export function sliceFieldCodes(slice: PageSlice): FeedFieldCode[] {
  const codes: FeedFieldCode[] = [];
  for (const key of CFP_SHORT) {
    if (slice.cfp && Object.prototype.hasOwnProperty.call(slice.cfp, key)) codes.push(FEED.CFP[key]);
  }
  for (const key of ZFP_SHORT) {
    if (slice.zfp && slice.zfp[key] != null) codes.push(FEED.ZFP[key]);
  }
  for (const key of USER_SHORT) {
    if (slice.user && Object.prototype.hasOwnProperty.call(slice.user, key)) codes.push(FEED.User[key]);
  }
  if (slice.sci?.hooks != null) codes.push(FEED.Sci.hooks);
  return codes;
}

/** 切片短键都落在该页并集内，且没有并集外的组内键。 */
export function sliceStaysInAllowlist(pageId: DecisionPageId, slice: PageSlice): boolean {
  const allow = PAGE_UNION_ALLOWLISTS[pageId];
  if (!allow) return false;
  const allowed = new Set<string>([
    ...allow.user,
    ...allow.cfp,
    ...allow.zfp,
    ...(allow.sci === false ? [] : [FEED.Sci.hooks]),
  ]);
  if (!sliceFieldCodes(slice).every((code) => allowed.has(code))) return false;
  const cfpKeys = slice.cfp ? Object.keys(slice.cfp) : [];
  if (cfpKeys.some((key) => !(CFP_SHORT as readonly string[]).includes(key))) return false;
  const zfpKeys = slice.zfp ? Object.keys(slice.zfp) : [];
  if (zfpKeys.some((key) => !(ZFP_SHORT as readonly string[]).includes(key))) return false;
  const userKeys = slice.user ? Object.keys(slice.user) : [];
  if (userKeys.some((key) => !(USER_SHORT as readonly string[]).includes(key))) return false;
  if (slice.sci && Object.keys(slice.sci).some((key) => key !== "hooks")) return false;
  return true;
}

/** 整包才有的键。切片里出现任意一个都是把全盘灌进了单页。 */
/**
 * Flag dump-only keys (full chart pack / ZFP index). Nested
 * `patternHits[].palaces|source` are closed-set fields, not dumps.
 */
export function sliceDumpKeys(
  value: unknown,
  found: string[] = [],
  inPatternHit = false,
): string[] {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) sliceDumpKeys(item, found, inPatternHit);
    return found;
  }
  for (const [key, item] of Object.entries(value)) {
    if (DUMP_KEYS.has(key) && !inPatternHit) found.push(key);
    sliceDumpKeys(item, found, inPatternHit || key === "patternHits");
  }
  return found;
}

/** Chart text from prealloc, projected the same way as a real ChartFactPack. */
export function chartFactPackFromText(text: string): ChartFactPack {
  const day = /^日主：([^\n（]+)/m.exec(text);
  return {
    text,
    day_master: day?.[1]?.trim() ?? "",
    ganzhi: [],
    shen_sha: [],
  };
}

const SLICE_ANCHOR_CAP = 6;

function pushSliceAnchor(out: string[], seen: Set<string>, value: unknown): void {
  if (out.length >= SLICE_ANCHOR_CAP || value == null) return;
  if (typeof value === "string") {
    for (const part of value.split(/\n+/)) {
      const line = part.trim();
      if (!line || line.length > 48 || seen.has(line)) continue;
      seen.add(line);
      out.push(line);
      if (out.length >= SLICE_ANCHOR_CAP) return;
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      pushSliceAnchor(out, seen, item);
      if (out.length >= SLICE_ANCHOR_CAP) return;
    }
    return;
  }
  if (typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  if (typeof row.mutagen === "string" || typeof row.star === "string") {
    const bit = [row.mutagen, row.star, row.palace]
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("·");
    pushSliceAnchor(out, seen, bit);
    return;
  }
  if (typeof row.palace === "string" && row.palace.trim()) {
    const stars = Array.isArray(row.majorStars)
      ? row.majorStars
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 2)
      : [];
    pushSliceAnchor(
      out,
      seen,
      stars.length ? `${row.palace.trim()}·${stars.join("、")}` : row.palace.trim(),
    );
  }
}

/**
 * 02-D / 06 short anchors from this page's slice only.
 * Never copies chart text, ganzhi, shen_sha, palaces, or otherChart.
 */
export function pageSliceAnchorLines(pageId: DecisionPageId, packs?: PageFeedPacks): string[] {
  const sliced = sliceForPage(pageId, packs);
  const out: string[] = [];
  const seen = new Set<string>();
  const cfp = sliced.slice.cfp;
  if (cfp) {
    for (const key of ["dayMaster", "yongJi", "shishenHit", "dayunNow"] as const) {
      const value = cfp[key];
      if (key === "dayMaster" && typeof value === "string" && value && !value.startsWith("日主")) {
        pushSliceAnchor(out, seen, `日主${value}`);
      } else {
        pushSliceAnchor(out, seen, value);
      }
    }
  }
  const zfp = sliced.slice.zfp;
  if (zfp) {
    pushSliceAnchor(out, seen, zfp.topicPalace);
    pushSliceAnchor(out, seen, zfp.sihua);
    pushSliceAnchor(out, seen, zfp.daxian);
    if (zfp.patternHits?.length) {
      pushSliceAnchor(
        out,
        seen,
        zfp.patternHits
          .slice(0, 4)
          .map((h) => h.name)
          .join("、"),
      );
    }
  }
  return out;
}

/**
 * 按页裁切。`pageId` 不在 01–08 时抛错。
 * 调用 07 仍会返回该页切片；阅读序是否插入 07 看 `readingOrderForTopic`。
 */
export function sliceForPage(pageId: DecisionPageId, packs?: PageFeedPacks): PageSliceResult {
  if (!isDecisionPageId(pageId)) {
    throw new Error(`sliceForPage: unknown pageId ${pageId}`);
  }
  const allowlist = PAGE_UNION_ALLOWLISTS[pageId];
  const slice: PageSlice = {};
  const cfp = buildCfp(shortKeys(allowlist.cfp), packs);
  const zfp = buildZfp(shortKeys(allowlist.zfp), zfpSource(packs), packs?.topic);
  const user = buildUser(shortKeys(allowlist.user), packs?.user);
  const sci = buildSci(allowlist.sci, packs?.sci);
  if (cfp) slice.cfp = cfp;
  if (zfp) slice.zfp = zfp;
  if (user) slice.user = user;
  if (sci) slice.sci = sci;
  return {
    pageId,
    allowlist,
    segments: PAGE_SEGMENT_ALLOWLISTS[pageId],
    slice,
    zfpOmitted: !("zfp" in slice),
  };
}
