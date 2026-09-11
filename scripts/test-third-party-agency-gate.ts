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
  relationshipFrictionInferenceTemplate,
  partnershipFrictionInferenceTemplate,
  isRelationshipFrictionSurface,
  isPartnershipFrictionSurface,
} from "../lib/llm/pro/delivery/thesis/third-party-agency";
import { polishWriteChunkUnits } from "../lib/llm/pro/delivery/page-schema/deep-evidence-write";
import type { DeepEvidenceAssignmentUnit } from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidenceUnit } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import {
  detectThirdPartyNatalAttribution,
  softRepairThirdPartyAttributionProse,
  validateAssignmentThesisCoverage,
} from "../lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import type { ChartThesis } from "../lib/llm/pro/delivery/thesis/types";

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
}

assert.equal(failed, 0, `${failed} fixture case(s) failed`);
console.log("test-third-party-agency-gate: all passed");
