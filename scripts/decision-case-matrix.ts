/**
 * Fixed cases for the 2026-10-27 decision-report batch.
 * Human SSOT: `.cursor/docs/decision-report/案例矩阵-2026-10-27.md`.
 * The runner must use these coordinates. Do not invent a second chart for joint.
 */

export type DecisionCaseSpec = {
  id: string;
  title: string;
  role: "primary" | "required" | "thin";
  birth: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: "M" | "F";
    timezone: string;
    place: string;
    latitude: number;
    longitude: number;
  };
  question: string;
  expect: string;
  detail: string;
  /** Explicit topic passed to the live gate. Null = question and path signals only. */
  topic: string | null;
  pivotChartPath: "solo" | "dyad";
  partnerBazi: "absent" | "present";
  joint: boolean;
  pathTags: readonly string[];
  conflictAnchors: string;
  sciHook: string;
  /** Shelf prose order the live gate must produce for this fixed input. */
  expectedFaces: readonly string[];
  note: string;
};

export const DECISION_CASES: readonly DecisionCaseSpec[] = [
  {
    id: "s35-resign-venture",
    title: "§3.5 离职创业",
    role: "primary",
    birth: {
      year: 1992,
      month: 3,
      day: 18,
      hour: 9,
      minute: 40,
      gender: "F",
      timezone: "Asia/Shanghai",
      place: "Shanghai",
      latitude: 31.2304,
      longitude: 121.4737,
    },
    question: "我该不该离开现在的岗位，自己把这件事做起来？",
    expect: "两年内能靠这件事养活自己",
    detail: "还有房贷，不能先空窗半年",
    topic: null,
    pivotChartPath: "solo",
    partnerBazi: "absent",
    joint: false,
    pathTags: ["离职", "留下"],
    conflictAnchors: "空窗会碰到房贷",
    sciHook: "转换成本",
    expectedFaces: ["01", "02", "04", "05", "06", "08", "03"],
    note: "官禄意向，但问句没有事业换场 / career_move 词干，也没有 joint。活闸因此不插 07。若操作者另传 topic=career_move，活闸会插入 07。本批不传那个词。",
  },
  {
    id: "intimate",
    title: "亲密关系",
    role: "required",
    birth: {
      year: 1988,
      month: 11,
      day: 2,
      hour: 21,
      minute: 15,
      gender: "M",
      timezone: "America/Los_Angeles",
      place: "Los Angeles",
      latitude: 34.0522,
      longitude: -118.2437,
    },
    question: "这段亲密关系还要不要继续一起过？",
    expect: "想知道是留下还是分开",
    detail: "同住，财务还绑在一起",
    topic: null,
    pivotChartPath: "solo",
    partnerBazi: "absent",
    joint: false,
    pathTags: ["留下", "分开"],
    conflictAnchors: "财务还绑在一起",
    sciHook: "关系承诺",
    expectedFaces: ["01", "02", "04", "05", "06", "07", "08", "03"],
    note: "问句含「亲密」。活闸插入 07，宫指向夫妻。不编对方盘。",
  },
  {
    id: "migration",
    title: "迁移",
    role: "required",
    birth: {
      year: 1996,
      month: 7,
      day: 9,
      hour: 14,
      minute: 5,
      gender: "F",
      timezone: "America/Chicago",
      place: "Austin",
      latitude: 30.2672,
      longitude: -97.7431,
    },
    question: "我考虑迁移到另一座城市，今年要不要走？",
    expect: "想在新城市站稳",
    detail: "工作可以远程，家里老人还在原城市",
    topic: null,
    pivotChartPath: "solo",
    partnerBazi: "absent",
    joint: false,
    pathTags: ["迁移", "留下"],
    conflictAnchors: "老人还在原城市",
    sciHook: "迁移成本",
    expectedFaces: ["01", "02", "04", "05", "06", "07", "08", "03"],
    note: "问句含「迁移」。活闸插入 07。换场词干也会插 07，本批用迁移这一条。",
  },
  {
    id: "general-stuck",
    title: "一般卡住的决定",
    role: "required",
    birth: {
      year: 1985,
      month: 1,
      day: 27,
      hour: 6,
      minute: 20,
      gender: "M",
      timezone: "America/Chicago",
      place: "Chicago",
      latitude: 41.8781,
      longitude: -87.6298,
    },
    question: "眼前这件事我一直定不下来，到底先做哪一头？",
    expect: "这周能做一个选择",
    detail: "两个方向都占时间，不能并行",
    topic: "general",
    pivotChartPath: "solo",
    partnerBazi: "absent",
    joint: false,
    pathTags: ["先做一头", "两头并行"],
    conflictAnchors: "两头并行会拖主线",
    sciHook: "决策负荷",
    expectedFaces: ["01", "02", "04", "05", "06", "08", "03"],
    note: "非关系、非换场。07 省略。06 的职责是近步原则、完成样貌、自调频，不是勾选清单。",
  },
  {
    id: "joint-thin",
    title: "joint / dyad 薄壳",
    role: "thin",
    birth: {
      year: 1990,
      month: 5,
      day: 21,
      hour: 11,
      minute: 10,
      gender: "F",
      timezone: "America/New_York",
      place: "New York",
      latitude: 40.7128,
      longitude: -74.006,
    },
    question: "我们要不要一起做这个决定？",
    expect: "想先知道能不能一起拍板",
    detail: "对方盘没有接入",
    topic: null,
    pivotChartPath: "dyad",
    partnerBazi: "present",
    joint: true,
    pathTags: ["一起决定", "先各自"],
    conflictAnchors: "对方盘未接入",
    sciHook: "共同决策",
    expectedFaces: ["01", "02", "04", "05", "06", "07", "08", "03"],
    note: "只用现成 joint 信号。不建第二份事实包。otherChart 保持空。标记 Thin。",
  },
];
