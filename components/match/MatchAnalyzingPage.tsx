"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MatchAnalyzingLoader } from "@/components/match/MatchAnalyzingLoader";
import { useRouter } from "@/i18n/navigation";
import { saveMatchToArchive } from "@/lib/archive/archive-service";
import { createMatchSession } from "@/lib/match/match-session";
import type { MatchReport } from "@/lib/match/types";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { recordUsage } from "@/lib/syncro/device-usage";

import "@/styles/match.css";

const STEP_INTERVAL_MS = 3500;

export function MatchAnalyzingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("match.analyzing");

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const steps = useMemo(
    () => [
      t("step_1"),
      t("step_2"),
      t("step_3"),
      t("step_4"),
      t("step_5"),
      t("step_6"),
      t("step_7"),
    ],
    [t],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void analyze();
  }, []);

  async function analyze() {
    try {
      const aId = sessionStorage.getItem("match_a_profile_id");
      const bId = sessionStorage.getItem("match_b_profile_id");
      const relationship = sessionStorage.getItem("match_relationship");
      const sessionType = sessionStorage.getItem("match_session_type") || "paid";

      if (!aId || !bId || !relationship) {
        throw new Error(t("missing_data"));
      }

      const [aRow, bRow] = await Promise.all([getStoredProfile(aId), getStoredProfile(bId)]);

      if (!aRow?.user_profile || aRow.base_analysis?.content == null) {
        throw new Error(t("profile_a_not_ready"));
      }
      if (!bRow?.user_profile || bRow.base_analysis?.content == null) {
        throw new Error(t("profile_b_not_ready"));
      }

      const response = await fetch("/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: relationship,
          locale,
          a_user_profile: aRow.user_profile,
          a_base_analysis: aRow.base_analysis.content,
          b_user_profile: bRow.user_profile,
          b_base_analysis: bRow.base_analysis.content,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        report?: MatchReport;
        meta?: { cost_usd?: number };
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        if (data.error === "profile_not_ready") {
          throw new Error(t("profile_not_ready"));
        }
        if (data.error === "same_profile") {
          throw new Error(t("same_profile"));
        }
        throw new Error(data.message || data.error || t("analysis_failed"));
      }

      if (!data.report) {
        throw new Error(t("analysis_failed"));
      }

      const costUsd = data.meta?.cost_usd ?? 0;
      const isFree = sessionType === "free";

      const matchId = await createMatchSession({
        a_profile_id: aId,
        b_profile_id: bId,
        relationship_description: relationship,
        report: data.report,
        is_free: isFree,
        cost_usd: isFree ? 0 : costUsd,
        locale,
      });

      await recordUsage("match", isFree, isFree ? 0 : costUsd);

      try {
        await saveMatchToArchive({
          match_id: matchId,
          a_profile_id: aId,
          b_profile_id: bId,
          relationship_description: relationship,
          report: data.report,
          locale,
        });
      } catch (e) {
        console.error("[match/analyzing] Archive save failed:", e);
      }

      sessionStorage.removeItem("match_a_profile_id");
      sessionStorage.removeItem("match_b_profile_id");
      sessionStorage.removeItem("match_relationship");
      sessionStorage.removeItem("match_session_type");

      router.push(`/match/result/${matchId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }

  if (error) {
    return (
      <main className="match-analyzing match-analyzing--error">
        <div className="match-analyzing-error-icon" aria-hidden>
          ✕
        </div>
        <h2>{t("error_title")}</h2>
        <p>{error}</p>
        <button type="button" onClick={() => router.push("/match")} className="match-primary-btn">
          {t("go_back")}
        </button>
      </main>
    );
  }

  return (
    <main className="match-analyzing">
      <MatchAnalyzingLoader step={step} steps={steps} hint={t("hint")} />
    </main>
  );
}
