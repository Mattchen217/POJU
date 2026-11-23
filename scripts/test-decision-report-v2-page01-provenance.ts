/**
 * Term ID + ZFP hit provenance integrity (production certification path).
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page01-provenance.ts
 */

import assert from "node:assert/strict";
import {
  buildFace01ProductionContext,
  assembleGlossaryAppendixFromEvidence,
  resolveUnitTermProvenance,
  resolveAvailablePersonalDomains,
  resolveHitIdToTermIds,
  selectRealityFactsForPage01,
  canonicalPatternHitRefsFromZiwei,
  certifyPatternHitsUsed,
  seedEvidenceRegistryForFace01,
  normalizeHitRef,
  hitRefInAllowlist,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import { buildCertifiedBookJudgmentPackDraft } from "@/lib/llm/pro/delivery/book-judgment/generate";
import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

console.log("=== Face01 provenance integrity (ZFP hit closure) ===");

const dc = {
  context_id: "dc_prov",
  version: 1,
  status: "frozen",
  content_hash: "h",
  definition: {
    decision_question: "Quit for startup?",
    desired_outcome: "Keep runway",
  },
  dirs: [
    {
      dir_id: "dir_main",
      id_lifecycle: "active",
      required_fact_roles: ["cash_runway"],
    },
  ],
  constraints: [],
  reality_facts: [
    {
      fact_id: "fact_runway",
      statement: "8 months runway",
      status: "confirmed",
      verification_level: "user_asserted",
      roles: ["cash_runway"],
      related_dir_ids: ["dir_main"],
    },
    {
      fact_id: "fact_hobby",
      statement: "Likes hiking",
      status: "confirmed",
      verification_level: "user_asserted",
      roles: [],
      related_dir_ids: [],
    },
    {
      fact_id: "fact_salary",
      statement: "Maybe 120k",
      status: "unverified",
      verification_level: "user_estimate",
      roles: ["cash_runway"],
      related_dir_ids: ["dir_main"],
    },
  ],
  conflicts: [],
  hypotheses: [],
} as unknown as DecisionContext;

/** Real ZFP with a single pattern hit — canonical ref is content-hash based. */
const realZiwei = {
  patternHits: [{ name: "甲寅格", level: "mid" }],
} as ZiweiFactPack;
const REAL_HIT = canonicalPatternHitRefsFromZiwei(realZiwei)[0]!;
assert.ok(REAL_HIT.startsWith("hit:"), `real hit=${REAL_HIT}`);
assert.ok(REAL_HIT.endsWith(":mid"));
const FAKE_HIT = "hit:fake_id:mid";
assert.notEqual(REAL_HIT, FAKE_HIT);

const chartText = 'dayMaster: "甲"\nyongJi: 木';

// --- Domain availability (unchanged contract) ---
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack: null,
    chart_fact_pack: null,
    ziwei_fact_pack: realZiwei,
  }).available_domains,
  ["ziwei"],
);
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack: null,
    chart_fact_pack: "dayMaster:甲",
    ziwei_fact_pack: null,
  }).available_domains,
  ["bazi"],
);

console.log("--- production-path reverse A–J ---");

// A: real ZFP only REAL_HIT; model declares FAKE → reject
{
  const units: BookJudgmentUnit[] = [
    {
      id: "u_fake",
      track: "destiny",
      claim: `Palace. ${FAKE_HIT}`,
      anchors: [FAKE_HIT],
      serves_face: ["01"],
      term_ids: [],
      declared_term_ids: ["pattern"],
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: "",
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [FAKE_HIT],
  });
  assert.ok(!pack.pattern_hits_used.includes(FAKE_HIT), "A: fake not certified");
  assert.ok(
    (pack.declared_pattern_hits_used ?? []).includes(FAKE_HIT),
    "A: fake kept as declaration",
  );
  assert.equal(pack.units[0]!.source_domain, "unavailable");
  const seeded = seedEvidenceRegistryForFace01({
    dc,
    pack,
    ziwei_fact_pack: realZiwei,
    ziwei_available: true,
    bazi_available: false,
  });
  assert.equal(seeded.registry.evidence["u_fake"], undefined, "A: no evidence");
}

