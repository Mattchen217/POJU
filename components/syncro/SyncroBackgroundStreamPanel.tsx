"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { SyncroBackgroundStreamState } from "@/lib/syncro/use-syncro-background-stream";

import "@/styles/syncro-background-stream.css";

type Props = {
  stream: SyncroBackgroundStreamState;
  /** Two-line in-flow panel below「为何此时」on compass page. */
  compact?: boolean;
};

export function SyncroBackgroundStreamPanel({ stream, compact = false }: Props) {
  const t = useTranslations("syncro.background_stream");
  const [expanded, setExpanded] = useState(!compact);
  const [cursorVisible, setCursorVisible] = useState(true);

  const { phase, streamText, stepLabel, stepIndex, stepTotal, error, running, retry } = stream;

  useEffect(() => {
    if (phase !== "writing" && phase !== "reasoning") return;
    const id = window.setInterval(() => setCursorVisible((v) => !v), 500);
    return () => window.clearInterval(id);
  }, [phase]);

  if (phase === "idle" && !running) return null;
  if (phase === "complete" && !error) return null;

  const showStream =
    streamText.length > 0 || phase === "connecting" || phase === "reasoning" || phase === "writing";

  if (compact) {
    const statusLine = running
      ? t("title_running", { step: stepIndex, total: stepTotal })
      : phase === "error"
        ? t("title_error")
        : t("title_done");

    const bodyText =
      streamText ||
      (phase === "connecting"
        ? t("connecting")
        : phase === "reasoning"
          ? t("reasoning")
          : stepLabel
            ? t("step", { hours: stepLabel })
            : statusLine);

    return (
      <section
        className="syncro-bg-stream syncro-bg-stream--inline syncro-bg-stream--compact"
        aria-label={t("aria_label")}
      >
        <p className="syncro-bg-stream__status-line">{statusLine}</p>
        <div className="syncro-bg-stream__box syncro-bg-stream__box--compact">
          {bodyText}
          {phase === "writing" || phase === "reasoning" ? (
            <span
              className="syncro-bg-stream__cursor"
              style={{ opacity: cursorVisible ? 1 : 0 }}
              aria-hidden
            >
              ▊
            </span>
          ) : null}
        </div>
        {phase === "error" && error ? (
          <button type="button" className="syncro-bg-stream__retry syncro-bg-stream__retry--compact" onClick={retry}>
            {t("retry")}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="syncro-bg-stream" aria-label={t("aria_label")}>
      <button
        type="button"
        className="syncro-bg-stream__toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="syncro-bg-stream__toggle-title">
          {running
            ? t("title_running", { step: stepIndex, total: stepTotal })
            : phase === "error"
              ? t("title_error")
              : t("title_done")}
        </span>
        <span className="syncro-bg-stream__toggle-chevron" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded ? (
        <div className="syncro-bg-stream__body">
          {stepLabel ? (
            <p className="syncro-bg-stream__step">{t("step", { hours: stepLabel })}</p>
          ) : null}

          {phase === "reasoning" ? (
            <p className="syncro-bg-stream__hint">{t("reasoning")}</p>
          ) : null}

          {showStream ? (
            <div className="syncro-bg-stream__box">
              {streamText || (phase === "connecting" ? t("connecting") : "")}
              {phase === "writing" || phase === "reasoning" ? (
                <span
                  className="syncro-bg-stream__cursor"
                  style={{ opacity: cursorVisible ? 1 : 0 }}
                  aria-hidden
                >
                  ▊
                </span>
              ) : null}
            </div>
          ) : null}

          {phase === "error" && error ? (
            <div className="syncro-bg-stream__error">
              <p>{t("failed", { detail: error })}</p>
              <button type="button" className="syncro-bg-stream__retry" onClick={retry}>
                {t("retry")}
              </button>
            </div>
          ) : null}

          <p className="syncro-bg-stream__footnote">{t("footnote")}</p>
        </div>
      ) : null}
    </section>
  );
}
