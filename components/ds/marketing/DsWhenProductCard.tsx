"use client";

import type { ReactNode } from "react";

import { MarketingIconChip, type MarketingIconChipTone } from "@/components/marketing/marketing-icon-chip";

export type WhenProductTheme = "poju" | "glyph" | "syncro" | "match";

const THEME_CHIP: Record<WhenProductTheme, MarketingIconChipTone> = {
  poju: "gold",
  glyph: "violet",
  syncro: "cyan",
  match: "rose",
};

export function DsWhenProductCard({
  theme,
  index,
  icon,
  title,
  description,
}: {
  theme: WhenProductTheme;
  index: number;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className={`ds-when-product-card ds-when-product-card--${theme}`}>
      <span className="ds-when-product-card__ghost" aria-hidden>
        {index}
      </span>
      <span className="ds-when-product-card__rail" aria-hidden />
      <MarketingIconChip tone={THEME_CHIP[theme]} size="sm">
        {icon}
      </MarketingIconChip>
      <p className="mt-4 text-base font-semibold leading-snug text-[var(--pj-text-primary)]">{title}</p>
      <div className="ds-when-product-card__divider" aria-hidden />
      <p className="m-0 text-sm leading-relaxed text-[var(--pj-text-secondary)]">{description}</p>
    </article>
  );
}