// B: model declares real + fake → only real kept
{
  const units: BookJudgmentUnit[] = [
    {
      id: "u_real",
      track: "destiny",
      claim: `Tension. ${REAL_HIT}`,
      anchors: [REAL_HIT],
      serves_face: ["01"],
      term_ids: [],
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: "",
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [REAL_HIT, FAKE_HIT],
  });
  assert.deepEqual(pack.pattern_hits_used, [REAL_HIT], "B: only real");
  assert.ok((pack.declared_pattern_hits_used ?? []).includes(FAKE_HIT));
  assert.equal(pack.units[0]!.source_domain, "ziwei");
}

// C: wrong level rejected
{
  const wrongLevel = REAL_HIT.replace(/:mid$/, ":strong");
  assert.notEqual(wrongLevel, REAL_HIT);
  const units: BookJudgmentUnit[] = [
    {
      id: "u_lvl",
      track: "destiny",
      claim: `x ${wrongLevel}`,
      anchors: [wrongLevel],
      serves_face: ["01"],
      term_ids: [],
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: "",
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [wrongLevel],
  });
  assert.deepEqual(pack.pattern_hits_used, [], "C: wrong level not certified");
  assert.equal(pack.units[0]!.source_domain, "unavailable");
}

// D: model adds fake via pattern_hits_used alone → pack rejects
{
  const units: BookJudgmentUnit[] = [
    {
      id: "u_sci",
      track: "science",
      claim: "Staged explore.",
      anchors: ["runway"],
      serves_face: ["01"],
      term_ids: [],
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: chartText,
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [FAKE_HIT, "hit:another_fake:mid"],
  });
  assert.deepEqual(pack.pattern_hits_used, [], "D: no fake without claim use");
  assert.equal(pack.zfpOmitted, false, "D: real ZFP still present");
  assert.ok(pack.zfp_hash);
}

// E: fake hit in claim+anchors → no personal evidence
{
  const units: BookJudgmentUnit[] = [
    {
      id: "u_e",
      track: "destiny",
      claim: `Both places ${FAKE_HIT}`,
      anchors: [FAKE_HIT],
      serves_face: ["01", "02"],
      term_ids: [],
      declared_source_domain: "ziwei",
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: "",
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [FAKE_HIT],
  });
  const seeded = seedEvidenceRegistryForFace01({
    dc,
    pack,
    ziwei_fact_pack: realZiwei,
    ziwei_available: true,
    bazi_available: false,
  });
  assert.equal(seeded.registry.evidence["u_e"], undefined, "E: excluded");
  assert.ok(!seeded.page02PlannedEvidenceIds.includes("u_e"));
}

// F: real hit, no model term_id → hit provenance kept, no fake term
{
  const units: BookJudgmentUnit[] = [
    {
      id: "u_f",
      track: "destiny",
      claim: `Real ${REAL_HIT}`,
      anchors: [REAL_HIT],
      serves_face: ["01"],
      term_ids: [],
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: "",
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [],
  });
  assert.deepEqual(pack.pattern_hits_used, [REAL_HIT], "F: used real hit certified");
  assert.equal(pack.units[0]!.source_domain, "ziwei");
  assert.deepEqual(pack.units[0]!.term_ids, []);
  assert.equal(pack.units[0]!.source_version, pack.zfp_hash);
  const prov = resolveUnitTermProvenance({
    unit: {
      ...pack.units[0]!,
      term_ids: [],
    },
    actual_pattern_hit_refs: canonicalPatternHitRefsFromZiwei(realZiwei),
    bazi_available: false,
    ziwei_available: true,
    zfp_hash: pack.zfp_hash,
  });
  assert.equal(prov.source_domain, "ziwei");
  assert.ok(
    prov.records.some(
      (r) =>
        r.certification === "hit_unmapped" &&
        r.term_id === null &&
        r.hit_level === "mid" &&
        r.source_version === pack.zfp_hash,
    ),
    "F: unmapped hit provenance",
  );
}

