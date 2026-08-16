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

/** P4 page_schema fill upstream — question/expectation anchored; eastern dims only. */
export function buildEasternCalcSliceForFill(core: BreakthroughCore): string {
  const er = core.energy_retune_frame;
  const dims = (core.multi_dimension_reckoning ?? [])
    .map((d, i) => `${i + 1}. 【${d.dimension}】${d.judgment}\n   锚: ${d.chart_basis}`)
    .join("\n");
  return [
    `multi_dimension_reckoning:\n${dims || "(缺失)"}`,
    formatCurrentDaYunCycleDump(core),
    `energy_retune_frame:\n- direction_fit: ${er.direction_fit}\n- timing_ripeness: ${er.timing_ripeness}\n- daily_retune: ${er.daily_retune}\n- complementary: ${er.complementary}\n- 锚: ${er.structural_basis}`,
    formatMetaphysicsPackSlice(core.metaphysics_pack),
    "【抽取纪律】只取与用户问题/期望相关的【东方】维写入 dimensions(色/向/时/大运年窗/用神补避/行业属性/协同方向等)。",
    "【禁】把 P3 科学手段(邮件话术/授权/日历/Slack/谈判脚本)写进本页。禁编造 pack 没有的数字/方位。",
  ].join("\n\n");
}

/** P2 page_schema fill — pack dashboard true scores only (never invent). */
export function buildDashboardScoreHintsForFill(core: BreakthroughCore): string {
  const dash = core.metaphysics_pack?.dashboard;
  if (!dash) return "";
  return [
    `output_capacity=${dash.output_capacity} → dashboard key 可用 body/输出 映射此分`,
    `sustain_capacity=${dash.sustain_capacity} → dashboard key 可用 mind/续航 映射此分`,
    `resistance_load=${dash.resistance_load} → dashboard key 可用 field/阻力 映射此分`,
    "【铁律】P2 dashboard[].score 只能抄上面三个数字之一;没有 pack 则 score=null——禁止编造。",
  ].join("\n");
}

const RISK_POLARITY_RE =
  /压力|易栽|未熟|过耗|过刚|压制|阻力|忌|盲|耗|崩|风险|熔断|红灯|坑|警戒|不宜|硬冲|耗尽|失控|失眠|血压|催促|加塞|英雄/;

