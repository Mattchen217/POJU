"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import {
  getSyncroCellDisplayState,
  type SyncroCellDisplayState,
} from "@/lib/syncro/llm-cell-display";
import type { SyncroCombination, SyncroSession } from "@/lib/syncro/types";

type Props = {
  cell: SyncroCombination | undefined;
  llmMeta: SyncroSession["llm_meta"];
  className?: string;
};

export function SyncroCellAdvice({ cell, llmMeta, className = "compass-short-advice" }: Props) {
  const t = useTranslations("syncro");
  const state: SyncroCellDisplayState = getSyncroCellDisplayState(cell, llmMeta);

  if (state === "loading") {
    return (
      <p className={`${className} syncro-advice--loading`} aria-busy="true">
        <IconLoader2 aria-hidden size={16} stroke={1.5} className="syncro-advice-spin" />
        <span>{t("generating")}</span>
      </p>
    );
  }

  if (state === "failed") {
    return (
      <p className={`${className} syncro-advice--failed`} role="alert">
        {t("llm_copy_failed")}
      </p>
    );
  }

  return <p className={className}>{cell!.short_advice}</p>;
}
