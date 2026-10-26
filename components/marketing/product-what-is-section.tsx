"use client";

import { useTranslations } from "next-intl";

import { DsBand } from "@/components/ds/primitives";

export type ProductWhatIsId = "poju" | "glyph" | "syncro" | "match";

/** Hero 下方 — What is POJU / Glyph / Syncro / Match（文案区，无配图） */
export function ProductWhatIsSection({ product }: { product: ProductWhatIsId }) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);
  const tPojuBrand = useTranslations("poju.branding");

  return (
    <DsBand id={`${product}-what-is`} className="ds-what-is-band">
      <div className={`product-what-is product-what-is--${product} product-what-is--copy-only`}>
        <div className="product-what-is__grid product-what-is__grid--copy-only pj-whatis-grid">
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
