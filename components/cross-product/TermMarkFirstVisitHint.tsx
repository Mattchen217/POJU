"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import "@/styles/glossary.css";

const HINT_KEY = "poju-term-hint-seen";

/** One-time yellow bar — hover / tap [···] on highlighted terms. */
export function TermMarkFirstVisitHint() {
  const t = useTranslations("glyph");
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
    <aside className="term-hint term-hint--bar" role="note">
      <p className="term-hint__body">
        {t("term_mark_hint")}{" "}
        <span className="term-mark__info term-mark__info--inline" aria-hidden>
          [···]
        </span>{" "}
        {t("term_mark_hint_suffix")}
      </p>
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
        {t("term_mark_ack")}
      </button>
    </aside>
  );
}
