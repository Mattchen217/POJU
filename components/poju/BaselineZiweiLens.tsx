"use client";

import { useMemo } from "react";

import type { BirthInfo } from "@/lib/profile/types";
import { baselineZiweiLensLines } from "@/lib/ziwei/baseline-lens";
import { buildZiweiFactPack } from "@/lib/ziwei/fact-pack";

import "@/styles/baseline-ziwei-lens.css";

type Props = {
  birth: BirthInfo;
  locale: string;
};

/**
 * Live vault only. createRoot / offline HTML do not mount this.
 * A failed cast omits the lens. It does not invent a chart.
 */
export function BaselineZiweiLens({ birth, locale }: Props) {
  const lines = useMemo(() => {
    try {
      // Phase 5: display adapter + locale soft labels (never raw traditional).
      return baselineZiweiLensLines(buildZiweiFactPack(birth), locale);
    } catch {
      return [];
    }
  }, [birth, locale]);
  if (!lines.length) return null;
  const zh = locale.toLowerCase().startsWith("zh");

  return (
    <aside
      className="baseline-ziwei-lens"
      data-live-lens="ziwei"
      data-sot16-offline="0"
      aria-label={zh ? "结构透镜" : "Structure lens"}
    >
      <p className="baseline-ziwei-lens__title">{zh ? "结构透镜" : "Structure lens"}</p>
      <dl className="baseline-ziwei-lens__list">
        {lines.map((line) => (
          <div key={line.label} className="baseline-ziwei-lens__row">
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
