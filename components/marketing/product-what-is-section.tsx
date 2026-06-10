"use client";

import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";

import { MarketingSection } from "@/components/marketing/marketing-section";
import pojuWhatIsBg from "@/assets/images/POJU.png";
import glyphWhatIsBg from "@/assets/images/glyph.png";
import syncroWhatIsBg from "@/assets/images/syncro.png";

export type ProductWhatIsId = "poju" | "glyph" | "syncro" | "match";

const ACCENT: Record<ProductWhatIsId, "violet" | "magenta" | "blue" | "fuchsia"> = {
  poju: "violet",
  glyph: "magenta",
  syncro: "blue",
  match: "fuchsia",
};

type VisualConfig = {
  image: StaticImageData;
  objectPosition: string;
};

const WHAT_IS_VISUAL: Record<"poju" | "glyph" | "syncro", VisualConfig> = {
  poju: {
    image: pojuWhatIsBg,
    objectPosition: "50% 42%",
  },
  glyph: {
    image: glyphWhatIsBg,
    objectPosition: "50% 48%",
  },
  syncro: {
    image: syncroWhatIsBg,
    objectPosition: "50% 50%",
  },
};

/** Hero 下方 — What is POJU / Glyph / Syncro / Match */
export function ProductWhatIsSection({ product }: { product: ProductWhatIsId }) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);
  const accent = ACCENT[product];
  const visual = product !== "match" ? WHAT_IS_VISUAL[product] : null;

  if (visual) {
    return (
      <div className="w-full px-3 sm:px-4 md:px-6">
        <section
          id={`${product}-what-is`}
          className="product-what-is-panel relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl"
        >
          <Image
            src={visual.image}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: visual.objectPosition }}
            sizes="(max-width:1200px) 100vw, 1152px"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/48 to-black/68"
            aria-hidden
          />
          <div className="relative z-10 flex min-h-[min(88vw,520px)] flex-col items-center justify-center px-5 py-12 text-center sm:px-10 sm:py-14 md:min-h-0 md:aspect-[10/4] md:px-14 md:py-16">
            <h2 className="max-w-4xl text-[26px] font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] sm:text-[30px] md:text-[32px]">
              {t("what_is.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-[17px] font-medium leading-snug text-white/92 drop-shadow-[0_1px_10px_rgba(0,0,0,0.78)] sm:text-[18px] md:text-[19px]">
              {t("what_is.subtitle")}
            </p>
            <p className="mt-6 max-w-[min(94%,42rem)] whitespace-pre-line text-left text-[17px] leading-[1.8] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.82)] sm:text-[18px] sm:leading-[1.85] md:mt-8 md:text-[20px] md:leading-[1.85]">
              {t("what_is.body")}
            </p>
          </div>
        </section>
      </div>
    );
  }

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
