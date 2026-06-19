"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { GlossaryText } from "@/components/cross-product/GlossaryText";

import {
  getSyncroCellDisplayState,
  type SyncroCellDisplayState,
} from "@/lib/syncro/llm-cell-display";
import type { SyncroCombination, SyncroSession } from "@/lib/syncro/types";

type Props = {
  cell: SyncroCombination | undefined;
  llmMeta: SyncroSession["llm_meta"];
  className?: string;
  locale?: string;
  seen?: Set<string>;
};

export function SyncroCellAdvice({ cell, llmMeta, className = "compass-short-advice", locale, seen }: Props) {
  const t = useTranslations("syncro");
  const pageLocale = useLocale();
  const effectiveLocale = locale ?? pageLocale;
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

  return (
    <p className={className}>
      <GlossaryText text={cell!.short_advice} locale={effectiveLocale} seen={seen} />
    </p>
  );
}
