/**
 * Pipeline v3 · early Phase B category gates on judgment units.
 * Only验不改：命中 → fail；禁止 strip / 改稿。
 * 升闸条件：类别已写入 duty，且同盘重跑仍冒出（见冻结清单 · 提前升闸）。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";

/** 投入形态 / 权益处境词族（整类 · 非本案原句）。 */
const SITUATIONAL_PATH_RE =
  /话语权|名分|股权|兼职|全职|稳定收入|现职|试水|跳槽|权责|全力投入|贸然.*投入|契约宫/;

/** P1/P2 禁奇门门宫承重（知局仅 P4 授权喂锁盘）。 */
const QIMEN_AXIS_RE =
  /死门|休门|开门|生门|惊门|杜门|伤门|景门|值符|值使|天蓬|玄武|天芮|主客/;

/** 半祈使 + 匹配收束（P1 已钉）。 */
const MATCH_CLOSE_RE = /结构匹配|更合结构|可保/;

function unitText(u: {
  unit_claim?: string;
  evidence?: string;
  calc_cite?: string;
}): string {
  return `${u.unit_claim ?? ""}\n${u.evidence ?? ""}\n${u.calc_cite ?? ""}`;
}

/**
 * Category gate on frozen judgment plan. Never mutates.
 */
export function gateJudgmentCategoryB(input: {
  key: DeliverySegmentKey;
  deep_evidence_plan?: DeepEvidencePlan | null;
}): ContentGateVerdict | null {
  const plan = input.deep_evidence_plan;
  if (!plan?.units?.length) return null;

  const notes: string[] = ["gate_phase:b_early", "ruler:category_no_mutate"];

  if (input.key === "foundation" || input.key === "direct_answer") {
    for (let i = 0; i < plan.units.length; i++) {
      const u = plan.units[i]!;
      const blob = unitText(u);
      if (SITUATIONAL_PATH_RE.test(blob)) {
        return {
          passed: false,
          failed_rule: "gate_judgment_situational_path_words",
          detail: `批断 units[${i}] 含投入形态/处境词族（话语权·名分·股权·兼职等）。回改 duty/提示词后重跑批断枪——闸门不改稿。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (MATCH_CLOSE_RE.test(blob)) {
        return {
          passed: false,
          failed_rule: "gate_judgment_match_close",
          detail: `批断 units[${i}] 含「结构匹配/可保」类收束。停在张力词后重跑批断枪。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      if (QIMEN_AXIS_RE.test(blob)) {
        return {
          passed: false,
          failed_rule:
            input.key === "foundation"
              ? "gate_p2_qimen_axis"
              : "gate_p1_qimen_axis",
          detail:
            input.key === "foundation"
              ? "P2 归因禁奇门门宫承重轴（知局归 P4）。回改喂料/duty 后重跑批断枪。"
              : "P1 主辅根禁奇门门宫承重（本页不喂锁盘；知局归 P4）。回改 duty 后重跑批断枪。",
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
    }
  }

  if (input.key === "foundation" && plan.units.length !== 4) {
    notes.push(`warn_p2_unit_count:${plan.units.length}_expect_4`);
  }

  return null;
}
