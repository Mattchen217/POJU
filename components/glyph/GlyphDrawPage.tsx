"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DrawSequence } from "@/components/oracle/DrawSequence";
import { OracleSummon } from "@/components/oracle/OracleSummon";
import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { saveGlyphDrawSession } from "@/lib/glyph/glyph-draw-session";
import { formatGlyphProfileShort, hourPeriodToShichen } from "@/lib/glyph/profile-display";
import { markGlyphFreeUsedLocal } from "@/lib/glyph/storage";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  getStoredProfile,
  getStoredProfileRecord,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import { normalizeStoredBirthInfo } from "@/lib/profile/birth-info-utils";
import type { SignData, UserInput } from "@/types/oracle";

type Stage = "preparing" | "input" | "summon" | "drawing";

export function GlyphDrawPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("glyph");

  const profileId = searchParams.get("profile");
  const sessionType = searchParams.get("type") === "paid" ? "paid" : "free";

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [stage, setStage] = useState<Stage>("preparing");
  const [loaderStep, setLoaderStep] = useState("loading");
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [drawnSign, setDrawnSign] = useState<SignData | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [drawBusy, setDrawBusy] = useState(false);
  const [summonFinished, setSummonFinished] = useState(false);

  const initRef = useRef(false);

  const initializeProfile = useCallback(async () => {
    if (!profileId) return;
    setError(null);
    setLoaderStep("loading");
    setStage("preparing");

    try {
      const p = await getStoredProfile(profileId);
      if (!p) {
        setError(t("profile_not_found"));
        setLoaderStep("error");
        return;
      }
      setProfile(p);

      const record = await getStoredProfileRecord(profileId);
      if (record?.has_base_analysis && p.base_analysis?.content) {
        setLoaderStep("using_cache");
        await new Promise((r) => setTimeout(r, 800));
        setStage("input");
        return;
      }

      setLoaderStep("analyzing");
      await generateBaseAnalysis(profileId);
      const updated = await getStoredProfile(profileId);
      setProfile(updated ?? p);
      setStage("input");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoaderStep("error");
    }
  }, [profileId, t]);

  useEffect(() => {
    if (!profileId) {
      router.replace("/glyph");
      return;
    }
    if (initRef.current) return;
    initRef.current = true;
    void initializeProfile();
  }, [profileId, router, initializeProfile]);

  async function handleDraw() {
    const q = question.trim();
    if (q.length < 10 || q.length > 200 || !profileId || !profile) return;

    setDrawBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/oracle/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          question: q,
          session_type: sessionType,
          locale,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message || `Draw failed (${response.status})`);
      }

      const data = (await response.json()) as {
        reading_id: string;
        sign: SignData;
      };

      if (sessionType === "free") {
        markGlyphFreeUsedLocal();
        await fetch("/api/glyph/quota", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "consume_free" }),
        }).catch(() => undefined);
      }

      await recordProfileUsage(profileId, "glyph");

      setReadingId(data.reading_id);
      setDrawnSign(data.sign);
      saveGlyphDrawSession({
        reading_id: data.reading_id,
        profile_id: profileId,
        question: q,
        session_type: sessionType,
        locale,
        sign: data.sign,
        created_at: new Date().toISOString(),
      });

      setSummonFinished(false);
      setStage("summon");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("input");
    } finally {
      setDrawBusy(false);
    }
  }

  function handleSummonComplete() {
    setSummonFinished(true);
  }

  useEffect(() => {
    if (!summonFinished || !drawnSign || !readingId) return;
    setStage("drawing");
  }, [summonFinished, drawnSign, readingId]);

  function buildUserInput(): UserInput | null {
    if (!profile) return null;
    const b = normalizeStoredBirthInfo(profile.birth_info as unknown as Record<string, unknown>);
    return {
      birthYear: b.year,
      birthMonth: b.month,
      birthDay: b.day,
      birthShichen: hourPeriodToShichen(b.hour_period),
      question: question.trim(),
    };
  }

  function handleFullReading(sign: SignData) {
    if (!readingId) return;
    router.push(`/glyph/reading/${readingId}`);
  }

  if (!profileId) {
    return null;
  }

  if (stage === "preparing") {
    if (!profile || loaderStep === "error") {
      return (
        <PreparingSplineShell>
          {profile ? (
            <ChartReadingLoader
              profile={profile}
              currentStep="error"
              error={error}
              onRetry={() => void initializeProfile()}
              onRefund={() => router.push("/glyph")}
              locale={locale}
            />
          ) : (
            <div className="preparing-spline-page__overlay session-prep-loading">{t("loading")}</div>
          )}
        </PreparingSplineShell>
      );
    }

    return (
      <PreparingSplineShell>
        <ChartReadingLoader
          profile={profile}
          currentStep={loaderStep}
          error={error}
          onRetry={() => void initializeProfile()}
          onRefund={() => router.push("/glyph")}
          locale={locale}
        />
      </PreparingSplineShell>
    );
  }

  if (stage === "summon") {
    const userInput = buildUserInput();
    if (!userInput) return null;

    if (summonFinished && !drawnSign) {
      return (
        <div className="glyph-loading-page">
          <div className="loading-glyph">
            <div className="glyph-reading-spinner" aria-hidden />
            <p>{t("drawing_text")}</p>
          </div>
        </div>
      );
    }

    return (
      <OracleSummon
        userInput={userInput}
        onComplete={handleSummonComplete}
      />
    );
  }

  if (stage === "drawing" && drawnSign) {
    const userInput = buildUserInput();
    if (!userInput) return null;
    return (
      <DrawSequence
        userInput={userInput}
        forcedSign={drawnSign}
        onFullReading={handleFullReading}
        onClose={() => setStage("input")}
      />
    );
  }

  const qLen = question.length;
  const canDraw = qLen >= 10 && qLen <= 200 && !drawBusy;

  return (
    <main className="glyph-draw-page">
      <Link href="/glyph/prepare" className="glyph-draw-back">
        ← {t("back_to_prepare")}
      </Link>

      {profile ? (
        <div className="profile-mini-display">
          <span className="profile-mini-label">{t("reading_for_label")}</span>
          <span className="profile-mini-value">{formatGlyphProfileShort(profile, locale)}</span>
        </div>
      ) : null}

      <h2 className="glyph-input-title">{t("input_title")}</h2>
      <p className="glyph-input-hint">{t("input_hint")}</p>

      <textarea
        className="glyph-question-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
        placeholder={t("input_placeholder")}
        rows={5}
        autoFocus
      />

      <div className="glyph-char-count">
        {qLen} / 200
      </div>

      {error ? <p className="glyph-draw-error">{error}</p> : null}

      <button
        type="button"
        className="glyph-primary-btn glyph-draw-button"
        disabled={!canDraw}
        onClick={() => void handleDraw()}
      >
        {drawBusy ? t("drawing_text") : t("draw_button")}
      </button>
    </main>
  );
}
