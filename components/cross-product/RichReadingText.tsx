"use client";

import { useMemo, type ReactNode } from "react";

import {
  EvidenceBlock,
  isEvidenceLeadLabel,
} from "@/components/cross-product/EvidenceBlock";
import { MarkedInline } from "@/components/cross-product/GlossaryText";
import { cn } from "@/lib/utils/classnames";
import {
  parseBlockquoteParts,
  parseReadingBlocks,
} from "@/lib/reading/parse-reading-blocks";
import { prepareReadingLayoutText } from "@/lib/reading/prepare-reading-layout";
import { reflowLongParagraph, type ReflowOptions } from "@/lib/reading/reflow-paragraphs";
import type { MarkLayer } from "@/lib/llm/sanitize/compliance-terms";

import "@/styles/reading-typography.css";

const DELIVERY_REFLOW_OPTS: ReflowOptions = { maxChars: 72, maxSentences: 2 };

type Props = {
  text: string;
  locale: string;
  className?: string;
  /** Short poetic lines (e.g. classical sign) — may stay centered. */
  variant?: "body" | "poem";
  /** Tighter paragraph breaks for POJU/Match/Glyph delivery panels. */
  density?: "default" | "delivery";
  /**
   * 双层制开关。true：正文零金字 + 「依据与推理」块金字集中。
   * false（默认）：完全等于改动前 —— Glyph / Match / 底座不受影响。
   */
  dualLayer?: boolean;
};

function LeadBlock({
  label,
  body,
  locale,
  dedupeScope,
  blockKey,
  inQuote,
  layer,
}: {
  label: string;
  body: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
  inQuote?: boolean;
  layer: MarkLayer;
}) {
  if (!inQuote && isEvidenceLeadLabel(label)) {
    return (
      <EvidenceBlock label={label}>
        {body ? (
          <p className="reading-p">
            {/* 依据块自成一体（折叠、独立阅读）→ 用自己的 dedupe scope，
                别被正文/上一段已出现过的同名词挤成没有 [···] 的裸金字。 */}
            <MarkedInline
              text={body}
              locale={locale}
              dedupeScope={new Set<string>()}
              keyBase={blockKey}
              layer="evidence"
            />
          </p>
        ) : null}
      </EvidenceBlock>
    );
  }

  return (
    <div className={cn("reading-unit", inQuote && "reading-unit--in-quote")}>
      <div className={cn("reading-lead-block", inQuote && "reading-lead-block--pullquote")}>
        <strong className="reading-lead">{label}</strong>
      </div>
      {body ? (
        <p className="reading-p">
          <MarkedInline text={body} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} layer={layer} />
        </p>
      ) : null}
    </div>
  );
}

function SubheadBlock({
  content,
  locale,
  dedupeScope,
  blockKey,
  layer,
}: {
  content: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
  layer: MarkLayer;
}) {
  return (
    <div className="reading-lead-block reading-lead-block--subhead">
      <strong className="reading-lead">
        <MarkedInline text={content} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} layer={layer} />
      </strong>
    </div>
  );
}

function BlockquoteContent({
  content,
  locale,
  dedupeScope,
  blockKey,
  layer,
}: {
  content: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
  layer: MarkLayer;
}) {
  const { label, body } = parseBlockquoteParts(content);
  return (
    <blockquote className="reading-pullquote">
      {label ? (
        <LeadBlock
          label={label}
          body={body}
          locale={locale}
          dedupeScope={dedupeScope}
          blockKey={blockKey}
          inQuote
          layer={layer}
        />
      ) : (
        <MarkedInline text={body} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} layer={layer} />
      )}
    </blockquote>
  );
}

