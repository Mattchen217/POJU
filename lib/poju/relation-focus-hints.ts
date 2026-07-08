/**
 * Block 66 — 定向关系聚焦：从本轮用户输入抽取 focusHints（本地、确定性）。
 */

import type { Palace } from "@/lib/calculations/relation-engine";

export type RelationTenGodFocus = "wealth_officer" | "peer_output" | "relationship";

export type RelationFocusHints = {
  /** Matched semantic themes (wealth / team / relationship / …). */
  themes: string[];
  /** Palaces to boost when scoring directed relations. */
  palaceBoost: Palace[];
  /** Ten-god tension slice to prefer. */
  tenGodFocus: RelationTenGodFocus | null;
  /** Seed for deterministic rotation when themes are sparse. */
  rotationSeed: string;
};

const WEALTH_RE =
  /融资|资金|收入|赚钱|盈利|变现|烧钱|广告|付费|客户|钱|投资|financ|revenue|monet|income|fund|profit|cash/i;
const TEAM_RE =
  /团队|合伙|伙伴|员工|同事|人|合作|招聘|team|partner|collabor|co-?found|hire|staff/i;
const RELATIONSHIP_RE =
  /伴侣|感情|婚姻|恋|配偶|男朋友|女朋友|relationship|spouse|marriage|dating|partner/i;

/** Lightweight keyword/semantic focus from the latest user message (no LLM). */
export function extractRelationFocusHintsFromText(text: string): RelationFocusHints {
  const trimmed = text.trim();
  const themes: string[] = [];
  const palaceSet = new Set<Palace>();
  let tenGodFocus: RelationTenGodFocus | null = null;

  if (WEALTH_RE.test(trimmed)) {
    themes.push("wealth");
    palaceSet.add("career");
    palaceSet.add("self");
    tenGodFocus = "wealth_officer";
  }
  if (TEAM_RE.test(trimmed)) {
    themes.push("team");
    palaceSet.add("career");
    palaceSet.add("result");
    if (!tenGodFocus) tenGodFocus = "peer_output";
  }
  if (RELATIONSHIP_RE.test(trimmed)) {
    themes.push("relationship");
    palaceSet.add("spouse");
    palaceSet.add("self");
    tenGodFocus = "relationship";
  }

  return {
    themes,
    palaceBoost: [...palaceSet],
    tenGodFocus,
    rotationSeed: trimmed.slice(0, 240) || "default",
  };
}
