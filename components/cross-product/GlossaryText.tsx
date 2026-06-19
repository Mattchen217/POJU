"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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

function GlossaryMark({ entry }: { entry: TippableEntry }) {
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
      {entry.label}
      {entry.hanzi ? ` (${entry.hanzi})` : ""}
      {open ? (
        <span id={id} role="tooltip" className="glossary-pop">
          <span className="glossary-pop__title">
            {entry.label}
            {entry.hanzi ? ` (${entry.hanzi})` : ""}
          </span>
          <span className="glossary-pop__body">{entry.gloss}</span>
        </span>
      ) : null}
    </span>
  );
}

export function GlossaryText({ text, locale, seen }: Props) {
  const glossaryLocale = toGlossaryLocale(locale);
  const entries = tippableEntries(glossaryLocale);
  const localSeen = seen ?? new Set<string>();
  const nodes: ReactNode[] = [];
  let rest = text;

  outer: while (rest.length) {
    for (const e of entries) {
      if (localSeen.has(e.label)) continue;
      const idx = rest.indexOf(e.label);
      if (idx >= 0 && isWordBoundary(rest, idx, e.label, glossaryLocale)) {
        nodes.push(rest.slice(0, idx));
        nodes.push(<GlossaryMark key={`${nodes.length}-${e.label}`} entry={e} />);
        localSeen.add(e.label);
        rest = rest.slice(idx + e.label.length);
        continue outer;
      }
    }
    nodes.push(rest);
    break;
  }

  return <>{nodes}</>;
}
