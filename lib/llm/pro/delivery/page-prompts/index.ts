/**
 * 交付页提示词索引 · P1–P6 各一份独立文件
 *
 * 改人设/任务/目标 → 打开对应 pN-*.ts，不要往 shared.ts 塞页专属规则。
 *
 * | 页 | 文件 |
 * |----|------|
 * | P1 核心直答 | p1-direct-answer.ts |
 * | P2 归因剖析 | p2-foundation.ts |
 * | P3 破局策略 | p3-science-action.ts |
 * | P4 自我调频 | p4-metaphysics-action.ts |
 * | P5 风险预警 | p5-risk-guard.ts |
 * | P6 行动建议 | p6-signals-close.ts |
 * | 共用底盘 | shared.ts |
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import * as p1 from "./p1-direct-answer";
import * as p2 from "./p2-foundation";
import * as p3 from "./p3-science-action";
import * as p4 from "./p4-metaphysics-action";
import * as p5 from "./p5-risk-guard";
import * as p6 from "./p6-signals-close";
import * as thirtyDay from "./thirty-day-legacy";

export {
  DELIVERY_FILL_L1_IDENTITY,
  DELIVERY_FINALIZE_SHARED,
  titleRules,
} from "./shared";

type PagePromptModule = {
  PAGE_KEY: DeliverySegmentKey;
  PAGE_LABEL: string;
  FINALIZE_DUTY: string;
  buildFillDuty: (tagZh: string) => string;
};

const BY_KEY: Record<DeliverySegmentKey, PagePromptModule> = {
  direct_answer: p1,
  foundation: p2,
  science_action: p3,
  metaphysics_action: p4,
  risk_guard: p5,
  signals_close: p6,
  thirty_day: thirtyDay,
};

/** Finalize：只返回指定页的职责块 */
export function finalizeDutyForKey(key: DeliverySegmentKey): string {
  return BY_KEY[key]?.FINALIZE_DUTY ?? `# 本段职责 · ${key}\n只产出本段双钥匙;勿写其他页任务。`;
}

/** Fill：只返回指定页的 L2 任务块 */
export function fillDutyForKey(key: DeliverySegmentKey, tagZh: string): string {
  const mod = BY_KEY[key];
  return mod ? mod.buildFillDuty(tagZh) : "";
}

/** 便于人工浏览：列出全部活跃页标签与文件对应关系 */
export const ACTIVE_PAGE_PROMPT_FILES = [
  { key: "direct_answer", label: p1.PAGE_LABEL, file: "p1-direct-answer.ts" },
  { key: "foundation", label: p2.PAGE_LABEL, file: "p2-foundation.ts" },
  { key: "science_action", label: p3.PAGE_LABEL, file: "p3-science-action.ts" },
  { key: "metaphysics_action", label: p4.PAGE_LABEL, file: "p4-metaphysics-action.ts" },
  { key: "risk_guard", label: p5.PAGE_LABEL, file: "p5-risk-guard.ts" },
  { key: "signals_close", label: p6.PAGE_LABEL, file: "p6-signals-close.ts" },
] as const;
