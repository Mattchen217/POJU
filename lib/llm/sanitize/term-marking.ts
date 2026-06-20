/**
 * LLM term marking architecture — single source projections for prompt + UI.
 * LLM writes ⟦t:id|visible⟧; UI reads markers; audit detects leaks (no mutate).
 */

import {
  TERM_GLOSSARY,
  type GlossaryConcept,
  type Locale,
  toGlossaryLocale,
} from "@/lib/glossary/term-glossary";

export type TermEntry = {
  id: string;
  forbidden: string[];
  soft: Record<Locale, string>;
  keep_cn?: boolean;
  plain: Record<Locale, string>;
};

const GLOSSARY_ID_TO_TERM_ID: Record<string, string> = {
  日主: "day_master",
  用神: "yong_shen",
  大运: "decade",
  流年: "year",
  八字: "bazi",
  命盘: "natal_profile",
  四柱: "four_pillars",
  天干: "heavenly_stem",
  地支: "earthly_branch",
  忌神: "unfavorable_element",
  喜神: "favorable_element",
  六合: "six_harmonies",
  刑: "punishment",
  害冲: "clash",
  十神: "ten_gods",
  七杀: "seven_killings",
  食神: "eating_god",
  伤官: "hurting_officer",
  正财偏财: "wealth_stars",
  正官偏官: "officer_stars",
  正印偏印: "resource_stars",
  比肩劫财: "peer_stars",
  格局: "pattern",
  贵人: "noble_support",
  神煞: "auxiliary_stars",
  配偶星: "partner_star",
};

const KEEP_CN_TERM_IDS = new Set(["day_master", "decade", "year"]);

/** Glossary rows injected into delivery prompts (常量前缀 · cache-stable). */
const DELIVERY_MARKING_GLOSSARY_IDS = [
  "日主",
  "用神",
  "大运",
  "流年",
  "八字",
  "命盘",
  "四柱",
  "天干",
  "地支",
  "忌神",
  "喜神",
  "六合",
  "刑",
  "害冲",
  "十神",
  "贵人",
  "神煞",
  "格局",
];

function softLabel(entry: TermEntry, loc: Locale): string {
  return (entry.soft[loc] || entry.soft.en).split(/\s*\/\s*/)[0]!.trim();
}

function conceptToTermEntry(c: GlossaryConcept): TermEntry | null {
  if (c.surface === "delete" || c.surface === "allow") return null;
  const id = GLOSSARY_ID_TO_TERM_ID[c.id] ?? c.id.replace(/[^a-zA-Z0-9_]/g, "_");
  return {
    id,
    forbidden: [...c.forbidden_variants],
    soft: c.soft,
    keep_cn: KEEP_CN_TERM_IDS.has(id),
    plain: c.gloss,
  };
}

export const TERM_ENTRIES: TermEntry[] = TERM_GLOSSARY.map(conceptToTermEntry).filter(
  (e): e is TermEntry => e !== null,
);

const TERM_BY_ID = new Map(TERM_ENTRIES.map((e) => [e.id, e]));

const DELIVERY_MARKING_ENTRIES: TermEntry[] = DELIVERY_MARKING_GLOSSARY_IDS.map((gid) => {
  const termId = GLOSSARY_ID_TO_TERM_ID[gid];
  return termId ? TERM_BY_ID.get(termId) : undefined;
}).filter((e): e is TermEntry => e !== undefined);

/** LLM term marker — UI parses `⟦t:id|visible⟧`. Legacy `⟦g|display|plain⟧` still supported in UI. */
export const TERM_MARKER_PATTERN = /⟦t:([a-zA-Z0-9_]+)\|((?:\\.|[^|\\])*?)⟧/g;

function escapeMarkerPart(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/⟧/g, "\\⟧");
}

export function unescapeMarkerPart(s: string): string {
  return s.replace(/\\(.)/g, "$1");
}

export function encodeTermMarker(id: string, visible: string): string {
  return `⟦t:${id}|${escapeMarkerPart(visible)}⟧`;
}

export type ParsedTermMarker = { id: string; visible: string; raw: string };

export function parseTermMarkers(text: string): ParsedTermMarker[] {
  const out: ParsedTermMarker[] = [];
  TERM_MARKER_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_MARKER_PATTERN.exec(text)) !== null) {
    out.push({
      id: m[1],
      visible: unescapeMarkerPart(m[2]),
      raw: m[0],
    });
  }
  return out;
}

/** Strip markers for LLM history — visible text only, no plain/tooltip payload. */
export function stripMarkersForPrompt(text: string): string {
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(TERM_MARKER_PATTERN, (_, _id: string, visible: string) =>
    unescapeMarkerPart(visible),
  );
}

