"use client";

import { useTranslations } from "next-intl";

const fallbackStepKeys = ["thinking_step_1", "thinking_step_2", "thinking_step_3"] as const;

export type ThinkingProcessDetailsProps = {
  thinkingProcess?: string | null;
  /** Shown while waiting for the model (no reasoning yet). */
  waitingLabel?: string | null;
  open?: boolean;
  pulseIcon?: boolean;
  className?: string;
};

export function ThinkingProcessDetails({
  thinkingProcess,
  waitingLabel,
  open,
  pulseIcon = false,
  className = "",
}: ThinkingProcessDetailsProps) {
  const t = useTranslations("poju.chat");
  const body = thinkingProcess?.trim();
  const hasDeepSeek = Boolean(body);

  return (
    <details
      open={open}
      className={`w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md ${className}`}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-on-surface-variant">
        <span
          className={`material-symbols-outlined text-primary text-[18px] ${pulseIcon ? "animate-pulse" : ""}`}
        >
          psychology
        </span>
        <span>{t("thinking_process_title")}</span>
        <span className="material-symbols-outlined ml-auto text-[18px]">keyboard_arrow_down</span>
      </summary>
      <div className="border-t border-white/10 bg-black/20 px-4 pb-4 pt-2 text-sm text-on-surface-variant">
        {hasDeepSeek ? (
          <p className="max-h-[min(24rem,50vh)] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">
            {body}
          </p>
        ) : waitingLabel ? (
          <p className="text-xs leading-relaxed text-on-surface-variant/90">{waitingLabel}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-xs">
            {fallbackStepKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
