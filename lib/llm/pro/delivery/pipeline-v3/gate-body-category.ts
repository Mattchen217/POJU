/**
 * Pipeline v3 · early Phase B category gates on body (visible fields).
 * Only验不改. P2 why_cards · P1 primary/backup · P3 toolkit 可见字段.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";

/** 可见层命理专名族（类别 · 含半白话十神合称与五行忌神半白话）。 */
const VISIBLE_JARGON_RE =
  /宫位|相冲|相害|相刑|冲刑害|半合|火局|大运|流年|流月|岁运|运岁|月令|时支|日支|奇门|死门|开门|休门|生门|伤门|杜门|景门|惊门|值符|值使|客生主|客来生主|客克主|主生客|主克客|阴遁|阳遁|用神|喜神|忌神|忌旺|食神|食伤|伤官|偏印|正印|印星|财星|七杀|比劫|比肩|正财|偏财|官杀|火土|水土|金水|木火|泄火土|[金木水火土]旺/;

const P2_ESSENCE_IMPERATIVE_RE =
  /你需要|应主动|应当|应该|宜守|宜退避|需要警惕|须注意|需要主动|需要外力|需要.*厘清|需要.*约定|需要.*挖掘/;

/** 时长/配额用中文或阿拉伯数字（类别匹配 · 非本案二字）。 */
const CN_DUR_NUM = "[一二两三四五六七八九十百\\d]+";

/**
 * 未在收集出现的时长/工时/截止点/节律/人数配额编造（类别）。
 * 含：前N月（不要求「为」）、明天内/明天开始、每半月、列出N位等。
 */
const INVENTED_SCHEDULE_RE = new RegExp(
  [
    `每周不超过\\s*\\d+`,
    `每周.{0,6}\\d+\\s*小时`,
    `前\\s*${CN_DUR_NUM}\\s*个?月`,
    `至少\\s*\\d+\\s*小时`,
    `冷静期`,
    `\\d+\\s*小时考虑`,
    `下个月中旬`,
    `${CN_DUR_NUM}\\s*天内`,
    `${CN_DUR_NUM}\\s*周内`,
    `两周内`,
    `三天内`,
    `连续\\s*${CN_DUR_NUM}\\s*个?月`,
    `明天内`,
    `明天开始`,
    `每半个?月`,
    `每\\s*${CN_DUR_NUM}\\s*周`,
    `每\\s*${CN_DUR_NUM}\\s*天`,
    `列出\\s*${CN_DUR_NUM}\\s*位`,
    // 缓冲/观察月数整类（P3/P4 共用 · 禁发明「三个月观察期」等）
    `(留出|给自己|设下?).{0,16}${CN_DUR_NUM}\\s*个?月`,
    `${CN_DUR_NUM}\\s*个?月的?(观察|缓冲|过渡|冷静)`,
    `${CN_DUR_NUM}\\s*个?月.{0,8}(观察|缓冲|过渡)`,
    `观察期.{0,12}${CN_DUR_NUM}\\s*个?月`,
  ].join("|"),
  "i",
);

/**
 * 未在收集出现的权益/合同条款数字（类别 · 成熟期·cliff·行权年数等）。
 * 换盘仍成立；禁只拦本案「四年/一年」。
 */
const CN_YEAR_NUM = "[一二两三四五六七八九十百\\d]+";
const INVENTED_CONTRACT_TERM_RE = new RegExp(
  `${CN_YEAR_NUM}\\s*年成熟|成熟期.{0,12}${CN_YEAR_NUM}\\s*年|${CN_YEAR_NUM}\\s*年\\s*cliff|一年\\s*cliff|四年成熟|\\bcliff\\b|行权期.{0,8}${CN_YEAR_NUM}\\s*年|vesting\\s*\\d+`,
  "i",
);

