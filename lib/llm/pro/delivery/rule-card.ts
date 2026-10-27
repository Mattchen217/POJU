/**
 * 规则卡 · W0 空接口。
 *
 * 内容 SoT（2026-10-27）允许留下类型，不实现匹配。
 * 不要在这里加评分、宫位查找或紫微解读。
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";

/** 占位。`enabled` 固定为 false，直到以后的波次另写匹配器。 */
export interface RuleCard {
  readonly id: string;
  readonly pageId?: DecisionPageId;
  readonly title: string;
  readonly enabled: false;
}

/** 空登记。W0 不填卡、不遍历盘。 */
export const RULE_CARDS: readonly RuleCard[] = [];
