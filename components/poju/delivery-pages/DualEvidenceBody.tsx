/**
 * Dual/triple-track evidence body for delivery folds.
 * Prefer structured metaphysics / science / convergence fields;
 * else split legacy 「【命理】…【科学】…【交汇】…」 markers.
 */

"use client";

import { GlossaryText } from "@/components/cross-product/GlossaryText";
import type { Locale } from "@/lib/glossary/term-glossary";
import {
  composeTripleEvidence,
  splitDualEvidence,
  type DualEvidenceParts,
} from "@/lib/llm/pro/delivery/page-schema/dual-evidence";

export function dualEvidenceSectionTitles(locale: string): {
  meta: string;
  sci: string;
  conv: string;
} {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) {
    return { meta: "命理依据", sci: "科学依据", conv: "交汇依据" };
  }
  if (l.startsWith("es")) {
    return {
      meta: "Base metafísica",
      sci: "Base científica",
      conv: "Convergencia",
    };
  }
  if (l.startsWith("fr")) {
    return {
      meta: "Fondement métaphysique",
      sci: "Fondement scientifique",
      conv: "Convergence",
    };
  }
  if (l.startsWith("de")) {
    return {
      meta: "Metaphysische Basis",
      sci: "Wissenschaftliche Basis",
      conv: "Konvergenz",
    };
  }
  return {
    meta: "Metaphysics basis",
    sci: "Science basis",
    conv: "Convergence",
  };
}

/** Folded evidence: destiny / science / convergence subsections when present. */
export function DualEvidenceBody({
  text,
  locale,
  metaphysics,
  science,
  convergence,
}: {
  text?: string;
  locale: string;
  metaphysics?: string;
  science?: string;
  convergence?: string;
}) {
  const structuredM = (metaphysics ?? "").trim();
  const structuredS = (science ?? "").trim();
  const structuredC = (convergence ?? "").trim();
  const dual: DualEvidenceParts =
    structuredM || structuredS || structuredC
      ? composeTripleEvidence(structuredM, structuredS, structuredC)
      : splitDualEvidence(text);
  const titles = dualEvidenceSectionTitles(locale);
  const hasMeta = Boolean(dual.metaphysics_evidence);
  const hasSci = Boolean(dual.science_evidence);
  const hasConv = Boolean(dual.convergence_evidence);
  if (!hasMeta && !hasSci && !hasConv) {
    const fallback = (text ?? "").trim();
    if (!fallback) return null;
    return (
      <div className="poju-delivery-v2__prose">
        <GlossaryText
          text={fallback}
          locale={locale as Locale}
          layer="evidence"
          bracketSoft={false}
        />
      </div>
    );
  }
  return (
    <div className="poju-delivery-v2__prose dps-dual-evidence">
      {hasMeta ? (
        <section className="dps-dual-evidence__section">
          <h3 className="dps-dual-evidence__h">{titles.meta}</h3>
          <GlossaryText
            text={dual.metaphysics_evidence}
            locale={locale as Locale}
            layer="evidence"
            bracketSoft={false}
          />
        </section>
      ) : null}
      {hasSci ? (
        <section className="dps-dual-evidence__section">
          <h3 className="dps-dual-evidence__h">{titles.sci}</h3>
          <GlossaryText
            text={dual.science_evidence}
            locale={locale as Locale}
            layer="evidence"
            bracketSoft={false}
          />
        </section>
      ) : null}
      {hasConv ? (
        <section className="dps-dual-evidence__section">
          <h3 className="dps-dual-evidence__h">{titles.conv}</h3>
          <GlossaryText
            text={dual.convergence_evidence ?? ""}
            locale={locale as Locale}
            layer="evidence"
            bracketSoft={false}
          />
        </section>
      ) : null}
    </div>
  );
}
