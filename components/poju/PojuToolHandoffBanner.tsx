"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { PojuToolHandoff } from "@/lib/poju/poju-tool-handoff";

type Props = {
  handoff: PojuToolHandoff;
  className?: string;
};

export function PojuToolHandoffBanner({ handoff, className = "" }: Props) {
  const t = useTranslations("poju.tool_handoff");

  const priceKey = handoff.quota_free ? "banner_free" : "banner_paid";

  return (
    <div className={`poju-tool-handoff-banner ${className}`.trim()} role="status">
      <IconArrowLeft size={18} stroke={1.75} aria-hidden />
      <span>{t(priceKey)}</span>
    </div>
  );
}
