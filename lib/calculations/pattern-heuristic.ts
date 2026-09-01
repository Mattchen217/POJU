/**
 * 格局粗标签（本地启发式 · 非古典全格裁定）
 * 从柱位十神 + 身强弱推出可引用短标签，供 structured.pattern / inventory。
 */

import type { ProfileStrength } from "@/lib/calculations/build-profile-structured";

export type PatternHeuristic = {
  id: string;
  /** 可进 structured.pattern / chart_anchors 的短标签 */
  han: string;
  note: string;
};

function hasAny(gods: readonly string[], re: RegExp): boolean {
  return gods.some((g) => re.test(g));
}

/**
 * 确定性格局倾向（一名一盘）。禁止职业/吉凶裁定。
 */
export function inferPatternHeuristic(input: {
  tenGods: readonly string[];
  strength: ProfileStrength;
}): PatternHeuristic {
  const gods = input.tenGods.map((g) => String(g).trim()).filter(Boolean);
  const joined = gods.join("、") || "（无十神）";
  const weak = input.strength === "weak";
  const strong = input.strength === "strong";

  const wealth = hasAny(gods, /正财|偏财/);
  const officer = hasAny(gods, /正官|七杀/);
  const output = hasAny(gods, /食神|伤官/);
  const peer = hasAny(gods, /比肩|劫财/);
  const resource = hasAny(gods, /正印|偏印/);

  if (output && wealth) {
    return {
      id: "shishang_shengcai",
      han: "食伤生财倾向",
      note: `十神见${joined}；产出→回流链路显，策略宜守产出闭环而非空转表达`,
    };
  }
  if (officer && wealth) {
    return {
      id: "caiguan_shuangxian",
      han: "财官同现倾向",
      note: `十神见${joined}；资源与规范同盘，主辅须说清先边界还是先变现`,
    };
  }
  if (officer && weak) {
    return {
      id: "guansha_yashen",
      han: "官杀偏压·身弱",
      note: `十神见${joined}；权责压在薄续航上，宜降档边界、忌硬顶`,
    };
  }
  if (officer && strong) {
    return {
      id: "shenwang_renguan",
      han: "身旺任官杀倾向",
      note: `十神见${joined}；有承载力接权责，仍须防连续高压内耗`,
    };
  }
  if (resource && (officer || weak)) {
    return {
      id: "yinwang_shengshen",
      han: "印星生身倾向",
      note: `十神见${joined}；补给/学习链路显，宜借结构续航，忌空耗输出`,
    };
  }
  if (peer && output) {
    return {
      id: "bijie_shishang",
      han: "比劫食伤并见",
      note: `十神见${joined}；并行协作与产出同在，合作要写清边界防内耗`,
    };
  }
  if (peer) {
    return {
      id: "bijie_bingxian",
      han: weak ? "比劫显·宜借力" : "比劫显·防内耗",
      note: `十神见${joined}；同辈并行易放大也易抢功`,
    };
  }
  if (output) {
    return {
      id: "shishang_pianwang",
      han: "食伤偏显",
      note: `十神见${joined}；表达/产出链路显，适合独立产出型路径`,
    };
  }
  if (wealth) {
    return {
      id: "caixing_pianxian",
      han: "财星偏显",
      note: `十神见${joined}；交换/资源链路显，决策须对上承载力`,
    };
  }

  return {
    id: "fuyi_zhengge",
    han: strong ? "扶抑正格·身偏旺" : weak ? "扶抑正格·身偏弱" : "扶抑正格·均衡",
    note: `十神见${joined || "稀薄"}；按扶抑调攻守，不另开从格专断`,
  };
}
