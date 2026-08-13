import type { MetaphysicsPack } from "@/lib/calculations/metaphysics-pack";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

function formatMetaphysicsPackSlice(pack: MetaphysicsPack | undefined | null): string {
  if (!pack) return "(metaphysics_pack 缺失 — 勿编数字/方位/择时;缺料则薄写并标明依据不足)";
  const hours = pack.favorable_hours
    .slice(0, 6)
    .map((h) => `${h.branch} ${h.period}(${h.match})`)
    .join("; ");
  const dirs = pack.directions.cells
    .filter((c) => c.fit === "high_fit" || c.fit === "supportive")
    .map((c) => `${c.direction}:${c.fit}@${c.combined_score}`)
    .join(", ");
  const noble =
    pack.noble.instances.length > 0
      ? pack.noble.instances.map((i) => `${i.branch}→${i.direction}`).join(", ")
      : pack.noble.theoretical_slots.map((i) => `${i.branch}→${i.direction}(理论)`).join(", ") ||
        "(无)";
  return `metaphysics_pack:
- yong: ${pack.yong_shen.primary_yong_shen}; ji: ${pack.yong_shen.ji_shen.join(",") || "(无)"}
- dashboard(真分0-100): output=${pack.dashboard.output_capacity} sustain=${pack.dashboard.sustain_capacity} resistance=${pack.dashboard.resistance_load} (source=${pack.element_scores_source})
- element_scores: wood=${pack.element_scores.wood} fire=${pack.element_scores.fire} earth=${pack.element_scores.earth} metal=${pack.element_scores.metal} water=${pack.element_scores.water}
- preferred_dirs: ${pack.directions.preferred.join(",") || "(无)"}
- dir_fit: ${dirs || "(无)"}
- favorable_hours: ${hours || "(无)"}
- color_anchors: ${pack.color.labels_zh.join("/")} (${pack.color.usage})
- career_themes: ${pack.career.themes_zh.join("/")} (${pack.career.framing})
- noble(天乙贵人·无生肖): ${noble}`;
}

/** 多维真算 dump — P2/P3 从各维生长论证与药方。 */
function formatMultiDimensionReckoningDump(core: BreakthroughCore): string {
  const dims = (core.multi_dimension_reckoning ?? [])
    .map((d, i) => `${i + 1}. 【${d.dimension}】${d.judgment}\n   锚: ${d.chart_basis}`)
    .join("\n");
  return (
    `multi_dimension_reckoning(多维真算 · 药方从这里各维生长):\n` +
    `${dims || "(缺失)"}`
  );
}

/** 汇总段 action_plan dump — 主/辅可执行方向摘要。 */
function formatActionPlanDump(core: BreakthroughCore): string {
  return core.action_plan
    ? `action_plan:\n- 主: ${core.action_plan.primary ?? "(无)"}\n- 辅: ${core.action_plan.backup ?? "(无)"}`
    : "action_plan:\n(缺失)";
}

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
  const fmtPath = (label: string, f: BreakthroughCore["primary_path"]) =>
    f
      ? `${label}:\n- [${f.status ?? "hypothesis"}] ${f.direction}\n` +
        `  why_fits: ${f.why_fits}\n` +
        `  锚: ${f.structural_basis}\n` +
        `  待验证: ${f.needs_validation}`
      : `${label}:\n(缺失)`;

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

${fmtPath("primary_path", core.primary_path)}

${fmtPath("backup_path", core.backup_path)}

${formatMultiDimensionReckoningDump(core)}

${formatActionPlanDump(core)}

modern_action_frames(候选池):
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
${core.self_check_signals.map((s) => `- ${s}`).join("\n")}

