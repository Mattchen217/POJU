"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  GLOSS_TOKEN_PATTERN,
  stripBrokenMarkers,
  TERM_MARKER_PATTERN,
  uiTermById,
  unescapeGlossPart,
  unescapeMarkerPart,
  prepareTextForGlossaryRender,
} from "@/lib/llm/sanitize/compliance-terms";
import { termPolarityById, type TermPolarity } from "@/lib/glossary/term-polarity";
import { toGlossaryLocale } from "@/lib/glossary/term-glossary";

import "@/styles/glossary.css";

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
}: {
  visible: string;
  plain: string;
  polarity?: TermPolarity;
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

  const popNode =
    open && plain && popStyle ? (
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
        <span className="glossary-pop__title">{visible}</span>
        <span className="glossary-pop__body">{plain}</span>
      </span>
    ) : null;

  // Light paren: only the short soft label in body. Detail (plain) lives in hover/click pop.
  const softLabel = (visible.trim() || plain.trim()).slice(0, 12);

  return (
    <span ref={anchorRef} className={`term-mark term-mark--${polarity} term-mark--paren`}>
      <button
        type="button"
        className="term-mark__paren"
        tabIndex={0}
        aria-label="Explain term"
        aria-describedby={open ? id : undefined}
        onMouseEnter={openFromHover}
        onMouseLeave={scheduleHoverClose}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={toggle}
      >
        （{softLabel}）
      </button>
      {typeof document !== "undefined" && popNode ? createPortal(popNode, document.body) : null}
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
      const visible = unescapeMarkerPart(next.groups[1]);
      const dynamicPlain = next.groups[2] ? unescapeMarkerPart(next.groups[2]).trim() : "";
      const ui = uiTermById(termId, glossaryLocale);
      const plain = dynamicPlain || ui?.plain || "";
      const polarity = ui?.polarity ?? termPolarityById(termId);
      const softOnly = visible.trim() || ui?.soft || "";
      if (seenInParagraph.has(termId) || parenMarks >= maxParenMarks) {
        // Re-mention / density overflow — keep soft word as plain prose, no paren interrupt.
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
}: {
  text: string;
  locale: string;
  dedupeScope?: Set<string>;
  keyBase?: number;
}) {
  // Block 62/63 — UI compliance net: autoMarkBareTerms inside prepareTextForGlossaryRender (before parse).
  const prepared = prepareTextForGlossaryRender(text, locale);
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
      ...parseMarkedText(chunk, locale, kb++, paraSeen, MAX_PAREN_MARKS_PER_PARAGRAPH),
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