// G: old pack pattern_hits_used has fake; registry re-cert rejects
{
  const oldPack = {
    version: 1,
    locale: "en",
    cfp_hash: "cfp_old",
    zfp_hash: "zfp_old",
    zfpOmitted: false,
    shot_mode: "one",
    created_at: "2026-01-01T00:00:00Z",
    units: [
      {
        id: "u_old_fake",
        track: "destiny",
        claim: `Legacy ${FAKE_HIT}`,
        anchors: [FAKE_HIT],
        serves_face: ["01"],
        term_ids: ["pattern"],
        source_domain: "ziwei",
        source_version: "zfp_old",
      },
    ],
    by_face: { "01": ["u_old_fake"] },
    pattern_hits_used: [FAKE_HIT],
    science_tags_used: [],
  } as BookJudgmentPack;
  const seeded = seedEvidenceRegistryForFace01({
    dc,
    pack: oldPack,
    ziwei_fact_pack: realZiwei,
    ziwei_available: true,
    bazi_available: false,
  });
  assert.equal(
    seeded.registry.evidence["u_old_fake"],
    undefined,
    "G: registry rejects pack-only fake",
  );
}

// H: no real ZFP hits → model declare cannot create ziwei evidence
{
  const emptyZiwei = { patternHits: [] } as ZiweiFactPack;
  const units: BookJudgmentUnit[] = [
    {
      id: "u_h",
      track: "destiny",
      claim: `Claim ${FAKE_HIT}`,
      anchors: [FAKE_HIT],
      serves_face: ["01"],
      term_ids: [],
      declared_source_domain: "ziwei",
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: chartText,
    ziwei: emptyZiwei,
    units,
    declared_pattern_hits_used: [FAKE_HIT, REAL_HIT],
  });
  assert.equal(pack.zfpOmitted, true, "H: zfp omitted");
  assert.deepEqual(pack.pattern_hits_used, []);
  assert.equal(pack.units[0]!.source_domain, "unavailable");
  const seeded = seedEvidenceRegistryForFace01({
    dc,
    pack,
    ziwei_fact_pack: emptyZiwei,
    chart_fact_pack: chartText,
    ziwei_available: false,
    bazi_available: true,
  });
  assert.equal(seeded.registry.evidence["u_h"], undefined, "H: no ziwei evidence");
}

// I: strict full match — prefix / extra segment / different level fail
{
  const allow = new Set(canonicalPatternHitRefsFromZiwei(realZiwei));
  const id = REAL_HIT.split(":")[1]!;
  assert.equal(hitRefInAllowlist(id, "mid", allow), true);
  assert.equal(hitRefInAllowlist(id, "strong", allow), false, "I: level");
  assert.equal(
    hitRefInAllowlist(id.slice(0, 4), "mid", allow),
    false,
    "I: prefix id",
  );
  assert.equal(
    normalizeHitRef(`hit:${id}:mid:extra`),
    null,
    "I: extra segment malformed",
  );
  assert.equal(
    hitRefInAllowlist(`${id}_x`, "mid", allow),
    false,
    "I: similar id",
  );
}

// J: real hit, no SSOT map → hit_unmapped, no generic pattern
{
  assert.deepEqual(resolveHitIdToTermIds(REAL_HIT.split(":")[1]!), []);
  const units: BookJudgmentUnit[] = [
    {
      id: "u_j",
      track: "destiny",
      claim: REAL_HIT,
      anchors: [REAL_HIT],
      serves_face: ["01"],
      term_ids: [],
      declared_term_ids: ["pattern"],
    },
  ];
  const pack = buildCertifiedBookJudgmentPackDraft({
    locale: "en",
    chartText: "",
    ziwei: realZiwei,
    units,
    declared_pattern_hits_used: [REAL_HIT],
  });
  assert.deepEqual(pack.units[0]!.term_ids, [], "J: no pattern term");
  const seeded = seedEvidenceRegistryForFace01({
    dc,
    pack,
    ziwei_fact_pack: realZiwei,
    ziwei_available: true,
    bazi_available: false,
  });
  const ev = seeded.registry.evidence["u_j"];
  assert.ok(ev, "J: evidence from real hit domain");
  assert.deepEqual(ev!.term_ids, []);
}

