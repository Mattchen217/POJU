/**
 * PageFeedMatrix · 决策报告按页喂料骨架（内容 SoT 2026-10-27）。
 *
 * 锁：`.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md`
 * 页结构真源与本文件对齐。运行时出稿 key 仍走 v1 十段，直到 W2 改 schema/UI。
 *
 * `sliceForPage` 在 W0 只返回 allowlist 元数据 + 空切片形状。
 * 不读 ChartFactPack，不读紫微（ZiweiFactPack 属 W1），不裁剪真实盘面。
 * 紫微未稳时省略 ZFP 键，禁止用空话注水补宫。
 */

export const DECISION_PAGE_IDS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;
export type DecisionPageId = (typeof DECISION_PAGE_IDS)[number];

/** 主翻页。07 仅题相关才出。03 不在此列。 */
export const MAIN_NARRATIVE_PAGE_ORDER = ["01", "02", "04", "05", "06", "07", "08"] as const;

/** 必出主叙事（不含题相关 07、不含附录 03）。 */
export const REQUIRED_MAIN_PAGE_IDS = ["01", "02", "04", "05", "06", "08"] as const;

/** 包尾附录。固定生成，不进主翻页。 */
export const APPENDIX_PAGE_ID = "03" as const;

export const TOPIC_CONDITIONAL_PAGE_IDS = ["07"] as const;

export const FEED = {
  CFP: {
    dayMaster: "CFP.dayMaster",
    yongJi: "CFP.yongJi",
    shishenHit: "CFP.shishenHit",
    dayunNow: "CFP.dayunNow",
    pathTags: "CFP.pathTags",
    conflictAnchors: "CFP.conflictAnchors",
  },
  ZFP: {
    topicPalace: "ZFP.topicPalace",
    sihua: "ZFP.sihua",
    daxian: "ZFP.daxian",
    mingShen: "ZFP.mingShen",
    otherChart: "ZFP.otherChart",
  },
  User: {
    Q: "User.Q",
    expect: "User.expect",
    detail: "User.detail",
  },
  Sci: {
    hooks: "Sci.hooks",
  },
} as const;

export type CfpFieldCode = (typeof FEED.CFP)[keyof typeof FEED.CFP];
export type ZfpFieldCode = (typeof FEED.ZFP)[keyof typeof FEED.ZFP];
export type UserFieldCode = (typeof FEED.User)[keyof typeof FEED.User];
export type SciFieldCode = (typeof FEED.Sci)[keyof typeof FEED.Sci];
export type FeedFieldCode = CfpFieldCode | ZfpFieldCode | UserFieldCode | SciFieldCode;

export type CfpShortKey = keyof typeof FEED.CFP;
export type ZfpShortKey = keyof typeof FEED.ZFP;
export type UserShortKey = keyof typeof FEED.User;

/** 并集上的科学轨：否 / 必出 / 折叠 / 可选折叠。 */
export type PageSciMode = false | "yes" | "fold" | "optional";

export type PageUnionAllowlist = {
  pageId: DecisionPageId;
  user: readonly UserFieldCode[];
  cfp: readonly CfpFieldCode[];
  /** 紫微未稳时可整组省略，不要填假星。 */
  zfp: readonly ZfpFieldCode[];
  sci: PageSciMode;
};

export type PageSegmentId = "A" | "B" | "C" | "D" | "E";

export type SegmentAllowlist = {
  id: PageSegmentId;
  label: string;
  fields: readonly FeedFieldCode[];
  /** 在 fields 之内、矩阵标明可选的键。 */
  optionalFields: readonly FeedFieldCode[];
  /**
   * none：本段不喂事实字段（指针或对照句）。
   * optional：整段可缺（附录紫微未稳则跳过）。
   */
  facts: "required" | "none" | "optional";
  note?: string;
};

const U = FEED.User;
const C = FEED.CFP;
const Z = FEED.ZFP;
const S = FEED.Sci;

