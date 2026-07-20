/**
 * Offline guards for v2 compute-call helpers (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-compute-call-guards.ts
 */
import {
  extractJson,
  findTimeAnchorLeak,
  TIME_ANCHOR_RE,
} from "@/lib/base-analysis-v2/compute/compute-call";
import {
  SEGMENT_PATHS,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";

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

console.log(failures.length ? "❌ compute-call guards failed" : "✅ compute-call guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