// --- Dual-domain production context (CFP + real ZFP) ---
const dualUnits: BookJudgmentUnit[] = [
  {
    id: "u_bazi",
    track: "destiny",
    claim: "Cash floor. cfp:dayMaster",
    anchors: ["cfp:dayMaster"],
    serves_face: ["01"],
    term_ids: [],
    declared_term_ids: ["day_master"],
  },
  {
    id: "u_ziwei",
    track: "destiny",
    claim: `Palace. ${REAL_HIT}`,
    anchors: [REAL_HIT],
    serves_face: ["01", "02"],
    term_ids: [],
    declared_term_ids: ["pattern"],
  },
  {
    id: "u_sci",
    track: "science",
    claim: "Staged explore reduces irreversible cost.",
    anchors: ["switching_cost"],
    serves_face: ["01"],
    term_ids: [],
  },
];
const dualPack = buildCertifiedBookJudgmentPackDraft({
  locale: "en",
  chartText,
  ziwei: realZiwei,
  units: dualUnits,
  declared_pattern_hits_used: [REAL_HIT, FAKE_HIT],
});
assert.deepEqual(dualPack.pattern_hits_used, [REAL_HIT]);
assert.ok((dualPack.declared_pattern_hits_used ?? []).includes(FAKE_HIT));

const built = buildFace01ProductionContext({
  report_id: "r_prov",
  locale: "en",
  dc,
  pack: dualPack,
  chart_fact_pack: chartText,
  ziwei_fact_pack: realZiwei,
});
assert.equal(built.ok, true, built.ok ? "" : built.reason);
if (!built.ok) throw new Error(built.reason);
const ctx = built.ctx;

const runway = ctx.slice.reality_context.facts.find((f) => f.fact_id === "fact_runway");
assert.ok(runway);
assert.equal(runway!.selection_kind, "linked");

const baziEv = ctx.registry.evidence["u_bazi"];
assert.ok(baziEv);
assert.deepEqual(baziEv!.term_ids, ["day_master"]);
const ziweiEv = ctx.registry.evidence["u_ziwei"];
assert.ok(ziweiEv);
assert.deepEqual(ziweiEv!.term_ids, [], "no generic pattern");

const g = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [baziEv!.term_ids, ziweiEv!.term_ids],
});
assert.equal(g.include, true);
assert.deepEqual(g.term_ids, ["day_master"]);

// Bazi-only: ziwei unit excluded
const baziOnly = buildFace01ProductionContext({
  report_id: "r_bazi",
  locale: "en",
  dc,
  pack: dualPack,
  chart_fact_pack: "dayMaster:甲",
  ziwei_available: false,
  bazi_available: true,
});
assert.equal(baziOnly.ok, true);
if (baziOnly.ok) {
  assert.equal(baziOnly.ctx.registry.evidence["u_ziwei"], undefined);
  assert.ok(baziOnly.ctx.registry.evidence["u_bazi"]);
}

const sel = selectRealityFactsForPage01({ dc, maxFacts: 8 });
assert.notEqual(
  sel.selected.find((r) => r.fact.fact_id === "fact_hobby")?.kind,
  "linked",
);

// certifyPatternHitsUsed unit-level
const cert = certifyPatternHitsUsed({
  declared: [REAL_HIT, FAKE_HIT],
  units: dualUnits,
  canonical_refs: canonicalPatternHitRefsFromZiwei(realZiwei),
});
assert.deepEqual(cert.pattern_hits_used, [REAL_HIT]);
assert.ok(
  cert.rejected.some(
    (r) => r.value === FAKE_HIT && r.reason === "hit_not_in_real_zfp_allowlist",
  ),
);

console.log("ok decision-report-v2 page01 provenance");
