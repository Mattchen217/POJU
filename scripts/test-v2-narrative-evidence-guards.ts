/**
 * Offline guards for v2 narrative + evidence (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-narrative-evidence-guards.ts
 */
import fs from "node:fs";
import path from "node:path";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";
import {
  findNarrativeBodyLeak,
  NARRATIVE_TASKS,
  fillFromComputeIfMissing,
  mergeTaskTrees,
} from "@/lib/base-analysis-v2/narrative/narrative-call";
import {
  extractConclusions,
  buildNarrativePrompt,
  pickConclusions,
} from "@/lib/base-analysis-v2/narrative/narrative-prompt";
import {
  findEvidenceLeak,
  polishEvidenceSegment,
  EVIDENCE_TASKS,
  EVIDENCE_TASK_MAX_TOKENS,
} from "@/lib/base-analysis-v2/evidence/evidence-call";
import {
  buildEvidencePrompt,
  pickSegments,
  pickAllSegments,
} from "@/lib/base-analysis-v2/evidence/evidence-prompt";
import {
  SEGMENT_PATHS,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import {
  validateSegmentKeys,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import { parseReadingBlocks, isEvidenceLeadLabel } from "@/lib/reading/parse-reading-blocks";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const emptySeg = (c = "中立结论", b: string[] = ["日主偏旺"]): SegmentComputed => ({
  core_conclusion: c,
  bazi_basis: b,
});

function buildRc(): ReportComputed {
  return {
    energy_map: {
      day_master_nature: emptySeg("你偏沉稳内敛", ["乙木", "日主偏旺"]),
      wuxing_distribution: emptySeg(),
      cognitive_archetype: emptySeg(),
      regulator: emptySeg(),
    },
    work_style: {
      value_creation: emptySeg("靠独立专业输出", ["食神吐秀"]),
      decision_style: emptySeg(),
      focus_drain: emptySeg(),
    },
    interpersonal: {
      comm_archetype: emptySeg(),
      friction_point: emptySeg(),
      synergy: emptySeg(),
    },
    phase_states: {
      baseline: emptySeg(),
      rest_phase: emptySeg(),
      peak_phase: emptySeg(),
      transition_phase: emptySeg(),
    },
    retune: {
      color: emptySeg(),
      space: emptySeg(),
      habits: emptySeg(),
      awareness: emptySeg(),
    },
    summary: {
      keywords: ["沉稳", "专业"],
      current_theme: "蓄能",
      dos: ["1", "2", "3"],
      donts: ["a", "b", "c"],
      card_basis: emptySeg("一页纸抓手", ["正印", "食神"]),
    },
  };
}

function fillTree(text: string): ReportSegmentTextTree {
  const rc = buildRc();
  const conclusions = extractConclusions(rc);
  const walk = (o: unknown): unknown => {
    if (typeof o === "string") return text;
    if (Array.isArray(o)) return o;
    if (o && typeof o === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o as object)) out[k] = walk((o as Record<string, unknown>)[k]);
      return out;
    }
    return o;
  };
  return walk(conclusions) as ReportSegmentTextTree;
}

// —— extractConclusions: 只 SEGMENT_PATHS，去掉 bazi_basis / dos / keywords ——
{
  const c = extractConclusions(buildRc());
  const dm = (c.energy_map as Record<string, unknown>).day_master_nature;
  assert("结论树是字符串(非对象)", typeof dm === "string");
  assert("结论树不含 bazi_basis 字面", !JSON.stringify(c).includes("bazi_basis"));
  assert(
    "结论树不含 keywords（不经第2次）",
    !JSON.stringify(c).includes("keywords"),
  );
  assert(
    "结论树不含 dos/donts",
    !JSON.stringify(c).includes('"dos"') && !JSON.stringify(c).includes('"donts"'),
  );
  assert(
    "card_basis 已压成字符串",
    typeof (c.summary as Record<string, unknown>).card_basis === "string",
  );
}

// —— validateSegmentKeys ——
{
  const good = fillTree("一段通顺的白话正文，没有术语。");
  assert("齐结构通过", validateSegmentKeys(good, "narrative") === null);

  const bad = structuredClone(good);
  bad.work_style.value_creation = "   ";
  assert(
    "空段失败",
    validateSegmentKeys(bad, "narrative")?.includes("work_style.value_creation") === true,
  );

  const nestedWrong = {
    energy_map: {
      day_master_nature: { core_conclusion: "x", bazi_basis: ["y"] },
    },
  };
  assert(
    "嵌套双钥匙对象失败",
    validateSegmentKeys(nestedWrong, "evidence")?.includes("missing/empty") === true,
  );
}

