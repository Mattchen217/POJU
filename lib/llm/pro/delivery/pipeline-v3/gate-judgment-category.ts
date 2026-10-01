/**
 * Pipeline v3 · early Phase B category gates on judgment units.
 * Only验不改：命中 → fail；禁止 strip / 改稿。
 * 升闸条件：类别已写入 duty，且同盘重跑仍冒出（见冻结清单 · 提前升闸）。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";
import { SCIENCE_JUDGMENT_MEANS_REFS } from "@/lib/llm/pro/delivery/science-means-feed";
import { METAPHYSICS_JUDGMENT_MEANS_REFS } from "@/lib/llm/pro/delivery/metaphysics-moat-feed";

/** 投入形态 / 权益处境词族（整类 · 非本案原句）。 */
const SITUATIONAL_PATH_RE =
  /话语权|名分|股权|兼职|全职|稳定收入|现职|试水|跳槽|权责|权力分配|模糊条款|不对等|全力投入|贸然.*投入|契约宫|白忙/;

/** P1/P2 禁奇门门宫承重（知局仅 P4 授权喂锁盘）。 */
const QIMEN_AXIS_RE =
  /死门|休门|开门|生门|惊门|杜门|伤门|景门|值符|值使|天蓬|玄武|天芮|主客/;

/** 半祈使 + 匹配收束（P1 已钉）。 */
const MATCH_CLOSE_RE = /结构匹配|更合结构|可保|需待|须待/;

/** P4 批断半祈使 / 仪轨取向 / 投入加码处方（整类 · 非本案二字）。 */
const P4_JUDGMENT_HALF_IMPERATIVE_RE =
  /站位需|需涵养|不急于表态|可借其|保持内守|避免因怕|接受模糊|兼职试水|全职跳入|全职投入|加大投入|跳步加码|再加码|若强行推进|若強行推進|强行推进|強行推進|此时若强行|此時若強行|此时若推进|此時若推進|借势不争|借勢不爭|不硬争主导|不硬爭主導|不争主导|不爭主導/;

/** P4 批断：十神语义 SSOT「禁=」吉凶套话承重（整类 · 非本案二字）。 */
const P4_TENGOD_FORMULA_BAN_RE =
  /枭神夺食|枭印夺食|偏印主孤|食神制杀必贵|食神主寿|正印主贵人|印多为病/;

/**
 * 关系闭集外推：六合/相冲支对禁改写成「合火局」。
 * 合火仅真算已列之半合火局等（如寅午）；午未六合≠合火。
 */
const P4_RELATION_FALSE_FIRE_HE_RE =
  /(?:午未|未午|丑未|未丑|卯未|未卯)(?:六)?合火|(?:午未|未午)合化火/;

/**
 * 通关未立假写成「通关金/喜神金未透」——功能阻滞 ≠ 未透干。
 * （天干已有金时尤忌；类别拦「通关…未透」捏造，不拦真算喜神未透干。）
 */
const P4_TONGGUAN_FALSE_WEITOU_RE =
  /通关金[^。；\n]{0,12}未透|喜神金未透/;

/** 透干 ≠ 当令：禁把「天干透出」与「月令得令」写成同一事实。 */
const P4_TOUGAN_AS_DANGLING_RE = /透干[/／、]当令|当令[/／、]透干|透干当令/;

const TEN_GOD_NAME_RE =
  "偏印|正印|食神|伤官|七杀|正官|比肩|劫财|偏财|正财";

/**
 * 假藏：同条先以天干/柱干点出十神，又写「藏于同柱支」——天干透出假写成藏干。
 * 例：年柱丁卯，丁火偏印…偏印藏于年支
 */
function unitHasFalseHiddenStem(blob: string): boolean {
  // 干名(+五行)十神 … 同十神藏于支
  if (
    new RegExp(
      `([甲乙丙丁戊己庚辛壬癸])([金木水火土])?(${TEN_GOD_NAME_RE}).{0,120}\\3藏[於于].{0,8}(年|月|日|时)?支`,
    ).test(blob)
  ) {
    return true;
  }
  // 年柱…偏印…偏印藏于年支（柱位与藏支同柱）
  if (
    new RegExp(
      `(年|月|日|时)柱.{0,48}(${TEN_GOD_NAME_RE}).{0,100}\\2藏[於于]\\1支`,
    ).test(blob)
  ) {
    return true;
  }
  // 年干/月干…十神 … 同十神藏于支
  if (
    new RegExp(
      `(年|月|日|时)干.{0,24}(${TEN_GOD_NAME_RE}).{0,100}\\2藏[於于]`,
    ).test(blob)
  ) {
    return true;
  }
  return false;
}

