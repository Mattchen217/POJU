"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { Layer1PrepareWork } from "@/components/poju/Layer1PrepareWork";
import { useWorkspaceMatchPrepare } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { saveMatchToArchive } from "@/lib/archive/archive-service";
import { registerPendingDeliveryArchive } from "@/lib/archive/archive-delivery-pending";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { createMatchSession, loadMatchSession } from "@/lib/match/match-session";
import {
  clearMatchPreviewSession,
  loadMatchPreviewSession,
} from "@/lib/match/match-preview-session";
import { wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import type { MatchReport } from "@/lib/match/types";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { readFetchJson } from "@/lib/client/fetch-json";
import { ensureProfileMatrixList } from "@/lib/poju/resolve-matrix-preview";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";
import { recordUsage } from "@/lib/syncro/device-usage";

type GenPhase = "init" | "base-a" | "base-b" | "analyzing" | "error";

/**
 * Stage 4 — center uses original Match wait (matchdongxiao);
 * A/B base reports release to the rail after stream (or forced 10s for cached).
 */
export function WorkspaceMatchGeneratingStage() {
  const locale = useLocale();
  const t = useTranslations("match.analyzing");
  const match = useWorkspaceMatchPrepare();
  const [phase, setPhase] = useState<GenPhase>("init");
  const [error, setError] = useState<string | null>(null);
  const [profileA, setProfileA] = useState<StoredProfileData | null>(null);
  const [profileB, setProfileB] = useState<StoredProfileData | null>(null);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [basePrepKey, setBasePrepKey] = useState(0);
  const [baziComplete, setBaziComplete] = useState(false);
  const [productComplete, setProductComplete] = useState(false);
  const [bothBasesCached, setBothBasesCached] = useState(false);
  const startedRef = useRef(false);
  const analyzeStartedRef = useRef(false);
  const slotStartedAtRef = useRef({ a: 0, b: 0 });

  const {
    profileIdA,
    profileIdB,
    relationship,
    reportAStatus,
    reportBStatus,
    setPhase: setMatchPhase,
    setReportAStatus,
    setReportBStatus,
    setMatchReportStatus,
    setReportAText,
    setReportBText,
    setMatchSession,
    setError: setMatchError,
  } = match;

  const waitFlow = useDeliveryWaitPhase({
    product: "match",
    skipBazi: true,
    isReturningUser: bothBasesCached,
    baziComplete,
    productComplete,
    enabled: phase !== "error" && phase !== "init",
  });

  const applyRailReady = useCallback(
    (slot: "a" | "b") => {
      if (slot === "a") {
        setReportAText(null);
        setReportAStatus("ready");
      } else {
        setReportBText(null);
        setReportBStatus("ready");
      }
    },
    [setReportAStatus, setReportAText, setReportBStatus, setReportBText],
  );

  /** Cached Layer-1: hold the rail anim ≥ 10s then mark ready (no report paper). */
  const releaseRailReady = useCallback(
    async (slot: "a" | "b", wasCached: boolean) => {
      if (wasCached) {
        const started = slotStartedAtRef.current[slot] || Date.now();
        await waitRemainingMinSpline(started, PREPARING_MIN_SPLINE_CACHE_MS);
      }
      applyRailReady(slot);
    },
    [applyRailReady],
  );

  const runAnalyze = useCallback(async () => {
    try {
      setMatchReportStatus("generating");
      const q =
        relationship.trim() ||
        sessionStorage.getItem("match_relationship")?.trim() ||
        loadMatchPreviewSession()?.pending_question?.trim() ||
        "";

      if (!aId || !bId || !q) {
        throw new Error(t("missing_data"));
      }

      const [aRow, bRow] = await Promise.all([getStoredProfile(aId), getStoredProfile(bId)]);
      if (!aRow?.user_profile || !hasBaseAnalysisPayload(normalizeBaseAnalysisInput(aRow.base_analysis))) {
        throw new Error(t("profile_a_not_ready"));
      }
      if (!bRow?.user_profile || !hasBaseAnalysisPayload(normalizeBaseAnalysisInput(bRow.base_analysis))) {
        throw new Error(t("profile_b_not_ready"));
      }

      applyRailReady("a");
      applyRailReady("b");

      const matrix = calculateCompatibilityMatrix({
        profileA: wrapProfileForMatrix(aRow.user_profile, aRow.base_analysis),
        profileB: wrapProfileForMatrix(bRow.user_profile, bRow.base_analysis),
      });

      const response = await fetch("/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: q,
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
        meta?: { cost_usd?: number; resonance_index?: number };
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
      const matchId = await createMatchSession({
        a_profile_id: aId,
        b_profile_id: bId,
        relationship_description: q,
        report: data.report,
        is_free: false,
        cost_usd: costUsd,
        locale,
        resonance_index: data.meta?.resonance_index ?? matrix.resonance_index,
        engine_version: "v5.1",
      });

      await recordUsage("match", false, costUsd);

      try {
        const archiveId = await saveMatchToArchive({
          match_id: matchId,
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: q,
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
        console.error("[workspace-match] Archive save failed:", e);
      }

      const session = await loadMatchSession(matchId);
      if (!session) throw new Error(t("analysis_failed"));

      clearMatchPreviewSession();
      setMatchSession(session);
      setMatchReportStatus("ready");
      setProductComplete(true);
      setMatchPhase("delivery");
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e ?? "");
      const looksLikeGatewayOrParse =
        /non_json_response|invalid_json_response|empty_response|unexpected token|not valid json|an error occurred/i.test(
          raw,
        );
      const message = looksLikeGatewayOrParse
        ? t("error_timeout")
        : raw || t("analysis_failed");
      setError(message);
      setMatchError(message);
      setMatchReportStatus("error");
      setPhase("error");
    }
  }, [
    aId,
    applyRailReady,
    bId,
    locale,
    relationship,
    setMatchError,
    setMatchPhase,
    setMatchReportStatus,
    setMatchSession,
    t,
  ]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const storedA = profileIdA ?? sessionStorage.getItem("match_a_profile_id");
      const storedB = profileIdB ?? sessionStorage.getItem("match_b_profile_id");
      if (!storedA || !storedB) {
        setError(t("missing_data"));
        setPhase("error");
        return;
      }
      setAId(storedA);
      setBId(storedB);
      setReportAStatus("generating");
      setReportBStatus("generating");
      setMatchReportStatus("generating");
      const now = Date.now();
      slotStartedAtRef.current = { a: now, b: now };

      const [aRow, bRow] = await Promise.all([getStoredProfile(storedA), getStoredProfile(storedB)]);
      if (!aRow?.user_profile || !bRow?.user_profile) {
        setError(t("missing_data"));
        setPhase("error");
        return;
      }
      setProfileA(aRow);
      setProfileB(bRow);

      const [cachedA, cachedB] = await Promise.all([
        getCachedBaseAnalysis(storedA),
        getCachedBaseAnalysis(storedB),
      ]);

      const bothCached = Boolean(cachedA) && Boolean(cachedB);
      setBothBasesCached(bothCached);

      if (bothCached) {
        setBaziComplete(true);
        setPhase("analyzing");
        void (async () => {
          await Promise.all([releaseRailReady("a", true), releaseRailReady("b", true)]);
        })();
        return;
      }

      if (!cachedA) {
        setPhase("base-a");
        setBasePrepKey((k) => k + 1);
        return;
      }

      void releaseRailReady("a", true);
      setPhase("base-b");
      setBasePrepKey((k) => k + 1);
    })();
  }, [
    profileIdA,
    profileIdB,
    releaseRailReady,
    setMatchReportStatus,
    setReportAStatus,
    setReportBStatus,
    t,
  ]);

  // Start Match product analyze once both rail reports are ready.
  useEffect(() => {
    if (phase !== "analyzing") return;
    if (analyzeStartedRef.current) return;
    if (reportAStatus !== "ready" || reportBStatus !== "ready") return;
    analyzeStartedRef.current = true;
    setBaziComplete(true);
    void runAnalyze();
  }, [phase, reportAStatus, reportBStatus, runAnalyze]);

  if (phase === "error") {
    return (
      <div className="workspace-match-generating workspace-match-generating--error" role="alert">
        <p>{error ?? t("analysis_failed")}</p>
        <button type="button" className="btn-secondary" onClick={() => setMatchPhase("inquiry")}>
          {t("go_back")}
        </button>
      </div>
    );
  }

  if (phase === "init") {
    return (
      <div className="workspace-match-generating" aria-busy="true">
        <span className="sr-only">{t("hint")}</span>
      </div>
    );
  }

  return (
    <div className="workspace-match-generating" aria-busy="true">
      <div className="workspace-match-generating__wait">
        <DeliveryWaitFrame wait={waitFlow} isReturningUser={bothBasesCached} showBreath={false} />
        <p className="workspace-match-generating__hint">{t("hint")}</p>
      </div>

      {phase === "base-a" && profileA && aId ? (
        <div className="sr-only" aria-hidden>
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
            onComplete={async () => {
              await releaseRailReady("a", false);
              const refreshed = await getStoredProfile(aId);
              if (refreshed) setProfileA(refreshed);
              const cachedB = await getCachedBaseAnalysis(bId);
              if (!cachedB) {
                setPhase("base-b");
                setBasePrepKey((k) => k + 1);
                return;
              }
              void releaseRailReady("b", true);
              setBothBasesCached(false);
              setPhase("analyzing");
            }}
            onError={(err) => {
              setError(err);
              setPhase("error");
            }}
          />
        </div>
      ) : null}

      {phase === "base-b" && profileB && bId ? (
        <div className="sr-only" aria-hidden>
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
            onComplete={async () => {
              await releaseRailReady("b", false);
              const refreshed = await getStoredProfile(bId);
              if (refreshed) setProfileB(refreshed);
              setPhase("analyzing");
            }}
            onError={(err) => {
              setError(err);
              setPhase("error");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
