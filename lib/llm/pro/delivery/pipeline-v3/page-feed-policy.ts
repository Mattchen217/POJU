/**
 * Pipeline v3 · 页级喂料白名单（薄喂 · 防污染）。
 * 内容喂料真源见 page-feed-matrix.ts。sliceForPage 已按页裁切，但本旗标表仍是模型调用的喂料开关。
 * 出稿 key 仍是 v1。不要在这里改成把整包 ChartFactPack / ZiweiFactPack 灌进一页。
 *
 * 目的不是「去掉某种真算」，而是：每页、每步只收**该职责需要的数据源**。
 * 无关块进 prompt = 增负 + 错轴（例：P1 批断灌 collecting 原文 → 回写「权责/兼职」）。
 *
 * 奇门（知局）仅 P4；P1/P2 八字知己；P3 科学菜单；P5/P6 上游+页菜单。
 * path=dyad 时：P1–P6 judgment 均允许 dyad_relation_structure（二元关系批断依据）。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { PivotChartPath } from "@/lib/poju/pivot-chart-path";

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
  /**
   * Stage-1 二元结构锚（`dyad_compat_summary` / matrix pack / partner_bazi）。
   * solo 批断页默认关（防污染）；dyad 路径下 judgment 全开。
   */
  dyad_relation_structure: boolean;
  /** structured 闭集 inventory */
  structured_inventory: boolean;
  /** 正文步：主辅 hint（P3/P4） */
  primary_backup_hint: boolean;
  /** 正文步：action_brief / P3 摘录 */
  upstream_action_excerpt: boolean;
};

export type PageFeedPathOpts = {
  pivot_chart_path?: PivotChartPath | null;
  /** Legacy: partner present without explicit path lock. */
  partner_bazi?: "absent" | "present" | null;
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
  dyad_relation_structure: true,
  structured_inventory: true,
  primary_backup_hint: false,
  upstream_action_excerpt: false,
};

function isDyadPath(opts?: PageFeedPathOpts): boolean {
  if (opts?.pivot_chart_path === "dyad") return true;
  if (opts?.pivot_chart_path === "solo") return false;
  return opts?.partner_bazi === "present";
}

/**
 * Infer path opts from locked fields or a dyad feed blob (legacy callers).
 */
export function resolvePageFeedPathOpts(input: {
  pivot_chart_path?: PivotChartPath | null;
  partner_bazi?: "absent" | "present" | null;
  dyad_relation_structure?: string | null;
}): PageFeedPathOpts {
  if (input.pivot_chart_path === "solo" || input.pivot_chart_path === "dyad") {
    return {
      pivot_chart_path: input.pivot_chart_path,
      partner_bazi: input.partner_bazi,
    };
  }
  if (input.partner_bazi === "present" || input.partner_bazi === "absent") {
    return {
      pivot_chart_path: input.partner_bazi === "present" ? "dyad" : "solo",
      partner_bazi: input.partner_bazi,
    };
  }
  const blob = input.dyad_relation_structure ?? "";
  if (blob.includes("partner_bazi=present") || blob.includes("dyad_matrix_pack")) {
    return { pivot_chart_path: "dyad", partner_bazi: "present" };
  }
  if (blob.includes("partner_bazi=absent")) {
    return { pivot_chart_path: "solo", partner_bazi: "absent" };
  }
  return {
    pivot_chart_path: input.pivot_chart_path,
    partner_bazi: input.partner_bazi,
  };
}

/**
 * @param phase judgment=批断枪；body=正文枪。同页两枪允许集可不同。
 * @param pathOpts solo|dyad — dyad 时 judgment 强制开 dyad_relation_structure
 */
export function pageFeedFlags(
  key: DeliverySegmentKey,
  phase: PageFeedPhase = "body",
  pathOpts?: PageFeedPathOpts,
): PageFeedFlags {
  const dyad = isDyadPath(pathOpts);

  const withDyadJudgment = (flags: PageFeedFlags): PageFeedFlags => {
    if (phase === "judgment" && dyad) {
      return { ...flags, dyad_relation_structure: true };
    }
    return flags;
  };

  switch (key) {
    case "decision_brief":
      // P1 批断：solo 只要八字松紧真算；dyad 另灌合盘闭集供二元关系批断。
      // 不灌 collecting 原文（兼职/股权/话语权堆叠会诱回写「权责」）。
      // P1 正文：可灌 reality，供 when/事实同向。
      if (phase === "judgment") {
        return withDyadJudgment({
          ...BASE,
          reality: false,
          question_expectation: false,
          dyad_relation_structure: false,
        });
      }
      return { ...BASE };
    case "situation_analysis":
    case "personal_decision_patterns":
    case "bottleneck_analysis":
      // 处境/模式/障碍：八字归因 + 处境对照；不灌奇门。
      return withDyadJudgment({
        ...BASE,
        foundation_surface: true,
        question_expectation: false,
        dyad_relation_structure: false,
        reality: phase === "body",
      });
    case "strategic_options":
    case "recommended_strategy":
      // 选项比较 / 主策略：科学菜单 + 主辅 hint（正文）；批断不灌 collecting 全文。
      if (phase === "judgment") {
        return withDyadJudgment({
          ...BASE,
          science_means: true,
          reality: false,
          question_expectation: false,
          dyad_relation_structure: false,
          primary_backup_hint: false,
        });
      }
      return {
        ...BASE,
        science_means: true,
        primary_backup_hint: true,
      };
    case "execution_guidance":
      // P3 批断：结构根 + 派工表（结构轴 ref）；不灌 collecting/Q·E（兼职/股权/话语权诱回写）。
      // P3 正文：菜单完整（含收集事实）+ reality + 主辅 hint。
      if (phase === "judgment") {
        return withDyadJudgment({
          ...BASE,
          science_means: true,
          reality: false,
          question_expectation: false,
          dyad_relation_structure: false,
          primary_backup_hint: false,
        });
      }
      return {
        ...BASE,
        science_means: true,
        primary_backup_hint: true,
      };
    case "self_regulation":
      // P4 批断：Fact-pack 锁盘 + moat 结构候选；不灌 Q·E/收集全文。
      // P4 正文：奇门+精简 moat+主辅取向锚；**不灌** Q/E、collecting、inventory、**eastern_calc 派工全文**
      if (phase === "judgment") {
        return withDyadJudgment({
          ...BASE,
          qimen: true,
          metaphysics_moat: true,
          reality: false,
          question_expectation: false,
          dyad_relation_structure: false,
          primary_backup_hint: false,
          upstream_action_excerpt: false,
        });
      }
      return {
        ...BASE,
        qimen: true,
        metaphysics_moat: true,
        primary_backup_hint: true,
        question_expectation: false,
        dyad_relation_structure: false,
        reality: false,
        upstream_action_excerpt: false,
        // inventory 对正文 means 帮助有限且增负；批断已吃过闭集
        structured_inventory: false,
      };
    case "validation_risk":
      return withDyadJudgment({
        ...BASE,
        risk_fuse: true,
        upstream_action_excerpt: true,
      });
    case "validation_close":
      return withDyadJudgment({
        ...BASE,
        close_ritual: true,
        upstream_action_excerpt: true,
      });
    default:
      return withDyadJudgment({ ...BASE });
  }
}

export function pageReceivesQimen(key: DeliverySegmentKey): boolean {
  return pageFeedFlags(key, "body").qimen;
}
