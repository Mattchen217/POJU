/**
 * LLM term marking architecture — single source projections for prompt + UI.
 * LLM writes ⟦t:id|visible⟧; UI reads markers; audit detects leaks (no mutate).
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeChartRelations, type RelationLabel } from "@/lib/calculations/relation-engine";
import { termPolarityById, type TermPolarity } from "@/lib/glossary/term-polarity";
import {
  CLOSED_SET_REPLACE_IDS,
  CLOSED_SET_SLUG,
  CLOSED_SHEN_SHA,
  isRelationMarkerId,
  KEEP_CN_SLUGS,
  KEEP_CN_VISIBLE_SOFT,
  OUT_OF_SET_FORBIDDEN_EN,
  OUT_OF_SET_FORBIDDEN_HAN,
  RELATION_KIND_SOFT,
  RELATION_SURFACE_TERMS_ZH,
  TEN_GOD_TENSION_SOFT,
  relationKindFromMarkerId,
} from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES } from "@/lib/glossary/term-glossary-closed";
import {
  TERM_GLOSSARY,
  type GlossaryConcept,
  type Locale,
  toGlossaryLocale,
} from "@/lib/glossary/term-glossary";
import { buildClosedSetConstraintPromptBlock } from "@/lib/llm/prompts/term-closed-set-constraint";

export type TermEntry = {
  id: string;
  forbidden: string[];
  soft: Record<Locale, string>;
  keep_cn?: boolean;
  plain: Record<Locale, string>;
};

/** Glossary rows injected into delivery prompts (closed-set 命理 · cache-stable). */
const DELIVERY_MARKING_GLOSSARY_IDS = CLOSED_SET_REPLACE_IDS.filter((id) => id !== "羊刃");

function softLabel(entry: TermEntry, loc: Locale): string {
  const override = KEEP_CN_VISIBLE_SOFT[entry.id];
  if (override) {
    return loc === "zh" ? override.zh : override.en;
  }
  return (entry.soft[loc] || entry.soft.en).split(/\s*\/\s*/)[0]!.trim();
}

function conceptToTermEntry(c: GlossaryConcept): TermEntry | null {
  if (c.surface === "delete" || c.surface === "allow") return null;
  const id = CLOSED_SET_SLUG[c.id] ?? c.id.replace(/[^a-zA-Z0-9_]/g, "_");
  return {
    id,
    forbidden: [...c.forbidden_variants],
    soft: c.soft,
    keep_cn: KEEP_CN_SLUGS.has(id),
    plain: c.gloss,
  };
}

export const TERM_ENTRIES: TermEntry[] = TERM_GLOSSARY.map(conceptToTermEntry).filter(
  (e): e is TermEntry => e !== null,
);

const TERM_BY_ID = new Map(TERM_ENTRIES.map((e) => [e.id, e]));

const DELIVERY_MARKING_ENTRIES: TermEntry[] = DELIVERY_MARKING_GLOSSARY_IDS.map((hanId) => {
  const concept = CLOSED_SET_GLOSSARY_ENTRIES.find((c) => c.id === hanId);
  return concept ? conceptToTermEntry(concept) : null;
}).filter((e): e is TermEntry => e !== null);

/** LLM term marker — UI parses `⟦t:id|visible|plain⟧` (plain optional). Legacy 2-segment + `⟦g|…⟧` supported. */
export const TERM_MARKER_PATTERN =
  /⟦t:([^|]+)\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?⟧/g;

function normalizeTermMarkerId(raw: string): string {
  if (!raw.includes(":")) return raw;
  const leaf = raw.split(":").pop()!;
  return TERM_BY_ID.has(leaf) ? leaf : raw;
}

export function repairChatTermMarkers(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text.replace(
    /(?<!⟦)t:([a-zA-Z0-9_:]+)\|([^|]+)\|?/g,
    (_m, rawId: string, visible: string) => {
      const id = normalizeTermMarkerId(rawId);
      const vis = visible.trim();
      if (!TERM_BY_ID.has(id) && !isRelationMarkerId(id)) return vis;
      const plain = plainByTermId(id, locale) ?? undefined;
      return encodeTermMarker(id, vis, plain);
    },
  );
  out = out.replace(
    /⟦t:([a-zA-Z0-9_:]+)\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?⟧/g,
    (raw, rawId: string, visEsc: string, plainEsc?: string) => {
      const id = normalizeTermMarkerId(rawId);
      if (id === rawId && (TERM_BY_ID.has(id) || isRelationMarkerId(id))) return raw;
      if (!TERM_BY_ID.has(id) && !isRelationMarkerId(id)) return unescapeMarkerPart(visEsc);
      const vis = unescapeMarkerPart(visEsc);
      const plain = plainEsc?.trim()
        ? unescapeMarkerPart(plainEsc)
        : plainByTermId(id, locale) ?? undefined;
      return encodeTermMarker(id, vis, plain);
    },
  );
  return out;
}

