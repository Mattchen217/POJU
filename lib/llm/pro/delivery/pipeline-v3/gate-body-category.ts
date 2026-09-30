/**
 * Pipeline v3 · early Phase B category gates on body (visible fields).
 * Only验不改. P2 why_cards · P1 primary/backup 可见字段.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";

/** 可见层命理专名族（类别 · 含半白话十神合称）。 */
const VISIBLE_JARGON_RE =
  /宫位|相冲|相害|半合|火局|大运|流年|流月|月令|时支|日支|奇门|死门|开门|用神|喜神|忌神|食神|食伤|伤官|偏印|正印|财星|七杀|比劫|比肩|正财|偏财/;

const P2_ESSENCE_IMPERATIVE_RE =
  /你需要|应主动|应当|应该|宜守|宜退避|需要警惕|须注意|需要主动|需要外力|需要.*厘清|需要.*约定|需要.*挖掘/;

function p1VisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    core_judgment?: string;
    primary?: Record<string, unknown>;
    backup?: Record<string, unknown>;
  };
  const track = (t: Record<string, unknown> | undefined) =>
    [
      t?.name,
      t?.core_logic,
      t?.why,
      t?.when,
      t?.strategic_goal,
      t?.leverage_chip,
    ]
      .map((x) => String(x ?? ""))
      .join("\n");
  return [
    p.page_title,
    p.page_subtitle,
    p.core_judgment,
    track(p.primary as Record<string, unknown> | undefined),
    track(p.backup as Record<string, unknown> | undefined),
  ].join("\n");
}

export function gateBodyCategoryB(input: {
  key: DeliverySegmentKey;
  page_schema?: DeliveryPageData | null;
}): ContentGateVerdict | null {
  if (!input.page_schema) return null;

  const notes: string[] = ["gate_phase:b_early_body", "ruler:category_no_mutate"];

  if (input.key === "direct_answer") {
    const visible = p1VisibleBlob(input.page_schema);
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p1_body_visible_jargon",
        detail:
          "P1 可见字段（含 leverage_chip/strategic_goal）含命理专名报幕。真词只留 chart_anchors；回改正文提示后重跑——闸门不改稿。",
        notes,
      };
    }
    return null;
  }

  if (input.key !== "foundation") return null;

  const page = input.page_schema as {
    why_cards?: Array<{
      title?: string;
      surface?: string;
      essence?: string;
    }>;
  };
  const cards = page.why_cards;
  if (!Array.isArray(cards) || cards.length === 0) return null;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]!;
    const visible = `${c.title ?? ""}\n${c.surface ?? ""}\n${c.essence ?? ""}`;
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p2_body_visible_jargon",
        detail: `P2 why_cards[${i}] 可见层含命理专名报幕。回改正文提示后重跑——闸门不改稿。`,
        notes: [...notes, `card:${i}`],
      };
    }
    if (P2_ESSENCE_IMPERATIVE_RE.test(String(c.essence ?? ""))) {
      return {
        passed: false,
        failed_rule: "gate_p2_body_essence_imperative",
        detail: `P2 why_cards[${i}].essence 含怎么办/半祈使（需要…/应…）。只解释为何卡，停在结构张力后重跑。`,
        notes: [...notes, `card:${i}`],
      };
    }
  }

  return null;
}
