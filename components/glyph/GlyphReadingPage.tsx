"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { GlyphCanvas } from "@/components/glyph/GlyphCanvas";
import { GlyphReport } from "@/components/glyph/GlyphReport";
import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { saveGlyphReadingToArchive } from "@/lib/archive/archive-service";
import { loadGlyphDrawSession } from "@/lib/glyph/glyph-draw-session";
import type { StoredProfileData } from "@/lib/db/poju-db";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { generateGlyphFullReading } from "@/lib/oracle/api";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { extractGlyphSummary } from "@/lib/poju/tool-result-summary";
import { LEVEL_META, type SignData } from "@/types/oracle";

type Stage = "loading" | "ready" | "error";

export function GlyphReadingPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("glyph");
  const readingId = typeof params.id === "string" ? params.id : "";

  const [stage, setStage] = useState<Stage>("loading");
  const [loaderStep, setLoaderStep] = useState("loading");
  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [glyph, setGlyph] = useState<SignData | null>(null);
  const [question, setQuestion] = useState("");
  const [reading, setReading] = useState<GlyphReadingContent | null>(null);
  const [archiveId, setArchiveId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runReading = useCallback(async () => {
    if (!readingId) {
      setError(t("reading_session_missing"));
      setLoaderStep("error");
      setStage("error");
      return;
    }

    const session = loadGlyphDrawSession(readingId);
    if (!session) {
      setError(t("reading_session_missing"));
      setLoaderStep("error");
      setStage("error");
      return;
    }

    setGlyph(session.sign);
    setQuestion(session.question);
    setError(null);
    setLoaderStep("loading");
    setStage("loading");

    const stored = await getStoredProfile(session.profile_id);
    if (!stored?.user_profile || stored.base_analysis?.content == null) {
      setError(t("reading_profile_not_ready"));
      setLoaderStep("error");
      setStage("error");
      return;
    }

    setProfile(stored);
    setLoaderStep("analyzing");

    try {
      const { reading: content, meta } = await generateGlyphFullReading({
        sign: session.sign,
        question: session.question,
        locale: session.locale || locale,
        profile_id: session.profile_id,
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
        const windCategory = LEVEL_META[session.sign.level]?.display_name ?? session.sign.level;
        try {
          const savedId = await saveGlyphReadingToArchive({
            reading_id: readingId,
            profile_id: session.profile_id,
            question: session.question,
            sign: session.sign,
            wind_category: windCategory,
            reading: content,
            locale: session.locale || locale,
          });
          setArchiveId(savedId);
        } catch (e) {
          console.error("[glyph-reading] Archive save failed:", e);
        }
      }

      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoaderStep("error");
      setStage("loading");
    }
  }, [locale, readingId, t]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runReading();
  }, [runReading]);

  if (stage === "loading") {
    if (!profile && loaderStep !== "error") {
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
            onRetry={() => void runReading()}
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
          <button type="button" className="glyph-primary-btn" onClick={() => void runReading()}>
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
          <button type="button" className="glyph-primary-btn" onClick={() => void runReading()}>
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

  return (
    <div className="glyph-reading-page">
      <ReturnToPojuCTA
        tool="glyph"
        resultId={readingId}
        resultData={glyphSummary}
        variant="banner"
      />
      <GlyphCanvas glyph={glyph} animated={false} />
      <GlyphReport reading={reading} glyph={glyph} question={question} archiveId={archiveId} />
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
