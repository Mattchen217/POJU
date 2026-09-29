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

/**
 * 禁区 = 类别边界（非正例范文）。换盘后仍成立。
 * 合格自检见 pageDutyBlock。
 */
const JUDGMENT_SYSTEM = `你是交付报告「原始依据批断」写手（Pipeline v3 · 内容步①批断枪）。
只输出 JSON，不要 markdown。

## 职责（只写「为什么对此人成立」）
- unit_claim / evidence = 本盘/本局结构机制链：十神·用忌·合冲刑害·岁运姿态·宫位压力·奇门主客门等真算因果。
- 可含闭集结构真词（干支/十神/用神/宫门等）。
- calc_cite 必须能指回 user 喂料里的总纲/Fact-pack/奇门句；禁无出处现编结构。

## 禁区硬表（命中任一条 = 废稿，重写该条）
1. **手段/处方进批断（整类）**：投入节奏处方（试水/灵活试水/暂守/全职/加重筹码/等某运再加码）、契约制度执行（书面约定/开口谈/签不签）、谈判话术、岗位角色重构指令、清单式「该做A做B」。括号夹带「（全职）」同禁。
2. **攻守祈使收束（整类 · 尤忌句末）**：以「宜…」「更符合…」「以静制动」「守势探路」等收束 claim/evidence。批断只写到结构张力（承压偏高/显性不足/制衡位弱/窗口收窄），**禁止**给攻守指令。
3. **仪轨/意象调候/露锋处方（整类 · P4 尤忌）**：静润降温、延迟回应、露锋（含不急于）、此为…仪轨、待水旺再加码——留给正文仪轨柱。
4. **处境/P3 议题尾巴（整类 · P4 批断尤忌）**：白忙、权益（落地/保障/固化/明确权益）、话语权、技术贡献难…转化/固化、接受模糊条款、股权不明、需以结界…——主张写到门宫主客·用忌·岁运张力为止。
5. **身心/场域动作正例**：冥想、深呼吸配方等——禁止出现在 claim/evidence。
6. **恐吓式预测/结果承诺**：必损、必成、吉凶时点。
7. **科学执行词族**：合同模板、律师步骤、股权比例表、Excel、OKR——批断禁止。
8. **⟦w:⟧ / ⟦t:⟧** 禁止。
9. **同轴复读**：两条 unit 不得共用同一主结构轴。

## 允许的「节奏」说法（机制，非处方）
- 可写：岁运对用神冲突 → 冒进承压偏高；死门当值 → 场域虚高/气口易被压；用弱忌旺 → 资源获取条件偏苛；客生主+死门 → 可借亦可缠（**停在这里**）。
- 不可写：因此静润降温 / 因此延迟回应 / 因此试水或露锋 / 因此用「宜守/仪轨」收束。

## 页职责
- direct_answer(P1)：主辅双轨的**真算根**（宜守/忌冒进/切辅条件）；禁写成生活处方与法律步骤。
- foundation(P2)：归因机制批断（人为什么卡在这里）；禁怎么办。
- science_action(P3)：只写支撑科学执行的结构根因；不是执行本身。
- metaphysics_action(P4)：奇门+八字双核结构根（门宫主客·用忌·岁运）；禁仪轨处方、禁处境/权益尾巴、禁写成 P3 商务根因。
- risk_guard / signals_close：坑与窗口的结构根因；不是防法步骤表。

质量只靠本提示与 user 真算料。不要自我审查成空壳；也不要为「显得可执行」而塞手段。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1 批断 · 主辅真算根）`,
        `- 必须恰好 3 条 units，path 固定：core_judgment / primary / backup。`,
        `- core_judgment：整案取舍的结构主张（宜什么节奏、忌什么冒进）。`,
        `- primary：为何「主轨」对本盘成立（机制链，非执行步骤）。`,
        `- backup：何时主轨失效、辅轨的结构条件（机制，非法务清单）。`,
        `- 可含闭集真词；calc_cite 指回总纲/Fact-pack。`,
        `- 禁手段/律师合同/冥想；禁必损必成。不要 means_candidate_ref。`,
        `- 本页批断供正文长主辅用；产品 UI 不挂依据折层。`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2）`,
        `- 每条 = 一条归因机制：结构事实 → 对本题（合伙/节奏/话语权等）为何成立。`,
        `- unit_claim：一句结构主张（禁「需/应/先去…」祈使）。`,
        `- evidence：≥2 句机制链；删掉所有「去做什么」后，机制仍完整。`,
        `- 自检：若某句离开盘局换成谁都成立的鸡汤或生活处方 → 删掉重写。`,
        `- 不要输出 means_candidate_ref（本页不需要）。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3 批断 · 六维结构根）`,
        `- **恰好 6 条** units；path **钉死**：`,
        `  primary_toolkit.angles[0..2] + backup_toolkit.angles[0..2]（禁止 dimensions[i]）。`,
        `- 每条 = 一条**结构根因**，证明后文科学动作「为何必须针对此人」；**不是**策略/手段本身。`,
        `- **六维主轴互异（硬 · 类别）**：每条只占下列轴之一，六条各不相同——`,
        `  ①格局/十神主矛盾 ②宫位关系压力 ③财官显隐与生财·制衡链路 ④印比伤心力结构 ⑤用忌旺衰与资源姿态 ⑥岁运气候交织。`,
        `  自检：任意两句 unit_claim 若删专名后故事骨架相同 → 同质废稿，换轴重写。`,
        `- **收束铁律（硬）**：unit_claim / evidence 必须停在结构张力词（承压偏高 / 显性不足 / 制衡位弱 / 窗口收窄 / 泄身偏重 / 耗损偏重）。`,
        `  **禁止**句末或句中：「宜…」「更符合…」「以静制动」「守势探路」、试水/全职/加重筹码（含括号夹带）、投入形态对比。`,
        `  合格对照：用弱忌旺 →「冒进承压偏高」✓；用弱忌旺 →「灵活试水」✗；岁运冲突 →「窗口收窄」✓；岁运冲突 →「加重筹码（全职）」✗。`,
        `- unit_claim：一句结构主张（禁祈使；禁处境结论尾巴如「易白忙」）。`,
        `- evidence：≥2 句**完整**机制链（禁半截「此时若，」）；可含闭集真词；删光「去做什么/试水/全职」后机制仍完整。`,
        `- calc_cite：只摘总纲/Fact-pack/真算**连续原文**；禁粘贴「派工表：」改写句；禁收集事实当主张。`,
        `- chart_anchors：每条 ≥1 个闭集短标签（从本条机制摘：十神/宫位关系/用忌/岁运），禁空数组。`,
        `- means_candidate_ref：跟派工表 ref，**六条互不重复**；标签只供下游 fill，禁止把菜单 direction 抄进 claim。`,
        `- 禁合同/股权律师步骤/谈判话术进 claim/evidence；禁复读 P1 主辅生活结论当六维批断。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `## 本页 duty · metaphysics_action（P4 批断 · 奇门+八字双核结构根）`,
        ``,
        `### 定位`,
        `- 本步只写**玄学结构机制**（奇门门/宫/主客 + 八字用忌/十神/岁运），证明后文暗锦囊「为何只对此局此人成立」。`,
        `- **不是** P3 批断：禁把主张收成权益落地、合同、里程碑、技术换筹码、话语权谈判结论。`,
        `- 主语是局/气/气口/场域/泄秀涵养张力——不是协议与交付物。`,
        ``,
        `### 结构要求`,
        `- 八字 + 奇门锁盘局势链；每条标 moat_class=timing|polarity|archetype（三柱须覆盖）。`,
        `- path=dimensions[i]；means_candidate_ref 跟约束帧候选且互不重复。`,
        `- **收束铁律**：停在张力词（气口易被压 / 场域虚高 / 用弱忌旺 / 窗口收窄 / 泄秀被截 / 涵养位弱 / 通关未立）。`,
        `  **禁止** claim/evidence：仪轨处方、露锋收束、待水旺加码、P3 工具词；**禁止处境尾巴**（白忙、权益、话语权、技术贡献难固化/转化、接受模糊条款、需以结界…）——写到「泄秀被稀释 / 生克阻滞 / 内守易封闭 / 气口被压」即可。`,
        `  合格：食神泄秀无制衡 →「输出易被稀释」✓；食神 →「技术贡献难固化为明确权益」✗。`,
        `- unit_claim / evidence：结构机制链，可含闭集真词；完整句，禁半截「若，」「使得，」。`,
        `- calc_cite：Fact-pack / 奇门锁盘连续原文；禁调候建议与处境翻译。`,
        `- chart_anchors ≥1（门/宫/十神/用忌/岁运）。`,
        `- 自检：①三柱 moat？②有无仪轨/露锋/处境权益尾巴？③删掉奇门或用忌后主张是否垮？任一条否=重写。`,
      ].join("\n");
    case "risk_guard":
      return [
        `## 本页 duty · risk_guard（P5 批断）`,
        `- 写「哪条结构易翻车」的机制根因；禁防法步骤表。`,
      ].join("\n");
    case "signals_close":
      return [
        `## 本页 duty · signals_close（P6 批断）`,
        `- 写近窗承压/可借力的结构根因；禁日程甘特与具体执行清单。`,
      ].join("\n");
    default:
      return `## 本页 duty · ${key}\n- 纯机制批断；禁手段与预测承诺。`;
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
      `      "unit_claim": "整案取舍结构主张一句",`,
      `      "calc_cite": "总纲/Fact-pack 短摘",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": []`,
      `    },`,
      `    {`,
      `      "path": "primary",`,
      `      "unit_claim": "主轨为何对本盘成立",`,
      `      "calc_cite": "...",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": []`,
      `    },`,
      `    {`,
      `      "path": "backup",`,
      `      "unit_claim": "切辅的结构条件",`,
      `      "calc_cite": "...",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": []`,
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
  return [
    `## 输出 JSON 形状`,
    `{`,
    `  "page": "${key}",`,
    `  "units": [`,
    `    {`,
    `      "path": "dimensions[0]",`,
    `      "unit_claim": "本盘结构主张一句（禁祈使/禁手段）",`,
    `      "calc_cite": "事实档短摘录（须能对上喂料）",`,
    `      "evidence": "≥2句纯机制链（禁处方、禁冥想调候、禁必损必成）",`,
    `      "chart_anchors": [],`,
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
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    pageDutyBlock(input.key),
    input.core_conclusion?.trim()
      ? `## core_conclusion\n${input.core_conclusion.trim()}`
      : "",
    input.user_feed.trim(),
    jsonShapeHint(input.key),
    `units 条数建议 ${bounds.min}–${bounds.max}` +
      (input.key === "science_action"
        ? `；path 钉死 primary_toolkit/backup_toolkit.angles[0..2]。`
        : `；path 用 dimensions[i]（或 angles[i]/why_cards[i] 若页习惯如此）。`),
    `落笔前自检：删光「需/应/先去/签/谈/冥想/必然」类词后，机制链是否仍成立？不成立=重写。`,
    input.key === "science_action"
      ? `P3 额外自检：①六 path 钉死？②六 claim 主轴互异？③有无试水/全职/加重筹码/宜X/更符合？④有无半截「此时若」？⑤chart_anchors 是否每条≥1？⑥calc_cite 是否粘了派工表改写？任一条否=整页重写。`
      : "",
    input.key === "metaphysics_action"
      ? `P4 额外自检：①三柱 moat？②有无仪轨/露锋/需以结界？③evidence/claim 有无处境尾巴（权益/话语权/技术贡献难固化或转化/白忙）？④半截「若，」「使得，」？⑤calc_cite 是否奇门/Fact-pack 摘录（勿含宜退避处方）？任一条否=整页重写。`
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
      user_feed: input.user_feed,
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
        user_feed: input.user_feed,
        raw_text: null,
      }),
    };
  }
}
