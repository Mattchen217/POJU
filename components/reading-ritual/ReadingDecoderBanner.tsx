"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import "@/styles/reading-ritual.css";

type Props = {
  variant: "poju" | "others";
  className?: string;
};

export function ReadingDecoderBanner({ variant, className }: Props) {
  const t = useTranslations("reading_ritual.decoder");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside className={`reading-ritual-decoder${className ? ` ${className}` : ""}`} role="note">
      <div className="reading-ritual-decoder__row">
        <p>{t(variant)}</p>
        <button
          type="button"
          className="reading-ritual-decoder__dismiss"
          onClick={() => setDismissed(true)}
        >
          {t("ack")}
        </button>
      </div>
      {variant === "poju" ? (
        <p className="reading-ritual-decoder__hint">{t("poju_hint")}</p>
      ) : null}
    </aside>
  );
}
