import type { MetaphysicsPack } from "@/lib/calculations/metaphysics-pack";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  formatWuxingSemanticForPrompt,
  inferElementsFromCalcSlice,
  type WuxingElement,
} from "@/lib/glossary/wuxing-semantic-ssot";
import { formatDayunSemanticForPrompt } from "@/lib/glossary/dayun-semantic-ssot";
import {
  extractTenGodNamesFromText,
  formatTenGodSemanticForPrompt,
} from "@/lib/glossary/tengod-semantic-ssot";
import type { DeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan/types";
import {
  formatMetaphysicsPackDashboardOnly,
  formatMetaphysicsPackPolarityOnly,
  formatPagePlanSliceForPrompt,
} from "@/lib/llm/pro/delivery/page-plan/format-page-plan-for-prompt";
import { splitSelfCheckSignals } from "@/lib/llm/pro/delivery/page-plan/self-check-split";

function dayunHintFromCore(core: BreakthroughCore): string {
  const er = core.energy_retune_frame;
  return [
    core.metaphysics_pack?.yong_shen.primary_yong_shen,
    ...(core.metaphysics_pack?.yong_shen.ji_shen ?? []),
    er.timing_ripeness,
    er.daily_retune,
    er.structural_basis,
  ]
    .filter(Boolean)
    .join(" ");
}

function tenGodSemanticSliceFromCore(core: BreakthroughCore): string {
  const blob = [
    core.key_crossroads.structural_basis,
    core.key_crossroads.decision_traits,
    core.energy_structure,
    ...(core.multi_dimension_reckoning ?? []).flatMap((d) => [
      d.dimension,
      d.judgment,
      d.chart_basis,
    ]),
    ...(core.primary_path?.chart_anchors ?? []),
    core.primary_path?.structural_basis,
    ...(core.backup_path?.chart_anchors ?? []),
    core.backup_path?.structural_basis,
    ...(core.modern_action_frames ?? []).flatMap((f) => [
      ...(f.chart_anchors ?? []),
      f.structural_basis,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
  return formatTenGodSemanticForPrompt(extractTenGodNamesFromText(blob));
}

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
- preferred_dirs: ${pack.directions.preferred.join(",") || "(无)"} 【次要 field 输入·不得单独定义补泻】
- dir_fit: ${dirs || "(无)"}
- favorable_hours: ${hours || "(无)"}
- color_anchors: ${pack.color.labels_zh.join("/")} (${pack.color.usage}) 【次要 symbol 输入·不得单独定义补泻】
- career_themes: ${pack.career.themes_zh.join("/")} (${pack.career.framing})
- career_mechanism: ${(pack.career.mechanism_zh ?? []).join("/") || "(无)"}
  【禁】把 career_themes 当职业清单/行业口号写进正文;只可作能量域机制提示,须再挂本案真算锚。
- noble(天乙贵人·无生肖): ${noble}`;
}

function wuxingPromptFromPack(pack: MetaphysicsPack | undefined | null, extra = ""): string {
  const blob = [
    pack ? `yong:${pack.yong_shen.primary_yong_shen} ji:${pack.yong_shen.ji_shen.join(",")}` : "",
    extra,
  ].join("\n");
  let els = inferElementsFromCalcSlice(blob);
  // Always include primary yong element char if present in Chinese names
  if (pack?.yong_shen.primary_yong_shen) {
    els = inferElementsFromCalcSlice(
      `${blob} ${pack.yong_shen.primary_yong_shen} ${pack.yong_shen.ji_shen.join(" ")}`,
    );
  }
  // Fallback: top weak / strong from scores when no han element in yong string
  if (els.length === 0 && pack?.element_scores) {
    const scores = pack.element_scores;
    const ranked: [WuxingElement, number][] = [
      ["木", scores.wood],
      ["火", scores.fire],
      ["土", scores.earth],
      ["金", scores.metal],
      ["水", scores.water],
    ];
    ranked.sort((a, b) => a[1] - b[1]);
    const weak = ranked[0]?.[0] as WuxingElement | undefined;
    const strong = ranked[ranked.length - 1]?.[0] as WuxingElement | undefined;
    els = [weak, strong].filter(Boolean) as WuxingElement[];
  }
  return formatWuxingSemanticForPrompt(els, { include_all_if_empty: true });
}

/** P4 page_schema fill upstream — plan-sliced when available. */
export function buildEasternCalcSliceForFill(
  core: BreakthroughCore,
  plan?: DeliveryPagePlan | null,
  questionExpectation?: string,
): string {
  if (plan) {
    return [
      formatPagePlanSliceForPrompt(
        "metaphysics_action",
        plan,
        core,
        questionExpectation,
      ),
      "【生成顺序】先按真算维选题→读五行语义状态层→锚定问题与期望→means 以 rhythm/mindset 优先。",
      "【反物化】禁流水摆件/水边/绿植/晒太阳等物件主叙事。",
      "【自检】删掉本切片真算后行动是否谁都适用→适用则该维作废重写。",
    ].join("\n\n");
  }
  const er = core.energy_retune_frame;
  const dims = (core.multi_dimension_reckoning ?? [])
    .map((d, i) => `${i + 1}. 【${d.dimension}】${d.judgment}\n   锚: ${d.chart_basis}`)
    .join("\n");
  const packSlice = formatMetaphysicsPackSlice(core.metaphysics_pack);
  return [
    `multi_dimension_reckoning:\n${dims || "(缺失)"}`,
    formatCurrentDaYunCycleDump(core),
    formatDayunSemanticForPrompt(dayunHintFromCore(core)),
    `energy_retune_frame:\n- direction_fit: ${er.direction_fit}\n- timing_ripeness: ${er.timing_ripeness}\n- daily_retune: ${er.daily_retune}\n- complementary: ${er.complementary}\n- 锚: ${er.structural_basis}`,
    packSlice,
    wuxingPromptFromPack(core.metaphysics_pack, dims),
    "【生成顺序】先按真算维选题(色锚/方位拟合/有利时辰/大运年窗/用神补·忌神避气质/贵人协同/相关多维)→读五行语义状态层→锚定问题与期望→写出策略+means(rhythm/mindset 优先)→最后才做合规包装命名。",
    "【包装≠选题】「视觉心理/空间心理/生物节律…」只是显示层标签。color_anchors/preferred_dirs 是次要 symbol/field,禁止用它们定义补水/补木。",
    "【反物化】禁流水摆件/水边/绿植/晒太阳/吃黄碰土/戴金属当补泻主手段。方向短语≠可抄范文。",
    "【用户可见禁词】玄学/命理/八字/五行/用神/忌神/风水/运势/吉方/凶方/属相——但允许写从真算长出的具体色系/坐向侧/钟点窗/阶段窗(白话,次要)。",
    "【禁】把 P3 科学手段写进本页。禁编造 pack 没有的数字/方位。依据真词只进 evidence/bazi_basis。",
    "【自检】删掉本切片真算后行动是否谁都适用→适用则该维作废重写。",
  ].join("\n\n");
}

/** P2 page_schema fill — pack dashboard true scores only (never invent). */
export function buildDashboardScoreHintsForFill(core: BreakthroughCore): string {
  const pack = core.metaphysics_pack;
  const dash = pack?.dashboard;
  const unavailable = [
    "无可用真分（pack 缺失 / empty / 三分为 0）。",
    "【铁律】dashboard[].score 全部 null；note 写「本盘暂缺量化档」或省略。",
    "禁止输出伪分 0，禁止 note「来自仪表盘」。",
  ].join("\n");
  if (!dash || pack?.element_scores_source === "empty") return unavailable;
  const { output_capacity, sustain_capacity, resistance_load } = dash;
  // All-zero is the empty-chart fingerprint — never teach the model to echo 0 · 来自仪表盘.
  if (output_capacity === 0 && sustain_capacity === 0 && resistance_load === 0) {
    return unavailable;
  }
  return [
    `output_capacity=${output_capacity} → dashboard key 可用 body/输出 映射此分`,
    `sustain_capacity=${sustain_capacity} → dashboard key 可用 mind/续航 映射此分`,
    `resistance_load=${resistance_load} → dashboard key 可用 field/阻力 映射此分`,
    "【铁律】P2 dashboard[].score 只能抄上面三个数字之一;没有则 score=null——禁止编造、禁止伪 0 · 来自仪表盘。",
  ].join("\n");
}

const RISK_POLARITY_RE =
  /压力|易栽|未熟|过耗|过刚|压制|阻力|忌|盲|耗|崩|风险|熔断|红灯|坑|警戒|不宜|硬冲|耗尽|失控|失眠|血压|催促|加塞|英雄/;

/** P5 page_schema fill — question-anchored risk polarity only (not full dump). */
export function buildRiskCalcSliceForFill(
  core: BreakthroughCore,
  plan?: DeliveryPagePlan | null,
  questionExpectation?: string,
): string {
  if (plan) {
    return formatPagePlanSliceForPrompt(
      "risk_guard",
      plan,
      core,
      questionExpectation,
    );
  }
  const xc = core.key_crossroads;
  const pack = core.metaphysics_pack;
  const dash = pack?.dashboard;
  const allDims = core.multi_dimension_reckoning ?? [];
  const riskMatched = allDims.filter((d) =>
    RISK_POLARITY_RE.test(`${d.dimension}${d.judgment}${d.chart_basis}`),
  );
  const riskSource = riskMatched.length > 0 ? riskMatched.slice(0, 6) : allDims.slice(0, 3);
  const riskLabel =
    riskMatched.length > 0
      ? "风险极性相关子集"
      : "弱相关兜底(无极性匹配 — 取前几条多维,仍须扎本案熔断)";
  const riskDims = riskSource
    .map((d, i) => `${i + 1}. 【${d.dimension}】${d.judgment}\n   锚: ${d.chart_basis}`)
    .join("\n");
  const ji = pack?.yong_shen.ji_shen.join(",") || "(无)";
  const { negative } = splitSelfCheckSignals(core.self_check_signals ?? []);
  return [
    `ji_shen: ${ji}`,
    dash
      ? `dashboard 极性: resistance_load=${dash.resistance_load} sustain_capacity=${dash.sustain_capacity} output_capacity=${dash.output_capacity}`
      : "dashboard: (缺失)",
    `blind_spots / decision_traits:\n${xc.decision_traits || "(缺失)"}`,
    `path_costs:\n${xc.path_costs || "(缺失)"}`,
    `self_check_signals(负向优先):\n${negative.map((s) => `- ${s}`).join("\n") || "(无)"}`,
    `multi_dimension_reckoning(${riskLabel}):\n${riskDims || "(多维缺失 — 用忌神/盲区/path_costs 撑熔断,勿编造)"}`,
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
        `  chart_anchors: ${(f.chart_anchors ?? []).join("、") || "(无 — 汇总段应已填)"}\n` +
        `  reality_anchors: ${(f.reality_anchors ?? []).join("、") || "(无)"}\n` +
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

export type SpineSliceOpts = {
  pagePlan?: DeliveryPagePlan | null;
  questionExpectation?: string;
};

/**
 * Per-segment spine slice — each finalize task sees ONLY its mapped field(s),
 * so a segment can't drift into siblings' territory / the dominant theme.
 */
export function formatSpineSliceForSegment(
  core: BreakthroughCore,
  key: DeliverySegmentKey,
  opts?: SpineSliceOpts,
): string {
  if (opts?.pagePlan) {
    return formatPagePlanSliceForPrompt(
      key,
      opts.pagePlan,
      core,
      opts.questionExpectation,
    );
  }
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
              `   锚: ${primaryFrame.structural_basis}\n` +
              `   chart_anchors: ${(primaryFrame.chart_anchors ?? []).join("、") || "(无)"}`
            : "(缺失)"
        }\n\n` +
        `${planDump}\n\n` +
        `desired_outcome:\n(见收集语境 / agenda;本 spine 切片无独立字段)\n\n` +
        `【直答铁律】只给结论头:正面回答 original_question(该不该/是否/何时=阶段趋势+条件成熟,不报日期)+ 一句主路径「我最建议你走这条」+ 一句为什么。不铺论证(论证归 foundation)。` +
        `chart_anchors/bazi_basis 须继承主辅承重锚(≥1)。`
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
        `${tenGodSemanticSliceFromCore(core)}\n\n` +
        `(四柱十神细节见 structured pillars_detail — 勿发明十神实例)\n` +
        `(神煞闭集实例见 structured pillars_detail.shen_sha / life_stage — 禁集外神煞、禁生肖)\n\n` +
        `key_crossroads(周期/窗口定性):\n` +
        `- real_fork: ${xc.real_fork}\n` +
        `- path_costs: ${xc.path_costs}\n\n` +
        `timing_ripeness:\n${er.timing_ripeness}\n\n` +
        `${formatDayunSemanticForPrompt(dayunHintFromCore(core))}\n\n` +
        `rhythm_frame(仅一句阶段定位 — 你处于蓄力/试探/巩固哪一段):\n` +
        `- phase1: ${rf.phase1_observe}\n` +
        `- phase2: ${rf.phase2_adjust}\n` +
        `- phase3: ${rf.phase3_consolidate}\n\n` +
        `dashboard:\n${formatMetaphysicsPackDashboardOnly(core.metaphysics_pack)}\n\n` +
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
              `   chart_anchors: ${(primaryFrame.chart_anchors ?? []).join("、") || "(无)"}\n` +
              `   待验证: ${primaryFrame.needs_validation}`
            : "(缺失)"
        }\n\n` +
        `backup_path(辅路径 — 退路+切换条件,较简):\n` +
        `${
          backupFrame
            ? `[${backupFrame.status ?? "hypothesis"}] ${backupFrame.direction}\n` +
              `   why_fits: ${backupFrame.why_fits}\n` +
              `   锚: ${backupFrame.structural_basis}\n` +
              `   chart_anchors: ${(backupFrame.chart_anchors ?? []).join("、") || "(无)"}\n` +
              `   待验证: ${backupFrame.needs_validation}`
            : "(缺失)"
        }\n\n` +
        `${dimsDump}\n\n` +
        `${planDump}\n\n` +
        `modern_action_frames(科学手段候选池):\n${frames}\n\n` +
        `pack_polarity:\n${formatMetaphysicsPackPolarityOnly(core.metaphysics_pack)}\n\n` +
        `【科学一套·每条=策略+手段】生长顺序:先锁 chart_anchors(主辅/多维)→再写策略+手段;` +
        `pack 只作结构极性校验——【禁】把 P4 场域清单写成科学页手段。` +
        `禁先造通用动作再贴标签;禁合同/话术剧本;禁半套。` +
        `自检:删掉 chart_anchors/bazi_basis 后若谁都适用→重写。`
      );
    case "metaphysics_action":
      return (
        `【锚定】用户【问题+期望】。本页=场域/节律/精力杠杆方案(支付网关合规包装),不是科学职场方案,也不是玄学报幕。\n\n` +
        `${dimsDump}\n\n` +
        `${formatCurrentDaYunCycleDump(core)}\n\n` +
        `${formatDayunSemanticForPrompt(dayunHintFromCore(core))}\n\n` +
        `energy_retune_frame:\n` +
        `- direction_fit: ${er.direction_fit}\n` +
        `- timing_ripeness: ${er.timing_ripeness}\n` +
        `- daily_retune: ${er.daily_retune}\n` +
        `- complementary: ${er.complementary}\n` +
        `- 锚: ${er.structural_basis}\n\n` +
        `${tenGodSemanticSliceFromCore(core)}\n\n` +
        `${pack}\n\n` +
        `【生成顺序】先按真算维(色/向/时/年窗/补避/协同)+五行语义状态层锚定问题+期望;means 以 rhythm/mindset 优先。「视觉心理/空间心理…」是外套不是选题菜单。\n` +
        `color_anchors/preferred_dirs 仅次要 symbol/field,不得定义补水/补木;禁物化(水景/绿植/晒太阳等)。\n` +
        `允许具体色系/坐向侧/钟点窗/阶段窗(白话·次要);禁吉方/凶/风水/属相/用神/八字/五行字面报幕;禁无盘锚的通用养生。\n` +
        `每维=策略(对这件事情为何因真算成立)+可对照行动。禁止复读 P3;禁止再写主辅双轨。` +
        `bazi_basis/依据层填闭集真词;dimensions 禁止真词泄漏。自检:删依据后谁都适用→重写。`
      );
    case "thirty_day":
      return (
        `rhythm_frame:\n` +
        `- phase1_observe: ${rf.phase1_observe}\n` +
        `- phase2_adjust: ${rf.phase2_adjust}\n` +
        `- phase3_consolidate: ${rf.phase3_consolidate}\n\n` +
        `${formatCurrentDaYunCycleDump(core)}\n\n` +
        `${formatDayunSemanticForPrompt(dayunHintFromCore(core))}\n\n` +
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
        `【页定位】执行主路径时的结构刹车(fill 阶段会吃 P3/P4 Action Brief);本切片只供命理熔断料,勿另立与药方脱节的行动课。\n\n` +
        `primary chart_anchors: ${(primaryFrame?.chart_anchors ?? []).join("、") || "(无)"}\n` +
        `backup chart_anchors: ${(backupFrame?.chart_anchors ?? []).join("、") || "(无)"}\n\n` +
        `【命理扎根】坑必须是他这类结构【特有】的;` +
        `先锁 chart_anchors 再写结论;` +
        `每条应能对上「执行哪类主路径动作时会栽」(下游 Brief 里的 P3/P4 手段)。` +
        `下游 fill 须 situation→then_do→watch→forbid + 单元 chart_anchors。` +
        `自检:删依据后还成立→重写。`
      );
    case "signals_close": {
      const { positive } = splitSelfCheckSignals(core.self_check_signals ?? []);
      return (
        `self_check_signals(正向信号优先):\n${positive.map((s) => `- ${s}`).join("\n") || "(无)"}\n\n` +
        `real_fork(收尾回扣主题,非钩子):\n${xc.real_fork}\n\n` +
        `${planDump}\n\n` +
        `rhythm_frame(近阶节奏骨架 · 禁四周甘特):\n` +
        `- phase1_observe: ${rf.phase1_observe}\n` +
        `- phase2_adjust: ${rf.phase2_adjust}\n` +
        `- phase3_consolidate: ${rf.phase3_consolidate}\n\n` +
        `primary chart_anchors(轻量承重): ${(primaryFrame?.chart_anchors ?? []).join("、") || "(无)"}\n` +
        `backup chart_anchors(轻量承重): ${(backupFrame?.chart_anchors ?? []).join("、") || "(无)"}\n` +
        `primary reality_anchors: ${(primaryFrame?.reality_anchors ?? []).join("、") || "(无)"}\n\n` +
        `【页定位】出门仪式页;fill 阶段吃 Action Brief 拆今晚+近7日;` +
        `近阶动作须可追溯 Brief/action_plan,禁止新开药方、禁止合盘专题。\n\n` +
        `【收尾铁律】身份对照+为何切换、金句+用法、今晚闭环、近7日条目卡≥4、带走三样;` +
        `一次性闭环「你已拿到完整打法」;【禁止】邀请回来追踪/订阅/下次再来;` +
        `禁止四周表、禁止第三次药方总结。下游 fill 须带 page_title/page_subtitle;` +
        `identity_shift / tonight / day7 单元须带 chart_anchors(可继承主辅轻量锚)。`
      );
    }
    default:
      return "";
  }
}
