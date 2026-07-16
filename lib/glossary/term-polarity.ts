/**
 * Term polarity for delivery UI coloring (favorable / neutral / caution).
 * SSOT: POJU_TERMS.polarity (with relation-marker instance fallback).
 */

import { relationPolarityToken } from "@/lib/glossary/term-closed-set";
import { pojuTermBySlug, type TermPolarity as PojuPolarity } from "@/lib/glossary/pojulife-terms";

export type TermPolarity = PojuPolarity;

export function termPolarityById(termId: string): TermPolarity {
  const rel = relationPolarityToken(termId);
  if (rel === "green") return "favorable";
  if (rel === "red") return "caution";
  if (rel === "gold") return "neutral";

  const leaf = termId.includes(":") ? termId.split(":").pop()! : termId;
  const fromSsot = pojuTermBySlug(leaf) ?? pojuTermBySlug(termId);
  if (fromSsot) return fromSsot.polarity;

  return "neutral";
}
