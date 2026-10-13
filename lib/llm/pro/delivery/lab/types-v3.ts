/**
 * Delivery Lab v3 — greenfield step table (three-step pipeline).
 * Do not mix with legacy LAB_STEP_DEFS step keys.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export type LabV3StepKind =
  | "bootstrap"
  | "thesis"
  | "prealloc"
  | "content_judgment"
  | "content_body"
  | "gate"
  | "body_polish"
  | "evidence_soft"
  | "assemble"
  | "companion_seal"
  | "companion_daily"
  | "companion_batch_pair"
  | "companion_batch_gate";

/** 润色目标语言（一次 invoke 一个；Lab 可跳过或只跑其一）。 */
export const BODY_POLISH_LOCALES = ["zh", "en", "fr", "es"] as const;
export type BodyPolishLocale = (typeof BODY_POLISH_LOCALES)[number];

export function isBodyPolishLocale(v: string): v is BodyPolishLocale {
  return (BODY_POLISH_LOCALES as readonly string[]).includes(v);
}

export type LabV3StepDef = {
  step_key: string;
  label: string;
  page?: DeliverySegmentKey;
  kind: LabV3StepKind;
  uses_llm: boolean;
  accept: string;
};

function bodyAccept(page: DeliverySegmentKey): string {
  switch (page) {
    case "foundation":
      return "白话正文=批断翻译；真准即可。表面专名可 defer 润色；跳过润色则本步须过 full 表面闸。人审：删批断须垮、禁怎么办收束。尺：分步职责 SSOT。";
    case "direct_answer":
      return "须先有批断冻结。core_judgment + primary + backup；事实同向。表面专名可 defer 润色。人审：取舍成立、backup 不拧轴。";
    case "science_action":
      return "真·准·可执行·贴收集即可，不加厚。正文步只硬闸事实/门槛；读感+专名/引号/X%+目标语言留给润色（可跳过）。人审看真准价值。";
    case "metaphysics_action":
      return "means=易经时位决策**大白话**（择时差/场域位/进退；禁贴卦辞/起卦/半文言电报）；strategy/means须完整口语句且够写清。事实门槛硬闸。人审三问：①局势 ②意象 ③仪轨时方收势；删锚垮；不像P3；不像卦辞墙/四字电报。表面 defer 润色。";
    case "risk_guard":
      return "指回 P3/P4 的坑与防法；禁另起药方墙。表面专名可 defer 润色。人审：四桶分槽、能回溯上游。";
    case "signals_close":
      return "今晚一事+近7日+收束；禁四周甘特/第三份药方。表面专名可 defer 润色。人审：能指回上游。";
    default:
      return "白话可执行正文；批断只扎根。";
  }
}

function gateAccept(page: DeliverySegmentKey): string {
  if (page === "metaphysics_action") {
    return "人审三问（局势/意象/仪轨）+ 页角色对；不要求读感加厚。表面专名留给润色（或 Skip 时回退 full 闸）。不过 → 回改正文枪。";
  }
  if (page === "science_action") {
    return "人审真·准·可执行·定位（不要求读感加厚）。表面专名留给下一步润色清（可跳过）。不过 → 回改正文枪。";
  }
  return "人审：值钱？页角色对？因果成立？不要求读感加厚。表面类留给润色（可跳过；Skip 则 full 表面闸回退 body）。不过 → 回改内容步。";
}

function pageTriad(page: DeliverySegmentKey, short: string): LabV3StepDef[] {
  /** P1 also writes internal judgment (主辅真算根)；UI 仍不挂依据折层 → 无 evidence_soft. */
  const hangEvidenceSoft = page !== "direct_answer";
  const out: LabV3StepDef[] = [
    {
      step_key: `${page}.content.judgment`,
      label:
        page === "direct_answer"
          ? `${short} 内容① · 原始批断（主辅根）`
          : `${short} 内容① · 原始批断`,
      page,
      kind: "content_judgment",
      uses_llm: true,
      accept:
        page === "direct_answer"
          ? "3 条机制批断：core_judgment / primary / backup 真算根（八字用忌/岁运）。可含闭集真词；禁手段处方；禁奇门承重（知局归 P4）。已升闸类别机检；其余人审。UI 不挂依据折层。"
          : page === "foundation"
            ? "恰好 4 轴机制批断（用忌岁运/宫位/财官/食伤印比）。禁奇门轴；禁话语权·股权·兼职回写。已升闸类别机检；其余人审。"
            : "产出本页原始依据批断（可含闭集真词）。已升闸类别机检；其余质量靠提示词与人审。",
    },
    {
      step_key: `${page}.content.body`,
      label:
        page === "foundation"
          ? `${short} 内容① · 正文（译批断）`
          : page === "direct_answer"
            ? `${short} 内容① · 正文（直答·主辅）`
            : `${short} 内容① · 正文（可执行）`,
      page,
      kind: "content_body",
      uses_llm: true,
      accept: bodyAccept(page),
    },
    {
      step_key: `${page}.gate`,
      label: `${short} 闸门② · 验收（只判不改）`,
      page,
      kind: "gate",
      uses_llm: false,
      accept: gateAccept(page),
    },
    {
      step_key: `${page}.body_polish`,
      label: `${short} 润色 · 合规+目标语言`,
      page,
      kind: "body_polish",
      uses_llm: true,
      accept:
        "闸门人审通过后。合规加厚 + 清表面 + 出目标语言（zh/en/fr/es 一次一语；含中译中）。禁改事实与门槛；chart_anchors 代码盖回。可跳过（Skip 则对正文跑 full 表面闸）。单语通过即可进下一步。SSOT：分步职责 · 润色规格。",
    },
  ];
  if (hangEvidenceSoft) {
    out.push({
      step_key: `${page}.evidence_soft`,
      label: `${short} 依据③ · 合规软译`,
      page,
      kind: "evidence_soft",
      uses_llm: true,
      accept:
        "闸门通过且（润色通过或已 Skip）后。依据：违规真词→自造术语（金字）+ 目标语言大白话连接。不改正文。人审：折叠层可读、零裸专名。",
    });
  }
  return out;
}

