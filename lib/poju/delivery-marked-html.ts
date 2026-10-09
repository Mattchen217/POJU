/**
 * Offline HTML for delivery marked text — same pipeline as GlossaryText / MarkedInline.
 * body → prepareBodyTextForGlossaryRender (no gold)
 * evidence → prepareTextForGlossaryRender + term-mark spans (gold / polarity)
 */

import { glossOf, termOf } from "@/lib/glossary/pojulife-terms";
import { toGlossaryLocale } from "@/lib/glossary/term-glossary";
import { termPolarityById } from "@/lib/glossary/term-polarity";
import {
  GLOSS_TOKEN_PATTERN,
  prepareBodyTextForGlossaryRender,
  unescapeGlossPart,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  parseTermMarkers,
  plainByTermId,
  prepareTextForGlossaryRender,
  stripBrokenMarkers,
  TERM_MARKER_PATTERN,
  uiTermById,
  unescapeMarkerPart,
} from "@/lib/llm/sanitize/term-marking";
import {
  isPeelClusterGap,
  joinPeelGlosses,
  joinPeelSoftLabels,
  MAX_PEEL_CLUSTER_ATOMS,
  mergePeelPolarities,
} from "@/lib/poju/peel-term-cluster";
import type { TermPolarity } from "@/lib/glossary/term-polarity";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPlainSegmentHtml(segment: string): string {
  if (!segment) return "";
  const clean = stripBrokenMarkers(segment);
  if (!clean) return "";

  let out = "";
  const boldRe = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  boldRe.lastIndex = 0;
  while ((m = boldRe.exec(clean)) !== null) {
    if (m.index > last) {
      out += escapeHtml(clean.slice(last, m.index));
    }
    out += `<strong class="reading-strong">${escapeHtml(m[1]!)}</strong>`;
    last = m.index + m[0].length;
  }
  if (last < clean.length) out += escapeHtml(clean.slice(last));
  return out;
}

type MarkerHit = {
  index: number;
  raw: string;
  kind: "t" | "g";
  groups: string[];
};

function findNextMarker(text: string, from: number): MarkerHit | null {
  TERM_MARKER_PATTERN.lastIndex = from;
  GLOSS_TOKEN_PATTERN.lastIndex = from;
  const tMatch = TERM_MARKER_PATTERN.exec(text);
  const gMatch = GLOSS_TOKEN_PATTERN.exec(text);
  if (!tMatch && !gMatch) return null;
  if (tMatch && (!gMatch || tMatch.index <= gMatch.index)) {
    return {
      index: tMatch.index,
      raw: tMatch[0],
      kind: "t",
      groups: [tMatch[1]!, tMatch[2]!, tMatch[3] ?? ""],
    };
  }
  return {
    index: gMatch!.index,
    raw: gMatch![0],
    kind: "g",
    groups: [gMatch![1]!, gMatch![2]!],
  };
}

