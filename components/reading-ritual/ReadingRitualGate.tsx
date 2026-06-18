"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import type { ReadingRitualProduct } from "@/lib/reading-ritual/reading-ritual-storage";

import "@/styles/reading-ritual.css";

export type ReadingRitualGateProps = {
  product: ReadingRitualProduct;
  /** LLM / report generation finished */
  ready: boolean;
  onEnter: () => void;
  onSkip: () => void;
};

const ITEM_COUNT = 3;

export function ReadingRitualGate({ product, ready, onEnter, onSkip }: ReadingRitualGateProps) {
  const t = useTranslations("reading_ritual.gate");
  const [checked, setChecked] = useState<boolean[]>(() => Array(ITEM_COUNT).fill(false));

  const allChecked = checked.every(Boolean);
  const anyChecked = checked.some(Boolean);
  const canEnter = ready && anyChecked;

  const toggle = useCallback((index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setChecked(Array(ITEM_COUNT).fill(true));
  }, []);

  return (
    <div className="reading-ritual-panel">
      <h3 className="reading-ritual-panel__title">{t(`title.${product}`)}</h3>
      <ul className="reading-ritual-panel__checks">
        {Array.from({ length: ITEM_COUNT }, (_, i) => (
          <li key={i}>
            <label className="reading-ritual-panel__check">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
              />
              <span>{t(`items.${i}` as "items.0")}</span>
            </label>
          </li>
        ))}
      </ul>
      {!allChecked ? (
        <button type="button" className="reading-ritual-panel__select-all" onClick={selectAll}>
          {t("select_all")}
        </button>
      ) : null}
      <button
        type="button"
        className={`reading-ritual-panel__cta${!ready ? " reading-ritual-panel__cta--waiting" : ""}`}
        disabled={!canEnter}
        onClick={onEnter}
      >
        {ready ? t("cta") : t("cta_waiting")}
      </button>
      <button type="button" className="reading-ritual-panel__skip" onClick={onSkip}>
        {t("skip")}
      </button>
    </div>
  );
}
