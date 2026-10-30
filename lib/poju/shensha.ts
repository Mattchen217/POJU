/**
 * 神煞解析层 —— 全站唯一查表入口（Phase 4 fail-closed）。
 * 计算层只产出 ID / 中文名；UI / LLM 渲染前必须经此层。
 * 未知/红线：不得 label=rawToken，不得拼接 zh_src。
 */
import { createHash } from "node:crypto";
import {
  hashShenshaToken,
  isShenshaInternalRedline,
  resolveShenshaDisposition,
  SHENSHA_BLOCKED_PLACEHOLDER,
} from "@/lib/glossary/shensha-disposition";
import {
  isCrossNsSoftPreserveHan,
  softMapCrossNsForbiddenHans,
} from "@/lib/glossary/ns-aware-surface-sanitize";
import { pojuTermBySlug, type TermLocale } from "@/lib/glossary/pojulife-terms";
import { termHanVariants } from "@/lib/glossary/term-han-normalize";
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

interface I18nPack {
  label: string;
  gloss: string;
}
interface TermDef {
  zh_src: string;
  aliases?: string[];
  polarity: Polarity;
  axis: string;
  source: "engine" | "local";
  note?: string;
  i18n: Record<Locale, I18nPack>;
}
interface MapFile {
  meta: { locales: Locale[]; render_pattern?: string };
  terms: Record<string, TermDef>;
}

const MAP = RAW as unknown as MapFile;
const TERMS = MAP.terms;
const FALLBACK_LOCALE: Locale = "en";

/** Bridge: ID or zh_src/alias (+ simp/trad variants) → JSON id. First registration wins. */
const ZH_TO_ID: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const id of Object.keys(TERMS)) {
    const t = TERMS[id]!;
    for (const z of [t.zh_src, ...(t.aliases ?? [])]) {
      if (!z) continue;
      for (const v of termHanVariants(z)) {
        if (v && !idx[v]) idx[v] = id;
      }
    }
  }
  return idx;
})();

export function toShenshaId(token: string): string | null {
  if (TERMS[token]) return token;
  for (const v of termHanVariants(token)) {
    if (ZH_TO_ID[v]) return ZH_TO_ID[v]!;
  }
  return null;
}

/** Surfaces for bare-term scanners — includes redline hans so strip/audit can see them. */
export function allShenshaHanSurfaces(): string[] {
  const set = new Set<string>();
  for (const id of Object.keys(TERMS)) {
    const t = TERMS[id]!;
    if (t.zh_src?.trim()) set.add(t.zh_src.trim());
    for (const a of t.aliases ?? []) {
      if (a?.trim()) set.add(a.trim());
    }
  }
  return [...set].sort((a, b) => b.length - a.length);
}

export interface ShenshaView {
  id: string;
  /**
   * @deprecated Phase 4: always empty for user-facing paths.
   * Kept for type compatibility; never concatenate into UI.
   */
  zh_src: string;
  label: string;
  gloss: string;
  polarity: Polarity;
  axis: string;
  source: "engine" | "local";
  /** True when redline/unknown — omit from user lists. */
  blocked?: boolean;
  blockReason?: string;
  tokenHash?: string;
}

function localePack(t: TermDef, locale: Locale): I18nPack {
  return t.i18n[locale] ?? t.i18n[FALLBACK_LOCALE]!;
}

function fromGlossary(
  termSlug: string,
  locale: Locale,
  fallback: TermDef | undefined,
  jsonId: string,
): ShenshaView {
  const term = pojuTermBySlug(termSlug);
  const loc = locale as TermLocale;
  if (term) {
    const label = (term.term[loc] || term.term.en || term.term.zh || "").trim();
    const gloss = (term.definition[loc] || term.definition.en || term.definition.zh || "").trim();
    return {
      id: jsonId,
      zh_src: "",
      label,
      gloss,
      polarity: fallback?.polarity ?? "edge",
      axis: fallback?.axis ?? "glossary",
      source: fallback?.source ?? "engine",
    };
  }
  if (fallback) {
    const pack = localePack(fallback, locale);
    return {
      id: jsonId,
      zh_src: "",
      label: pack.label,
      gloss: pack.gloss,
      polarity: fallback.polarity,
      axis: fallback.axis,
      source: fallback.source,
    };
  }
  return {
    id: jsonId,
    zh_src: "",
    label: SHENSHA_BLOCKED_PLACEHOLDER,
    gloss: "",
    polarity: "edge",
    axis: "unknown",
    source: "engine",
    blocked: true,
    blockReason: "public_slug_missing",
    tokenHash: hashShenshaToken(jsonId),
  };
}

/**
 * Resolve one shensha token. Never returns label === raw traditional on miss.
 * Redline / unknown → blocked view with empty label.
 */
