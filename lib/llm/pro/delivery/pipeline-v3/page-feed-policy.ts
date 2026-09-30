/**
 * Pipeline v3 · 页级喂料白名单（薄喂 · 防污染）。
 *
 * 目的不是「去掉某种真算」，而是：每页、每步只收**该职责需要的数据源**。
 * 无关块进 prompt = 增负 + 错轴（例：P1 批断灌 collecting 原文 → 回写「权责/兼职」）。
 *
 * 奇门（知局）仅 P4；P1/P2 八字知己；P3 科学菜单；P5/P6 上游+页菜单。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export type PageFeedPhase = "judgment" | "body";

export type PageFeedFlags = {
  /** 总纲 + Fact-pack 八字/岁运闭集（共享包；无奇门权时下游须剥奇门块） */
  thesis_factpack: boolean;
  /** 奇门锁盘 / 敌我微剧本结构（知局） */
  qimen: boolean;
  /** P3 科学手段候选菜单 */
  science_means: boolean;
  /** P4 东方谋略 moat 菜单 */
  metaphysics_moat: boolean;
  /** P2 处境表象对照 */
  foundation_surface: boolean;
  /** P5 熔断菜单 */
  risk_fuse: boolean;
  /** P6 收束菜单 */
  close_ritual: boolean;
  /** collecting / 现实约束（含问题原文，易诱处境词回写） */
  reality: boolean;
  /** 问题+期望块 */
  question_expectation: boolean;
  /** structured 闭集 inventory */
  structured_inventory: boolean;
  /** 正文步：主辅 hint（P3/P4） */
  primary_backup_hint: boolean;
  /** 正文步：action_brief / P3 摘录 */
  upstream_action_excerpt: boolean;
};

const BASE: PageFeedFlags = {
  thesis_factpack: true,
  qimen: false,
  science_means: false,
  metaphysics_moat: false,
  foundation_surface: false,
  risk_fuse: false,
  close_ritual: false,
  reality: true,
  question_expectation: true,
  structured_inventory: true,
  primary_backup_hint: false,
  upstream_action_excerpt: false,
};

/**
 * @param phase judgment=批断枪；body=正文枪。同页两枪允许集可不同。
 */
export function pageFeedFlags(
  key: DeliverySegmentKey,
  phase: PageFeedPhase = "body",
): PageFeedFlags {
  switch (key) {
    case "direct_answer":
      // P1 批断：只要八字松紧真算；议题方向靠 core_conclusion。
      // 不灌 collecting 原文（兼职/股权/话语权堆叠会诱回写「权责」）。
      // P1 正文：可灌 reality，供 when/事实同向。
      if (phase === "judgment") {
        return {
          ...BASE,
          reality: false,
          question_expectation: false,
        };
      }
      return { ...BASE };
    case "foundation":
      // P2：八字归因 +（批断/正文）处境对照；不灌奇门；Q/E 由 surface 带。
      return {
        ...BASE,
        foundation_surface: true,
        question_expectation: false,
        // 批断仍可薄对照 surface；完整 collecting 留给正文 surface 翻译
        reality: phase === "body",
      };
    case "science_action":
      // P3 批断：结构根 + 派工表（结构轴 ref）；不灌 collecting/Q·E（兼职/股权/话语权诱回写）。
      // P3 正文：菜单完整（含收集事实）+ reality + 主辅 hint。
      if (phase === "judgment") {
        return {
          ...BASE,
          science_means: true,
          reality: false,
          question_expectation: false,
          primary_backup_hint: false,
        };
      }
      return {
        ...BASE,
        science_means: true,
        primary_backup_hint: true,
      };
    case "metaphysics_action":
      // P4 批断：Fact-pack 锁盘 + moat 结构候选；不灌 fill 派工全文（多维处方/Q·E/收集诱处境词）。
      // P4 正文：完整 eastern_calc + moat（含收集同向）+ 主辅 hint。
      if (phase === "judgment") {
        return {
          ...BASE,
          qimen: true,
          metaphysics_moat: true,
          reality: false,
          question_expectation: false,
          primary_backup_hint: false,
          upstream_action_excerpt: false,
        };
      }
      return {
        ...BASE,
        qimen: true,
        metaphysics_moat: true,
        primary_backup_hint: true,
        upstream_action_excerpt: false,
      };
    case "risk_guard":
      return {
        ...BASE,
        risk_fuse: true,
        upstream_action_excerpt: true,
      };
    case "signals_close":
      return {
        ...BASE,
        close_ritual: true,
        upstream_action_excerpt: true,
      };
    default:
      return { ...BASE };
  }
}

export function pageReceivesQimen(key: DeliverySegmentKey): boolean {
  return pageFeedFlags(key, "body").qimen;
}
