/**
 * Pipeline v3 · Step1-A raw judgment — greenfield generator.
 * No assign LLM, no deep-evidence-quality gates. JSON parse + coerce only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { pageEvidenceUnitBounds } from "@/lib/llm/pro/delivery/page-schema/evidence-unit-soft-cap";
import { SCIENCE_ASSIGN_PATHS } from "@/lib/llm/pro/delivery/science-means-feed";
import { scrubJudgmentPrescriptionClosers } from "@/lib/llm/pro/delivery/page-schema/assign-binding-seed";
import {
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import { scrubJudgmentFeedPrescriptions } from "@/lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed";

/**
 * 禁区 = 类别边界（非正例范文）。换盘后仍成立。
 * 合格自检见 pageDutyBlock。
 */
const JUDGMENT_SYSTEM = `你是交付报告「原始依据批断」写手（Pipeline v3 · 内容步①批断枪）。
只输出 JSON，不要 markdown。

## 主心骨
user 里本页 duty 含 **角色 · 目标 · 禁忌 · 数据来源 · 硬约束**。以【本页目标】为北星：只写「为何对此人/此局成立」的结构机制，不写怎么办。

## 职责（只写「为什么对此人成立」）
- unit_claim / evidence = 本盘/本局结构机制链：十神·用忌·合冲刑害·岁运姿态·宫位压力等真算因果（**奇门门宫仅 P4 页**）。
- 可含闭集结构真词（干支/十神/用神等；P4 另可含宫门）。
- calc_cite 必须能指回 user 喂料里的总纲/Fact-pack（及本页授权的锁盘/菜单）；禁无出处现编结构。

## 禁区硬表（命中任一条 = 废稿，重写该条）
1. **手段/处方进批断（整类）**：投入形态/节奏处方（试探深浅、加码减码、跳步全投、暂守观望等——词随本案议题变，勿写成生活路径）、契约制度执行、谈判话术、岗位角色重构指令、清单式「该做A做B」。
2. **攻守祈使收束（整类 · 尤忌句末）**：以「宜…」「更符合…」「以静制动」「守势探路」等收束 claim/evidence。批断只写到结构张力（承压偏高/显性不足/制衡位弱/窗口收窄），**禁止**给攻守指令。
3. **仪轨/意象调候/露锋处方（整类 · P4 尤忌）**：静润降温、延迟回应、露锋（含不急于）、此为…仪轨、待某气旺再加码——留给正文仪轨柱。
4. **处境/议题尾巴（整类 · P4 尤忌）**：把本案生活议题词（名分、权益、对方态度、投入门槛、贡献如何被看见等——以问题为准）写成机制主语或句末尾巴——主张写到用忌·岁运（及 **P4** 门宫主客）张力为止。
5. **身心/场域动作正例**：冥想、深呼吸配方等——禁止出现在 claim/evidence。
6. **恐吓式预测/结果承诺**：必损、必成、吉凶时点。
7. **科学执行词族**：合同模板、顾问/法务步骤、比例表、表格看板工具——批断禁止。
8. **⟦w:⟧ / ⟦t:⟧** 禁止。
9. **同轴复读**：两条 unit 不得共用同一主结构轴。

## 允许的「节奏」说法（机制，非处方）
- 可写：岁运对用神冲突 → 冒进承压偏高；用弱忌旺 → 资源获取条件偏苛。
- **仅 P4（本页喂了锁盘时）**：值使死门当值或值符落死门宫 → 场域虚高/气口易被压；客生主+死门落宫 → 可借亦可缠（**停在这里**）。「当值」只可指值使门。
- 不可写：因此静润降温 / 因此延迟回应 / 因此投入形态处方或露锋 / 因此用「宜守/仪轨」收束。

质量靠「本页目标 + 真算喂料 + 禁忌」一次写合格——不要自我审查成空壳，也不要为「显得可执行」而塞手段。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1 批断）`,
        `【本页角色】主辅真算根写手——只写结构取舍根（松紧/承压/切辅窗口），不写生活路径处方。`,
        `【本页目标】为正文双轨提供可推的机制根：此刻忌什么冒进、主轨结构为何成立、辅轨何时结构上可切；议题随本案问题，不预设题材。`,
        `【本页禁忌】`,
        `  · **投入形态/生活路径词进 claim/evidence（整类 · 硬）**：禁当主张主语或收束（试探深浅、跳步全投、分期投入、守住现职/现有稳定收入、对方态度/名分/话语权/股权/权责等——词随本案变）；claim 主语须是用忌/岁运/食伤财官张力`,
        `  · 攻守「宜…/更符合…」收束；「可避免/需避免/需待」类半祈使收束；律师合同/冥想；必损必成；means_candidate_ref`,
        `  · 现编未出现在闭集/总纲的干支岁运清单；**禁奇门门宫承重**（知局归 P4；本页不喂锁盘，勿自编门象）`,
        `【数据来源】总纲 + Fact-pack（八字/用忌/岁运/合冲）；**不灌 collecting 原文、不灌奇门锁盘、不灌 P3/P4 菜单**；议题方向只看 core_conclusion；calc_cite 须指回总纲/Fact-pack。`,
        `【硬约束】`,
        `- 恰好 3 条：path=core_judgment / primary / backup；可含闭集真词；本页 UI 不挂依据折层。`,
        `- **收束停在张力词**：承压偏高 / 冒进耗损偏重 / 窗口收窄 / 补给条件偏苛 / 切辅窗口未开——**禁**「…为结构匹配 / 更合结构 / 可保…」类收束（半祈使+匹配判定）。`,
        `- **用忌精度**：对齐 yong_stance——大运扶用神时 **claim/evidence/calc_cite 均禁**「用神弱/用神水弱/用神绝对弱」，只写「岁运冲突下用神承压/窗口收窄」。`,
        `- core_judgment：整案松紧取舍的结构主张（忌冒进为何成立）——八字岁运轴，不写门宫。`,
        `- primary：主轨为何对本盘成立——只写机制（食伤/财藏/用忌承压/官杀藏→**制衡位或约束位不显**）；claim/evidence 写到「制衡位/约束位不显」即停——**禁**再译「话语权/名分/权责/权责框架」；**禁**点名现职收入/投入形态；**禁**「守补给/避冒进为结构匹配」类收束。`,
        `- backup：切辅的**结构信号**（岁运冲突缓解、用神得扶更稳、切辅窗口未开/近窗）——停在信号词，**禁**「需待/须待…方…」半祈使；禁闭集外干支菜单，禁未来奇门门象现编。`,
        `- chart_anchors 每条 ≥1；三条主轴勿完全同骨架（backup 勿整段复读 core 的岁运句）。`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2 批断）`,
        `【本页角色】归因机制写手——从**本盘八字结构+岁运**推出「本题为何卡」，禁止从处境倒推圆盘。`,
        `【本页目标】产出互异主轴的结构主张链，供正文译成白话归因；读完应能支撑「本题为何卡在这里」（议题随本案问题变，不预设题材）。`,
        `【本页禁忌】`,
        `  · 生活门槛/处境词进 claim/evidence（整类 · 硬）：投入形态（全力投入/贸然跳入/试水等）、契约条款、谈判执行、**话语权/名分/股权/兼职/全职/稳定收入/权责**——喂料里出现也不许回写`,
        `  · 攻守「宜…」收束；手段处方；同轴复读；**奇门门宫作归因主轴**（知局归 P4）`,
        `  · 禁把日支/配偶宫写成「契约宫」等法律议题半白话`,
        `【数据来源】总纲 + Fact-pack（八字/岁运/合冲）+ 处境材料仅对照议题方向；**不喂奇门锁盘**；禁把处境原句粘进 claim/evidence。`,
        `【硬约束】`,
        `- 恰好 4 条；path=dimensions[0..3]；主轴钉死且互异：①用忌/岁运 ②宫位冲害 ③财官显隐 ④食伤/印比。`,
        `- unit_claim=结构张力一句；evidence≥2 句停在张力词（承压偏高/显性不足/制衡位弱/窗口收窄/链路隐伏）——**禁**「若贸然…投入」类条件投入句。`,
        `- **财官轴改写（硬）**：财藏/官杀藏 → 只写「资源链路隐伏 / 制衡位或约束位不显」；**claim/evidence/calc_cite 均禁**再译成话语权/名分/股权/权责。`,
        `- 用忌精度对齐 yong_stance（大运扶用时禁「用神弱」，写岁运冲突下承压）；chart_anchors≥1 且贴本轴；不要 means_candidate_ref。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3 批断）`,
        `【本页角色】科学执行的结构根写手——证明后文动作「为何必须针对此人」，不是策略本身。`,
        `【本页目标】六维互异结构根，锚定主辅各三角；停在张力词，不写投入形态/节奏处方收束。`,
        `【本页禁忌】宜…收束；投入形态处方；法务商务步骤进 claim；复读 P1 生活结论当六维。`,
        `【数据来源】总纲 + Fact-pack + **科学手段菜单**；means_candidate_ref 跟派工表且六条不重复；**不灌奇门/moat**。`,
        `【硬约束】恰好 6 条；path=primary_toolkit.angles[0..2]+backup_toolkit.angles[0..2]；六维轴各异；chart_anchors≥1。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `## 本页 duty · metaphysics_action（P4 批断）`,
        `【本页角色】奇门+八字双核结构根写手——写局/气/气口张力，不写协议与仪轨处方。`,
        `【本页目标】证明后文暗锦囊「为何只对此局此人成立」；三柱 moat_class 覆盖 timing|polarity|archetype。`,
        `【本页禁忌】仪轨/露锋处方；处境议题尾巴（名分/权益/对方态度等作机制主语）；P3 工具词作主张收束；**奇门「当值」错标**（当值=值使门；值符落死门写落宫/承符）。`,
        `【数据来源】总纲 + Fact-pack + **奇门锁盘连续原文**（本页双核必灌）；means_candidate_ref 跟约束帧且不重复；**不灌 P3 科学菜单**。`,
        `【硬约束】path=dimensions[i]；收束停在气口易被压/场域虚高/用弱忌旺/窗口收窄等；chart_anchors≥1；死门仅在值使=死门或值符落死门宫时承重。`,
      ].join("\n");
    case "risk_guard":
      return [
        `## 本页 duty · risk_guard（P5 批断）`,
        `【本页角色】翻车结构根写手。`,
        `【本页目标】写清哪条结构易翻车，供护栏正文指回。`,
        `【本页禁忌】防法步骤表；恐吓预测。`,
        `【数据来源】总纲/Fact-pack + 上游主辅结构。`,
        `【硬约束】纯机制；禁手段清单。`,
      ].join("\n");
    case "signals_close":
      return [
        `## 本页 duty · signals_close（P6 批断）`,
        `【本页角色】近窗结构根写手。`,
        `【本页目标】写近窗承压/可借力的结构根因，供收束页摘用。`,
        `【本页禁忌】日程甘特；具体执行清单。`,
        `【数据来源】总纲/Fact-pack + 上游已锁结构。`,
        `【硬约束】纯机制；禁手段。`,
      ].join("\n");
    default:
      return `## 本页 duty · ${key}\n【本页目标】纯机制批断。\n【本页禁忌】手段与预测承诺。`;
  }
}