/** 同条：某十神既「藏于四柱支」又「透干」= 透藏自相矛盾（柱位错锚类别）。 */
function unitHasTouCangContradiction(blob: string): boolean {
  const hid = blob.match(
    new RegExp(`(${TEN_GOD_NAME_RE}).{0,16}藏[於于].{0,10}(年|月|日|时)[支柱]`),
  );
  if (!hid?.[1]) return false;
  const god = hid[1];
  return new RegExp(
    `${god}.{0,28}透干|透干.{0,20}${god}|(年|月|日|时)柱.{0,24}${god}.{0,16}透`,
  ).test(blob);
}

/** calc_cite / claim 处方尾巴（整类）。 */
const P4_CITE_PRESCRIPTION_RE = /需抑制|宜等待|宜等|再加大投入|加大投入/;

const P3_MEANS_REF_ALLOW = new Set<string>(SCIENCE_JUDGMENT_MEANS_REFS);
const P4_MEANS_REF_ALLOW = new Set<string>(METAPHYSICS_JUDGMENT_MEANS_REFS);

function unitText(u: {
  unit_claim?: string;
  evidence?: string;
  calc_cite?: string;
}): string {
  return `${u.unit_claim ?? ""}\n${u.evidence ?? ""}\n${u.calc_cite ?? ""}`;
}

/**
 * Category gate on frozen judgment plan. Never mutates.
 */
