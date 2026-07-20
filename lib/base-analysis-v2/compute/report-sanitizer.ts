import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import type { TenGodContext } from "@/lib/base-analysis-v2/compute/ten-god-context";

function pickDual(
  hasA: boolean,
  hasB: boolean,
  labelA: string,
  labelB: string,
  both: string,
): string {
  if (hasA && !hasB) return labelA;
  if (!hasA && hasB) return labelB;
  return both;
}

/**
 * Layer-2: expand high-frequency Ten-God compound abbreviations using natal context.
 * Zero API cost — string replace only.
 */
export function cleanText(text: string, ctx: TenGodContext): string {
  if (!text) return text;

  const guanSha = pickDual(ctx.hasZhengGuan, ctx.hasQiSha, "正官", "七杀", "正官与七杀");
  const shiShang = pickDual(ctx.hasShiShen, ctx.hasShangGuan, "食神", "伤官", "食神与伤官");
  const biJie = pickDual(ctx.hasBiJian, ctx.hasJieCai, "比肩", "劫财", "比肩与劫财");
  const yinXiao = pickDual(ctx.hasZhengYin, ctx.hasPianYin, "正印", "偏印", "正印与偏印");

  return text
    .replace(/官杀/g, guanSha)
    .replace(/食伤/g, shiShang)
    .replace(/比劫/g, biJie)
    .replace(/印枭|枭印/g, yinXiao);
}

/**
 * Deep-walk ReportComputed (and any nested JSON) and clean every string.
 */
export function cleanReportComputed<T>(obj: T, ctx: TenGodContext): T {
  if (typeof obj === "string") {
    return cleanText(obj, ctx) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanReportComputed(item, ctx)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      out[key] = cleanReportComputed(value, ctx);
    }
    return out as T;
  }
  return obj;
}

/** Typed convenience wrapper for ReportComputed. */
export function sanitizeReportComputed(
  report: ReportComputed,
  ctx: TenGodContext,
): ReportComputed {
  return cleanReportComputed(report, ctx);
}
