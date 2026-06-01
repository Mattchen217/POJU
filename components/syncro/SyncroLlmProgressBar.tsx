"use client";

import { useTranslations } from "next-intl";

import type { SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";

type Props = {
  progress: SyncroLlmProgress;
};

export function SyncroLlmProgressBar({ progress }: Props) {
  const t = useTranslations("syncro.llm_progress");

  if (progress.context_missing) {
    return (
      <div
        className="syncro-llm-progress fixed left-0 right-0 top-0 z-50 border-b border-red-400/30 bg-bg-deep/95 px-4 py-2 text-center text-xs text-red-200/90 backdrop-blur-sm"
        role="alert"
      >
        <p>{t("context_missing")}</p>
      </div>
    );
  }

  const attempted = progress.completed + progress.failed;
  if (!progress.running && attempted >= progress.total) {
    if (progress.failed === 0 && progress.completed >= progress.total) {
      return (
        <div
          className="syncro-llm-progress fixed left-0 right-0 top-0 z-50 border-b border-cyan-400/20 bg-bg-deep/95 px-4 py-2 text-center text-xs text-cyan-100/90 backdrop-blur-sm"
          role="status"
        >
          <p>{t("complete")}</p>
        </div>
      );
    }
    if (progress.completed === 0 && progress.failed >= progress.total) {
      return (
        <div
          className="syncro-llm-progress fixed left-0 right-0 top-0 z-50 border-b border-red-400/30 bg-bg-deep/95 px-4 py-2 text-center text-xs text-red-200/90 backdrop-blur-sm"
          role="alert"
        >
          <p>{t("all_failed")}</p>
        </div>
      );
    }
    return null;
  }

  const done = progress.completed;
  const label = t("in_progress", {
    done: progress.running ? Math.min(done + 1, progress.total) : done,
    total: progress.total,
  });

  return (
    <div
      className="syncro-llm-progress fixed left-0 right-0 top-0 z-50 border-b border-cyan-400/20 bg-bg-deep/95 px-4 py-2 text-center text-xs text-cyan-100/90 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <p>{label}</p>
      {progress.failed > 0 ? (
        <p className="mt-0.5 text-[11px] text-text-dim">{t("some_failed", { count: progress.failed })}</p>
      ) : null}
    </div>
  );
}
