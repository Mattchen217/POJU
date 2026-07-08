import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";

export type StructuredInstanceInventoryOptions = {
  /** base_analysis 底座：标注本命结构关系 + 忽略流年/动态提示 */
  forBaseAnalysis?: boolean;
};

/** Lists shen_sha / ten_god / life_stage / natal relations — for LLM instance closed-set. */
export function buildStructuredInstanceInventory(
  structured: ProfileStructured,
  opts?: StructuredInstanceInventoryOptions,
): string {
  const shenSha = new Set<string>();
  const tenGods = new Set<string>();
  const lifeStages = new Set<string>();
  const hiddenStems = new Set<string>();

  if (structured.pillars_detail) {
    for (const key of ["year", "month", "day", "hour"] as const) {
      const p = structured.pillars_detail[key];
      if (p.ten_god) tenGods.add(p.ten_god);
      for (const s of p.shen_sha ?? []) shenSha.add(s);
      if (p.life_stage_han) lifeStages.add(p.life_stage_han);
      for (const h of p.hidden_stems ?? []) hiddenStems.add(h);
    }
  }

  const daYun = structured.da_yun ?? [];
  const daYunSample = daYun.slice(0, 12).map((d) => `${d.ganzhi}(${d.start_age}岁起)`);
  const chartRelations = computeNatalChartRelations(structured);
  const relationInventoryLine = opts?.forBaseAnalysis
    ? `- 本命结构关系（仅 source=natal · 仅可引用下列 · 底座禁写流年/动态）: ${
        chartRelations.length
          ? chartRelations.map((r) => r.han).join("、")
          : "（本盘未算出本命关系 — 禁止写任何刑冲合害/半合/三合/天干合词）"
      }`
    : `- 本盘动态关系（仅可引用下列，禁止自己推别的关系）: ${
        chartRelations.length
          ? chartRelations.map((r) => r.han).join("、")
          : "（本盘未算出关系 — 禁止写任何刑冲合害/半合/三合/天干合词）"
      }`;

  const lines = [
    "## 本次 structured 实例闭集（只能引用以下实际出现的项）",
    `- 神煞（本盘实算 ${shenSha.size} 项 · 仅可引用下列 · 清单外禁写）: ${
      shenSha.size ? [...shenSha].join("、") : "（无 — 禁止写任何神煞名）"
    }`,
    relationInventoryLine,
    `- 十神: ${tenGods.size ? [...tenGods].join("、") : "（无柱位十神 — 只做方向性描述）"}`,
    `- 十二长生: ${lifeStages.size ? [...lifeStages].join("、") : "（无 — 禁止编造）"}`,
    `- 藏干: ${hiddenStems.size ? [...hiddenStems].join("、") : "（无或未提供）"}`,
    `- 大运干支（仅可引用下列）: ${daYunSample.length ? daYunSample.join("；") : "（da_yun 缺失 — 见 data_availability）"}`,
    `- 用神/喜神/忌神/强弱/格局: 以 structured 字段为准（yong_shen=${structured.yong_shen ?? "—"}；xi_shen=${(structured.xi_shen ?? []).join("、") || "—"}；ji_shen=${(structured.ji_shen ?? []).join("、") || "—"}；strength=${structured.strength ?? "—"}；pattern 见 structured.pattern）`,
    `- data_availability: ${JSON.stringify(structured.data_availability ?? {})}`,
  ];

  if (!structured.data_availability?.pillars_detail) {
    lines.push("- pillars_detail.missing=true → 四柱细节段落只做方向性描述，禁止编造具体十神/神煞/藏干");
  }
  if (!structured.data_availability?.da_yun) {
    lines.push("- da_yun.missing=true → 大运段落只做 life phase 方向，禁止编造具体干支/起运岁数");
  }
  if (opts?.forBaseAnalysis) {
    lines.push(
      "- 底座关系纪律：只用上方【本命结构关系】锚定叙事（最多一处）；忽略流年引动/定向/十神张力——那些留给下游 POJU/Glyph/Syncro/Match",
    );
  }

  return lines.join("\n");
}
