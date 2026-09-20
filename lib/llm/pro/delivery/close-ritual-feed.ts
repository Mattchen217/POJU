/**
 * P6 signals_close · close/tonight/day7 candidate menu from ActionBrief ×
 * rhythm × positive self_check × collecting.
 * Quality-first: give the model real near-term stems — do not rely on
 * sanitize soft thickeners to invent identity_shift / tonight / takeaways.
 *
 * Also seeds Assign binding tuples per close path.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { CoveredAgendaItem } from "./reality-constraints";
import type { P5ActionBrief } from "./page-schema/types";
import { splitSelfCheckSignals } from "./page-plan/self-check-split";
import {
  clipAssignField,
  formatAssignBindingHintTable,
  type AssignPathHint,
} from "./page-schema/assign-binding-seed";

function clip(s: string, max: number): string {
  return clipAssignField(s, max);
}

function pushUnique(out: string[], line: string, max: number): void {
  const t = line.trim();
  if (!t || out.length >= max) return;
  const norm = t.replace(/\s+/g, "").slice(0, 48);
  if (out.some((x) => x.replace(/\s+/g, "").slice(0, 48) === norm)) return;
  out.push(t);
}

export type Near7DayRole = "observe" | "adjust" | "consolidate" | "aux";

const NEAR7_ROLE_PREFIX: Record<Near7DayRole, string> = {
  observe: "近7日·观察",
  adjust: "近7日·调整",
  consolidate: "近7日·巩固",
  aux: "近7日·可切辅",
};

/**
 * Strip 1–10 / 11–20 / 21–30 month-band stems (八页禁四周表).
 * Qualify-first seed sanitize — no fill LLM rewrite.
 */
export function stripMonthBandDayPrefix(raw: string | null | undefined): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/第\s*\d+\s*[-–—~到至]\s*\d+\s*天[：:，,\s]*/g, "");
  s = s.replace(
    /第?\s*(?:1\s*[-–—~]\s*10|11\s*[-–—~]\s*20|21\s*[-–—~]\s*30)\s*天[：:，,\s]*/gi,
    "",
  );
  s = s.replace(/^(?:四周|三十天|30\s*天|一个月)[：:\s]*/g, "");
  return s.trim();
}

export function normalizeNear7DayStem(
  raw: string | null | undefined,
  role: Near7DayRole = "observe",
): string {
  let s = stripMonthBandDayPrefix(raw);
  if (!s) return `${NEAR7_ROLE_PREFIX[role]}：小步可验证动作`;
  s = s.replace(/^近7日[·•]?[^：:]{0,8}[：:]\s*/g, "").trim() || "小步可验证动作";
  const prefix = NEAR7_ROLE_PREFIX[role];
  if (s.startsWith(prefix)) return s.slice(0, 120);
  return `${prefix}：${s}`.slice(0, 120);
}

export const CLOSE_ASSIGN_PATHS = [
  "identity_shift",
  "tonight",
  "day7_micro_actions[0]",
  "day7_micro_actions[1]",
  "day7_micro_actions[2]",
  "day7_micro_actions[3]",
] as const;

export type CloseRitualFeedOpts = {
  original_question?: string | null;
  desired_outcome?: string | null;
  primary_backup_hint?: string | null;
  answerMaxChars?: number;
};