export function gateJudgmentCategoryB(input: {
  key: DeliverySegmentKey;
  deep_evidence_plan?: DeepEvidencePlan | null;
}): ContentGateVerdict | null {
  const plan = input.deep_evidence_plan;
  if (!plan?.units?.length) return null;

  const notes: string[] = ["gate_phase:b_early", "ruler:category_no_mutate"];

  const situationalKeys: DeliverySegmentKey[] = [
    "foundation",
    "direct_answer",
    "science_action",
    "metaphysics_action",
  ];

  if (situationalKeys.includes(input.key)) {
    for (let i = 0; i < plan.units.length; i++) {
      const u = plan.units[i]!;
      const blob = unitText(u);
      if (SITUATIONAL_PATH_RE.test(blob)) {
        return {
          passed: false,
          failed_rule: "gate_judgment_situational_path_words",
          detail: `批断 units[${i}] 含投入形态/处境词族（话语权·名分·股权·兼职·权力分配等）。回改 duty/喂料后重跑批断枪——闸门不改稿。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        (input.key === "foundation" || input.key === "direct_answer") &&
        MATCH_CLOSE_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule: "gate_judgment_match_close",
          detail: `批断 units[${i}] 含「结构匹配/可保/需待」类收束。停在张力词后重跑批断枪。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      if (
        (input.key === "foundation" || input.key === "direct_answer") &&
        QIMEN_AXIS_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule:
            input.key === "foundation"
              ? "gate_p2_qimen_axis"
              : "gate_p1_qimen_axis",
          detail:
            input.key === "foundation"
              ? "P2 归因禁奇门门宫承重轴（知局归 P4）。回改喂料/duty 后重跑批断枪。"
              : "P1 主辅根禁奇门门宫承重（本页不喂锁盘；知局归 P4）。回改 duty 后重跑批断枪。",
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        input.key === "metaphysics_action" &&
        P4_JUDGMENT_HALF_IMPERATIVE_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule: "gate_p4_judgment_half_imperative",
          detail: `P4 批断 units[${i}] 含半祈使/投入加码处方（站位需/需涵养/试水跳入/加大投入等）。停在门宫·用忌·岁运张力后重跑批断枪。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        input.key === "metaphysics_action" &&
        P4_TENGOD_FORMULA_BAN_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule: "gate_p4_tengod_formula_ban",
          detail: `P4 批断 units[${i}] 含十神吉凶套话承重（枭印夺食/偏印主孤/食神制杀必贵等）。只写动力·负荷·柱位张力，禁套话公式名。回改后重跑。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        input.key === "metaphysics_action" &&
        P4_RELATION_FALSE_FIRE_HE_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule: "gate_p4_relation_false_fire_he",
          detail: `P4 批断 units[${i}] 把六合/冲刑支对改写成「合火」（闭集外推）。午未六合等须按闭集原词；合火仅真算已列半合火局。回改后重跑。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        input.key === "metaphysics_action" &&
        P4_TONGGUAN_FALSE_WEITOU_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule: "gate_p4_tongguan_false_weitou",
          detail: `P4 批断 units[${i}] 把「通关未立」写成「通关金/喜神金未透」。通关阻滞≠未透干；金已透干时写金被火制/通关受阻。回改后重跑。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
    }
  }

  if (input.key === "science_action") {
    const seenRefs = new Set<string>();
    for (let i = 0; i < plan.units.length; i++) {
      const u = plan.units[i]!;
      const ref = String(u.means_candidate_ref ?? "").trim();
      if (!ref) {
        return {
          passed: false,
          failed_rule: "gate_p3_means_ref_missing",
          detail: `P3 批断 units[${i}] 缺 means_candidate_ref。须用派工闭集「科学维N/结构轴」。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      if (!P3_MEANS_REF_ALLOW.has(ref)) {
        return {
          passed: false,
          failed_rule: "gate_p3_means_ref_invented",
          detail: `P3 批断 units[${i}] means_candidate_ref 不在派工闭集（须精确「科学维N/格局·十神主矛盾」等六轴之一）。回改 duty/菜单后重跑。`,
          notes: [...notes, `unit:${i}`, `ref:${ref.slice(0, 40)}`],
        };
      }
      if (seenRefs.has(ref)) {
        return {
          passed: false,
          failed_rule: "gate_p3_means_ref_duplicate",
          detail: `P3 批断 means_candidate_ref 复用：${ref.slice(0, 40)}。六条须互异。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      seenRefs.add(ref);
    }
  }

  if (input.key === "metaphysics_action") {
    const seenRefs = new Set<string>();
    for (let i = 0; i < plan.units.length; i++) {
      const u = plan.units[i]!;
      const ref = String(u.means_candidate_ref ?? "").trim();
      const cite = String(u.calc_cite ?? "");
      if (!ref) {
        return {
          passed: false,
          failed_rule: "gate_p4_means_ref_missing",
          detail: `P4 批断 units[${i}] 缺 means_candidate_ref。须用派工闭集「时机/极性/角色候选N」。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      if (!P4_MEANS_REF_ALLOW.has(ref)) {
        return {
          passed: false,
          failed_rule: "gate_p4_means_ref_invented",
          detail: `P4 批断 units[${i}] means_candidate_ref 不在派工闭集（须精确时机候选N|极性候选N|角色候选N）。回改 duty 后重跑——闸门不改稿。`,
          notes: [...notes, `unit:${i}`, `ref:${ref.slice(0, 40)}`],
        };
      }
      if (seenRefs.has(ref)) {
        return {
          passed: false,
          failed_rule: "gate_p4_means_ref_duplicate",
          detail: `P4 批断 means_candidate_ref 复用：${ref.slice(0, 40)}。六条须互异。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      seenRefs.add(ref);
      if (P4_CITE_PRESCRIPTION_RE.test(cite)) {
        return {
          passed: false,
          failed_rule: "gate_p4_cite_prescription",
          detail: `P4 批断 units[${i}] calc_cite 含「需抑制/宜等待/加大投入」类处方尾巴。只摘结构事实后重跑。`,
          notes: [...notes, `unit:${i}`],
        };
      }
      const blob = unitText(u);
      if (P4_TOUGAN_AS_DANGLING_RE.test(blob)) {
        return {
          passed: false,
          failed_rule: "gate_p4_judgment_tougan_dangling",
          detail: `P4 批断 units[${i}] 把「透干」与「当令」写成同一事实。当令=月令得令；天干透出只写透干。回改 duty/派工 cite 后重跑。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (unitHasTouCangContradiction(blob) || unitHasFalseHiddenStem(blob)) {
        return {
          passed: false,
          failed_rule: "gate_p4_judgment_pillar_misanchor",
          detail: `P4 批断 units[${i}] 柱位错锚（透藏矛盾或天干十神假写「藏于支」）。天干透出写透干/年干月干；藏干写支中藏。回改后重跑。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
    }
  }

  if (input.key === "foundation" && plan.units.length !== 4) {
    notes.push(`warn_p2_unit_count:${plan.units.length}_expect_4`);
  }

  return null;
}