export const PAGE_UNION_ALLOWLISTS: Record<DecisionPageId, PageUnionAllowlist> = {
  "01": {
    pageId: "01",
    user: [U.Q, U.expect],
    cfp: [C.pathTags, C.yongJi, C.dayunNow, C.conflictAnchors],
    zfp: [Z.topicPalace, Z.daxian],
    sci: false,
  },
  "02": {
    pageId: "02",
    user: [U.Q, U.expect, U.detail],
    cfp: [C.dayMaster, C.yongJi, C.shishenHit, C.dayunNow],
    zfp: [Z.topicPalace, Z.sihua, Z.daxian],
    sci: "yes",
  },
  "04": {
    pageId: "04",
    user: [U.detail],
    cfp: [C.yongJi, C.shishenHit, C.dayunNow],
    zfp: [Z.sihua, Z.daxian],
    sci: "fold",
  },
  "05": {
    pageId: "05",
    user: [U.expect, U.detail],
    cfp: [C.pathTags, C.yongJi, C.conflictAnchors, C.dayunNow],
    zfp: [Z.topicPalace, Z.sihua, Z.daxian],
    sci: "optional",
  },
  "06": {
    pageId: "06",
    user: [U.Q, U.expect, U.detail],
    cfp: [C.dayunNow],
    zfp: [Z.daxian],
    sci: "yes",
  },
  "07": {
    pageId: "07",
    user: [U.detail],
    cfp: [C.pathTags],
    zfp: [Z.topicPalace, Z.daxian, Z.otherChart],
    sci: "fold",
  },
  "08": {
    pageId: "08",
    user: [U.Q, U.expect],
    cfp: [C.shishenHit, C.dayunNow],
    zfp: [Z.sihua],
    sci: false,
  },
  "03": {
    pageId: "03",
    user: [],
    cfp: [C.dayMaster, C.yongJi, C.shishenHit, C.dayunNow],
    zfp: [Z.mingShen, Z.topicPalace, Z.sihua, Z.daxian],
    sci: false,
  },
};

export const PAGE_SEGMENT_ALLOWLISTS: Record<DecisionPageId, readonly SegmentAllowlist[]> = {
  "01": [
    {
      id: "A",
      label: "主推荐",
      fields: [C.pathTags, C.yongJi, Z.topicPalace, U.Q],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "成立条件",
      fields: [C.dayunNow, Z.daxian, U.expect],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "不选什么",
      fields: [C.conflictAnchors, Z.topicPalace],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "D",
      label: "依据指针",
      fields: [],
      optionalFields: [],
      facts: "none",
      note: "一句指回 02，本段不喂盘面字段。",
    },
  ],
  "02": [
    {
      id: "A",
      label: "命理理由",
      fields: [C.yongJi, C.shishenHit, Z.topicPalace, Z.sihua],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "科学机制",
      fields: [U.Q, U.detail, S.hooks],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "汇合",
      fields: [U.Q, U.expect, U.detail, S.hooks],
      optionalFields: [],
      facts: "required",
      note: "另引用本页并集里的一个盘锚，不新开字段。",
    },
    {
      id: "D",
      label: "可核对锚",
      fields: [C.dayMaster, C.yongJi, C.dayunNow, Z.topicPalace, Z.sihua, Z.daxian],
      optionalFields: [Z.topicPalace, Z.sihua, Z.daxian],
      facts: "required",
      note: "紫微未稳时 ZFP 可空，只留八字锚。",
    },
  ],
  "04": [
    {
      id: "A",
      label: "卡点命名",
      fields: [C.shishenHit, C.yongJi, Z.sihua],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "表现",
      fields: [C.shishenHit, C.yongJi, Z.sihua, U.detail],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "若硬顶",
      fields: [C.dayunNow, Z.daxian],
      optionalFields: [C.dayunNow, Z.daxian],
      facts: "optional",
      note: "写成本，不写灾祸恐吓。",
    },
    {
      id: "D",
      label: "依据折叠",
      fields: [C.shishenHit, C.yongJi, Z.sihua, S.hooks],
      optionalFields: [],
      facts: "required",
    },
  ],
  "05": [
    {
      id: "A",
      label: "首选",
      fields: [C.pathTags, C.yongJi, Z.topicPalace, U.expect],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "次选",
      fields: [C.pathTags, Z.topicPalace],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "慎选",
      fields: [C.conflictAnchors, Z.sihua],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "D",
      label: "切轨/停止",
      fields: [C.dayunNow, Z.daxian, U.detail],
      optionalFields: [],
      facts: "required",
      note: "本段必出。",
    },
    {
      id: "E",
      label: "对照",
      fields: [],
      optionalFields: [],
      facts: "none",
    },
  ],
  "06": [
    {
      id: "A",
      label: "近步原则",
      fields: [U.detail, U.Q, S.hooks],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "阶段气候",
      fields: [C.dayunNow, Z.daxian],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "自我调频",
      fields: [U.expect, S.hooks],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "D",
      label: "节奏提醒",
      fields: [C.dayunNow, U.expect],
      optionalFields: [],
      facts: "required",
    },
  ],
  "07": [
    {
      id: "A",
      label: "场域判断",
      fields: [C.pathTags, Z.topicPalace, Z.daxian, U.detail],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "关系/互动",
      fields: [Z.topicPalace, Z.otherChart, U.detail],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "依据折叠",
      fields: [C.pathTags, Z.topicPalace, Z.daxian, Z.otherChart, U.detail, S.hooks],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "D",
      label: "与 01/05 对齐",
      fields: [],
      optionalFields: [],
      facts: "none",
    },
  ],
  "08": [
    {
      id: "A",
      label: "红灯信号",
      fields: [C.shishenHit, Z.sihua],
      optionalFields: [],
      facts: "required",
      note: "短锚，不展开全盘。",
    },
    {
      id: "B",
      label: "复盘问句",
      fields: [U.Q, U.expect],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "C",
      label: "何时重跑本题",
      fields: [C.dayunNow, U.expect],
      optionalFields: [C.dayunNow],
      facts: "required",
    },
  ],
  "03": [
    {
      id: "A",
      label: "八字本题切片",
      fields: [C.dayMaster, C.yongJi, C.shishenHit, C.dayunNow],
      optionalFields: [],
      facts: "required",
    },
    {
      id: "B",
      label: "紫微本题切片",
      fields: [Z.mingShen, Z.topicPalace, Z.sihua, Z.daxian],
      optionalFields: [Z.mingShen, Z.topicPalace, Z.sihua, Z.daxian],
      facts: "optional",
      note: "紫微未稳则整段跳过，不注水。",
    },
    {
      id: "C",
      label: "对照一句",
      fields: [],
      optionalFields: [],
      facts: "none",
      note: "只对照 A/B 已列内容。",
    },
  ],
};

