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
  captionClass: "content-card-caption--violet" | "content-card-caption--magenta" | "content-card-caption--blue";
};

const WHAT_IS_VISUAL: Record<"poju" | "glyph" | "syncro", VisualConfig> = {
  poju: {
    image: pojuWhatIsBg,
    objectPosition: "50% 42%",
    captionClass: "content-card-caption--violet",
  },
  glyph: {
    image: glyphWhatIsBg,
    objectPosition: "50% 48%",
    captionClass: "content-card-caption--magenta",
  },
  syncro: {
    image: syncroWhatIsBg,
    objectPosition: "50% 50%",
    captionClass: "content-card-caption--blue",
  },
};

/** Hero 下方 — What is POJU / Glyph / Syncro / Match */
export function ProductWhatIsSection({ product }: { product: ProductWhatIsId }) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);
  const accent = ACCENT[product];
  const visual = product !== "match" ? WHAT_IS_VISUAL[product] : null;

  return (
    <div className="w-full px-3 sm:px-4 md:px-6">
      <MarketingSection
        id={`${product}-what-is`}
        title={t("what_is.title")}
        subtitle={t("what_is.subtitle")}
        padding="default"
      >
        {visual ? (
          <div className="relative mx-auto aspect-[10/4] w-full max-w-6xl overflow-hidden rounded-2xl">
            <Image
              src={visual.image}
              alt=""
              fill
              className="object-cover"
              style={{ objectPosition: visual.objectPosition }}
              sizes="(max-width:1200px) 100vw, 1152px"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-black/62 via-black/38 to-black/58"
              aria-hidden
            />
            <div className="absolute inset-0 z-10 flex items-center justify-center p-5 sm:p-9 md:p-12">
              <div
                className={`content-card-caption ${visual.captionClass} max-w-[min(94%,42rem)] px-4 py-4 sm:px-5 sm:py-5`}
              >
                <p className="whitespace-pre-line drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">{t("what_is.body")}</p>
              </div>
            </div>
          </div>
        ) : (
          <article className={`content-card content-card--solid content-card--${accent} mx-auto max-w-3xl`}>
            <p className="text-left text-[16px] leading-[1.75] text-white sm:text-[17px]">{t("what_is.body")}</p>
          </article>
        )}
      </MarketingSection>
    </div>
  );
}