/** 收集已给的时长/节律同义才放过（半年↔六个月）。 */
function durationAllowedByReality(hit: string, reality: string): boolean {
  if (/半年|六个月/.test(hit) && /半年|六个月/.test(reality)) return true;
  if (/明天/.test(hit)) return /明天/.test(reality);
  if (/每半个?月/.test(hit)) return /每半个?月|半个月/.test(reality);
  const m = hit.match(new RegExp(`(${CN_DUR_NUM})\\s*(个?月|周|天|小时|位)`));
  if (m?.[1] && m[2]) {
    if (new RegExp(`${m[1]}\\s*${m[2]}`).test(reality)) return true;
    if (/月/.test(m[2]) && /^(六|6)$/.test(m[1]) && /半年/.test(reality)) {
      return true;
    }
  }
  if (/\d+\s*小时/.test(hit) && /\d+\s*小时/.test(reality)) return true;
  if (
    /试水/.test(hit) &&
    /试水.{0,8}\d+\s*个?月|\d+\s*个?月.{0,8}试水/.test(reality)
  ) {
    return true;
  }
  return false;
}

/** 合同条款数字是否已在收集出现（同义命中才放过）。 */
function contractTermAllowedByReality(hit: string, reality: string): boolean {
  const years = hit.match(
    new RegExp(`(${CN_YEAR_NUM})\\s*年`),
  );
  if (years?.[1] && new RegExp(`${years[1]}\\s*年`).test(reality)) return true;
  if (/cliff/i.test(hit) && /cliff/i.test(reality)) return true;
  if (/成熟/.test(hit) && /成熟/.test(reality) && years?.[1]) {
    return new RegExp(`${years[1]}\\s*年`).test(reality);
  }
  return false;
}
/** 股权比例字母占位（整类）。 */
const INVENTED_PERCENT_PLACEHOLDER_RE = /\bX\s*%|\bY\s*%|百分之\s*[XY]/

/** 已拒兼职仍当主轨默认路径（strategy/means/name 全文）。 */
const REJECTED_PART_TIME_AS_PRIMARY_RE =
  /兼职试水|以兼职方式|用兼职的?方式|兼职的方式|阶段性试水|非全职试水|先兼职|用兼职/;

/**
 * 已拒兼职后的「半投入换皮」（类别 · 禁）。
 * 真禁=仍想用项目制/半职深度参与本案换核心位，同时保留现职。
 * 不禁=辅轨按次/按小时顾问计费 + 保住现职（合法止损）。
 */
const HALF_INPUT_DISGUISE_RE =
  /项目制.{0,16}(保留|保住).{0,12}(现有|收入)|(保留|保住).{0,12}(现有|收入).{0,20}项目制|半投入|半职参与|保留现有收入来源.{0,24}(全情|深度|全力)|深度参与核心.{0,16}(保留|保住).{0,8}(现有|工作|收入)/;

/** 引号可照念台词（整类）。 */
/**
 * 可照念台词 / 引号分镜（类别）。
 * ≥4 字即拦（含心里默念/姿态标签）；短词举例应改写成无引号句。
 */
const QUOTED_SCRIPT_RE =
  /[「」][^「」]{2,64}[「」]|『[^』]{2,64}』|“[^”]{2,64}”|‘[^’]{2,64}’|"[^"]{2,64}"|'[^']{2,64}'|«[^»]{2,64}»/;

