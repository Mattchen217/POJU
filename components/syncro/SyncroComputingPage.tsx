"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { saveSyncroToArchive } from "@/lib/archive/archive-service";
import { createSyncroSession } from "@/lib/syncro/syncro-session";
import { recordUsage } from "@/lib/syncro/device-usage";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";

export function SyncroComputingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("syncro.computing");

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

      const location = JSON.parse(locationStr) as { lat: number; lng: number };
      const profileRow = await getStoredProfile(profileId);
      if (!profileRow?.user_profile || profileRow.base_analysis?.content == null) {
        throw new Error(t("profile_not_ready"));
      }

      const response = await fetch("/api/syncro/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          task_description: task,
          user_location: {
            latitude: location.lat,
            longitude: location.lng,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          locale,
          user_profile: profileRow.user_profile,
          base_analysis: profileRow.base_analysis.content,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        matrix?: unknown;
        meta?: { cost_usd?: number; model?: string; tokens_used?: number; latency_ms?: number };
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || data.error || t("compute_failed"));
      }

      const llmMeta = data.meta ?? {};
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
          model: llmMeta.model ?? "unknown",
          tokens_used: llmMeta.tokens_used ?? 0,
          latency_ms: llmMeta.latency_ms ?? 0,
        },
      });

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

      sessionStorage.removeItem("syncro_task_pending");
      sessionStorage.removeItem("syncro_session_type");
      sessionStorage.removeItem("syncro_profile_id");
      sessionStorage.removeItem("syncro_location");

      router.push(`/syncro/result/${sessionId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }

  if (error) {
    return (
      <main className="syncro-computing error flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center text-text-body">
        <div className="error-icon text-4xl text-red-300/90" aria-hidden>
          ✕
        </div>
        <h2 className="mt-6 text-xl font-semibold text-text-primary">{t("error_title")}</h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-text-secondary">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/syncro")}
          className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 px-8 py-3 text-sm font-semibold"
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

      <p className="computing-hint mt-4 max-w-xs text-sm text-text-dim">{t("hint")}</p>
    </main>
  );
}
