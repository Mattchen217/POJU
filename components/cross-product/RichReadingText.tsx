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
/** Chat bubbles: keep author paragraphing; don't chop into one-sentence walls. */
const CHAT_REFLOW_OPTS: ReflowOptions | null = null;

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
                别被正文/上一段已出现过的同名词挤成没有下划线的裸金字。 */}
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
  const reflowOpts: ReflowOptions | null =
    density === "delivery" ? DELIVERY_REFLOW_OPTS : CHAT_REFLOW_OPTS;
  const preparedText = density === "delivery" ? prepareReadingLayoutText(text) : text;
  const blocks = useMemo(
    () => parseReadingBlocks(preparedText, { layout: density !== "delivery" }),
    [preparedText, density],
  );

  const asParagraphChunks = (content: string): string[] => {
    if (!reflowOpts) return content.trim() ? [content] : [];
    return reflowLongParagraph(content, reflowOpts);
  };

  if (!blocks.length) {
    const chunks = asParagraphChunks(preparedText);
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

  const renderBlock = (block: (typeof blocks)[number], i: number): ReactNode => {
    const keyBase = i * 10;
    switch (block.type) {
      case "h2":
      case "h3":
        return (
          <h3 key={i} className="reading-subhead">
            <MarkedInline
              text={block.content}
              locale={locale}
              dedupeScope={dedupeScope}
              keyBase={keyBase}
              layer={bodyLayer}
            />
          </h3>
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
        // 依据块：禁止 reflow 切成多个 <p>（标记密集长句会被拆成「一行一个金字」）。
        if (isEvidenceLeadLabel(block.label)) {
          const evidenceScope = new Set<string>();
          return (
            <EvidenceBlock key={i} label={block.label}>
              {block.body ? (
                <p className="reading-p reading-p--evidence">
                  <MarkedInline
                    text={block.body}
                    locale={locale}
                    dedupeScope={evidenceScope}
                    keyBase={keyBase}
                    layer="evidence"
                  />
                </p>
              ) : null}
            </EvidenceBlock>
          );
        }
        const bodyChunks = asParagraphChunks(block.body);
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
        const chunks = asParagraphChunks(block.content);
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
  };

  /**
   * dualLayer：把「正文块… + 紧随的依据 lead」装进同一子容器，1:1 交错，
   * 避免正文/依据分两个独立循环导致漏段后整体错位。
   */
  const nodes: ReactNode[] = (() => {
    if (!dualLayer) {
      return blocks.map((block, i) => renderBlock(block, i));
    }
    const out: ReactNode[] = [];
    let i = 0;
    let segIdx = 0;
    while (i < blocks.length) {
      const b = blocks[i]!;
      if (b.type === "h2" || b.type === "h3" || b.type === "divider") {
        out.push(renderBlock(b, i));
        i += 1;
        continue;
      }
      if (b.type === "lead" && isEvidenceLeadLabel(b.label)) {
        // 1对1 兜底:孤立依据(前面没有配对正文)直接丢弃,不显示。
        // 宁可少一段依据,不出现「一段正文两段依据」或孤立依据错乱。
        i += 1;
        continue;
      }
      const start = i;
      const bodyParts: ReactNode[] = [];
      while (i < blocks.length) {
        const cur = blocks[i]!;
        if (cur.type === "h2" || cur.type === "h3" || cur.type === "divider") break;
        if (cur.type === "lead" && isEvidenceLeadLabel(cur.label)) break;
        bodyParts.push(renderBlock(cur, i));
        i += 1;
      }
      let evidenceNode: ReactNode = null;
      if (
        i < blocks.length &&
        blocks[i]!.type === "lead" &&
        isEvidenceLeadLabel((blocks[i] as { type: "lead"; label: string }).label)
      ) {
        evidenceNode = renderBlock(blocks[i]!, i);
        i += 1;
      }
      if (bodyParts.length === 0) {
        // 这段没有正文(只有落单依据)→ 整段丢弃,不显示(1对1)
        segIdx += 1;
        continue;
      }
      out.push(
        <div key={`seg-${segIdx}-${start}`} className="reading-segment">
          {bodyParts}
          {evidenceNode}
        </div>,
      );
      segIdx += 1;
    }
    return out;
  })();

  return (
    <div className={cn("reading-body", variant === "poem" && "reading-body--poem", className)}>
      {nodes}
    </div>
  );
}
