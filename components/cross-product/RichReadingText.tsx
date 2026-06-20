"use client";

import { useMemo, type ReactNode } from "react";

import { MarkedInline } from "@/components/cross-product/GlossaryText";
import { cn } from "@/lib/utils/classnames";

import "@/styles/reading-typography.css";

type Props = {
  text: string;
  locale: string;
  className?: string;
  /** Short poetic lines (e.g. classical sign) — may stay centered. */
  variant?: "body" | "poem";
};

import { parseReadingBlocks, parseReadingLabel } from "@/lib/reading/parse-reading-blocks";

function LabeledParagraph({
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
  const labeled = parseReadingLabel(content);
  if (labeled) {
    return (
      <p className="reading-p reading-p--labeled">
        <strong className="reading-lead">{labeled.label}</strong>{" "}
        <MarkedInline text={labeled.body} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
      </p>
    );
  }
  return (
    <p className="reading-p">
      <MarkedInline text={content} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
    </p>
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
  const labeled = parseReadingLabel(content);
  const inner = labeled ? labeled.body : content;
  return (
    <blockquote className="reading-pullquote">
      {labeled ? (
        <>
          <strong className="reading-lead reading-lead--pullquote">{labeled.label}</strong>{" "}
          <MarkedInline text={inner} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
        </>
      ) : (
        <MarkedInline text={inner} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} />
      )}
    </blockquote>
  );
}

export function RichReadingText({ text, locale, className, variant = "body" }: Props) {
  const dedupeScope = useMemo(() => new Set<string>(), [text]);
  const blocks = useMemo(() => parseReadingBlocks(text), [text]);

  if (!blocks.length) {
    return (
      <div className={cn("reading-body", variant === "poem" && "reading-body--poem", className)}>
        <MarkedInline text={text} locale={locale} dedupeScope={dedupeScope} />
      </div>
    );
  }

  const nodes: ReactNode[] = blocks.map((block, i) => {
    switch (block.type) {
      case "h3":
        return (
          <h4 key={i} className="reading-subhead">
            <MarkedInline text={block.content} locale={locale} dedupeScope={dedupeScope} keyBase={i * 10} />
          </h4>
        );
      case "blockquote":
        return (
          <BlockquoteContent
            key={i}
            content={block.content}
            locale={locale}
            dedupeScope={dedupeScope}
            blockKey={i * 10}
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
                  keyBase={i * 10 + j}
                />
              </li>
            ))}
          </ul>
        );
      default:
        return (
          <LabeledParagraph
            key={i}
            content={block.content}
            locale={locale}
            dedupeScope={dedupeScope}
            blockKey={i * 10}
          />
        );
    }
  });

  return (
    <div className={cn("reading-body", variant === "poem" && "reading-body--poem", className)}>
      {nodes}
    </div>
  );
}
