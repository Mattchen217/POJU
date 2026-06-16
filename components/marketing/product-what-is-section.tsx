"use client";

import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";

import { DsBand } from "@/components/ds/primitives";
import { ProductWhatIsCardGlow } from "@/components/marketing/product-what-is-card-glow";
import { SyncroWhatIsLightBeam } from "@/components/marketing/syncro-what-is-light-beam";
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

const WHAT_IS_CARD_GLOW: Partial<Record<ProductWhatIsId, { originY: number }>> = {
  glyph: { originY: 0.6 },
  match: { originY: 0.4 },
};

/** Hero 下方 — What is POJU / Glyph / Syncro / Match（左 3:4 图 · 右标题+文案） */
export function ProductWhatIsSection({ product }: { product: ProductWhatIsId }) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);
  const tPojuBrand = useTranslations("poju.branding");
  const glow = WHAT_IS_CARD_GLOW[product];

  return (
    <DsBand id={`${product}-what-is`} className="ds-what-is-band">
      <div className={`product-what-is product-what-is--${product}`}>
        <div className="product-what-is__grid pj-whatis-grid">
          <div className="product-what-is__media-wrap">
            <span className="product-what-is__glow" aria-hidden />
            <span className="product-what-is__ring" aria-hidden />
            <div className="product-what-is__frame">
              <Image
                src={WHAT_IS_IMAGE[product]}
                alt=""
                fill
                className="product-what-is__image object-cover object-center"
                sizes="(max-width: 768px) min(340px, 92vw), 300px"
              />
              <span className="product-what-is__sheen" aria-hidden />
              <span className="product-what-is__vignette" aria-hidden />
            </div>
            {glow ? <ProductWhatIsCardGlow originY={glow.originY} /> : null}
            {product === "syncro" ? <SyncroWhatIsLightBeam /> : null}
            {product === "poju" ? (
              <span className="product-what-is__orbit" aria-hidden>
                <span className="product-what-is__orbit-dot" />
              </span>
            ) : null}
          </div>

          <div className="product-what-is__copy">
            <p className="product-what-is__kicker">{t("what_is.subtitle")}</p>
            <h2 className="product-what-is__title">{t("what_is.title")}</h2>
            <div className="product-what-is__body-wrap">
              <span className="product-what-is__accent-bar" aria-hidden />
              <p className="product-what-is__body">
                {product === "poju" ? tPojuBrand("feature_definition") : t("what_is.body")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DsBand>
  );
}
