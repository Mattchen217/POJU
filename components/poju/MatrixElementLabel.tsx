"use client";

import {
  matrixElementHan,
  matrixElementPrimary,
} from "@/lib/poju/matrix-term-labels";

type Props = {
  element: string;
  locale: string;
  className?: string;
};

/**
 * Matrix façade five-element label:
 * zh → 木；en/es/de/fr → Wood + gray (木).
 */
export function MatrixElementLabel({ element, locale, className }: Props) {
  const primary = matrixElementPrimary(element, locale);
  if (!primary) return null;
  const han =
    locale.toLowerCase().startsWith("zh") ? null : matrixElementHan(element);

  return (
    <span className={className}>
      {primary}
      {han ? <span className="pcm-el-han"> ({han})</span> : null}
    </span>
  );
}
