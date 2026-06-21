"use client";

import { useTranslations } from "next-intl";

export const SYNCRO_TASK_MIN_LEN = 6;
export const SYNCRO_TASK_MAX_LEN = 100;

type Props = {
  task: string;
  onTaskChange: (value: string) => void;
  showMinWarning: boolean;
  id?: string;
};

export function SyncroTaskInputSection({ task, onTaskChange, showMinWarning, id = "syncro-task-input" }: Props) {
  const t = useTranslations("syncro.task");

  const trimmedLen = task.trim().length;
  const canContinue = trimmedLen >= SYNCRO_TASK_MIN_LEN;
  const charsRemaining = Math.max(0, SYNCRO_TASK_MIN_LEN - trimmedLen);

  return (
    <section id={id} className="syncro-prepare-task mt-8 border-t border-white/10 pt-8">
      <h2 className="text-lg font-semibold text-text-primary">{t("title")}</h2>
      <p className="mt-2 text-[15px] leading-7 text-text-secondary">{t("subtitle")}</p>

      <textarea
        value={task}
        onChange={(e) => onTaskChange(e.target.value.slice(0, SYNCRO_TASK_MAX_LEN))}
        placeholder={t("placeholder")}
        rows={5}
        className="mt-4 w-full resize-none rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-[15px] leading-7 text-text-primary placeholder:text-text-dim focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
      />

      <div
        className={`char-count mt-2 text-sm text-text-dim ${showMinWarning && !canContinue ? "syncro-task-char-count--warn" : ""}`}
        role="status"
        aria-live="polite"
      >
        {task.length} / {SYNCRO_TASK_MAX_LEN}
        {trimmedLen < SYNCRO_TASK_MIN_LEN ? (
          <span className="hint text-amber-200/80"> · {t("min_chars", { min: SYNCRO_TASK_MIN_LEN })}</span>
        ) : null}
      </div>
      {showMinWarning && !canContinue ? (
        <p className="mt-2 text-sm font-medium text-amber-200">
          {t("min_chars_remaining", { remaining: charsRemaining })}
        </p>
      ) : null}

      <div className="examples mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">{t("examples_title")}</h4>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-text-secondary">
          <li>· {t("example_1")}</li>
          <li>· {t("example_2")}</li>
          <li>· {t("example_3")}</li>
        </ul>
      </div>
    </section>
  );
}
