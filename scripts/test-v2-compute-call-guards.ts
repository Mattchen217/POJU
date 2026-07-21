/**
 * Offline guards for v2 compute-call helpers (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-compute-call-guards.ts
 */
import {
  extractJson,
  findSimpLeak,
  findTimeAnchorLeak,
  SIMP_RE,
  TIME_ANCHOR_RE,
} from "@/lib/base-analysis-v2/compute/compute-call";
import { buildComputePrompt } from "@/lib/base-analysis-v2/compute/compute-prompt";
import {
  SEGMENT_PATHS,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import { cleanText } from "@/lib/base-analysis-v2/compute/report-sanitizer";
import type { TenGodContext } from "@/lib/base-analysis-v2/compute/ten-god-context";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const emptySeg = (): SegmentComputed => ({
  core_conclusion: "中立结论",
  bazi_basis: ["日主偏旺"],
});

function buildRc(patch?: (rc: ReportComputed) => void): ReportComputed {
  const rc: ReportComputed = {
    energy_map: {
      day_master_nature: emptySeg(),
      wuxing_distribution: emptySeg(),
      cognitive_archetype: emptySeg(),
      regulator: emptySeg(),
    },
    work_style: {
      value_creation: emptySeg(),
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
      keywords: ["a", "b"],
      current_theme: "settling",
      dos: ["1", "2", "3"],
      donts: ["a", "b", "c"],
      card_basis: emptySeg(),
    },
  };
  patch?.(rc);
  return rc;
}

// extractJson: tolerate preamble
{
  const parsed = extractJson('thinking...\n{"a":1,"b":{"c":2}}\ntrailing');
  assert("extractJson 抓最外层", JSON.stringify(parsed) === '{"a":1,"b":{"c":2}}');
}

// TIME_ANCHOR_RE: block vs allow
const mustBlock = ["2026年", "35岁", "丙午大运", "丙午流年", "虚岁35", "第三步大运", "二〇二六年", "交运", "起运"];
const mustAllow = ["大运逢印", "流年引动", "岁运相冲", "日主偏旺", "喜神"];
for (const s of mustBlock) {
  assert(`禁时间锚:${s}`, TIME_ANCHOR_RE.test(s));
}
for (const s of mustAllow) {
  assert(`放行中性:${s}`, !TIME_ANCHOR_RE.test(s));
}

assert("干净盘无泄漏", findTimeAnchorLeak(buildRc()) === null);
assert(
  "结论泄漏可定位",
  findTimeAnchorLeak(
    buildRc((rc) => {
      rc.phase_states.peak_phase = {
        core_conclusion: "当你感到顺畅时推决策，尤其2026年",
        bazi_basis: ["日主偏旺"],
      };
    }),
  ) === "phase_states.peak_phase.core_conclusion",
);
assert(
  "依据泄漏可定位",
  findTimeAnchorLeak(
    buildRc((rc) => {
      rc.retune.habits = {
        core_conclusion: "当你感到耗损时减负",
        bazi_basis: ["丙午大运"],
      };
    }),
  )?.startsWith("retune.habits.bazi_basis:") === true,
);
assert(
  "中性运势词不误杀",
  findTimeAnchorLeak(
    buildRc((rc) => {
      rc.phase_states.rest_phase = {
        core_conclusion: "当你感到阻力增多时深耕",
        bazi_basis: ["大运逢印", "流年引动", "岁运相冲"],
      };
    }),
  ) === null,
);

assert("SEGMENT_PATHS=19", SEGMENT_PATHS.length === 19);

// Layer-3 simp leak
assert("SIMP_RE 官杀", SIMP_RE.test("官杀混杂"));
assert("SIMP_RE 不误伤正官", !SIMP_RE.test("正官透干"));
assert(
  "简称泄漏可定位",
  findSimpLeak(
    buildRc((rc) => {
      rc.work_style.value_creation = {
        core_conclusion: "靠专业输出",
        bazi_basis: ["食伤生财"],
      };
    }),
  )?.includes("食伤") === true,
);
assert(
  "干净盘无简称",
  findSimpLeak(
    buildRc((rc) => {
      rc.work_style.value_creation = {
        core_conclusion: "靠专业输出",
        bazi_basis: ["食神生财"],
      };
    }),
  ) === null,
);

const ctxQiShaOnly: TenGodContext = {
  hasZhengGuan: false,
  hasQiSha: true,
  hasShiShen: false,
  hasShangGuan: false,
  hasBiJian: false,
  hasJieCai: false,
  hasZhengYin: false,
  hasPianYin: false,
};
assert("L2 仅七杀：官杀→七杀", cleanText("官杀攻身", ctxQiShaOnly) === "七杀攻身");

{
  const { system: zhSys } = buildComputePrompt({} as ProfileStructured, "zh");
  const { system: enSys } = buildComputePrompt({} as ProfileStructured, "en");
  assert("COMPUTE 永远中文 system", zhSys.includes("你是一位有三十年经验的命理分析师"));
  assert("COMPUTE en locale 仍用中文 prompt", enSys === zhSys);
  assert("COMPUTE 无 Summary block language 英分叉", !enSys.includes("# Summary block language"));
}

console.log(failures.length ? "❌ compute-call guards failed" : "✅ compute-call guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
