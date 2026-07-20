/**
 * Offline guards for v2 orchestrate merge (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-orchestrate-guards.ts
 */
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
import { isEvidenceLeadLabel, parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";
import {
  mergeToMarkdown,
  renderSummaryCard,
  SECTION_LAYOUT,
  seg,
} from "@/lib/base-analysis-v2/orchestrate/run-report";
import type { ReportComputed, SegmentComputed } from "@/lib/base-analysis-v2/report-schema";
import { extractConclusions } from "@/lib/base-analysis-v2/narrative/narrative-prompt";
import type { ReportSegmentTextTree } from "@/lib/base-analysis-v2/segment-text";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const emptySeg = (c = "结论", b: string[] = ["日主偏旺"]): SegmentComputed => ({
  core_conclusion: c,
  bazi_basis: b,
});

function buildRc(): ReportComputed {
  return {
    energy_map: {
      day_master_nature: emptySeg("你偏沉稳"),
      wuxing_distribution: emptySeg("木旺水足"),
      cognitive_archetype: emptySeg("深度思考"),
      regulator: emptySeg("需要滋养"),
    },
    work_style: {
      value_creation: emptySeg("独立输出"),
      decision_style: emptySeg("稳健决策"),
      focus_drain: emptySeg("怕打断"),
    },
    interpersonal: {
      comm_archetype: emptySeg("少说多做"),
      friction_point: emptySeg("怕冲突"),
      synergy: emptySeg("配行动派"),
    },
    phase_states: {
      baseline: emptySeg("底色稳"),
      rest_phase: emptySeg("蓄能时"),
      peak_phase: emptySeg("高能时"),
      transition_phase: emptySeg("调整时"),
    },
    retune: {
      color: emptySeg("偏青"),
      space: emptySeg("安静角"),
      habits: emptySeg("早起写"),
      awareness: emptySeg("别硬撑"),
    },
    summary: {
      keywords: ["沉稳", "专业", "蓄能"],
      current_theme: "把专业做深",
      dos: ["独处充电", "一次一事", "写下来"],
      donts: ["多线并行", "硬撑社交", "空谈"],
      card_basis: emptySeg("一页纸抓手", ["正印", "食神"]),
    },
  };
}

function fillTree(prefix: string): ReportSegmentTextTree {
  const conclusions = extractConclusions(buildRc());
  const walk = (o: unknown, path: string): unknown => {
    if (typeof o === "string") return `${prefix}:${path}:${o}`;
    if (Array.isArray(o)) return o;
    if (o && typeof o === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o as object)) {
        const next = path ? `${path}.${k}` : k;
        out[k] = walk((o as Record<string, unknown>)[k], next);
      }
      return out;
    }
    return o;
  };
  return walk(conclusions, "") as ReportSegmentTextTree;
}

{
  assert("SECTION_LAYOUT 覆盖 6 模块", SECTION_LAYOUT.length === 6);
  const pathCount = SECTION_LAYOUT.reduce((n, s) => n + s.paths.length, 0);
  assert("SECTION_LAYOUT 路径=19", pathCount === 19);
}

{
  const rc = buildRc();
  const narrative = fillTree("BODY");
  const evidence = fillTree("EV");
  // 依据用带标记的固定串覆盖几处，保证 dualLayer 可识别
  evidence.energy_map.day_master_nature = "因 ⟦t:day_master|⟧ 偏稳。";
  evidence.summary.card_basis = "抓手在 ⟦t:zheng_yin|⟧ 与 ⟦t:shi_shen|⟧。";

  const md = mergeToMarkdown(rc, narrative, evidence, "zh");

  assert("含 6 个 ##", (md.match(/^## /gm) ?? []).length === 6);
  assert("关键词来自 rc", md.includes("**关键词:**") && md.includes("沉稳"));
  assert("dos 来自 rc", md.includes("独处充电"));
  assert("donts 来自 rc", md.includes("多线并行"));
  assert("卡片依据有金字", md.includes("⟦t:zheng_yin|⟧"));
  assert("常规段正文保留", md.includes("BODY:energy_map.day_master_nature"));
  assert("常规段依据折叠", md.includes("**依据与推理:**"));
  // 正文与依据块之间有空行；标签后紧跟依据（无空行）
  assert(
    "正文与依据块分段",
    /BODY:energy_map\.day_master_nature:[^\n]+\n\n\*\*依据与推理:\*\*\n/.test(md),
  );

  const sections = parseBaseAnalysisSections(md);
  assert("parseBaseAnalysisSections=6", sections.length === 6);
  assert(
    "第一节标题",
    sections[0]?.title.includes("先天能量") === true,
  );

  // dualLayer: 依据 lead 可被 parser 识别并折叠
  const blocks = parseReadingBlocks(sections[0]!.body, { layout: false });
  const evidenceLeads = blocks.filter(
    (b) => b.type === "lead" && isEvidenceLeadLabel(b.label),
  );
  assert("第一节有折叠依据块", evidenceLeads.length >= 1);
  assert(
    "依据块内有标记",
    evidenceLeads.some((b) => b.type === "lead" && b.body.includes("⟦t:")),
  );

  // 卡片不走 narrative.card_basis 字符串当正文
  assert("卡片不用 BODY:summary", !md.includes("BODY:summary.card_basis"));
  assert("seg 取值", seg(narrative, "work_style.value_creation").startsWith("BODY:"));
}

{
  const card = renderSummaryCard(buildRc(), "依据 ⟦t:shi_shen|⟧", "en");
  assert("EN 卡片 Keywords", card.includes("**Keywords:**"));
  assert("EN 依据标签", card.includes("**Evidence & reasoning:**"));
}

console.log(failures.length ? "❌ orchestrate guards failed" : "✅ orchestrate guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