export function resolveShensha(token: string, locale: Locale = "en"): ShenshaView {
  const raw = token.trim();
  const disposition = resolveShenshaDisposition(raw);
  const id = toShenshaId(raw);
  const termDef = id ? TERMS[id] : undefined;

  if (disposition.status === "internal_redline") {
    return {
      id: id ?? "redline",
      zh_src: "",
      label: SHENSHA_BLOCKED_PLACEHOLDER,
      gloss: "",
      polarity: "pressure",
      axis: "redline",
      source: termDef?.source ?? "engine",
      blocked: true,
      blockReason: disposition.reasonCode,
      tokenHash: hashShenshaToken(raw),
    };
  }

  if (disposition.status === "unknown_blocked") {
    // Also treat unmapped JSON-less tokens as blocked (no raw fallback).
    if (!id) {
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        console.warn(
          `[shensha] unknown token hash=${hashShenshaToken(raw)} — fail-closed (no raw label)`,
        );
      }
      return {
        id: "unknown",
        zh_src: "",
        label: SHENSHA_BLOCKED_PLACEHOLDER,
        gloss: "",
        polarity: "edge",
        axis: "unknown",
        source: "engine",
        blocked: true,
        blockReason: disposition.reasonCode,
        tokenHash: hashShenshaToken(raw),
      };
    }
    // Known JSON id but not in disposition table → treat as blocked until audited.
    return {
      id,
      zh_src: "",
      label: SHENSHA_BLOCKED_PLACEHOLDER,
      gloss: "",
      polarity: termDef?.polarity ?? "edge",
      axis: termDef?.axis ?? "unaudited",
      source: termDef?.source ?? "engine",
      blocked: true,
      blockReason: "json_id_unaudited",
      tokenHash: hashShenshaToken(raw),
    };
  }

  // public_glossary
  const jsonId = id ?? disposition.termSlug;
  // Prefer disposition on the JSON id when token was han
  const idDisposition = id ? resolveShenshaDisposition(id) : disposition;
  if (idDisposition.status === "internal_redline") {
    return {
      id: id!,
      zh_src: "",
      label: SHENSHA_BLOCKED_PLACEHOLDER,
      gloss: "",
      polarity: "pressure",
      axis: "redline",
      source: termDef?.source ?? "engine",
      blocked: true,
      blockReason: idDisposition.reasonCode,
      tokenHash: hashShenshaToken(raw),
    };
  }
  const slug =
    idDisposition.status === "public_glossary"
      ? idDisposition.termSlug
      : disposition.termSlug;
  return fromGlossary(slug, locale, termDef, jsonId);
}

/** Soft labels for auto-mark — null when blocked/unknown. */
export function resolveShenshaSoftLabels(
  han: string,
  locale: string,
): { slug: string; soft: string; plain: string } | null {
  if (isShenshaInternalRedline(han)) return null;
  const view = resolveShensha(han, normalizeShenshaLocale(locale));
  if (view.blocked || !view.label?.trim()) return null;
  return {
    slug: `shensha_${view.id}`,
    soft: view.label.trim(),
    plain: view.gloss?.trim() || view.label.trim(),
  };
}

/** User-facing list: drops blocked/unknown; never exposes zh_src. */
export function resolveShenshaList(tokens: string[], locale: Locale = "en"): ShenshaView[] {
  const seen = new Set<string>();
  const out: ShenshaView[] = [];
  for (const tk of tokens) {
    const v = resolveShensha(tk, locale);
    if (v.blocked || !v.label.trim()) continue;
    const dedupeKey = v.id.replace(/_local$/, "");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ ...v, zh_src: "" });
  }
  return out;
}

/** Final-output scan: true if text still contains redline traditional surfaces. */
export function textContainsRedlineShensha(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const han of allShenshaHanSurfaces()) {
    if (!han || han.length < 2) continue;
    if (!isShenshaInternalRedline(han)) continue;
    if (text.includes(han)) hits.push(han);
  }
  return [...new Set(hits)];
}

/**
 * Strip / neutralize redline traditional surfaces from final user text (second pass).
 *
 * Dual-ns tokens (bazi redline ∩ qimen legal, e.g. 空亡/白虎): soft-map to qimen
 * coined labels — never hard-delete (would erase legitimate qimen meaning).
 * Pure bazi redlines: hard-delete as before.
 *
 * @param locale Soft-label locale for cross-ns soft map (default zh).
 */
export function stripRedlineShenshaFromText(
  text: string,
  locale: string = "zh",
): string {
  const mapped = softMapCrossNsForbiddenHans(text ?? "", locale);
  let out = mapped.text;
  const surfaces = allShenshaHanSurfaces()
    .filter((h) => isShenshaInternalRedline(h) && !isCrossNsSoftPreserveHan(h))
    .sort((a, b) => b.length - a.length);
  for (const han of surfaces) {
    if (!han) continue;
    out = out.split(han).join("");
  }
  return out;
}

export function shenshaTokenAuditHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 12);
}

/** @deprecated Prefer resolveShensha + empty zh_src; kept for call-site discovery. */
export function formatShenshaLabelOnly(view: ShenshaView): string {
  return view.label.trim();
}