function termMarkHtml(opts: {
  soft: string;
  plain: string;
  polarity: string;
  bracketSoft: boolean;
  /** Peel clusters keep full soft (本元·充沛); singles still ellipsis at 12. */
  fullSoft?: boolean;
}): string {
  const trimmed = opts.soft.trim();
  const softLabel = opts.fullSoft ? trimmed : trimmed.slice(0, 12);
  const display = opts.bracketSoft ? `[${softLabel}]` : softLabel;
  const polarity = opts.polarity || "neutral";
  const interactive = Boolean(opts.plain.trim());
  const wordClass = [
    "term-mark__word",
    interactive ? "term-mark__word--interactive" : "",
    opts.bracketSoft ? "term-mark__word--bracket" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const bracketClass = opts.bracketSoft ? " term-mark--bracket" : "";
  const title = opts.plain.trim()
    ? ` title="${escapeHtml(opts.plain.trim())}"`
    : "";
  return `<span class="term-mark term-mark--${escapeHtml(polarity)}${bracketClass}"><span class="${wordClass}"${title}>${escapeHtml(display)}</span></span>`;
}

/**
 * Evidence layer HTML — mirrors GlossaryText layer="evidence" + bracketSoft=false.
 * Unlimited gold marks; duplicates demote to plain soft (same as MarkedInline).
 */
export function renderDeliveryEvidenceMarkedHtml(
  text: string,
  locale: string,
  opts?: { bracketSoft?: boolean },
): string {
  if (!text?.trim()) return "";
  const bracketSoft = opts?.bracketSoft ?? false;
  const prepared = prepareTextForGlossaryRender(text, locale);
  const glossaryLocale = toGlossaryLocale(locale);
  const paragraphs = prepared.split(/(\n\n+)/);
  const globalSeen = new Set<string>();
  const chunks: string[] = [];

  for (const chunk of paragraphs) {
    if (/^\n\n+$/.test(chunk)) {
      chunks.push("<br/><br/>");
      continue;
    }
    const paraSeen = new Set<string>(globalSeen);
    let out = "";
    let cursor = 0;
    while (cursor < chunk.length) {
      const next = findNextMarker(chunk, cursor);
      if (!next) {
        out += renderPlainSegmentHtml(chunk.slice(cursor));
        break;
      }
      if (next.index > cursor) {
        out += renderPlainSegmentHtml(chunk.slice(cursor, next.index));
      }
      if (next.kind === "t") {
        type PeelAtom = {
          termId: string;
          soft: string;
          plain: string;
          polarity: TermPolarity;
          slot2: string;
          end: number;
        };
        const resolveAtom = (
          hit: MarkerHit,
        ): PeelAtom | null => {
          const termId = hit.groups[0]!;
          const slot2 = unescapeMarkerPart(hit.groups[1] ?? "").trim();
          const isThreeSlot = (hit.raw.match(/\|/g) || []).length >= 2;
          const slot3 = isThreeSlot
            ? unescapeMarkerPart(hit.groups[2] ?? "").trim()
            : "";
          const ui = uiTermById(termId, glossaryLocale);
          const soft = termOf(termId, glossaryLocale) || ui?.soft || "";
          const plain =
            glossOf(termId, glossaryLocale) ||
            ui?.plain ||
            plainByTermId(termId, glossaryLocale) ||
            (isThreeSlot ? slot3 : slot2) ||
            "";
          if (!soft) return null;
          return {
            termId,
            soft,
            plain,
            polarity: ui?.polarity ?? termPolarityById(termId),
            slot2,
            end: hit.index + hit.raw.length,
          };
        };

        const first = resolveAtom(next);
        if (!first) {
          const termId = next.groups[0]!;
          const slot2 = unescapeMarkerPart(next.groups[1] ?? "").trim();
          const ui = uiTermById(termId, glossaryLocale);
          const plain =
            glossOf(termId, glossaryLocale) ||
            ui?.plain ||
            plainByTermId(termId, glossaryLocale) ||
            slot2 ||
            termId;
          out += escapeHtml(plain);
          cursor = next.index + next.raw.length;
          continue;
        }

        const atoms: PeelAtom[] = [first];
        let clusterEnd = first.end;
        while (atoms.length < MAX_PEEL_CLUSTER_ATOMS) {
          const peek = findNextMarker(chunk, clusterEnd);
          if (!peek || peek.kind !== "t") break;
          if (!isPeelClusterGap(chunk.slice(clusterEnd, peek.index))) break;
          const atom = resolveAtom(peek);
          if (!atom) break;
          atoms.push(atom);
          clusterEnd = atom.end;
        }

        const softOnly = joinPeelSoftLabels(atoms.map((a) => a.soft));
        const plain = joinPeelGlosses(atoms.map((a) => a.plain));
        const polarity = mergePeelPolarities(atoms.map((a) => a.polarity));
        const anySeen = atoms.some((a) => paraSeen.has(a.termId));
        for (const a of atoms) paraSeen.add(a.termId);

        if (anySeen) {
          out += escapeHtml(softOnly);
        } else {
          out += termMarkHtml({
            soft: softOnly,
            plain,
            polarity,
            bracketSoft,
            fullSoft: atoms.length > 1,
          });
        }
        cursor = clusterEnd;
        continue;
      } else {
        const display = unescapeGlossPart(next.groups[0]!);
        const plain = unescapeGlossPart(next.groups[1]!);
        out += termMarkHtml({
          soft: display,
          plain,
          polarity: "neutral",
          bracketSoft,
        });
      }
      cursor = next.index + next.raw.length;
    }
    for (const id of paraSeen) globalSeen.add(id);
    // Collapse single newlines so marks stay inline (same as delivery-book-stage evidence prose).
    chunks.push(out.replace(/\s*\n+\s*/g, " ").trim());
  }

  const joined = chunks.filter(Boolean).join("<br/><br/>").trim();
  return joined ? `<p class="poju-delivery-v2__p">${joined}</p>` : "";
}

/** Body layer HTML — zero gold; mirrors GlossaryText layer="body". */
export function renderDeliveryBodyMarkedHtml(text: string, locale: string): string {
  if (!text?.trim()) return "";
  const prepared = prepareBodyTextForGlossaryRender(text, locale).trim();
  if (!prepared) return "";
  const plain = stripBrokenMarkers(prepared);
  return plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p class="poju-delivery-v2__p">${renderPlainSegmentHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
}

/** @deprecated keep for tests that want raw marker count */
export function countEvidenceTermMarks(text: string, locale: string): number {
  const prepared = prepareTextForGlossaryRender(text, locale);
  return parseTermMarkers(prepared).length;
}
