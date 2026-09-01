import type { MetaphysicsPack } from "@/lib/calculations/metaphysics-pack";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { formatDayunSemanticForPrompt } from "@/lib/glossary/dayun-semantic-ssot";
import {
  formatWuxingSemanticForPrompt,
  inferElementsFromCalcSlice,
} from "@/lib/glossary/wuxing-semantic-ssot";
import { splitSelfCheckSignals } from "./self-check-split";
import type { DeliveryPagePlan, DeliveryPagePlanEntry } from "./types";

function formatMultiDimLines(
  core: BreakthroughCore,
  indices?: readonly number[],
): string {
  const dims = core.multi_dimension_reckoning ?? [];
  const list =
    indices && indices.length > 0
      ? indices.map((i) => dims[i]).filter(Boolean)
      : dims;
  if (list.length === 0) return "(缺失)";
  return list
    .map((d, i) => `${i + 1}. 【${d!.dimension}】${d!.judgment}\n   锚: ${d!.chart_basis}`)
    .join("\n");
}

export function formatMetaphysicsPackPolarityOnly(
  pack: MetaphysicsPack | undefined | null,
): string {
  if (!pack) return "(pack 缺失)";
  const dash = pack.dashboard;
  return [
    `yong: ${pack.yong_shen.primary_yong_shen}`,
    `ji: ${pack.yong_shen.ji_shen.join(",") || "(无)"}`,
    dash
      ? `dashboard polarity: output=${dash.output_capacity} sustain=${dash.sustain_capacity} resistance=${dash.resistance_load}`
      : "dashboard: (缺失)",
  ].join("\n");
}

export function formatMetaphysicsPackDashboardOnly(
  pack: MetaphysicsPack | undefined | null,
): string {
  if (!pack?.dashboard) return "dashboard: (缺失)";
  const d = pack.dashboard;
  return `output_capacity=${d.output_capacity} sustain_capacity=${d.sustain_capacity} resistance_load=${d.resistance_load}`;
}

