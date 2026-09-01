/**
 * Five-elements semantic SSOT (internal) — ontology / 虚旺方向 / black·white lists.
 * Dual consumers: prompt formatters + P4 sanitize/validator. Do NOT invent a second table.
 *
 * Gate 0: fields are short *directions* and anchors — not copyable action few-shots.
 * User-visible pages must not dump this table verbatim as metaphysics lecture.
 */

export const WUXING_ELEMENTS = ["木", "火", "土", "金", "水"] as const;
export type WuxingElement = (typeof WUXING_ELEMENTS)[number];

export const MEANS_ACTION_TYPES = ["rhythm", "mindset", "symbol", "field"] as const;
export type MeansActionType = (typeof MEANS_ACTION_TYPES)[number];

export type WuxingElementRow = {
  element: WuxingElement;
  virtue: string;
  /** Ontology — state / psyche, not physical stuff. */
  ontology: string;
  deficiency: {
    signs: readonly string[];
    /** Short directions only (not executable few-shots). */
    direction: {
      rhythm: string;
      mindset: string;
      symbol: string;
      field: string;
    };
  };
  excess: {
    signs: readonly string[];
    /** Prefer drain (泄) before control (克). */
    drain: string;
    control: string;
  };
  /** Bridge vocabulary only — must match this chart's yong/ji/xi before use. */
  synergy_vocab: readonly string[];
  /** Literal-object patterns (normalized substrings / soft phrases). */
  blacklist_patterns: readonly string[];
  /** Positive anchors for rhythm/mindset quality gate. */
  whitelist_anchors: readonly string[];
};

/** Shared synonym / paraphrase patterns that count as objectification for any element. */
export const WUXING_SHARED_LITERAL_PATTERNS: readonly string[] = [
  "流水摆件",
  "桌面喷泉",
  "加湿器",
  "水景",
  "水边",
  "海边",
  "江河",
  "湖泊",
  "湖边",
  "水域",
  "水汽",
  "亲水",
  "去游泳",
  "多喝水补",
  "泡澡补",
  "养绿植",
  "盆栽",
  "水仙",
  "绿意",
  "草木摆件",
  "去公园补",
  "去树林",
  "多晒太阳",
  "晒日光",
  "物理取暖补火",
  "吃黄色食物",
  "接触泥土",
  "接触土壤",
  "玩沙土",
  "佩戴金属",
  "戴金银",
  "金属摆件",
  "白色器物补金",
];

