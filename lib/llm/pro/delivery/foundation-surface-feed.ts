/**
 * P2 foundation · numbered surface candidates from collecting + spine.
 * Quality-first: give the model real surfaces to diagnose — do not rely on
 * why_cards≥4 sanitize retries to invent drama.
 *
 * Also seeds Assign binding tuples (ref/cite/claim) per why_cards path.
 */

import type { CoveredAgendaItem } from "./reality-constraints";
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
      prefer_claim: `此表象卡须证明结构面${i + 1}为何成立并收束主辅`,
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

  // Dedupe while keeping length
  const seen = new Set<number>();
  const idxs: number[] = [];
  for (const i of order) {
    if (seen.has(i)) continue;
    seen.add(i);
    idxs.push(i);
    if (idxs.length >= n) break;
  }
  while (idxs.length < n) {
    idxs.push(idxs.length % candidates.length);
  }

  return idxs.map((ci, pi) => {
    const text = candidates[ci] ?? candidates[0]!;
    const isLast = pi === n - 1;
    return {
      path: FOUNDATION_PATHS[pi]!,
      prefer_candidate_ref: `表象候选${ci + 1}`,
      prefer_cite: clip(text, 80),
      prefer_claim: clip(
        isLast
          ? `末卡收束：由「${text.slice(0, 40)}」说明因此主辅成立`
          : `此表象说明结构上：${text.slice(0, 60)}`,
        120,
      ),
    };
  });
}

/**
 * Build an explicit why_card surface menu for deep + fill (foundation only).
 */
export function buildFoundationSurfaceFeedBlock(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: FoundationSurfaceFeedOpts,
): string {
  const candidates = collectFoundationSurfaceCandidates(covered_agenda, opts);

  const lines: string[] = [
    "【P2 表象候选菜单 · why_cards 唯一合法 surface 源】",
    "规则：每张 why_card.surface 必须能回溯到下列某一候选（可压缩改写，禁另编生活剧情）。",
    "目标 4 张不同表象卡 + 可选第 5 张；末卡 essence 收束「因此主辅成立」。",
    "若候选不足 4：把同一长答案拆成可观察子面（身体/心力/外部阻力/身份冲突），仍须同向本案收集事实——禁止虚构新事件。",
  ];

  if (candidates.length === 0) {
    lines.push(
      "(无收集/脊柱表象 — 仅用 core_conclusion 与真算多维写结构面；仍禁止编造缓冲月数/未确认赛道细节)",
    );
  } else {
    candidates.forEach((c, i) => {
      lines.push(`候选${i + 1}. ${c}`);
    });
    lines.push(
      `建议槽位: why_cards[0..${Math.min(3, Math.max(0, candidates.length - 1))}] 各挂不同候选；` +
        (candidates.length >= 4
          ? "材料够则写满 4–5 张。"
          : "材料偏少则拆子面凑满 4 张，勿注水复读。"),
    );
  }

  const hintTable = formatAssignBindingHintTable(
    buildFoundationAssignPathHints(candidates, Math.min(5, Math.max(4, candidates.length || 4))),
  );
  if (hintTable) lines.push(hintTable);

  return lines.join("\n");
}
