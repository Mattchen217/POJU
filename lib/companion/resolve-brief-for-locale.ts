/**
 * Rebuild CompanionBrief from the page_schema that matches the companion output locale.
 * Prevents feeding French P1 rails into an English companion day (and vice versa).
 */

import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

import { extractCompanionBrief } from "./extract-companion-brief";
import { normalizeCompanionLocale } from "./locale-voice";
import type { CompanionBrief } from "./types";

export type ResolveCompanionBriefResult =
  | {
      ok: true;
      brief: CompanionBrief;
      source: "by_locale" | "zh_fallback" | "pre_polish" | "page_schema";
    }
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

/**
 * Prefer polished page_schema_by_locale[locale] for P1/P3.
 * If target locale draft missing (and not zh), fail — do not silently feed another language's rails.
 */
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
  let source: "by_locale" | "zh_fallback" | "pre_polish" | "page_schema" =
    "by_locale";

  if (!p1 && locale === "zh") {
    const pre = asPage(p1Art?.page_schema_pre_polish);
    p1 = pre ?? asPage(p1Art?.page_schema);
    p3 =
      asPage(p3Art?.page_schema_pre_polish) ?? asPage(p3Art?.page_schema);
    source = pre ? "pre_polish" : "page_schema";
  }

  if (!p1) {
    if (locale !== "zh") {
      return {
        ok: false,
        reason: "companion_brief_locale_missing",
        detail: `无 ${locale} 版 P1 page_schema：先跑 P1（及建议 P3）body_polish · ${locale}，再测 companion ${locale}。禁止用其他语言主辅轨喂 ${locale} 日稿。`,
      };
    }
    return {
      ok: false,
      reason: "companion_brief_locale_missing",
      detail: "缺少 P1 page_schema，无法抽 Brief",
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
    return { ok: true, brief, source };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: "companion_brief_locale_missing",
      detail: msg,
    };
  }
}