// —— narrative body leaks ——
{
  assert(
    "干净正文无泄漏",
    findNarrativeBodyLeak(fillTree("你做事沉稳，靠专业把事情做透。"), "zh") === null,
  );
  assert(
    "抓角引号",
    findNarrativeBodyLeak(fillTree("你擅长「精准释放」能量。"), "zh")?.includes("角引号") === true,
  );
  assert(
    "抓标记",
    findNarrativeBodyLeak(fillTree("你需要 ⟦t:yong_shen|⟧ 来稳住。"), "zh")?.includes("标记") ===
      true,
  );
  assert(
    "抓命理词",
    findNarrativeBodyLeak(fillTree("你的日主偏旺，所以要养。"), "zh")?.includes("日主") === true,
  );
}

// —— evidence polish + leaks ——
{
  const polished = polishEvidenceSegment("原局见食神吐秀，日主偏旺。", "zh");
  assert("打标器补标", polished.includes("⟦t:"));
  assert(
    "依据中间态保持空槽(不填锚元)",
    /⟦t:[a-z0-9_:]+\|⟧/.test(polishEvidenceSegment("因 ⟦t:shi_shen|⟧ 吐秀。", "zh")),
  );
  assert(
    "不预填软译金字",
    !polishEvidenceSegment("因 ⟦t:shi_shen|⟧ 吐秀。", "zh").includes("流展") &&
      !polishEvidenceSegment("因 ⟦t:yong_shen|⟧ 制衡。", "zh").includes("锚元"),
  );
  const cleanEv = fillTree(
    polishEvidenceSegment("因 ⟦t:shi_shen|⟧ 吐秀，格局偏向独立输出。", "zh"),
  );
  // 关系词统一打标（不再白话放行）
  const relPolished = polishEvidenceSegment(
    "年月相刑形成张力，但不改结论方向。",
    "zh",
  );
  assert("关系词相刑已打标", /⟦t:[a-z0-9_:]+\|/.test(relPolished));
  assert(
    "关系词打标后无泄漏",
    findEvidenceLeak(fillTree(relPolished), "zh") === null,
  );

  assert("干净依据(已打标)无泄漏", findEvidenceLeak(cleanEv, "zh") === null);

  assert(
    "抓时间锚",
    findEvidenceLeak(fillTree("2026年进入调整。"), "zh")?.includes("时间锚") === true,
  );
  assert(
    "抓简称",
    findEvidenceLeak(fillTree("官杀混杂导致压力。"), "zh")?.includes("简称") === true,
  );

  assert(
    "去重 日主+标记",
    polishEvidenceSegment("日主⟦t:day_master|⟧偏弱", "zh") === "⟦t:day_master|⟧偏弱",
  );
  {
    const shi = polishEvidenceSegment("丁火食神⟦t:shi_shen|⟧吐秀", "zh");
    assert("去重 食神+标记 无残留真词", !shi.includes("食神") && shi.includes("⟦t:shi_shen|⟧"));
  }
  assert(
    "去重 伤官+标记",
    polishEvidenceSegment("巳火伤官⟦t:shang_guan|⟧", "zh") === "巳火⟦t:shang_guan|⟧" ||
      (!polishEvidenceSegment("巳火伤官⟦t:shang_guan|⟧", "zh").includes("伤官") &&
        polishEvidenceSegment("巳火伤官⟦t:shang_guan|⟧", "zh").includes("⟦t:shang_guan|⟧")),
  );
  assert(
    "去重 年干+标记",
    polishEvidenceSegment("年干⟦t:pl_year_stem|⟧透出", "zh") === "⟦t:pl_year_stem|⟧透出",
  );

  {
    const dense =
      "日主为乙木，得正印壬水生扶，食神透出，伤官泄秀，偏财被克。";
    const allMarked = polishEvidenceSegment(dense, "zh");
    const markCount = (allMarked.match(/⟦t:/g) ?? []).length;
    assert("依据取消每段2个上限(≥4标)", markCount >= 4);
    assert(
      "依据承重词全打无裸十神",
      !/(日主|正印|食神|伤官|偏财)/.test(allMarked.replace(/⟦[^⟧]*⟧/g, "")),
    );
  }
  {
    const pillar = polishEvidenceSegment("年干透出壬水，日支藏根。", "zh");
    assert("柱位年干打标", pillar.includes("⟦t:pl_year_stem|"));
    assert("柱位日支打标", pillar.includes("⟦t:pl_day_branch|"));
    assert("裸年干已清", !pillar.replace(/⟦[^⟧]*⟧/g, "").includes("年干"));
  }
  {
    const bodyDefault = autoMarkBareTerms(
      "日主偏旺，食神吐秀，正印生扶，伤官泄秀。",
      "zh",
    );
    const bodyMarks = (bodyDefault.match(/⟦t:/g) ?? []).length;
    assert("正文默认仍限流≤2", bodyMarks <= 2);
  }
}

