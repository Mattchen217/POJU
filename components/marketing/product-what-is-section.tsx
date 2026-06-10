"use client";

import { useTranslations } from "next-intl";

import { MarketingSection } from "@/components/marketing/marketing-section";

export type ProductWhatIsId = "poju" | "glyph" | "syncro" | "match";

const ACCENT: Record<ProductWhatIsId, "violet" | "magenta" | "blue" | "fuchsia"> = {
  poju: "violet",
  glyph: "magenta",
  syncro: "blue",
  match: "fuchsia",
};

/** Hero 下方 — What is POJU / Glyph / Syncro / Match */
export function ProductWhatIsSection({ product }: { product: ProductWhatIsId }) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);
  const accent = ACCENT[product];

  return (
    <div className="w-full px-3 sm:px-4 md:px-6">
      <MarketingSection
        id={`${product}-what-is`}
        title={t("what_is.title")}
        subtitle={t("what_is.subtitle")}
        padding="default"
      >
        <article className={`content-card content-card--solid content-card--${accent} mx-auto max-w-3xl`}>
          <p className="text-left text-[16px] leading-[1.75] text-white sm:text-[17px]">{t("what_is.body")}</p>
        </article>
      </MarketingSection>
    </div>
  );
}