export const WUXING_SEMANTIC_SSOT: Record<WuxingElement, WuxingElementRow> = {
  木: {
    element: "木",
    virtue: "仁",
    ontology: "生长、条理、伸展、开创、自主空间。规划力与边界感，非树木本身。",
    deficiency: {
      signs: [
        "拓展欲弱，不敢要资源，画地为牢",
        "计划半途夭折，难把想法撑成框架",
        "对被安排/被框住容忍过高，边界感弱",
      ],
      direction: {
        rhythm: "留出不被打断的自主规划/留白时段",
        mindset: "先列提纲/画框架再动手",
        symbol: "绿/木质仅感官偏好，不得定义补木",
        field: "东/东南仅场域偏好，不得单独定义补木",
      },
    },
    excess: {
      signs: ["摊子铺太大收不拢", "极度排斥约束、难在规则内落地"],
      drain: "把多余伸展转成有限对外表达窗口（泄向火）",
      control: "设硬性终止线、做减法剪枝（克用金）",
    },
    synergy_vocab: ["水生木：以藏蓄发——先有沉静恢复，再谈有质量伸展"],
    blacklist_patterns: [
      "养绿植",
      "多接触植物",
      "去公园",
      "去树林",
      "买花卉",
      "看绿色补木",
      "窗边绿意",
      "自然绿意",
      "种一盆",
    ],
    whitelist_anchors: ["框架", "提纲", "自主", "拓展", "规划", "边界", "留白"],
  },
  火: {
    element: "火",
    virtue: "礼",
    ontology: "热情、表达、外放、被看见、点燃行动。社交表达与爆发力，非火焰/日照。",
    deficiency: {
      signs: ["表达欲低、想法易被埋没", "缺点燃行动的第一推动", "人际感染力/存在感弱"],
      direction: {
        rhythm: "固定主动发声/汇报窗口，不等被点名",
        mindset: "先说结论、亮出立场，少空铺垫",
        symbol: "暖色仅感官偏好，不得定义补火",
        field: "南方仅场域偏好，不得单独定义补火",
      },
    },
    excess: {
      signs: ["情绪易燥、冲动承诺难兑现", "表达过量、关键场合抢跑"],
      drain: "把过热表达转成可交付清单/落地件（泄向土）",
      control: "强制冷思考隔离后再公开发声（克用水）",
    },
    synergy_vocab: ["木生火：以理助发——先框架再高调表达"],
    blacklist_patterns: [
      "多晒太阳",
      "晒日光",
      "多用红色",
      "红色物件补火",
      "物理取暖",
      "暖色环境补火",
      "日光浴",
    ],
    whitelist_anchors: ["发声", "显化", "结论", "感染力", "表达窗口", "汇报", "被看见"],
  },
  土: {
    element: "土",
    virtue: "信",
    ontology: "稳、承载、落地、闭环、可靠。接得住与兑现，非泥土/黄色食物。",
    deficiency: {
      signs: ["易被外部变化带着走", "想法多落地少、兑现率低", "难给他人稳定感"],
      direction: {
        rhythm: "可重复的交付节点：想法→完成品",
        mindset: "先接住再筛选，下一步动作要明确",
        symbol: "土黄/大地色仅感官偏好",
        field: "中心场域仅次要偏好",
      },
    },
    excess: {
      signs: ["过度求稳拖延不确定决定", "背负过多他人责任、界限糊"],
      drain: "把求稳转成清晰切割与原则清单（泄向金）",
      control: "做微型破局实验、打破僵化稳态（克用木）",
    },
    synergy_vocab: ["火生土：以表达促落地——热情写成可执行标准"],
    blacklist_patterns: [
      "接触泥土",
      "接触土壤",
      "吃黄色食物",
      "玩沙土",
      "买陶瓷补土",
      "多踩地",
    ],
    whitelist_anchors: ["闭环", "交付", "节点", "承载", "兑现", "可靠", "确定性"],
  },
  金: {
    element: "金",
    virtue: "义",
    ontology: "收敛、决断、边界、切割、精炼。止损与原则感，非金属饰品。",
    deficiency: {
      signs: ["该止损却拖着", "原则弱、易被人情绑架", "边界糊、不善拒绝"],
      direction: {
        rhythm: "固定止损检查点，周期清理无效事项",
        mindset: "先说不再解释，少被拖进无效沟通",
        symbol: "白/金属色仅感官偏好",
        field: "西/西北仅次要场域偏好",
      },
    },
    excess: {
      signs: ["切割过快伤关系", "原则僵化缺弹性"],
      drain: "把过刚决断转成可恢复的休整边界（泄向水）",
      control: "在原则内加沟通软垫（克用火需谨慎；优先泄）",
    },
    synergy_vocab: ["土生金：以沉淀促决断——有事实闭环再止损"],
    blacklist_patterns: [
      "佩戴金属",
      "戴金银",
      "金属摆件",
      "白色器物补金",
      "买金饰",
    ],
    whitelist_anchors: ["止损", "边界", "拒绝", "精简", "决断", "原则", "切割"],
  },
  水: {
    element: "水",
    virtue: "智",
    ontology: "润下、藏、流动、缓冲、恢复。变通与蓄力，非液态水/加湿器。",
    deficiency: {
      signs: ["缺缓冲、易硬碰硬", "消耗后难恢复、长期紧绷", "非黑即白、变通不足"],
      direction: {
        rhythm: "收敛型休息：睡眠与非社交独处，给「藏」的时间",
        mindset: "冲突先不硬顶，找迂回路径",
        symbol: "黑/蓝/灰仅感官偏好，不得定义补水",
        field: "北/西北仅场域偏好，不得单独定义补水",
      },
    },
    excess: {
      signs: ["想太多少行动", "情绪泛滥、界限糊"],
      drain: "把泛滥思绪导成有限规划路径（泄向木）",
      control: "用交付规则筑堤、限制空想窗口（克用土）",
    },
    synergy_vocab: ["金生水：以断促藏——先切边界才有不受扰的蓄力"],
    blacklist_patterns: [
      "流水摆件",
      "桌面喷泉",
      "加湿器",
      "去水边",
      "水边散步",
      "去海边",
      "江河湖海",
      "靠近湖泊",
      "住处靠近水",
      "有水汽的地方",
      "多喝水补水",
      "泡澡补水",
      "养鱼补水",
    ],
    whitelist_anchors: ["缓冲", "蓄力", "弹性", "迂回", "降档", "收敛", "休息", "睡眠", "独处", "不硬顶"],
  },
};