/** P5 page_schema fill — question-anchored risk polarity only (not full dump). */
export function buildRiskCalcSliceForFill(core: BreakthroughCore): string {
  const xc = core.key_crossroads;
  const pack = core.metaphysics_pack;
  const dash = pack?.dashboard;
  const riskDims = (core.multi_dimension_reckoning ?? [])
    .filter((d) => RISK_POLARITY_RE.test(`${d.dimension}${d.judgment}${d.chart_basis}`))
    .slice(0, 6)
    .map((d, i) => `${i + 1}. 【${d.dimension}】${d.judgment}\n   锚: ${d.chart_basis}`)
    .join("\n");
  const ji = pack?.yong_shen.ji_shen.join(",") || "(无)";
  return [
    `ji_shen: ${ji}`,
    dash
      ? `dashboard 阈值: resistance_load=${dash.resistance_load} sustain_capacity=${dash.sustain_capacity} output_capacity=${dash.output_capacity}`
      : "dashboard: (缺失)",
    `blind_spots / decision_traits:\n${xc.decision_traits || "(缺失)"}`,
    `path_costs:\n${xc.path_costs || "(缺失)"}`,
    `self_check_signals(负向优先):\n${core.self_check_signals.map((s) => `- ${s}`).join("\n") || "(无)"}`,
    `multi_dimension_reckoning(风险极性相关子集):\n${riskDims || "(无匹配负向维 — 用忌神/盲区/path_costs 撑熔断,勿编造)"}`,
    "【抽取纪律】只写会毁掉【本案主路径】的熔断条目;每条 RiskItem=出现→该做→注意→禁做。",
    "【禁】倾倒全盘多维/方位清单;禁复读 P3 手段;禁无盘根通用作息鸡汤。",
  ].join("\n\n");
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

/** 当前大运/阶段时机 — P5 节奏松紧依据(逻辑字段 current_da_yun_cycle)。 */
function formatCurrentDaYunCycleDump(core: BreakthroughCore): string {
  const er = core.energy_retune_frame;
  const phaseDims = (core.multi_dimension_reckoning ?? [])
    .filter((d) => /大运|流年|周期|阶段|运/.test(d.dimension))
    .map((d) => `- 【${d.dimension}】${d.judgment}（锚: ${d.chart_basis}）`)
    .join("\n");
  return (
    `current_da_yun_cycle(当前阶段 · 节奏松紧依据):\n` +
    `- timing_ripeness: ${er.timing_ripeness || "(缺失)"}\n` +
    `- retune_basis: ${er.structural_basis || "(缺失)"}\n` +
    `${phaseDims ? `阶段相关多维:\n${phaseDims}` : "- 阶段相关多维: (无专维 — 以 timing_ripeness + rhythm 为准)"}`
  );
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
        `rhythm_frame(仅一句阶段定位 — 你处于蓄力/试探/巩固哪一段):\n` +
        `- phase1: ${rf.phase1_observe}\n` +
        `- phase2: ${rf.phase2_adjust}\n` +
        `- phase3: ${rf.phase3_consolidate}\n\n` +
        `${pack}\n\n` +
        `【论证铁律】opening/收集若给出多个真实表象,则 why_cards 按【不同表象】分卡对症分析(每卡=surface+essence),禁止压成单一表象再空讲多维。` +
        `从【多个命理维度】解释各表象为何出现;按【论证需要】放底座料(不为凑齐而凑),最后一张收束「因此主辅成立」。仪表盘三值只用 dashboard 真分。` +
        `只做能量周期定性(宜积累/宜推进)+【一句】阶段位置;禁止输出1–3/4–6/7–12月路线图、禁止前/中/后10天清单、禁止谈判话术/授权清单——那些归 signals_close 近阶 / science_action。` +
        `禁止逐月预测、禁止吉凶运势语、禁生肖。` +
        `「养根」类主隐喻全报告只在此页用一次。勿与 direct_answer 结论头重复铺陈。`
      );
    case "science_action":
      return (
        `primary_path(主路径):\n` +
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
        `modern_action_frames(科学手段候选池):\n${frames}\n\n` +
        `【科学一套·每条=策略+手段】从多维+主辅长出 3–4 条科学维;每条 core 内写清【策略】与【手段】成套(下游 narrative 会拆成 title/strategy/methods)。` +
        `禁先造通用动作再贴标签;禁合同/话术剧本;禁只推销主路径口号;禁半套。` +
        `自检:删掉 bazi_basis 后若谁都适用→重写。`
      );
    case "metaphysics_action":
      return (
        `【锚定】用户【问题+期望】。本页=东方行动方案,不是科学职场方案。\n\n` +
        `${dimsDump}\n\n` +
        `${formatCurrentDaYunCycleDump(core)}\n\n` +
        `energy_retune_frame:\n` +
        `- direction_fit: ${er.direction_fit}\n` +
        `- timing_ripeness: ${er.timing_ripeness}\n` +
        `- daily_retune: ${er.daily_retune}\n` +
        `- complementary: ${er.complementary}\n` +
        `- 锚: ${er.structural_basis}\n\n` +
        `${pack}\n\n` +
        `【合规措辞】方位=空间效能/朝向适配;择时=精力高频时段;色彩=视觉能量锚定;贵人=互补型协同伙伴(去生肖);禁吉方/凶/风水/属相。\n` +
        `【东方维·有关才写】色彩着装 / 方位朝向 / 高频时段 / 大运·阶段年窗(利事业推进 vs 宜守) / 用神补·忌神避 / 行业主题 / 协同方向。\n` +
        `每维=策略(对这件事情为何成立)+可对照手段。禁止复读 P3(邮件/授权/日历/谈判话术);禁止再写主辅双轨;禁止空口诀墙。` +
        `bazi_basis 填用神/五行真词。自检:删依据后谁都适用→重写。`
      );
    case "thirty_day":
      return (
        `rhythm_frame:\n` +
        `- phase1_observe: ${rf.phase1_observe}\n` +
        `- phase2_adjust: ${rf.phase2_adjust}\n` +
        `- phase3_consolidate: ${rf.phase3_consolidate}\n\n` +
        `${formatCurrentDaYunCycleDump(core)}\n\n` +
        `${planDump}\n\n` +
        `science_frames(抽进周表):\n${frames}\n\n` +
        `${pack}\n\n` +
        `【排表】按周(4周),每周科学药方动作+东方药方动作各栏;用 action_plan 主辅方向排节奏;` +
        `松紧显式绑 current_da_yun_cycle(宜守蓄力 vs 可推进),禁止把方案平均切成四周;` +
        `【禁】把 science_action 谈判逐字稿搬进周表(周表只排节奏与动作类型)。` +
        `勿按天细拆、勿让模型吐 ASCII 甘特(结构由代码侧生成时再接)。`
      );
    case "risk_guard":
      return (
        `self_check_signals(负向/警惕优先):\n${core.self_check_signals.map((s) => `- ${s}`).join("\n")}\n\n` +
        `ji_shen / resistance:\n${
          core.metaphysics_pack
            ? `ji=${core.metaphysics_pack.yong_shen.ji_shen.join(",")} resistance_load=${core.metaphysics_pack.dashboard.resistance_load} sustain=${core.metaphysics_pack.dashboard.sustain_capacity}`
            : "(pack 缺失)"
        }\n\n` +
        `blind_spots(性情盲区 · 该类结构特有):\n${xc.decision_traits || "(缺失)"}\n\n` +
        `path_costs:\n${xc.path_costs}\n\n` +
        formatMultiDimensionReckoningDump(core) +
        `\n\n` +
        `【命理扎根】坑必须是他这类结构【特有】的(忌神/性情盲区/相关负向多维导致反复栽的),` +
        `不是「注意休息/别熬夜」通用提醒。` +
        `下游 fill 每条须 situation→then_do→watch→forbid。` +
        `bazi_basis 填忌神/盲点/相关维真词。自检:删依据后还成立→重写。`
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