function escapeMarkerPart(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/⟧/g, "\\⟧");
}

export function unescapeMarkerPart(s: string): string {
  return s.replace(/\\(.)/g, "$1");
}

export function encodeTermMarker(id: string, visible: string, plain?: string): string {
  const vis = escapeMarkerPart(visible);
  if (plain?.trim()) {
    return `⟦t:${id}|${vis}|${escapeMarkerPart(plain)}⟧`;
  }
  return `⟦t:${id}|${vis}⟧`;
}

export type ParsedTermMarker = { id: string; visible: string; plain?: string; raw: string };

export function parseTermMarkers(text: string): ParsedTermMarker[] {
  const out: ParsedTermMarker[] = [];
  TERM_MARKER_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_MARKER_PATTERN.exec(text)) !== null) {
    out.push({
      id: normalizeTermMarkerId(m[1]),
      visible: unescapeMarkerPart(m[2]),
      plain: m[3] ? unescapeMarkerPart(m[3]) : undefined,
      raw: m[0],
    });
  }
  return out;
}

/** Strip markers for LLM history — visible text only; dynamic plain + id never enter prefix. */
export function stripMarkersForPrompt(text: string): string {
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(
    TERM_MARKER_PATTERN,
    (_, _id: string, visible: string, _plain?: string) => unescapeMarkerPart(visible),
  );
}

/** Remove bare t: leaks (no ⟦⟧) and broken markers so users never see raw tokens. */
export function stripBareTermMarkers(text: string): string {
  return text.replace(/(?<!⟦)t:[a-zA-Z0-9_:]+\|([^|]+)\|?/g, "$1");
}

/** Wrap bare keep_cn soft phrases that lack ⟦t:…⟧ markers (visible text = soft label only, no ganzhi). */
export function wrapBareKeepCnSoftTerms(text: string, locale: string): string {
  const patterns: Array<{ id: string; label: string }> = [
    { id: "decade", label: "当前阶段气候" },
    { id: "day_master", label: "核心特质" },
    { id: "year", label: "当前时空效能" },
    { id: "yong_shen", label: "关键平衡能量" },
    { id: "yong_shen", label: "用神" },
  ];

  const parts = text.split(/(⟦[^⟧]*⟧)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      let out = part;
      for (const { id, label } of patterns) {
        const re = new RegExp(`(?<![\\u4e00-\\u9fff])${label}(?![（(])`, "g");
        out = out.replace(re, (match) =>
          encodeTermMarker(id, match, plainByTermId(id, locale) ?? undefined),
        );
      }
      return out;
    })
    .join("");
}

const BARE_AUTO_MARK_HAN = [...CLOSED_SET_REPLACE_IDS].sort((a, b) => b.length - a.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * UI 渲染兜底：词表内裸命理词（未在 ⟦t:⟧ 内）自动补标 → 软译呈现。
 * 只匹配闭集整词，带 CJK 词边界，不碰 marker 段。
 */
export function autoMarkBareTerms(text: string, locale: string): string {
  const parts = text.split(/(⟦[^⟧]*⟧)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      let out = part;
      for (const hanId of BARE_AUTO_MARK_HAN) {
        const slug = CLOSED_SET_SLUG[hanId] ?? hanId;
        const ui = uiTermById(slug, locale) ?? uiTermById(hanId, locale);
        if (!ui) continue;
        const plain = plainByTermId(slug, locale) ?? ui.plain;
        const re =
          hanId.length === 1
            ? new RegExp(
                `(?<![\\u4e00-\\u9fff])${escapeRegExp(hanId)}(?![\\u4e00-\\u9fff（(])`,
                "g",
              )
            : new RegExp(`${escapeRegExp(hanId)}(?![（(])`, "g");
        out = out.replace(re, (match) => encodeTermMarker(slug, ui.soft || match, plain));
      }
      return out;
    })
    .join("");
}

