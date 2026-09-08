/**
 * P2 foundation · numbered surface candidates from collecting + spine.
 * Quality-first: give the model real surfaces to diagnose — do not rely on
 * why_cards≥4 sanitize retries to invent drama.
 */

import type { CoveredAgendaItem } from "./reality-constraints";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
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

/**
 * Build an explicit why_card surface menu for deep + fill (foundation only).
 */
export function buildFoundationSurfaceFeedBlock(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: FoundationSurfaceFeedOpts,
): string {
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

  // Spine facets — structural surfaces, not invented life drama.
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

  return lines.join("\n");
}