const ELEMENT_RE = /[木火土金水]/g;

/** Infer elements mentioned in chart_anchors / strategy crumbs. */
export function inferWuxingElementsFromText(text: string): WuxingElement[] {
  const found = new Set<WuxingElement>();
  for (const m of text.matchAll(ELEMENT_RE)) {
    const e = m[0] as WuxingElement;
    if (WUXING_ELEMENTS.includes(e)) found.add(e);
  }
  // Soft English / pinyin crumbs
  const lower = text.toLowerCase();
  if (/wood|mu\b|用神.?木|喜木/.test(lower) || /用神·木|喜木/.test(text)) found.add("木");
  if (/fire|huo\b|用神.?火|喜火/.test(lower) || /用神·火|喜火/.test(text)) found.add("火");
  if (/earth|tu\b|用神.?土|喜土/.test(lower) || /用神·土|喜土/.test(text)) found.add("土");
  if (/metal|jin\b|用神.?金|喜金/.test(lower) || /用神·金|喜金/.test(text)) found.add("金");
  if (/water|shui\b|用神.?水|喜水/.test(lower) || /用神·水|喜水/.test(text)) found.add("水");
  return [...found];
}

export function getWuxingRow(el: WuxingElement): WuxingElementRow {
  return WUXING_SEMANTIC_SSOT[el];
}

/** All blacklist needles for given elements (+ shared). */
export function collectBlacklistPatterns(elements: readonly WuxingElement[]): string[] {
  const out = new Set<string>(WUXING_SHARED_LITERAL_PATTERNS);
  for (const el of elements) {
    for (const p of WUXING_SEMANTIC_SSOT[el].blacklist_patterns) out.add(p);
  }
  // If unknown element context, use all element blacklists (strict).
  if (elements.length === 0) {
    for (const el of WUXING_ELEMENTS) {
      for (const p of WUXING_SEMANTIC_SSOT[el].blacklist_patterns) out.add(p);
    }
  }
  return [...out];
}

export function collectWhitelistAnchors(elements: readonly WuxingElement[]): string[] {
  const out = new Set<string>();
  const els = elements.length ? elements : WUXING_ELEMENTS;
  for (const el of els) {
    for (const a of WUXING_SEMANTIC_SSOT[el].whitelist_anchors) out.add(a);
  }
  return [...out];
}

export function textHitsBlacklist(text: string, elements: readonly WuxingElement[]): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const p of collectBlacklistPatterns(elements)) {
    if (p && t.includes(p)) return p;
  }
  // Soft paraphrase regexes
  if (/靠近.{0,6}(湖|河|海|水)/.test(t)) return "靠近水域";
  if (/(窗边|阳台).{0,8}(绿|植|盆栽)/.test(t)) return "窗边绿植";
  if (/接触.{0,4}自然绿/.test(t)) return "自然绿意";
  if (/去有水/.test(t)) return "去有水";
  return null;
}

