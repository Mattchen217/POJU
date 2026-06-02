"use client";

import { useTranslations } from "next-intl";

import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";

import "@/styles/syncro-background-stream.css";

type Props = {
  progress: SyncroLlmProgress;
};

/** Shown on compass while Inngest batches run — user can leave the app. */
export function SyncroCloudProgressPanel({ progress }: Props) {
  const t = useTranslations("syncro.background_stream");

  if (!progress.running || progress.completed >= progress.total) return null;

  const step = Math.min(progress.completed + 1, progress.total);

  return (
    <section className="syncro-bg-stream syncro-bg-stream--cloud" aria-label={t("aria_label")}>
      <div className="syncro-bg-stream__body" style={{ paddingTop: 12 }}>
        <p className="syncro-bg-stream__toggle-title" style={{ margin: 0 }}>
          {t("title_cloud", { done: progress.completed, total: progress.total, step })}
        </p>
        <p className="syncro-bg-stream__footnote" style={{ marginTop: 8 }}>
          {t("footnote_cloud")}
        </p>
        {progress.failed > 0 ? (
          <p className="syncro-bg-stream__error" style={{ marginTop: 8 }}>
            {t("cloud_failed", { count: progress.failed })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
