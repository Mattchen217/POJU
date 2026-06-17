"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { ToolPreviewMatrixLoading } from "@/components/cross-product/ToolPreviewMatrixLoading";
import { RelationshipInput } from "@/components/match/RelationshipInput";
import { ToolPreviewChatSection } from "@/components/cross-product/ToolPreviewChatSection";
import { ToolPaywallInline } from "@/components/cross-product/ToolPaywallInline";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import { formatBirthShort } from "@/lib/match/format-birth-short";
import {
  ensureMatchPreviewSession,
  loadMatchPreviewSession,
  patchMatchPreviewSession,
} from "@/lib/match/match-preview-session";
import { isMatchPreviewSession } from "@/lib/match/match-preview-unlock";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import "@/styles/poju-tool-handoff.css";
import { useRouter } from "@/i18n/navigation";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

import "@/styles/match.css";

type Stage = "preview-loading" | "preview" | "paywall";

export function MatchRelationshipPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("match");

  const openPaywall = searchParams.get("paywall") === "1";

  const [aProfile, setAProfile] = useState<StoredProfileData | null>(null);
  const [bProfile, setBProfile] = useState<StoredProfileData | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [matrixPayload, setMatrixPayload] = useState<PojuMatrixPayload | null>(null);
  const [matrixPayloadB, setMatrixPayloadB] = useState<PojuMatrixPayload | null>(null);
  const [narrative, setNarrative] = useState<MatrixNarrativeResponse | null>(null);
  const [stage, setStage] = useState<Stage>("preview-loading");
  const pojuHandoff = usePojuToolHandoff("match");
  const [relationship, setRelationship] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewAbortRef = useRef<AbortController | null>(null);
  const initRef = useRef(false);
  const [previewRetryKey, setPreviewRetryKey] = useState(0);

  const loadPreview = useCallback(async () => {
    const aId = sessionStorage.getItem("match_a_profile_id");
    const bId = sessionStorage.getItem("match_b_profile_id");

    if (!aId || !bId) {
      router.replace("/match/select-a");
      return;
    }

    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;

    setStage("preview-loading");
    setError(null);

    try {
      const [a, b] = await Promise.all([getStoredProfile(aId), getStoredProfile(bId)]);
      if (!a?.user_profile || !b?.user_profile) {
        router.replace("/match/select-a");
        return;
      }
      setAProfile(a);
      setBProfile(b);

      const previewSession = ensureMatchPreviewSession({
        a_profile_id: aId,
        b_profile_id: bId,
        locale,
      });
      setPreviewId(previewSession.preview_id);

      const preview = await finalizeToolPreview({
        profileId: aId,
        userProfile: a.user_profile,
        profileBId: bId,
        userProfileB: b.user_profile,
        locale,
        product: "match",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;

      setMatrixPayload(preview.matrix_payload);
      setMatrixPayloadB(preview.matrix_payload_b);
      setNarrative(preview.narrative);
      patchMatchPreviewSession({
        matrix_payload: preview.matrix_payload,
        matrix_payload_b: preview.matrix_payload_b ?? undefined,
      });

      const existing = loadMatchPreviewSession();
      if (existing && !isMatchPreviewSession(existing)) {
        setStage("preview");
        return;
      }
      if (openPaywall && existing?.pending_question) {
        setRelationship(existing.pending_question);
        setStage("paywall");
        return;
      }
      setStage("preview");
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setStage("preview-loading");
    }
  }, [locale, openPaywall, router]);

  useEffect(() => {
    if (previewRetryKey === 0 && initRef.current) return;
    initRef.current = true;
    void loadPreview();
    return () => previewAbortRef.current?.abort();
  }, [loadPreview, previewRetryKey]);

  useLayoutEffect(() => {
    if (stage === "preview") {
      window.scrollTo(0, 0);
    }
  }, [stage]);

  useEffect(() => {
    const prefill =
      pojuHandoff?.prefill.partner_relationship ??
      sessionStorage.getItem("match_relationship_prefill");
    if (prefill && prefill.trim().length >= 10 && relationship.trim().length < 10) {
      setRelationship(prefill.trim());
    }
  }, [pojuHandoff, relationship]);

  async function handleContinue() {
    const q = relationship.trim();
    if (q.length < 10 || unlockBusy) return;

    const session = loadMatchPreviewSession();
    if (!session) return;

    if (isMatchPreviewSession(session)) {
      patchMatchPreviewSession({
        pending_question: q,
        unlock_status: "preview",
      });
      setStage("paywall");
      return;
    }

    sessionStorage.setItem("match_relationship", q);
    router.push("/match/analyzing");
  }

  async function handleUnlocked(via: "payment" | "code") {
    const q = relationship.trim();
    if (!q) return;
    setUnlockBusy(true);
    try {
      patchMatchPreviewSession({
        unlock_status: "unlocked",
        unlock_via: via,
        pending_question: q,
      });
      sessionStorage.setItem("match_relationship", q);
      router.push("/match/analyzing");
    } finally {
      setUnlockBusy(false);
    }
  }

  function handleBack() {
    router.push("/match/select-b");
  }

  if (stage === "preview-loading") {
    return (
      <ToolPreviewMatrixLoading
        profile={aProfile}
        locale={locale}
        error={error}
        onRetry={() => {
          setError(null);
          setPreviewRetryKey((k) => k + 1);
        }}
        onBack={() => router.push("/match/select-b")}
      />
    );
  }

  if (stage === "paywall" && previewId) {
    return (
      <main className="match-relationship-page match-relationship-page--paywall browser-flow-page">
        <div className="match-paywall-overlay" role="dialog" aria-modal="true">
          <ToolPaywallInline
            product="match"
            previewId={previewId}
            locale={locale}
            pendingQuestion={relationship.trim()}
            onUnlocked={handleUnlocked}
            busy={unlockBusy}
          />
        </div>
      </main>
    );
  }

  if (!aProfile || !bProfile) {
    return (
      <main className="match-relationship-page match-relationship-page--loading browser-flow-page">
        <p>{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="match-relationship-page browser-flow-page tool-preview-page">
      {pojuHandoff ? <PojuToolHandoffBanner handoff={pojuHandoff} /> : null}

      {matrixPayload ? (
        <ToolPreviewChatSection
          product="match"
          locale={locale}
          matrices={[
            { payload: matrixPayload, label: "A" },
            ...(matrixPayloadB ? [{ payload: matrixPayloadB, label: "B" }] : []),
          ]}
          narrative={narrative}
        />
      ) : null}

      <div className="tool-preview-page__footer">
        {error ? <p className="match-draw-error">{error}</p> : null}

        <RelationshipInput
          aLabel={formatBirthShort(aProfile)}
          bLabel={formatBirthShort(bProfile)}
          relationship={relationship}
          onRelationshipChange={setRelationship}
          onContinue={() => void handleContinue()}
          onBack={handleBack}
          continueLabel={t("relationship.begin_match")}
          continueDisabled={unlockBusy}
        />
      </div>
    </main>
  );
}