${formatMetaphysicsPackSlice(core.metaphysics_pack)}`;
}

/**
 * Per-segment spine slice — each finalize task sees ONLY its mapped field(s),
 * so a segment can't drift into siblings' territory / the dominant theme.
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
  const pack = formatMetaphysicsPackSlice(core.metaphysics_pack);
  const dimsDump = formatMultiDimensionReckoningDump(core);
  const planDump = formatActionPlanDump(core);

  const primaryFrame =
    core.primary_path ??
    core.modern_action_frames.find(
      (d) => d.status === "selected" || d.status === "reinforced",
    ) ??
    core.modern_action_frames[0];
  const backupFrame = core.backup_path ?? core.modern_action_frames[1];

  switch (key) {
    case "direct_answer":
      return (
        `situation_conclusion:\n${core.situation_conclusion}\n\n` +
        `key_crossroads:\n` +
        `- real_fork: ${xc.real_fork}\n` +
        `- path_costs: ${xc.path_costs}\n` +
        `- decision_traits: ${xc.decision_traits}\n` +
        `- 锚: ${xc.structural_basis}\n\n` +
        `primary_path(主路径):\n` +
        `${
          primaryFrame
            ? `[${primaryFrame.status ?? "hypothesis"}] ${primaryFrame.direction}\n` +
              `   why_fits: ${primaryFrame.why_fits}\n` +
              `   锚: ${primaryFrame.structural_basis}`
            : "(缺失)"
        }\n\n` +
        `desired_outcome:\n(见收集语境 / agenda;本 spine 切片无独立字段)\n\n` +
        `【直答铁律】只给结论头:正面回答 original_question(该不该/是否/何时=阶段趋势+条件成熟,不报日期)+ 一句主路径「我最建议你走这条」+ 一句为什么。不铺论证(论证归 foundation)。`
      );
    case "foundation":
      return (
        `energy_structure:\n${
          core.energy_structure?.trim() ||
          "(energy_structure 缺失 — 本段薄交付,依 structured 写中性能量说明;勿回退底座解读)"
        }\n\n` +
        `element_scores:\n${
          core.element_scores
            ? `wood=${core.element_scores.wood} fire=${core.element_scores.fire} earth=${core.element_scores.earth} metal=${core.element_scores.metal} water=${core.element_scores.water}`
            : "(缺失)"
        }\n\n` +
        `${dimsDump}\n\n` +
        `situation_conclusion(论证收敛锚 — 勿复述成直答页):\n${core.situation_conclusion}\n\n` +
        `structural_basis(四柱十神 / 神煞长生锚):\n${xc.structural_basis}\n\n` +
        `decision_traits:\n${xc.decision_traits}\n\n` +
        `(四柱十神细节见 structured pillars_detail — 勿发明十神实例)\n` +
        `(神煞闭集实例见 structured pillars_detail.shen_sha / life_stage — 禁集外神煞、禁生肖)\n\n` +
        `key_crossroads(周期/窗口定性):\n` +
        `- real_fork: ${xc.real_fork}\n` +
        `- path_costs: ${xc.path_costs}\n\n` +
        `timing_ripeness:\n${er.timing_ripeness}\n\n` +
        `rhythm_frame(标注你处于三阶段的哪一段):\n` +
        `- phase1: ${rf.phase1_observe}\n` +
        `- phase2: ${rf.phase2_adjust}\n` +
        `- phase3: ${rf.phase3_consolidate}\n\n` +
        `${pack}\n\n` +
        `【论证铁律】从【多个命理维度】论证"为什么卡"(不只一个点);按【论证需要】放底座料(不为凑齐而凑),内部小标题分块,收敛到「所以你卡在这」。仪表盘三值只用 dashboard 真分。` +
        `只做能量周期定性(宜积累/宜推进)+阶段位置;禁止逐月预测、禁止吉凶运势语、禁生肖。` +
        `「养根」类主隐喻全报告只在此页用一次。勿与 direct_answer 结论头重复铺陈。`
      );
    case "science_action":
      return (
        `primary_path(主路径 — 展开完整可执行方案):\n` +
        `${
          primaryFrame
            ? `[${primaryFrame.status ?? "hypothesis"}] ${primaryFrame.direction}\n` +
              `   why_fits: ${primaryFrame.why_fits}\n` +
              `   锚: ${primaryFrame.structural_basis}\n` +
              `   待验证: ${primaryFrame.needs_validation}`
            : "(缺失)"
        }\n\n` +
        `backup_path(辅路径 — 退路+切换条件,较简):\n` +
        `${
          backupFrame
            ? `[${backupFrame.status ?? "hypothesis"}] ${backupFrame.direction}\n` +
              `   why_fits: ${backupFrame.why_fits}\n` +
              `   锚: ${backupFrame.structural_basis}\n` +
              `   待验证: ${backupFrame.needs_validation}`
            : "(缺失)"
        }\n\n` +
        `${dimsDump}\n\n` +
        `${planDump}\n\n` +
        `modern_action_frames(兜底候选池):\n${frames}`
      );
    case "metaphysics_action":
      return (
        `energy_retune_frame:\n` +
        `- direction_fit: ${er.direction_fit}\n` +
        `- timing_ripeness: ${er.timing_ripeness}\n` +
        `- daily_retune: ${er.daily_retune}\n` +
        `- complementary: ${er.complementary}\n` +
        `- 锚: ${er.structural_basis}\n\n` +
        `${pack}\n\n` +
        `【合规措辞】方位=空间效能/朝向适配;择时=精力高频时段;色彩=视觉能量锚定;贵人=互补型协同伙伴(去生肖);禁吉方/凶/风水/属相。`
      );
    case "thirty_day":
      return (
        `rhythm_frame:\n` +
        `- phase1_observe: ${rf.phase1_observe}\n` +
        `- phase2_adjust: ${rf.phase2_adjust}\n` +
        `- phase3_consolidate: ${rf.phase3_consolidate}\n\n` +
        `${planDump}\n\n` +
        `science_frames(抽进周表):\n${frames}\n\n` +
        `${pack}\n\n` +
        `【排表】按周(4周),每周科学动作+玄学动作各栏;用 action_plan 主辅方向排节奏;勿按天细拆、勿让模型吐 ASCII 甘特(结构由代码侧生成时再接)。`
      );
    case "risk_guard":
      return (
        `self_check_signals(负向/警惕优先):\n${core.self_check_signals.map((s) => `- ${s}`).join("\n")}\n\n` +
        `ji_shen / resistance:\n${
          core.metaphysics_pack
            ? `ji=${core.metaphysics_pack.yong_shen.ji_shen.join(",")} resistance_load=${core.metaphysics_pack.dashboard.resistance_load}`
            : "(pack 缺失)"
        }\n\n` +
        `path_costs:\n${xc.path_costs}`
      );
    case "signals_close":
      return (
        `self_check_signals(正向信号优先):\n${core.self_check_signals.map((s) => `- ${s}`).join("\n")}\n\n` +
        `real_fork(收尾回扣主题,非钩子):\n${xc.real_fork}\n\n` +
        `【收尾铁律】一次性闭环——「你已拿到完整打法」;【禁止】邀请回来追踪/订阅/下次再来的钩子。`
      );
    default:
      return "";
  }
}
