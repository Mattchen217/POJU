/**
 * Pipeline v3 · early Phase B category gates on body (visible fields).
 * Only验不改. Currently: P2 why_cards.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";

const P2_VISIBLE_JARGON_RE =
  /宫位|相冲|相害|半合|火局|大运|流年|流月|月令|时支|日支|奇门|死门|开门|用神|喜神|忌神|食神|偏印|正印|财星|七杀|比劫/;

const P2_ESSENCE_IMPERATIVE_RE =
  /你需要|应主动|应当|应该|宜守|宜退避|需要警惕|须注意|需要主动|需要外力|需要.*厘清|需要.*约定|需要.*挖掘/;

export function gateBodyCategoryB(input: {
  key: DeliverySegmentKey;
  page_schema?: DeliveryPageData | null;
}): ContentGateVerdict | null {
  if (input.key !== "foundation" || !input.page_schema) return null;

  const page = input.page_schema as {
    why_cards?: Array<{
      title?: string;
      surface?: string;
      essence?: string;
    }>;
  };
  const cards = page.why_cards;
  if (!Array.isArray(cards) || cards.length === 0) return null;

  const notes: string[] = ["gate_phase:b_early_body", "ruler:category_no_mutate"];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]!;
    const visible = `${c.title ?? ""}\n${c.surface ?? ""}\n${c.essence ?? ""}`;
    if (P2_VISIBLE_JARGON_RE.test(visible)) {
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
