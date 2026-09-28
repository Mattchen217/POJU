/**
 * P4 means / moat — self-retune domain + vernacular timing + scrub.
 *   pnpm exec tsx scripts/test-p4-means-moat-vernacular.ts
 */
import assert from "node:assert/strict";
import {
  blobMentionsMoatMechanism,
  gateP4StrategyMoat,
  isP4CoachPmMean,
  isP4P3ToolWordFamilyMean,
  isP4ScienceExecMean,
  meansFailsDeCalcTest,
  scrubP4FillAnchorFeed,
  scrubP4MeansInstructionNoise,
  softRepairP4DimensionsP3ToolProse,
  softRepairP4DropP3ToolSentences,
  softStripP4CoachPmMeans,
  softStripP4ScienceExecMeans,
} from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import { noteP4DestinyGrounding } from "../lib/llm/pro/delivery/page-schema/destiny-grounding";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import { buildFillDuty } from "../lib/llm/pro/delivery/page-prompts/p4-metaphysics-action";
import { formatP4FillChunkUserHint } from "../lib/llm/pro/delivery/page-schema/fill-p4-chunk";

const timingStrategy =
  "服务守成窗口：当前这段较长阶段和这一年的能量交织，外部压力较大，内在恢复力受制，不是全力投入的最佳窗口。守成不是退缩，而是先收缩自身投入带宽，条件成熟再加码。";
assert.equal(
  blobMentionsMoatMechanism(timingStrategy, "timing"),
  true,
  "vernacular era + 窗口/守成/加码 must count as timing moat",
);

assert.equal(
  isP4CoachPmMean(
    "未熟窗口只维持最低接触；在起草验证期合作提案时，把试水期设定为3-6个月。",
  ),
  true,
  "试水期/验证期 are hard PM stems even with 未熟窗口",
);

assert.equal(
  isP4ScienceExecMean(
    "按技术输出者借势——用系统架构文档与可见交付积累话语权。",
  ),
  true,
  "docs/delivery shell is science-exec, not self-retune",
);

assert.equal(
  isP4ScienceExecMean(
    "未熟窗口先收缩自身投入带宽——心力只维持最低必要激活；冷静后再切换加码。",
  ),
  false,
  "pure self-bandwidth timing must pass science-exec",
);

{
  const scrubbed = scrubP4MeansInstructionNoise(
    "催促面前先稳住自己的节律；禁写成股权/验证期/文档清单。",
  );
  assert.equal(scrubbed.includes("验证期"), false);
  assert.ok(scrubbed.includes("节律"));
  assert.equal(isP4CoachPmMean(scrubbed), false);

  const strip = softStripP4CoachPmMeans([
    {
      strategy: "服务主路径推进。内在泄秀表达者借势。",
      means: [
        "催促面前先稳住自己的表达节律，以借势姿态处压力。",
        "感到被逼到墙角时回到可进可退站位；禁写成股权/验证期/文档清单。",
      ],
    },
    {
      strategy: "服务守成窗口。未熟窗口守成。",
      means: [
        "运岁过冲时先守自身结构节奏——守成窗口内不扩心力；窗口到了再加码。",
        "守成期只做调频准备；禁财务安全垫、禁验证期/试水期条款清单。",
      ],
    },
  ]);
  assert.equal(strip.dimensions.length, 2);
  assert.equal((strip.dimensions[0]!.means as unknown[]).length, 2);
  assert.equal((strip.dimensions[1]!.means as unknown[]).length, 2);
}

{
  const sci = softStripP4ScienceExecMeans([
    {
      strategy: "服务主路径。",
      means: [
        "催促面前先稳住自己的表达节律，以借势姿态处压力。",
        "用系统架构文档与可见交付积累话语权。",
      ],
    },
  ]);
  assert.equal((sci.dimensions[0]!.means as unknown[]).length, 1);
  assert.ok(sci.notes.some((n) => n.startsWith("p4_science_exec_mean_stripped")));
}

