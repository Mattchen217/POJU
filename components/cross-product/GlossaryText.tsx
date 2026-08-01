"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  GLOSS_TOKEN_PATTERN,
  plainByTermId,
  stripBrokenMarkers,
  TERM_MARKER_PATTERN,
  uiTermById,
  unescapeGlossPart,
  unescapeMarkerPart,
  prepareTextForGlossaryRender,
  prepareBodyTextForGlossaryRender,
  type MarkLayer,
} from "@/lib/llm/sanitize/compliance-terms";
import { glossOf, termOf } from "@/lib/glossary/pojulife-terms";
import { termPolarityById, type TermPolarity } from "@/lib/glossary/term-polarity";
import { toGlossaryLocale } from "@/lib/glossary/term-glossary";
import { MatrixElementLabel } from "@/components/poju/MatrixElementLabel";

import "@/styles/glossary.css";

const WUXING_SLUGS = new Set(["wood", "fire", "earth", "metal", "water"]);

type Props = { text: string; locale: string };

const GLOSSARY_POP_WIDTH = 280;
const GLOSSARY_POP_GAP = 8;
const GLOSSARY_POP_Z = 10000;

type PopPlacement = "below" | "above";

function computeGlossaryPopPosition(anchor: DOMRect): {
  top: number;
  left: number;
  placement: PopPlacement;
  width: number;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(GLOSSARY_POP_WIDTH, vw * 0.78);

  let left = anchor.left;
  if (left + width > vw - 12) left = Math.max(12, vw - width - 12);
  if (left < 12) left = 12;

  const belowTop = anchor.bottom + GLOSSARY_POP_GAP;
  const spaceBelow = vh - belowTop;
  const spaceAbove = anchor.top - GLOSSARY_POP_GAP;
  const placement: PopPlacement = spaceBelow < 96 && spaceAbove > spaceBelow ? "above" : "below";
  const top = placement === "below" ? belowTop : anchor.top - GLOSSARY_POP_GAP;

  return { top, left, placement, width };
}

