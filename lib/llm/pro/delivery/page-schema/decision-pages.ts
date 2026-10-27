/**
 * 决策报告 01–08 页骨架。段号与 PageFeedMatrix 段级 allowlist 对齐。
 *
 * 这是内容页职责表，也是书架脸的读路径。生成填槽 zod 仍按内部键；脸级包装在 `shelf-face-schema.ts`。
 * 双轨挂在页上（指针 / A+B+C / 折叠 / 现实偏重 / 附录），不嵌进每一句。
 * 07 题相关才进入阅读序。03 固定包尾附录。
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
    title: "本题断语",
    question: "到底怎么走？",
    placement: "main",
    required: true,
    topicGated: false,
    dualTrack: "pointer",
    dualTrackNote: "不展开论证。一句指回 02。",
    segments: [
      { id: "A", label: "主推荐", duty: "一两句方向，带条件的明确主推。" },
      { id: "B", label: "成立条件", duty: "这条路成立的条件。" },
      { id: "C", label: "不选什么", duty: "眼下不走的方向。" },
      { id: "D", label: "依据指针", duty: "一句指向 02。本段不喂盘面字段。" },
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
      { id: "A", label: "命理理由", duty: "用本页命理锚说明为何是这个断语。" },
      { id: "B", label: "科学机制", duty: "同页科学机制，不另开一页。" },
      { id: "C", label: "汇合", duty: "命理锚与科学机制收到同一个决定上。" },
      { id: "D", label: "可核对锚", duty: "短锚。紫微未进切片时只留八字锚。" },
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
      { id: "A", label: "卡点命名", duty: "给卡住的机制起名。" },
      { id: "B", label: "表现", duty: "这个卡点在本题里怎么出现。" },
      { id: "C", label: "若硬顶", duty: "硬顶的成本。写代价，不写灾祸恐吓。" },
      { id: "D", label: "依据折叠", duty: "A/B 的依据可折叠。" },
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
    dualTrackNote: "理由可折叠。D 切轨/停止必出。",
    segments: [
      { id: "A", label: "首选", duty: "眼下更宜的一条路。" },
      { id: "B", label: "次选", duty: "条件成立时的下一条。" },
      { id: "C", label: "慎选", duty: "会和主推荐抢气的路。" },
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
    dualTrackNote: "现实偏重。近步原则、完成样貌、自我调频。不是勾选作业。",
    segments: [
      { id: "A", label: "近步原则", duty: "下一步的动作类型与完成样貌。" },
      { id: "B", label: "阶段气候", duty: "当前大运/大限这一段的节奏，不播流日。" },
      { id: "C", label: "自我调频", duty: "执行中怎么调自己。旧调频页折进这里。" },
      { id: "D", label: "节奏提醒", duty: "这一阶段的节奏，不是四周清单。" },
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
    dualTrackNote: "现实偏重。红灯、复盘问句、何时重跑本题。",
    segments: [
      { id: "A", label: "红灯信号", duty: "短信号。不展开全盘。" },
      { id: "B", label: "复盘问句", duty: "用来回头看本题的问句。" },
      { id: "C", label: "何时重跑本题", duty: "什么变化出现了再重跑。" },
    ],
  },
  "03": {
    pageId: "03",
    title: "盘面附录",
    question: "还想核对更细盘？",
    placement: "appendix",
    required: true,
    topicGated: false,
    dualTrack: "appendix",
    dualTrackNote: "包尾附录。命理核对为主，不要求科学双段。",
    segments: [
      { id: "A", label: "八字本题切片", duty: "只列本题用到的八字短锚。" },
      { id: "B", label: "紫微本题切片", duty: "紫微未进切片时整段跳过，不补假宫。" },
      { id: "C", label: "对照一句", duty: "只对照 A/B 已经列出的内容。" },
    ],
  },
};
