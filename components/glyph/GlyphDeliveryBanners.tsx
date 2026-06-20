"use client";

import { TermMarkFirstVisitHint } from "@/components/cross-product/TermMarkFirstVisitHint";
import { ReadingDecoderBanner } from "@/components/reading-ritual/ReadingDecoderBanner";

type Props = {
  variant?: "poju" | "others";
};

/** Stacked delivery hints — nav-width column (decoder + term-mark guide). */
export function GlyphDeliveryBanners({ variant = "others" }: Props) {
  return (
    <div className="glyph-reading-banners">
      <ReadingDecoderBanner variant={variant} className="glyph-reading-banners__item" />
      <TermMarkFirstVisitHint />
    </div>
  );
}
