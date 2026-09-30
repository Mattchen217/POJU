/**
 * P3 science_action · angle/means candidate menu from synthesis frames + collecting.
 * Quality-first: give the model real means to grow — do not rely on sanitize
 * angles≥3 / empty-means retries to invent generic coaching.
 *
 * Seeds full Assign binding tuples (primary/ref/cite/claim) per angle path.
 */

import type { BreakthroughCore, ModernActionFrame } from "@/lib/poju/agent-state";
import type { CoveredAgendaItem } from "./reality-constraints";
import {
  clipAssignField,
  formatAssignBindingHintTable,
  type AssignPathHint,
} from "./page-schema/assign-binding-seed";

/** Keep in sync with deepEvidenceUnitSpec("science_action").paths */
export const SCIENCE_ASSIGN_PATHS = [
  "primary_toolkit.angles[0]",
  "primary_toolkit.angles[1]",
  "primary_toolkit.angles[2]",
  "backup_toolkit.angles[0]",
  "backup_toolkit.angles[1]",
  "backup_toolkit.angles[2]",
] as const;

/**
 * 六维 **结构主张轴**（派工/批断用 · 类别级 · 换盘仍成立）。
 * means_candidate_ref = `科学维N/${label}`；正文 means 生长另读 frames/收集，不把「试水/守位」写进批断 ref。
 */
export const SCIENCE_STRUCTURE_AXES = [
  {
    label: "格局·十神主矛盾",
    seed: "本维轴=格局/十神主矛盾：偏显与制衡位的结构张力（禁写成投入节奏处方）",
  },
  {
    label: "宫位·关系压力",
    seed: "本维轴=宫位关系压力：合冲刑害对合伙位的结构摩擦（禁复读他维同轴）",
  },
  {
    label: "财官·显隐链路",
    seed: "本维轴=财星/官杀显隐与生财·制衡链路条件（禁股权/契约执行句）",
  },
  {
    label: "印比·心力结构",
    seed: "本维轴=印比伤对决断锋利度/保守倾的结构约束（禁谈判话术）",
  },
  {
    label: "用忌·资源姿态",
    seed: "本维轴=用神忌神旺衰与资源获取姿态；收束到「冒进承压偏高/耗损偏重」为止（禁试水、禁全职、禁宜X、禁更符合）",
  },
  {
    label: "岁运·气候交织",
    seed: "本维轴=大运流年岁运对用忌的承压/转机交织；收束到「加码窗口收窄/岁运冲突」为止（禁加重筹码、禁全职夹带、禁宜守中）",
  },
] as const;

/** 批断枪 means_candidate_ref 闭集（path 下标对齐 SCIENCE_ASSIGN_PATHS）。 */
export const SCIENCE_JUDGMENT_MEANS_REFS: readonly string[] =
  SCIENCE_STRUCTURE_AXES.map((a, i) => `科学维${i + 1}/${a.label}`);

function clip(s: string, max: number): string {
  return clipAssignField(s, max);
}

function pushUnique(out: string[], line: string, max: number): void {
  const t = line.trim();
  if (!t || out.length >= max) return;
  const norm = t.replace(/\s+/g, "").slice(0, 56);
  if (out.some((x) => x.replace(/\s+/g, "").slice(0, 56) === norm)) return;
  out.push(t);
}

