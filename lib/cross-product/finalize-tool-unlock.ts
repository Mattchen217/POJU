import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import type { ToolName } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

type QuarantinedToolSession = {
  question?: string;
  pending_question?: string;
};

export type ToolUnlockContext = {
  product: ToolName;
  profileId: string;
  profileBId?: string;
  userProfile: UserProfile;
  userProfileB?: UserProfile;
  locale: string;
  toolSession: QuarantinedToolSession;
};

export type ToolUnlockBaseResult = {
  question: string;
  baseAnalysis: unknown | null;
  baseAnalysisB: unknown | null;
  baseReportText: string | null;
  baseReportTextB: string | null;
  cacheHit: boolean;
  cacheHitB: boolean;
};

function resolveToolQuestion(ctx: ToolUnlockContext): string {
  const pending = ctx.toolSession.pending_question?.trim();
  if (pending) return pending;
  if (ctx.product === "match") return "";
  return ctx.toolSession.question?.trim() || "";
}

/** Release intercepted question + resolve depth① cache (glyph/match). Syncro skips depth①. */
export async function prepareToolUnlockBase(ctx: ToolUnlockContext): Promise<ToolUnlockBaseResult> {
  const question = resolveToolQuestion(ctx);

  if (ctx.product === "syncro") {
    return {
      question,
      baseAnalysis: null,
      baseAnalysisB: null,
      baseReportText: null,
      baseReportTextB: null,
      cacheHit: true,
      cacheHitB: true,
    };
  }

  if (ctx.product === "match" && ctx.profileBId) {
    const [cachedA, cachedB] = await Promise.all([
      getCachedBaseAnalysis(ctx.profileId),
      getCachedBaseAnalysis(ctx.profileBId),
    ]);
    return {
      question,
      baseAnalysis: cachedA?.baseAnalysis ?? null,
      baseAnalysisB: cachedB?.baseAnalysis ?? null,
      baseReportText: cachedA?.reportText ?? null,
      baseReportTextB: cachedB?.reportText ?? null,
      cacheHit: Boolean(cachedA),
      cacheHitB: Boolean(cachedB),
    };
  }

  const cached = await getCachedBaseAnalysis(ctx.profileId);
  if (cached) {
    return {
      question,
      baseAnalysis: cached.baseAnalysis,
      baseAnalysisB: null,
      baseReportText: cached.reportText,
      baseReportTextB: null,
      cacheHit: true,
      cacheHitB: true,
    };
  }

  return {
    question,
    baseAnalysis: null,
    baseAnalysisB: null,
    baseReportText: null,
    baseReportTextB: null,
    cacheHit: false,
    cacheHitB: false,
  };
}
