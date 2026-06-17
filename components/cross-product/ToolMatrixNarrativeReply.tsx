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

function matchPersonLabel(person: "A" | "B", locale: string): string {
  return locale.startsWith("zh") ? `命主 ${person}` : `Person ${person}`;
}

function matchPersonFallbackBlock(
  person: "A" | "B",
  payload: PojuMatrixPayload,
  locale: string,
): string {
  const display = resolveMatrixDisplay(payload, locale);
  const label = matchPersonLabel(person, locale);
  const parts = [display.synopsis.archetype, display.synopsis.friction].filter(Boolean);
  return `${label}：${parts.join(" ")}`;
}

function matchPersonBlock(
  person: "A" | "B",
  payload: PojuMatrixPayload,
  locale: string,
  narrative?: MatrixNarrativeResponse | null,
): string {
  const fromNarrative = person === "A" ? narrative?.narrative_a : narrative?.narrative_b;
  if (fromNarrative?.trim()) return fromNarrative.trim();
  return matchPersonFallbackBlock(person, payload, locale);
}

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
  const synopsisArchetype =
    narrative?.poju_onboarding?.archetype_intro?.trim() || displayA.synopsis.archetype;
  const synopsisFriction =
    narrative?.poju_onboarding?.core_conflict?.trim() || displayA.synopsis.friction;

  if (narrativeLoading) {
    return (
      <p className="pchat__streaming-line">
        {zh ? "正在读取能量结构…" : "Reading your energy structure…"}
        <span className="pchat__streaming-cursor">▍</span>
      </p>
    );
  }

  if (product === "match") {
    const blockA = matchPersonBlock("A", payloadA, locale, narrative);
    const blockB = payloadB ? matchPersonBlock("B", payloadB, locale, narrative) : "";
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
        {synopsisArchetype ? <p>{synopsisArchetype}</p> : null}
        {synopsisFriction ? <p>{synopsisFriction}</p> : null}
        {guide ? <p>{guide}</p> : null}
      </>
    );
  }

  if (showTemplateFallback) {
    return (
      <>
        {synopsisArchetype ? <p>{synopsisArchetype}</p> : null}
        {synopsisFriction ? <p>{synopsisFriction}</p> : null}
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
    parts.push(matchPersonBlock("A", payloadA, locale, narrative));
    if (payloadB) parts.push(matchPersonBlock("B", payloadB, locale, narrative));
  } else {
    parts.push(getMatrixSynopsisPlainText(displayA, locale));
  }
  const guide = narrative?.guide ?? displayA.synopsis.prompt;
  if (guide) parts.push(guide);
  return parts.filter(Boolean).join("\n\n");
}