export function textHitsWhitelist(text: string, elements: readonly WuxingElement[]): boolean {
  const t = text.trim();
  if (!t) return false;
  return collectWhitelistAnchors(elements).some((a) => a && t.includes(a));
}

const TYPE_HINTS: Record<MeansActionType, RegExp> = {
  rhythm: /时段|节奏|作息|睡眠|窗口|节点|检查点|独处|留白|排程|周固定|收敛/,
  mindset: /练习|姿态|先说|不硬顶|迂回|框架|提纲|边界|拒绝|止损|降档|缓冲|变通/,
  symbol: /色|穿|着装|材质|木质|金属色|暖色|冷色|黑\/蓝|灰/,
  field: /方位|朝向|坐|北|南|东|西|西北|东南|场域|工位|开口侧/,
};

/** Classify means text; literal_object wins over declared type. */
export function classifyMeansActionType(
  text: string,
  declared?: MeansActionType | null,
  elements: readonly WuxingElement[] = [],
): MeansActionType | "literal_object" {
  if (textHitsBlacklist(text, elements)) return "literal_object";
  for (const ty of MEANS_ACTION_TYPES) {
    if (TYPE_HINTS[ty].test(text)) return ty;
  }
  if (declared && MEANS_ACTION_TYPES.includes(declared)) return declared;
  // Default unknown prose → mindset (state layer) rather than field
  return "mindset";
}

/**
 * Compact prompt block for relevant elements only (prefix-cache friendly).
 * Directions are labeled 方向 — models must invent case-specific means.
 */
export function formatWuxingSemanticForPrompt(
  elements: readonly WuxingElement[],
  opts?: { include_all_if_empty?: boolean },
): string {
  let els = [...elements];
  if (els.length === 0 && opts?.include_all_if_empty) els = [...WUXING_ELEMENTS];
  if (els.length === 0) return "";

  const blocks: string[] = [
    "【五行语义 SSOT · 内部 · 不对用户直出】",
    "补泻=状态/节奏/气质，不是 H₂O/绿植/晒太阳等物件。方向短语≠可抄范文；means 须按本案问题现写。",
    "行动 type：rhythm/mindset 优先且须靠前；symbol/field 次要最多各1且置后。",
    "生克联动句必须能对上本盘用神/忌神链；对不上只写单元素状态调和。",
    "旺者宜泄不宜硬克：先泄（转成产出/路径）再克。",
  ];

  for (const el of els) {
    const r = WUXING_SEMANTIC_SSOT[el];
    blocks.push(
      [
        `## ${el}（${r.virtue}）`,
        `本体: ${r.ontology}`,
        `虚→表现: ${r.deficiency.signs.join("；")}`,
        `虚→方向: rhythm=${r.deficiency.direction.rhythm} | mindset=${r.deficiency.direction.mindset} | symbol=${r.deficiency.direction.symbol} | field=${r.deficiency.direction.field}`,
        `旺→表现: ${r.excess.signs.join("；")}`,
        `旺→泄优先: ${r.excess.drain}；克备用: ${r.excess.control}`,
        `生克词汇(须 calc 门控): ${r.synergy_vocab.join("；")}`,
        `禁物化: ${r.blacklist_patterns.slice(0, 8).join("、")}…`,
        `气质锚: ${r.whitelist_anchors.join("、")}`,
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

/** Extract elements from metaphysics pack-ish text (yong line etc.). */
export function inferElementsFromCalcSlice(slice: string | null | undefined): WuxingElement[] {
  const text = (slice ?? "").trim();
  if (!text) return [];
  return inferWuxingElementsFromText(text);
}
