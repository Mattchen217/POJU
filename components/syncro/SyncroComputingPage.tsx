"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { saveSyncroToArchive } from "@/lib/archive/archive-service";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import { getCurrentHourPeriodInTimezone } from "@/lib/syncro/types";
import { createSyncroSession } from "@/lib/syncro/syncro-session";
import { recordUsage } from "@/lib/syncro/device-usage";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
import { readFetchJson } from "@/lib/client/fetch-json";
import { parseSyncroStoredLocation } from "@/lib/syncro/syncro-location-storage";
import { saveSyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import type { MatrixCell } from "@/lib/syncro/calculate-matrix";
import {
  formatSyncroComputeError,
  type SyncroComputeErrorView,
} from "@/components/syncro/syncro-compute-errors";

export function SyncroComputingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("syncro.computing");

  const [step, setStep] = useState(0);
  const [error, setError] = useState<SyncroComputeErrorView | null>(null);
  const startedRef = useRef(false);

  const steps = [
    t("step_1"),
    t("step_2"),
    t("step_3"),
    t("step_4"),
    t("step_5"),
    t("step_6"),
  ];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void compute();
  }, []);

  async function compute() {
    try {
      const profileId = sessionStorage.getItem("syncro_profile_id");
      const task = sessionStorage.getItem("syncro_task_pending");
      const locationStr = sessionStorage.getItem("syncro_location");
      const sessionType = sessionStorage.getItem("syncro_session_type") || "paid";

      if (!profileId || !task || !locationStr) {
        throw new Error(t("missing_data"));
      }

      const location = parseSyncroStoredLocation(locationStr);
      if (!location) {
        throw new Error(t("missing_data"));
      }
      const profileRow = await getStoredProfile(profileId);
      if (!profileRow?.user_profile || profileRow.base_analysis?.content == null) {
        throw new Error(t("profile_not_ready"));
      }

      const response = await fetch("/api/syncro/compute_local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          task_description: task,
          user_location: {
            latitude: location.lat,
            longitude: location.lng,
            timezone: location.timezone,
          },
          locale,
          user_profile: profileRow.user_profile,
          base_analysis: profileRow.base_analysis.content,
        }),
      });

      const data = await readFetchJson<{
        success?: boolean;
        matrix?: unknown;
        local_matrix?: Record<string, MatrixCell>;
        compute_started_at?: string;
        true_solar_meta?: import("@/lib/syncro/calculate-matrix").SyncroMatrixMetadata;
        meta?: { cost_usd?: number; model?: string; tokens_used?: number; latency_ms?: number };
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(data.message || data.error || t("compute_failed"));
      }

      if (!data.success || !data.matrix || !data.local_matrix) {
        throw new Error(data.message || data.error || t("compute_failed"));
      }

      const llmMeta = data.meta ?? {};
      const timezone = location.timezone;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const matrix = data.matrix as import("@/lib/syncro/types").SyncroMatrix;

      const sessionId = await createSyncroSession({
        profile_id: profileId,
        task_description: task,
        user_location: {
          latitude: location.lat,
          longitude: location.lng,
          timezone,
        },
        matrix,
        locale,
        is_free: sessionType === "free",
        cost_usd: llmMeta.cost_usd ?? 0,
        llm_meta: {
          model: llmMeta.model ?? "local",
          tokens_used: llmMeta.tokens_used ?? 0,
          latency_ms: llmMeta.latency_ms ?? 0,
        },
      });

      const llmCtx = {
        profile_id: profileId,
        task_description: task,
        user_location: {
          latitude: location.lat,
          longitude: location.lng,
          timezone,
        },
        locale,
        user_profile: profileRow.user_profile,
        base_analysis: profileRow.base_analysis.content,
        local_matrix: data.local_matrix,
        compute_started_at: data.compute_started_at ?? new Date().toISOString(),
        true_solar: data.true_solar_meta,
      };

      saveSyncroLlmContext(sessionId, llmCtx);

      await recordUsage("syncro", sessionType === "free", llmMeta.cost_usd ?? 0);
      await recordProfileUsage(profileId, "syncro");

      try {
        await saveSyncroToArchive({
          syncro_session_id: sessionId,
          profile_id: profileId,
          task_description: task,
          matrix,
          expires_at: expiresAt,
          locale,
        });
      } catch (e) {
        console.error("[syncro/computing] Archive save failed:", e);
      }

      const submission_anchor = getCurrentHourPeriodInTimezone(timezone);
      const hour_order = sortedHourPeriodsFromLive(submission_anchor);

      try {
        sessionStorage.setItem("syncro_last_session_id", sessionId);
      } catch {
        // ignore
      }

      void fetch("/api/syncro/inngest_start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          submission_anchor,
          priority_hour: submission_anchor,
          hour_order,
          llm_context: llmCtx,
          device_id: getPojuDeviceId(),
        }),
      }).catch((e) => {
        console.warn("[syncro/computing] inngest_start failed:", e);
      });

      sessionStorage.removeItem("syncro_task_pending");
      sessionStorage.removeItem("syncro_session_type");
      sessionStorage.removeItem("syncro_profile_id");
      sessionStorage.removeItem("syncro_location");

      router.push(`/syncro/result/${sessionId}`);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error("[syncro/computing]", e);
      setError(formatSyncroComputeError(raw, t));
    }
  }

  if (error) {
    return (
      <main className="syncro-computing error flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center text-text-body">
        <div className="error-icon text-4xl text-red-300/90" aria-hidden>
          ✕
        </div>
        <h2 className="mt-6 text-xl font-semibold text-text-primary">{error.title}</h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-text-secondary">{error.message}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            startedRef.current = false;
            void compute();
          }}
          className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-6 px-8 py-3 text-sm font-semibold"
        >
          {t("retry")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/syncro")}
          className="mt-4 text-sm text-cyan-200 underline underline-offset-4"
        >
          {t("go_back")}
        </button>
      </main>
    );
  }

  return (
    <main className="syncro-computing flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center text-text-body">
      <div
        className="computing-spinner-large h-14 w-14 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-300"
        aria-hidden
      />

      <p key={step} className="computing-step mt-8 max-w-sm text-[15px] leading-8 text-text-secondary">
        {steps[step]}
      </p>

      <p className="computing-hint mt-4 max-w-xs text-sm text-text-dim">{t("hint_local")}</p>
    </main>
  );
}
