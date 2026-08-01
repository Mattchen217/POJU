"use client";

import { SoftTermHover } from "@/components/cross-product/GlossaryText";

/** Fact-chip shell + optional SoftTermHover (soft word + underline). */
export function MatrixSoftChip({
  soft,
  slug,
  locale,
  tone = "neutral",
}: {
  soft: string;
  slug?: string | null;
  locale: string;
  tone?: "green" | "red" | "gold" | "neutral" | "muted";
}) {
  return (
    <span className={`fact-chip fact-chip--${tone}`}>
      {slug ? (
        <SoftTermHover slug={slug} locale={locale} fallback={soft} />
      ) : (
        soft
      )}
    </span>
  );
}
