"use client";

import { useEffect, useState } from "react";

import "@/styles/glossary.css";

const HINT_KEY = "poju-term-hint-seen";

/** One-time hint at delivery view top — not inside each GlossaryText field. */
export function TermMarkFirstVisitHint() {
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
      <button
        type="button"
        className="term-hint__dismiss"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(HINT_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        Got it
      </button>
    </p>
  );
}
