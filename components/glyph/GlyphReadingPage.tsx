"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { GlyphCanvas } from "@/components/glyph/GlyphCanvas";
import { glyphWindAccentStyle } from "@/lib/glyph/glyph-wind-accents";
import { GlyphReport } from "@/components/glyph/GlyphReport";
import { ToolPaywallInline } from "@/components/cross-product/ToolPaywallInline";
import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { StreamingAnalysisView } from "@/components/poju/StreamingAnalysisView";
import { saveGlyphReadingToArchive } from "@/lib/archive/archive-service";
import { markArchiveUnread } from "@/lib/archive/archive-unread";
import { prepareToolUnlockBase } from "@/lib/cross-product/finalize-tool-unlock";
import {
  loadGlyphDrawSession,
  updateGlyphDrawSession,
} from "@/lib/glyph/glyph-draw-session";
import { isGlyphPreviewSession } from "@/lib/glyph/glyph-preview-unlock";
import type { StoredProfileData } from "@/lib/db/poju-db";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { generateGlyphFullReading } from "@/lib/oracle/api";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { extractGlyphSummary } from "@/lib/poju/tool-result-summary";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { cn } from "@/lib/utils/classnames";
import type { CSSProperties } from "react";
import { LEVEL_META, type SignData } from "@/types/oracle";

type Stage = "loading" | "paywall" | "base-prep" | "base-cache" | "glyph-gen" | "ready" | "error";

