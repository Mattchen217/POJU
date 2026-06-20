"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { GlyphReport } from "@/components/glyph/GlyphReport";
import { ToolPaywallInline } from "@/components/cross-product/ToolPaywallInline";
import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { DeliveryWaitCrossfade } from "@/components/wait-ritual/DeliveryWaitCrossfade";
import { saveGlyphReadingToArchive } from "@/lib/archive/archive-service";
import { glyphWindAccentStyle } from "@/lib/glyph/glyph-wind-accents";
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
import {
  clearInFlightGlyphReading,
  generateGlyphFullReading,
  GLYPH_READING_CLIENT_TIMEOUT_MS,
} from "@/lib/oracle/api";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { ReadingDecoderBanner } from "@/components/reading-ritual/ReadingDecoderBanner";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import {
  classifyGlyphReadingError,
  GLYPH_READING_ERROR_I18N_KEY,
} from "@/lib/glyph/glyph-reading-errors";
import { extractGlyphSummary } from "@/lib/poju/tool-result-summary";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";
import type { CSSProperties } from "react";
import { LEVEL_META, type SignData } from "@/types/oracle";

type Stage = "loading" | "paywall" | "base-prep" | "glyph-gen" | "ready" | "error";

/** After resume from background, retry glyph fetch if still running longer than this. */
const GLYPH_GEN_VISIBILITY_RETRY_MS = 75_000;
const GLYPH_GEN_WATCHDOG_MS = GLYPH_READING_CLIENT_TIMEOUT_MS + 15_000;

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
  const [baziComplete, setBaziComplete] = useState(false);
  const [productComplete, setProductComplete] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [skipBaziAtDelivery, setSkipBaziAtDelivery] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);
  const [finishCrossfadeStarted, setFinishCrossfadeStarted] = useState(false);
  const glyphProductStartedRef = useRef(false);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const stageRef = useRef<Stage>("loading");
  const glyphGenAbortRef = useRef<AbortController | null>(null);
  const glyphGenStartedAtRef = useRef(0);
  const glyphGenTokenRef = useRef(0);
  const visibilityRetryUsedRef = useRef(false);
  const glyphWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useLayoutEffect(() => {
    if (stage !== "ready") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [stage]);

  const clearGlyphWatchdog = useCallback(() => {
    if (glyphWatchdogRef.current) {
      clearTimeout(glyphWatchdogRef.current);
      glyphWatchdogRef.current = null;
    }
  }, []);

  const runGlyphGeneration = useCallback(
    async (
      sessionProfileId: string,
      sessionQuestion: string,
      sign: SignData,
      opts?: { force?: boolean },
    ) => {
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

      glyphGenAbortRef.current?.abort();
      clearGlyphWatchdog();
      const controller = new AbortController();
      glyphGenAbortRef.current = controller;
      glyphGenStartedAtRef.current = Date.now();
      const runToken = ++glyphGenTokenRef.current;

      glyphWatchdogRef.current = setTimeout(() => {
        if (stageRef.current !== "glyph-gen") return;
        if (runToken !== glyphGenTokenRef.current) return;
        controller.abort();
        clearInFlightGlyphReading(readingId);
        if (mountedRef.current) {
          setError("glyph_reading_client_timeout");
          setLoaderStep("error");
          setStage("error");
        }
      }, GLYPH_GEN_WATCHDOG_MS);

      try {
        const { reading: content, meta } = await generateGlyphFullReading({
          sign,
          question: sessionQuestion,
          locale,
          profile_id: sessionProfileId,
          reading_id: readingId,
          user_profile: stored.user_profile,
          base_analysis: stored.base_analysis,
          signal: controller.signal,
          force: opts?.force,
        });

        clearGlyphWatchdog();

        if (runToken !== glyphGenTokenRef.current || !mountedRef.current) return;

        console.info("[glyph-reading] DeepSeek full reading complete", {
          reading_id: readingId,
          model: meta.model,
          tokens_used: meta.tokens_used,
          latency_ms: meta.latency_ms,
          cost_usd: meta.cost_usd,
        });

        setReading(content);
        setProductComplete(true);

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
      } catch (e) {
        clearGlyphWatchdog();
        if (runToken !== glyphGenTokenRef.current || !mountedRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoaderStep("error");
        setStage("error");
      }
    },
    [clearGlyphWatchdog, locale, readingId, t],
  );

  const isWaitStage = stage === "base-prep" || stage === "glyph-gen";

  const waitFlow = useDeliveryWaitPhase({
    product: "glyph",
    skipBazi: skipBaziAtDelivery,
    isReturningUser: !skipBaziAtDelivery && isReturningUser,
    baziComplete,
    productComplete,
    enabled: isWaitStage,
    onExitComplete: () => setWaitVisualDone(true),
  });

  useEffect(() => {
    if (waitVisualDone && productComplete) {
      setStage("ready");
    }
  }, [waitVisualDone, productComplete]);

  useEffect(() => {
    if (productComplete && reading && glyph) {
      setFinishCrossfadeStarted(true);
    }
  }, [productComplete, reading, glyph]);

  useEffect(() => {
    if (waitFlow.phase !== "product") return;
    if (glyphProductStartedRef.current) return;
    const session = loadGlyphDrawSession(readingId);
    if (!session || !profileId) return;
    glyphProductStartedRef.current = true;
    setStage("glyph-gen");
    const q = session.pending_question?.trim() || session.question || question;
    void runGlyphGeneration(profileId, q, session.sign);
  }, [waitFlow.phase, profileId, readingId, question, runGlyphGeneration]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      glyphGenAbortRef.current?.abort();
      clearGlyphWatchdog();
    };
  }, [clearGlyphWatchdog]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (stageRef.current !== "glyph-gen") return;
      if (visibilityRetryUsedRef.current) return;
      const elapsed = Date.now() - glyphGenStartedAtRef.current;
      if (elapsed < GLYPH_GEN_VISIBILITY_RETRY_MS) return;

      visibilityRetryUsedRef.current = true;
      clearInFlightGlyphReading(readingId);
      glyphGenAbortRef.current?.abort();

      const session = loadGlyphDrawSession(readingId);
      if (!session) return;
      const q = session.pending_question?.trim() || session.question;
      void runGlyphGeneration(session.profile_id, q, session.sign, { force: true });
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [readingId, runGlyphGeneration]);

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
    visibilityRetryUsedRef.current = false;

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
      setIsReturningUser(true);
      setSkipBaziAtDelivery(true);
      setBaziComplete(true);
      setStage("glyph-gen");
      return;
    }

    setIsReturningUser(false);
    setSkipBaziAtDelivery(false);
    setBaziComplete(false);
    setStage("base-prep");
  }, [locale, readingId, router, t]);

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

  if (finishCrossfadeStarted && glyph && reading) {
    const glyphSummary = extractGlyphSummary({
      reading_id: readingId,
      question,
      glyph,
      reading,
    });
    const reportText = baseReportText ?? loadGlyphDrawSession(readingId)?.base_report_text ?? "";

    const waitFrame = (
      <DeliveryWaitFrame
        wait={waitFlow}
        isReturningUser={isReturningUser}
        error={error}
        exitAnimationExternal
        onRetry={() => {
          visibilityRetryUsedRef.current = false;
          clearInFlightGlyphReading(readingId);
          glyphGenAbortRef.current?.abort();
          glyphProductStartedRef.current = false;
          setSkipBaziAtDelivery(false);
          setBaziComplete(false);
          setProductComplete(false);
          setWaitVisualDone(false);
          setFinishCrossfadeStarted(false);
          startedRef.current = false;
          void beginUnlockPipeline();
        }}
        onRefund={() => router.push("/glyph")}
        hiddenWork={
          stage === "base-prep" ? (
            <BaseAnalysisStreamPreparing
              key={basePrepKey}
              profile={profile!}
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
                setBaziComplete(true);
              }}
              onError={(err) => {
                setError(err);
                setStage("error");
              }}
            />
          ) : null
        }
      />
    );

    return (
      <DeliveryWaitCrossfade
        wait={waitFlow}
        showWait={isWaitStage && !waitVisualDone}
        showDelivery
        waitFrame={waitFrame}
        delivery={
          <div
            className="glyph-reading-page browser-flow-page"
            style={glyphWindAccentStyle(glyph.level) as CSSProperties}
          >
            <ReturnToPojuCTA
              tool="glyph"
              resultId={readingId}
              resultData={glyphSummary}
              variant="banner"
            />
            <ReadingDecoderBanner variant="others" />
            <GlyphReport
              reading={reading}
              glyph={glyph}
              question={question}
              baseReportText={reportText || undefined}
              pojuDeepDive={{ result_id: readingId, result_data: glyphSummary }}
            />
            <ReturnToPojuCTA
              tool="glyph"
              resultId={readingId}
              resultData={glyphSummary}
              variant="footer"
            />
            <div className="glyph-reading-footer">
              <Link href="/glyph" className="glyph-link-muted">
                {t("back_to_glyph")}
              </Link>
            </div>
          </div>
        }
      />
    );
  }

  if (isWaitStage && profile) {
    return (
      <DeliveryWaitFrame
        wait={waitFlow}
        isReturningUser={isReturningUser}
        error={error}
        onRetry={() => {
          visibilityRetryUsedRef.current = false;
          clearInFlightGlyphReading(readingId);
          glyphGenAbortRef.current?.abort();
          glyphProductStartedRef.current = false;
          setSkipBaziAtDelivery(false);
          setBaziComplete(false);
          setProductComplete(false);
          setWaitVisualDone(false);
          setFinishCrossfadeStarted(false);
          startedRef.current = false;
          void beginUnlockPipeline();
        }}
        onRefund={() => router.push("/glyph")}
        hiddenWork={
          stage === "base-prep" ? (
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
                setBaziComplete(true);
              }}
              onError={(err) => {
                setError(err);
                setStage("error");
              }}
            />
          ) : null
        }
      />
    );
  }

  if (stage === "loading" && !profile) {
    return null;
  }

  if (stage === "error") {
    const errorCode = error ? classifyGlyphReadingError(error) : "unknown";
    const errorDetailKey = GLYPH_READING_ERROR_I18N_KEY[errorCode];
    return (
      <div className="glyph-error-page">
        <p>{t("reading_failed")}</p>
        <p className="error-detail">{t(errorDetailKey)}</p>
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
      className="glyph-reading-page browser-flow-page"
      style={glyphWindAccentStyle(glyph.level) as CSSProperties}
    >
      <ReturnToPojuCTA
        tool="glyph"
        resultId={readingId}
        resultData={glyphSummary}
        variant="banner"
      />
      <ReadingDecoderBanner variant="others" />
      <GlyphReport
        reading={reading}
        glyph={glyph}
        question={question}
        baseReportText={reportText || undefined}
        pojuDeepDive={{ result_id: readingId, result_data: glyphSummary }}
      />
      <ReturnToPojuCTA
        tool="glyph"
        resultId={readingId}
        resultData={glyphSummary}
        variant="footer"
      />
      <div className="glyph-reading-footer">
        <Link href="/glyph" className="glyph-link-muted">
          {t("back_to_glyph")}
        </Link>
      </div>
    </div>
  );
}
