"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  GLOSS_TOKEN_PATTERN,
  parseGlossTokens,
  unescapeGlossPart,
} from "@/lib/llm/sanitize/compliance-terms";
import { tippableEntries, toGlossaryLocale, type Locale } from "@/lib/glossary/term-glossary";

import "@/styles/glossary.css";

type TippableEntry = { label: string; hanzi?: string; gloss: string };

type Props = { text: string; locale: string; seen?: Set<string> };

function isWordBoundary(text: string, idx: number, label: string, locale: Locale): boolean {
  if (locale === "zh") return true;
  const before = idx > 0 ? text[idx - 1] : " ";
  const after = idx + label.length < text.length ? text[idx + label.length] : " ";
  return !/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after);
}

function GlossaryMark({ display, plain, hanzi }: { display: string; plain: string; hanzi?: string }) {
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

  return (
    <span
      ref={ref}
      className="glossary-mark"
      tabIndex={0}
      role="button"
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      {display}
      {hanzi && !display.includes(hanzi) ? ` (${hanzi})` : ""}
      {open ? (
        <span id={id} role="tooltip" className="glossary-pop">
          <span className="glossary-pop__title">
            {display}
            {hanzi && !display.includes(hanzi) ? ` (${hanzi})` : ""}
          </span>
          <span className="glossary-pop__body">{plain}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Render plain segment — legacy soft labels still tippable when no gloss token. */
function renderPlainSegment(
  segment: string,
  glossaryLocale: Locale,
  entries: TippableEntry[],
  localSeen: Set<string>,
  keyPrefix: number,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = segment;
  let keyIdx = 0;

  outer: while (rest.length) {
    for (const e of entries) {
      if (localSeen.has(e.label)) continue;
      const idx = rest.indexOf(e.label);
      if (idx >= 0 && isWordBoundary(rest, idx, e.label, glossaryLocale)) {
        if (idx > 0) nodes.push(rest.slice(0, idx));
        nodes.push(
          <GlossaryMark
            key={`${keyPrefix}-${keyIdx++}-${e.label}`}
            display={e.label}
            plain={e.gloss}
            hanzi={e.hanzi}
          />,
        );
        localSeen.add(e.label);
        rest = rest.slice(idx + e.label.length);
        continue outer;
      }
    }
    nodes.push(rest);
    break;
  }

  return nodes;
}

export function GlossaryText({ text, locale, seen }: Props) {
  const glossaryLocale = toGlossaryLocale(locale);
  const entries = tippableEntries(glossaryLocale);
  const localSeen = seen ?? new Set<string>();
  const nodes: ReactNode[] = [];

  GLOSS_TOKEN_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIdx = 0;

  while ((match = GLOSS_TOKEN_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      nodes.push(
        ...renderPlainSegment(plain, glossaryLocale, entries, localSeen, tokenIdx),
      );
    }
    const display = unescapeGlossPart(match[1]);
    const plain = unescapeGlossPart(match[2]);
    nodes.push(
      <GlossaryMark
        key={`gloss-${tokenIdx++}`}
        display={display}
        plain={plain}
      />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...renderPlainSegment(text.slice(lastIndex), glossaryLocale, entries, localSeen, tokenIdx),
    );
  }

  if (nodes.length === 0) {
    return <>{renderPlainSegment(text, glossaryLocale, entries, localSeen, 0)}</>;
  }

  return <>{nodes}</>;
}