/** W0 入参。值可缺；本函数不消费具体真算。 */
export type PageFeedPacks = {
  cfp?: Partial<Record<CfpShortKey, unknown>> | null;
  /**
   * 省略或 null = 紫微未稳。切片不带 ZFP 键。
   * 空对象 = 盘在，但 W0 仍只留空槽，不填星。
   */
  zfp?: Partial<Record<ZfpShortKey, unknown>> | null;
  user?: Partial<Record<UserShortKey, unknown>> | null;
  sci?: { hooks?: unknown } | null;
};

export type PageSliceShape = {
  cfp: Partial<Record<CfpShortKey, null>>;
  zfp?: Partial<Record<ZfpShortKey, null>>;
  user: Partial<Record<UserShortKey, null>>;
  sci?: null;
};

export type PageSliceStub = {
  pageId: DecisionPageId;
  allowlist: PageUnionAllowlist;
  segments: readonly SegmentAllowlist[];
  /** 空形状。W2 才按 allowlist 填 packs。 */
  slice: PageSliceShape;
  zfpOmitted: boolean;
};

const SHORT_KEY: Record<FeedFieldCode, string> = {
  [C.dayMaster]: "dayMaster",
  [C.yongJi]: "yongJi",
  [C.shishenHit]: "shishenHit",
  [C.dayunNow]: "dayunNow",
  [C.pathTags]: "pathTags",
  [C.conflictAnchors]: "conflictAnchors",
  [Z.topicPalace]: "topicPalace",
  [Z.sihua]: "sihua",
  [Z.daxian]: "daxian",
  [Z.mingShen]: "mingShen",
  [Z.otherChart]: "otherChart",
  [U.Q]: "Q",
  [U.expect]: "expect",
  [U.detail]: "detail",
  [S.hooks]: "hooks",
};

function nullSlots<K extends string>(keys: readonly K[]): Partial<Record<K, null>> {
  const out: Partial<Record<K, null>> = {};
  for (const key of keys) out[key] = null;
  return out;
}

function isDecisionPageId(value: string): value is DecisionPageId {
  return (DECISION_PAGE_IDS as readonly string[]).includes(value);
}

/**
 * W0 stub。返回该页并集元数据，以及按并集排好的空槽。
 * packs 里的真算值一律不写入 slice。
 * `packs.zfp == null`（含省略）时去掉 zfp，避免未稳紫微被写成空宫注水。
 */
export function sliceForPage(pageId: DecisionPageId, packs?: PageFeedPacks): PageSliceStub {
  if (!isDecisionPageId(pageId)) {
    throw new Error(`sliceForPage: unknown pageId ${pageId}`);
  }
  const allowlist = PAGE_UNION_ALLOWLISTS[pageId];
  const zfpOmitted = packs?.zfp == null;
  const slice: PageSliceShape = {
    cfp: nullSlots(allowlist.cfp.map((code) => SHORT_KEY[code] as CfpShortKey)),
    user: nullSlots(allowlist.user.map((code) => SHORT_KEY[code] as UserShortKey)),
  };
  if (!zfpOmitted) {
    slice.zfp = nullSlots(allowlist.zfp.map((code) => SHORT_KEY[code] as ZfpShortKey));
  }
  if (allowlist.sci !== false) {
    slice.sci = null;
  }
  return {
    pageId,
    allowlist,
    segments: PAGE_SEGMENT_ALLOWLISTS[pageId],
    slice,
    zfpOmitted,
  };
}
