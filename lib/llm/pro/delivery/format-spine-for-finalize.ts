import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/** Private spine dump for finalize (includes needs_validation + statuses). */
export function formatBreakthroughCoreForFinalize(core: BreakthroughCore): string {
  const xc = core.key_crossroads;
  const er = core.energy_retune_frame;
  const rf = core.rhythm_frame;
  const frames = core.modern_action_frames
    .map(
      (d, i) =>
        `${i + 1}. [${d.status ?? "hypothesis"}] ${d.direction}\n` +
        `   why_fits: ${d.why_fits}\n` +
        `   锚: ${d.structural_basis}\n` +
        `   待验证: ${d.needs_validation}`,
    )
    .join("\n");
  return `energy_structure:
${core.energy_structure?.trim() || "(缺失)"}

situation_conclusion:
${core.situation_conclusion}

key_crossroads:
- real_fork: ${xc.real_fork}
- path_costs: ${xc.path_costs}
- decision_traits: ${xc.decision_traits}
- 锚: ${xc.structural_basis}
- 待验证: ${xc.needs_validation}

modern_action_frames:
${frames}

energy_retune_frame: [${er.status ?? "hypothesis"}]
- direction_fit: ${er.direction_fit}
- timing_ripeness: ${er.timing_ripeness}
- daily_retune: ${er.daily_retune}
- complementary: ${er.complementary}
- 锚: ${er.structural_basis}
- 待验证: ${er.needs_validation}

rhythm_frame:
- phase1_observe: ${rf.phase1_observe}
- phase2_adjust: ${rf.phase2_adjust}
- phase3_consolidate: ${rf.phase3_consolidate}

self_check_signals:
${core.self_check_signals.map((s) => `- ${s}`).join("\n")}`;
}

/**
 * Per-segment spine slice — each finalize task sees ONLY its mapped field(s),
 * so a segment can't drift into siblings' territory / the dominant theme.
 * (Kills the "full-spine to every one of 9 calls" homogenizer.)
 */
export function formatSpineSliceForSegment(
  core: BreakthroughCore,
  key: DeliverySegmentKey,
): string {
  const xc = core.key_crossroads;
  const er = core.energy_retune_frame;
  const rf = core.rhythm_frame;
  const frames = core.modern_action_frames
    .map(
      (d, i) =>
        `${i + 1}. [${d.status ?? "hypothesis"}] ${d.direction}\n` +
        `   why_fits: ${d.why_fits}\n` +
        `   锚: ${d.structural_basis}\n` +
        `   待验证: ${d.needs_validation}`,
    )
    .join("\n");

  switch (key) {
    case "energy":
      return `energy_structure:\n${
        core.energy_structure?.trim() ||
        "(energy_structure 缺失 — 本段薄交付,依 structured 写中性能量说明;勿回退底座解读)"
      }`;
    case "situation":
      return `situation_conclusion:\n${core.situation_conclusion}\n\nstructural_basis(依据锚):\n${xc.structural_basis}`;
    case "crossroads":
      return `key_crossroads:\n- real_fork: ${xc.real_fork}\n- path_costs: ${xc.path_costs}\n- decision_traits: ${xc.decision_traits}\n- 锚: ${xc.structural_basis}`;
    case "action":
      return `modern_action_frames:\n${frames}`;
    case "retune":
      return `energy_retune_frame:\n- direction_fit: ${er.direction_fit}\n- timing_ripeness: ${er.timing_ripeness}\n- daily_retune: ${er.daily_retune}\n- complementary: ${er.complementary}\n- 锚: ${er.structural_basis}`;
    case "rhythm":
      return `rhythm_frame:\n- phase1_observe: ${rf.phase1_observe}\n- phase2_adjust: ${rf.phase2_adjust}\n- phase3_consolidate: ${rf.phase3_consolidate}`;
    case "awareness":
      return `self_check_signals:\n${core.self_check_signals.map((s) => `- ${s}`).join("\n")}`;
    case "preface":
      return `situation_conclusion(仅供定调,勿展开):\n${core.situation_conclusion}`;
    case "epilogue":
      return `real_fork(收尾回扣):\n${xc.real_fork}`;
    default:
      return "";
  }
}