export type ContentJudgmentOk = {
  ok: true;
  plan: DeepEvidencePlan;
  tokens_used: number;
  last_raw_text?: string;
  call_trace: LabCallTrace;
};

export type ContentJudgmentFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  last_raw_text?: string;
  call_trace?: LabCallTrace;
};

function coercePlan(
  key: DeliverySegmentKey,
  raw: unknown,
): DeepEvidencePlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const unitsRaw = Array.isArray(o.units) ? o.units : [];
  const bounds = pageEvidenceUnitBounds(key);
  const units = unitsRaw
    .map((u, i) => {
      if (!u || typeof u !== "object") return null;
      const row = u as Record<string, unknown>;
      const path = String(row.path ?? `dimensions[${i}]`).trim();
      const evidence = String(
        row.evidence ?? row.professional_evidence ?? "",
      ).trim();
      const unit_claim = String(row.unit_claim ?? row.claim ?? "").trim();
      const calc_cite = String(row.calc_cite ?? row.cite ?? "").trim();
      const moat = row.moat_class;
      const moat_class =
        moat === "timing" || moat === "polarity" || moat === "archetype"
          ? moat
          : undefined;
      if (!evidence && !unit_claim) return null;
      const meansRaw = String(row.means_candidate_ref ?? "").trim();
      // P1/P2：忽略手段标签，避免喂下游「处方」联想。
      const means_candidate_ref =
        key === "foundation" || key === "direct_answer" || !meansRaw
          ? undefined
          : meansRaw;
      // P3+：软裁攻守祈使/投入节奏收束（类别）；P1 批断允许宜守，不经此裁。
      const scrubClosers = key !== "direct_answer" && key !== "foundation";
      const claimOut = scrubClosers
        ? scrubJudgmentPrescriptionClosers(unit_claim || evidence.slice(0, 80))
        : unit_claim || evidence.slice(0, 80);
      const evidenceOut = scrubClosers
        ? scrubJudgmentPrescriptionClosers(evidence || unit_claim)
        : evidence || unit_claim;
      if (!claimOut && !evidenceOut) return null;
      return {
        path,
        evidence: evidenceOut || claimOut,
        unit_claim: claimOut || evidenceOut.slice(0, 80),
        calc_cite,
        chart_anchors: Array.isArray(row.chart_anchors)
          ? row.chart_anchors.map((a) => String(a)).filter(Boolean)
          : [],
        means_candidate_ref,
        moat_class,
      };
    })
    .filter(Boolean) as DeepEvidencePlan["units"];
  // P3：path 钉死主辅 angles；若模型误用 dimensions[i]，按序 remap（不改内容）。
  if (key === "science_action") {
    const remapped = units.slice(0, SCIENCE_ASSIGN_PATHS.length).map((u, i) => ({
      ...u,
      path: SCIENCE_ASSIGN_PATHS[i]!,
    }));
    if (remapped.length < Math.max(1, bounds.min)) return null;
    return { page: key, units: remapped };
  }
  const minUnits = Math.max(1, bounds.min);
  if (units.length < minUnits) return null;
  if (key === "direct_answer") {
    const paths = new Set(units.map((u) => u.path));
    if (
      !paths.has("core_judgment") ||
      !paths.has("primary") ||
      !paths.has("backup")
    ) {
      return null;
    }
  }
  return { page: key, units };
}

