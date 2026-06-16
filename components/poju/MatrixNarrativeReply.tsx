"use client";

import { useMemo } from "react";

import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

function renderRichText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
  );
}

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
};

/** Matrix onboarding copy — rendered as standard assistant paragraphs inside `.pchat__ai`. */
export function MatrixNarrativeReply({ payload, locale }: Props) {
  const zh = locale.startsWith("zh");
  const { structured, user_profile, wuxing_scores, strength } = payload;

  const display = useMemo(
    () =>
      payload.display ??
      buildMatrixDisplayData({
        profile: user_profile,
        structured,
        strength,
        wuxing_scores,
        locale,
      }),
    [payload.display, user_profile, structured, strength, wuxing_scores, locale],
  );

  const isLlmNarrative = display.narrative_source === "llm";
  const showTemplateFallback = display.narrative_failed === true;
  const narrativeLoading = !isLlmNarrative && !showTemplateFallback;

  const synopsisPrompt =
    display.synopsis.prompt ??
    (zh
      ? "把你反复掂量、又迟迟定不下来的那个问题告诉我——发在下面，我会结合你的命盘，和你一步步拆开。"
      : "Tell me the question or dilemma you keep weighing and cannot settle — share it below, and I'll walk through it with you, grounded in your chart.");

  if (narrativeLoading) {
    return (
      <p className="pem-matrix-narrative pem-matrix-narrative--loading">
        {zh ? "POJU 正在读取你的能量结构…" : "POJU is reading your energy structure…"}
      </p>
    );
  }

  if (isLlmNarrative) {
    return (
      <>
        {display.synopsis.archetype ? <p>{display.synopsis.archetype}</p> : null}
        {display.synopsis.friction ? <p>{display.synopsis.friction}</p> : null}
        {display.synopsis.prompt ? <p>{display.synopsis.prompt}</p> : null}
      </>
    );
  }

  if (showTemplateFallback) {
    return (
      <>
        {display.synopsis.archetype ? <p>{renderRichText(display.synopsis.archetype)}</p> : null}
        {display.synopsis.friction ? <p>{renderRichText(display.synopsis.friction)}</p> : null}
        {synopsisPrompt ? <p>{synopsisPrompt}</p> : null}
      </>
    );
  }

  return null;
}
