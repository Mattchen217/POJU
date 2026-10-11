/**
 * Resolve CompanionBrief for a target output locale.
 *
 * Prefer same-locale polished P1/P3 when present (best rails).
 * If missing: fall back to zh / pre_polish / page_schema — model writes
 * native en/fr/es from Chinese strategic rails (same idea as body_polish).
 */

import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

import { extractCompanionBrief } from "./extract-companion-brief";
import { normalizeCompanionLocale } from "./locale-voice";
import type { CompanionBrief } from "./types";

export type CompanionBriefSource =
  | "by_locale"
  | "zh_fallback"
  | "pre_polish"
  | "page_schema"
  | "sealed";

export type ResolveCompanionBriefResult =
  | { ok: true; brief: CompanionBrief; source: CompanionBriefSource }
  | { ok: false; reason: "companion_brief_locale_missing"; detail: string };

function pageArt(lab: DeliveryLabSession, page: "direct_answer" | "science_action") {
  return lab.artifacts.by_page[page] as
    | {
        page_schema?: unknown;
        page_schema_pre_polish?: unknown;
        page_schema_by_locale?: Partial<Record<string, unknown>>;
      }
    | undefined;
}

function asPage(v: unknown): DeliveryPageData | undefined {
  if (v && typeof v === "object" && (v as { page?: string }).page) {
    return v as DeliveryPageData;
  }
  return undefined;
}

export function resolveCompanionBriefForLabLocale(
  lab: DeliveryLabSession,
  localeRaw: string,
  sealedBrief?: CompanionBrief | null,
): ResolveCompanionBriefResult {
  const locale = normalizeCompanionLocale(localeRaw);
  const p1Art = pageArt(lab, "direct_answer");
  const p3Art = pageArt(lab, "science_action");

  let p1 = asPage(p1Art?.page_schema_by_locale?.[locale]);
  let p3 = asPage(p3Art?.page_schema_by_locale?.[locale]);
  let source: CompanionBriefSource = "by_locale";

  if (!p1) {
    const zhP1 = asPage(p1Art?.page_schema_by_locale?.zh);
    const preP1 = asPage(p1Art?.page_schema_pre_polish);
    const frozenP1 = asPage(p1Art?.page_schema);
    p1 = zhP1 ?? preP1 ?? frozenP1;
    p3 =
      asPage(p3Art?.page_schema_by_locale?.zh) ??
      asPage(p3Art?.page_schema_pre_polish) ??
      asPage(p3Art?.page_schema);
    if (zhP1) source = "zh_fallback";
    else if (preP1) source = "pre_polish";
    else source = "page_schema";
  }

  if (!p1 && sealedBrief) {
    return {
      ok: true,
      brief: { ...sealedBrief, locale },
      source: "sealed",
    };
  }

  if (!p1) {
    return {
      ok: false,
      reason: "companion_brief_locale_missing",
      detail: "缺少 P1 page_schema，无法抽 Brief（先跑 P1 正文）",
    };
  }

  try {
    const brief = extractCompanionBrief({
      fullText: "",
      locale,
      originalQuestion:
        sealedBrief?.original_question || lab.source.original_question,
      pageSchemas: {
        direct_answer: p1,
        ...(p3 ? { science_action: p3 } : {}),
      },
    });
    return { ok: true, brief: { ...brief, locale }, source };
  } catch (e) {
    if (sealedBrief) {
      return {
        ok: true,
        brief: { ...sealedBrief, locale },
        source: "sealed",
      };
    }
    return {
      ok: false,
      reason: "companion_brief_locale_missing",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