// —— prompts: slug 空槽 + 结论不含 basis ——
{
  const conclusions = extractConclusions(buildRc());
  const np = buildNarrativePrompt(conclusions, "zh");
  assert("narrative system 禁角引号", np.system.includes("「」"));
  assert(
    "narrative system 纠正术语假设",
    np.system.includes("可能包含命理术语"),
  );
  assert("narrative user 无 bazi_basis", !np.user.includes("bazi_basis"));
  assert("narrative user 无 dos 数组", !np.user.includes('"dos"'));
  assert("narrative 无纠错段落", !np.user.includes("纠错"));

  const ep = buildEvidencePrompt(pickAllSegments(buildRc()), "zh");
  assert("evidence 注入打标块", ep.system.includes("⟦t:<slug>|⟧"));
  assert("evidence 明示竖线后留空", ep.system.includes("竖线后留空") || ep.system.includes("后面留空"));
  assert("evidence ZH 要求中文输出", ep.system.includes("整段依据用中文写"));
  assert("evidence 标记代替真词", ep.system.includes("标记【代替】真词") || ep.system.includes("代替】那个词"));
  assert("evidence 最短完整承重链", ep.system.includes("最短完整承重链"));
  assert("evidence 出现就打标", ep.system.includes("出现就打标") || ep.system.includes("一律打标"));
  assert("evidence 无2-4句锚定", !ep.system.includes("2-4 句"));
  assert("evidence user 含双钥匙", ep.user.includes("bazi_basis") && ep.user.includes("core_conclusion"));
  assert("evidence user 无 dos", !ep.user.includes('"dos"'));
  assert("evidence 无纠错段落", !ep.user.includes("纠错"));

  const epEn = buildEvidencePrompt(pickAllSegments(buildRc()), "en");
  assert("evidence en locale 仍用中文 system", epEn.system === ep.system);
  assert("evidence en locale 仍用中文 user 骨架", epEn.user.includes("命理依据真词"));
  assert("evidence 无 Write entirely in English", !epEn.system.includes("Write the entire explanation in English"));

  const energyOnly = pickSegments(buildRc(), EVIDENCE_TASKS[0]!.paths);
  assert(
    "pickSegments 只含 energy_map",
    Object.keys(energyOnly).length === 1 && "energy_map" in energyOnly,
  );
  assert("EVIDENCE_TASK_MAX_TOKENS=16000", EVIDENCE_TASK_MAX_TOKENS === 16_000);
  assert(
    "EVIDENCE_TASKS 与 NARRATIVE 同分组",
    EVIDENCE_TASKS.map((t) => t.paths.length).join(",") === "4,6,4,5",
  );
}

