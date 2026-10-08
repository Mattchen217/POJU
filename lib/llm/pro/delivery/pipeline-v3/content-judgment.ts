/**
 * Pipeline v3 · Step1-A raw judgment — greenfield generator.
 * No assign LLM, no deep-evidence-quality gates.
 * JSON parse + **B 装配**（coerce：钉 path/ref/moat 等代码可算对的槽）—
 * 不是验收闸改稿，也不是 C 类剥句妆合格。
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
  PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { pageEvidenceUnitBounds } from "@/lib/llm/pro/delivery/page-schema/evidence-unit-soft-cap";
import {
  SCIENCE_ASSIGN_PATHS,
  SCIENCE_JUDGMENT_MEANS_REFS,
  buildScienceMeansFeedBlock,
} from "@/lib/llm/pro/delivery/science-means-feed";
import {
  METAPHYSICS_JUDGMENT_MEANS_REFS,
  METAPHYSICS_JUDGMENT_PATHS,
  METAPHYSICS_JUDGMENT_MOAT_BY_INDEX,
} from "@/lib/llm/pro/delivery/metaphysics-moat-feed";
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
6. **恐吓式预测/结果承诺/局势结果态（整类）**：必损、必成、吉凶时点；关系「动荡/必裂/摇荡」、任何「稳定/不稳」收束——批断只写到承压偏高/窗口收窄，不写成已发生或必发生的局势结局。
7. **科学执行词族**：合同模板、顾问/法务步骤、比例表、表格看板工具——批断禁止。
8. **⟦w:⟧ / ⟦t:⟧** 禁止。
9. **同轴复读**：两条 unit 不得共用同一主结构轴。
10. **闭集外现编关系（整类）**：合冲刑害只抄喂料已列原词；禁「克合」把相克写成合；禁「合局被破/冲破合/逢冲则合破」等外推定论（冲与半合可并列写张力，禁止写成「合已破」）。

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
        `  · 生活门槛/处境词进 claim/evidence（整类 · 硬）：投入形态、契约条款、谈判执行、话语权/名分/股权/兼职/全职/权责——喂料里出现也不许回写`,
        `  · **收集症状当句末（整类）**：把收集口述现象写成 claim/evidence 收束——机制停在承压/隐伏/制衡位弱/窗口收窄`,
        `  · **局势结果态收束（整类）**：禁动荡/必裂/摇荡；**claim/evidence 禁「稳定」「不稳」**（含稳定性承压、制衡位不稳等换壳）`,
        `  · **闭集外现编关系（整类）**：合冲刑害只抄闭集原词；禁「克合」；禁「合局被破/冲破合」外推——冲与半合并列写张力即可`,
        `  · **十神真算一致（整类）**：十神标签须与日主/闭集一致；火日主禁「午火七杀/午火正官」贴标（官杀为水；午火=忌神火或藏干比劫/食神）。分写「壬水正官」与「午火忌神」允许。`,
        `  · **生克姿态（整类）**：火对用神金只写克；禁「午火泄用神」（泄=用神金生水/大运壬）`,
        `  · 攻守「宜…」收束；手段处方；同轴复读；**奇门门宫作归因主轴**（知局归 P4）`,
        `  · 禁把日支/配偶宫写成「契约宫」等法律议题半白话`,
        `【数据来源】总纲 + Fact-pack（八字/岁运/合冲）；**不灌 collecting 原文、不喂奇门锁盘**；议题方向只看下方中性 core_conclusion。`,
        `【硬约束】`,
        `- 恰好 4 条；path=dimensions[0..3]；主轴钉死且互异：①用忌/岁运 ②宫位冲害 ③财官显隐 ④食伤/印比。`,
        `- unit_claim=结构张力一句；evidence≥2 句停在张力词（承压偏高/显性不足/制衡位弱/窗口收窄/链路隐伏）——**禁**「若贸然…投入」类条件投入句。`,
        `- **宫位轴收束白名单（硬 · dimensions[1]）**：只许写「宫位承压偏高」「宫位窗口收窄」「宫位受冲张力偏高」三选一收束；机制=流月/岁运冲日支或宫位 → 上述张力词即停；**禁稳定·不稳·摇荡**。`,
        `- **财官轴改写（硬）**：财藏/官杀藏 → 只写「资源链路隐伏 / 制衡位或约束位不显」；**财已透/财星显禁写隐伏**；**大运天干已点正官/七杀 = 已透**，禁再写「官星不透/制衡位不显」（写泄用/制衡承压）。庚金坐午：写「财星坐忌神火受克」，**禁**「午火七杀」。`,
        `- **轴互异（硬）**：岁运泄用/克用只在 dimensions[0] 作主因；财官轴写显隐与被制，食伤印比轴写比劫/食伤通关或夺泄——禁三轴复读同一句「火克金/泄用神」。`,
        `- 用忌精度对齐 yong_stance（大运扶用时禁「用神弱」，写岁运冲突下承压）；chart_anchors≥1 且贴本轴；不要 means_candidate_ref。`,
        `- 干支相克只写「克」；闭集未列之「合/合化/合破」一律禁现编。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3 批断）`,
        `【本页角色】科学执行的结构根写手——证明后文动作「为何必须针对此人」，不是策略本身。`,
        `【本页目标】六维互异结构根，锚定主辅各三角；停在张力词，不写投入形态/节奏处方收束。`,
        `【本页禁忌】`,
        `  · 宜…/更符合…收束；投入形态处方；法务商务步骤进 claim；复读 P1 生活结论当六维。`,
        `  · 生活门槛/处境词进 claim/evidence（整类 · 硬）：试水/全职/兼职/股权/话语权/稳定收入/权责/名分——喂料或议题里出现也不许回写为机制主语或句末尾巴。`,
        `  · 财官轴：财藏/官杀藏 → 只写「资源链路隐伏 / 制衡位不显」；禁译成股权兑现/话语权评估。`,
        `  · means_candidate_ref：**必须**抄派工表 ref=（形如「科学维N/…」）；禁发明「XX评估工具/兑现机制/节奏方案」类名。`,
        `【数据来源】总纲 + Fact-pack + **科学手段派工菜单**；六条 ref 不重复；**不灌 collecting / 奇门 / moat**。`,
        `【硬约束】恰好 6 条；path=primary_toolkit.angles[0..2]+backup_toolkit.angles[0..2]；六维轴各异；chart_anchors≥1。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `## 本页 duty · metaphysics_action（P4 批断）`,
        `【本页角色】奇门+八字双核结构根写手——写局/气/气口张力，不写协议与仪轨处方。`,
        `【本页目标】证明后文暗锦囊「为何只对此局此人成立」；三柱 moat_class 覆盖 timing|polarity|archetype。`,
        `【本页禁忌】`,
        `  · 仪轨/露锋/投入形态处方（试水/全职跳入/加码减码/**加大投入**/若强行推进等）——岁运条只写窗口收窄/用弱忌旺，禁条件推进尾巴`,
        `  · 处境议题尾巴作机制主语或句末（权力分配/话语权/名分/权益/模糊条款/对方态度/贡献显隐——整类）`,
        `  · 半祈使收束（站位需…/需涵养/不急于表态/可借其…保持…/借势不争主导）；calc_cite 禁「需抑制/宜等待」处方尾巴`,
        `  · means_candidate_ref 自造标签（泄秀节律者/运岁近窗未熟…）；**必须**抄派工表 ref=时机候选N|极性候选N|角色候选N`,
        `  · **柱位（硬）**：天干透出只写透干/年干·月干等；藏干只写支中藏。同条禁「X藏于年支」又写「X透干」；**禁把天干十神假写成「藏于支」**（年干偏印≠偏印藏于年支）。**当令≠透干**（当令=月令得令；禁「透干/当令」并列当同一事实）。`,
        `  · **干+十神真算（硬）**：写「干名(+五行)+十神」或「十神+干」时，十神必须与日主对该干的真算一致（对照 Fact-pack 四柱/大运/流年行）；**禁正印↔偏印、正财↔偏财等同干互串**。角色维派工要的十神须锚在真算同名的干上，禁张冠李戴。`,
        `  · **通关≠未透（硬）**：「通关未立」只写金被火制/通关受阻/关口阻滞；天干已有金（如食神辛透干）禁写「喜神金未透/通关金未透」`,
        `  · **十神吉凶套话（整类 · 硬）**：禁用「某十神=必贵/主孤/主寿/夺食定命」等格局口号承重；只写本案柱位动力/负荷/牵制张力（换盘仍成立的机制，不是口诀表）`,
        `  · **关系闭集（硬）**：合冲刑害只引 structured 已列原词；禁把午未六合等改写成「合火/半合火局」（合火仅真算已列之寅午类半合火局）`,
        `  · **约束帧取向（硬）**：角色/时机「方向」句（借势不争/内守侧翼等）只供正文；批断禁原样收束`,
        `  · P3 工具词作主张收束；**奇门「当值」错标**（当值=值使门；值符落死门写落宫/承符）`,
        `【数据来源】总纲 + Fact-pack（含锁盘）+ **moat 结构候选（批断版·无 Q/E/收集）**；六条 ref 不重复；**不灌 fill 派工全文、不灌 collecting、不灌 P3 科学菜单**。`,
        `【硬约束】恰好 6 条 path=dimensions[0..5]；moat 按派工 timing|polarity|archetype 轮转；收束停在气口易被压/场域虚高/用弱忌旺/窗口收窄/制衡位弱；chart_anchors≥1；死门仅在值使=死门或值符落死门宫时承重。`,
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
  // P3：path 钉死主辅 angles；means_candidate_ref 按 path 下标钉死结构轴闭集（禁模型现编工具名）。
  if (key === "science_action") {
    const remapped = units.slice(0, SCIENCE_ASSIGN_PATHS.length).map((u, i) => ({
      ...u,
      path: SCIENCE_ASSIGN_PATHS[i]!,
      means_candidate_ref: SCIENCE_JUDGMENT_MEANS_REFS[i]!,
    }));
    if (remapped.length < Math.max(1, bounds.min)) return null;
    return { page: key, units: remapped };
  }
  // P4：path/ref/moat 按派工表钉死（禁自造「泄秀节律者/运岁近窗未熟」等人设标签当 ref）。
  if (key === "metaphysics_action") {
    const remapped = units
      .slice(0, METAPHYSICS_JUDGMENT_PATHS.length)
      .map((u, i) => ({
        ...u,
        path: METAPHYSICS_JUDGMENT_PATHS[i]!,
        means_candidate_ref: METAPHYSICS_JUDGMENT_MEANS_REFS[i]!,
        moat_class: METAPHYSICS_JUDGMENT_MOAT_BY_INDEX[i]!,
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
        `      "unit_claim": "结构轴${i + 1}主张一句（禁祈使/禁投入节奏/禁处境词权责股权等）",`,
        `      "calc_cite": "事实档短摘录",`,
        `      "evidence": "≥2句纯机制链（删光权责|股权|兼职|全职|试水后仍完整）",`,
        `      "chart_anchors": [],`,
        `      "means_candidate_ref": "${SCIENCE_JUDGMENT_MEANS_REFS[i]!}"`,
        `    }${i < SCIENCE_ASSIGN_PATHS.length - 1 ? "," : ""}`,
      ].join("\n"),
    ).join("\n");
    return [
      `## 输出 JSON 形状（P3：恰好 6 条 · path+ref 钉死）`,
      `{`,
      `  "page": "science_action",`,
      `  "units": [`,
      unitLines,
      `  ]`,
      `}`,
      `means_candidate_ref 必须逐字用上表六值（代码亦会按 path 钉死）；禁另造「资源链路评估」等后缀。`,
    ].join("\n");
  }
  if (key === "metaphysics_action") {
    const unitLines = METAPHYSICS_JUDGMENT_PATHS.map((p, i) =>
      [
        `    {`,
        `      "path": "${p}",`,
        `      "unit_claim": "结构主张一句（禁祈使/禁处境尾巴/禁柱位错锚）",`,
        `      "calc_cite": "奇门锁盘或 Fact-pack 短摘（禁需抑制/宜等待）",`,
        `      "evidence": "≥2句机制链·停在气口/场域虚高/用弱忌旺/窗口收窄",`,
        `      "chart_anchors": [],`,
        `      "moat_class": "${METAPHYSICS_JUDGMENT_MOAT_BY_INDEX[i]!}",`,
        `      "means_candidate_ref": "${METAPHYSICS_JUDGMENT_MEANS_REFS[i]!}"`,
        `    }${i < METAPHYSICS_JUDGMENT_PATHS.length - 1 ? "," : ""}`,
      ].join("\n"),
    ).join("\n");
    return [
      `## 输出 JSON 形状（P4：恰好 6 条 · path+ref+moat 钉死）`,
      `{`,
      `  "page": "metaphysics_action",`,
      `  "units": [`,
      unitLines,
      `  ]`,
      `}`,
      `means_candidate_ref 必须逐字用上表六值（时机/极性/角色候选N）；禁另造「泄秀节律者/运岁近窗未熟」等人设标签。`,
    ].join("\n");
  }
  const moatLine = "";
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
  /**
   * Dispatch attempt (1-based). ≥2 → provider escape after Lab transport stall.
   * Acceptance 1+1 uses a separate corrective hint — do not bump this for quality.
   */
  dispatch_attempt?: number;
  /** Assembled fact / thesis / moat feeds (caller builds). */
  user_feed: string;
  core_conclusion?: string;
  /** Attempt-2 acceptance corrective (category rule/detail). */
  acceptance_corrective?: string | null;
}): Promise<ContentJudgmentOk | ContentJudgmentFail> {
  const bounds = pageEvidenceUnitBounds(input.key);
  let scrubbedFeed = scrubJudgmentFeedPrescriptions(input.user_feed);
  // 防御：Lab/上游漏装派工菜单时，批断枪自补结构派工（禁空菜单现编 ref）
  if (
    input.key === "science_action" &&
    !/【P3 科学手段候选菜单/.test(scrubbedFeed)
  ) {
    scrubbedFeed = [
      scrubbedFeed,
      buildScienceMeansFeedBlock(null, null, { forJudgment: true }),
    ]
      .filter((s) => s?.trim())
      .join("\n\n");
  }
  // P3/P4 批断：禁把 Lab 整段议题原文（含兼职/股权/话语权）当 core_conclusion 灌进枪口
  const coreBlock =
    input.key === "science_action"
      ? [
          "## core_conclusion",
          "围绕本案合伙/资源议题写六维结构根（格局十神 · 宫位 · 财官显隐 · 印比 · 用忌 · 岁运）。",
          "禁回写处境词族：试水/全职/兼职/股权/话语权/权责/名分/稳定收入——官杀藏只写「制衡位不显」。",
        ].join("\n")
      : input.key === "metaphysics_action"
        ? [
            "## core_conclusion",
            "围绕本案合伙/资源议题写东方谋略结构根（奇门门宫主客 · 用忌 · 岁运窗口 · 十神站位张力）。",
            "禁回写处境词族：试水/全职/兼职/股权/话语权/权力分配/模糊条款/名分/权益——收束停在气口/场域虚高/用弱忌旺/窗口收窄。",
          ].join("\n")
      : input.key === "foundation"
        ? [
            "## core_conclusion",
            "围绕四轴写结构根（用忌岁运 · 宫位冲害 · 财官显隐 · 食伤印比）。议题只定方向，不粘贴收集原文。",
            "禁回写收集现象句与处境词族；收束停在承压/隐伏/制衡位弱/窗口收窄。",
          ].join("\n")
        : input.core_conclusion?.trim()
          ? `## core_conclusion\n${input.core_conclusion.trim()}`
          : "";
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    pageDutyBlock(input.key),
    coreBlock,
    scrubbedFeed,
    input.acceptance_corrective?.trim() || "",
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
      ? `P2 额外自检：①恰好4轴且无奇门？②岁运泄用/克用是否只在 dim0 主因（dim2/3 禁复读同一火克金句）？③用忌对齐 yong_stance？④chart_anchors≥1贴轴？⑤搜「话语权|权责|股权|兼职|全力投入|契约宫」→须为零？⑥无攻守祈使/若贸然投入？⑦删掉收集现象句后机制是否仍停在张力词？⑧搜「稳定|不稳|摇荡|克合|合局被破|冲破合|关系动荡」→须为零（宫位轴只用白名单三收束）？⑨财星显/大运正官已点名的同条是否误写隐伏/官不透/制衡位不显？⑩搜「午火七杀|午火正官|午火泄用神」→须为零（火日主官杀为水；火对金写克不写泄）？任一条否=整页重写。`
      : "",
    input.key === "science_action"
      ? `P3 额外自检：①六 path 钉死？②六 claim 主轴互异（格局十神/宫位/财官/印比/用忌/岁运）？③搜「话语权|股权|兼职|全职|试水|稳定收入|权责」→须为零？④有无宜X/更符合/投入形态处方收束？⑤means_candidate_ref 是否均抄自派工表 ref=（禁自造工具名）？⑥chart_anchors 每条≥1？任一条否=整页重写。`
      : "",
    input.key === "metaphysics_action"
      ? `P4 额外自检：①六 path+ref+moat 钉死？②仪轨/露锋/加大投入/若强行推进？③处境尾巴？④透藏假藏或透干当令并列？⑤calc_cite 纯结构？⑥枭印夺食等套话？⑦合冲刑害是否闭集原词（禁午未合火）？⑧干+十神是否与日主/Fact-pack 一致（禁正偏印互串）？任一条否=整页重写。`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let tokens_used = 0;
  try {
    const { deliveryDispatchProviderBody } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    const provider = deliveryDispatchProviderBody(
      Math.max(1, input.dispatch_attempt ?? 1),
    );
    const result = await callLLM({
      call_type: "main_delivery",
      system: JUDGMENT_SYSTEM,
      messages: [{ role: "user", content: user }],
      max_tokens: PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
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
      provider,
      phase_name: "content_judgment_v3",
    });
    tokens_used += result.meta.tokens_used;
    const finish = result.meta.finish_reason ?? null;
    const text = result.content?.trim() ?? "";
    const baseTrace = {
      phase: "content_judgment_v3",
      system: JUDGMENT_SYSTEM,
      user,
      user_feed: scrubbedFeed,
      result,
    };
    const { v3FailReasonAfterUnusableJson } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    if (!text) {
      return {
        ok: false,
        reason: v3FailReasonAfterUnusableJson({
          finish,
          text,
          empty: true,
        }),
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
        reason: v3FailReasonAfterUnusableJson({
          finish,
          text,
          empty: false,
        }),
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