/** P4：可见层出现任一引号字符即废（含强调标签壳；duty=禁任何引号字符）。 */
const P4_ANY_QUOTE_CHAR_RE = /[「」『』“”‘’„‟«»"']/;

/** P4 站位/可见层 P3 交付物换皮 + 合伙权责词（整类）。 */
const P4_P3_DELIVERABLE_RE =
  /技术交付|交付成果|交付物|交付节点|谈判筹码|书面权益|权益条款|股权结构|股权落地|权益|话语权|合同模板|架构说明|技术方案|技术架构|技术实现|技术细节|技术难点|技术路径|技术小节点|技术验证|谈条件|找.{0,8}律师|项目节点|落地框架|落地问题/;

/**
 * P4 职场教练腔 / 壁垒换皮（整类 · 换壳同禁）。
 * 含「知识领地」≈知识壁垒；禁独立学习腔当站位主体。
 */
const P4_COACH_JARGON_RE =
  /信息壁垒|专业壁垒|不可替代性|知识壁垒|知识领地|深度研判|独立学习/;

/** P4 仪轨跨案养生模板（整类 · 禁照抄配方；不拦本案自生长的体态/结界/时方）。 */
const P4_RITUAL_BOILERPLATE_RE =
  /深呼吸|温凉饮一口|温凉饮|背靠实墙/;

/**
 * P4 液态水道具 / 物化补水当 means 主体（整类）。
 * 允许：方位落座、色气感官、冷热收势；禁水杯/凉水/盯水面/冷水洗脸/加湿器/喷泉当调候主体。
 */
const P4_MATERIALIZED_WATER_RE =
  /一杯凉水|凉水杯|桌面.{0,8}(凉水|水杯|水)|盯着水面|冷水洗|用冷水|凉水拍|加湿器|桌面喷泉|流水摆件|喷泉摆件/;

/**
 * P4 无引号开口稿 / 默念指引（整类）。
 * 禁「就说…」「告诉他…」「心里默念…」「提醒自己：…」引出可照念意图/心里稿。
 */
const P4_UNQUOTED_SCRIPT_RE =
  /就说.{2,48}|告诉他.{2,56}|心里默念|提醒自己[：:].{2,48}|告诉自己[：:].{2,48}/;

/**
 * 正文闸类别 → 润色枪禁区（SSOT · 与 gateBodyCategoryB 同尺）。
 * 写类别，禁点名本案原句。
 */
export function buildBodyGateAvoidanceBlockForPolish(
  key: DeliverySegmentKey,
): string {
  const common = [
    "## 机闸同尺 · 润色必须避开（类别 · 换盘仍成立）",
    "**换壳同禁**：禁区按类别；近义/半否定/拆字/换道具仍算犯。",
    "润色后仍会跑同一套正文闸；撞上任一类 = 本步失败且不覆盖已过闸稿。",
    "若草稿可见层仍撞下列类别 → 改成合规白话；真词只留 chart_anchors；禁改事实/门槛/动作指向。",
  ];
  if (key === "science_action") {
    return [
      ...common,
      "- `gate_p3_body_visible_jargon`：可见层禁十神/用忌/干支岁运/合冲刑害/神煞/宫位原名（含半白话「用神受制」「财星藏」「冲刑害」「印星」「大运+干支」等）。",
      "- `gate_p3_body_invented_schedule`：禁编造未在收集出现的时长/截止点/节律/人数配额；只保留收集已给量（如半年/六个月）。",
      "- `gate_p3_body_invented_contract_term`：禁编造未收集成熟期/cliff/行权年数；未收集 →「按书面约定的成熟与兑现节点」。",
      "- `gate_p3_body_rejected_path_as_primary`：已拒兼职——主轨禁试水；辅轨禁半投入换皮。",
      "- `gate_p3_body_invented_percent`：禁 X%/Y% 占位；未收集 →「按书面约定比例」。",
      "- `gate_p3_body_quoted_script`：禁引号可照念台词；改间接叙述。",
      "- `gate_*_polish_thin_synonym`：strategy 2–4 句且明显加长；means 1–2 句。同义换词=不及格。",
      "- 页角色锁：主语=协议/清单/里程碑；禁改成气场仪轨页。",
    ].join("\n");
  }
  if (key === "metaphysics_action") {
    return [
      ...common,
      "- `gate_p4_body_visible_jargon`：可见层禁十神/用忌/干支岁运/运岁/合冲/门星；禁两五行并写与「X旺」。",
      "- `gate_p4_body_quoted_script`：禁任何引号字符（含强调标签壳）与无引号开口/心里稿（就说/告诉他/心里默念/提醒自己：）。",
      "- `gate_p4_body_p3_deliverable`：禁技术方案/技术细节·路径/交付节点/项目节点/落地框架/权益/股权/话语权/律师等。",
      "- `gate_p4_body_coach_jargon`：禁信息·专业·知识壁垒/知识领地/独立学习/深度研判等职场教练腔换皮。",
      "- `gate_p4_body_ritual_boilerplate`：禁深呼吸/温凉饮/背靠实墙整类（不绑分钟）。",
      "- `gate_p4_body_materialized_water`：禁液态水道具/冷水洗脸当调候主体。",
      "- `gate_p4_body_rejected_path_as_primary`：已拒兼职禁试水路径。",
      "- `gate_p4_body_invented_schedule`：禁编造未收集的缓冲/观察月数；改气口未熟节奏差。",
      "- `gate_*_polish_thin_synonym`：strategy/means 须相对草稿加厚；同义换词=不及格。",
      "- 页角色锁：主语=局/气/时方/结界；禁译成 P3 合同腔或 HR 教练腔（各语言同禁）。",
    ].join("\n");
  }
  if (key === "direct_answer") {
    return [
      ...common,
      "- `gate_p1_body_visible_jargon`：含 leverage_chip/strategic_goal 零命理专名。",
      "- 禁改主辅取舍与 when 事实方向；禁发明缓冲月数。",
      "- 草稿 core_logic 已四段成篇则保量；仅电报体才补句。",
    ].join("\n");
  }
  if (key === "foundation") {
    return [
      ...common,
      "- `gate_p2_body_visible_jargon`：surface/essence 零专名。",
      "- `gate_p2_body_essence_imperative`：essence 禁怎么办/祈使收束（换壳仍禁）。",
      "- `gate_p2_body_quoted_script`：surface/essence/title 禁引号分镜与强调壳；短词举例也改无引号间接叙述。",
      "- 草稿已完整机制段则保量，禁灌水；仅半句/目录壳才补句。禁把 essence 写成处方。",
    ].join("\n");
  }
  if (key === "risk_guard") {
    return [
      ...common,
      "- 可见层零命理专名；真词只留 anchors。",
      "- 禁另起无关新手段墙；禁恐吓预测；须指回上游 P3/P4 动作。",
      "- 短而具体的完整句即可；草稿已完整则保量。",
    ].join("\n");
  }
  if (key === "signals_close") {
    return [
      ...common,
      "- 可见层零命理专名。",
      "- 禁四周甘特/第三份完整药方；信号须能指回上游。",
      "- 完整可读短句即可；草稿已完整则保量。",
    ].join("\n");
  }
  return [
    ...common,
    "- 可见层零命理专名报幕；真词只留 chart_anchors。",
  ].join("\n");
}
function p4VisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    dimensions?: Array<{
      name?: string;
      strategy?: string;
      means?: string[];
    }>;
  };
  return [
    p.page_title,
    p.page_subtitle,
    ...(p.dimensions ?? []).flatMap((d) => [
      d.name,
      d.strategy,
      ...(d.means ?? []),
    ]),
  ]
    .map((x) => String(x ?? ""))
    .join("\n");
}