/** 先补 keep_cn 软词，再补闭集裸词。 */
export function prepareTextForGlossaryRender(text: string, locale: string): string {
  return autoMarkBareTerms(wrapBareKeepCnSoftTerms(text, locale), locale);
}

/** Remove broken / unclosed markers so users never see raw `⟦`. Intact closed markers become visible text. */
export function stripBrokenMarkers(text: string): string {
  let r = stripBareTermMarkers(text);
  if (!r.includes("⟦") && !r.includes("⟧")) return r;
  r = r
    .replace(
      /⟦t:[a-zA-Z0-9_:]+\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?(?=⟧|$)/g,
      (_match, v: string) => unescapeMarkerPart(v),
    )
    .replace(/⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g, (_, d: string) =>
      d.replace(/\\(.)/g, "$1"),
    )
    .replace(/⟦/g, "")
    .replace(/⟧/g, "");
  return r;
}

export function plainByTermId(termId: string, locale: string): string | null {
  const tension = TEN_GOD_TENSION_SOFT[termId as keyof typeof TEN_GOD_TENSION_SOFT];
  if (tension) {
    const loc = toGlossaryLocale(locale);
    return tension[loc === "zh" ? "zh" : "en"];
  }
  const relKind = relationKindFromMarkerId(termId);
  if (relKind) {
    const loc = toGlossaryLocale(locale);
    return RELATION_KIND_SOFT[relKind][loc === "zh" ? "zh" : "en"];
  }
  const entry = TERM_BY_ID.get(termId);
  if (!entry) return null;
  const loc = toGlossaryLocale(locale);
  return entry.plain[loc] || entry.plain.en || null;
}

export function uiTermById(
  termId: string,
  locale: string,
): { soft: string; plain: string; polarity: TermPolarity } | null {
  const tension = TEN_GOD_TENSION_SOFT[termId as keyof typeof TEN_GOD_TENSION_SOFT];
  if (tension) {
    const loc = toGlossaryLocale(locale);
    const lang = loc === "zh" ? "zh" : "en";
    return {
      soft: tension[lang],
      plain: tension[lang],
      polarity: termPolarityById(termId),
    };
  }
  const relKind = relationKindFromMarkerId(termId);
  if (relKind) {
    const loc = toGlossaryLocale(locale);
    const lang = loc === "zh" ? "zh" : "en";
    return {
      soft: RELATION_KIND_SOFT[relKind][lang],
      plain: RELATION_KIND_SOFT[relKind][lang],
      polarity: termPolarityById(termId),
    };
  }
  const entry = TERM_BY_ID.get(termId);
  if (!entry) return null;
  const loc = toGlossaryLocale(locale);
  return {
    soft: softLabel(entry, loc),
    plain: entry.plain[loc] || entry.plain.en,
    polarity: termPolarityById(termId),
  };
}

