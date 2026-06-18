"use client";

import { useTranslations } from "next-intl";

import type { ReadingRitualProduct } from "@/lib/reading-ritual/reading-ritual-storage";

import "@/styles/reading-ritual.css";

type Props = {
  product: ReadingRitualProduct;
};

/** One-line value seed after preview guide (timing ①). */
export function ReadingRitualTeaser({ product }: Props) {
  const t = useTranslations("reading_ritual.teaser");
  return <p className="reading-ritual-teaser">{t(product)}</p>;
}
