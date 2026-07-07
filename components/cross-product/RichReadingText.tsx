"use client";

import { useMemo, type ReactNode } from "react";

import { MarkedInline } from "@/components/cross-product/GlossaryText";
import { cn } from "@/lib/utils/classnames";
import {
  parseBlockquoteParts,
  parseReadingBlocks,
} from "@/lib/reading/parse-reading-blocks";
import { reflowLongParagraph } from "@/lib/reading/reflow-paragraphs";

import "@/styles/reading-typography.css";

type Props = {
  text: string;
  locale: string;
  className?: string;
  /** Short poetic lines (e.g. classical sign) — may stay centered. */
  variant?: "body" | "poem";
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

export function RichReadingText({ text, locale, className, variant = "body" }: Props) {
  // Fresh Set each render — must not survive across StrictMode/re-renders (mutated during parse).
  const dedupeScope = new Set<string>();
  const blocks = useMemo(() => parseReadingBlocks(text), [text]);

  if (!blocks.length) {
    const chunks = reflowLongParagraph(text);
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
        const bodyChunks = reflowLongParagraph(block.body);
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
      default: {
        const chunks = reflowLongParagraph(block.content);
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
