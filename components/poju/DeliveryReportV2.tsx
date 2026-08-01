"use client";

/**
 * Phase-4 delivery renderer v2.
 * Splits by `**依据与推理:**` (not by gold marks). After each label, first paragraph
 * is evidence; remainder is the next body (matches mergeDeliveryToMarkdown layout).
 * Default in MainDeliveryView; `?delivery=legacy` / `?delivery=debug` for fallbacks.
 */

import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { GlossaryText } from "@/components/cross-product/GlossaryText";
import type { Locale } from "@/lib/glossary/term-glossary";
import {
  splitSectionBlocks,
  splitSections,
} from "@/lib/poju/delivery-report-v2-split";

import "@/styles/delivery-report-v2.css";

export { splitSectionBlocks, splitSections } from "@/lib/poju/delivery-report-v2-split";

/** Mirror: raw full_text, no parse — decide frontend vs backend in one glance. */
export function DeliveryReportV2Debug({ fullText }: { fullText: string }) {
  return (
    <div className="poju-delivery-v2 poju-delivery-v2--debug">
      <p className="poju-delivery-v2__debug-banner">
        delivery=debug · raw full_text (no parse)
      </p>
      <pre className="poju-delivery-v2__debug-pre">{fullText}</pre>
    </div>
  );
}

/** One section body: body / evidence blocks via label split + GlossaryText. */
export function DeliverySectionBodyV2({
  body,
  locale,
  /** Meta pages (cover/toc/appendix): no evidence fold. */
  dualLayer = true,
}: {
  body: string;
  locale: string;
  dualLayer?: boolean;
}) {
  const loc = locale as Locale;
  const evidenceLabel = locale.startsWith("zh") ? "依据与推理" : "Evidence & reasoning";

  if (!dualLayer) {
    return (
      <div className="poju-delivery-v2__body">
        <GlossaryText text={body} locale={loc} />
      </div>
    );
  }

  return (
    <>
      {splitSectionBlocks(body).map((blk, bi) =>
        blk.kind === "body" ? (
          <div key={bi} className="poju-delivery-v2__body">
            <GlossaryText text={blk.text} locale={loc} />
          </div>
        ) : (
          <EvidenceBlock
            key={bi}
            label={evidenceLabel}
            defaultOpen={false}
            className="poju-delivery-v2__evidence"
          >
            <div className="poju-delivery-v2__evidence-body">
              <GlossaryText text={blk.text} locale={loc} />
            </div>
          </EvidenceBlock>
        ),
      )}
    </>
  );
}

export function DeliveryReportV2({
  fullText,
  locale,
}: {
  fullText: string;
  locale: string;
}) {
  const sections = splitSections(fullText);

  return (
    <div className="poju-delivery-v2">
      {sections.map((sec, si) => {
        const isMeta =
          /^目录$|^contents$/i.test(sec.title) ||
          /附录|appendix/i.test(sec.title) ||
          (!sec.title.includes("·") && si === 0 && !sec.body.includes("**依据"));
        return (
          <section key={`${si}-${sec.title.slice(0, 24)}`} className="poju-delivery-v2__section">
            {sec.title ? <h2 className="poju-delivery-v2__title">{sec.title}</h2> : null}
            <DeliverySectionBodyV2
              body={sec.body}
              locale={locale}
              dualLayer={!isMeta}
            />
          </section>
        );
      })}
    </div>
  );
}
