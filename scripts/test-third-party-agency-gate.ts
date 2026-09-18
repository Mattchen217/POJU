/**
 * Persistent third-party agency regression set.
 *
 * Discipline: any change to third-party detection / relationship weld / soft-repair
 * must keep this suite green — do not only eye-check a new chart.
 *
 * Run: pnpm exec tsx scripts/test-third-party-agency-gate.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  detectKnownThirdPartyAgency,
  extractKnownThirdParties,
  softRepairThirdPartyAgencyProse,
  softRepairWriteEvidenceProse,
  isWriteFrictionShellEvidence,
  softRepairScienceAngleUserProse,
  softRepairIntimacyAnaphoraProse,
  stripEmbeddedScienceSoftRepairShells,
  isTruncatedScienceStrategy,
  isFullDialogueScriptProse,
  isScienceSoftRepairShell,
  SCIENCE_QUERENT_OPENING_HINT,
  relationshipFrictionInferenceTemplate,
  partnershipFrictionInferenceTemplate,
  isRelationshipFrictionSurface,
  isPartnershipFrictionSurface,
} from "../lib/llm/pro/delivery/thesis/third-party-agency";
import { scrubMingliJargonOutsideSlots } from "../lib/llm/pro/delivery/page-schema/compress-jargon-repair";
import { polishWriteChunkUnits } from "../lib/llm/pro/delivery/page-schema/deep-evidence-write";
import type { DeepEvidenceAssignmentUnit } from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidenceUnit } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import { scrubAssignClaimBanSeed } from "../lib/llm/pro/delivery/page-schema/assign-binding-seed";
import {
  detectThirdPartyNatalAttribution,
  softRepairThirdPartyAttributionProse,
  validateAssignmentThesisCoverage,
} from "../lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import type { ChartThesis } from "../lib/llm/pro/delivery/thesis/types";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";

type FixtureCase = {
  id: string;
  polarity: "positive" | "negative";
  slug: string;
  text: string;
  expect_agency: boolean;
};

type FixtureFile = {
  id: string;
  title: string;
  known_parties: string[];
  agenda: {
    original_question?: string;
    covered_agenda?: Array<{ label: string; answer?: string }>;
  };
  cases: FixtureCase[];
};

const FIXTURE_DIR = path.join(
  process.cwd(),
  "scripts/fixtures/third-party-attr",
);

const miniThesis: ChartThesis = {
  version: 1,
  structured_fingerprint: "test-third-party",
  generated_at: "test",
  judgment_core_frozen: true,
  dimensions: [
    {
      dimension_id: "interpersonal_pattern",
      dimension_name_zh: "人际",
      strength_verdict: "正官在时柱",
      conclusion_zh: "人际承压",
      classical_basis: [
        {
          key: "a",
          present: true,
          summary_zh: "正官；子未相害；六合；六合化金",
        },
      ],
      usable_claims_hint: ["正官承压", "子未相害扰夫妻宫"],
      wuxing_relations: [],
      depth: "full",
    },
  ],
};

function loadFixtures(): FixtureFile[] {
  const files = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  assert.ok(files.length >= 3, "expected ≥3 fixture files");
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(FIXTURE_DIR, f), "utf8");
    return JSON.parse(raw) as FixtureFile;
  });
}

let failed = 0;

for (const fix of loadFixtures()) {
  const extracted = extractKnownThirdParties({
    original_question: fix.agenda.original_question,
    covered_agenda: fix.agenda.covered_agenda,
  });
  for (const p of fix.known_parties) {
    assert.ok(
      extracted.includes(p),
      `${fix.id}: extract should find ${p}, got [${extracted.join(",")}]`,
    );
  }

  for (const c of fix.cases) {
    const hit = detectKnownThirdPartyAgency(c.text, fix.known_parties);
    const ok = c.expect_agency ? hit != null : hit == null;
    if (!ok) {
      failed += 1;
      console.error("FAIL", fix.id, c.id, {
        expect_agency: c.expect_agency,
        hit,
        text: c.text,
      });
      continue;
    }

    // Mirror through validate wrapper
    const viaValidate = detectThirdPartyNatalAttribution(
      c.text,
      fix.known_parties,
    );
    assert.equal(
      viaValidate != null,
      c.expect_agency,
      `${fix.id}/${c.id} validate wrapper mismatch`,
    );

    if (c.expect_agency) {
      const repaired = softRepairThirdPartyAgencyProse(
        c.text,
        fix.known_parties,
      );
      assert.equal(
        detectKnownThirdPartyAgency(repaired, fix.known_parties),
        null,
        `${fix.id}/${c.id} soft-repair must clear agency: ${repaired}`,
      );
      assert.equal(
        detectThirdPartyNatalAttribution(repaired, fix.known_parties),
        null,
      );

      // Thesis coverage gap then clears after repair
      const gap = validateAssignmentThesisCoverage(
        {
          units: [
            {
              necessary_signals: [
                {
                  slug: c.slug,
                  dimension_id: "interpersonal_pattern",
                  inference_zh: c.text,
                },
              ],
            },
          ],
        },
        miniThesis,
        { known_third_parties: fix.known_parties },
      );
      assert.match(gap ?? "", /third_party_attr/);

      const cleaned = softRepairThirdPartyAttributionProse(
        c.text,
        fix.known_parties,
      );
      const after = validateAssignmentThesisCoverage(
        {
          units: [
            {
              necessary_signals: [
                {
                  slug: c.slug,
                  dimension_id: "interpersonal_pattern",
                  inference_zh: cleaned,
                },
              ],
            },
          ],
        },
        miniThesis,
        { known_third_parties: fix.known_parties },
      );
      assert.equal(
        after,
        null,
        `${fix.id}/${c.id} after soft-repair coverage: ${after} :: ${cleaned}`,
      );
    }
  }
  console.log("ok", fix.id, `(${fix.cases.length} cases)`);
}

// Scheme C template itself must be agency-clean
{
  const t = relationshipFrictionInferenceTemplate("子未相害");
  assert.equal(detectKnownThirdPartyAgency(t, ["男友"]), null);
  assert.ok(isRelationshipFrictionSurface("焦虑，男友反对我换工作", ["男友"]));
  // 创业伙伴 / 旧部 must NOT get intimacy weld
  assert.equal(
    isRelationshipFrictionSurface(
      "你在创业邀约中的实际话语权: 旧部是发起人，我更多是加入他的盘子",
      ["旧部", "伙伴"],
    ),
    false,
  );
  assert.ok(
    isPartnershipFrictionSurface(
      "创业伙伴对兼职试水的接受度: 他明确说过希望我全职加入",
    ),
  );
  const p = partnershipFrictionInferenceTemplate("六合");
  assert.equal(detectKnownThirdPartyAgency(p, ["伙伴", "旧部"]), null);
  assert.ok(!/亲密关系/.test(p));
}

// Write-layer soft-repair: 盘2卡3 回潮句必须被焊回盘主侧且带 ⟦w:⟧
{
  const dirty =
    "男友反对的核心原因在于你的专业积累很具体且已有人付费，这看似是现实考量，但在命理结构上，⟦w:子未相害⟧ 落在夫妻宫，形成暗中妨害之象，使亲密关系中沟通易生错位。当你试图推动职业变动时，相害引发的张力会将压力导向你这一侧，导致伴侣对你的能力产生价值否定，将你的专业经验视为风险而非优势。因此，男友的反对并非单纯现实考量，而是子未相害结构下亲密关系对个人重要变动的阻力显现。";
  const seed =
    "子未相害使你在亲密关系议题上更易感到推进阻力；张力并存时，压力落在你侧的开口与节奏上。";
  const fixed = softRepairWriteEvidenceProse({
    evidence: dirty,
    slug: "子未相害",
    calc_cite: "男友反对的核心原因: 我的专业积累很具体",
    unit_claim: "此表象说明结构上：男友反对的核心原因",
    inference_zh: seed,
    known_parties: ["男友", "伴侣"],
  });
  assert.equal(fixed.still_dirty, false, fixed.evidence);
  assert.ok(fixed.repaired);
  assert.ok(fixed.evidence.includes("⟦w:子未相害⟧"));
  assert.equal(
    detectKnownThirdPartyAgency(fixed.evidence, ["男友", "伴侣"]),
    null,
    fixed.evidence,
  );
  assert.ok(!/价值否定|男友的反对并非/.test(fixed.evidence));
  assert.ok(!isWriteFrictionShellEvidence(fixed.evidence), fixed.evidence);
  assert.ok(/[。！？]/.test(fixed.evidence), fixed.evidence);

  const locked: DeepEvidenceAssignmentUnit = {
    path: "why_cards[3]",
    chart_anchors: ["子未相害"],
    calc_cite: "男友反对的核心原因: 我的专业积累很具体",
    means_candidate_ref: "表象候选4",
    unit_claim: "此表象说明结构上：男友反对的核心原因",
    necessary_signals: [
      {
        slug: "子未相害",
        dimension_id: "cycle_rhythm",
        inference_zh: seed,
        role: "说明结构阻力",
        why_needed: "关系议题上你更难推动",
      },
    ],
  };
  const unit: DeepEvidenceUnit = {
    path: "why_cards[3]",
    chart_anchors: ["子未相害"],
    evidence: dirty,
    moat_class: null,
    calc_cite: locked.calc_cite,
    means_candidate_ref: locked.means_candidate_ref,
    unit_claim: locked.unit_claim,
    mechanism_tag: "surface_why",
  };
  const polished = polishWriteChunkUnits([locked], [unit], ["男友", "伴侣"]);
  assert.equal(polished.fail_reason, null, polished.fail_reason ?? "");
  assert.ok(polished.repaired);
  assert.ok(polished.units[0]!.evidence.includes("⟦w:子未相害⟧"));
  assert.ok(
    !isWriteFrictionShellEvidence(polished.units[0]!.evidence),
    polished.units[0]!.evidence,
  );

  // P5 Lab: incoming short shell must expand (木/水孪生壳)
  const shellOnly =
    "就你侧的结构感受而言：⟦w:木⟧使你在亲密关系议题上更易感到推进阻力；张力并存时，压力落在你侧的开口与节奏上。";
  assert.ok(isWriteFrictionShellEvidence(shellOnly));
  const shellFixed = softRepairWriteEvidenceProse({
    evidence: shellOnly,
    slug: "木",
    calc_cite: "推进本案主路径执行动作时，结构过耗或失控须立即停",
    unit_claim: "做「推进本案主路径」若出现红灯须立即停",
    inference_zh: relationshipFrictionInferenceTemplate("木"),
    known_parties: ["男友"],
  });
  assert.equal(shellFixed.still_dirty, false, shellFixed.evidence);
  assert.ok(!isWriteFrictionShellEvidence(shellFixed.evidence), shellFixed.evidence);
  assert.ok(/熔断|红灯|停/.test(shellFixed.evidence), shellFixed.evidence);
}

{
  // 全局：fill 用户层 essence 软修第三方施事（不绑男友案文案）
  const dirtyEssence =
    "从你这一侧的结构来看，在亲密关系中你更容易感到推进的阻力。当你的专业价值越具体、越有市场，在关系里反而越容易被感知为对稳定的威胁，导致男友和家人强烈反对。这不是谁对谁错，而是能量结构带来的张力，让你的独立成长在他人眼中变成了不安定因素。";
  assert.ok(detectKnownThirdPartyAgency(dirtyEssence, ["男友", "家人"]));
  const pad =
    "这一层说明结构压力如何落到你可核对的日常选择上，而不是空泛安慰。";
  const mkCard = (title: string, essence: string, anchor: string) => ({
    title,
    surface: "收集表象事实句足够长作为 surface，用于对照 essence 机制。",
    essence: `${essence}${pad}`,
    chart_anchors: [anchor],
  });
  const sanitized = sanitizePageJson("foundation", {
    page: "foundation",
    page_title: "卡点诊断：专业输出与关系张力",
    page_subtitle: "剥开焦虑表象，看清结构如何落到你侧",
    dashboard: [
      { key: "body", label: "身体负荷", score: null },
      { key: "mind", label: "续航心力", score: null },
      { key: "field", label: "外部阻力", score: null },
    ],
    why_cards: [
      mkCard(
        "卡0",
        "你的经济缓冲来自把高压工作内化为可付费的专业输出，这是结构转化而非偶然运气。",
        "乙庚合",
      ),
      mkCard(
        "卡1",
        "你缓解焦虑时本能找人倾诉，是因为结构里有同类支持通道而不是软弱。",
        "比肩",
      ),
      mkCard(
        "卡2",
        "你估算得出六到十二个月安全垫，是因为隐性资源在财务缓冲位上起作用。",
        "偏财",
      ),
      mkCard("卡3脏", dirtyEssence, "子未相害"),
      mkCard(
        "卡4",
        "你想不再焦虑能睡好，对应卸下竞争重负后身心松弛，因此主辅双轨过渡成立。",
        "劫财",
      ),
    ],
    evidence: [],
  });
  assert.equal(
    sanitized.ok,
    true,
    sanitized.ok ? "" : `${sanitized.reason} :: ${sanitized.notes.join(" | ")}`,
  );
  if (sanitized.ok) {
    const card3 = (sanitized.page as { why_cards: Array<{ essence: string }> })
      .why_cards[3]!;
    assert.equal(
      detectKnownThirdPartyAgency(card3.essence, ["男友", "家人"]),
      null,
    );
    assert.ok(!/导致男友|家人强烈反对/.test(card3.essence));
    assert.ok(
      sanitized.notes.some((n) => n.startsWith("soft_repair_third_party_essence")),
    );
  }
}

{
  // 全局：P3 fill — 剥话术/施事；禁止用关系开口壳盖掉各角；空壳策略须 fail 而非假绿
  const dirtyStrategy =
    "你不需要说服男友同意你创业，只需要先把你侧身心极限说清楚。真诚表达脆弱，往往比争辩对错更能软化对立。把对立收成共同面对的问题，并提出可核对的半年观察期：保留工作、小步试水咨询、定期同步进展。";
  assert.ok(detectKnownThirdPartyAgency(dirtyStrategy, ["男友"]));

  const sleepStrategy =
    "你的神经系统长期紧绷，内在冲突反复引动，睡眠障碍正是身心耗损的最直接信号。先处理身体报警信号，把恢复基础能量当作每天最重要的任务。";

  const mkAngle = (
    name: string,
    strategy: string,
    means: string[],
    anchor: string,
  ) => ({
    name,
    strategy,
    means,
    chart_anchors: [anchor],
    hard_metrics: [] as string[],
  });

  const scienceSan = sanitizePageJson("science_action", {
    page: "science_action",
    page_title: "渐进试水与果断休整：双轨破局策略",
    page_subtitle: "先修复睡眠，小步验证咨询副业，争取关系观察期",
    primary_toolkit: {
      role: "primary",
      title: "渐进式转型：低风险试水咨询副业",
      angles: [
        mkAngle(
          "低风险试水咨询副业",
          "你不需要立刻切断工资这条稳定水源。你的能量结构在高压下反而能凝聚出一股内部合力，让你可以在保住本职的同时，引出一条咨询的小渠。关键是控制试水成本，用最小行动收集证据。",
          [
            "今晚花30分钟整理一份专业咨询服务清单，列出你能解决的3个具体问题并给出初步定价。",
            "每周固定一个晚上写一篇行业洞察短文，积累可见的专业口碑。",
          ],
          "酉酉半合",
        ),
        mkAngle(
          "非说服性深度沟通",
          dirtyStrategy,
          [
            "本周选定一次可开口的时间窗口，只陈述你侧身心极限与观察期请求。",
            "写下观察期三条边界：每周投入上限、经济支出上限、暂缓讨论的议题。",
          ],
          "酉辰六合",
        ),
        mkAngle(
          "睡眠恢复优先",
          sleepStrategy,
          [
            "从今晚开始设定睡前无屏幕规则：睡前一小时关闭手机和电脑。",
            "固定就寝和起床时间，连续坚持一周，观察入睡和夜醒的变化。",
          ],
          "酉酉相刑",
        ),
      ],
    },
    backup_toolkit: {
      role: "backup",
      title: "果断休整：暂停蓄力再启动",
      angles: [
        mkAngle(
          "守位蓄力：暂停休整",
          "当旧模式能量耗尽，强行维持只会延长枯竭期。此时暂停不是失败，而是顺应时势的智慧。利用已有安全垫，果断给自己一个彻底的休整期。",
          [
            "确定一个明确的离职日期，利用这段时间整理客户案例，为休整后的启动做准备。",
            "离职后前一到两个月不接任何工作，专注身心恢复，把睡眠质量作为核心指标。",
          ],
          "七杀",
        ),
        mkAngle(
          "旁路观察：只观察不承诺",
          "你对秩序和安全感有强烈的需求，在能量不足时对外部机会保持谨慎是明智的。休整期间只观察收集，不承诺全职。",
          [
            "每周花两小时浏览行业报告与独立咨询师案例，记录三个可复用的服务形式。",
            "建立一个机会观察清单，标注待能量恢复后评估。",
          ],
          "正官",
        ),
        mkAngle(
          "换轨条件：设定明确门槛",
          "你可以提前设定清晰的换轨条件，知道何时可以安全地切入新领域，从而避免在恐惧驱动下盲目行动。",
          [
            "写下三个明确的换轨条件，例如副业收入连续覆盖基本生活与睡眠自评达标。",
            "每月底做一次条件核查，用数据而非情绪判断是否准备好切换。",
          ],
          "偏印",
        ),
      ],
    },
    evidence: [],
  });
  assert.equal(
    scienceSan.ok,
    true,
    scienceSan.ok
      ? ""
      : `${scienceSan.reason} :: ${scienceSan.notes.join(" | ")}`,
  );
  if (scienceSan.ok) {
    const page = scienceSan.page as {
      primary_toolkit: {
        angles: Array<{ name: string; strategy: string; means: string[] }>;
      };
    };
    const a0 = page.primary_toolkit.angles[0]!;
    const a1 = page.primary_toolkit.angles[1]!;
    const a2 = page.primary_toolkit.angles[2]!;
    assert.equal(detectKnownThirdPartyAgency(a1.strategy, ["男友"]), null);
    assert.ok(!/说服男友|他怕你|：“|邀请他/.test(a1.strategy));
    assert.ok(!isScienceSoftRepairShell(a1.strategy), a1.strategy);
    assert.ok(a1.strategy.length >= 40, a1.strategy);
    for (const m of a1.means) {
      assert.equal(detectKnownThirdPartyAgency(m, ["男友"]), null, m);
      assert.ok(!/[“”]/.test(m), m);
      assert.ok(!isScienceSoftRepairShell(m), m);
    }
    assert.ok(a1.means.length >= 1);
    assert.ok(!isScienceSoftRepairShell(a0.strategy), a0.strategy);
    assert.ok(!isScienceSoftRepairShell(a2.strategy), a2.strategy);
    assert.ok(/睡眠|恢复|神经/.test(a2.strategy), a2.strategy);
    assert.ok(a0.strategy !== a1.strategy && a1.strategy !== a2.strategy);
    assert.ok(
      scienceSan.notes.some(
        (n) =>
          n.startsWith("soft_repair_third_party") ||
          n.startsWith("soft_repair_intimacy_anaphora") ||
          n.startsWith("strip_science_soft_repair"),
      ),
    );
  }

  // Hollow page of identical shells must fail (not gate-pass)
  const hollow = sanitizePageJson("science_action", {
    page: "science_action",
    page_title: "空壳双轨",
    page_subtitle: "不应过闸",
    primary_toolkit: {
      role: "primary",
      title: "主",
      angles: [0, 1, 2].map((i) =>
        mkAngle(
          `角${i}`,
          SCIENCE_QUERENT_OPENING_HINT,
          [SCIENCE_QUERENT_OPENING_HINT],
          ["酉酉半合", "酉辰六合", "酉酉相刑"][i]!,
        ),
      ),
    },
    backup_toolkit: {
      role: "backup",
      title: "辅",
      angles: [0, 1, 2].map((i) =>
        mkAngle(
          `辅${i}`,
          SCIENCE_QUERENT_OPENING_HINT,
          [SCIENCE_QUERENT_OPENING_HINT],
          ["七杀", "正官", "偏印"][i]!,
        ),
      ),
    },
    evidence: [],
  });
  assert.equal(hollow.ok, false);
  if (!hollow.ok) {
    assert.ok(
      /angles_lt|missing_primary|science_strategy_collapsed|science_means_empty/.test(
        hollow.reason + hollow.notes.join(" "),
      ),
      hollow.reason + " :: " + hollow.notes.join(" | "),
    );
  }

  // P4 fill must strip 完整话术 + 男友施事 (relationship Lab 假绿)
  const p4DirtyMean =
    "当男友或家人再次用「稳定」给你施压时，试着用专业价值去回应：“我正在把大厂经验变成咨询方案。这不是乱来，是把积累变现。”";
  assert.ok(isFullDialogueScriptProse(p4DirtyMean));
  const p4San = sanitizePageJson("metaphysics_action", {
    page: "metaphysics_action",
    page_title: "从硬扛到借势",
    page_subtitle: "补给·窗口·角色",
    question_anchor: "大厂离职与感情反对怎么破局",
    desired_outcome: "少焦虑、能落地",
    dimensions: [
      {
        name: "补给与远离",
        strategy:
          "能量底座偏紧，需主动靠近沉静补给场，远离持续掏空根基的过耗场。",
        means: [
          "每晚划出沉静补给时段，梳理专业方法论让能量回流。",
          p4DirtyMean,
        ],
        chart_anchors: ["身弱"],
      },
      {
        name: "窗口与切换",
        strategy:
          "大运机会与阻力交织，关键动作须排入可切换阶段窗，转折前不硬冲。",
        means: [
          "先做内部整理与学习，副业有正反馈后再放大动作。",
          "精力峰段做深度准备，谷段不做重大决策。",
        ],
        chart_anchors: ["甲子"],
      },
      {
        name: "借势与站位",
        strategy:
          "流年伤官引动表达欲，借势站上输出者席位，而非硬扛守序者角色。",
        means: [
          "每周输出一篇专业观察，用外部反馈对冲稳定依赖焦虑。",
          "周会用专业判断句式发言，先体验输出者掌控感。",
        ],
        chart_anchors: ["伤官"],
      },
    ],
    evidence: [],
  });
  assert.equal(
    p4San.ok,
    true,
    p4San.ok ? "" : `${p4San.reason} :: ${p4San.notes.join(" | ")}`,
  );
  if (p4San.ok && p4San.page.page === "metaphysics_action") {
    const blob = p4San.page.dimensions
      .map((d) => `${d.strategy}\n${d.means.join("\n")}`)
      .join("\n");
    assert.ok(!/[“”][^”"]{12,}[”"]/.test(blob), blob);
    assert.equal(detectKnownThirdPartyAgency(blob, ["男友", "家人"]), null);
    assert.ok(
      p4San.notes.some(
        (n) =>
          n.includes("drop_science_dialogue_script") ||
          n.includes("soft_repair_third_party") ||
          n.includes("drop_science_shell_or_agency"),
      ),
      p4San.notes.join(" | "),
    );
  }

  // Trailing 。 must still count as soft-repair shell (fill#3 leak)
  assert.ok(
    isScienceSoftRepairShell("关系议题上你更难推动对你重要的变动。"),
  );

  // Intimacy 他-anaphora soft-repair
  const ana = softRepairIntimacyAnaphoraProse(
    "你和男友之间的分歧，根源在于他担心失去稳定。打破僵局的关键不是说服他同意你辞职。",
  );
  assert.ok(!/他担心|说服他/.test(ana), ana);
  assert.ok(/你侧/.test(ana), ana);

  // 月支出 must not become 存款/【时令根基】出
  const spend = scrubMingliJargonOutsideSlots(
    "计算你的精确经济缓冲月数（存款/月支出），并列出休整期每月的最低预算。",
  );
  assert.ok(!/时令根基/.test(spend.text), spend.text);
  assert.ok(/月支出/.test(spend.text), spend.text);

  // fill#4: shell lead-in + 邀请他 (男友已剥) + truncated 框架：
  const fill4Strategy =
    "关系议题上你更难推动对你重要的变动。但你们的关系中存在一种将对立转化为合力的可能，关键在于你能否先放下说服的意图，真诚地表达你的身心极限。当你不再争辩对错，而是邀请他共同面对这个问题时，对立就会软化，变成。 沟通时可以用这样的框架：";
  assert.ok(isTruncatedScienceStrategy(fill4Strategy));
  const stripped = stripEmbeddedScienceSoftRepairShells(fill4Strategy);
  assert.ok(!/^关系议题上你更难推动/.test(stripped), stripped);
  const notes4: string[] = [];
  const r4 = softRepairScienceAngleUserProse(
    fill4Strategy,
    [
      "今晚写下你想表达的三个关键点：你目前的身心状态；你对他的担忧的理解；你请求的半年观察期边界。",
      "约一个双方都平静的时间，提前告知你想聊一聊自己的状态。",
    ],
    notes4,
    "primary_toolkit_angle_1",
  );
  assert.ok(
    r4.fail_reason === "science_strategy_truncated" ||
      r4.fail_reason === "third_party_agency_in_strategy" ||
      (r4.fail_reason == null &&
        !/邀请他|对他的担忧|关系议题上你更难推动/.test(r4.strategy)),
    `${r4.fail_reason} :: ${r4.strategy}`,
  );
}

{
  // Science/P5: cite 含「关系/男友」不得盲焊亲密摩擦模（allow_friction_weld=false）
  const dirtyScience =
    "合局下⟦w:午未六合⟧软化冲突，但男友反对换轨时张力仍落在你侧开口节奏。";
  const fixedScience = softRepairWriteEvidenceProse({
    evidence: dirtyScience,
    slug: "午未六合",
    calc_cite: "关系张力下的合力窗口：午未六合",
    unit_claim: "本维须证明合局如何软化冲突而非亲密摩擦套话",
    inference_zh: "午未六合使冲突更易被软化成可协商节奏",
    known_parties: ["男友"],
    allow_friction_weld: false,
  });
  assert.equal(fixedScience.still_dirty, false, fixedScience.evidence);
  assert.ok(!/亲密关系议题/.test(fixedScience.evidence), fixedScience.evidence);
  assert.ok(fixedScience.evidence.includes("⟦w:午未六合⟧"));

  const polishedScience = polishWriteChunkUnits(
    [
      {
        path: "dimensions[0].angles[0]",
        chart_anchors: ["午未六合"],
        calc_cite: "关系张力下的合力窗口",
        means_candidate_ref: "手段1",
        unit_claim: "本维须证明合局软化冲突",
        necessary_signals: [
          {
            slug: "午未六合",
            dimension_id: "interpersonal_pattern",
            inference_zh: "午未六合使冲突更易被软化成可协商节奏",
            role: "合局",
            why_needed: "证明合力",
          },
        ],
      },
    ],
    [
      {
        path: "dimensions[0].angles[0]",
        chart_anchors: ["午未六合"],
        evidence: dirtyScience,
        moat_class: null,
        calc_cite: "关系张力下的合力窗口",
        means_candidate_ref: "手段1",
        unit_claim: "本维须证明合局软化冲突",
        mechanism_tag: "means_angle",
      },
    ],
    ["男友"],
    { pageKey: "science_action" },
  );
  assert.equal(polishedScience.fail_reason, null, polishedScience.fail_reason ?? "");
  assert.ok(
    !/亲密关系议题/.test(polishedScience.units[0]!.evidence),
    polishedScience.units[0]!.evidence,
  );
}

{
  // P4 ban seed must not survive as claim
  const scrubbed = scrubAssignClaimBanSeed(
    "靠近能补给冷静弹性的状态场；贴本案问题，禁物件补泻、禁周复盘清单。勿写财务 KPI。",
  );
  assert.ok(!/禁物件补泻|禁周复盘|勿写财务/.test(scrubbed), scrubbed);
  assert.ok(scrubbed.includes("靠近能补给"), scrubbed);
}

assert.equal(failed, 0, `${failed} fixture case(s) failed`);
console.log("test-third-party-agency-gate: all passed");