const page = gateP4StrategyMoat({
  dimensions: [
    {
      name: "局势交锋 · 客强守局",
      strategy: timingStrategy,
      means: [
        "未熟窗口先收缩自身投入带宽——心力与注意力只维持最低必要激活；内在冷静且条件成熟时再切换加码。",
        "未熟期每天固定一段独处降噪作补给窗，只调自己的节奏与恢复。",
      ],
      chart_anchors: ["值使", "客克主", "壬寅"],
    },
    {
      name: "站位借势 · 泄秀",
      strategy:
        "服务主路径推进：按泄秀表达者落成内在站位，催促面前先稳住自己的节律，借势不硬刚。",
      means: [
        "内在按食神落成泄秀表达者——催促面前先稳住自己的表达节律，不把身心绷成硬争主导。",
        "感到被逼到墙角时，先回到可进可退站位，用自己的节律回应压力。",
      ],
      chart_anchors: ["食神", "辛未"],
    },
  ],
  eastern_calc_slice:
    "timing_ripeness: 未熟\n【十神语义 SSOT】食神、偏印\npack_polarity: yong:水\n【奇门锁盘·交付起局】\n局: 陰遁一局\n值使: 開門落乾六宮\n客克主",
});
assert.equal(
  page.structural,
  false,
  `clean stratagem page must pass, got ${page.structural_reason}`,
);
assert.ok(page.covered.includes("timing"));
assert.ok(page.covered.includes("archetype"));

assert.equal(
  isP4P3ToolWordFamilyMean("用合同条款与股权补充协议钉死边界"),
  true,
  "P3 tool word family hard hit",
);
assert.equal(
  isP4P3ToolWordFamilyMean("局势逆风时先拉开缓冲冷静期，气定再应"),
  false,
);

const dirtyTools = gateP4StrategyMoat({
  dimensions: [
    {
      strategy: "服务主路径：把股权与合同条款谈清楚。",
      means: ["用Excel算清楚出资", "邮件模板催对方补协议"],
    },
    {
      strategy: "再写一维：OKR 跟踪交接文档。",
      means: ["补充协议落章", "法务走完再动"],
    },
  ],
  eastern_calc_slice:
    "timing_ripeness: 未熟\n【奇门锁盘·交付起局】\n局: 陰遁一局",
});
assert.equal(dirtyTools.structural, true);
assert.equal(dirtyTools.structural_reason, "p4_p3_tool_word_family");

const missingQimen = gateP4StrategyMoat({
  dimensions: [
    {
      strategy: timingStrategy,
      means: [
        "未熟窗口守成，气定再加码。",
        "每天独处静场作仪轨。",
      ],
    },
  ],
  eastern_calc_slice: "timing_ripeness: 未熟\npack_polarity: yong:水",
});
assert.equal(missingQimen.structural, true);
assert.equal(missingQimen.structural_reason, "p4_qimen_lock_missing");

const dirty = gateP4StrategyMoat({
  dimensions: [
    {
      strategy: timingStrategy,
      means: [
        "把试水期设定为3-6个月，并做里程碑监控。",
        "用每周五里程碑监控。",
      ],
    },
    {
      strategy: "再开一维职场课：写个人博客积累话语权，谈缓冲期安排。",
      means: ["发布技术社区笔记", "明确缓冲期与观察期"],
    },
  ],
  eastern_calc_slice:
    "timing_ripeness: 未熟\n【十神语义】食神\n【奇门锁盘·交付起局】\n局: 陰遁一局",
});
assert.equal(dirty.structural, true);
assert.equal(dirty.structural_reason, "p4_coach_pm_means");

{
  // Lab#16: 缓冲冷静期 means must not decalc-strip.
  const meanBuf =
    "当对方再次催促你全职加入时，先拉开半步缓冲冷静期——气定后再推进，不在催促场里当场拍板。";
  assert.equal(
    meansFailsDeCalcTest(meanBuf),
    false,
    "缓冲/气定/催促场 is Eastern, not decalc-generic",
  );
}

