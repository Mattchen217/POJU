/**
 * 决策报告 01–08 页骨架。段号与 PageFeedMatrix 段级 allowlist 对齐。
 *
 * 这是内容页职责表，也是书架脸的读路径。生成填槽 zod = face-types.ts（一脸一段字段）。
 * 双轨挂在页上（指针 / A+B+C / 折叠 / 现实偏重 / 附录），不嵌进每一句。
 * 07 题相关才进入阅读序。03 固定包尾术语附录（非盘面列表）。
 */

import type { DecisionPageId, PageSegmentId } from "@/lib/llm/pro/delivery/page-feed-matrix";

/** 同页双轨怎么挂。不是逐句嵌套。 */
export type DualTrackMount = "pointer" | "abc" | "fold" | "reality" | "appendix";

export type DecisionPageSegment = {
  id: PageSegmentId;
  label: string;
  duty: string;
};

export type DecisionPageSchema = {
  pageId: DecisionPageId;
  title: string;
  question: string;
  placement: "main" | "appendix";
  required: boolean;
  /** true：阅读序只在事业换场 / 迁移 / 合伙 / 亲密 / joint 时插入。 */
  topicGated: boolean;
  dualTrack: DualTrackMount;
  dualTrackNote: string;
  segments: readonly DecisionPageSegment[];
};

