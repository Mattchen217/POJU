/**
 * Pipeline v3 · early Phase B category gates on body (visible fields).
 * Only验不改. P2 why_cards · P1 primary/backup · P3 toolkit 可见字段.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";

/** 可见层命理专名族（类别 · 含半白话十神合称）。 */
const VISIBLE_JARGON_RE =
  /宫位|相冲|相害|相刑|冲刑害|半合|火局|大运|流年|流月|岁运|月令|时支|日支|奇门|死门|开门|用神|喜神|忌神|食神|食伤|伤官|偏印|正印|印星|财星|七杀|比劫|比肩|正财|偏财|官杀/;

const P2_ESSENCE_IMPERATIVE_RE =
  /你需要|应主动|应当|应该|宜守|宜退避|需要警惕|须注意|需要主动|需要外力|需要.*厘清|需要.*约定|需要.*挖掘/;

/** 未在收集出现的时长/工时编造（类别 · 非本案二字）。 */
const INVENTED_SCHEDULE_RE =
  /每周不超过\s*\d+|每周.{0,6}\d+\s*小时|前\s*\d+\s*个?月为|至少\s*\d+\s*小时|冷静期|\d+\s*小时考虑|下个月中旬/;

/** 股权比例字母占位（整类）。 */
const INVENTED_PERCENT_PLACEHOLDER_RE = /\bX\s*%|\bY\s*%|百分之\s*[XY]/

/** 已拒兼职仍当主轨默认路径。 */
const REJECTED_PART_TIME_AS_PRIMARY_RE =
  /兼职试水|以兼职方式|阶段性试水|非全职试水|先兼职/;

/** 引号可照念台词（整类）。 */
const QUOTED_SCRIPT_RE = /[「」][^「」]{1,48}[「」]|“[^”]{1,48}”|"[^"]{1,48}"/;

/** P4 站位/可见层 P3 交付物换皮（整类）。 */
const P4_P3_DELIVERABLE_RE =
  /技术交付|交付成果|交付物|谈判筹码|书面权益|合同模板|股权落地|架构说明|技术方案/;

function p4VisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    dimensions?: Array<{
      name?: string;
      strategy?: string;
      means?: string[];
    }>;
  };
  return [
    p.page_title,
    p.page_subtitle,
    ...(p.dimensions ?? []).flatMap((d) => [
      d.name,
      d.strategy,
      ...(d.means ?? []),
    ]),
  ]
    .map((x) => String(x ?? ""))
    .join("\n");
}

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

function p3VisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    primary_toolkit?: {
      title?: string;
      angles?: Array<{
        name?: string;
        strategy?: string;
        means?: string[];
      }>;
    };
    backup_toolkit?: {
      title?: string;
      angles?: Array<{
        name?: string;
        strategy?: string;
        means?: string[];
      }>;
    };
  };
  const angles = (kit?: {
    title?: string;
    angles?: Array<{ name?: string; strategy?: string; means?: string[] }>;
  }) =>
    [
      kit?.title,
      ...(kit?.angles ?? []).flatMap((a) => [
        a.name,
        a.strategy,
        ...(a.means ?? []),
      ]),
    ]
      .map((x) => String(x ?? ""))
      .join("\n");
  return [
    p.page_title,
    p.page_subtitle,
    angles(p.primary_toolkit),
    angles(p.backup_toolkit),
  ].join("\n");
}

function p3PrimaryVisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    primary_toolkit?: {
      title?: string;
      angles?: Array<{
        name?: string;
        strategy?: string;
        means?: string[];
      }>;
    };
  };
  const angles = (p.primary_toolkit?.angles ?? []).flatMap((a) => [
    a.name,
    a.strategy,
    ...(a.means ?? []),
  ]);
  return [
    p.page_title,
    p.page_subtitle,
    p.primary_toolkit?.title,
    ...angles,
  ]
    .map((x) => String(x ?? ""))
    .join("\n");
}

