/**
 * 交付页提示词索引 · v1 十段（03–06 独立 duty；01/02/07–09 复用既有文件）。
 * 文案硬度不在 W0 改写。内容页只通过 contentPageForFillDuty 对齐 pageId。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  contentPageIdForLegacyKey,
  FILL_DUTY_FILE_REMAP,
} from "@/lib/llm/pro/delivery/page-id-remap";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import * as p1 from "./p1-direct-answer";
import * as p2 from "./p2-foundation";
import * as p3 from "./p3-science-action";
import * as p4 from "./p4-metaphysics-action";
import * as p5 from "./p5-risk-guard";
import * as p6 from "./p6-signals-close";
import * as pPatterns from "./p-patterns";
import * as pBottleneck from "./p-bottleneck";
import * as pOptions from "./p-options";
import * as pStrategy from "./p-strategy";
import * as thirtyDay from "./thirty-day-legacy";

export {
  DELIVERY_FILL_L1_IDENTITY,
  DELIVERY_FILL_L1_PLAIN_JUDGMENT,
  DELIVERY_FINALIZE_SHARED,
  titleRules,
} from "./shared";

type PagePromptModule = {
  PAGE_KEY: DeliverySegmentKey;
  PAGE_LABEL: string;
  FINALIZE_DUTY: string;
  buildFillDuty: (tagZh: string, opts?: { plain_judgment?: boolean }) => string;
  buildAssignDuty?: (tagZh: string) => string;
};

const BY_KEY: Partial<Record<DeliverySegmentKey, PagePromptModule>> = {
  // Face-native (v3 body uses face-prompt.ts; these remain finalize/fill fallbacks)
  "01": p1 as PagePromptModule,
  "02": p2 as PagePromptModule,
  "04": pBottleneck as PagePromptModule,
  "05": pOptions as PagePromptModule,
  "06": p3 as PagePromptModule,
  "08": p5 as PagePromptModule,
  "03": p2 as PagePromptModule,
  "07": p2 as PagePromptModule,
  decision_brief: p1 as PagePromptModule,
  situation_analysis: p2 as PagePromptModule,
  personal_decision_patterns: pPatterns as PagePromptModule,
  bottleneck_analysis: pBottleneck as PagePromptModule,
  strategic_options: pOptions as PagePromptModule,
  recommended_strategy: pStrategy as PagePromptModule,
  execution_guidance: p3 as PagePromptModule,
  self_regulation: p4 as PagePromptModule,
  validation_risk: p5 as PagePromptModule,
  validation_close: p6 as PagePromptModule,
  // legacy
  direct_answer: p1 as PagePromptModule,
  foundation: p2 as PagePromptModule,
  science_action: p3 as PagePromptModule,
  metaphysics_action: p4 as PagePromptModule,
  risk_guard: p5 as PagePromptModule,
  signals_close: p6 as PagePromptModule,
  thirty_day: thirtyDay as PagePromptModule,
};

export function finalizeDutyForKey(key: DeliverySegmentKey): string {
  return BY_KEY[key]?.FINALIZE_DUTY ?? `# 本段职责 · ${key}\n只产出本段双钥匙;勿写其他页任务。`;
}

export function fillDutyForKey(
  key: DeliverySegmentKey,
  tagZh: string,
  opts?: { plain_judgment?: boolean },
): string {
  const mod = BY_KEY[key];
  return mod ? mod.buildFillDuty(tagZh, opts) : "";
}

export function assignDutyForKey(
  key: DeliverySegmentKey,
  tagZh: string,
): string {
  const mod = BY_KEY[key];
  if (mod?.buildAssignDuty) return mod.buildAssignDuty(tagZh);
  return `# 本页派工任务 · 【${tagZh}】\n只写本盘结构主张 + 事实档短摘录；本页用户可见正文留给 fill。`;
}

/** 运行时 duty 键对应的内容页。thirty_day 为 null。不改 duty 正文。 */
export function contentPageForFillDuty(key: DeliverySegmentKey): DecisionPageId | null {
  return contentPageIdForLegacyKey(key);
}

export { FILL_DUTY_FILE_REMAP };

export const ACTIVE_PAGE_PROMPT_FILES = [
  { key: "decision_brief", label: p1.PAGE_LABEL, file: "p1-direct-answer.ts" },
  { key: "situation_analysis", label: p2.PAGE_LABEL, file: "p2-foundation.ts" },
  { key: "personal_decision_patterns", label: pPatterns.PAGE_LABEL, file: "p-patterns.ts" },
  { key: "bottleneck_analysis", label: pBottleneck.PAGE_LABEL, file: "p-bottleneck.ts" },
  { key: "strategic_options", label: pOptions.PAGE_LABEL, file: "p-options.ts" },
  { key: "recommended_strategy", label: pStrategy.PAGE_LABEL, file: "p-strategy.ts" },
  { key: "execution_guidance", label: p3.PAGE_LABEL, file: "p3-science-action.ts" },
  { key: "self_regulation", label: p4.PAGE_LABEL, file: "p4-metaphysics-action.ts" },
  { key: "validation_risk", label: p5.PAGE_LABEL, file: "p5-risk-guard.ts" },
  { key: "validation_close", label: p6.PAGE_LABEL, file: "p6-signals-close.ts" },
] as const;