/** Prompt projection: forbidden → id + soft (+ keep_cn hint). Plain excluded to save tokens. */
export function buildTermMarkingFewShot(locale: string): string {
  const loc = toGlossaryLocale(locale);
  if (loc === "zh") {
    return `## 字段 few-shot 示例（必须模仿此形态 · 三段位标记+动态白话 · 可见软译不带干支）

\`\`\`
"question_response": "你问的是…这支 Glyph 照见的是耐心中的转机。结合你的 ⟦t:day_master|核心特质|你像靠人脉和氛围做买卖的人，硬推销反而散劲⟧，此刻更宜先稳住节奏…"
"命理看此事": "…你的 ⟦t:day_master|核心特质|在这件事里，你需要先找能依靠的支点再往外伸⟧。外面这阵 ⟦t:year|当前时空效能|今年这股燥热在推你焦虑乱动，不是你能力不够⟧ 只会让你更乱。**稳住。** 先把 ⟦t:yong_shen|关键平衡能量|对你就是：整理现有客户名单、把服务流程理顺，像给根须浇水⟧ 做到位，再迈一小步…"
\`\`\``;
  }
  return `## Field few-shot examples (copy this exact shape · 3-part markers + dynamic plain · visible soft text has NO stem-branch)

\`\`\`
"question_response": "You asked whether… This Glyph reflects a turn that ripens through patience. Your ⟦t:day_master|core nature|In this sentence: you grow through relationships, not hard selling⟧ needs a clear anchor before you stretch further…"
"命理看此事": "… your ⟦t:day_master|core nature|Here: you need a reliable base before reaching out⟧ seeks connection with structure. The current ⟦t:year|current temporal efficacy|This year feels like heat pushing you to act before you're ready—not a personal failing⟧ nudges one small outward step only after ⟦t:yong_shen|key balancing element|For you: tidy your offer, call one trusted mentor—like opening a window⟧ is in place…"
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
          ? "（可见软译只用上表词，禁括号干支）"
          : " (visible soft label only — no stem-branch in parens)"
        : "";
    const sample = e.forbidden.slice(0, 4).join(" / ");
    return `| \`${e.id}\` | ${sample} | **${soft}**${keep} |`;
  }).join("\n");

  return `# 术语软翻译 + 标记（输出 JSON 字符串 · ${langLabel}）

凡涉及下表命理术语，**用对应语言的软翻译词替换原文**，并打 **三段位**标记：\`⟦t:<id>|<可见文本>|<该处白话>⟧\`

| id | 禁/术语示例 | 软翻译 (${langLabel}) |
|---|---|---|
${rows}

## 打标记规则
1. \`<可见文本>\` = 你写出的软翻译词（**只用上表 soft 词，禁在可见词里加括号干支**）— 例：\`⟦t:day_master|核心特质|You grow through people, not force⟧\`
2. \`<该处白话>\` = **结合本句意境 + 用户问题**现写的 2–4 句人话（动作 3）：一句比方 + 现实可做的具体事 + 对这件事意味着什么。**同 id 在不同段落白话必须不同**；白话**不出现在正文**，只进标记第 3 段（UI tooltip）
3. **只用当前交付语言**，整句必须通顺；标记**只包软翻译词**，**勿把 your/the/as 等前后词包进标记**，**勿在可见词里加（干支）**
4. 正文须含贴切的日常比喻（动作 1）；流年/大运类先归因外境再给掌控感（动作 2）
5. **每段/每字段 ≤120 词（中文 ≤180 字）**；**每段金字 ≤2 为硬约束**——一段里同一/多个术语只在最关键处打标，其余自然行文不打标。紧挨着重复同一词只标第一次；**绝不在别处套过之后，后文把同一个词裸写。** 全文**一个主比喻**，tooltip 小比喻与之呼应（瘦身四条）
6. **签诗/古文诗句不是术语**：禁逐字引签诗原文；只能意象化转述，**不打术语标记**
7. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）
8. 若漏写第 3 段白话，UI 会回退静态词典——**务必写全三段位**

${buildTermMarkingFewShot(locale)}

${buildClosedSetConstraintPromptBlock(locale)}`;
}

export type OutOfSetAuditHit = { label: string; snippet: string };

export function fillMissingMarkerPlain(text: string, locale: string): string {
  let out = text;
  for (const m of parseTermMarkers(text)) {
    if (m.plain?.trim()) continue;
    const fallback = plainByTermId(m.id, locale);
    if (!fallback) continue;
    out = out.replace(m.raw, encodeTermMarker(m.id, m.visible, fallback));
  }
  return out;
}

/** Detect engine-out-of-set 神煞/术语 in delivery text (audit-only). */
export function auditOutOfSetTerms(text: string): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const hits: OutOfSetAuditHit[] = [];

  for (const han of OUT_OF_SET_FORBIDDEN_HAN) {
    if (masked.includes(han)) {
      hits.push({ label: `out_of_set_term:${han}`, snippet: han });
    }
  }
  for (const en of OUT_OF_SET_FORBIDDEN_EN) {
    const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(masked)) {
      hits.push({ label: `out_of_set_term:${en}`, snippet: en });
    }
  }

  const closedSlugs = new Set(Object.values(CLOSED_SET_SLUG));
  const groupedForbidden = new Set(["ten_gods", "auxiliary_stars", "noble_support", "wealth_stars", "officer_stars", "resource_stars", "peer_stars", "punishment", "clash", "six_harmonies"]);
  for (const m of parseTermMarkers(text)) {
    if (groupedForbidden.has(m.id)) {
      hits.push({ label: `out_of_set_marker_id:${m.id}`, snippet: m.raw.slice(0, 40) });
    } else if (
      !closedSlugs.has(m.id) &&
      !TERM_BY_ID.has(m.id)
    ) {
      // unknown marker id — may be compliance term; skip unless clearly grouped
    }
  }

  return hits;
}

