/**
 * PageFeedMatrix · 决策报告按页喂料（内容 SoT 2026-10-27）。
 *
 * 锁：`.cursor/docs/decision-report/PageFeedMatrix-2026-10-27.md`
 * 页结构真源与本文件对齐。切片实现在 `slice-for-page.ts`：
 * 只抄该页并集里有值的短键，缺值就省略，不把整包灌进一页。
 *
 * 书架脸是 01–08。内部出稿键仍折进这些脸。读路径走 `decision-page-bridge.ts`。
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
    /** Closed-set pattern hits (name/level/palaces) — no prose. */
    patternHits: "ZFP.patternHits",
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
    zfp: [Z.topicPalace, Z.sihua, Z.daxian, Z.patternHits],
    sci: "yes",
  },
  "04": {
    pageId: "04",
    user: [U.detail],
    cfp: [C.yongJi, C.shishenHit, C.dayunNow],
    zfp: [Z.sihua, Z.daxian, Z.patternHits],
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
    zfp: [Z.mingShen, Z.topicPalace, Z.sihua, Z.daxian, Z.patternHits],
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
      fields: [C.yongJi, C.shishenHit, Z.topicPalace, Z.sihua, Z.patternHits],
      optionalFields: [Z.patternHits],
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
      fields: [C.dayMaster, C.yongJi, C.dayunNow, Z.topicPalace, Z.sihua, Z.daxian, Z.patternHits],
      optionalFields: [Z.topicPalace, Z.sihua, Z.daxian, Z.patternHits],
      facts: "required",
      note: "紫微未稳时 ZFP 可空，只留八字锚。",
    },
  ],
  "04": [
    {
      id: "A",
      label: "卡点命名",
      fields: [C.shishenHit, C.yongJi, Z.sihua, Z.patternHits],
      optionalFields: [Z.patternHits],
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
      fields: [C.shishenHit, C.yongJi, Z.sihua, Z.patternHits, S.hooks],
      optionalFields: [Z.patternHits],
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
      fields: [Z.mingShen, Z.topicPalace, Z.sihua, Z.daxian, Z.patternHits],
      optionalFields: [Z.mingShen, Z.topicPalace, Z.sihua, Z.daxian, Z.patternHits],
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

export {
  page07Applies,
  readingOrderForTopic,
  sliceDumpKeys,
  sliceFieldCodes,
  sliceForPage,
  sliceStaysInAllowlist,
  type CfpShortInput,
  type PageFeedPacks,
  type PageSlice,
  type PageSliceResult,
  type PageSliceStub,
  type SlicedDaxian,
  type SlicedMingShen,
  type SlicedSihuaHit,
  type SlicedTopicPalace,
} from "@/lib/llm/pro/delivery/slice-for-page";
