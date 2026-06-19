"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DrawSequence } from "@/components/oracle/DrawSequence";
import { OracleSummon } from "@/components/oracle/OracleSummon";
import { ToolPreviewChatSection } from "@/components/cross-product/ToolPreviewChatSection";
import { ToolPreviewMatrixLoading } from "@/components/cross-product/ToolPreviewMatrixLoading";
import { ToolPaywallInline } from "@/components/cross-product/ToolPaywallInline";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import { consumeGlyphToolPreviewSession } from "@/lib/cross-product/tool-preview-session-cache";
import {
  loadGlyphDrawSession,
  saveGlyphDrawSession,
  updateGlyphDrawSession,
} from "@/lib/glyph/glyph-draw-session";
import { getGlyphUnlockStatus } from "@/lib/glyph/glyph-preview-unlock";
import { formatGlyphProfileShort, hourPeriodToShichen } from "@/lib/glyph/profile-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import { discardIncompletePendingProfile } from "@/lib/profile/stored-profiles-service";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
import { normalizeStoredBirthInfo } from "@/lib/profile/birth-info-utils";
import type { SignData, UserInput } from "@/types/oracle";

type Stage = "preview-loading" | "preview" | "summon" | "drawing" | "paywall";

export function GlyphDrawPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("glyph");

  const profileId = searchParams.get("profile");
  const resumeReadingId = searchParams.get("reading");
  const openPaywall = searchParams.get("paywall") === "1";

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [stage, setStage] = useState<Stage>("preview-loading");
  const [error, setError] = useState<string | null>(null);
  const [matrixPayload, setMatrixPayload] = useState<PojuMatrixPayload | null>(null);
  const [narrative, setNarrative] = useState<MatrixNarrativeResponse | null>(null);
  const [question, setQuestion] = useState("");
  const [drawnSign, setDrawnSign] = useState<SignData | null>(null);
  const [readingId, setReadingId] = useState<string | null>(resumeReadingId);
  const [drawBusy, setDrawBusy] = useState(false);
  const [summonFinished, setSummonFinished] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);

  const initRef = useRef(false);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [previewRetryKey, setPreviewRetryKey] = useState(0);

  const initializePreview = useCallback(async () => {
    if (!profileId) return;
    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;

    setError(null);
    setStage("preview-loading");

    try {
      const p = await getStoredProfile(profileId);
      if (!p?.user_profile) {
        setError(t("profile_not_found"));
        setStage("preview-loading");
        return;
      }
      setProfile(p);

      const cachedPreview = consumeGlyphToolPreviewSession(profileId);
      if (cachedPreview) {
        setMatrixPayload(cachedPreview.matrix_payload);
        setNarrative(cachedPreview.narrative);
        setStage("preview");
        return;
      }

      const preview = await finalizeToolPreview({
        profileId,
        userProfile: p.user_profile,
        locale,
        product: "glyph",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;

      setMatrixPayload(preview.matrix_payload);
      setNarrative(preview.narrative);
      setStage("preview");
    } catch (e) {
      if (ac.signal.aborted) return;
      if (profileId) {
        await discardIncompletePendingProfile(profileId);
      }
      setError(e instanceof Error ? e.message : String(e));
      setStage("preview-loading");
    }
  }, [profileId, locale, t]);

  useEffect(() => {
    if (!profileId) {
      router.replace("/glyph");
      return;
    }
    if (previewRetryKey === 0 && initRef.current) return;
    initRef.current = true;
    void initializePreview();
    return () => previewAbortRef.current?.abort();
  }, [profileId, router, initializePreview, previewRetryKey]);

  useLayoutEffect(() => {
    if (stage === "preview") {
      window.scrollTo(0, 0);
    }
  }, [stage]);

  useEffect(() => {
    if (!openPaywall || !resumeReadingId) return;
    const session = loadGlyphDrawSession(resumeReadingId);
    if (!session) return;
    setReadingId(resumeReadingId);
    setQuestion(session.pending_question?.trim() || session.question);
    setDrawnSign(session.sign);
    if (getGlyphUnlockStatus(session) === "preview") {
      setStage("paywall");
    }
  }, [openPaywall, resumeReadingId]);

  async function handleDraw() {
    const q = question.trim();
    if (q.length < 10 || q.length > 200 || !profileId || !profile || !matrixPayload) return;

    setDrawBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/oracle/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          question: q,
          session_type: "free",
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

      await recordProfileUsage(profileId, "glyph");

      setReadingId(data.reading_id);
      setDrawnSign(data.sign);
      saveGlyphDrawSession({
        reading_id: data.reading_id,
        profile_id: profileId,
        question: q,
        pending_question: q,
        session_type: "free",
        locale,
        sign: data.sign,
        created_at: new Date().toISOString(),
        unlock_status: "preview",
        matrix_payload: matrixPayload,
      });

      setSummonFinished(false);
      setStage("summon");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

  function handleFullReading(_sign: SignData) {
    if (!readingId) return;
    const session = updateGlyphDrawSession(readingId, {
      pending_question: question.trim(),
      unlock_status: "preview",
    });
    if (session && getGlyphUnlockStatus(session) === "unlocked") {
      router.push(`/glyph/reading/${readingId}`);
      return;
    }
    setStage("paywall");
  }

  async function handleUnlocked(via: "payment" | "code") {
    if (!readingId) return;
    setUnlockBusy(true);
    try {
      const q = question.trim();
      updateGlyphDrawSession(readingId, {
        unlock_status: "unlocked",
        unlock_via: via,
        question: q,
        pending_question: undefined,
      });
      router.push(`/glyph/reading/${readingId}`);
    } finally {
      setUnlockBusy(false);
    }
  }

  if (!profileId) {
    return null;
  }

  if (stage === "preview-loading") {
    return (
      <ToolPreviewMatrixLoading
        profile={profile}
        locale={locale}
        error={error}
        onRetry={() => {
          setError(null);
          setPreviewRetryKey((k) => k + 1);
        }}
        onBack={() => router.push("/glyph/prepare")}
      />
    );
  }

  if (stage === "paywall" && readingId) {
    return (
      <main className="glyph-draw-page browser-flow-page glyph-draw-page--paywall">
        <div className="glyph-paywall-overlay" role="dialog" aria-modal="true">
          <ToolPaywallInline
            product="glyph"
            readingId={readingId}
            locale={locale}
            pendingQuestion={question.trim()}
            onUnlocked={handleUnlocked}
            busy={unlockBusy}
          />
        </div>
      </main>
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

    return <OracleSummon userInput={userInput} onComplete={handleSummonComplete} />;
  }

  if (stage === "drawing" && drawnSign) {
    const userInput = buildUserInput();
    if (!userInput) return null;
    return (
      <DrawSequence
        userInput={userInput}
        forcedSign={drawnSign}
        onFullReading={handleFullReading}
        onClose={() => setStage("preview")}
      />
    );
  }

  const qLen = question.length;
  const canDraw = qLen >= 10 && qLen <= 200 && !drawBusy && Boolean(matrixPayload);

  return (
    <main className="glyph-draw-page browser-flow-page tool-preview-page">
      <div className="tool-preview-page__header">
        <Link href="/glyph/prepare" className="glyph-draw-back">
          ← {t("back_to_prepare")}
        </Link>

        {profile ? (
          <div className="profile-mini-display">
            <span className="profile-mini-label">{t("reading_for_label")}</span>
            <span className="profile-mini-value">{formatGlyphProfileShort(profile, locale)}</span>
          </div>
        ) : null}
      </div>

      {matrixPayload ? (
        <ToolPreviewChatSection
          product="glyph"
          locale={locale}
          matrices={[{ payload: matrixPayload }]}
          narrative={narrative}
        />
      ) : null}

      <div className="tool-preview-page__footer">
        <h2 className="glyph-input-title">{t("input_title")}</h2>
        <p className="glyph-input-hint">{t("input_hint")}</p>

        <textarea
          className="glyph-question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
          placeholder={t("input_placeholder")}
          rows={5}
        />

        <div className="glyph-char-count">{qLen} / 200</div>

        {error ? <p className="glyph-draw-error">{error}</p> : null}

        <button
          type="button"
          className="glyph-primary-btn glyph-draw-button"
          disabled={!canDraw}
          onClick={() => void handleDraw()}
        >
          {drawBusy ? t("drawing_text") : t("draw_button")}
        </button>
      </div>
    </main>
  );
}
