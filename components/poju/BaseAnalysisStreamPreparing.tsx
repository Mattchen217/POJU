"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { StreamingAnalysisView } from "@/components/poju/StreamingAnalysisView";
import { usePreparingSplineControl } from "@/components/poju/preparing-spline-control";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import {
  appLocaleToOutputLanguage,
} from "@/lib/base-analysis/resolve-output-language";
import { useStreamingAnalysis } from "@/lib/base-analysis/useStreamingAnalysis";
import type { ProgressPayload } from "@/lib/base-analysis/progress-stages";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { parseAppLocale } from "@/lib/prompts/language-directive";
import {
  saveBaseAnalysisFromStream,
  saveCoreJudgmentsForProfile,
} from "@/lib/profile/stored-profiles-service";
import { isCoreJudgments } from "@/lib/base-analysis/core-judgments";

export type BaseAnalysisStreamPreparingProps = {
  profile: StoredProfileData;
  profileId: string;
  locale: string;
  /** Console label, e.g. SyncroPreparing */
  logLabel: string;
  onComplete: (displayText: string, meta?: Record<string, unknown>) => void | Promise<void>;
  onError?: (error: string) => void;
  /** Wait-UI progress stage updates from SSE. */
  onProgress?: (payload: ProgressPayload) => void;
  resumeJobId?: string;
  /** `replay` skips SSE (handled by overlay); default `live` consumes stream. */
  mode?: "replay" | "live";
  /** When true, parent shows ChartReadingLoader only (no inline stream view). */
  hideStreamView?: boolean;
  /** Runs before base-analysis stream (e.g. matrix_list generation + save). */
  preStreamWork?: () => Promise<void>;
  /** Base-analysis report follows UI locale, not browser / user input. */
  reportOutputLanguageFromUi?: boolean;
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
  onProgress,
  resumeJobId,
  mode = "live",
  hideStreamView = false,
  preStreamWork,
  reportOutputLanguageFromUi = false,
}: BaseAnalysisStreamPreparingProps) {
  const tChart = useTranslations("chart_loader");
  const splineControl = usePreparingSplineControl();
  const localData = useMemo(() => {
    const uiLang = reportOutputLanguageFromUi
      ? appLocaleToOutputLanguage(parseAppLocale(locale))
      : undefined;
    return buildStreamLocalDataFromProfile(profile.user_profile, {
      output_language: uiLang,
    });
  }, [profile.user_profile, locale, reportOutputLanguageFromUi]);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onProgressRef = useRef(onProgress);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  onProgressRef.current = onProgress;

  useEffect(() => {
    console.group(`[${logLabel}] Local computation result`);
    console.log("Profile ID:", profileId);
    console.log("Structured:", localData.structured);
    console.log("Output language:", localData.output_language);
    console.log("URL locale (routing):", locale);
    console.log("Report follows UI locale:", reportOutputLanguageFromUi);
    console.groupEnd();
  }, [profileId, localData, locale, logLabel, reportOutputLanguageFromUi]);

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
        console.warn("[fallback] base-analysis save failed — Layer-1 judgments already attempted", {
          profile_id: profileId,
          reason: msg,
        });
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
    onProgress: (payload) => {
      onProgressRef.current?.(payload);
    },
    onCoreJudgments: (judgments) => {
      if (!isCoreJudgments(judgments)) return;
      void saveCoreJudgmentsForProfile({
        profile_id: profileId,
        structured: localData.structured,
        locale,
        core_judgments: judgments,
      }).catch((e) => {
        console.warn("[fallback] early saveCoreJudgmentsForProfile failed", e);
      });
    },
    onError: (error) => {
      console.error(`[${logLabel}] stream error:`, error);
      console.warn("[fallback] base-analysis stream failed — persisting Layer-1 judgments only", {
        profile_id: profileId,
        reason: error,
      });
      void saveCoreJudgmentsForProfile({
        profile_id: profileId,
        structured: localData.structured,
        locale,
      }).catch((e) => {
        console.warn("[fallback] saveCoreJudgmentsForProfile failed", e);
      });
      onErrorRef.current?.(error);
    },
  });

  const preStreamWorkRef = useRef(preStreamWork);
  preStreamWorkRef.current = preStreamWork;

  useEffect(() => {
    if (mode === "replay") return;
    let alive = true;
    void (async () => {
      try {
        if (preStreamWorkRef.current) {
          await preStreamWorkRef.current();
        }
        if (!alive) return;
        await start();
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[${logLabel}] preStreamWork failed:`, e);
        onErrorRef.current?.(msg);
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [start, stop, mode, logLabel]);

  const displayError = state.error ? formatStreamError(state.error, tChart) : null;

  return (
    <div className={hideStreamView ? "base-analysis-stream-preparing base-analysis-stream-preparing--hidden" : "preparing-page base-analysis-stream-preparing"}>
      {!hideStreamView ? (
        <StreamingAnalysisView
          content={state.content}
          status={state.status}
          bytes_received={state.bytes_received}
          thinkingOnly
        />
      ) : null}

      {!hideStreamView && state.status === "failed" && displayError ? (
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
