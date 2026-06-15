"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { StreamingAnalysisView } from "@/components/poju/StreamingAnalysisView";
import { usePreparingSplineControl } from "@/components/poju/preparing-spline-control";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { useStreamingAnalysis } from "@/lib/base-analysis/useStreamingAnalysis";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  saveBaseAnalysisFromStream,
} from "@/lib/profile/stored-profiles-service";

export type BaseAnalysisStreamPreparingProps = {
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  /** Console label, e.g. SyncroPreparing */
  logLabel: string;
  onComplete: (displayText: string, meta?: Record<string, unknown>) => void | Promise<void>;
  onError?: (error: string) => void;
  resumeJobId?: string;
  /** `replay` skips SSE (handled by overlay); default `live` consumes stream. */
  mode?: "replay" | "live";
};

function formatStreamError(error: string, t: (key: string) => string): string {
  if (error === "NETWORK_LOAD_FAILED" || /load failed|failed to fetch/i.test(error)) {
    return t("error_network");
  }
  if (/timed?\s*out|AbortError/i.test(error)) {
    return t("error_timeout");
  }
  return error;
}

export function BaseAnalysisStreamPreparing({
  profile,
  profileId,
  locale,
  logLabel,
  onComplete,
  onError,
  resumeJobId,
  mode = "live",
}: BaseAnalysisStreamPreparingProps) {
  const tChart = useTranslations("chart_loader");
  const splineControl = usePreparingSplineControl();
  const localData = useMemo(
    () => buildStreamLocalDataFromProfile(profile.user_profile),
    [profile.user_profile],
  );
  const startedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    console.group(`[${logLabel}] Local computation result`);
    console.log("Profile ID:", profileId);
    console.log("Structured:", localData.structured);
    console.log("Output language (user input / browser):", localData.output_language);
    console.log("URL locale (routing only):", locale);
    console.groupEnd();
  }, [profileId, localData, locale, logLabel]);

  const handleComplete = useCallback(
    async (displayText: string, meta: Record<string, unknown> | undefined) => {
      try {
        splineControl?.pauseScene();
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        });
        await saveBaseAnalysisFromStream({
          profile_id: profileId,
          display_text: displayText,
          structured: localData.structured,
          meta: meta ?? {},
          locale,
          generated_at: new Date().toISOString(),
        });
        await onCompleteRef.current(displayText, meta);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[${logLabel}] save failed:`, e);
        onErrorRef.current?.(msg);
      }
    },
    [profileId, locale, logLabel, splineControl, localData.structured],
  );

  const { state, start, stop } = useStreamingAnalysis({
    profile_id: profileId,
    locale,
    local_data: localData,
    resume_job_id: resumeJobId,
    onComplete: handleComplete,
    onError: (error) => {
      console.error(`[${logLabel}] stream error:`, error);
      onErrorRef.current?.(error);
    },
  });

  useEffect(() => {
    if (startedRef.current) return;
    if (mode === "replay") return;
    startedRef.current = true;
    void start();
    return () => stop();
  }, [start, stop, mode]);

  const displayError = state.error ? formatStreamError(state.error, tChart) : null;

  return (
    <div className="preparing-page base-analysis-stream-preparing">
      <StreamingAnalysisView
        content={state.content}
        status={state.status}
        bytes_received={state.bytes_received}
        thinkingOnly
      />

      {state.status === "failed" && displayError ? (
        <div className="chart-loader-content error-view-inline preparing-stream-error">
          <div className="error-icon" aria-hidden>
            ✕
          </div>
          <h3>{tChart("error_title")}</h3>
          <p>{tChart("error_message")}</p>
          <details className="error-details">
            <summary>{tChart("error_details")}</summary>
            <pre>{displayError}</pre>
          </details>
          <div className="error-actions">
            <button type="button" onClick={() => void start()} className="primary">
              {tChart("retry")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
