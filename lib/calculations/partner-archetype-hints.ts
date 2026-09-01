/**
 * Pivot · 从用户主盘推出「对方型人」提示（非合盘、不断对方命）。
 * 供 inventory / 二元案引用。
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { nobleDirection } from "@/lib/calculations/metaphysics-pack/noble-direction";

export type PartnerArchetypeHint = {
  id: string;
  /** favor = 宜靠近；tension = 易耗你；buffer = 宜作缓冲 */
  polarity: "favor" | "tension" | "buffer";
  chart_token: string;
  note: string;
};

function tenGods(structured: ProfileStructured): string[] {
  const d = structured.pillars_detail;
  if (!d) return [];
  return [d.year, d.month, d.day, d.hour]
    .map((p) => String(p.ten_god ?? "").trim())
    .filter((g) => g && g !== "日主");
}

/**
 * 无对方盘时：只描述「对你结构而言」的适配/张力型人。
 */
export function buildPartnerArchetypeHints(
  structured: ProfileStructured,
): PartnerArchetypeHint[] {
  const gods = tenGods(structured);
  const joined = gods.join("");
  const weak =
    structured.strength === "weak" || String(structured.strength).includes("弱");
  const out: PartnerArchetypeHint[] = [];

  if (/比肩|劫财/.test(joined)) {
    out.push({
      id: "peer_rival_coop",
      polarity: weak ? "favor" : "tension",
      chart_token: weak ? "型人·可并行借力的同辈" : "型人·易内耗的并行同辈",
      note: weak
        ? "比劫显且身偏弱：宜找能分担前线、不抢决策权的同辈协作者"
        : "比劫显且身不弱：合作须先写清边界，防抢功内耗",
    });
  }
  if (/食神|伤官/.test(joined)) {
    out.push({
      id: "output_complement",
      polarity: "favor",
      chart_token: "型人·能承接你产出的转化者",
      note: "食伤显：宜靠近能把你的表达/产出变成结果的人，而非只加戏的人",
    });
  }
  if (/正官|七杀/.test(joined)) {
    out.push({
      id: "officer_pressure",
      polarity: weak ? "tension" : "buffer",
      chart_token: weak ? "型人·易加压的催促权责方" : "型人·清晰权责的规范方",
      note: weak
        ? "官杀显且续航薄：对方若持续催促加压，优先设边界而非硬扛"
        : "官杀显：宜与权责边界清楚的人共事，忌含糊加塞",
    });
  }
  if (/正财|偏财/.test(joined)) {
    out.push({
      id: "wealth_exchange",
      polarity: "buffer",
      chart_token: "型人·交换规则清楚的资源方",
      note: "财星显：宜与交换规则清楚的人合作；忌情感绑架式索取",
    });
  }
  if (/正印|偏印/.test(joined)) {
    out.push({
      id: "resource_buffer",
      polarity: "buffer",
      chart_token: "型人·能补给节奏的缓冲者",
      note: "印星显：宜靠近能给你结构补给、不抽干表达的人",
    });
  }

  const noble = nobleDirection(structured);
  const slot = noble.instances[0] ?? noble.theoretical_slots[0];
  if (slot?.traits_zh?.length) {
    out.push({
      id: "noble_complement",
      polarity: "favor",
      chart_token: `型人·互补气质(${slot.traits_zh.slice(0, 2).join("、")})`,
      note: "贵人方位特质：作「宜靠近的互补型」提示，禁止写成对方生肖/命定贵人",
    });
  }

  // 去重 id
  const seen = new Set<string>();
  return out.filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
}

export function formatPartnerArchetypeHintsForInventory(
  hints: readonly PartnerArchetypeHint[],
): string {
  if (hints.length === 0) {
    return "- 对方型人提示: （本盘未推出 — 二元案仍用主盘+现实行为写你侧边界，禁止无盘断对方命）";
  }
  const body = hints.map((h) => `${h.chart_token}〔${h.polarity}〕`).join("；");
  return `- 对方型人提示（仅描述对你结构的适配/张力 · 禁合盘翻版）: ${body}`;
}
