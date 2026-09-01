import type { BreakthroughCore } from "@/lib/poju/agent-state";

const RISK_POLARITY_RE =
  /压力|易栽|未熟|过耗|过刚|压制|阻力|忌|盲|耗|崩|风险|熔断|红灯|坑|警戒|不宜|硬冲|耗尽|失控/;

/** P4: filter multi_dim by question/expectation keywords + yong/ji hints. */
export function filterMultiDimIndicesForP4(
  core: BreakthroughCore,
  questionText: string,
  desiredOutcome: string,
): number[] {
  const dims = core.multi_dimension_reckoning ?? [];
  if (dims.length === 0) return [];

  const blob = `${questionText} ${desiredOutcome}`.toLowerCase();
  const pack = core.metaphysics_pack;
  const hints = [
    pack?.yong_shen.primary_yong_shen,
    ...(pack?.yong_shen.ji_shen ?? []),
    core.energy_retune_frame.timing_ripeness,
  ]
    .filter(Boolean)
    .join(" ");

  const scored = dims.map((d, i) => {
    const text = `${d.dimension}${d.judgment}${d.chart_basis}`;
    let score = 0;
    for (const token of text.split(/[\s、，。；]+/)) {
      if (token.length >= 2 && blob.includes(token.toLowerCase())) score += 2;
    }
    if (hints && text.split("").some((c) => hints.includes(c))) score += 1;
    if (/大运|流年|阶段|周期|运/.test(text)) score += 1;
    if (/用神|忌神|五行|调频|色|向|时/.test(text)) score += 1;
    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.filter((s) => s.score > 0).slice(0, 6).map((s) => s.i);
  if (picked.length >= 2) return [...new Set(picked)].sort((a, b) => a - b);
  return dims.map((_, i) => i).slice(0, Math.min(4, dims.length));
}

export function filterMultiDimIndicesForRisk(core: BreakthroughCore): number[] {
  const dims = core.multi_dimension_reckoning ?? [];
  const matched = dims
    .map((d, i) => ({ i, hit: RISK_POLARITY_RE.test(`${d.dimension}${d.judgment}${d.chart_basis}`) }))
    .filter((x) => x.hit)
    .map((x) => x.i);
  if (matched.length > 0) return matched.slice(0, 6);
  return dims.map((_, i) => i).slice(0, 3);
}