function p1VisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    core_judgment?: string;
    primary?: Record<string, unknown>;
    backup?: Record<string, unknown>;
  };
  const track = (t: Record<string, unknown> | undefined) =>
    [
      t?.name,
      t?.core_logic,
      t?.why,
      t?.when,
      t?.strategic_goal,
      t?.leverage_chip,
    ]
      .map((x) => String(x ?? ""))
      .join("\n");
  return [
    p.page_title,
    p.page_subtitle,
    p.core_judgment,
    track(p.primary as Record<string, unknown> | undefined),
    track(p.backup as Record<string, unknown> | undefined),
  ].join("\n");
}

function p3VisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    primary_toolkit?: {
      title?: string;
      angles?: Array<{
        name?: string;
        strategy?: string;
        means?: string[];
      }>;
    };
    backup_toolkit?: {
      title?: string;
      angles?: Array<{
        name?: string;
        strategy?: string;
        means?: string[];
      }>;
    };
  };
  const angles = (kit?: {
    title?: string;
    angles?: Array<{ name?: string; strategy?: string; means?: string[] }>;
  }) =>
    [
      kit?.title,
      ...(kit?.angles ?? []).flatMap((a) => [
        a.name,
        a.strategy,
        ...(a.means ?? []),
      ]),
    ]
      .map((x) => String(x ?? ""))
      .join("\n");
  return [
    p.page_title,
    p.page_subtitle,
    angles(p.primary_toolkit),
    angles(p.backup_toolkit),
  ].join("\n");
}

