"use client";

import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  matrixSynopsisNarrativeState,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
import { tMatrix } from "@/lib/poju/poju-matrix-i18n";

import "@/styles/poju-matrix-welcome.css";

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
};

function WelcomeBlock({ text, className }: { text: string; className: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <p className={className}>
      {lines.map((line, i) => (
        <span key={i} className="pmw__line">
          {line}
        </span>
      ))}
    </p>
  );
}

/** Fixed centered welcome — not a chat-style matrix synopsis. */
export function MatrixNarrativeReply({ payload, locale }: Props) {
  const display = resolveMatrixDisplay(payload, locale);
  const { narrativeLoading } = matrixSynopsisNarrativeState(display);

  if (narrativeLoading) {
    return (
      <div className="pmw" role="status">
        <div className="pmw__mark pmw__mark--pulse" aria-hidden>
          <PojuAiAvatar className="pmw__mark-avatar" />
        </div>
        <p className="pmw__loading">{tMatrix(locale, "card.welcome.loading")}</p>
      </div>
    );
  }

  return (
    <section className="pmw" aria-label={tMatrix(locale, "card.welcome.title")}>
      <div className="pmw__mark" aria-hidden>
        <PojuAiAvatar className="pmw__mark-avatar" />
      </div>
      <h2 className="pmw__title">{tMatrix(locale, "card.welcome.title")}</h2>
      <WelcomeBlock className="pmw__intro" text={tMatrix(locale, "card.welcome.intro")} />
      <WelcomeBlock className="pmw__cta" text={tMatrix(locale, "card.welcome.cta")} />
    </section>
  );
}

export function matrixNarrativeActionsText(
  _payload: PojuMatrixPayload,
  locale: string,
): string {
  void locale;
  return "";
}
