"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  GLOSS_TOKEN_PATTERN,
  stripBrokenMarkers,
  TERM_MARKER_PATTERN,
  uiTermById,
  unescapeGlossPart,
  unescapeMarkerPart,
} from "@/lib/llm/sanitize/compliance-terms";
import { toGlossaryLocale, type Locale } from "@/lib/glossary/term-glossary";

import "@/styles/glossary.css";

type Props = { text: string; locale: string; seen?: Set<string> };

const HINT_KEY = "poju-term-hint-seen";

function TermMark({
  visible,
  plain,
  showInfo,
}: {
  visible: string;
  plain: string;
  showInfo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (ev: Event) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false);
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

  return (
    <span ref={ref} className="term-mark">
      <span
        className="term-mark__word"
        tabIndex={0}
        role="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={toggle}
      >
        {visible}
      </span>
      {showInfo ? (
        <button
          type="button"
          className="term-mark__info"
          aria-label="Explain term"
          onClick={toggle}
        >
          [···]
        </button>
      ) : null}
      {open && plain ? (
        <span id={id} role="tooltip" className="glossary-pop">
          <span className="glossary-pop__title">{visible}</span>
          <span className="glossary-pop__body">{plain}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Legacy ⟦g|display|plain⟧ — still rendered for older cached deliveries. */
function LegacyGlossMark({ display, plain }: { display: string; plain: string }) {
  return <TermMark visible={display} plain={plain} showInfo />;
}

function renderPlainText(segment: string, keyPrefix: number): ReactNode[] {
  if (!segment) return [];
  const clean = stripBrokenMarkers(segment);
  return clean ? [<span key={`plain-${keyPrefix}`}>{clean}</span>] : [];
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
    return { index: tMatch.index, raw: tMatch[0], kind: "t", groups: [tMatch[1], tMatch[2]] };
  }
  return {
    index: gMatch!.index,
    raw: gMatch![0],
    kind: "g",
    groups: [gMatch![1], gMatch![2]],
  };
}

function parseMarkedText(
  text: string,
  locale: string,
  seen: Set<string>,
  keyBase: number,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const glossaryLocale = toGlossaryLocale(locale);
  let cursor = 0;
  let keyIdx = 0;

  while (cursor < text.length) {
    const next = findNextMarker(text, cursor);
    if (!next) {
      nodes.push(...renderPlainText(text.slice(cursor), keyBase + keyIdx++));
      break;
    }
    if (next.index > cursor) {
      nodes.push(...renderPlainText(text.slice(cursor, next.index), keyBase + keyIdx++));
    }
    if (next.kind === "t") {
      const termId = next.groups[0];
      const visible = unescapeMarkerPart(next.groups[1]);
      const ui = uiTermById(termId, glossaryLocale);
      const plain = ui?.plain ?? "";
      const showInfo = !seen.has(termId);
      if (showInfo) seen.add(termId);
      nodes.push(
        <TermMark
          key={`t-${keyBase}-${keyIdx++}`}
          visible={visible}
          plain={plain}
          showInfo={showInfo}
        />,
      );
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

function FirstVisitHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY) !== "1") setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  return (
    <p className="term-hint" role="note">
      Tap{" "}
      <span className="term-mark__info term-mark__info--inline" aria-hidden>
        [···]
      </span>{" "}
      beside highlighted terms for a plain-language explanation.{" "}
      <button type="button" className="term-hint__dismiss" onClick={() => {
        setShow(false);
        try {
          localStorage.setItem(HINT_KEY, "1");
        } catch {
          /* ignore */
        }
      }}>
        Got it
      </button>
    </p>
  );
}

export function GlossaryText({ text, locale, seen }: Props) {
  const localSeen = seen ?? new Set<string>();
  const hasMarkers = text.includes("⟦t:") || text.includes("⟦g|");
  const nodes = parseMarkedText(text, locale, localSeen, 0);

  if (!hasMarkers) {
    const clean = stripBrokenMarkers(text);
    return <>{nodes.length ? nodes : clean}</>;
  }

  return (
    <>
      <FirstVisitHint />
      {nodes.length ? nodes : stripBrokenMarkers(text)}
    </>
  );
}
