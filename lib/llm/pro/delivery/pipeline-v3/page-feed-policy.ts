/**
 * Pipeline v3 · 页级喂料白名单（薄喂 · 防污染）。
 *
 * 目的不是「去掉某种真算」，而是：每页只收**该页职责需要的数据源**。
 * 无关块进 prompt = 增负 + 错轴（例：P1 灌奇门 → 死门当值错标）。
 *
 * 奇门（知局）仅 P4 双核需要；P1/P2 用八字知己/岁运；P3 用科学菜单；P5/P6 用上游+页菜单。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

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
  /** collecting / 现实约束 */
  reality: boolean;
  /** 问题+期望（P2 常已由 surface 带，可跳过重复） */
  question_expectation: boolean;
  /** structured 闭集 inventory */
  structured_inventory: boolean;
  /** 正文步：主辅 hint（P3/P4） */
  primary_backup_hint: boolean;
  /** 正文步：action_brief / P3 摘录（P5 等；P4 禁灌科学 SOP） */
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

/** 页级允许的喂料开关（judgment + body 共用）。 */
export function pageFeedFlags(key: DeliverySegmentKey): PageFeedFlags {
  switch (key) {
    case "direct_answer":
      // P1：八字用忌/岁运松紧 → 主辅根。不吃奇门知局、不吃执行菜单。
      return { ...BASE };
    case "foundation":
      // P2：八字归因 + 处境对照。不吃奇门；Q/E 由 surface 带，免三连复读。
      return {
        ...BASE,
        foundation_surface: true,
        question_expectation: false,
      };
    case "science_action":
      // P3：结构根 + 科学手段菜单。不吃奇门/moat。
      return {
        ...BASE,
        science_means: true,
        primary_backup_hint: true,
      };
    case "metaphysics_action":
      // P4：八字知己 + 奇门知局 + moat。禁科学菜单/上游 SOP 灌入。
      return {
        ...BASE,
        qimen: true,
        metaphysics_moat: true,
        primary_backup_hint: true,
        upstream_action_excerpt: false,
      };
    case "risk_guard":
      // P5：翻车结构 + 熔断菜单 + 上游动作 brief。
      return {
        ...BASE,
        risk_fuse: true,
        upstream_action_excerpt: true,
      };
    case "signals_close":
      // P6：近窗结构 + 收束菜单。
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
  return pageFeedFlags(key).qimen;
}
