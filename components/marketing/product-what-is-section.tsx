"use client";

import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";

import { MarketingSection } from "@/components/marketing/marketing-section";
import pojuWhatIsBg from "@/assets/images/POJU.png";
import glyphWhatIsBg from "@/assets/images/glyph.png";
import syncroWhatIsBg from "@/assets/images/syncro.png";
import matchWhatIsBg from "@/assets/images/match.png";

export type ProductWhatIsId = "poju" | "glyph" | "syncro" | "match";

const WHAT_IS_IMAGE: Record<ProductWhatIsId, StaticImageData> = {
  poju: pojuWhatIsBg,
  glyph: glyphWhatIsBg,
  syncro: syncroWhatIsBg,
  match: matchWhatIsBg,
};

/** Hero 下方 — What is POJU / Glyph / Syncro / Match（毛玻璃框 · 左图右文） */
export function ProductWhatIsSection({ product }: { product: ProductWhatIsId }) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);

  return (
    <div className="w-full px-3 sm:px-4 md:px-6">
      <MarketingSection
        id={`${product}-what-is`}
        title={t("what_is.title")}
        subtitle={t("what_is.subtitle")}
        padding="default"
      >
        <div className="product-what-is mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-10 lg:gap-12">
          <div className="product-what-is__media relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-2xl md:mx-0 md:max-w-none">
            <Image
              src={WHAT_IS_IMAGE[product]}
              alt=""
              fill
              className="object-cover object-center"
              sizes="(max-width:768px) min(360px, 92vw), 360px"
            />
          </div>
          <div className="product-what-is__copy min-w-0">
            <p className="whitespace-pre-line text-left text-[17px] leading-[1.8] text-white sm:text-[18px] md:text-[19px] md:leading-[1.85]">
              {t("what_is.body")}
            </p>
          </div>
        </div>
      </MarketingSection>
    </div>
  );
}