{
  // Lab#16: 「让对方不得不重视」不得整维作废；sanitize 应保留站位维.
  const plan = {
    page: "metaphysics_action" as const,
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: [] as string[],
        evidence: "客克主。",
        moat_class: "timing" as const,
        means_candidate_ref: "时机候选1",
        unit_claim: "客克主",
      },
      {
        path: "dimensions[1]",
        chart_anchors: [] as string[],
        evidence: "食神。",
        moat_class: "archetype" as const,
        means_candidate_ref: "角色候选1",
        unit_claim: "食神",
      },
      {
        path: "dimensions[2]",
        chart_anchors: [] as string[],
        evidence: "寅午半合。",
        moat_class: "timing" as const,
        means_candidate_ref: "时机候选2",
        unit_claim: "未熟",
      },
      {
        path: "dimensions[3]",
        chart_anchors: [] as string[],
        evidence: "偏印。",
        moat_class: "archetype" as const,
        means_candidate_ref: "角色候选2",
        unit_claim: "偏印",
      },
    ],
  };
  const out = sanitizePageJson(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      page_title: "兼职入局暗锦囊",
      page_subtitle: "以静制动",
      question_anchor: "前同事拉我全职入伙，我只想兼职试水。",
      desired_outcome: "兼职试水，守住节奏。",
      dimensions: [
        {
          name: "局势缓冲",
          strategy:
            "在落实兼职试水的主路径时，你正处在客克主、客强主弱的局势里。对方催促形成压迫场，最忌在催促场里当场拍板。先拉开半步缓冲带，把立刻决定变成气定后再应，从被动应激回到主动观察位，不把身心交给对方的节奏。",
          means: [
            "当对方再次催促你全职加入时，先拉开半步缓冲冷静期——气定后再推进，不在催促场里当场拍板。",
            "进取前做一次身心结界：静坐片刻或温凉饮一轮，确认自己未入对方火阵，再迈步。",
          ],
          chart_anchors: ["客克主", "值使"],
        },
        {
          name: "输出站位",
          strategy:
            "你善于用表达与产出来建立影响力，这恰恰是借势点。催促面前不硬抢台前名分，而用稳定输出让对方不得不重视你的价值。感到被逼到墙角时，收住硬刚冲动，用自己的产出节律回应，侧翼自处再应外场。",
          means: [
            "内在按输出疏导者姿态借势站位——催促面前先稳住自己的表达和涵养节律，不把身心绷成硬争主导。",
            "感到被逼到墙角时，先回到可进可退站位：收住硬刚冲动，用自己的节律回应，而不是用对抗抬升内耗。",
          ],
        },
        {
          name: "运岁未熟",
          strategy:
            "当前较长阶段运岁近窗未熟，深层根基不稳，不宜贸然加码。心力只维持本分节律，气定且条件成熟再切换，不因外催把破局跳步写进当下身心承诺，守成即是这一阶段的进取。",
          means: [
            "运岁近窗未熟时先守成——心力只维持本分节律，不因外催把破局跳步写进当下身心承诺。",
            "未熟期每天固定一段独处静场作仪轨，只调自己的节奏与恢复，不做破局加码。",
          ],
        },
        {
          name: "行为仪轨 · 内守结界",
          strategy:
            "思维偏内守钻研，压力下易硬扛或过度思虑。催促面前宜以内守涵养者姿态侧翼自处，先调站位与输出节律，不抢台前硬名；触及硬边界时退回守序姿态，守住身心结界底线，不硬刚耗自己。",
          means: [
            "对照内守涵养者的姿态侧翼自处——先调自己的站位与输出节律，不抢台前硬名。",
            "触及硬边界时退回守序姿态，守住身心结界底线，不硬刚耗自己。",
          ],
        },
      ],
    },
    {
      fillMode: "compress",
      deepEvidencePlan: plan,
      eastern_calc_slice:
        "timing_ripeness: 未熟\n【奇门锁盘·交付起局】\n局: 陰遁一局\n值使: 開門\n【十神语义】食神",
    },
  );
  assert.equal(out.ok, true, out.ok ? "" : `${out.reason} :: ${out.notes.join(" | ")}`);
  if (out.ok) {
    const dims = (out.page as { dimensions?: unknown[] }).dimensions ?? [];
    assert.equal(dims.length, 4, "must keep all 4 dims incl. 让对方不得不站位维");
    assert.ok(
      !out.notes.some((n) => n.includes("third_party_agency_in_strategy")),
      out.notes.join(" | "),
    );
    assert.ok(
      !out.notes.some((n) => n.includes("p4_decalc_generic_stripped:0:0")),
      out.notes.join(" | "),
    );
  }
}

