"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type Props = {
  className?: string;
  /** Hero / final CTA pill styles from marketing pages */
  variant?: "hero" | "final";
};

export function GlyphPrepareCta({ className = "", variant = "hero" }: Props) {
  const router = useRouter();
  const t = useTranslations("glyph");
  const tHero = useTranslations("marketingSite.glyph.hero");
  const tPricing = useTranslations("marketingSite.glyph.pricing");

  const pillClass =
    variant === "final"
      ? "pj-pill-outline pj-pill-outline--violet mt-7 inline-flex w-full min-w-[220px] max-w-sm justify-center px-8 py-3.5 text-[15px] md:px-10 md:py-4 md:text-base"
      : "pj-pill-outline pj-pill-outline--violet inline-flex min-w-[200px] justify-center px-8 py-3.5 text-[15px] md:px-10 md:py-4 md:text-base";

  return (
    <button
      type="button"
      onClick={() => router.push("/glyph/prepare")}
      className={`${pillClass} ${className}`}
    >
      {variant === "final" ? tPricing("cta") : tHero("cta")}
    </button>
  );
}