/** 正文菜单：收集硬对齐条（高于 frames 假设；类别 · 换盘仍成立）。 */
export function buildScienceRealityHardAlignBlock(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
): string {
  const blob = (covered_agenda ?? [])
    .map((a) => `${a.label ?? ""}:${a.answer ?? ""}`)
    .join("\n");
  if (!blob.trim()) {
    return [
      "【收集事实硬对齐 · 正文必遵 · 高于 frames 假设】",
      "- 时长/工时数字：收集未给 → 禁编造试水月数/每周工时/冷静小时数。",
    ].join("\n");
  }
  const lines: string[] = [
    "【收集事实硬对齐 · 正文必遵 · 高于 frames 假设】",
  ];
  if (/拒绝.{0,12}兼职|必须全职|不同意兼职|不接受兼职|兼职.{0,8}拒绝/.test(blob)) {
    lines.push(
      "- 对方已拒兼职/要求全职核心位 → 禁把「再提兼职试水/阶段性非全职」当主轨默认路径；须写：在对方全职门槛下护收入底线、显性化贡献、书面化权益，或切辅/止损条件。（frames 若仍写兼职试水 = 假设过期，勿照抄）",
    );
  }
  const durHits = blob.match(/半年|一年|\d+\s*个?月|\d+\s*周/g) ?? [];
  if (durHits.length > 0) {
    const uniq = [...new Set(durHits.map((s) => s.replace(/\s+/g, "")))];
    lines.push(
      `- 时长闭集（只许用这些或其同义转写）：${uniq.join("、")}；禁自造试水月数/每周N小时/冷静期小时/「下月中旬」类未出现截止点。`,
    );
  } else {
    lines.push(
      "- 时长/工时数字：收集未给具体量 → 禁编造「X个月试水」「每周N小时」「N小时冷静期」。",
    );
  }
  return lines.join("\n");
}

function splitAnchorTokens(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[、,，;/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 1 && s.length <= 24 && s !== "(无)");
}

function formatFrame(f: ModernActionFrame, i: number): string {
  const status = f.status ?? "hypothesis";
  const anchors = (f.chart_anchors ?? []).filter(Boolean).join("、") || "(无)";
  const reality = (f.reality_anchors ?? []).filter(Boolean).join("、") || "(无)";
  return (
    `帧${i + 1}[${status}] ${clip(f.direction, 120)}\n` +
    `   why_fits: ${clip(f.why_fits, 160)}\n` +
    `   待验证: ${clip(f.needs_validation, 120)}\n` +
    `   chart_anchors: ${anchors} · reality: ${reality}`
  );
}

/**
 * Deterministic per-path binding from frames / paths / multi_dim.
 * Uniqueness first on primary — when frames share first anchor, pull 2nd/3rd or extras.
 */
export function buildScienceAssignPathHints(
  core: BreakthroughCore | null | undefined,
): AssignPathHint[] {
  const frames = core?.modern_action_frames ?? [];
  const dims = core?.multi_dimension_reckoning ?? [];
  const extras: string[] = [];
  for (const a of core?.primary_path?.chart_anchors ?? []) extras.push(a);
  for (const a of core?.backup_path?.chart_anchors ?? []) extras.push(a);
  for (const d of dims) {
    extras.push(...splitAnchorTokens(d.chart_basis));
  }
  for (const f of frames) {
    for (const a of f.chart_anchors ?? []) extras.push(a);
  }

  const used = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const take = (cands: readonly string[]): string | undefined => {
    for (const c of cands) {
      const t = c.trim();
      const n = norm(t);
      if (!n || used.has(n)) continue;
      used.add(n);
      return t;
    }
    return undefined;
  };

  const pathSources: Array<{
    direction: string;
    why: string;
    anchors: string[];
    ref: string;
  }> = [];
  for (let i = 0; i < SCIENCE_ASSIGN_PATHS.length; i++) {
    const axis = SCIENCE_STRUCTURE_AXES[i]!;
    // ref = 结构轴标签（批断/正文共用）；禁「试水/守位」等生活处方标签当 means_candidate_ref。
    const structureRef = `科学维${i + 1}/${axis.label}`;
    const frame = frames[i];
    if (frame) {
      pathSources.push({
        direction: frame.direction,
        why: frame.why_fits,
        anchors: [...(frame.chart_anchors ?? [])],
        ref: structureRef,
      });
      continue;
    }
    if (i < 3 && core?.primary_path) {
      pathSources.push({
        direction: core.primary_path.direction,
        why: core.primary_path.why_fits,
        anchors: [...(core.primary_path.chart_anchors ?? [])],
        ref: structureRef,
      });
      continue;
    }
    if (i >= 3 && core?.backup_path) {
      pathSources.push({
        direction: core.backup_path.direction,
        why: core.backup_path.why_fits,
        anchors: [...(core.backup_path.chart_anchors ?? [])],
        ref: structureRef,
      });
      continue;
    }
    const dim = dims[i] ?? dims[i % Math.max(1, dims.length)];
    pathSources.push({
      direction: dim?.judgment ?? "",
      why: dim?.chart_basis ?? "",
      anchors: splitAnchorTokens(dim?.chart_basis),
      ref: structureRef,
    });
  }

  const usedClaims = new Set<string>();
  const hints: AssignPathHint[] = [];
  for (let i = 0; i < SCIENCE_ASSIGN_PATHS.length; i++) {
    const path = SCIENCE_ASSIGN_PATHS[i]!;
    const src = pathSources[i]!;
    const axis = SCIENCE_STRUCTURE_AXES[i]!;
    const primary = take(src.anchors) ?? take(extras);
    const citeRaw =
      (src.why && src.why.trim().length >= 4 ? src.why : "") ||
      src.direction ||
      src.why;
    const cite = clip(citeRaw, 80);
    // claim = 结构轴种子（类别）；direction/facet 只进 ref/cite，供 fill 手段面，不进主张。
    let claim = clip(axis.seed, 120);
    const claimKey = claim.replace(/\s+/g, "").slice(0, 48);
    if (claimKey && usedClaims.has(claimKey)) {
      claim = clip(`${claim} ·${axis.label}`, 120);
    }
    if (claimKey) usedClaims.add(claim.replace(/\s+/g, "").slice(0, 48));
    if (!primary && !cite && !claim) continue;
    hints.push({
      path,
      prefer_primary: primary,
      prefer_candidate_ref: src.ref,
      prefer_cite: cite || undefined,
      prefer_claim: claim || undefined,
    });
  }
  return hints;
}