function blobMatchesOutOfSetForbidden(blob: string): boolean {
  for (const han of OUT_OF_SET_FORBIDDEN_HAN) {
    if (blob.includes(han)) return true;
  }
  for (const en of OUT_OF_SET_FORBIDDEN_EN) {
    const re = new RegExp(`\\b${escapeRegExp(en)}\\b`, "i");
    if (re.test(blob)) return true;
  }
  return false;
}

function cleanupAfterOutOfSetStrip(text: string): string {
  return text
    .replace(/\[···\]/g, "")
    .replace(/[、，,]{2,}/g, "，")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** Strip engine-out-of-set 神煞 from persisted chat text (markers + bare terms). */
export function stripForbiddenShenSha(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const m of parseTermMarkers(out)) {
    const blob = `${m.visible} ${m.plain ?? ""}`;
    if (blobMatchesOutOfSetForbidden(blob)) {
      out = out.replace(m.raw, "");
    }
  }
  const sortedHan = [...OUT_OF_SET_FORBIDDEN_HAN].sort((a, b) => b.length - a.length);
  for (const han of sortedHan) {
    out = out.replace(new RegExp(escapeRegExp(han), "g"), "");
  }
  for (const en of OUT_OF_SET_FORBIDDEN_EN) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(en)}\\b`, "gi"), "");
  }
  return cleanupAfterOutOfSetStrip(out);
}

function markerViolatesShenShaInstance(
  blob: string,
  allowed: Set<string>,
): boolean {
  if (blobMatchesOutOfSetForbidden(blob)) return true;
  for (const name of CLOSED_SHEN_SHA) {
    if (blob.includes(name) && (allowed.size === 0 || !allowed.has(name))) return true;
  }
  if (
    blob.includes("羊刃") &&
    (allowed.size === 0 || (!allowed.has("飞刃") && !allowed.has("羊刃")))
  ) {
    return true;
  }
  return false;
}

/**
 * Last-resort degrade: strip out-of-set shen_sha + relations (markers and bare phrases).
 * Used when circuit-breaker retries are exhausted — deliver clean text instead of erroring.
 */
export function stripOutOfSetFactTerms(
  text: string,
  structured: ProfileStructured | null,
  opts?: { relations?: RelationLabel[] },
): string {
  if (!text?.trim()) return text ?? "";
  let out = text;

  if (structured) {
    const rels = opts?.relations ?? computeChartRelations(structured);
    const allowedRelIds = new Set(rels.map((r) => r.id));
    for (const m of parseTermMarkers(out)) {
      if (isRelationMarkerId(m.id) && (allowedRelIds.size === 0 || !allowedRelIds.has(m.id))) {
        out = out.split(m.raw).join("");
      }
    }

    const allowedShenSha = collectInstanceShenSha(structured);
    for (const m of parseTermMarkers(out)) {
      const blob = `${m.visible} ${m.plain ?? ""}`;
      if (markerViolatesShenShaInstance(blob, allowedShenSha)) {
        out = out.split(m.raw).join("");
      }
    }

    for (const name of CLOSED_SHEN_SHA) {
      if (allowedShenSha.size === 0 || !allowedShenSha.has(name)) {
        out = out.replace(new RegExp(escapeRegExp(name), "g"), "");
      }
    }
    if (allowedShenSha.size === 0 || (!allowedShenSha.has("飞刃") && !allowedShenSha.has("羊刃"))) {
      out = out.replace(/羊刃/g, "");
    }

    const relSnippets = [
      ...new Set(
        auditRelationsAgainstInstance(out, structured, opts)
          .map((h) => h.snippet)
          .filter(Boolean),
      ),
    ].sort((a, b) => b.length - a.length);
    for (const snippet of relSnippets) {
      out = out.replace(new RegExp(escapeRegExp(snippet), "g"), "");
    }
  }

  out = stripForbiddenShenSha(out);

  for (const hit of auditOutOfSetTerms(out)) {
    if (hit.snippet) {
      out = out.replace(new RegExp(escapeRegExp(hit.snippet), "gi"), "");
    }
  }

  if (structured) {
    for (const hit of auditShenShaAgainstInstance(out, structured)) {
      if (hit.snippet) {
        out = out.replace(new RegExp(escapeRegExp(hit.snippet), "g"), "");
      }
    }
  }

  return cleanupAfterOutOfSetStrip(out);
}

export function countDistinctTermIds(text: string): number {
  const ids = new Set(parseTermMarkers(text).map((m) => m.id));
  return ids.size;
}

/** Depth ids beyond day_master / decade / year / yong_shen — grounding audit. */
export const GROUNDING_DEPTH_TERM_IDS = new Set(
  Object.values(CLOSED_SET_SLUG).filter(
    (slug) =>
      !["day_master", "decade", "year", "yong_shen", "bazi", "natal_profile", "four_pillars"].includes(
        slug,
      ),
  ),
);

export type GroundingAuditResult = {
  distinctCount: number;
  depthCount: number;
  ids: string[];
};

export function auditGroundingMarkers(
  text: string,
  minDistinct: number,
  minDepth = 1,
): GroundingAuditResult | null {
  const markers = parseTermMarkers(text);
  const ids = [...new Set(markers.map((m) => m.id))];
  const depthCount = ids.filter((id) => GROUNDING_DEPTH_TERM_IDS.has(id)).length;
  const result: GroundingAuditResult = { distinctCount: ids.length, depthCount, ids };
  if (ids.length < minDistinct || depthCount < minDepth) return result;
  return null;
}

const BARE_GANZHI_RE = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

/** Detect bare stem-branch pairs outside term markers (EN deliveries often leak 癸酉/壬申). */
export function auditBareGanzhi(text: string): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const hits: OutOfSetAuditHit[] = [];
  BARE_GANZHI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_GANZHI_RE.exec(masked)) !== null) {
    hits.push({ label: "bare_ganzhi", snippet: m[0] });
  }
  return hits;
}

/** Warn when a paragraph packs too many golden term markers (luxury delivery density cap). */
export function auditTermMarkerDensity(
  text: string,
  maxPerParagraph = 2,
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];
  for (const chunk of text.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.startsWith("##")) continue;
    const count = parseTermMarkers(chunk).length;
    if (count > maxPerParagraph) {
      hits.push({
        label: `term_density:${count}`,
        snippet: trimmed.replace(/\s+/g, " ").slice(0, 72),
      });
    }
  }
  return hits;
}

export const BARE_SIGN_POEM_PATTERN =
  /[\u4e00-\u9fff]{7,}[，,；;、][\u4e00-\u9fff]{5,}/g;

export function detectBrokenMarkers(text: string): boolean {
  if (!text.includes("⟦")) return false;
  const opens = text.match(/⟦/g)?.length ?? 0;
  const closes = text.match(/⟧/g)?.length ?? 0;
  if (opens !== closes) return true;
  // Trailing unclosed marker region
  const lastOpen = text.lastIndexOf("⟦");
  const lastClose = text.lastIndexOf("⟧");
  if (lastOpen > lastClose) return true;
  // Open delimiter without closing ⟧ before next ⟦ or EOF
  if (/⟦(?:(?!⟧).)*$/.test(text)) return true;
  return false;
}

/** Collect shen_sha actually present in structured pillars_detail. */
export function collectInstanceShenSha(structured: ProfileStructured): Set<string> {
  const allowed = new Set<string>();
  if (!structured.pillars_detail) return allowed;
  for (const key of ["year", "month", "day", "hour"] as const) {
    for (const s of structured.pillars_detail[key]?.shen_sha ?? []) {
      allowed.add(s);
    }
  }
  return allowed;
}

/** Shen_sha in text must match instance inventory; empty inventory → no shen_sha names at all. */
export function auditShenShaAgainstInstance(
  text: string,
  structured: ProfileStructured,
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const allowed = collectInstanceShenSha(structured);
  const hits: OutOfSetAuditHit[] = [];

  const checkName = (name: string) => {
    if (!masked.includes(name)) return;
    if (allowed.size === 0 || !allowed.has(name)) {
      hits.push({
        label: allowed.size === 0 ? `shen_sha_forbidden_empty_instance:${name}` : `shen_sha_not_in_instance:${name}`,
        snippet: name,
      });
    }
  };

  for (const name of CLOSED_SHEN_SHA) checkName(name);
  if (masked.includes("羊刃")) {
    if (allowed.size === 0 || (!allowed.has("飞刃") && !allowed.has("羊刃"))) {
      hits.push({
        label:
          allowed.size === 0
            ? "shen_sha_forbidden_empty_instance:羊刃"
            : "shen_sha_not_in_instance:羊刃",
        snippet: "羊刃",
      });
    }
  }

  return hits;
}

const BRANCH_CHARS = "子丑寅卯辰巳午未申酉戌亥";
const STEM_CHARS = "甲乙丙丁戊己庚辛壬癸";

/** Extract bare relation phrases (branch-pair / sanhe / stem-he) from audit-masked text. */
export function extractBareRelationPhrases(masked: string): string[] {
  const out = new Set<string>();
  const reBranchPair = new RegExp(
    `[${BRANCH_CHARS}][${BRANCH_CHARS}](?:相冲|相刑|相害|六合[^、，。；\\s]{0,8}|半合[^、，。；\\s]{0,12}|三合[^、，。；\\s]{0,12})`,
    "g",
  );
  const reSanhe = new RegExp(`[${BRANCH_CHARS}]{3}三合[^、，。；\\s]{0,12}`, "g");
  const reStemHe = new RegExp(`日主[${STEM_CHARS}][${STEM_CHARS}]相合[^、，。；\\s]{0,12}`, "g");
  for (const re of [reBranchPair, reSanhe, reStemHe]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) out.add(m[0]);
  }
  return [...out];
}

function phraseAllowed(phrase: string, allowedHan: Set<string>): boolean {
  if (allowedHan.has(phrase)) return true;
  for (const han of allowedHan) {
    if (phrase.startsWith(han) || han.startsWith(phrase)) return true;
  }
  return false;
}

/** Relations in text must match computeChartRelations inventory; empty inventory → no relation words. */
export function auditRelationsAgainstInstance(
  text: string,
  structured: ProfileStructured,
  opts?: { relations?: RelationLabel[] },
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const rels = opts?.relations ?? computeChartRelations(structured);
  const allowedIds = new Set(rels.map((r) => r.id));
  const allowedHan = new Set(rels.map((r) => r.han));
  const hits: OutOfSetAuditHit[] = [];

  for (const m of parseTermMarkers(text)) {
    if (!isRelationMarkerId(m.id)) continue;
    if (allowedIds.size === 0 || !allowedIds.has(m.id)) {
      hits.push({
        label:
          allowedIds.size === 0
            ? `relation_forbidden_empty_instance:${m.id}`
            : `relation_not_in_instance:${m.id}`,
        snippet: m.raw.slice(0, 48),
      });
    }
  }

  if (allowedHan.size === 0) {
    for (const term of RELATION_SURFACE_TERMS_ZH) {
      if (masked.includes(term)) {
        hits.push({
          label: `relation_forbidden_empty_instance:${term}`,
          snippet: term,
        });
      }
    }
    for (const phrase of extractBareRelationPhrases(masked)) {
      hits.push({
        label: `relation_forbidden_empty_instance:${phrase}`,
        snippet: phrase,
      });
    }
    return hits;
  }

  for (const phrase of extractBareRelationPhrases(masked)) {
    if (!phraseAllowed(phrase, allowedHan)) {
      hits.push({
        label: `relation_not_in_instance:${phrase}`,
        snippet: phrase,
      });
    }
  }

  return hits;
}

/** Broken / incomplete markers and visible-text shape issues. */
export function auditMarkerCompleteness(text: string): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];

  if (detectBrokenMarkers(text)) {
    const idx = text.indexOf("⟦");
    hits.push({
      label: "broken_marker",
      snippet: idx >= 0 ? text.slice(idx, idx + 48).replace(/\s+/g, " ") : "⟦…",
    });
  }

  for (const m of parseTermMarkers(text)) {
    if (!m.plain?.trim()) {
      hits.push({ label: "marker_missing_plain", snippet: m.raw.slice(0, 48) });
    }
    const vis = m.visible.trim();
    if (/^(the|a|an)\s+(the|a|an)\b/i.test(vis)) {
      hits.push({ label: "marker_visible_article_dup", snippet: vis.slice(0, 40) });
    } else if (/^(the|a|an)\s/i.test(vis)) {
      hits.push({ label: "marker_visible_leading_article", snippet: vis.slice(0, 40) });
    }
  }

  return hits;
}

/** Mask marked regions before forbidden-term audit. */
export function maskMarkersForAudit(text: string): string {
  let r = text;
  TERM_MARKER_PATTERN.lastIndex = 0;
  r = r.replace(TERM_MARKER_PATTERN, " ");
  r = r.replace(/⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g, " ");
  return r;
}