export function RichReadingText({
  text,
  locale,
  className,
  variant = "body",
  density = "default",
  dualLayer = false,
}: Props) {
  const bodyLayer: MarkLayer = dualLayer ? "body" : "legacy";
  // Fresh Set each render — must not survive across StrictMode/re-renders (mutated during parse).
  const dedupeScope = new Set<string>();
  const reflowOpts = density === "delivery" ? DELIVERY_REFLOW_OPTS : undefined;
  const preparedText = density === "delivery" ? prepareReadingLayoutText(text) : text;
  const blocks = useMemo(
    () => parseReadingBlocks(preparedText, { layout: density !== "delivery" }),
    [preparedText, density],
  );

  if (!blocks.length) {
    const chunks = reflowLongParagraph(preparedText, reflowOpts);
    return (
      <div className={cn("reading-body", variant === "poem" && "reading-body--poem", className)}>
        {chunks.map((chunk, i) => (
          <p key={i} className="reading-p">
            <MarkedInline text={chunk} locale={locale} dedupeScope={dedupeScope} keyBase={i * 10} layer={bodyLayer} />
          </p>
        ))}
      </div>
    );
  }

  const nodes: ReactNode[] = blocks.map((block, i) => {
    const keyBase = i * 10;
    switch (block.type) {
      case "h2":
      case "h3":
        return (
          <SubheadBlock
            key={i}
            content={block.content}
            locale={locale}
            dedupeScope={dedupeScope}
            blockKey={keyBase}
            layer={bodyLayer}
          />
        );
      case "subhead":
        return (
          <SubheadBlock
            key={i}
            content={block.content}
            locale={locale}
            dedupeScope={dedupeScope}
            blockKey={keyBase}
            layer={bodyLayer}
          />
        );
      case "lead": {
        const bodyChunks = reflowLongParagraph(block.body, reflowOpts);
        // Evidence fold must wrap the FULL body (all reflow chunks) — never leak gold marks outside.
        if (isEvidenceLeadLabel(block.label)) {
          const evidenceScope = new Set<string>();
          return (
            <EvidenceBlock key={i} label={block.label}>
              {bodyChunks.map((chunk, j) =>
                chunk ? (
                  <p key={`${i}-ev-${j}`} className="reading-p">
                    <MarkedInline
                      text={chunk}
                      locale={locale}
                      dedupeScope={evidenceScope}
                      keyBase={keyBase + j}
                      layer="evidence"
                    />
                  </p>
                ) : null,
              )}
            </EvidenceBlock>
          );
        }
        if (bodyChunks.length <= 1) {
          return (
            <LeadBlock
              key={i}
              label={block.label}
              body={block.body}
              locale={locale}
              dedupeScope={dedupeScope}
              blockKey={keyBase}
              layer={bodyLayer}
            />
          );
        }
        return (
          <div key={i} className="reading-unit">
            <LeadBlock
              label={block.label}
              body={bodyChunks[0]!}
              locale={locale}
              dedupeScope={dedupeScope}
              blockKey={keyBase}
              layer={bodyLayer}
            />
            {bodyChunks.slice(1).map((chunk, j) => (
              <p key={`${i}-b-${j}`} className="reading-p">
                <MarkedInline
                  text={chunk}
                  locale={locale}
                  dedupeScope={dedupeScope}
                  keyBase={keyBase + j + 1}
                  layer={bodyLayer}
                />
              </p>
            ))}
          </div>
        );
      }
      case "blockquote":
        return (
          <BlockquoteContent
            key={i}
            content={block.content}
            locale={locale}
            dedupeScope={dedupeScope}
            blockKey={keyBase}
            layer={bodyLayer}
          />
        );
      case "ul":
        return (
          <ul key={i} className="reading-list">
            {block.items.map((item, j) => (
              <li key={j}>
                <MarkedInline
                  text={item}
                  locale={locale}
                  dedupeScope={dedupeScope}
                  keyBase={keyBase + j}
                  layer={bodyLayer}
                />
              </li>
            ))}
          </ul>
        );
      case "divider":
        return <div key={i} className="reading-divider" aria-hidden />;
      default: {
        const chunks = reflowLongParagraph(block.content, reflowOpts);
        return chunks.map((chunk, j) => (
          <p key={`${i}-${j}`} className="reading-p">
            <MarkedInline
              text={chunk}
              locale={locale}
              dedupeScope={dedupeScope}
              keyBase={keyBase + j}
              layer={bodyLayer}
            />
          </p>
        ));
      }
    }
  });

  return (
    <div className={cn("reading-body", variant === "poem" && "reading-body--poem", className)}>
      {nodes}
    </div>
  );
}
