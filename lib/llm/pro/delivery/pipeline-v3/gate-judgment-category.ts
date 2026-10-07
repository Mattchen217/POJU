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
import {
  calculateTenGod,
  type HeavenlyStem,
  type TenGod,
} from "@/lib/match/data/stems-branches";

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
 * 把相克写成「克合」= 闭集外现编「合」（P1/P2/P4 批断整类）。
 * 类别：换盘仍成立；非某一干支对补丁。
 */
const RELATION_INVENTED_KEHE_RE = /克合/;

/**
 * 冲与半合并列时外推「合局被破」定论（闭集未写破合）。
 */
const RELATION_HE_BROKEN_OVERCLAIM_RE =
  /合局被破|合被破|冲破合|逢冲则合|冲则合破|合局.{0,4}被破/;

/**
 * 批断滑向局势结果态（应停在承压/窗口收窄）。
 * P2 归因尤忌；P1 同步拦。
 */
const JUDGMENT_OUTCOME_PROPHECY_RE =
  /关系动荡|主关系动荡|稳定性下降|稳定度下降|稳定性承压|稳定度承压|必裂|必然破裂/;

/** 岁运耗用神只许一条主轴承重；换盘仍成立。 */
const YONG_DRAIN_REPEAT_RE =
  /泄用神|用神金受|火旺克.{0,8}用神|岁运.{0,12}克金|忌神火.{0,12}克金|火克金/;

function unitHasXianYinContradiction(blob: string): boolean {
  const wealthXian = /财星显|财星虽显|正财.{0,16}显/.test(blob);
  const wealthYin = /资源链路隐伏|财官链路隐伏|链路隐伏不彰/.test(blob);
  if (wealthXian && wealthYin) return true;
  const officerTou = /官星虽透|官杀.{0,8}透|正官.{0,12}透/.test(blob);
  const officerYin = /制衡位不显|约束位不显/.test(blob);
  return officerTou && officerYin;
}

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

const STEM_CHARS = "甲乙丙丁戊己庚辛壬癸";
const TEN_GOD_CLAIM =
  "偏印|正印|食神|伤官|七杀|正官|比肩|劫财|偏财|正财";

/**
 * 扫「干(+五行)?十神」与「十神(+干)」连写；与日主真算不符 → 正偏互串等错标。
 * 类别尺：换盘仍成立；非本案二字补丁。
 */
function unitHasStemTenGodMismatch(
  blob: string,
  dayMasterStem: string,
): string | null {
  const dm = dayMasterStem.charAt(0);
  if (!STEM_CHARS.includes(dm)) return null;

  const pairs: Array<{ stem: string; god: string }> = [];
  const stemFirst = new RegExp(
    `([${STEM_CHARS}])(?:[金木水火土])?(?:午|寅|子|丑|卯|辰|巳|未|申|酉|戌|亥)?(${TEN_GOD_CLAIM})`,
    "g",
  );
  const godFirst = new RegExp(
    `(${TEN_GOD_CLAIM})([${STEM_CHARS}])(?:[金木水火土])?`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = stemFirst.exec(blob)) !== null) {
    pairs.push({ stem: m[1]!, god: m[2]! });
  }
  while ((m = godFirst.exec(blob)) !== null) {
    pairs.push({ stem: m[2]!, god: m[1]! });
  }

  for (const p of pairs) {
    // 日主自身：允许「日主己土」邻近，不把日干强制成比肩承重句。
    if (p.stem === dm && /日主/.test(blob.slice(Math.max(0, blob.indexOf(p.stem) - 4), blob.indexOf(p.stem) + 6))) {
      continue;
    }
    const expected = calculateTenGod(
      dm as HeavenlyStem,
      p.stem as HeavenlyStem,
    );
    if (expected !== (p.god as TenGod)) {
      return `${p.stem}≠${p.god}(真算${expected})`;
    }
  }
  return null;
}

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
  /** 日主天干一字；有则验「干+十神」真算一致（P4）。 */
  day_master_stem?: string | null;
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
        (input.key === "foundation" ||
          input.key === "direct_answer" ||
          input.key === "metaphysics_action") &&
        RELATION_INVENTED_KEHE_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule:
            input.key === "foundation"
              ? "gate_p2_relation_invented_kehe"
              : input.key === "direct_answer"
                ? "gate_p1_relation_invented_kehe"
                : "gate_p4_relation_invented_kehe",
          detail: `批断 units[${i}] 含「克合」——相克不得写成合。只写「克」或抄闭集已列合冲原词。回改 duty 后重跑批断枪。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        (input.key === "foundation" || input.key === "direct_answer") &&
        RELATION_HE_BROKEN_OVERCLAIM_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule:
            input.key === "foundation"
              ? "gate_p2_relation_he_broken_overclaim"
              : "gate_p1_relation_he_broken_overclaim",
          detail: `批断 units[${i}] 外推「合局被破/冲破合」。冲与半合可并列写张力，禁写成合已破定论。回改后重跑批断枪。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (
        (input.key === "foundation" || input.key === "direct_answer") &&
        JUDGMENT_OUTCOME_PROPHECY_RE.test(blob)
      ) {
        return {
          passed: false,
          failed_rule:
            input.key === "foundation"
              ? "gate_p2_judgment_outcome_prophecy"
              : "gate_p1_judgment_outcome_prophecy",
          detail: `批断 units[${i}] 含局势结果态（动荡/稳定性下降/稳定性承压/必裂）。停在承压偏高/窗口收窄后重跑批断枪。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`],
        };
      }
      if (input.key === "foundation" && unitHasXianYinContradiction(blob)) {
        return {
          passed: false,
          failed_rule: "gate_p2_xian_yin_contradiction",
          detail: `批断 units[${i}] 财官显隐自相矛盾：已写「财星显/官透」却套「资源链路隐伏/制衡位不显」。隐伏仅用于财藏/官杀藏；已透则写承压/泄用/显性受制。回改 duty 后重跑批断枪。`,
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
      const stemMismatch =
        input.day_master_stem &&
        unitHasStemTenGodMismatch(blob, input.day_master_stem);
      if (stemMismatch) {
        return {
          passed: false,
          failed_rule: "gate_p4_tengod_mislabel",
          detail: `P4 批断 units[${i}] 天干+十神与日主真算不符（${stemMismatch}）。正偏印/正偏财等不得互串；须与 Fact-pack 该干十神一致。回改后重跑。`,
          notes: [...notes, `unit:${i}`, `path:${u.path}`, stemMismatch],
        };
      }
    }
  }

  if (input.key === "foundation" && plan.units.length !== 4) {
    notes.push(`warn_p2_unit_count:${plan.units.length}_expect_4`);
  }

  if (input.key === "foundation") {
    const yongHits = plan.units.filter((u) =>
      YONG_DRAIN_REPEAT_RE.test(unitText(u)),
    ).length;
    if (yongHits >= 3) {
      return {
        passed: false,
        failed_rule: "gate_p2_yong_axis_repeat",
        detail: `P2 批断 ${yongHits} 条复读岁运耗用神（泄用神/火克金）。仅 dimensions[0] 用忌轴承重该主因；财官/食伤轴换切入。回改后重跑批断枪。`,
        notes: [...notes, `yong_drain_units:${yongHits}`],
      };
    }
  }

  return null;
}
