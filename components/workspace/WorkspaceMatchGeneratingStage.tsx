"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MatchAnalyzingOrbsLoop } from "@/components/match/MatchAnalyzingOrbsLoop";
import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { useWorkspaceMatchPrepare } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
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
import { ensureProfileMatrixList } from "@/lib/poju/resolve-matrix-preview";
import { recordUsage } from "@/lib/syncro/device-usage";

type GenPhase = "init" | "base-a" | "base-b" | "analyzing" | "error";

/** Stage 4 — dual base reports in rail + Match wait in center, then Stage 5 delivery. */
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
  const startedRef = useRef(false);
  const analyzeStartedRef = useRef(false);

  const {
    profileIdA,
    profileIdB,
    relationship,
    setPhase: setMatchPhase,
    setReportAStatus,
    setReportBStatus,
    setMatchReportStatus,
    setReportAText,
    setReportBText,
    setMatchSession,
    setError: setMatchError,
  } = match;

  const applyRailText = useCallback(
    (slot: "a" | "b", text: string | null) => {
      if (slot === "a") {
        setReportAText(text);
        setReportAStatus(text ? "ready" : "generating");
      } else {
        setReportBText(text);
        setReportBStatus(text ? "ready" : "generating");
      }
    },
    [setReportAStatus, setReportAText, setReportBStatus, setReportBText],
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

      applyRailText("a", markedTextFromStoredBaseAnalysis(aRow.base_analysis));
      applyRailText("b", markedTextFromStoredBaseAnalysis(bRow.base_analysis));

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

      const data = (await response.json()) as {
        success?: boolean;
        report?: MatchReport;
        meta?: { cost_usd?: number; resonance_index?: number };
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.report) {
        throw new Error(data.message || data.error || t("analysis_failed"));
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
      setMatchPhase("delivery");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setMatchError(message);
      setMatchReportStatus("error");
      setPhase("error");
    }
  }, [
    aId,
    applyRailText,
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

      if (cachedA?.reportText) applyRailText("a", cachedA.reportText);
      if (cachedB?.reportText) applyRailText("b", cachedB.reportText);

      if (!cachedA) {
        setPhase("base-a");
        setBasePrepKey((k) => k + 1);
        return;
      }
      if (!cachedB) {
        setPhase("base-b");
        setBasePrepKey((k) => k + 1);
        return;
      }
      setPhase("analyzing");
    })();
  }, [
    applyRailText,
    profileIdA,
    profileIdB,
    setMatchReportStatus,
    setReportAStatus,
    setReportBStatus,
    t,
  ]);

  useEffect(() => {
    if (phase !== "analyzing") return;
    if (analyzeStartedRef.current) return;
    analyzeStartedRef.current = true;
    void runAnalyze();
  }, [phase, runAnalyze]);

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

  return (
    <div className="workspace-match-generating" aria-busy="true">
      <div className="workspace-match-generating__wait">
        <MatchAnalyzingOrbsLoop />
        <p className="workspace-match-generating__hint">{t("hint")}</p>
      </div>

      {phase === "base-a" && profileA && aId ? (
        <div className="sr-only" aria-hidden>
          <BaseAnalysisStreamPreparing
            key={`base-a-${basePrepKey}`}
            profile={profileA}
            profileId={aId}
            locale={locale}
            logLabel="WorkspaceMatchBaseA"
            hideStreamView
            reportOutputLanguageFromUi
            preStreamWork={async () => {
              await ensureProfileMatrixList({
                profileId: aId,
                userProfile: profileA.user_profile,
                locale,
              });
            }}
            onComplete={async (displayText) => {
              applyRailText("a", displayText);
              const refreshed = await getStoredProfile(aId);
              if (refreshed) setProfileA(refreshed);
              const cachedB = await getCachedBaseAnalysis(bId);
              if (!cachedB) {
                setPhase("base-b");
                setBasePrepKey((k) => k + 1);
                return;
              }
              applyRailText("b", cachedB.reportText);
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
          <BaseAnalysisStreamPreparing
            key={`base-b-${basePrepKey}`}
            profile={profileB}
            profileId={bId}
            locale={locale}
            logLabel="WorkspaceMatchBaseB"
            hideStreamView
            reportOutputLanguageFromUi
            preStreamWork={async () => {
              await ensureProfileMatrixList({
                profileId: bId,
                userProfile: profileB.user_profile,
                locale,
              });
            }}
            onComplete={async (displayText) => {
              applyRailText("b", displayText);
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