function TermMark({
  visible,
  plain,
  polarity = "neutral",
  /** hover = matrix/zodiac full soft; default = delivery soft (may truncate long labels). */
  mode = "ellipsis",
}: {
  visible: string;
  plain: string;
  polarity?: TermPolarity;
  mode?: "ellipsis" | "hover";
}) {
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState<{
    top: number;
    left: number;
    width: number;
    placement: PopPlacement;
  } | null>(null);
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverClose = () => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  const scheduleHoverClose = () => {
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(() => setOpen(false), 140);
  };

  const openFromHover = () => {
    cancelHoverClose();
    setOpen(true);
  };

  const updatePopPosition = () => {
    const el = anchorRef.current;
    if (!el) return;
    setPopStyle(computeGlossaryPopPosition(el.getBoundingClientRect()));
  };

  useLayoutEffect(() => {
    if (!open) {
      setPopStyle(null);
      return;
    }
    updatePopPosition();
    window.addEventListener("resize", updatePopPosition);
    window.addEventListener("scroll", updatePopPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopPosition);
      window.removeEventListener("scroll", updatePopPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (ev: Event) => {
      const target = ev.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = () => setOpen((o) => !o);

  const fullLabel = (visible.trim() || plain.trim());
  const softLabel = mode === "hover" ? fullLabel : fullLabel.slice(0, 12);
  const detail = plain.trim();

  const popNode =
    open && detail && popStyle ? (
      <span
        ref={popRef}
        id={id}
        role="tooltip"
        className={`glossary-pop glossary-pop--portal glossary-pop--${polarity}${
          popStyle.placement === "above" ? " glossary-pop--above" : ""
        }`}
        style={{
          top: popStyle.top,
          left: popStyle.left,
          width: popStyle.width,
          maxWidth: popStyle.width,
          zIndex: GLOSSARY_POP_Z,
        }}
        onMouseEnter={cancelHoverClose}
        onMouseLeave={scheduleHoverClose}
      >
        <span className="glossary-pop__title">{softLabel}</span>
        <span className="glossary-pop__body">{detail}</span>
      </span>
    ) : null;

  const portal =
    typeof document !== "undefined" && popNode
      ? createPortal(popNode, document.body)
      : null;

  // Soft golden word + dotted underline carries interaction (desktop hover / tap / keyboard).
  // No brackets / [···] opener — the word itself is the tap target.
  const onWordKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <span
      ref={anchorRef}
      className={`term-mark term-mark--${polarity}${mode === "hover" ? " term-mark--hover" : ""}`}
    >
      {detail ? (
        <span
          className="term-mark__word term-mark__word--interactive"
          role="button"
          tabIndex={0}
          aria-label="Explain term"
          aria-describedby={open ? id : undefined}
          onMouseEnter={openFromHover}
          onMouseLeave={scheduleHoverClose}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={toggle}
          onKeyDown={onWordKeyDown}
        >
          {softLabel}
        </span>
      ) : (
        <span className="term-mark__word">{softLabel}</span>
      )}
      {portal}
    </span>
  );
}

/** SSOT soft label + hover/tap gloss — dotted underline; word itself is the opener. */
export function SoftTermHover({
  slug,
  locale,
  fallback,
  className,
}: {
  slug: string;
  locale: string;
  fallback?: string;
  className?: string;
}) {
  // Matrix façade: classic 金木水火土 / Wood (木) — not soft Growth/Radiance.
  if (WUXING_SLUGS.has(slug)) {
    return (
      <MatrixElementLabel element={slug} locale={locale} className={className} />
    );
  }
  const soft = termOf(slug, locale) ?? fallback ?? "";
  const plain = glossOf(slug, locale) ?? "";
  if (!soft) return fallback ? <>{fallback}</> : null;
  return (
    <span className={className}>
      <TermMark
        visible={soft}
        plain={plain}
        polarity={termPolarityById(slug)}
        mode="hover"
      />
    </span>
  );
}

/** Legacy ⟦g|display|plain⟧ — still rendered for older cached deliveries. */
function LegacyGlossMark({ display, plain }: { display: string; plain: string }) {
  return <TermMark visible={display} plain={plain} />;
}

function renderPlainSegment(segment: string, keyPrefix: number): ReactNode[] {
  if (!segment) return [];
  const clean = stripBrokenMarkers(segment);
  if (!clean) return [];

  const parts: ReactNode[] = [];
  const boldRe = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let ki = 0;
  let m: RegExpExecArray | null;

  boldRe.lastIndex = 0;
  while ((m = boldRe.exec(clean)) !== null) {
    if (m.index > last) {
      parts.push(
        <span key={`plain-${keyPrefix}-${ki++}`}>{clean.slice(last, m.index)}</span>,
      );
    }
    parts.push(
      <strong key={`bold-${keyPrefix}-${ki++}`} className="reading-strong">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }

  if (last < clean.length) {
    parts.push(<span key={`plain-${keyPrefix}-${ki++}`}>{clean.slice(last)}</span>);
  }

  return parts.length ? parts : [<span key={`plain-${keyPrefix}`}>{clean}</span>];
}

function findNextMarker(
  text: string,
  from: number,
): { index: number; raw: string; kind: "t" | "g"; groups: string[] } | null {
  TERM_MARKER_PATTERN.lastIndex = from;
  GLOSS_TOKEN_PATTERN.lastIndex = from;
  const tMatch = TERM_MARKER_PATTERN.exec(text);
  const gMatch = GLOSS_TOKEN_PATTERN.exec(text);
  if (!tMatch && !gMatch) return null;
  if (tMatch && (!gMatch || tMatch.index <= gMatch.index)) {
    return {
      index: tMatch.index,
      raw: tMatch[0],
      kind: "t",
      groups: [tMatch[1], tMatch[2], tMatch[3] ?? ""],
    };
  }
  return {
    index: gMatch!.index,
    raw: gMatch![0],
    kind: "g",
    groups: [gMatch![1], gMatch![2]],
  };
}

/** Max paren term marks rendered per paragraph (density cap). */
const MAX_PAREN_MARKS_PER_PARAGRAPH = 2;
/**
 * 依据层：金字全显、默认折叠、允许"不好读"。
 * 【不封顶】—— 必须与门禁 auditTermMarkerDensity 的依据上限一致（那边已取消上限）。
 * 若这里留一个有限值，门禁放行 7 个、渲染只显 N 个 → 第 N+1 个起有金字无下划线、点不开
 * （就是反复出现过的"金字点不开"）。个数由内容侧「只留承重锚点」控，不在渲染层砍。
 */
const MAX_PAREN_MARKS_EVIDENCE = Number.POSITIVE_INFINITY;

function parseMarkedText(
  text: string,
  locale: string,
  keyBase: number,
  dedupeScope?: Set<string>,
  maxParenMarks = MAX_PAREN_MARKS_PER_PARAGRAPH,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const glossaryLocale = toGlossaryLocale(locale);
  const seenInParagraph = dedupeScope ?? new Set<string>();
  let parenMarks = 0;
  let cursor = 0;
  let keyIdx = 0;

  while (cursor < text.length) {
    const next = findNextMarker(text, cursor);
    if (!next) {
      nodes.push(...renderPlainSegment(text.slice(cursor), keyBase + keyIdx++));
      break;
    }
    if (next.index > cursor) {
      nodes.push(...renderPlainSegment(text.slice(cursor, next.index), keyBase + keyIdx++));
    }
    if (next.kind === "t") {
      const termId = next.groups[0];
      const slot2 = unescapeMarkerPart(next.groups[1] ?? "").trim();
      // 2-slot `⟦t:slug|plain⟧` has one `|`; 3-slot `⟦t:slug|soft|plain⟧` / `⟦t:slug||plain⟧` has two.
      const isThreeSlot = (next.raw.match(/\|/g) || []).length >= 2;
      const slot3 = isThreeSlot ? unescapeMarkerPart(next.groups[2] ?? "").trim() : "";
      const ui = uiTermById(termId, glossaryLocale);
      // SSOT owns visible soft label — model soft is always overwritten.
      const softOnly = termOf(termId, glossaryLocale) || ui?.soft || "";
      // Plain: 3rd slot if present, else 2-slot body (= contextual plain), else glossOf.
      const plain =
        (isThreeSlot ? slot3 : slot2) ||
        glossOf(termId, glossaryLocale) ||
        ui?.plain ||
        plainByTermId(termId, glossaryLocale) ||
        "";
      const polarity = ui?.polarity ?? termPolarityById(termId);
      if (!softOnly) {
        // Unknown slug — demote to plain prose (never show model's possibly-banned soft).
        nodes.push(
          <span key={`t-unk-${keyBase}-${keyIdx++}`}>{plain || slot2 || termId}</span>,
        );
      } else if (seenInParagraph.has(termId) || parenMarks >= maxParenMarks) {
        nodes.push(<span key={`t-dup-${keyBase}-${keyIdx++}`}>{softOnly}</span>);
        seenInParagraph.add(termId);
      } else {
        seenInParagraph.add(termId);
        parenMarks += 1;
        nodes.push(
          <TermMark
            key={`t-${keyBase}-${keyIdx++}`}
            visible={softOnly}
            plain={plain}
            polarity={polarity}
          />,
        );
      }
    } else {
      const display = unescapeGlossPart(next.groups[0]);
      const plain = unescapeGlossPart(next.groups[1]);
      nodes.push(
        <LegacyGlossMark key={`g-${keyBase}-${keyIdx++}`} display={display} plain={plain} />,
      );
    }
    cursor = next.index + next.raw.length;
  }

  return nodes;
}

/** Inline marked text — optional shared dedupeScope for section-level golden-term density. */
export function MarkedInline({
  text,
  locale,
  dedupeScope,
  keyBase = 0,
  layer = "legacy",
}: {
  text: string;
  locale: string;
  dedupeScope?: Set<string>;
  keyBase?: number;
  /** 双层制：body=正文零金字 / evidence=金字集中 / legacy=未接双层制的老界面（默认，零回归）。 */
  layer?: MarkLayer;
}) {
  // Block 62/63 — UI compliance net: autoMarkBareTerms inside prepareTextForGlossaryRender (before parse).
  // body 层不走这条 —— 正文零金字，裸词改走「替换成白话」的 prepareBodyTextForGlossaryRender。
  const prepared =
    layer === "body"
      ? prepareBodyTextForGlossaryRender(text, locale)
      : prepareTextForGlossaryRender(text, locale);
  const maxParenMarks =
    layer === "evidence" ? MAX_PAREN_MARKS_EVIDENCE : MAX_PAREN_MARKS_PER_PARAGRAPH;
  const hasMarkers = prepared.includes("⟦t:") || prepared.includes("⟦g|");

  // Paragraph-scoped density: ≤2 paren marks / paragraph; first occurrence only.
  const paragraphs = prepared.split(/(\n\n+)/);
  const globalSeen = dedupeScope ?? new Set<string>();
  const nodes: ReactNode[] = [];
  let kb = keyBase;
  for (let i = 0; i < paragraphs.length; i++) {
    const chunk = paragraphs[i]!;
    if (/^\n\n+$/.test(chunk)) {
      nodes.push(<span key={`para-sep-${kb++}`}>{chunk}</span>);
      continue;
    }
    const paraSeen = new Set<string>(globalSeen);
    nodes.push(
      ...parseMarkedText(chunk, locale, kb++, paraSeen, maxParenMarks),
    );
    for (const id of paraSeen) globalSeen.add(id);
  }

  if (!hasMarkers) {
    const clean = stripBrokenMarkers(prepared);
    return <>{nodes.length ? nodes : clean}</>;
  }

  return <>{nodes.length ? nodes : stripBrokenMarkers(prepared)}</>;
}

export function GlossaryText({ text, locale }: Props) {
  return <MarkedInline text={text} locale={locale} />;
}
