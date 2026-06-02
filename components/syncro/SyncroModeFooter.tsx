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
  hint?: ReactNode;
  extra?: ReactNode;
};

/** Advice +「为何此时」— spacing matches AR (fig 1). */
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
    <>
      {cell ? (
        <div className="syncro-mode-advice">
          {hint}
          <SyncroCellAdvice cell={cell} llmMeta={llmMeta} className="compass-short-advice" />
        </div>
      ) : hint ? (
        <div className="syncro-mode-advice">{hint}</div>
      ) : null}

      <div className="syncro-mode-why">
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

      {extra ? <div className="syncro-mode-extra">{extra}</div> : null}
    </>
  );
}