export function GlyphReadingPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("glyph");
  const readingId = typeof params.id === "string" ? params.id : "";

  const [stage, setStage] = useState<Stage>("loading");
  const [loaderStep, setLoaderStep] = useState("loading");
  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [profileId, setProfileId] = useState("");
  const [glyph, setGlyph] = useState<SignData | null>(null);
  const [question, setQuestion] = useState("");
  const [reading, setReading] = useState<GlyphReadingContent | null>(null);
  const [baseReportText, setBaseReportText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [basePrepKey, setBasePrepKey] = useState(0);
  const cacheSplineStartedRef = useRef(0);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runGlyphGeneration = useCallback(
    async (sessionProfileId: string, sessionQuestion: string, sign: SignData) => {
      setLoaderStep("analyzing");
      setStage("glyph-gen");

      const stored = await getStoredProfile(sessionProfileId);
      if (!stored?.user_profile || !hasBaseAnalysisPayload(normalizeBaseAnalysisInput(stored.base_analysis))) {
        setError(t("reading_profile_not_ready"));
        setLoaderStep("error");
        setStage("error");
        return;
      }

      setProfile(stored);

      try {
        const { reading: content, meta } = await generateGlyphFullReading({
          sign,
          question: sessionQuestion,
          locale,
          profile_id: sessionProfileId,
          reading_id: readingId,
          user_profile: stored.user_profile,
          base_analysis: stored.base_analysis,
        });

        console.info("[glyph-reading] DeepSeek full reading complete", {
          reading_id: readingId,
          model: meta.model,
          tokens_used: meta.tokens_used,
          latency_ms: meta.latency_ms,
          cost_usd: meta.cost_usd,
        });

        setReading(content);

        if (!content.invalid_input) {
          const windCategory = LEVEL_META[sign.level]?.display_name ?? sign.level;
          try {
            const archiveId = await saveGlyphReadingToArchive({
              reading_id: readingId,
              profile_id: sessionProfileId,
              question: sessionQuestion,
              sign,
              wind_category: windCategory,
              reading: content,
              locale,
            });
            if (!mountedRef.current) {
              markArchiveUnread(archiveId, "glyph");
            }
          } catch (e) {
            console.error("[glyph-reading] Archive save failed:", e);
          }
        }

        setStage("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoaderStep("error");
        setStage("error");
      }
    },
    [locale, readingId, t],
  );

  const beginUnlockPipeline = useCallback(async () => {
    if (!readingId) {
      setError(t("reading_session_missing"));
      setStage("error");
      return;
    }

    const session = loadGlyphDrawSession(readingId);
    if (!session) {
      setError(t("reading_session_missing"));
      setStage("error");
      return;
    }

    if (isGlyphPreviewSession(session)) {
      setQuestion(session.pending_question?.trim() || session.question);
      setGlyph(session.sign);
      setProfileId(session.profile_id);
      setStage("paywall");
      return;
    }

    const q = session.pending_question?.trim() || session.question;
    setGlyph(session.sign);
    setQuestion(q);
    setProfileId(session.profile_id);
    setError(null);
    setLoaderStep("loading");
    setStage("loading");

    const stored = await getStoredProfile(session.profile_id);
    if (!stored?.user_profile) {
      setError(t("reading_profile_not_ready"));
      setStage("error");
      return;
    }
    setProfile(stored);

    const unlockBase = await prepareToolUnlockBase({
      product: "glyph",
      profileId: session.profile_id,
      userProfile: stored.user_profile,
      locale: session.locale || locale,
      toolSession: session,
    });

    if (unlockBase.baseReportText) {
      setBaseReportText(unlockBase.baseReportText);
      updateGlyphDrawSession(readingId, { base_report_text: unlockBase.baseReportText });
      cacheSplineStartedRef.current = Date.now();
      setStage("base-cache");
      return;
    }

    setStage("base-prep");
  }, [locale, readingId, t]);

  useEffect(() => {
    if (stage !== "base-cache") return;
    void (async () => {
      await waitRemainingMinSpline(cacheSplineStartedRef.current, PREPARING_MIN_SPLINE_CACHE_MS);
      const session = loadGlyphDrawSession(readingId);
      if (!session) return;
      const q = session.pending_question?.trim() || session.question;
      await runGlyphGeneration(session.profile_id, q, session.sign);
    })();
  }, [stage, readingId, runGlyphGeneration]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void beginUnlockPipeline();
  }, [beginUnlockPipeline]);

  async function handleUnlocked(via: "payment" | "code") {
    if (!readingId) return;
    setUnlockBusy(true);
    try {
      const session = loadGlyphDrawSession(readingId);
      const q = session?.pending_question?.trim() || session?.question || question;
      updateGlyphDrawSession(readingId, {
        unlock_status: "unlocked",
        unlock_via: via,
        question: q,
        pending_question: undefined,
      });
      startedRef.current = false;
      await beginUnlockPipeline();
    } finally {
      setUnlockBusy(false);
    }
  }

  if (stage === "paywall" && readingId) {
    return (
      <main className="glyph-draw-page browser-flow-page glyph-draw-page--paywall">
        <div className="glyph-paywall-overlay" role="dialog" aria-modal="true">
          <ToolPaywallInline
            product="glyph"
            readingId={readingId}
            locale={locale}
            pendingQuestion={question}
            onUnlocked={handleUnlocked}
            busy={unlockBusy}
          />
        </div>
      </main>
    );
  }

  if (stage === "base-prep" && profile && profileId) {
    const session = loadGlyphDrawSession(readingId);
    return (
      <PreparingSplineShell blockInteraction>
        <BaseAnalysisStreamPreparing
          key={basePrepKey}
          profile={profile}
          profileId={profileId}
          locale={locale}
          logLabel="GlyphUnlockPreparing"
          hideStreamView
          reportOutputLanguageFromUi
          onComplete={async (displayText) => {
            setBaseReportText(displayText);
            updateGlyphDrawSession(readingId, { base_report_text: displayText });
            const refreshed = await getStoredProfile(profileId);
            if (refreshed) setProfile(refreshed);
            const q = session?.pending_question?.trim() || session?.question || question;
            if (session) {
              await runGlyphGeneration(profileId, q, session.sign);
            }
          }}
          onError={(err) => {
            setError(err);
            setStage("error");
          }}
        />
        <ChartReadingLoader
          profile={profile}
          currentStep="analyzing"
          error={null}
          onRetry={() => {}}
          onRefund={() => router.push("/glyph")}
          locale={locale}
          hintOverride={t("reading_loading_hint")}
        />
      </PreparingSplineShell>
    );
  }

  if (stage === "loading" || stage === "base-cache" || stage === "glyph-gen") {
    if (!profile && loaderStep !== "error" && stage === "loading") {
      return (
        <PreparingSplineShell blockInteraction>
          <div className="preparing-spline-page__overlay" role="status">
            <p className="preparing-spline-page__status">{t("reading_loading")}</p>
          </div>
        </PreparingSplineShell>
      );
    }

    if (profile) {
      return (
        <PreparingSplineShell blockInteraction>
          <ChartReadingLoader
            profile={profile}
            currentStep={loaderStep}
            error={error}
            onRetry={() => {
              startedRef.current = false;
              void beginUnlockPipeline();
            }}
            onRefund={() => router.push("/glyph")}
            locale={locale}
            hintOverride={t("reading_loading_hint")}
          />
        </PreparingSplineShell>
      );
    }

    return (
      <div className="glyph-error-page">
        <p>{t("reading_failed")}</p>
        {error ? <p className="error-detail">{error}</p> : null}
        <div className="glyph-error-actions">
          <button type="button" className="glyph-primary-btn" onClick={() => void beginUnlockPipeline()}>
            {t("reading_retry")}
          </button>
          <Link href="/glyph" className="glyph-link-muted">
            {t("back_to_glyph")}
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="glyph-error-page">
        <p>{t("reading_failed")}</p>
        {error ? <p className="error-detail">{error}</p> : null}
        <div className="glyph-error-actions">
          <button type="button" className="glyph-primary-btn" onClick={() => void beginUnlockPipeline()}>
            {t("reading_retry")}
          </button>
          <Link href="/glyph" className="glyph-link-muted">
            {t("back_to_glyph")}
          </Link>
        </div>
      </div>
    );
  }

  if (!glyph || !reading) {
    return null;
  }

  const glyphSummary = extractGlyphSummary({
    reading_id: readingId,
    question,
    glyph,
    reading,
  });

  const reportText = baseReportText ?? loadGlyphDrawSession(readingId)?.base_report_text ?? "";

  return (
    <div
      className={cn("glyph-reading-page browser-flow-page")}
      style={glyphWindAccentStyle(glyph.level) as CSSProperties}
    >
      <ReturnToPojuCTA
        tool="glyph"
        resultId={readingId}
        resultData={glyphSummary}
        variant="banner"
      />
      {reportText ? (
        <section className="glyph-base-report">
          <StreamingAnalysisView
            content={reportText}
            status="completed"
            bytes_received={reportText.length}
          />
        </section>
      ) : null}
      <GlyphCanvas glyph={glyph} animated={false} compact />
      <GlyphReport reading={reading} glyph={glyph} question={question} />
      <ReturnToPojuCTA
        tool="glyph"
        resultId={readingId}
        resultData={glyphSummary}
        variant="footer"
      />
      <PojuDeepDiveCTA productId="glyph" result_id={readingId} result_data={glyphSummary} />
      <div className="glyph-reading-footer">
        <Link href="/glyph" className="glyph-link-muted">
          {t("back_to_glyph")}
        </Link>
      </div>
    </div>
  );
}