export type ScienceMeansFeedOpts = {
  original_question?: string | null;
  desired_outcome?: string | null;
  primary_backup_hint?: string | null;
  answerMaxChars?: number;
  /**
   * 批断枪：只灌结构轴派工表 + 真算锚；不灌 Q/E/收集事实/手段方向文案
   *（避免兼职·股权·话语权回写进 claim）。
   */
  forJudgment?: boolean;
};

/**
 * Build an explicit angle/means menu for deep + fill (science_action only).
 * Keep on compress path too — means are not inventable from ⟦w:⟧ alone.
 */
export function buildScienceMeansFeedBlock(
  core: BreakthroughCore | null | undefined,
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: ScienceMeansFeedOpts,
): string {
  const answerMax = opts?.answerMaxChars ?? 200;
  const forJudgment = opts?.forJudgment === true;
  const lines: string[] = forJudgment
    ? [
        "【P3 科学手段候选菜单 · 批断枪 · 结构派工】",
        "规则：means_candidate_ref **必须**抄派工表 `ref=`（六条不重复）；unit_claim/evidence 只写结构张力。",
        "禁发明「XX评估工具/兑现机制/节奏方案」类生活工具名当 ref。",
        "禁试水/全职/兼职/股权/话语权/稳定收入作机制主语或句末尾巴；停在承压/显隐/窗口收窄。",
        "direction/帧/收集只供正文枪——本块不灌。",
      ]
    : [
        "【P3 科学手段候选菜单 · angles/means 优先生长源】",
        "规则：primary_toolkit / backup_toolkit 各 3 个 angle；每维 strategy+means 须能回溯下列候选之一（可压缩改写）。",
        "主辅 means 禁止换皮复读；主轨≥1 条 means 含「今晚可出示交付物」且细节来自本案收集（禁通用范文）。",
        "禁合同/话术长剧本、禁东方色向清单、禁 X%/Y% 占位。删 chart_anchors 后仍谁都适用→废稿。",
        "【批断枪读法】派工表 claim=结构轴种子；direction/帧文案只供后续正文手段面。写 unit_claim/evidence：停在承压/旺衰张力；禁试水/全职/加重筹码/宜X/更符合；calc_cite 禁粘「派工表：」改写；chart_anchors 每条≥1。",
      ];

  if (!forJudgment) {
    const q = opts?.original_question?.trim();
    if (q) lines.push(`问题: ${clip(q, answerMax)}`);
    const want = opts?.desired_outcome?.trim();
    if (want) lines.push(`期望: ${clip(want, answerMax)}`);
    const hint = opts?.primary_backup_hint?.trim();
    if (hint) lines.push(`主辅对照(上游):\n${clip(hint, 400)}`);

    if (core?.action_plan) {
      lines.push(
        `action_plan:\n- 主: ${clip(core.action_plan.primary ?? "(无)", answerMax)}\n- 辅: ${clip(core.action_plan.backup ?? "(无)", answerMax)}`,
      );
    } else {
      lines.push("action_plan: (缺失 — 用 frames + 收集生长，勿另立第三套药方)");
    }

    const primary = core?.primary_path;
    const backup = core?.backup_path;
    if (primary) {
      lines.push(
        `primary_path: [${primary.status ?? "hypothesis"}] ${clip(primary.direction, 140)}\n` +
          `   why: ${clip(primary.why_fits, 160)}\n` +
          `   锚: ${(primary.chart_anchors ?? []).join("、") || primary.structural_basis || "(无)"}`,
      );
    }
    if (backup) {
      lines.push(
        `backup_path: [${backup.status ?? "hypothesis"}] ${clip(backup.direction, 140)}\n` +
          `   why: ${clip(backup.why_fits, 160)}\n` +
          `   锚: ${(backup.chart_anchors ?? []).join("、") || backup.structural_basis || "(无)"}`,
      );
    }

    const frames = core?.modern_action_frames ?? [];
    if (frames.length > 0) {
      lines.push("modern_action_frames(科学手段候选池):");
      frames.slice(0, 8).forEach((f, i) => lines.push(formatFrame(f, i)));
    } else {
      lines.push("modern_action_frames: (缺失 — 从 action_plan + 收集事实拆 3+3 维，禁空喊励志)");
    }
  }

  const dims = (core?.multi_dimension_reckoning ?? []).slice(0, 6);
  if (dims.length > 0) {
    lines.push(
      forJudgment
        ? "multi_dim(结构锚 · 只取 chart_basis/维名，禁把 judgment 生活句粘进 claim):"
        : "multi_dim(承重/策略由头候选):",
    );
    for (const d of dims) {
      if (forJudgment) {
        lines.push(
          `- 【${clip(d.dimension, 40)}】锚: ${clip(d.chart_basis, 80)}`,
        );
      } else {
        lines.push(
          `- 【${clip(d.dimension, 40)}】${clip(d.judgment, 120)}（锚: ${clip(d.chart_basis, 80)}）`,
        );
      }
    }
  }

  if (!forJudgment) {
    const agendaLines: string[] = [];
    for (const item of covered_agenda ?? []) {
      const label = clip(item.label || "收集项", 60);
      const answer = item.answer?.trim();
      if (answer) pushUnique(agendaLines, `${label}: ${clip(answer, answerMax)}`, 6);
    }
    if (agendaLines.length > 0) {
      lines.push("收集事实(means 细节/交付物只许同向这些事实):");
      agendaLines.forEach((a, i) => lines.push(`事实${i + 1}. ${a}`));
    } else {
      lines.push("(无 covered_agenda 细节 — 禁止发明缓冲月数/未确认赛道与百分比)");
    }

    lines.push(buildScienceRealityHardAlignBlock(covered_agenda));

    lines.push(
      "建议槽位: primary.angles[0..2] ← 主轨方向/frames 前段；backup.angles[0..2] ← 辅轨/退路帧；维间互补勿复读。",
    );
  } else {
    lines.push(
      "六维结构轴（claim 主轴须互异，各贴一条）: " +
        SCIENCE_STRUCTURE_AXES.map((a) => a.label).join(" · "),
    );
  }

  const hintTable = formatAssignBindingHintTable(buildScienceAssignPathHints(core));
  if (hintTable) lines.push(hintTable);

  return lines.join("\n");
}
