/**
 * Reader soft-exit for ANY EvidenceBlock / dual-evidence fold:
 * one vernacular prose paragraph with logical connectors.
 * Soft coined terms + hover glossary stay; track labels and term-string dumps go.
 * Lab intermediate multi-track stages may keep markers; this is the reader UI exit only.
 */

import { assembleSoftConnectiveStructuralIfNeeded } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { repairAdjacentSsotSoftGlue } from "@/lib/llm/sanitize/term-marking";
import {
  composeTripleEvidence,
  splitDualEvidence,
  type DualEvidenceParts,
} from "@/lib/llm/pro/delivery/page-schema/dual-evidence";
import { stripPatternHitClosedRefsFromReaderText } from "@/lib/llm/pro/delivery/book-judgment/schema";

/**
 * Reader-facing track chrome — strip before merge.
 * ZH authoring SoT uses 【命理】/【科学】/【交汇】/【能量配置】; locale_polish + soft
 * may emit EN/ES/FR/DE equivalents (e.g. 【life trajectory analysis】/【Science】/
 * 【Intersection】) or face-segment titles. All must disappear at reader exit.
 */
const TRACK_LABEL_INNERS = [
  // ZH authoring + soft
  "命理",
  "科学",
  "交汇",
  "能量配置",
  "可核对锚",
  "命理依据",
  "科学依据",
  "交汇依据",
  // EN (locale_polish / soft / Face02 / section titles)
  "life trajectory analysis",
  "life trajectory",
  "destiny reason",
  "destiny",
  "science",
  "science mechanism",
  "science basis",
  "intersection",
  "convergence",
  "metaphysics",
  "metaphysics basis",
  "energy configuration",
  "checkable anchor",
  "checkable anchors",
  // ES
  "base metafísica",
  "base científica",
  "convergencia",
  "razón metafísica",
  "mecanismo científico",
  "anclas verificables",
  // FR
  "fondement métaphysique",
  "fondement scientifique",
  "raison métaphysique",
  "mécanisme scientifique",
  "ancres vérifiables",
  // DE
  "metaphysische basis",
  "wissenschaftliche basis",
  "konvergenz",
  "schicksalsgrund",
  "wissenschaftlicher mechanismus",
  "prüfbare anker",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TRACK_LABEL_INNER_ALT = TRACK_LABEL_INNERS.map(escapeRegExp).join("|");

/** 【…】 / [[…]] track chrome (case-insensitive for Latin locales). */
const TRACK_LABEL_RE = new RegExp(
  `【(?:${TRACK_LABEL_INNER_ALT})】|\\[\\[(?:${TRACK_LABEL_INNER_ALT})\\]\\]`,
  "gi",
);

/** Line/section titles + D checkable-anchor prefixes (not mid-sentence prose). */
const SECTION_TITLE_RE =
  /(?:^|\n)\s*(?:命理依据|科学依据|交汇依据|能量配置|可核对锚|Metaphysics basis|Science basis|Science mechanism|Destiny reason|Convergence|Intersection|Checkable anchors?|Base metafísica|Base científica|Convergencia|Razón metafísica|Mecanismo científico|Anclas verificables|Fondement métaphysique|Fondement scientifique|Raison métaphysique|Mécanisme scientifique|Ancres vérifiables|Metaphysische Basis|Wissenschaftliche Basis|Konvergenz|Schicksalsgrund|Wissenschaftlicher Mechanismus|Prüfbare Anker|Life trajectory analysis)\s*[:：]?\s*/gi;

/** Normalize localized destiny chrome to ZH split mark before splitDualEvidence. */
const META_CHROME_TO_SPLIT_RE = new RegExp(
  `【(?:命理|能量配置|life trajectory analysis|life trajectory|destiny reason|destiny|metaphysics(?: basis)?|energy configuration|base metafísica|razón metafísica|fondement métaphysique|raison métaphysique|metaphysische basis|schicksalsgrund)】`,
  "gi",
);
const SCI_CHROME_TO_SPLIT_RE = new RegExp(
  `【(?:科学|science(?: mechanism| basis)?|base científica|mecanismo científico|fondement scientifique|mécanisme scientifique|wissenschaftliche basis|wissenschaftlicher mechanismus)】`,
  "gi",
);
const CONV_CHROME_TO_SPLIT_RE = new RegExp(
  `【(?:交汇|intersection|convergence|convergencia|konvergenz)】`,
  "gi",
);

export function stripEvidenceTrackLabels(text: string): string {
  return (text ?? "")
    .replace(TRACK_LABEL_RE, "")
    .replace(SECTION_TITLE_RE, (m) => (m.startsWith("\n") ? "\n" : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Map localized 【track】 chrome to ZH split markers for legacy combined strings. */
export function normalizeEvidenceTrackMarksForSplit(text: string): string {
  return (text ?? "")
    .replace(META_CHROME_TO_SPLIT_RE, "【命理】")
    .replace(SCI_CHROME_TO_SPLIT_RE, "【科学】")
    .replace(CONV_CHROME_TO_SPLIT_RE, "【交汇】");
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
    // Soft / locale_polish may leave localized 【track】 chrome; map to ZH split marks.
    const normalizedText = normalizeEvidenceTrackMarksForSplit(opts.text ?? "");
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
  // Soft-plain Lab/report path may already be marker-stripped — repair abutting SSOT softs.
  out = repairAdjacentSsotSoftGlue(out, locale);
  out = out
    .replace(/\s*\n+\s*/g, joinLocale(locale) === "zh" ? "" : " ")
    .trim();
  // Reader merge-for-reader exit: hide ZFP hit:<id>:<level> closed refs.
  out = stripPatternHitClosedRefsFromReaderText(out);
  return out;
}

/** @deprecated alias — Face02 product lock used this name first. */
export const mergeFace02ReaderEvidenceProse = mergeReaderEvidenceProse;

/** True when rendered reader evidence still leaks track chrome. */
export function readerEvidenceHasTrackChrome(text: string): boolean {
  const t = text ?? "";
  TRACK_LABEL_RE.lastIndex = 0;
  if (TRACK_LABEL_RE.test(t)) return true;
  SECTION_TITLE_RE.lastIndex = 0;
  if (SECTION_TITLE_RE.test(t)) return true;
  return /命理依据|科学依据|交汇依据|Checkable anchors?|life trajectory analysis/i.test(
    t,
  );
}
