"use client";

import { useMemo, type ReactNode } from "react";

import { MarkedInline } from "@/components/cross-product/GlossaryText";
import { cn } from "@/lib/utils/classnames";
import {
  parseBlockquoteParts,
  parseReadingBlocks,
} from "@/lib/reading/parse-reading-blocks";
import { prepareReadingLayoutText } from "@/lib/reading/prepare-reading-layout";
import { reflowLongParagraph, type ReflowOptions } from "@/lib/reading/reflow-paragraphs";

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
};

function LeadBlock({
  label,
  body,
  locale,
  dedupeScope,
  blockKey,
  inQuote,
}: {
  label: string;
  body: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
  inQuote?: boolean;
}) {
  return (
    <div className={cn("reading-unit", inQuote && "reading-unit--in-quote")}>
      <div className={cn("reading-lead-block", inQuote && "reading-lead-block--pullquote")}>
        <strong className="reading-lead">{label}</strong>
      </div>
      {body ? (
        <p className="reading-p">
          <MarkedInline text={body} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
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
}: {
  content: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
}) {
  return (
    <div className="reading-lead-block reading-lead-block--subhead">
      <strong className="reading-lead">
        <MarkedInline text={content} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
      </strong>
    </div>
  );
}

function BlockquoteContent({
  content,
  locale,
  dedupeScope,
  blockKey,
}: {
  content: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
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
        />
      ) : (
        <MarkedInline text={body} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
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
}: Props) {
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
            <MarkedInline text={chunk} locale={locale} dedupeScope={dedupeScope} keyBase={i * 10} />
          </p>
        ))}
      </div>
    );
  }

  const nodes: ReactNode[] = blocks.map((block, i) => {
    const keyBase = i * 10;
    switch (block.type) {
      case "h3":
        return (
          <SubheadBlock
            key={i}
            content={block.content}
            locale={locale}
            dedupeScope={dedupeScope}
            blockKey={keyBase}
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
          />
        );
      case "lead": {
        const bodyChunks = reflowLongParagraph(block.body, reflowOpts);
        if (bodyChunks.length <= 1) {
          return (
            <LeadBlock
              key={i}
              label={block.label}
              body={block.body}
              locale={locale}
              dedupeScope={dedupeScope}
              blockKey={keyBase}
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
            />
            {bodyChunks.slice(1).map((chunk, j) => (
              <p key={`${i}-b-${j}`} className="reading-p">
                <MarkedInline
                  text={chunk}
                  locale={locale}
                  dedupeScope={dedupeScope}
                  keyBase={keyBase + j + 1}
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
