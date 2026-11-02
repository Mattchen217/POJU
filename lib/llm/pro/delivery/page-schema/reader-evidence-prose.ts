/**
 * Reader soft-exit for ANY EvidenceBlock / dual-evidence fold:
 * one vernacular prose paragraph with logical connectors.
 * Soft coined terms + hover glossary stay; track labels and term-string dumps go.
 * Lab intermediate multi-track stages may keep markers; this is the reader UI exit only.
 */

import { assembleSoftConnectiveStructuralIfNeeded } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import {
  composeTripleEvidence,
  splitDualEvidence,
  type DualEvidenceParts,
} from "@/lib/llm/pro/delivery/page-schema/dual-evidence";

/** Reader-facing track chrome — strip before merge. */
const TRACK_LABEL_RE =
  /【(?:命理|科学|交汇|能量配置)】|\[\[(?:命理|科学|交汇|能量配置)\]\]/g;

const SECTION_TITLE_RE =
  /(?:^|\n)\s*(?:命理依据|科学依据|交汇依据|能量配置|Metaphysics basis|Science basis|Convergence)\s*[:：]?\s*/gi;

export function stripEvidenceTrackLabels(text: string): string {
  return (text ?? "")
    .replace(TRACK_LABEL_RE, "")
    .replace(SECTION_TITLE_RE, (m) => (m.startsWith("\n") ? "\n" : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function endsWithSentencePunct(s: string): boolean {
  return /[。！？.!?;；：:]$/.test(s.trim());
}

type JoinLocale = "zh" | "en" | "es" | "fr" | "de";

function joinLocale(locale: string): JoinLocale {
  const l = (locale || "zh").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

/** Natural connectors — NOT track headers. */
function connectors(locale: string): { mid: string; close: string } {
  switch (joinLocale(locale)) {
    case "zh":
      return { mid: "同时，", close: "把这些合在一起看，" };
    case "es":
      return { mid: "Al mismo tiempo, ", close: "Tomado en conjunto, " };
    case "fr":
      return { mid: "En même temps, ", close: "Pris ensemble, " };
    case "de":
      return { mid: "Zugleich ", close: "Zusammengenommen " };
    default:
      return { mid: "At the same time, ", close: "Taken together, " };
  }
}

function joinTwo(a: string, b: string, bridge: string, locale: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  const gap = endsWithSentencePunct(left)
    ? ""
    : joinLocale(locale) === "zh"
      ? "。"
      : ". ";
  const spacedBridge =
    joinLocale(locale) === "zh" ? bridge : bridge.replace(/^\s*/, " ");
  const rightLower = right.toLowerCase();
  const bridgeCore = bridge.trim().toLowerCase().replace(/[,，]\s*$/, "");
  if (bridgeCore && rightLower.startsWith(bridgeCore)) {
    return left + gap + right;
  }
  return left + gap + spacedBridge + right;
}

/**
 * Merge destiny / science / convergence (or legacy marked text) into one
 * reader prose paragraph. Soft marks kept; track chrome stripped; soft
 * adjacency thickened via assembleSoftConnectiveStructuralIfNeeded.
 */
export function mergeReaderEvidenceProse(opts: {
  text?: string;
  metaphysics?: string;
  science?: string;
  convergence?: string;
  locale?: string;
}): string {
  const locale = opts.locale ?? "zh";
  const structuredM = stripEvidenceTrackLabels(opts.metaphysics ?? "");
  const structuredS = stripEvidenceTrackLabels(opts.science ?? "");
  const structuredC = stripEvidenceTrackLabels(opts.convergence ?? "");

  let parts: DualEvidenceParts;
  if (structuredM || structuredS || structuredC) {
    parts = composeTripleEvidence(structuredM, structuredS, structuredC);
  } else {
    // Soft destiny chrome uses 【能量配置】 in packs; normalize to split marker.
    const normalizedText = (opts.text ?? "").replace(/【能量配置】/g, "【命理】");
    parts = splitDualEvidence(normalizedText);
    parts = composeTripleEvidence(
      stripEvidenceTrackLabels(parts.metaphysics_evidence),
      stripEvidenceTrackLabels(parts.science_evidence),
      stripEvidenceTrackLabels(parts.convergence_evidence ?? ""),
    );
  }

  const m = parts.metaphysics_evidence.trim();
  const s = parts.science_evidence.trim();
  const c = (parts.convergence_evidence ?? "").trim();
  const { mid, close } = connectors(locale);

  let out = "";
  if (m) out = m;
  if (s) out = joinTwo(out, s, mid, locale);
  if (c) out = joinTwo(out, c, close, locale);

  if (!out) {
    out = stripEvidenceTrackLabels(opts.text ?? "");
  }

  out = assembleSoftConnectiveStructuralIfNeeded(out, locale);
  out = out
    .replace(/\s*\n+\s*/g, joinLocale(locale) === "zh" ? "" : " ")
    .trim();
  return out;
}

/** @deprecated alias — Face02 product lock used this name first. */
export const mergeFace02ReaderEvidenceProse = mergeReaderEvidenceProse;

/** True when rendered reader evidence still leaks track chrome. */
export function readerEvidenceHasTrackChrome(text: string): boolean {
  const t = text ?? "";
  return (
    /【(?:命理|科学|交汇|能量配置)】/.test(t) ||
    /命理依据|科学依据|交汇依据/.test(t)
  );
}
