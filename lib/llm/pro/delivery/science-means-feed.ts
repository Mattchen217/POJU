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
    const frame = frames[i];
    if (frame) {
      pathSources.push({
        direction: frame.direction,
        why: frame.why_fits,
        anchors: [...(frame.chart_anchors ?? [])],
        ref: `科学维${i + 1}/帧${i + 1}`,
      });
      continue;
    }
    if (i < 3 && core?.primary_path) {
      pathSources.push({
        direction: core.primary_path.direction,
        why: core.primary_path.why_fits,
        anchors: [...(core.primary_path.chart_anchors ?? [])],
        ref: `科学维${i + 1}/主轨`,
      });
      continue;
    }
    if (i >= 3 && core?.backup_path) {
      pathSources.push({
        direction: core.backup_path.direction,
        why: core.backup_path.why_fits,
        anchors: [...(core.backup_path.chart_anchors ?? [])],
        ref: `科学维${i + 1}/辅轨`,
      });
      continue;
    }
    const dim = dims[i] ?? dims[i % Math.max(1, dims.length)];
    pathSources.push({
      direction: dim?.judgment ?? "",
      why: dim?.chart_basis ?? "",
      anchors: splitAnchorTokens(dim?.chart_basis),
      ref: `科学维${i + 1}`,
    });
  }

  const hints: AssignPathHint[] = [];
  for (let i = 0; i < SCIENCE_ASSIGN_PATHS.length; i++) {
    const path = SCIENCE_ASSIGN_PATHS[i]!;
    const src = pathSources[i]!;
    const primary = take(src.anchors) ?? take(extras);
    const citeRaw =
      (src.why && src.why.trim().length >= 4 ? src.why : "") ||
      src.direction ||
      src.why;
    const cite = clip(citeRaw, 80);
    const claim = clip(
      src.direction
        ? `本维须证明：${src.direction}`
        : `本维须证明科学手段维${i + 1}对本案成立`,
      120,
    );
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
  const lines: string[] = [
    "【P3 科学手段候选菜单 · angles/means 优先生长源】",
    "规则：primary_toolkit / backup_toolkit 各 3 个 angle；每维 strategy+means 须能回溯下列候选之一（可压缩改写）。",
    "主辅 means 禁止换皮复读；主轨≥1 条 means 含「今晚可出示交付物」且细节来自本案收集（禁通用范文）。",
    "禁合同/话术长剧本、禁东方色向清单、禁 X%/Y% 占位。删 chart_anchors 后仍谁都适用→废稿。",
  ];

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

  const dims = (core?.multi_dimension_reckoning ?? []).slice(0, 6);
  if (dims.length > 0) {
    lines.push("multi_dim(承重/策略由头候选):");
    for (const d of dims) {
      lines.push(
        `- 【${clip(d.dimension, 40)}】${clip(d.judgment, 120)}（锚: ${clip(d.chart_basis, 80)}）`,
      );
    }
  }

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

  lines.push(
    "建议槽位: primary.angles[0..2] ← 主轨方向/frames 前段；backup.angles[0..2] ← 辅轨/退路帧；维间互补勿复读。",
  );

  const hintTable = formatAssignBindingHintTable(buildScienceAssignPathHints(core));
  if (hintTable) lines.push(hintTable);

  return lines.join("\n");
}
