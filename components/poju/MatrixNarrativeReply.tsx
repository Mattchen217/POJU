"use client";

import { useMemo } from "react";

import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  getMatrixSynopsisPlainText,
  matrixSynopsisNarrativeState,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";

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

/** Synopsis paragraphs only — parent wraps with `AiReplyShell` (avatar + `.pchat__ai`). */
export function MatrixNarrativeReply({ payload, locale }: Props) {
  const zh = locale.startsWith("zh");

  const display = useMemo(() => resolveMatrixDisplay(payload, locale), [payload, locale]);
  const { isLlmNarrative, showTemplateFallback, narrativeLoading } =
    matrixSynopsisNarrativeState(display);

  const synopsisPrompt =
    display.synopsis.prompt ??
    (zh
      ? "请把你此刻最纠结、迟迟定不下来的问题或困境写在下方对话框并发送——我会结合你的能量结构，陪你一步步拆开。"
      : "Tell me the question or dilemma you're weighing right now — type it in the box below and send, and we'll work through it together from your matrix.");

  if (narrativeLoading) {
    return (
      <p className="pchat__streaming-line">
        {zh ? "POJU 正在读取你的能量结构…" : "POJU is reading your energy structure…"}
        <span className="pchat__streaming-cursor">▍</span>
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

export function matrixNarrativeActionsText(payload: PojuMatrixPayload, locale: string): string {
  const display = resolveMatrixDisplay(payload, locale);
  const { narrativeLoading } = matrixSynopsisNarrativeState(display);
  if (narrativeLoading) return "";
  return getMatrixSynopsisPlainText(display, locale);
}