function p3PrimaryVisibleBlob(page: DeliveryPageData): string {
  const p = page as {
    page_title?: string;
    page_subtitle?: string;
    primary_toolkit?: {
      title?: string;
      angles?: Array<{
        name?: string;
        strategy?: string;
        means?: string[];
      }>;
    };
  };
  const angles = (p.primary_toolkit?.angles ?? []).flatMap((a) => [
    a.name,
    a.strategy,
    ...(a.means ?? []),
  ]);
  return [
    p.page_title,
    p.page_subtitle,
    p.primary_toolkit?.title,
    ...angles,
  ]
    .map((x) => String(x ?? ""))
    .join("\n");
}

export function gateBodyCategoryB(input: {
  key: DeliverySegmentKey;
  page_schema?: DeliveryPageData | null;
  /** 收集/现实约束原文，供已拒门槛与数字闭集对齐。 */
  reality_blob?: string | null;
  /**
   * full = 全部类别（润色后硬闸）。
   * substance_only = 只验事实/门槛类；专名/引号/X% 等表面类留给 body_polish。
   */
  surface?: "full" | "substance_only";
}): ContentGateVerdict | null {
  if (!input.page_schema) return null;

  const surface = input.surface ?? "full";
  const notes: string[] = [
    "gate_phase:b_early_body",
    "ruler:category_no_mutate",
    `surface:${surface}`,
  ];
  const reality = String(input.reality_blob ?? "");

  if (input.key === "direct_answer") {
    if (surface === "substance_only") return null;
    const visible = p1VisibleBlob(input.page_schema);
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p1_body_visible_jargon",
        detail:
          "P1 可见字段（含 leverage_chip/strategic_goal）含命理专名报幕。真词只留 chart_anchors；回改正文提示后重跑——闸门不改稿。",
        notes,
      };
    }
    return null;
  }

  if (input.key === "science_action") {
    const visible = p3VisibleBlob(input.page_schema);
    // —— 事实/门槛（正文步也硬拦；非抽奖表面）——
    if (INVENTED_SCHEDULE_RE.test(visible)) {
      const hit = visible.match(INVENTED_SCHEDULE_RE)?.[0] ?? "";
      if (!durationAllowedByReality(hit, reality)) {
        return {
          passed: false,
          failed_rule: "gate_p3_body_invented_schedule",
          detail:
            "P3 正文编造未在收集出现的时长/截止点/节律/人数配额（前N月、两周内、三天内、连续N月、明天内/明天开始、每半月、列出N位、冷静期等）。只许用收集已给量（如半年）；回改 duty/菜单后重跑——闸门不改稿。",
          notes: [...notes, `hit:${hit.slice(0, 24)}`],
        };
      }
    }
    if (INVENTED_CONTRACT_TERM_RE.test(visible)) {
      const hit = visible.match(INVENTED_CONTRACT_TERM_RE)?.[0] ?? "";
      if (!contractTermAllowedByReality(hit, reality)) {
        return {
          passed: false,
          failed_rule: "gate_p3_body_invented_contract_term",
          detail:
            "P3 正文编造未在收集出现的权益条款数字（成熟期N年、cliff、行权年数等）。未收集则写「按书面约定的成熟与兑现节点」；回改 duty 后重跑——闸门不改稿。",
          notes: [...notes, `hit:${hit.slice(0, 32)}`],
        };
      }
    }
    const partTimeRejected =
      /拒绝.{0,12}兼职|必须全职|不同意兼职|不接受兼职|兼职.{0,8}拒绝/.test(
        reality,
      );
    if (partTimeRejected) {
      const primary = p3PrimaryVisibleBlob(input.page_schema);
      if (REJECTED_PART_TIME_AS_PRIMARY_RE.test(primary)) {
        return {
          passed: false,
          failed_rule: "gate_p3_body_rejected_path_as_primary",
          detail:
            "收集已表明对方拒绝兼职/要求全职，正文仍把「兼职试水」当主轨默认路径。须改写为全职门槛下的护底线/显性贡献/书面权益或切辅；回改 duty/菜单后重跑。",
          notes,
        };
      }
      if (HALF_INPUT_DISGUISE_RE.test(visible)) {
        return {
          passed: false,
          failed_rule: "gate_p3_body_rejected_path_as_primary",
          detail:
            "收集已拒兼职/必须全职，正文仍用「项目制/半职深度参与+保留现职」换皮半投入。辅轨只许婉拒、按次/按小时顾问计费（可保住现职）、或另寻——禁把顾问写成未计费半职核心参与；回改后重跑。",
          notes,
        };
      }
    }
    // —— 表面读感（有润色步时 defer 到 polish 后 full）——
    if (surface === "substance_only") {
      return null;
    }
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p3_body_visible_jargon",
        detail:
          "P3 可见字段（title/strategy/means）含命理专名报幕。真词只留 chart_anchors；回改正文提示后重跑。",
        notes,
      };
    }
    if (INVENTED_PERCENT_PLACEHOLDER_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p3_body_invented_percent",
        detail:
          "P3 正文出现 X%/Y% 等未在收集出现的比例占位。只许用收集已给量或「按书面约定比例」；回改 duty 后重跑——闸门不改稿。",
        notes,
      };
    }
    if (QUOTED_SCRIPT_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p3_body_quoted_script",
        detail:
          "P3 正文含引号可照念台词。改间接叙述（边界/动作）后重跑——闸门不改稿。",
        notes,
      };
    }
    return null;
  }

  if (input.key === "metaphysics_action") {
    const visible = p4VisibleBlob(input.page_schema);
    // —— 事实/门槛（正文步也硬拦）——
    const partTimeRejected =
      /拒绝.{0,12}兼职|必须全职|不同意兼职|不接受兼职|兼职.{0,8}拒绝/.test(
        reality,
      );
    if (
      partTimeRejected &&
      REJECTED_PART_TIME_AS_PRIMARY_RE.test(visible)
    ) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_rejected_path_as_primary",
        detail:
          "收集已表明对方拒绝兼职/要求全职，P4 仍把「兼职试水」写进 means。须改写为硬门槛下的藏隐观气口/结界护底线；回改 duty 后重跑。",
        notes,
      };
    }
    if (INVENTED_SCHEDULE_RE.test(visible)) {
      const hit = visible.match(INVENTED_SCHEDULE_RE)?.[0] ?? "";
      if (!durationAllowedByReality(hit, reality)) {
        return {
          passed: false,
          failed_rule: "gate_p4_body_invented_schedule",
          detail:
            "P4 正文编造未在收集出现的缓冲/观察月数或截止节律（留出N月、N月观察期等）。只许用收集已给量（如半年）或改写为气口未熟/近窗未开的节奏差；回改 duty 后重跑——闸门不改稿。",
          notes: [...notes, `hit:${hit.slice(0, 24)}`],
        };
      }
    }
    /**
     * 开口稿 / 权责词 / 养生正例 / 物化水：已升类别且反复中 → 正文步硬拦。
     * 专名/两五行等表面仍 defer 润色。
     */
    if (QUOTED_SCRIPT_RE.test(visible) || P4_ANY_QUOTE_CHAR_RE.test(visible) || P4_UNQUOTED_SCRIPT_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_quoted_script",
        detail:
          "P4 正文含引号字符（含强调标签壳）或可照念台词/心里稿（就说/告诉他/心里默念/提醒自己：…）。改间接叙述（慢半拍/拖到气口再回；标签词勿包引号）后重跑——闸门不改稿。",
        notes,
      };
    }
    if (P4_P3_DELIVERABLE_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_p3_deliverable",
        detail:
          "P4 可见层出现交付物/权益/股权/话语权/律师/技术细节·路径/项目节点等 P3·权责词族（尤忌站位维）。改写为结界/藏隐/气口后重跑。",
        notes,
      };
    }
    if (P4_COACH_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_coach_jargon",
        detail:
          "P4 可见层出现职场教练腔/壁垒换皮（信息·专业·知识壁垒/知识领地/独立学习/深度研判）。改写为结界藏隐/侧翼收势白话后重跑——闸门不改稿。",
        notes,
      };
    }
    if (P4_RITUAL_BOILERPLATE_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_ritual_boilerplate",
        detail:
          "P4 仪轨含跨案三联养生模板（深呼吸/温凉饮/背靠实墙整类，不绑分钟）。改成本案时方窗·气场调候·结界仪轨后重跑——闸门不改稿；不禁自生长体态。",
        notes,
      };
    }
    if (P4_MATERIALIZED_WATER_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_materialized_water",
        detail:
          "P4 means 用液态水道具（桌面水杯/凉水/盯水面/加湿器/喷泉）当调候主体。改方位落座/色气感官/冷热收势后重跑——闸门不改稿。",
        notes,
      };
    }
    // —— 表面读感（有润色步时 defer）：专名报幕等 ——
    if (surface === "substance_only") {
      return null;
    }
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p4_body_visible_jargon",
        detail:
          "P4 可见字段（name/strategy/means）含命理专名报幕。真词只留 chart_anchors；回改正文提示后重跑。",
        notes,
      };
    }
    return null;
  }

  if (input.key !== "foundation") return null;

  if (surface === "substance_only") {
    // 怎么办收束属页角色硬伤，正文步仍拦；专名表面 defer 润色
    const page = input.page_schema as {
      why_cards?: Array<{ essence?: string }>;
    };
    const cards = page.why_cards;
    if (!Array.isArray(cards) || cards.length === 0) return null;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!;
      if (P2_ESSENCE_IMPERATIVE_RE.test(String(c.essence ?? ""))) {
        return {
          passed: false,
          failed_rule: "gate_p2_body_essence_imperative",
          detail: `P2 why_cards[${i}].essence 含怎么办/祈使收束。只解释为何卡；回改正文提示后重跑——闸门不改稿。`,
          notes: [...notes, `card:${i}`],
        };
      }
    }
    return null;
  }

  const page = input.page_schema as {
    why_cards?: Array<{
      title?: string;
      surface?: string;
      essence?: string;
    }>;
  };
  const cards = page.why_cards;
  if (!Array.isArray(cards) || cards.length === 0) return null;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]!;
    const visible = `${c.title ?? ""}\n${c.surface ?? ""}\n${c.essence ?? ""}`;
    if (VISIBLE_JARGON_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p2_body_visible_jargon",
        detail: `P2 why_cards[${i}] 可见层含命理专名报幕。回改正文提示后重跑——闸门不改稿。`,
        notes: [...notes, `card:${i}`],
      };
    }
    if (P2_ESSENCE_IMPERATIVE_RE.test(String(c.essence ?? ""))) {
      return {
        passed: false,
        failed_rule: "gate_p2_body_essence_imperative",
        detail: `P2 why_cards[${i}].essence 含怎么办/半祈使（需要…/应…）。只解释为何卡，停在结构张力后重跑。`,
        notes: [...notes, `card:${i}`],
      };
    }
    if (QUOTED_SCRIPT_RE.test(visible)) {
      return {
        passed: false,
        failed_rule: "gate_p2_body_quoted_script",
        detail: `P2 why_cards[${i}] 可见层含引号分镜或强调壳。短词举例也改成无引号间接叙述后重跑——闸门不改稿。`,
        notes: [...notes, `card:${i}`],
      };
    }
  }

  return null;
}
