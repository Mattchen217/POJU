/**
 * Delivery TTS narration units: each glass-card heading + body (evidence omitted).
 */

import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";
import {
  DELIVERY_TTS_PAUSE_AFTER_BODY_SEC,
  DELIVERY_TTS_PAUSE_AFTER_TITLE_SEC,
  DELIVERY_TTS_PAUSE_BODY_SPLIT_SEC,
  DELIVERY_TTS_UTTERANCE_CHARS,
} from "@/lib/tts/delivery-tts-constants";

export type DeliveryNarrationUnit = {
  title: string;
  body: string;
};

/**
 * Pack paragraphs into utterances ≤ maxChars (sentence/paragraph aware).
 */
export function packNarrationUtterances(text: string, maxChars = DELIVERY_TTS_UTTERANCE_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paras = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };

  const pushPiece = (piece: string) => {
    const t = piece.trim();
    if (!t) return;
    if (t.length > maxChars) {
      flush();
      let rest = t;
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars);
        let cut = Math.max(
          window.lastIndexOf("。"),
          window.lastIndexOf("！"),
          window.lastIndexOf("？"),
          window.lastIndexOf(". "),
          window.lastIndexOf("\n"),
          window.lastIndexOf("，"),
          window.lastIndexOf(", "),
        );
        if (cut < maxChars * 0.35) cut = maxChars;
        else if (cut < window.length - 1) cut += 1;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) buf = rest;
      return;
    }
    if (!buf) {
      buf = t;
      return;
    }
    if (buf.length + 1 + t.length <= maxChars) {
      buf = `${buf}\n\n${t}`;
    } else {
      flush();
      buf = t;
    }
  };

  for (const p of paras) pushPiece(p);
  flush();
  return out.filter(Boolean);
}

/** Heading + body cards in reading order (cover/toc skipped; evidence omitted). */
export function extractDeliveryNarrationUnits(
  fullText: string,
  locale: string,
): DeliveryNarrationUnit[] {
  const pages = buildDeliveryBookPages(fullText);
  const units: DeliveryNarrationUnit[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (page.id === "cover" || page.id === "toc") continue;

    const modules = buildDeliveryBookModules({
      pageTitle: page.title,
      body: page.body,
      dualLayer: page.dualLayer,
      pageIndex: i,
    });

    for (const mod of modules) {
      const title = toCompliantPlainText(mod.title.trim(), locale).trim();
      const body = toCompliantPlainText(mod.body.trim(), locale).trim();
      if (!title && !body) continue;
      units.push({
        title: title || page.title.trim() || "—",
        body,
      });
    }
  }

  return units;
}

export type DeliveryTtsSpeakPiece =
  | { kind: "speech"; role: "title" | "body"; text: string }
  | { kind: "silence"; seconds: number };

/**
 * Title → 1s → body (split if long) → 2s → next title…
 */
export function buildDeliveryTtsSpeakQueue(
  units: DeliveryNarrationUnit[],
  maxUtteranceChars = DELIVERY_TTS_UTTERANCE_CHARS,
): DeliveryTtsSpeakPiece[] {
  const queue: DeliveryTtsSpeakPiece[] = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.title.trim()) {
      queue.push({ kind: "speech", role: "title", text: u.title.trim() });
      queue.push({ kind: "silence", seconds: DELIVERY_TTS_PAUSE_AFTER_TITLE_SEC });
    }

    const bodyParts = packNarrationUtterances(u.body, maxUtteranceChars);
    for (let j = 0; j < bodyParts.length; j++) {
      const part = bodyParts[j]!;
      if (!part) continue;
      queue.push({ kind: "speech", role: "body", text: part });
      if (j < bodyParts.length - 1) {
        queue.push({ kind: "silence", seconds: DELIVERY_TTS_PAUSE_BODY_SPLIT_SEC });
      }
    }

    if (i < units.length - 1) {
      queue.push({ kind: "silence", seconds: DELIVERY_TTS_PAUSE_AFTER_BODY_SEC });
    }
  }

  return queue;
}

/** Plain corpus used for length / hash (titles + bodies). */
export function narrationUnitsPlainCorpus(units: DeliveryNarrationUnit[]): string {
  return units
    .map((u) => `${u.title}\n${u.body}`.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
