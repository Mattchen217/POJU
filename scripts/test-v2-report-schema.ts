/**
 * Guard: ReportComputed SSOT validator + SEGMENT_PATHS lock.
 * Run: pnpm exec tsx scripts/test-v2-report-schema.ts
 */
import {
  SEGMENT_PATHS,
  validateReportComputed,
  type ReportComputed,
  type SegmentComputed,
  type SegmentPath,
} from "@/lib/base-analysis-v2/report-schema";
import { REPORT_COMPUTED_JSON_SKELETON } from "@/lib/base-analysis-v2/compute/compute-prompt";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const emptySeg = (): SegmentComputed => ({
  core_conclusion: "x",
  bazi_basis: ["a"],
});

function buildGood(): ReportComputed {
  const good: ReportComputed = {
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
      keywords: ["focus", "depth"],
      current_theme: "settling before expansion",
      dos: ["deep work blocks"],
      donts: ["scatter across too many fronts"],
      card_basis: emptySeg(),
    },
  };
  return good;
}

const good = buildGood();
const goodResult = validateReportComputed(good);
assert("完整对象通过", goodResult.ok === true);

assert("缺段被拦", validateReportComputed({}).ok === false);
{
  const empty = validateReportComputed({});
  assert(
    "空对象 fatal",
    empty.ok === false && empty.severity === "fatal",
  );
}
assert("段路径数=19", SEGMENT_PATHS.length === 19);

const missingSeg = structuredClone(good) as ReportComputed;
const energyMapHole = missingSeg.energy_map as unknown as Record<string, unknown>;
delete energyMapHole.regulator;
const missingResult = validateReportComputed(missingSeg);
assert(
  "删一段 soft(不废整份)",
  missingResult.ok === false &&
    missingResult.severity === "soft" &&
    missingResult.reason.includes("energy_map.regulator"),
);

const emptyConclusion = structuredClone(good) as ReportComputed;
emptyConclusion.work_style.value_creation = { core_conclusion: "  ", bazi_basis: ["食神"] };
assert(
  "空 core_conclusion 被拦",
  validateReportComputed(emptyConclusion).ok === false,
);

const emptyBasis = structuredClone(good) as ReportComputed;
emptyBasis.interpersonal.synergy = { core_conclusion: "ok", bazi_basis: [] };
assert("空 bazi_basis 被拦", validateReportComputed(emptyBasis).ok === false);

const incompleteSummary = structuredClone(good) as ReportComputed;
incompleteSummary.summary = {
  ...incompleteSummary.summary,
  keywords: [],
};
assert("summary 缺 keywords 被拦", validateReportComputed(incompleteSummary).ok === false);

// Skeleton field names must match SEGMENT_PATHS + summary top-level keys
const skeletonRoot = JSON.parse(REPORT_COMPUTED_JSON_SKELETON) as unknown;
assert("骨架是对象", !!skeletonRoot && typeof skeletonRoot === "object");
const skeleton = skeletonRoot as Record<string, unknown>;
for (const path of SEGMENT_PATHS) {
  const [modKey, segKey] = path.split(".");
  const mod = skeleton[modKey!] as Record<string, unknown> | undefined;
  const seg = mod?.[segKey!];
  assert(
    `骨架含段 ${path}`,
    !!seg && typeof seg === "object" && "core_conclusion" in (seg as object) && "bazi_basis" in (seg as object),
  );
}
const summary = skeleton.summary as Record<string, unknown> | undefined;
assert("骨架含 summary.keywords", Array.isArray(summary?.keywords));
assert("骨架含 summary.current_theme", typeof summary?.current_theme === "string");
assert("骨架含 summary.dos", Array.isArray(summary?.dos));
assert("骨架含 summary.donts", Array.isArray(summary?.donts));

// Exhaustiveness: every path is a known SegmentPath (runtime mirror of the const)
const pathSet = new Set<string>(SEGMENT_PATHS);
assert(
  "SEGMENT_PATHS 无重复",
  pathSet.size === SEGMENT_PATHS.length,
);
const typedPaths: SegmentPath[] = [...SEGMENT_PATHS];
assert("SegmentPath 可赋值自 SEGMENT_PATHS", typedPaths.length === 19);

console.log(failures.length ? "❌ schema 校验器未就绪" : "✅ schema 校验器就绪");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