// —— 锁 TTL + 去重 pending + job 幂等（防跑两遍）——
{
  const root = process.cwd();
  const kv = fs.readFileSync(path.join(root, "lib/kv/client.ts"), "utf8");
  const route = fs.readFileSync(
    path.join(root, "app/api/profile/base-analysis-v2/stream/route.ts"),
    "utf8",
  );
  const evidence = fs.readFileSync(
    path.join(root, "lib/base-analysis-v2/evidence/evidence-call.ts"),
    "utf8",
  );
  assert(
    "锁 TTL=45min",
    /BASE_ANALYSIS_LOCK:\s*60\s*\*\s*45/.test(kv),
  );
  assert("去重含 pending", route.includes('"pending"') && route.includes("ACTIVE_STATUSES"));
  assert("runV2Job 幂等跳过", route.includes("跳过重复执行"));
  assert(
    "v2 route 填软译 forceSsot",
    route.includes("forceSsotPlainInMarkers"),
  );
  assert(
    "v2 gate 观测不 failJob",
    route.includes("不重跑,已清洗放行") && !/failJob\(job_id,\s*"delivery_gate_failed"/.test(route),
  );
  assert("v2 gate skipEvidenceProse", route.includes("skipEvidenceProse"));
  const rich = fs.readFileSync(
    path.join(root, "components/cross-product/RichReadingText.tsx"),
    "utf8",
  );
  assert(
    "dualLayer 丢弃孤立依据",
    rich.includes("直接丢弃") && !rich.includes("孤立依据（前无正文）仍单独渲染"),
  );
  assert("dualLayer 无正文整段丢弃", rich.includes("只有落单依据"));
  assert(
    "依据不 reflow 拆多段",
    rich.includes("reading-p--evidence") && !/EvidenceBlock[\s\S]{0,200}bodyChunks\.map/.test(rich),
  );
  assert(
    "evidence prompt 五行例外",
    fs
      .readFileSync(path.join(root, "lib/base-analysis-v2/evidence/evidence-prompt.ts"), "utf8")
      .includes("五行例外"),
  );
  assert(
    "evidence 4-Task 并发",
    evidence.includes("EVIDENCE_TASKS") && evidence.includes("Promise.all"),
  );
  assert(
    "evidence polish 接 wrapBarePillars + 全打",
    evidence.includes("wrapBarePillars") &&
      evidence.includes("maxPerPara: Infinity") &&
      evidence.includes("oncePerText: false"),
  );
  assert("evidence 接 wrapBareRelations", evidence.includes("wrapBareRelations"));
  assert(
    "v2 route 旁路 collect",
    route.includes("collectUnmarkedMingliCandidates"),
  );
  assert(
    "evidence 单Task 16000",
    evidence.includes("V2_OUTPUT_MAX_TOKENS") &&
      /EVIDENCE_TASK_MAX_TOKENS\s*=\s*V2_OUTPUT_MAX_TOKENS/.test(evidence),
  );
}

// —— 4 Task 分组：19 段无遗漏无重叠 ——
{
  const all = NARRATIVE_TASKS.flatMap((t) => [...t.paths]);
  assert("4 Task", NARRATIVE_TASKS.length === 4);
  assert("合计 19 段", all.length === 19);
  assert(
    "与 SEGMENT_PATHS 一致",
    all.length === SEGMENT_PATHS.length &&
      SEGMENT_PATHS.every((p) => all.includes(p)),
  );
  assert("无重复", new Set(all).size === all.length);
  assert(
    "Task sizes 4+6+4+5",
    NARRATIVE_TASKS.map((t) => t.paths.length).join(",") === "4,6,4,5",
  );
  const pick = pickConclusions(buildRc(), NARRATIVE_TASKS[0]!.paths);
  assert(
    "pickConclusions 只含 energy_map",
    Object.keys(pick).length === 1 && "energy_map" in pick,
  );
}

// —— 合并缺段用 core_conclusion 兜底 ——
{
  const rc = buildRc();
  const partial = mergeTaskTrees([
    {
      energy_map: {
        day_master_nature: "扩写后的日主正文",
      },
    },
  ]);
  const filled = fillFromComputeIfMissing(partial, rc, "zh");
  assert(
    "已有段保留",
    filled.energy_map.day_master_nature === "扩写后的日主正文",
  );
  assert(
    "缺段用 core_conclusion",
    filled.work_style.value_creation === "靠独立专业输出",
  );
  assert(
    "不是暂缺废话",
    !filled.work_style.value_creation.includes("暂缺"),
  );
}

// —— 前端 1:1：依据不吞下一段正文 ——
{
  const md = [
    "你偏沉稳内敛，做事不急。",
    "",
    "**依据与推理:**",
    "因 ⟦t:day_master|⟧ 偏稳。",
    "",
    "五行里火最旺，整体偏旺。",
    "",
    "**依据与推理:**",
    "因 ⟦t:wuxing|⟧ 火旺。",
  ].join("\n");
  const blocks = parseReadingBlocks(md, { layout: false });
  const ps = blocks.filter((b) => b.type === "p");
  const leads = blocks.filter(
    (b) => b.type === "lead" && isEvidenceLeadLabel(b.label),
  );
  assert("两段正文都在", ps.length === 2);
  assert("两段依据都在", leads.length === 2);
  assert(
    "第一段依据未吞第二段正文",
    leads[0]!.type === "lead" &&
      !leads[0]!.body.includes("五行里火最旺"),
  );
}

console.log(failures.length ? "❌ narrative/evidence guards failed" : "✅ narrative/evidence guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