export function gateBodyCategoryB(input: {
  key: DeliverySegmentKey;
  page_schema?: DeliveryPageData | null;
  /** 收集/现实约束原文，供已拒门槛与数字闭集对齐。 */
  reality_blob?: string | null;
}): ContentGateVerdict | null {
  if (!input.page_schema) return null;

  const notes: string[] = ["gate_phase:b_early_body", "ruler:category_no_mutate"];
  const reality = String(input.reality_blob ?? "");

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

  if (input.key === "science_action") {
    const visible = p3VisibleBlob(input.page_schema);
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p3_body_visible_jargon",
        detail:
          "P3 可见字段（title/strategy/means）含命理专名报幕。真词只留 chart_anchors；回改正文提示后重跑。",
        notes,
      };
    }
    if (INVENTED_SCHEDULE_RE.test(visible)) {
      // 收集若明确写了同款数字则放过（允许「半年」等同义，不放过自造周工时）
      const allowedHour = /\d+\s*小时/.test(reality);
      const allowedMonthTrial = /试水.{0,8}\d+\s*个?月|\d+\s*个?月.{0,8}试水/.test(
        reality,
      );
      const hit = visible.match(INVENTED_SCHEDULE_RE)?.[0] ?? "";
      const hourHit = /\d+\s*小时|每周/.test(hit);
      const monthHit = /\d+\s*个?月/.test(hit);
      if ((hourHit && !allowedHour) || (monthHit && !allowedMonthTrial) || /冷静期|下个月中旬/.test(hit)) {
        return {
          passed: false,
          failed_rule: "gate_p3_body_invented_schedule",
          detail:
            "P3 正文编造未在收集出现的时长/工时/冷静期数字（每周N小时、前X月试水、冷静期等）。只许用收集已给量；回改 duty/菜单后重跑——闸门不改稿。",
          notes: [...notes, `hit:${hit.slice(0, 24)}`],
        };
      }
    }
    const partTimeRejected =
      /拒绝.{0,12}兼职|必须全职|不同意兼职|不接受兼职|兼职.{0,8}拒绝/.test(
        reality,
      );
    if (partTimeRejected) {
      const primary = p3PrimaryVisibleBlob(input.page_schema);
      if (REJECTED_PART_TIME_AS_PRIMARY_RE.test(primary)) {
        return {
          passed: false,
          failed_rule: "gate_p3_body_rejected_path_as_primary",
          detail:
            "收集已表明对方拒绝兼职/要求全职，正文仍把「兼职试水」当主轨默认路径。须改写为全职门槛下的护底线/显性贡献/书面权益或切辅；回改 duty/菜单后重跑。",
          notes,
        };
      }
    }
    if (INVENTED_PERCENT_PLACEHOLDER_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p3_body_invented_percent",
        detail:
          "P3 正文出现 X%/Y% 等未在收集出现的比例占位。只许用收集已给量或「按书面约定比例」；回改 duty 后重跑——闸门不改稿。",
        notes,
      };
    }
    if (QUOTED_SCRIPT_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p3_body_quoted_script",
        detail:
          "P3 正文含引号可照念台词。改间接叙述（边界/动作）后重跑——闸门不改稿。",
        notes,
      };
    }
    return null;
  }

  if (input.key === "metaphysics_action") {
    const visible = p4VisibleBlob(input.page_schema);
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_visible_jargon",
        detail:
          "P4 可见字段（name/strategy/means）含命理专名报幕。真词只留 chart_anchors；回改正文提示后重跑。",
        notes,
      };
    }
    if (QUOTED_SCRIPT_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_quoted_script",
        detail:
          "P4 正文含引号可照念台词。改间接叙述（边界/节奏）后重跑——闸门不改稿。",
        notes,
      };
    }
    if (P4_P3_DELIVERABLE_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_p3_deliverable",
        detail:
          "P4 可见层出现交付物/谈判筹码等 P3 词族（尤忌站位维）。改写为结界/藏隐/气口后重跑。",
        notes,
      };
    }
    const partTimeRejected =
      /拒绝.{0,12}兼职|必须全职|不同意兼职|不接受兼职|兼职.{0,8}拒绝/.test(
        reality,
      );
    if (
      partTimeRejected &&
      REJECTED_PART_TIME_AS_PRIMARY_RE.test(visible)
    ) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_rejected_path_as_primary",
        detail:
          "收集已表明对方拒绝兼职/要求全职，P4 仍把「兼职试水」写进 means。须改写为硬门槛下的藏隐观气口/结界护底线；回改 duty 后重跑。",
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