{
  // Lab#15: strategy「看清条款」→ soft-drop tool sentence; hard gate must not fire.
  const fixed = softRepairP4DropP3ToolSentences(
    "这股力量不适合冲在台前硬争。用它来审视局势、看清条款、保护自己的底线。守住身心结界的底线，不硬刚。",
  );
  assert.equal(fixed.repaired, true);
  assert.equal(fixed.text.includes("条款"), false);
  assert.ok(fixed.text.includes("结界"));
  const dims = softRepairP4DimensionsP3ToolProse([
    {
      name: "站位",
      strategy:
        "借势侧翼自处。当对方要求全职时，用洞察力看清条款与风险。守住结界底线，不硬刚耗自己。",
      means: [
        "对照内守涵养者的姿态侧翼自处——先调站位与输出节律。",
        "触及硬边界时退回守序姿态，守住身心结界底线。",
      ],
    },
  ]);
  assert.equal(dims.repaired, true);
  assert.equal(String(dims.dimensions[0]?.strategy ?? "").includes("条款"), false);
  const moat = gateP4StrategyMoat({
    dimensions: [
      {
        strategy: String(dims.dimensions[0]?.strategy ?? ""),
        means: dims.dimensions[0]?.means,
      },
      {
        strategy:
          "当前较长阶段运岁窗口未熟，不宜贸然加码。心力只维持本分节律，气定且条件成熟再切换。",
        means: [
          "运岁窗口未熟时先守成——心力只维持本分节律，不因外催把破局跳步写进当下身心承诺。",
          "未熟期每天固定一段独处静场作仪轨，只调自己的节奏与恢复。",
        ],
      },
    ],
    eastern_calc_slice:
      "timing_ripeness: 未熟\n【奇门锁盘·交付起局】\n局: 陰遁一局\n【十神语义】偏印",
  });
  assert.equal(moat.structural, false, moat.notes.join(" | "));
  assert.ok(
    !moat.notes.some((n) => /^p4_strategy_p3_tool_dims:[1-9]/.test(n)),
    moat.notes.join(" | "),
  );
}

{
  // Lab#14 category: P4 partnership 局势 means must not be thinned by P3 science soft-repair.
  const plan = {
    page: "metaphysics_action" as const,
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: [] as string[],
        evidence: "时干己土克壬水。客克主。",
        moat_class: "timing" as const,
        means_candidate_ref: "时机候选1",
        unit_claim: "客克主之势",
      },
      {
        path: "dimensions[1]",
        chart_anchors: [] as string[],
        evidence: "食神透干。",
        moat_class: "archetype" as const,
        means_candidate_ref: "角色候选1",
        unit_claim: "食神偏显",
      },
      {
        path: "dimensions[2]",
        chart_anchors: [] as string[],
        evidence: "寅午半合。用神未透足。",
        moat_class: "timing" as const,
        means_candidate_ref: "时机候选2",
        unit_claim: "运岁窗口未熟",
      },
      {
        path: "dimensions[3]",
        chart_anchors: [] as string[],
        evidence: "偏印透干。",
        moat_class: "archetype" as const,
        means_candidate_ref: "角色候选2",
        unit_claim: "偏印生身",
      },
    ],
  };
  const raw = {
    page: "metaphysics_action",
    page_title: "暗锦囊：以静制动",
    page_subtitle: "催促场中守成",
    question_anchor: "前同事拉我入伙，想全职，我只想兼职试水。",
    desired_outcome: "先兼职试水，不急于全职跳入。",
    dimensions: [
      {
        name: "行动窗口",
        strategy:
          "当前整体气场中你处于客克主、客强主弱的状态，行动容易受阻。对方催促全职，但冷静沉潜的力量不足，容易被对方的急躁带动。因此不宜在催促场里当场拍板，需要先拉开半步缓冲冷静期，气定后再推进。",
        means: [
          "当前对方催促全职，宜先拉开半步缓冲冷静期——气定后再推进，不在对方催促场里当场拍板。",
          "进取前做一次身心结界：静坐片刻或温凉饮一轮，确认自己未入对方火阵，再迈步。",
        ],
        chart_anchors: ["客克主", "值使"],
      },
      {
        name: "冷静沉潜",
        strategy:
          "冷静沉潜的力量偏弱，而急躁高压偏旺，关键定夺前需要主动靠近冷静沉潜状态，以静制动。当感到被逼迫立刻定夺时，先恢复静定，再决定是否回应，避免在燥热场中消耗自己。",
        means: [
          "关键定夺前先靠近冷静、沉潜的状态——静润降温、涵养沉潜；以静制动，待气定再应，再面对催促场。",
          "觉察急躁、高压上涌时主动抽离，先恢复静定，再决定是否回应外场节奏。",
        ],
      },
      {
        name: "运岁窗口",
        strategy:
          "当前这段较长阶段虽然表面有机会，但深层根基不稳，容易助长急躁，运岁近窗未熟，不宜贸然加码。心力只维持本分节律，不因外催把破局跳步写进当下身心承诺，等待条件成熟再切换加码。",
        means: [
          "运岁近窗未熟时先守成——心力只维持本分节律，不因外催把破局跳步写进当下身心承诺；气定且条件成熟再切换加码。",
          "未熟期每天固定一段独处静场作仪轨，只调自己的节奏与恢复，不做破局加码。",
        ],
      },
      {
        name: "行为仪轨 · 内守站位",
        strategy:
          "思维模式偏内守、钻研，容易在压力下封闭或硬扛。面对强势催促不宜硬刚耗自己，而应以内守涵养者的姿态侧翼自处，先调自己的站位与输出节律，不抢台前硬名，触及硬边界时退回守序姿态。",
        means: [
          "对照内守涵养者的姿态侧翼自处——先调自己的站位与输出节律，不抢台前硬名。",
          "触及硬边界时退回守序姿态，守住身心结界底线，不硬刚耗自己。",
        ],
      },
    ],
  };
  const out = sanitizePageJson("metaphysics_action", raw, {
    fillMode: "compress",
    deepEvidencePlan: plan,
    eastern_calc_slice:
      "timing_ripeness: 未熟\n【奇门锁盘·交付起局】\n局: 陰遁一局\n值使: 開門",
  });
  assert.equal(out.ok, true, out.ok ? "" : `sanitize fail: ${out.reason} ${out.notes.join(" | ")}`);
  if (out.ok) {
    const dims = (out.page as { dimensions?: { means?: unknown[] }[] }).dimensions ?? [];
    assert.equal(dims.length, 4);
    assert.ok(
      !out.notes.some((n) => n.includes("soft_repair_third_party") || n.includes("drop_science_shell")),
      `must not run P3 science soft-repair on P4: ${out.notes.join(" | ")}`,
    );
    const m0 = dims[0]?.means ?? [];
    assert.ok(m0.length >= 2, `dim0 means kept: ${m0.length}`);
  }
}

