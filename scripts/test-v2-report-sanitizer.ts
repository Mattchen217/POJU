/**
 * Unit tests: Layer-2 Ten-God abbreviation sanitizer + Layer-3 simp leak.
 *   pnpm exec tsx scripts/test-v2-report-sanitizer.ts
 */
import { cleanText, cleanReportComputed } from "@/lib/base-analysis-v2/compute/report-sanitizer";
import { extractTenGodContext, type TenGodContext } from "@/lib/base-analysis-v2/compute/ten-god-context";
import { findSimpLeak, SIMP_RE } from "@/lib/base-analysis-v2/compute/compute-call";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { ReportComputed, SegmentComputed } from "@/lib/base-analysis-v2/report-schema";

const failures: string[] = [];
const assert = (label: string, ok: boolean, detail?: string) => {
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail && !ok ? ` (${detail})` : ""}`);
};

const shiShenOnly: TenGodContext = {
  hasZhengGuan: false,
  hasQiSha: false,
  hasShiShen: true,
  hasShangGuan: false,
  hasBiJian: false,
  hasJieCai: false,
  hasZhengYin: false,
  hasPianYin: false,
};

const bothGuanSha: TenGodContext = {
  hasZhengGuan: true,
  hasQiSha: true,
  hasShiShen: false,
  hasShangGuan: false,
  hasBiJian: false,
  hasJieCai: false,
  hasZhengYin: false,
  hasPianYin: false,
};

const emptyCtx: TenGodContext = {
  hasZhengGuan: false,
  hasQiSha: false,
  hasShiShen: false,
  hasShangGuan: false,
  hasBiJian: false,
  hasJieCai: false,
  hasZhengYin: false,
  hasPianYin: false,
};

// Case 1: only 食神 → 食伤 expands to 食神 (not 食神与伤官)
{
  const out = cleanText("原局食伤生财，才华外显", shiShenOnly);
  assert("仅食神：食伤→食神", out === "原局食神生财，才华外显", out);
}

// Case 2: both 正官+七杀 → 官杀 → 正官与七杀
{
  const out = cleanText("官杀混杂，压力较大", bothGuanSha);
  assert("官杀双现：→正官与七杀", out === "正官与七杀混杂，压力较大", out);
}

// Nested JSON deep clean
{
  const emptySeg = (): SegmentComputed => ({
    core_conclusion: "x",
    bazi_basis: ["日主偏旺"],
  });
  const dirty: ReportComputed = {
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
      keywords: ["官杀制衡"],
      current_theme: "食伤泄秀阶段",
      dos: ["借比劫协作"],
      donts: ["印枭过重"],
      card_basis: {
        core_conclusion: "官杀有制",
        bazi_basis: ["食伤生财", "比劫帮身"],
      },
    },
  };
  const cleaned = cleanReportComputed(dirty, {
    ...emptyCtx,
    hasZhengGuan: true,
    hasQiSha: false,
    hasShiShen: true,
    hasShangGuan: false,
    hasBiJian: true,
    hasJieCai: false,
    hasZhengYin: false,
    hasPianYin: true,
  });
  assert(
    "嵌套 keywords 清洗",
    cleaned.summary.keywords[0] === "正官制衡",
    String(cleaned.summary.keywords[0]),
  );
  assert(
    "嵌套 current_theme 清洗",
    cleaned.summary.current_theme === "食神泄秀阶段",
    cleaned.summary.current_theme,
  );
  assert(
    "嵌套 bazi_basis 清洗",
    cleaned.summary.card_basis.bazi_basis[0] === "食神生财" &&
      cleaned.summary.card_basis.bazi_basis[1] === "比肩帮身",
    cleaned.summary.card_basis.bazi_basis.join("|"),
  );
  assert("嵌套 印枭→偏印", cleaned.summary.donts[0] === "偏印过重", cleaned.summary.donts[0]);
}

// Layer-3: 杀印 escapes Layer-2 (no dynamic expand) → findSimpLeak catches
{
  const emptySeg = (): SegmentComputed => ({
    core_conclusion: "ok",
    bazi_basis: ["杀印相生"],
  });
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
      keywords: ["a"],
      current_theme: "ok",
      dos: ["1", "2", "3"],
      donts: ["a", "b", "c"],
      card_basis: emptySeg(),
    },
  };
  assert("SIMP_RE 命中杀印", SIMP_RE.test("杀印相生"));
  const leak = findSimpLeak(rc);
  assert(
    "findSimpLeak 抓杀印",
    leak !== null && leak.includes("杀印"),
    leak ?? "null",
  );
}

// After Layer-2 clean of 官杀, findSimpLeak should be clean
{
  const emptySeg = (): SegmentComputed => ({
    core_conclusion: "ok",
    bazi_basis: ["官杀混杂"],
  });
  const dirty: ReportComputed = {
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
      keywords: ["a"],
      current_theme: "ok",
      dos: ["1", "2", "3"],
      donts: ["a", "b", "c"],
      card_basis: emptySeg(),
    },
  };
  const cleaned = cleanReportComputed(dirty, bothGuanSha);
  assert("清洗后无简称泄漏", findSimpLeak(cleaned) === null, findSimpLeak(cleaned) ?? "");
}

// extractTenGodContext from pillars_detail
{
  const structured = {
    day_master: "丁",
    pattern: "伤官生财",
    yong_shen: "wood",
    xi_shen: [],
    ji_shen: [],
    strength: "weak",
    four_pillars: { year: "戊午", month: "辛酉", day: "丁丑", hour: "辛丑" },
    pillars_detail: {
      year: { ganzhi: "戊午", stem: "戊", branch: "午", ten_god: "伤官", hidden_stems: [], shen_sha: [] },
      month: { ganzhi: "辛酉", stem: "辛", branch: "酉", ten_god: "偏财", hidden_stems: [], shen_sha: [] },
      day: { ganzhi: "丁丑", stem: "丁", branch: "丑", ten_god: "日主", hidden_stems: [], shen_sha: [] },
      hour: { ganzhi: "辛丑", stem: "辛", branch: "丑", ten_god: "偏财", hidden_stems: [], shen_sha: [] },
    },
    da_yun: [],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
  } satisfies ProfileStructured;
  const ctx = extractTenGodContext(structured);
  assert("extract: 伤官 from pillar+pattern", ctx.hasShangGuan === true);
  assert("extract: 无食神", ctx.hasShiShen === false);
  const expanded = cleanText("食伤泄秀", ctx);
  assert("有伤官无食神→伤官", expanded === "伤官泄秀", expanded);
}

console.log(failures.length ? "❌ sanitizer tests failed" : "✅ sanitizer + simp leak ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
