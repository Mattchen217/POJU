"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { Layer1PrepareWork } from "@/components/poju/Layer1PrepareWork";
import { useBaseAnalysisWaitProgress } from "@/lib/base-analysis/use-base-analysis-wait-progress";
import { useRouter } from "@/i18n/navigation";
import { saveMatchToArchive } from "@/lib/archive/archive-service";
import { registerPendingDeliveryArchive } from "@/lib/archive/archive-delivery-pending";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { createMatchSession } from "@/lib/match/match-session";
import {
  clearMatchPreviewSession,
  loadMatchPreviewSession,
} from "@/lib/match/match-preview-session";
import { isMatchPreviewSession } from "@/lib/match/match-preview-unlock";
import { wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import {
  type MatchReport,
} from "@/lib/match/types";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { ensureProfileMatrixList } from "@/lib/poju/resolve-matrix-preview";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";
import { recordUsage } from "@/lib/syncro/device-usage";
import { readFetchJson } from "@/lib/client/fetch-json";

import "@/styles/match.css";

type Phase =
  | "init"
  | "base-a"
  | "base-b"
  | "base-cache"
  | "analyzing"
  | "error";

export function MatchAnalyzingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("match.analyzing");
  const tChart = useTranslations("chart_loader");

  const [phase, setPhase] = useState<Phase>("init");
  const [error, setError] = useState<string | null>(null);
  const [profileA, setProfileA] = useState<StoredProfileData | null>(null);
  const [profileB, setProfileB] = useState<StoredProfileData | null>(null);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [basePrepKey, setBasePrepKey] = useState(0);
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [baziComplete, setBaziComplete] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [skipBaziAtDelivery, setSkipBaziAtDelivery] = useState(false);
  const [waitVisualDone, setWaitVisualDone] = useState(false);
  const [productComplete, setProductComplete] = useState(false);
  const waitProgress = useBaseAnalysisWaitProgress();
  const includeTranslate = !locale.startsWith("zh");
  const matchAnalyzeStartedRef = useRef(false);
  const startedRef = useRef(false);

  const runAnalyze = useCallback(async () => {
    try {
      const relationship =
        sessionStorage.getItem("match_relationship")?.trim() ||
        loadMatchPreviewSession()?.pending_question?.trim();

      if (!aId || !bId || !relationship) {
        throw new Error(t("missing_data"));
      }

      const [aRow, bRow] = await Promise.all([getStoredProfile(aId), getStoredProfile(bId)]);

      if (!aRow?.user_profile || !hasBaseAnalysisPayload(normalizeBaseAnalysisInput(aRow.base_analysis))) {
        throw new Error(t("profile_a_not_ready"));
      }
      if (!bRow?.user_profile || !hasBaseAnalysisPayload(normalizeBaseAnalysisInput(bRow.base_analysis))) {
        throw new Error(t("profile_b_not_ready"));
      }

      const profileAForMatrix = wrapProfileForMatrix(aRow.user_profile, aRow.base_analysis);
      const profileBForMatrix = wrapProfileForMatrix(bRow.user_profile, bRow.base_analysis);

      const matrix = calculateCompatibilityMatrix({ profileA: profileAForMatrix, profileB: profileBForMatrix });

      const response = await fetch("/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: relationship,
          locale,
          a_user_profile: aRow.user_profile,
          a_base_analysis: aRow.base_analysis,
          b_user_profile: bRow.user_profile,
          b_base_analysis: bRow.base_analysis,
        }),
      });

      const data = await readFetchJson<{
        success?: boolean;
        report?: MatchReport;
        meta?: {
          cost_usd?: number;
          resonance_index?: number;
          local_computation?: boolean;
        };
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        if (data.error === "profile_not_ready") {
          throw new Error(t("profile_not_ready"));
        }
        if (data.error === "same_profile") {
          throw new Error(t("same_profile"));
        }
        if (response.status === 504 || response.status === 408) {
          throw new Error(t("error_timeout"));
        }
        throw new Error(data.message || data.error || t("analysis_failed"));
      }

      if (!data.report) {
        throw new Error(t("analysis_failed"));
      }

      const costUsd = data.meta?.cost_usd ?? 0;
      const resonanceIndex = data.meta?.resonance_index ?? matrix.resonance_index;

      const matchId = await createMatchSession({
        a_profile_id: aId,
        b_profile_id: bId,
        relationship_description: relationship,
        report: data.report,
        is_free: false,
        cost_usd: costUsd,
        locale,
        resonance_index: resonanceIndex,
        engine_version: "v5.1",
      });

      await recordUsage("match", false, costUsd);

      try {
        const archiveId = await saveMatchToArchive({
          match_id: matchId,
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: relationship,
          report: data.report,
          locale,
        });
        registerPendingDeliveryArchive({
          archive_id: archiveId,
          product: "match",
          session_id: matchId,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[match/analyzing] Archive save failed:", e);
      }

      sessionStorage.removeItem("match_a_profile_id");
      sessionStorage.removeItem("match_b_profile_id");
      sessionStorage.removeItem("match_relationship");
      sessionStorage.removeItem("match_session_type");
      clearMatchPreviewSession();

      setPendingMatchId(matchId);
      setProductComplete(true);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e ?? "");
      const looksLikeGatewayOrParse =
        /non_json_response|invalid_json_response|empty_response|unexpected token|not valid json|an error occurred/i.test(
          raw,
        );
      setError(
        looksLikeGatewayOrParse ? t("error_timeout") : raw || t("analysis_failed"),
      );
      setPhase("error");
    }
  }, [aId, bId, locale, t]);

  useEffect(() => {
    if (!pendingMatchId || !waitVisualDone) return;
    router.push(`/match/result/${pendingMatchId}`);
  }, [pendingMatchId, waitVisualDone, router]);

  const isBaziPhase = phase === "base-a" || phase === "base-b" || phase === "base-cache";
  const isProductPhase = phase === "analyzing";
  const isWaitPhase = isBaziPhase || isProductPhase;

  const waitFlow = useDeliveryWaitPhase({
    product: "match",
    skipBazi: skipBaziAtDelivery,
    isReturningUser: !skipBaziAtDelivery && isReturningUser,
    baziComplete,
    productComplete,
    enabled: isWaitPhase,
    onExitComplete: () => setWaitVisualDone(true),
  });

  useEffect(() => {
    if (waitFlow.phase !== "product") return;
    if (phase === "base-cache") setPhase("analyzing");
  }, [waitFlow.phase, phase]);

  useEffect(() => {
    if (waitFlow.phase !== "product") return;
    if (matchAnalyzeStartedRef.current) return;
    if (phase !== "analyzing") return;
    matchAnalyzeStartedRef.current = true;
    void runAnalyze();
  }, [waitFlow.phase, phase, runAnalyze]);

  const beginPipeline = useCallback(async () => {
    const preview = loadMatchPreviewSession();
    if (preview && isMatchPreviewSession(preview)) {
      router.replace("/match/relationship?paywall=1");
      return;
    }

    const storedAId = sessionStorage.getItem("match_a_profile_id");
    const storedBId = sessionStorage.getItem("match_b_profile_id");
    if (!storedAId || !storedBId) {
      router.replace("/match/select-a");
      return;
    }

    setAId(storedAId);
    setBId(storedBId);

    const [aRow, bRow] = await Promise.all([
      getStoredProfile(storedAId),
      getStoredProfile(storedBId),
    ]);
    if (!aRow?.user_profile || !bRow?.user_profile) {
      setError(t("missing_data"));
      setPhase("error");
      return;
    }
    setProfileA(aRow);
    setProfileB(bRow);

    const [cachedA, cachedB] = await Promise.all([
      getCachedBaseAnalysis(storedAId),
      getCachedBaseAnalysis(storedBId),
    ]);

    if (!cachedA) {
      setPhase("base-a");
      return;
    }
    if (!cachedB) {
      setPhase("base-b");
      return;
    }

    setIsReturningUser(true);
    setSkipBaziAtDelivery(true);
    setBaziComplete(true);
    setPhase("analyzing");
  }, [router, t]);

  async function afterBaseAComplete() {
    const refreshedB = await getCachedBaseAnalysis(bId);
    if (refreshedB) {
      setIsReturningUser(true);
      setBaziComplete(true);
      setPhase("base-cache");
      return;
    }
    const refreshedA = await getStoredProfile(aId);
    if (refreshedA) setProfileA(refreshedA);
    setPhase("base-b");
  }

  async function afterBaseBComplete() {
    const refreshed = await getStoredProfile(bId);
    if (refreshed) setProfileB(refreshed);
    setBaziComplete(true);
    setPhase("analyzing");
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void beginPipeline();
  }, [beginPipeline]);

  if (phase === "base-a" && profileA && aId) {
    return (
      <DeliveryWaitFrame
        wait={waitFlow}
        liveProgressStage={waitProgress.liveProgressStage}
        completedArtifacts={waitProgress.completedArtifacts}
        includeTranslateArtifact={includeTranslate}
        hiddenWork={
          <Layer1PrepareWork
            key={`base-a-${basePrepKey}`}
            profileId={aId}
            locale={locale}
            preWork={async () => {
              await ensureProfileMatrixList({
                profileId: aId,
                userProfile: profileA.user_profile,
                locale,
              });
            }}
            onComplete={() => {
              waitProgress.reset();
              void afterBaseAComplete();
            }}
            onError={(err) => {
              setError(err);
              setPhase("error");
            }}
          />
        }
      />
    );
  }

  if (phase === "base-b" && profileB && bId) {
    return (
      <DeliveryWaitFrame
        wait={waitFlow}
        liveProgressStage={waitProgress.liveProgressStage}
        completedArtifacts={waitProgress.completedArtifacts}
        includeTranslateArtifact={includeTranslate}
        hiddenWork={
          <Layer1PrepareWork
            key={`base-b-${basePrepKey}`}
            profileId={bId}
            locale={locale}
            preWork={async () => {
              await ensureProfileMatrixList({
                profileId: bId,
                userProfile: profileB.user_profile,
                locale,
              });
            }}
            onComplete={() => {
              waitProgress.reset();
              void afterBaseBComplete();
            }}
            onError={(err) => {
              setError(err);
              setPhase("error");
            }}
          />
        }
      />
    );
  }

  if (phase === "base-cache" && profileA) {
    return <DeliveryWaitFrame wait={waitFlow} isReturningUser />;
  }

  if (phase === "init") {
    return null;
  }

  if (error || phase === "error") {
    return (
      <main className="match-analyzing match-analyzing--error">
        <div className="match-analyzing-error-icon" aria-hidden>
          ✕
        </div>
        <h2>{t("error_title")}</h2>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSkipBaziAtDelivery(false);
            setBasePrepKey((k) => k + 1);
            startedRef.current = false;
            void beginPipeline();
          }}
          className="match-primary-btn"
        >
          {tChart("retry")}
        </button>
        <button type="button" onClick={() => router.push("/match")} className="match-relationship-back">
          {t("go_back")}
        </button>
      </main>
    );
  }

  return (
    <DeliveryWaitFrame
      wait={waitFlow}
      isReturningUser={isReturningUser}
      error={error}
      onRefund={() => router.push("/match")}
    />
  );
}