// Lab #25: career/PM means that gut fill → means_thin must trip category gates.
{
  assert.equal(
    isP4CoachPmMean(
      "将兼职试水期视为一个纯粹的观察窗口，首要目标不是证明自己值得全职。",
    ),
    true,
    "Lab#25 试水期 means must trip coach/PM",
  );
  assert.equal(
    isP4ScienceExecMean(
      "选择一个技术难题漂亮解决并形成解决记录，打出不可替代性的气口。",
    ),
    true,
    "Lab#25 技术交付/不可替代性 must trip science-exec",
  );
  assert.equal(
    isP4CoachPmMean(
      "每周固定拿出两小时作为独处钻研时间，研究赛道与对方信用记录。",
    ),
    true,
    "Lab#25 每周固定工时清单 must trip coach/PM",
  );
  const easternKeep =
    "催促场压来时先静默封气口，以结界守住出手位，不跟对方虚高声势硬刚。";
  assert.equal(
    isP4CoachPmMean(easternKeep),
    false,
    "Eastern 气口/结界 means must survive",
  );
  assert.equal(isP4ScienceExecMean(easternKeep), false);
}

// Lab #28: scrub chain (agency + literal + P3 tool) → means_thin is gen-side category.
{
  assert.equal(
    isP4CoachPmMean("让对方同意把兼职升级为全职并谈清股权条款。"),
    true,
    "Lab#28 agency+P3 tool means must trip coach/tool",
  );
  assert.equal(
    isP4ScienceExecMean("用书面文档与合同条款锁住对方承诺。"),
    true,
    "Lab#28 P3 tool sentence must trip science-exec",
  );
  const duty = buildFillDuty("东方谋略");
  assert.ok(duty.includes("让对方同意"), "duty bans agency");
  assert.ok(duty.includes("水边"), "duty bans literal wuxing");
  const hint = formatP4FillChunkUserHint({
    index: 2,
    total: 3,
    include_page_chrome: false,
    parent_unit_count: 6,
    paths: ["dimensions[4]", "dimensions[5]"],
  });
  assert.ok(hint.includes("禁剥薄") || hint.includes("means_thin"), "chunk warns strip→thin");
  assert.ok(hint.includes("水边") || hint.includes("物化"), "chunk bans literal");
}

