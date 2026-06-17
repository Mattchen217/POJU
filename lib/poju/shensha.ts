/**
 * 神煞解析层 —— 全站唯一查表入口
 * 计算层（shunshi-bazi-core + bazi-shensha-local）只产出 ID（过渡期产出中文名）；
 * 任何 UI / LLM payload 在渲染前都必须经过这里取合规多语言文案。
 *
 * 部署：把 shensha-i18n-map.json 放到可被本文件 import 的数据目录，例如
 *   lib/poju/data/shensha-i18n-map.json
 */
import RAW from "./data/shensha-i18n-map.json";

export type Locale = "en" | "zh" | "es" | "de" | "fr";
export type Polarity = "support" | "edge" | "pressure";

export function normalizeShenshaLocale(locale: string): Locale {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("fr")) return "fr";
  return "en";
}

interface I18nPack { label: string; gloss: string; }
interface TermDef {
  zh_src: string;
  aliases?: string[];
  polarity: Polarity;
  axis: string;
  source: "engine" | "local";
  note?: string;
  i18n: Record<Locale, I18nPack>;
}
interface MapFile { meta: { locales: Locale[] }; terms: Record<string, TermDef>; }

const MAP = RAW as unknown as MapFile;
const TERMS = MAP.terms;
const FALLBACK_LOCALE: Locale = "en";

/** 过渡期桥接：引擎仍吐中文名时，用 zh_src + aliases 反查 ID。引擎改吐 ID 后此表自然失效不被命中。 */
const ZH_TO_ID: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const id of Object.keys(TERMS)) {
    const t = TERMS[id];
    for (const z of [t.zh_src, ...(t.aliases ?? [])]) if (z && !idx[z]) idx[z] = id;
  }
  return idx;
})();

/** 把引擎产出的「ID 或 中文名」归一化为 ID。命中不了返回 null。 */
export function toShenshaId(token: string): string | null {
  if (TERMS[token]) return token;          // 已是 ID
  if (ZH_TO_ID[token]) return ZH_TO_ID[token]; // 中文名 → ID
  return null;
}

export interface ShenshaView {
  id: string;
  zh_src: string;     // 中文原名（作括号字形保留）
  label: string;      // 当前语言合规标题
  gloss: string;      // 当前语言副行解读
  polarity: Polarity; // support | edge | pressure（驱动 UI 配色）
  axis: string;
  source: "engine" | "local";
}

/** 单个神煞 → 当前语言视图。token 可为 ID 或中文名。 */
export function resolveShensha(token: string, locale: Locale = "en"): ShenshaView {
  const id = toShenshaId(token);
  if (!id) {
    console.warn(`[shensha] 未映射标识：${token} —— 已降级为原标识，请补进 shensha-i18n-map.json`);
    return { id: "unknown", zh_src: token, label: token, gloss: "", polarity: "edge", axis: "unknown", source: "engine" };
  }
  const t = TERMS[id];
  const pack = t.i18n[locale] ?? t.i18n[FALLBACK_LOCALE];
  return { id, zh_src: t.zh_src, label: pack.label, gloss: pack.gloss, polarity: t.polarity, axis: t.axis, source: t.source };
}

/** 一柱/整盘的标识数组 → 视图数组；自动按 ID 去重（合并 engine/local 同义项，如 文昌/文昌贵人）。 */
export function resolveShenshaList(tokens: string[], locale: Locale = "en"): ShenshaView[] {
  const seen = new Set<string>();
  const out: ShenshaView[] = [];
  for (const tk of tokens) {
    const v = resolveShensha(tk, locale);
    // 同义合并：local 别名与 engine 正名视为同一项（去掉 _local 后缀比对）
    const dedupeKey = v.id.replace(/_local$/, "");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(v);
  }
  return out;
}
