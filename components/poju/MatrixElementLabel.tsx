"use client";

import {
  elementToSlug,
  matrixElementPrimary,
} from "@/lib/poju/matrix-term-labels";

type Props = {
  element: string;
  locale: string;
  className?: string;
};

/** Label color class for five-element façade text (金金/木绿/水蓝/火红/土棕). */
export function matrixElementColorClass(element: string): string {
  const slug = elementToSlug(element);
  return slug ? `pcm-el-label pcm-el-label--${slug}` : "pcm-el-label";
}

/**
 * Matrix façade five-element label:
 * zh → 木；en/es/de/fr → Wood / Madera… (no parenthetical Han).
 * Colored by element: metal gold · wood green · water blue · fire red · earth brown.
 */
export function MatrixElementLabel({ element, locale, className }: Props) {
  const primary = matrixElementPrimary(element, locale);
  if (!primary) return null;
  const colorClass = matrixElementColorClass(element);
  return (
    <span className={[colorClass, className].filter(Boolean).join(" ")}>
      {primary}
    </span>
  );
}
