"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import type { SyncroCombination, SyncroSession } from "@/lib/syncro/types";

type Props = {
  cell: SyncroCombination | undefined;
  llmMeta: SyncroSession["llm_meta"];
  canOpenWhy: boolean;
  onWhyClick: () => void;
  /** Map mode hint above advice. */
  hint?: ReactNode;
  extra?: ReactNode;
};

/** Advice +「为何此时」— shared across compass / AR / map. */
export function SyncroModeFooter({
  cell,
  llmMeta,
  canOpenWhy,
  onWhyClick,
  hint,
  extra,
}: Props) {
  const t = useTranslations("syncro");

  return (
    <div className="compass-footer">
      {hint}
      <SyncroCellAdvice cell={cell} llmMeta={llmMeta} className="compass-short-advice" />
      <div className="compass-bottom-cta">
        <button
          type="button"
          className="why-btn-prominent"
          disabled={!canOpenWhy}
          onClick={() => {
            if (canOpenWhy) onWhyClick();
          }}
        >
          {t("why_this_current")}
        </button>
      </div>
      {extra}
    </div>
  );
}
