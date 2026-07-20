/**
 * Offline guards for v2 narrative + evidence (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-narrative-evidence-guards.ts
 */
import { findNarrativeBodyLeak } from "@/lib/base-analysis-v2/narrative/narrative-call";
import { extractConclusions, buildNarrativePrompt } from "@/lib/base-analysis-v2/narrative/narrative-prompt";
import {
  findEvidenceLeak,
  polishEvidenceSegment,
} from "@/lib/base-analysis-v2/evidence/evidence-call";
import { buildEvidencePrompt } from "@/lib/base-analysis-v2/evidence/evidence-prompt";
import type { ReportComputed, SegmentComputed } from "@/lib/base-analysis-v2/report-schema";
import {
  validateSegmentKeys,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";

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

// —— extractConclusions: 去掉 bazi_basis ——
{
  const c = extractConclusions(buildRc());
  const dm = (c.energy_map as Record<string, unknown>).day_master_nature;
  assert("结论树是字符串(非对象)", typeof dm === "string");
  assert("结论树不含 bazi_basis 字面", !JSON.stringify(c).includes("bazi_basis"));
  assert("结论树保留 summary.keywords", Array.isArray((c.summary as Record<string, unknown>).keywords));
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
  assert("forceSsot 后无空槽裸竖线残留可渲染", polished.includes("⟦t:"));

  const cleanEv = fillTree(
    polishEvidenceSegment("因 ⟦t:shi_shen|⟧ 吐秀，格局偏向独立输出。", "zh"),
  );
  // 关系白话允许
  const withRel = fillTree("年月相刑形成张力，但不改结论方向。");
  assert("相刑白话放行", findEvidenceLeak(withRel, "zh") === null);

  assert("干净依据(已打标)无泄漏", findEvidenceLeak(cleanEv, "zh") === null);

  assert(
    "抓时间锚",
    findEvidenceLeak(fillTree("2026年进入调整。"), "zh")?.includes("时间锚") === true,
  );
  assert(
    "抓简称",
    findEvidenceLeak(fillTree("官杀混杂导致压力。"), "zh")?.includes("简称") === true,
  );
}

// —— prompts: slug 空槽 + 结论不含 basis ——
{
  const np = buildNarrativePrompt(buildRc(), "zh");
  assert("narrative system 禁角引号", np.system.includes("「」"));
  assert("narrative user 无 bazi_basis", !np.user.includes("bazi_basis"));
  assert(
    "narrative retryHint 拼入 user",
    buildNarrativePrompt(buildRc(), "zh", "测试纠错").user.includes("测试纠错"),
  );

  const ep = buildEvidencePrompt(buildRc(), "zh");
  assert("evidence 注入打标块", ep.system.includes("⟦t:<slug>|⟧"));
  assert("evidence 明示竖线后留空", ep.system.includes("竖线后留空") || ep.system.includes("后面留空"));
  assert("evidence user 含双钥匙", ep.user.includes("bazi_basis") && ep.user.includes("core_conclusion"));
  assert(
    "evidence retryHint 拼入 user",
    buildEvidencePrompt(buildRc(), "zh", "依据纠错").user.includes("依据纠错"),
  );
}

console.log(failures.length ? "❌ narrative/evidence guards failed" : "✅ narrative/evidence guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
