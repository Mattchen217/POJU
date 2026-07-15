"use client";

import { useMemo } from "react";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { ReadingRitualTeaser } from "@/components/reading-ritual/ReadingRitualTeaser";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  getMatrixSynopsisPlainText,
  matrixSynopsisNarrativeState,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
};

/** Synopsis — same RichReadingText pipeline as full report (markers + ## parsing). */
export function MatrixNarrativeReply({ payload, locale }: Props) {
  const zh = locale.startsWith("zh");

  const display = useMemo(() => resolveMatrixDisplay(payload, locale), [payload, locale]);
  const { showTemplateFallback, narrativeLoading } = matrixSynopsisNarrativeState(display);
  // PART 2: template is the product path — only flag true failure fallbacks.
  const showFailureFallback =
    display.narrative_failed === true && showTemplateFallback;

  const synopsisPrompt =
    display.synopsis.prompt ??
    (zh
      ? "请把你此刻最纠结、迟迟定不下来的问题或困境写在下方对话框并发送——我会结合你的能量结构，陪你一步步拆开。"
      : "Tell me the question or dilemma you're weighing right now — type it in the box below and send, and we'll work through it together from your matrix.");

  const body = [display.synopsis.archetype, display.synopsis.friction, synopsisPrompt]
    .filter((s): s is string => Boolean(s?.trim()))
    .join("\n\n");

  if (narrativeLoading) {
    return (
      <p className="pchat__streaming-line">
        {zh ? "POJU 正在读取你的能量结构…" : "POJU is reading your energy structure…"}
        <span className="pchat__streaming-cursor">〇</span>
      </p>
    );
  }

  if (!body.trim()) return null;

  return (
    <>
      {showFailureFallback ? (
        <p className="text-[11px] opacity-50 mb-2" data-fallback="matrix-template-after-failure">
          {zh ? "当前内容为兜底（模型调用失败）" : "Fallback content (model call failed)"}
        </p>
      ) : null}
      <RichReadingText text={body} locale={locale} />
      <ReadingRitualTeaser product="poju" />
    </>
  );
}

export function matrixNarrativeActionsText(payload: PojuMatrixPayload, locale: string): string {
  const display = resolveMatrixDisplay(payload, locale);
  const { narrativeLoading } = matrixSynopsisNarrativeState(display);
  if (narrativeLoading) return "";
  return getMatrixSynopsisPlainText(display, locale);
}
