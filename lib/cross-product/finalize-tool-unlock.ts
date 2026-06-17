import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import type { GlyphDrawSessionPayload } from "@/lib/glyph/glyph-draw-session";
import { resolveGlyphQuestion } from "@/lib/glyph/glyph-preview-unlock";
import type { MatchPreviewSession } from "@/lib/match/match-preview-session";
import { resolveMatchQuestion } from "@/lib/match/match-preview-unlock";
import type { ToolName } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export type ToolUnlockContext = {
  product: ToolName;
  profileId: string;
  profileBId?: string;
  userProfile: UserProfile;
  userProfileB?: UserProfile;
  locale: string;
  toolSession: GlyphDrawSessionPayload | MatchPreviewSession;
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
  if (ctx.product === "match") {
    return resolveMatchQuestion(ctx.toolSession as MatchPreviewSession);
  }
  return resolveGlyphQuestion(ctx.toolSession as GlyphDrawSessionPayload);
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