export const DECISION_PAGE_SCHEMAS: Record<DecisionPageId, DecisionPageSchema> = {
  "01": {
    pageId: "01",
    title: "本题决策结论",
    question: "这件事现在到底应该怎么走？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "pointer",
    dualTrackNote: "不展开完整论证；理由与边界指向 02 依据单元。正文零命理专名、零软译术语。",
    segments: [
      { id: "A", label: "核心判断", duty: "1–3 句直接回答决策问题；claim_ids 必填。" },
      { id: "B", label: "为什么优先选这条路", duty: "最多三条摘要理由；每条关联 claim/evidence 并指向 02。" },
      { id: "C", label: "推荐成立的条件", duty: "2–4 项；标明 satisfied/unconfirmed/conflicted/not_applicable。" },
      { id: "D", label: "当前不建议什么", duty: "1–2 个不建议选项，写清冲突与代价。" },
      { id: "E", label: "判断适用边界", duty: "当前依据 + 失效条件；指向 02 与 08。" },
    ],
  },
  "02": {
    pageId: "02",
    title: "为何如此",
    question: "凭什么信你？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "abc",
    dualTrackNote: "同页 A 命理、B 科学、C 汇合都要有。D 是可核对短锚。",
    segments: [
      { id: "A", label: "命理理由", duty: "CFP+ZFP 共担：用本页八字锚与相关紫微（宫/四化/格局·有则用、无关省略）说明为何是这个断语；禁整盘灌段；禁手段处方。" },
      { id: "B", label: "科学机制", duty: "同页科学机制，不另开一页；禁手段处方。" },
      { id: "C", label: "汇合", duty: "把本页已用的命理锚（八字±相关紫微）与科学机制收到同一决定上的交汇张力；勿为汇合硬塞未用紫微；禁行动处方。" },
      { id: "D", label: "可核对锚", duty: "短锚；八字+相关紫微（有则抄本页切片/闭集）。紫微未稳时只留八字锚；禁堆砌未用宫星。" },
    ],
  },
  "04": {
    pageId: "04",
    title: "真正卡点",
    question: "卡在哪？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "fold",
    dualTrackNote: "关键摩擦写在 A/B。依据可折叠，不逐句嵌双轨。",
    segments: [
      { id: "A", label: "卡点命名", duty: "给卡住的机制起名；可用相关八字+紫微四化/格局共担，无关则省略。" },
      { id: "B", label: "表现", duty: "这个卡点在本题里怎么出现。" },
      { id: "C", label: "若硬顶", duty: "硬顶的成本。写代价，不写灾祸恐吓。" },
      { id: "D", label: "依据折叠", duty: "A/B 的依据可折叠；命理折层可含相关紫微传统真词（证据层），可见正文仍白话。" },
    ],
  },
  "05": {
    pageId: "05",
    title: "路径排序",
    question: "还有别的路吗？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "fold",
    dualTrackNote: "理由可折叠。D 切轨/停止必出。Product Stage4 P5：条件式推荐 + recommendation_conditions / evidence_trace。",
    segments: [
      { id: "A", label: "首选", duty: "条件式首选（含依据/成本/前置/可逆性）；非无条件断言。" },
      { id: "B", label: "次选", duty: "条件成立时的下一条（可含组合/分阶段/低成本试验）。" },
      { id: "C", label: "慎选", duty: "会和主推荐抢气或高承诺的路。" },
      { id: "D", label: "切轨/停止", duty: "何时换轨或停下。本段必出。" },
      { id: "E", label: "对照", duty: "一句对照，不新开盘面字段。" },
    ],
  },
  "06": {
    pageId: "06",
    title: "怎么落地",
    question: "下周干什么？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "reality",
    dualTrackNote: "现实偏重。近步原则、完成样貌、自我调频。不是勾选作业。Product Stage4 P6：verification_experiment 七问。",
    segments: [
      { id: "A", label: "近步原则", duty: "下一步的动作类型与完成样貌；对齐验证实验，非勾选清单。" },
      { id: "B", label: "阶段气候", duty: "当前大运/大限这一段的节奏（CFP dayun ↔ ZFP daxian 相关才写）；不播流日；禁整盘紫微。" },
      { id: "C", label: "自我调频", duty: "执行中怎么调自己。旧调频页折进这里。" },
      { id: "D", label: "节奏提醒", duty: "这一阶段的节奏，不是四周清单；验证完成前 defer 额外成本。" },
    ],
  },
  "07": {
    pageId: "07",
    title: "场域与关系",
    question: "关系/换场呢？",
    placement: "main",
    required: false,
    topicGated: true,
    dualTrack: "abc",
    dualTrackNote: "只在换场、迁移、合伙、亲密或 joint 时插入。边界双轨，不写合婚恐吓。",
    segments: [
      { id: "A", label: "场域判断", duty: "这个场该不该进、该不该留。" },
      { id: "B", label: "关系/互动", duty: "人和人怎么互动。他盘未接入时不编对方盘。" },
      { id: "C", label: "依据折叠", duty: "A/B 的依据可折叠。" },
      { id: "D", label: "与 01/05 对齐", duty: "和断语、路径排序对齐。本段不喂新字段。" },
    ],
  },
  "08": {
    pageId: "08",
    title: "自检清单",
    question: "走偏了怎么办？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "reality",
    dualTrackNote: "现实偏重。红灯、复盘问句、何时重跑本题。Product Stage4 P8：shared_core_metrics + continue|adjust|stop|rerun。",
    segments: [
      { id: "A", label: "红灯信号", duty: "短信号。不展开全盘。" },
      { id: "B", label: "复盘问句", duty: "用来回头看本题的问句；对齐 P6 共享核心指标。" },
      { id: "C", label: "何时重跑本题", duty: "什么变化出现了再重跑（rerun）；与 continue/adjust/stop 并列。" },
    ],
  },
  "03": {
    pageId: "03",
    title: "本报告使用的术语",
    question: "本报告依据层用了哪些软译术语？",
    placement: "appendix",
    required: false,
    topicGated: false,
    dualTrack: "appendix",
    dualTrackNote: "包尾元信息附录。从最终依据层实际 term_id 汇总；无术语则整页省略。不喂盘面、不调模型。",
    segments: [
      { id: "A", label: "阅读说明", duty: "软译标签用途说明；不以科学概念伪装。" },
      { id: "B", label: "术语列表", duty: "本报告实际使用的 term_id；渲染时从 SSOT 取软译名与解释。" },
    ],
  },
};