/** Remove broken / unclosed markers so users never see raw `⟦`. */
export function stripBrokenMarkers(text: string): string {
  if (!text.includes("⟦") && !text.includes("⟧")) return text;
  let r = text
    .replace(/⟦t:[a-zA-Z0-9_]+\|((?:\\.|[^|\\])*?)⟧/g, (_, v: string) => unescapeMarkerPart(v))
    .replace(/⟦t:[a-zA-Z0-9_]+\|((?:\\.|[^|\\])*?)(?=⟧|$)/g, (_, v: string) => unescapeMarkerPart(v))
    .replace(/⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g, (_, d: string) =>
      d.replace(/\\(.)/g, "$1"),
    )
    .replace(/⟦/g, "")
    .replace(/⟧/g, "");
  return r;
}

export function plainByTermId(termId: string, locale: string): string | null {
  const entry = TERM_BY_ID.get(termId);
  if (!entry) return null;
  const loc = toGlossaryLocale(locale);
  return entry.plain[loc] || entry.plain.en || null;
}

export function uiTermById(
  termId: string,
  locale: string,
): { soft: string; plain: string } | null {
  const entry = TERM_BY_ID.get(termId);
  if (!entry) return null;
  const loc = toGlossaryLocale(locale);
  return {
    soft: softLabel(entry, loc),
    plain: entry.plain[loc] || entry.plain.en,
  };
}

/** Prompt projection: forbidden → id + soft (+ keep_cn hint). Plain excluded to save tokens. */
export function buildTermMarkingFewShot(locale: string): string {
  const loc = toGlossaryLocale(locale);
  if (loc === "zh") {
    return `## 字段 few-shot 示例（必须模仿此形态 · 含标记+中文干支）

\`\`\`
"question_response": "你问的是…这支 Glyph 照见的是耐心中的转机。结合你的 ⟦t:day_master|核心特质（乙木）⟧，此刻更宜先稳住节奏…"
"命理看此事": "…你的 ⟦t:day_master|核心特质（乙木）⟧ 在关系里需要先找支点。现行 ⟦t:decade|人生阶段（癸酉）⟧ 更利于沉潜整理，而 ⟦t:year|流年能量（丙午）⟧ 则推你向外试探一小步…"
\`\`\``;
  }
  return `## Field few-shot examples (copy this exact shape · markers + Chinese stem-branch)

\`\`\`
"question_response": "You asked whether… This Glyph reflects a turn that ripens through patience. Your ⟦t:day_master|core nature (乙木)⟧ needs a clear anchor before you stretch further…"
"命理看此事": "… your ⟦t:day_master|core nature (乙木)⟧ seeks connection with structure. The current ⟦t:decade|life phase (癸酉)⟧ favors consolidation, while ⟦t:year|year's energy (丙午)⟧ nudges one small outward step…"
\`\`\``;
}

export function buildTermMarkingPromptBlock(locale: string): string {
  const loc = toGlossaryLocale(locale);
  const langLabel =
    loc === "zh" ? "中文" : loc === "en" ? "English" : loc.toUpperCase();
  const rows = DELIVERY_MARKING_ENTRIES.map((e) => {
    const soft = softLabel(e, loc);
    const keep =
      e.keep_cn === true
        ? loc === "zh"
          ? " + 干支（如 核心特质（乙木））"
          : " + stem-branch in parens (e.g. core nature (乙木))"
        : "";
    const sample = e.forbidden.slice(0, 4).join(" / ");
    return `| \`${e.id}\` | ${sample} | **${soft}**${keep} |`;
  }).join("\n");

  return `# 术语软翻译 + 标记（输出 JSON 字符串 · ${langLabel}）

凡涉及下表命理术语，**用对应语言的软翻译词替换原文**，并打标记：\`⟦t:<id>|<可见文本>⟧\`

| id | 禁/术语示例 | 软翻译 (${langLabel}) |
|---|---|---|
${rows}

## 打标记规则
1. \`<可见文本>\` = 你写出的软翻译词；若该 id 带干支，拼成 \`软翻译词 (干支)\` — 例：\`⟦t:day_master|core nature (乙木)⟧\`、\`⟦t:year|year's energy (丙午)⟧\`、中文版 \`⟦t:day_master|核心特质（乙木）⟧\`
2. **只用当前交付语言**，整句必须通顺；标记**只包软翻译词（含括号干支）**，**勿把 your/the/as 等前后词包进标记**
3. 同一概念在一段内**只标一次**（首次出现）
4. **签诗/古文诗句不是术语**：禁逐字引签诗原文（如「志气功业在朝朝…」）；只能意象化转述成交付语言，**不打术语标记**
5. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）

${buildTermMarkingFewShot(locale)}`;
}

export const BARE_SIGN_POEM_PATTERN =
  /[\u4e00-\u9fff]{7,}[，,；;、][\u4e00-\u9fff]{5,}/g;

export function detectBrokenMarkers(text: string): boolean {
  if (!text.includes("⟦")) return false;
  const opens = text.match(/⟦/g)?.length ?? 0;
  const closes = text.match(/⟧/g)?.length ?? 0;
  return opens !== closes;
}

/** Mask marked regions before forbidden-term audit. */
export function maskMarkersForAudit(text: string): string {
  let r = text;
  TERM_MARKER_PATTERN.lastIndex = 0;
  r = r.replace(TERM_MARKER_PATTERN, " ");
  r = r.replace(/⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g, " ");
  return r;
}