// Lab #31: fill feeds must not teach 股权/条款 restatement; vernacular grounds compress fill.
{
  const dirty =
    "Primary: 先兼职试水再谈股权 | when: now\nBackup: 全职硬谈合同条款 | when: if\nJudgment: 用技术方案换话语权";
  const clean = scrubP4FillAnchorFeed(dirty);
  assert.ok(!/股权|合同|条款|技术方案/.test(clean), `feed scrub must redact tools: ${clean}`);
  assert.ok(clean.includes("路径议题") || clean.includes("兼职"), "keeps path residue");

  const toolStrip = softRepairP4DimensionsP3ToolProse([
    {
      name: "局势",
      strategy: "在做主路径时先守气口。再用合同条款锁死对方。最后以结界收势。",
      means: ["气口静默不跟催促场硬刚。", "用技术方案换话语权。"],
    },
  ]);
  assert.ok(
    toolStrip.notes.some((n) => n.includes("p4_p3_tool_sentence_stripped")),
    "tool sentences strip",
  );
  const strat = String(toolStrip.dimensions[0]?.strategy ?? "");
  assert.ok(!/合同|条款/.test(strat), `strategy must not restore tools: ${strat}`);
  assert.ok(/气口|结界/.test(strat), `Eastern remainder kept: ${strat}`);

  // All-tool strategy must empty, not restore original.
  const allTool = softRepairP4DropP3ToolSentences(
    "用合同条款与股权协议锁死对方承诺。",
  );
  assert.equal(allTool.repaired, true);
  assert.equal(allTool.text, "", "all-tool strategy must not restore original");

  // Strip→thin must surface as tool family, not means_thin (Lab #34).
  {
    const page = {
      page: "metaphysics_action",
      page_title: "t",
      page_subtitle: "s",
      question_anchor: "q",
      desired_outcome: "d",
      dimensions: [
        {
          name: "局势交锋",
          strategy: "守成窗口先封气口。再用合同条款逼对方表态。",
          means: ["气口静默守结界。", "催促场来时藏隐不露锋。"],
          chart_anchors: ["客克主"],
        },
        {
          name: "意象调频",
          strategy: "意象上先静润立界，不入对方催促场。",
          means: ["静润泄燥。", "用技术方案换话语权。"],
          chart_anchors: ["用神水"],
        },
        {
          name: "行为仪轨",
          strategy: "仪轨上以节奏差切断催促场。",
          means: ["空间切断一拍。", "体态收势半步。"],
          chart_anchors: ["值使"],
        },
        {
          name: "站位借势",
          strategy: "借势侧翼，不硬刚虚高。",
          means: ["结界守出手位。", "侧翼观察不入局。"],
          chart_anchors: ["食神"],
        },
        {
          name: "局势近窗",
          strategy: "近窗未到只守成，不跳步。",
          means: ["未熟不拔。", "气口未开先静默。"],
          chart_anchors: ["大运"],
        },
        {
          name: "意象二",
          strategy: "第二意象：立界不跟火阵。",
          means: ["不入火阵。", "静润收势。"],
          chart_anchors: ["忌神火"],
        },
      ],
      leverage: [],
      avoid: [],
      field_matrix: [],
      evidence: [],
    };
    const out = sanitizePageJson("metaphysics_action", page, {
      eastern_calc_slice: "奇门锁盘 客克主 用神水 忌神火 食神 值使",
      deepEvidencePlan: {
        page: "metaphysics_action",
        units: page.dimensions.map((d, i) => ({
          path: `dimensions[${i}]`,
          chart_anchors: d.chart_anchors,
          evidence: "批断",
          unit_claim: "结构主张",
          calc_cite: "摘录",
          means_candidate_ref: "局势1",
          moat_class: i < 2 ? "timing" : i < 4 ? "polarity" : "archetype",
        })),
      },
    });
    assert.equal(out.ok, false);
    assert.equal(
      out.reason,
      "p4_p3_tool_word_family",
      `strip→thin must be tool family, got ${out.reason}`,
    );
    assert.ok(
      out.notes.some((n) => n.includes("p4_means_thin_after_p3_tool_strip")),
      "note thin-after-tool-strip",
    );
  }

  const groundedNotes = noteP4DestinyGrounding({
    strategies: [
      "守成窗口下先静默封气口，以结界守住出手位，不跟虚高声势硬刚。",
      "意象调频：泄燥立界，不入对方催促场。",
    ],
    eastern_calc_slice: "用神水弱 忌神火旺 正官透干",
  });
  assert.ok(
    !groundedNotes.some((n) => n.startsWith("p4_ungrounded_strategy")),
    `vernacular must count as grounded: ${groundedNotes.join("|")}`,
  );
}

console.log("test-p4-means-moat-vernacular: ok");
