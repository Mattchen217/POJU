/**
 * P2 foundation · collected situation as material, not a surface menu.
 * Assign still consumes path hints when the caller passes them (legacy thesis path).
 * Fact-pack attribution does not pre-bind answers onto cards.
 */

import type { CoveredAgendaItem } from "./reality-constraints";
import {
  clipAssignField,
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

export type FoundationSurfaceFeedOpts = {
  original_question?: string | null;
  desired_outcome?: string | null;
  situation_conclusion?: string | null;
  decision_traits?: string | null;
  real_fork?: string | null;
  path_costs?: string | null;
  energy_structure?: string | null;
  /** Per-candidate clip (default 220 — longer than generic reality block). */
  answerMaxChars?: number;
};

/** Collect numbered surface candidates (same order as feed menu). */
export function collectFoundationSurfaceCandidates(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: FoundationSurfaceFeedOpts,
): string[] {
  const answerMax = opts?.answerMaxChars ?? 220;
  const candidates: string[] = [];

  for (const item of covered_agenda ?? []) {
    const label = clip(item.label || "收集项", 80);
    const answer = item.answer?.trim();
    if (answer) {
      pushUnique(candidates, `${label}: ${clip(answer, answerMax)}`, 8);
    } else if (item.label?.trim()) {
      pushUnique(candidates, `${label}（答案未捕获 — 只作议题面，勿编造细节）`, 8);
    }
  }

  const q = opts?.original_question?.trim();
  if (q) pushUnique(candidates, `原问题面: ${clip(q, answerMax)}`, 8);
  const want = opts?.desired_outcome?.trim();
  if (want) pushUnique(candidates, `期望面: ${clip(want, answerMax)}`, 8);

  const fork = opts?.real_fork?.trim();
  if (fork) pushUnique(candidates, `分叉面: ${clip(fork, answerMax)}`, 8);
  const traits = opts?.decision_traits?.trim();
  if (traits) pushUnique(candidates, `决策特质面: ${clip(traits, answerMax)}`, 8);
  const costs = opts?.path_costs?.trim();
  if (costs) pushUnique(candidates, `代价面: ${clip(costs, answerMax)}`, 8);
  const sit = opts?.situation_conclusion?.trim();
  if (sit) pushUnique(candidates, `局势面: ${clip(sit, answerMax)}`, 8);
  const energy = opts?.energy_structure?.trim();
  if (energy) pushUnique(candidates, `能量结构面: ${clip(energy, answerMax)}`, 8);

  return candidates;
}

const FOUNDATION_PATHS = [
  "why_cards[0]",
  "why_cards[1]",
  "why_cards[2]",
  "why_cards[3]",
  "why_cards[4]",
] as const;

/**
 * Prefer closing card on 局势/分叉/期望 when available; else sequential.
 */
export function buildFoundationAssignPathHints(
  candidates: readonly string[],
  unitCount = 4,
): AssignPathHint[] {
  const n = Math.max(4, Math.min(5, unitCount, FOUNDATION_PATHS.length));
  if (candidates.length === 0) {
    return Array.from({ length: n }, (_, i) => ({
      path: FOUNDATION_PATHS[i]!,
      prefer_candidate_ref: `表象候选${i + 1}`,
      prefer_cite: undefined,
      prefer_claim: `本卡须证明结构面${i + 1}为何成立并收束主辅`,
    }));
  }

  const scored = candidates.map((c, i) => {
    let score = 0;
    if (/局势面|分叉面|期望面/.test(c)) score += 2;
    if (/代价面|决策特质面/.test(c)) score += 1;
    return { c, i, score };
  });
  const closeIdx =
    scored.slice().sort((a, b) => b.score - a.score || a.i - b.i)[0]?.i ?? 0;

  const order: number[] = [];
  for (let i = 0; i < candidates.length && order.length < n - 1; i++) {
    if (i === closeIdx && n > 1) continue;
    order.push(i);
  }
  while (order.length < n - 1 && order.length < candidates.length) {
    const next = order.length % candidates.length;
    if (!order.includes(next)) order.push(next);
    else break;
  }
  if (n >= 1) order.push(closeIdx);

  // Dedupe while keeping length — never wrap-reuse another card's surface (#3).
  const seen = new Set<number>();
  const idxs: number[] = [];
  for (const i of order) {
    if (seen.has(i)) continue;
    seen.add(i);
    idxs.push(i);
    if (idxs.length >= n) break;
  }
  // Exhaust unused candidates first
  for (let i = 0; i < candidates.length && idxs.length < n; i++) {
    if (seen.has(i)) continue;
    seen.add(i);
    idxs.push(i);
  }
  // Still short: split longest candidate into sub-surfaces (same label:answer pair)
  const expanded = [...candidates];
  while (idxs.length < n && expanded.length > 0) {
    const srcI = idxs.length % Math.max(1, candidates.length);
    const src = candidates[srcI] ?? candidates[0]!;
    const parts = src.split(/[；;。！？\n]/).map((p) => p.trim()).filter((p) => p.length >= 8);
    const piece = parts[idxs.length % Math.max(1, parts.length)] ?? src;
    const labelMatch = src.match(/^([^:：]{1,40})[:：]/);
    const label = labelMatch?.[1]?.trim() ?? `子面${idxs.length + 1}`;
    const sub = `${label}: ${clip(piece.replace(/^[^:：]{1,40}[:：]\s*/, ""), 180)}`;
    const newIdx = expanded.length;
    expanded.push(sub);
    idxs.push(newIdx);
  }

  const pool = expanded.length > candidates.length ? expanded : candidates;

  return idxs.slice(0, n).map((ci, pi) => {
    const text = pool[ci] ?? pool[0]!;
    const isLast = pi === n - 1;
    return {
      path: FOUNDATION_PATHS[pi]!,
      prefer_candidate_ref: `表象候选${Math.min(ci, candidates.length - 1) + 1}${ci >= candidates.length ? `·子${ci - candidates.length + 1}` : ""}`,
      prefer_cite: clip(text, 80),
      prefer_claim: clip(
        isLast
          ? `末卡收束：由「${text.slice(0, 40)}」说明因此主辅成立`
          : `本卡须证明：「${text.slice(0, 48)}」在本盘能量结构上为何成立`,
        120,
      ),
    };
  });
}

/**
 * P2 foundation · situation material from collecting.
 * Not a surface menu. Attribution discovers surfaces from the chart judgment.
 */
export function buildFoundationSurfaceFeedBlock(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: FoundationSurfaceFeedOpts,
): string {
  const candidates = collectFoundationSurfaceCandidates(covered_agenda, opts);

  const lines: string[] = [
    "【P2 处境材料 · 不是表象清单】",
    "这些是用户已经说过的处境和约束。归因时可以对照。",
    "禁止把任一条原句填成 why_card 的 surface，禁止按问题条数一问一卡。",
    "表象和本质必须从本盘命理批断里长出来。禁止编造材料里没有的生活事件、数字、时限。",
  ];

  if (candidates.length === 0) {
    lines.push("(没有收集到处境材料 — 只根据本盘事实档和问题做归因，仍禁止编造未确认的数字。)");
  } else {
    candidates.forEach((c, i) => {
      lines.push(`材料${i + 1}. ${c}`);
    });
  }

  return lines.join("\n");
}