export function buildCloseAssignPathHints(
  core: BreakthroughCore | null | undefined,
  brief: P5ActionBrief | null | undefined,
  tonightStems: readonly string[],
  day7Stems: readonly string[],
): AssignPathHint[] {
  const anchors = [...(brief?.source_anchors ?? [])];
  const used = new Set<string>();
  const takePrimary = (): string | undefined => {
    for (const a of anchors) {
      const n = a.trim().toLowerCase();
      if (!n || used.has(n)) continue;
      used.add(n);
      return a.trim();
    }
    return undefined;
  };

  const { positive } = splitSelfCheckSignals(core?.self_check_signals ?? []);
  const rf = core?.rhythm_frame;
  const primaryName = brief?.primary_name || "主轨";
  const backupName = brief?.backup_name || "辅轨";

  /** day7[3] must be backup-destined (#14) — never primary stem at index 3. */
  const auxDay7Stem = (): string => {
    const backupPrefixed = day7Stems.find((s) =>
      /辅轨近阶|切辅→|切辅\s/.test(s),
    );
    const backupStep = brief?.p3_backup_steps?.[0]?.trim();
    let raw = backupPrefixed ?? "";
    if (!raw && backupStep) raw = `辅轨近阶 · ${backupStep}`;
    if (!raw) raw = `切辅→「${backupName}」`;
    return normalizeNear7DayStem(String(raw), "aux");
  };

  const day7 = (i: number): string => {
    if (i === 3) return auxDay7Stem();
    const role: Near7DayRole =
      i === 0 ? "observe" : i === 1 ? "adjust" : "consolidate";
    const raw =
      day7Stems[i] ??
      day7Stems[0] ??
      (i === 0
        ? rf?.phase1_observe
        : i === 1
          ? rf?.phase2_adjust
          : rf?.phase3_consolidate) ??
      `近阶动作${i + 1}`;
    return normalizeNear7DayStem(String(raw), role);
  };

  const specs: Array<{
    path: (typeof CLOSE_ASSIGN_PATHS)[number];
    ref: string;
    cite: string;
    claim: string;
  }> = [
    {
      path: "identity_shift",
      ref: "身份茎",
      cite: clip(positive[0] || `${primaryName}→可执行身份`, 80),
      claim: clip(
        `从旧身份切到可执行身份：对齐「${primaryName}」而非空喊励志`,
        120,
      ),
    },
    {
      path: "tonight",
      ref: tonightStems[0] ? "今晚1" : "今晚候选",
      cite: clip(tonightStems[0] || brief?.primary_when || "今晚可出示一件事", 80),
      claim: clip(
        `今晚可完成：${(tonightStems[0] || "一件可出示交付物").slice(0, 50)}`,
        120,
      ),
    },
    {
      path: "day7_micro_actions[0]",
      ref: day7Stems[0] ? "近阶1" : "observe",
      cite: clip(String(day7(0)), 80),
      claim: clip(`近7日微动作1（观察/启动）：${String(day7(0)).slice(0, 40)}`, 120),
    },
    {
      path: "day7_micro_actions[1]",
      ref: day7Stems[1] ? "近阶2" : "adjust",
      cite: clip(String(day7(1)), 80),
      claim: clip(`近7日微动作2（调整）：${String(day7(1)).slice(0, 40)}`, 120),
    },
    {
      path: "day7_micro_actions[2]",
      ref: day7Stems[2] ? "近阶3" : "consolidate",
      cite: clip(String(day7(2)), 80),
      claim: clip(`近7日微动作3（巩固）：${String(day7(2)).slice(0, 40)}`, 120),
    },
    {
      path: "day7_micro_actions[3]",
      ref: "切辅近阶",
      cite: clip(String(day7(3)), 80),
      claim: clip(
        `近7日微动作4（切辅→「${backupName}」）：${String(day7(3)).slice(0, 36)}`,
        120,
      ),
    },
  ];

  return specs.map((s) => ({
    path: s.path,
    prefer_primary: takePrimary(),
    prefer_candidate_ref: s.ref,
    prefer_cite: s.cite,
    prefer_claim: s.claim,
  }));
}

/**
 * Numbered close menu for deep + fill (signals_close). Keep on compress.
 */
