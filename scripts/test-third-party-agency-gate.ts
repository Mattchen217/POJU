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
  relationshipFrictionInferenceTemplate,
  isRelationshipFrictionSurface,
} from "../lib/llm/pro/delivery/thesis/third-party-agency";
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
}

assert.equal(failed, 0, `${failed} fixture case(s) failed`);
console.log("test-third-party-agency-gate: all passed");