/** Fixed unlock order for v3 labs. */
export const LAB_STEP_DEFS_V3: readonly LabV3StepDef[] = [
  {
    step_key: "bootstrap",
    label: "Bootstrap · 校验盘/问题",
    kind: "bootstrap",
    uses_llm: false,
    accept: "盘和问题能解析。",
  },
  {
    step_key: "thesis.gen",
    label: "Thesis · 命盘总纲",
    kind: "thesis",
    uses_llm: false,
    accept: "总纲维与 structured 对齐（本地真算）。",
  },
  {
    step_key: "prealloc",
    label: "Prealloc · 本盘可引用词",
    kind: "prealloc",
    uses_llm: false,
    accept: "本盘闭集词可引用。",
  },
  ...pageTriad("foundation", "P2"),
  ...pageTriad("direct_answer", "P1"),
  ...pageTriad("science_action", "P3"),
  ...pageTriad("metaphysics_action", "P4"),
  ...pageTriad("risk_guard", "P5"),
  ...pageTriad("signals_close", "P6"),
  {
    step_key: "book.assemble",
    label: "Assemble · 预览拼书",
    kind: "assemble",
    uses_llm: false,
    accept: "六页通读；依据折叠为批断（或已软译）。",
  },
  {
    step_key: "companion.seal",
    label: "Companion · 封版战略 Brief+流日包",
    kind: "companion_seal",
    uses_llm: false,
    accept:
      "从 P1(+P3) page_schema 抽主辅战略 Brief，本地建 30 日流日 pack。人审：主辅主张/边界齐全；means 仅存档不参与日更轮转。语言=站/Lab locale。",
  },
  {
    step_key: "companion.daily",
    label: "Companion · 双日提醒（选 N 出 N+N+1）",
    kind: "companion_daily",
    uses_llm: true,
    accept:
      "先 seal。选 day N + locale → 1枪同时出 N 与 N+1（末日仅 N）。Brief 优先同语润色稿。机闸（原则项）：绿红数字、「对齐+盖章」、前四段过薄、同枪 today_is 近复。人审：①贴题+P1 战略栏杆；②宏观非作业（禁布置/验收主张里具体动作）；③两日差分各吃；④中后段复盘栏杆非作业表；⑤evidence 合法。",
  },
  {
    step_key: "companion.batch_pair",
    label: "Companion · 后台填一对（1枪2天）",
    kind: "companion_batch_pair",
    uses_llm: true,
    accept:
      "先 seal。从下一未填日 1枪写 1–2 天（真 pair JSON，带邻日指纹）。可重复点直到 30/30。locale 同站语言或本步选择。人审抽看：跨日不复读、语言母语可读。",
  },
  {
    step_key: "companion.batch_gate",
    label: "Companion · 满窗整体闸",
    kind: "companion_batch_gate",
    uses_llm: false,
    accept:
      "须 30/30 有稿。机检：邻日 today_is 近复、evidence 工程量、前四段过薄。不过 → 回改生成侧再 batch_pair。过闸后生产才允许按日推送（推送后删日）。",
  },
] as const;

export function labV3StepDef(step_key: string): LabV3StepDef | undefined {
  return LAB_STEP_DEFS_V3.find((s) => s.step_key === step_key);
}

export function initLabStepsV3(): Record<
  string,
  { step_key: string; status: "idle"; attempts: [] }
> {
  const out: Record<string, { step_key: string; status: "idle"; attempts: [] }> = {};
  for (const d of LAB_STEP_DEFS_V3) {
    out[d.step_key] = { step_key: d.step_key, status: "idle", attempts: [] };
  }
  return out;
}

/** 旧 Lab 会话补齐新增步槽（如 companion.*）。 */
export function ensureLabStepsV3(lab: {
  steps: Record<
    string,
    { step_key: string; status: string; attempts: unknown[]; approved_attempt?: number }
  >;
}): void {
  for (const d of LAB_STEP_DEFS_V3) {
    if (!lab.steps[d.step_key]) {
      lab.steps[d.step_key] = {
        step_key: d.step_key,
        status: "idle",
        attempts: [],
      };
    }
  }
}
