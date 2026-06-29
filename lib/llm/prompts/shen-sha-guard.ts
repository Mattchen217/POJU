import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const PILLAR_KEYS = ["year", "month", "day", "hour"] as const;

/** Engine-computed shen_sha only — for last-mile guard before generation. */
export function extractChartShenSha(structured: ProfileStructured): string[] {
  const set = new Set<string>();
  const pd = structured.pillars_detail;
  if (!pd) return [];
  for (const key of PILLAR_KEYS) {
    for (const s of pd[key]?.shen_sha ?? []) {
      const t = s.trim();
      if (t) set.add(t);
    }
  }
  return [...set];
}

/** Breakthrough-core user tail — affirmative + audit failure mode. */
export function buildShenShaGuardBlock(structured: ProfileStructured): string {
  const chartShenSha = extractChartShenSha(structured);
  if (chartShenSha.length > 0) {
    return `【本盘神煞 · 硬约束（生成前再读一遍）】
这个盘引擎实际算出的神煞【只有】：${chartShenSha.join("、")}。
- 要提神煞，【只能从这几个里挑、按名引用】，结合所问之事点出助力或隐忧。
- 这盘没算出的神煞——包括你训练里认识的任何其他神煞（空亡/国印/将星/月德/天德/劫煞/元辰/六秀日/阴差阳错…）——对【这个盘】不存在。写一个都算编造，会被审计拦截、整份重写。
- 神煞少是正常的。不要为了"丰富"去补；不够就靠十神/用神/喜忌/强弱/大运/藏干说话，那些才是你的主材料。`;
  }
  return `【本盘神煞 · 硬约束（生成前再读一遍）】
这个盘引擎【没算出任何神煞】。所以整份输出里【一个神煞名都不许出现】（空亡/国印/将星/桃花/驿马/华盖…全部禁止）。
神煞为空是完全正常的——靠十神/用神/喜忌/强弱/大运/藏干说话即可。写任何神煞名都会被拦截、整份重写。`;
}

/** Chat system prompt — same closed-set rule, compact for prefix cache. */
export function buildChatShenShaGuardBlock(structured: ProfileStructured): string {
  const chartShenSha = extractChartShenSha(structured);
  if (chartShenSha.length > 0) {
    return `【本盘神煞 · 硬约束】
这个盘引擎实算的神煞【只有】：${chartShenSha.join("、")}。提神煞【只能从这里挑、按名引用】。
你训练里认识的其它神煞（天喜/红鸾/空亡/国印/将星/月德/天德/劫煞/元辰…）对【这个盘】不存在，写了就是错。
神煞少是正常的——没有就靠十神/用神/喜忌/强弱/大运说话，别为"丰富"硬补。`;
  }
  return `【本盘神煞 · 硬约束】
这个盘引擎【没算出任何神煞】。整份聊天回复里【一个神煞名都不许出现】（天喜/红鸾/空亡/国印/将星/桃花/驿马/华盖…全部禁止）。
神煞为空是正常的——靠十神/用神/喜忌/强弱/大运说话即可，别为"丰富"硬补。`;
}