function jsonShapeHint(key: DeliverySegmentKey): string {
  if (key === "direct_answer") {
    return [
      `## 输出 JSON 形状（P1：恰好 3 条）`,
      `{`,
      `  "page": "direct_answer",`,
      `  "units": [`,
      `    {`,
      `      "path": "core_judgment",`,
      `      "unit_claim": "整案松紧结构主张（停在承压/窗口；禁生活路径词作主语）",`,
      `      "calc_cite": "总纲/Fact-pack 短摘",`,
      `      "evidence": "≥2句机制链·停在张力词",`,
      `      "chart_anchors": ["闭集短标签≥1"]`,
      `    },`,
      `    {`,
      `      "path": "primary",`,
      `      "unit_claim": "主轨结构为何成立（机制·禁点名投入形态）",`,
      `      "calc_cite": "...",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": ["…"]`,
      `    },`,
      `    {`,
      `      "path": "backup",`,
      `      "unit_claim": "切辅的结构信号（禁闭集外干支菜单）",`,
      `      "calc_cite": "...",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": ["…"]`,
      `    }`,
      `  ]`,
      `}`,
    ].join("\n");
  }
  if (key === "science_action") {
    const unitLines = SCIENCE_ASSIGN_PATHS.map((p, i) =>
      [
        `    {`,
        `      "path": "${p}",`,
        `      "unit_claim": "结构轴${i + 1}主张一句（禁祈使/禁投入节奏处方）",`,
        `      "calc_cite": "事实档短摘录",`,
        `      "evidence": "≥2句纯机制链",`,
        `      "chart_anchors": [],`,
        `      "means_candidate_ref": "派工表唯一 ref"`,
        `    }${i < SCIENCE_ASSIGN_PATHS.length - 1 ? "," : ""}`,
      ].join("\n"),
    ).join("\n");
    return [
      `## 输出 JSON 形状（P3：恰好 6 条 · path 钉死）`,
      `{`,
      `  "page": "science_action",`,
      `  "units": [`,
      unitLines,
      `  ]`,
      `}`,
    ].join("\n");
  }
  const moatLine =
    key === "metaphysics_action"
      ? `      "moat_class": "timing|polarity|archetype（有则填）",`
      : "";
  const meansLine =
    key === "foundation"
      ? ""
      : `      "means_candidate_ref": "可选：回溯菜单的短结构标签（非生活处方）",`;
  const anchorHint =
    key === "foundation"
      ? `      "chart_anchors": ["闭集短标签≥1·须贴本条主轴"],`
      : `      "chart_anchors": [],`;
  const claimHint =
    key === "foundation"
      ? `      "unit_claim": "结构张力一句（主语=用忌/岁运/宫位/十神显隐；禁话语权·股权·兼职等处境词；官杀藏→制衡位不显）",`
      : `      "unit_claim": "本盘结构主张一句（禁祈使/禁手段）",`;
  const evidenceHint =
    key === "foundation"
      ? `      "evidence": "≥2句机制链·停在承压/隐伏/制衡位弱（删光话语权·股权·兼职后机制须仍完整）",`
      : `      "evidence": "≥2句纯机制链（禁处方、禁冥想调候、禁必损必成）",`;
  return [
    `## 输出 JSON 形状`,
    `{`,
    `  "page": "${key}",`,
    `  "units": [`,
    `    {`,
    `      "path": "dimensions[0]",`,
    claimHint,
    `      "calc_cite": "事实档短摘录（须能对上喂料）",`,
    evidenceHint,
    anchorHint,
    moatLine,
    meansLine,
    `    }`,
    `  ]`,
    `}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function runContentJudgmentGenerate(input: {
  key: DeliverySegmentKey;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  /** Assembled fact / thesis / moat feeds (caller builds). */
  user_feed: string;
  core_conclusion?: string;
}): Promise<ContentJudgmentOk | ContentJudgmentFail> {
  const bounds = pageEvidenceUnitBounds(input.key);
  const scrubbedFeed = scrubJudgmentFeedPrescriptions(input.user_feed);
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    pageDutyBlock(input.key),
    input.core_conclusion?.trim()
      ? `## core_conclusion\n${input.core_conclusion.trim()}`
      : "",
    scrubbedFeed,
    jsonShapeHint(input.key),
    `units 条数建议 ${bounds.min}–${bounds.max}` +
      (input.key === "direct_answer"
        ? `；path 钉死 core_judgment / primary / backup。`
        : input.key === "science_action"
          ? `；path 钉死 primary_toolkit/backup_toolkit.angles[0..2]。`
          : input.key === "foundation"
            ? `；恰好 4 条；path 钉死 dimensions[0..3]；禁奇门轴。`
            : `；path 用 dimensions[i]（或 angles[i]/why_cards[i] 若页习惯如此）。`),
    `落笔前自检：删光「需/应/先去/签/谈/冥想/必然」类词后，机制链是否仍成立？不成立=重写。`,
    input.key === "direct_answer"
      ? `P1 额外自检：①三条 path 钉死？②claim/evidence 删光投入形态/现职收入/名分/话语权/权责后机制是否仍完整（残留=废稿）？③有无「用神弱」字面（大运扶用时应写承压）或「结构匹配/需待」收束？④有无攻守宜X或「可避免/需缓释/可保」半祈使？⑤有无奇门门宫承重或闭集外干支？⑥三条是否同骨架复读？⑦chart_anchors 是否每条≥1？任一条否=整页重写。`
      : "",
    input.key === "foundation"
      ? `P2 额外自检：①恰好4轴且无奇门？②无两段岁运耗用神复读？③用忌对齐 yong_stance？④chart_anchors≥1贴轴？⑤搜「话语权|权责|股权|兼职|全力投入|契约宫」→须为零？⑥无攻守祈使/若贸然投入？任一条否=整页重写。`
      : "",
    input.key === "science_action"
      ? `P3 额外自检：①六 path 钉死？②六 claim 主轴互异？③有无投入形态处方/宜X/更符合收束？④有无半截「此时若」？⑤chart_anchors 是否每条≥1？⑥calc_cite 是否粘了派工表改写？任一条否=整页重写。`
      : "",
    input.key === "metaphysics_action"
      ? `P4 额外自检：①三柱 moat？②有无仪轨/露锋/需以结界？③evidence/claim 有无处境议题尾巴（名分/权益/对方态度/贡献显隐等当机制主语）？④半截「若，」「使得，」？⑤calc_cite 是否奇门/Fact-pack 摘录（勿含宜退避处方）？任一条否=整页重写。`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let tokens_used = 0;
  try {
    const result = await callLLM({
      call_type: "main_delivery",
      system: JUDGMENT_SYSTEM,
      messages: [{ role: "user", content: user }],
      max_tokens: 12_000,
      thinking_effort: "high",
      timeout_ms:
        input.timeout_ms ??
        PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS ??
        DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      response_format: "json",
      session_id: input.session_id,
      temperature: 0.3,
      max_attempts: deliveryTransportMaxAttempts(),
      signal: input.signal,
      phase_name: "content_judgment_v3",
    });
    tokens_used += result.meta.tokens_used;
    const text = result.content?.trim() ?? "";
    const baseTrace = {
      phase: "content_judgment_v3",
      system: JUDGMENT_SYSTEM,
      user,
      user_feed: scrubbedFeed,
      result,
    };
    if (!text) {
      return {
        ok: false,
        reason: "empty_response",
        tokens_used,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
      };
    }
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return {
        ok: false,
        reason: "json_parse_failed",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
        call_trace: buildLabCallTrace({
          ...baseTrace,
          raw_text: text,
        }),
      };
    }
    const plan = coercePlan(input.key, parsed);
    if (!plan) {
      return {
        ok: false,
        reason: "coerce_failed",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
        call_trace: buildLabCallTrace({
          ...baseTrace,
          raw_text: text,
          parsed,
        }),
      };
    }
    return {
      ok: true,
      plan,
      tokens_used,
      last_raw_text: text.slice(0, 12_000),
      call_trace: buildLabCallTrace({
        ...baseTrace,
        raw_text: text,
        parsed: plan,
      }),
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "llm_error",
      tokens_used,
      call_trace: buildLabCallTrace({
        phase: "content_judgment_v3",
        system: JUDGMENT_SYSTEM,
        user,
        user_feed: scrubbedFeed,
        raw_text: null,
      }),
    };
  }
}