export function buildCloseRitualFeedBlock(
  core: BreakthroughCore | null | undefined,
  brief: P5ActionBrief | null | undefined,
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: CloseRitualFeedOpts,
): string {
  const answerMax = opts?.answerMaxChars ?? 160;
  const lines: string[] = [
    "【P6 出门候选菜单 · 今晚/近7日/身份 优先生长源】",
    "规则：身份对照 + 今晚一件事 + day7_micro_actions[恰好4] + 带走三样；金句/takeaways 为封印句（不挂证据折叠）。",
    "今晚与 day7 须可回溯下列「近阶茎」之一；禁与 P3 手段逐字复读；禁第三套药方；禁四周甘特；禁 P5 熔断墙。",
    "删 identity_shift / tonight / day7 的 chart_anchors 后近阶仍成立=通用鸡汤→重写。",
  ];

  const q = opts?.original_question?.trim();
  if (q) lines.push(`问题: ${clip(q, answerMax)}`);
  const want = opts?.desired_outcome?.trim();
  if (want) lines.push(`期望: ${clip(want, answerMax)}`);
  const hint = opts?.primary_backup_hint?.trim();
  if (hint) lines.push(`主辅对照:\n${clip(hint, 320)}`);

  const tonightStems: string[] = [];
  const day7Stems: string[] = [];

  if (brief) {
    lines.push(
      `Brief 主辅: ${brief.primary_name || "(缺)"} | when=${brief.primary_when || "—"} ‖ 辅=${brief.backup_name || "(缺)"} | when=${brief.backup_when || "—"}`,
      `切辅钉名: day7[3] 目标=「${brief.backup_name || "辅轨"}」≠主「${brief.primary_name || "主轨"}」；禁把主轨手段贴成「辅轨切换」`,
    );

    for (const s of brief.p3_primary_steps.slice(0, 4)) {
      pushUnique(tonightStems, `今晚候选 · ${clip(s, answerMax)}`, 6);
    }
    if (brief.p3_primary_script?.trim()) {
      pushUnique(
        tonightStems,
        `开口稿 · ${clip(brief.p3_primary_script, answerMax)}`,
        6,
      );
    }
    for (const m of brief.p3_hard_metrics.slice(0, 3)) {
      pushUnique(tonightStems, `度量 · ${clip(m, answerMax)}`, 6);
    }
    if (tonightStems.length) {
      lines.push("今晚候选茎(选1写成 immediate_action + done_looks_like + why):");
      tonightStems.forEach((s, i) => lines.push(`今晚${i + 1}. ${s}`));
    } else {
      lines.push("今晚候选茎: (Brief 偏空 — 用主辅 when + rhythm phase1 写一件可出示事)");
    }

    for (const s of brief.p3_primary_steps.slice(0, 3)) {
      pushUnique(day7Stems, `近阶 · ${clip(s, answerMax)}`, 8);
    }
    // Reserve index-adjacent backup stem before flooding with more primary (#14).
    for (const s of brief.p3_backup_steps.slice(0, 3)) {
      pushUnique(day7Stems, `辅轨近阶 · ${clip(s, answerMax)}`, 8);
    }
    for (const s of brief.p3_primary_steps.slice(3, 6)) {
      pushUnique(day7Stems, `近阶 · ${clip(s, answerMax)}`, 8);
    }
    for (const s of brief.p4_primary_means.slice(0, 4)) {
      pushUnique(day7Stems, `调频近阶 · ${clip(s, answerMax)}`, 8);
    }
    for (const s of brief.p4_avoid.slice(0, 2)) {
      pushUnique(day7Stems, `避开红线 · ${clip(s, answerMax)}`, 8);
    }
    if (day7Stems.length) {
      lines.push(
        "近7日茎(拆成恰好4条 {action,why,done_when}；措辞须改写，禁逐字复读):",
      );
      day7Stems.forEach((s, i) => lines.push(`近阶${i + 1}. ${s}`));
    }

    if (brief.source_anchors.length) {
      lines.push(
        `优先 chart_anchors: ${brief.source_anchors.slice(0, 12).join("、")}`,
      );
    }
  } else {
    lines.push("Brief: (未就绪 — 用 rhythm + 主辅 hint + 正向自检写近阶；仍禁第三套药方)");
  }

  const rf = core?.rhythm_frame;
  if (rf) {
    lines.push(
      "rhythm_frame(近阶骨架 · 禁四周甘特 · 已压近7日):",
      `- observe: ${clip(normalizeNear7DayStem(rf.phase1_observe, "observe"), 120) || "(缺)"}`,
      `- adjust: ${clip(normalizeNear7DayStem(rf.phase2_adjust, "adjust"), 120) || "(缺)"}`,
      `- consolidate: ${clip(normalizeNear7DayStem(rf.phase3_consolidate, "consolidate"), 120) || "(缺)"}`,
    );
  }

  const { positive } = splitSelfCheckSignals(core?.self_check_signals ?? []);
  if (positive.length) {
    lines.push("self_check(正向 · 身份切换/金句可挂):");
    for (const s of positive.slice(0, 5)) lines.push(`- ${clip(s, 120)}`);
  }

  const ap = core?.action_plan;
  if (ap?.primary || ap?.backup) {
    lines.push(
      `action_plan: 主=${clip(ap.primary || "(无)", 80)} | 辅=${clip(ap.backup || "(无)", 80)}`,
    );
  }

  const facts: string[] = [];
  for (const item of covered_agenda ?? []) {
    const label = clip(item.label || "项", 40);
    const answer = item.answer?.trim();
    if (answer) pushUnique(facts, `${label}: ${clip(answer, answerMax)}`, 5);
  }
  if (facts.length) {
    lines.push("收集事实(时限/精力边界只许同向):");
    facts.forEach((f, i) => lines.push(`事实${i + 1}. ${f}`));
  }

  lines.push(
    "建议槽位映射:",
    "- identity_before/after/shift ← Brief 主辅名+when + 正向自检（为何切换对本案成立）",
    "- immediate_action / tonight_* ← 今晚候选茎之一（可出示闭环）",
    "- day7_micro_actions[0..3] ← 近阶茎改写（observe→adjust→consolidate 节奏）",
    "- takeaways[3] ← 决策一句 / 本周杠杆一句 / 熔断一句（封印，不新开策略）",
    "- quote + quote_use ← 正向自检或主辅一句可背；摇摆时怎么用",
  );

  const hintTable = formatAssignBindingHintTable(
    buildCloseAssignPathHints(core, brief, tonightStems, day7Stems),
  );
  if (hintTable) lines.push(hintTable);

  return lines.join("\n");
}