function dayunHintFromCore(core: BreakthroughCore): string {
  const er = core.energy_retune_frame;
  return [
    core.metaphysics_pack?.yong_shen.primary_yong_shen,
    ...(core.metaphysics_pack?.yong_shen.ji_shen ?? []),
    er.timing_ripeness,
    er.daily_retune,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Format full eastern pack slice (P4 only). */
export function formatMetaphysicsPackFullForPlan(
  pack: MetaphysicsPack | undefined | null,
): string {
  if (!pack) return "(metaphysics_pack 缺失)";
  const hours = pack.favorable_hours
    .slice(0, 6)
    .map((h) => `${h.branch} ${h.period}(${h.match})`)
    .join("; ");
  const dirs = pack.directions.cells
    .filter((c) => c.fit === "high_fit" || c.fit === "supportive")
    .map((c) => `${c.direction}:${c.fit}@${c.combined_score}`)
    .join(", ");
  return [
    formatMetaphysicsPackPolarityOnly(pack),
    `preferred_dirs: ${pack.directions.preferred.join(",") || "(无)"}`,
    `dir_fit: ${dirs || "(无)"}`,
    `favorable_hours: ${hours || "(无)"}`,
    `color_anchors: ${pack.color.labels_zh.join("/")}`,
    `career_themes: ${pack.career.themes_zh.join("/")}`,
  ].join("\n");
}

/**
 * Compact per-page must_use block for fill/finalize prompts.
 */
export function formatPagePlanSliceForPrompt(
  key: DeliverySegmentKey,
  plan: DeliveryPagePlan,
  core: BreakthroughCore,
  questionExpectation?: string,
): string {
  const entry: DeliveryPagePlanEntry = plan.pages[key];
  const lines = [
    `【本页派工 · ${key}】`,
    `目标: ${entry.goal}`,
    `must_use: ${entry.must_use.join(", ")}`,
    entry.forbid.length ? `禁止: ${entry.forbid.join("；")}` : "",
  ].filter(Boolean);

  for (const field of entry.must_use) {
    switch (field) {
      case "situation_conclusion":
        lines.push(`situation_conclusion:\n${core.situation_conclusion || "(缺失)"}`);
        break;
      case "key_crossroads": {
        const xc = core.key_crossroads;
        lines.push(
          `key_crossroads:\n- real_fork: ${xc.real_fork}\n- path_costs: ${xc.path_costs}\n- decision_traits: ${xc.decision_traits}`,
        );
        break;
      }
      case "primary_path":
        if (core.primary_path) {
          lines.push(
            `primary_path: ${core.primary_path.direction}\nwhy: ${core.primary_path.why_fits}\n锚: ${core.primary_path.structural_basis}`,
          );
        }
        break;
      case "backup_path":
        if (core.backup_path) {
          lines.push(
            `backup_path: ${core.backup_path.direction}\nwhy: ${core.backup_path.why_fits}`,
          );
        }
        break;
      case "action_plan":
        if (core.action_plan) {
          lines.push(
            `action_plan: 主=${core.action_plan.primary ?? "(无)"} | 辅=${core.action_plan.backup ?? "(无)"}`,
          );
        }
        break;
      case "energy_structure":
        lines.push(`energy_structure:\n${core.energy_structure?.trim() || "(缺失)"}`);
        break;
      case "multi_dim_all":
        lines.push(`multi_dimension_reckoning:\n${formatMultiDimLines(core)}`);
        break;
      case "multi_dim_filtered":
        lines.push(
          `multi_dimension_reckoning(本题相关):\n${formatMultiDimLines(core, entry.multi_dim_indices)}`,
        );
        break;
      case "multi_dim_risk":
        lines.push(
          `multi_dimension_reckoning(风险极性):\n${formatMultiDimLines(core, entry.multi_dim_indices)}`,
        );
        break;
      case "modern_action_frames": {
        const frames = (core.modern_action_frames ?? [])
          .map((f, i) => `${i + 1}. ${f.direction} | 锚:${f.structural_basis}`)
          .join("\n");
        lines.push(`modern_action_frames:\n${frames || "(无)"}`);
        break;
      }
      case "energy_retune_frame": {
        const er = core.energy_retune_frame;
        lines.push(
          `energy_retune_frame:\n- timing: ${er.timing_ripeness}\n- daily: ${er.daily_retune}\n- direction_fit: ${er.direction_fit}`,
        );
        lines.push(formatDayunSemanticForPrompt(dayunHintFromCore(core)));
        break;
      }
      case "metaphysics_pack_full":
        lines.push(`metaphysics_pack:\n${formatMetaphysicsPackFullForPlan(core.metaphysics_pack)}`);
        {
          const blob = formatMetaphysicsPackFullForPlan(core.metaphysics_pack);
          const els = inferElementsFromCalcSlice(blob);
          lines.push(formatWuxingSemanticForPrompt(els, { include_all_if_empty: true }));
        }
        break;
      case "metaphysics_pack_polarity":
        lines.push(`pack_polarity:\n${formatMetaphysicsPackPolarityOnly(core.metaphysics_pack)}`);
        break;
      case "metaphysics_pack_dashboard":
        lines.push(`dashboard:\n${formatMetaphysicsPackDashboardOnly(core.metaphysics_pack)}`);
        break;
      case "rhythm_frame": {
        const rf = core.rhythm_frame;
        lines.push(
          `rhythm_frame:\n- observe: ${rf.phase1_observe}\n- adjust: ${rf.phase2_adjust}\n- consolidate: ${rf.phase3_consolidate}`,
        );
        break;
      }
      case "self_check_negative": {
        const { negative } = splitSelfCheckSignals(core.self_check_signals ?? []);
        lines.push(`self_check(负向):\n${negative.map((s) => `- ${s}`).join("\n") || "(无)"}`);
        break;
      }
      case "self_check_positive": {
        const { positive } = splitSelfCheckSignals(core.self_check_signals ?? []);
        lines.push(`self_check(正向):\n${positive.map((s) => `- ${s}`).join("\n") || "(无)"}`);
        break;
      }
      case "question_expectation":
        if (questionExpectation?.trim()) {
          lines.push(`question_expectation:\n${questionExpectation.trim()}`);
        }
        break;
      default:
        break;
    }
  }

  return lines.join("\n\n");
}

/** One-line summary for finalize system side. */
export function formatPagePlanSummaryForPrompt(plan: DeliveryPagePlan): string {
  const rows = Object.values(plan.pages)
    .filter((p) => p.key !== "thirty_day")
    .map((p) => `- ${p.key}: ${p.goal}`);
  return ["【六页派工表 · 内部】", ...rows].join("\n");
}
