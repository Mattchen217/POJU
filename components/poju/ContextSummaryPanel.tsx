"use client";

import { useTranslations } from "next-intl";
import type { ContextSummary } from "@/lib/poju/agent-state";

type Props = {
  summary: ContextSummary;
  busy?: boolean;
  onConfirm: () => void;
  onEditRequest?: () => void;
};

export function ContextSummaryPanel({ summary, busy, onConfirm, onEditRequest }: Props) {
  const t = useTranslations("poju.chat");

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-950/25 p-4 text-sm">
      <h3 className="text-base font-semibold text-amber-100">{t("context_summary_title")}</h3>
      <p className="mt-1 text-xs text-on-surface-variant">{t("context_summary_hint")}</p>
      <div className="mt-4 space-y-4">
        {summary.sections.map((sec) => (
          <div key={sec.section_id}>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">{sec.title}</p>
            <ul className="mt-2 space-y-2">
              {sec.items.map((item) => (
                <li key={item.item_id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] text-on-surface-variant">{item.label}</p>
                  <p className="mt-0.5 text-on-surface">{item.value}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={onConfirm}
        >
          {busy ? t("context_summary_confirming") : t("context_summary_confirm")}
        </button>
        {onEditRequest ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-on-surface-variant disabled:opacity-50"
            onClick={onEditRequest}
          >
            {t("context_summary_edit_chat")}
          </button>
        ) : null}
      </div>
    </div>
  );
}