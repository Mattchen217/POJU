"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { reasoningToLiveLine } from "@/lib/llm/thinking-live-line";

const fallbackStepKeys = ["thinking_step_1", "thinking_step_2", "thinking_step_3"] as const;

export type ThinkingProcessDetailsProps = {
  thinkingProcess?: string | null;
  /** Latest line while streaming (single-line ticker). */
  liveLine?: string | null;
  /** Shown while waiting for the model (no reasoning yet). */
  waitingLabel?: string | null;
  open?: boolean;
  pulseIcon?: boolean;
  className?: string;
};

export function ThinkingProcessDetails({
  thinkingProcess,
  liveLine,
  waitingLabel,
  open,
  pulseIcon = false,
  className = "",
}: ThinkingProcessDetailsProps) {
  const t = useTranslations("poju.chat");
  const lineRef = useRef<HTMLParagraphElement>(null);
  const body = thinkingProcess?.trim();
  const hasDeepSeek = Boolean(body);
  const displayLine =
    liveLine?.trim() ||
    (hasDeepSeek ? reasoningToLiveLine(body!) : "") ||
    (waitingLabel?.trim() ?? "");

  useEffect(() => {
    if (lineRef.current && displayLine) {
      lineRef.current.scrollLeft = lineRef.current.scrollWidth;
    }
  }, [displayLine]);

  return (
    <details
      open={open}
      className={`w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md ${className}`}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[0.9375rem] leading-6 text-on-surface-variant">
        <span
          className={`material-symbols-outlined text-primary text-[18px] ${pulseIcon && !displayLine ? "animate-pulse" : ""}`}
        >
          psychology
        </span>
        <span>{t("thinking_process_title")}</span>
        <span className="material-symbols-outlined ml-auto text-[18px]">keyboard_arrow_down</span>
      </summary>
      <div className="border-t border-white/10 bg-black/20 px-4 pb-4 pt-2 text-[1rem] leading-7 text-on-surface-variant">
        {displayLine ? (
          <div className="space-y-2">
            <p
              ref={lineRef}
              className="overflow-x-auto whitespace-nowrap font-mono text-[0.875rem] leading-relaxed text-cyan-100/95 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-live="polite"
            >
              <span className="inline-block min-w-full animate-pulse">{displayLine}</span>
            </p>
            {hasDeepSeek && body !== displayLine ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-on-surface-variant/80">{t("thinking_process_full")}</summary>
                <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-on-surface-variant/90">
                  {body}
                </p>
              </details>
            ) : null}
          </div>
        ) : waitingLabel ? (
          <p className="text-[0.9375rem] leading-relaxed text-on-surface-variant/90">{waitingLabel}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-[0.9375rem] leading-relaxed">
            {fallbackStepKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
