"use client";

import { useTranslations } from "next-intl";

import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  getMatrixSynopsisPlainText,
  matrixSynopsisNarrativeState,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
import type { ToolName } from "@/lib/poju/types";

type Props = {
  product: ToolName;
  locale: string;
  payloadA: PojuMatrixPayload;
  payloadB?: PojuMatrixPayload | null;
  narrative?: MatrixNarrativeResponse | null;
};

/** Tool preview narrative — match: A then B then guide; glyph/syncro: matrix synopsis + guide. */
export function ToolMatrixNarrativeReply({ product, locale, payloadA, payloadB, narrative }: Props) {
  const t = useTranslations("tool_preview");
  const zh = locale.startsWith("zh");

  const displayA = resolveMatrixDisplay(payloadA, locale);
  const { isLlmNarrative, showTemplateFallback, narrativeLoading } =
    matrixSynopsisNarrativeState(displayA);

  const staticGuide = t(`guide.${product}`);
  const guide =
    narrative?.guide?.trim() ||
    displayA.synopsis.prompt?.trim() ||
    staticGuide;

  if (narrativeLoading) {
    return (
      <p className="pchat__streaming-line">
        {zh ? "正在读取能量结构…" : "Reading your energy structure…"}
        <span className="pchat__streaming-cursor">▍</span>
      </p>
    );
  }

  if (product === "match") {
    const blockA = narrative?.narrative_a ?? displayA.synopsis.archetype;
    const blockB = narrative?.narrative_b ?? (payloadB ? resolveMatrixDisplay(payloadB, locale).synopsis.archetype : "");
    return (
      <>
        {blockA ? <p>{blockA}</p> : null}
        {blockB ? <p>{blockB}</p> : null}
        {guide ? <p>{guide}</p> : null}
      </>
    );
  }

  if (isLlmNarrative) {
    return (
      <>
        {displayA.synopsis.archetype ? <p>{displayA.synopsis.archetype}</p> : null}
        {displayA.synopsis.friction ? <p>{displayA.synopsis.friction}</p> : null}
        {guide ? <p>{guide}</p> : null}
      </>
    );
  }

  if (showTemplateFallback) {
    return (
      <>
        {displayA.synopsis.archetype ? <p>{displayA.synopsis.archetype}</p> : null}
        {displayA.synopsis.friction ? <p>{displayA.synopsis.friction}</p> : null}
        <p>{guide}</p>
      </>
    );
  }

  return guide ? <p>{guide}</p> : null;
}

export function toolMatrixNarrativeActionsText(
  product: ToolName,
  payloadA: PojuMatrixPayload,
  payloadB: PojuMatrixPayload | null | undefined,
  locale: string,
  narrative?: MatrixNarrativeResponse | null,
): string {
  const displayA = resolveMatrixDisplay(payloadA, locale);
  const { narrativeLoading } = matrixSynopsisNarrativeState(displayA);
  if (narrativeLoading) return "";

  const parts: string[] = [];
  if (product === "match") {
    if (narrative?.narrative_a) parts.push(narrative.narrative_a);
    if (narrative?.narrative_b) parts.push(narrative.narrative_b);
  } else {
    parts.push(getMatrixSynopsisPlainText(displayA, locale));
  }
  const guide = narrative?.guide ?? displayA.synopsis.prompt;
  if (guide) parts.push(guide);
  if (product === "match" && payloadB && !narrative?.narrative_b) {
    void payloadB;
  }
  return parts.filter(Boolean).join("\n\n");
}
