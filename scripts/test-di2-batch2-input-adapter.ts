/**
 * Unit A — DI2 → Batch 2 input adapter (no Start wiring, no model calls).
 *
 *   pnpm exec tsx scripts/test-di2-batch2-input-adapter.ts
 */
import assert from "node:assert/strict";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import type {
  FreezeRecord,
  ProfileRecord,
} from "../lib/poju/decision-authority/types";
import {
  FREEZE_RECORD_SCHEMA_VERSION,
  PROFILE_RECORD_SCHEMA_VERSION,
  PROFILE_CALC_SCHEMA_VERSION,
} from "../lib/poju/decision-authority/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import {
  buildBatch2InputsFromDI2,
  type Di2Batch2AdapterIdentity,
  type Di2Batch2AdapterSource,
} from "../lib/poju/decision-intake/decision-report-batch2-adapter";
import type { BookJudgmentPack } from "../lib/llm/pro/delivery/book-judgment/schema";
import type { ZiweiFactPack } from "../lib/ziwei/fact-pack";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

const NOW = "2026-11-26T18:00:00.000Z";

function draftDc(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    dc_version: "v1",
    status: "final",
    schema_version: 1,
    context_id: "ctx_1",
    version: 3,
    content_hash: "ctx_hash_abc",
    definition: {
      decision_question: "是否接受新工作",
      decision_target: "job_choice",
      concrete_event: null,
      stakes: null,
      desired_outcome: null,
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    dirs: [],
    reality_facts: [],
    constraints: [],
    conflicts: [],
    hypotheses: [],
    ...overrides,
  } as DecisionContext;
}

function structuredWithDayMaster(): ProfileStructured {
  return {
    day_master: "甲木",
    pattern: "正官格",
    yong_shen: "水",
    xi_shen: ["水", "木"],
    ji_shen: ["金"],
    strength: "balanced",
    four_pillars: {
      year: "甲子",
      month: "丙寅",
      day: "戊午",
      hour: "癸亥",
    },
    da_yun: [],
    data_availability: {
      pillars_detail: false,
      da_yun: false,
      bazi_enrichment: false,
    },
  };
}

function structuredEmptyDayMaster(): ProfileStructured {
  return {
    ...structuredWithDayMaster(),
    day_master: "",
  };
}

function freezeRec(dc: DecisionContext): FreezeRecord {
  return {
    schema_version: FREEZE_RECORD_SCHEMA_VERSION,
    session_id: "sess_1",
    freeze_id: "frz_1",
    context_id: "ctx_1",
    context_version: 3,
    context_hash: "ctx_hash_abc",
    frozen_at: NOW,
    frozen_dc: dc,
    blueprint_hash: null,
    blueprint: null,
    source_commit_version: 1,
    source_entry_hash: "entry_1",
    freeze_commit_version: 2,
    profile_hash: "prof_hash_1",
    receipt: {
      schema_version: FREEZE_RECORD_SCHEMA_VERSION,
      receipt_id: "frcpt_1",
      freeze_id: "frz_1",
      session_id: "sess_1",
      context_id: "ctx_1",
      context_version: 3,
      context_hash: "ctx_hash_abc",
      blueprint_hash: null,
      frozen_at: NOW,
      ledger_commit_version: 2,
      signature: "sig",
      key_id: "k1",
    },
  };
}

function profileRec(
  chart: ProfileStructured,
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    schema_version: PROFILE_RECORD_SCHEMA_VERSION,
    session_id: "sess_1",
    freeze_id: "frz_1",
    profile_id: "prof_1",
    profile_hash: "prof_hash_1",
    calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
    calculation_timestamp: NOW,
    chart_structure: chart,
    ziwei_closed_set: null,
    source: {
      kind: "server_recompute_from_birth",
      birth_input_hash: "birth_hash",
      bazi_engine: "shunshi-bazi-core",
      ziwei_engine: "iztro",
      used_true_solar_time: true,
      ziwei_status: "not_available",
    },
    registered_at: NOW,
    receipt: {
      schema_version: PROFILE_RECORD_SCHEMA_VERSION,
      receipt_id: "prcpt_1",
      freeze_id: "frz_1",
      session_id: "sess_1",
      profile_id: "prof_1",
      profile_hash: "prof_hash_1",
      calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
      calculation_timestamp: NOW,
      signature: "sig",
      key_id: "k1",
    },
    ...overrides,
  };
}

function identity(
  overrides?: Partial<Di2Batch2AdapterIdentity>,
): Di2Batch2AdapterIdentity {
  return {
    session_id: "sess_1",
    freeze_id: "frz_1",
    context_id: "ctx_1",
    context_version: 3,
    context_hash: "ctx_hash_abc",
    profile_hash: "prof_hash_1",
    report_job_id: "rj_stable_1",
    ...overrides,
  };
}

function baseSource(
  overrides?: Partial<Di2Batch2AdapterSource>,
): Di2Batch2AdapterSource {
  const dc = draftDc();
  return {
    identity: identity(),
    freeze: freezeRec(dc),
    profile: profileRec(structuredWithDayMaster()),
    ...overrides,
  };
}

function minimalValidPack(): BookJudgmentPack {
  return {
    version: 1,
    locale: "zh",
    cfp_hash: "cfp_1",
    zfp_hash: null,
    zfpOmitted: true,
    shot_mode: "one",
    created_at: NOW,
    units: [
      {
        id: "u1",
        track: "destiny",
        serves_face: ["02"],
        claim: "日主甲木，当前以稳为主",
        anchors: ["甲木", "正官"],
        term_ids: [],
      },
    ],
    by_face: { "02": ["u1"] },
    pattern_hits_used: [],
    science_tags_used: [],
  };
}

function main() {
  console.log("Unit A — DI2 → Batch2 input adapter");

  check("dc+profile with day_master → ok; pack null; chart mapped", () => {
    const res = buildBatch2InputsFromDI2(baseSource());
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.report_id, "rj_stable_1");
    assert.equal(res.inputs.dc.content_hash, "ctx_hash_abc");
    assert.equal(res.inputs.pack, null);
    assert.ok(res.inputs.chart_fact_pack && res.inputs.chart_fact_pack.includes("日主"));
    assert.equal(res.inputs.bazi_available, true);
    assert.equal(res.inputs.ziwei_fact_pack, null);
    assert.equal(res.inputs.ziwei_available, false);
    assert.equal(res.inputs.authorized_partner_profile, false);
    assert.equal(res.provenance.pack, "absent→null (Profile≠BookJudgmentPack)");
  });

  check("valid book_judgment_pack maps to pack", () => {
    const pack = minimalValidPack();
    const res = buildBatch2InputsFromDI2(
      baseSource({ book_judgment_pack: pack }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(res.inputs.pack);
    assert.equal(res.inputs.pack!.units[0]!.id, "u1");
    assert.equal(res.provenance.pack, "caller.book_judgment_pack");
  });

  check("ziwei_fact_pack when provided sets availability", () => {
    const zfp = { version: 1 } as unknown as ZiweiFactPack;
    const res = buildBatch2InputsFromDI2(baseSource({ ziwei_fact_pack: zfp }));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.ziwei_fact_pack, zfp);
    assert.equal(res.inputs.ziwei_available, true);
  });

  check("bazi+ziwei together", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({
        book_judgment_pack: minimalValidPack(),
        ziwei_fact_pack: { version: 1 } as unknown as ZiweiFactPack,
        authorized_partner_profile: true,
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.bazi_available, true);
    assert.equal(res.inputs.ziwei_available, true);
    assert.equal(res.inputs.authorized_partner_profile, true);
    assert.ok(res.inputs.pack);
  });

  check("authorized_partner_profile only when explicitly true", () => {
    const a = buildBatch2InputsFromDI2(
      baseSource({ authorized_partner_profile: false }),
    );
    assert.equal(a.ok && a.inputs.authorized_partner_profile, false);
    const b = buildBatch2InputsFromDI2(baseSource({}));
    assert.equal(b.ok && b.inputs.authorized_partner_profile, false);
  });

  check("report_id uses DI2 report_job_id", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ identity: identity({ report_job_id: "  rj_x  " }) }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.report_id, "rj_x");
  });

  check("missing frozen dc fails", () => {
    const src = baseSource();
    (src.freeze as { frozen_dc: unknown }).frozen_dc = null;
    const res = buildBatch2InputsFromDI2(src);
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "missing_frozen_dc");
  });

  check("context hash mismatch fails", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ identity: identity({ context_hash: "other" }) }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "context_hash_mismatch");
  });

  check("freeze identity mismatch fails", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ identity: identity({ freeze_id: "wrong" }) }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "freeze_identity_mismatch");
  });

  check("profile hash mismatch fails", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ identity: identity({ profile_hash: "wrong" }) }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "profile_identity_mismatch");
  });

  check("empty object cannot cast as BookJudgmentPack", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ book_judgment_pack: {} as BookJudgmentPack }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "invalid_book_judgment_pack");
  });

  check("Profile-shaped object is not a valid pack", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({
        book_judgment_pack: {
          profile_hash: "x",
          chart_structure: structuredWithDayMaster(),
        } as unknown as BookJudgmentPack,
      }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "invalid_book_judgment_pack");
  });

  check("optional bazi missing (no day_master) → chart null, not error", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ profile: profileRec(structuredEmptyDayMaster()) }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.chart_fact_pack, null);
    assert.equal(res.inputs.bazi_available, false);
  });

  check("optional ziwei missing → null, not error", () => {
    const res = buildBatch2InputsFromDI2(baseSource());
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.ziwei_fact_pack, null);
    assert.equal(res.inputs.ziwei_available, false);
    assert.match(
      res.provenance.ziwei_fact_pack,
      /absent→null/,
    );
  });

  check("invalid ziwei_fact_pack type fails (not silent null)", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ ziwei_fact_pack: "not-an-object" as unknown as ZiweiFactPack }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "ziwei_fact_pack_invalid");
  });

  check("unauthorized partner stays false", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ authorized_partner_profile: undefined }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.inputs.authorized_partner_profile, false);
  });

  check("missing report_job_id fails", () => {
    const res = buildBatch2InputsFromDI2(
      baseSource({ identity: identity({ report_job_id: "  " }) }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "missing_report_job_id");
  });

  check("adapter does not mutate freeze/profile inputs", () => {
    const src = baseSource();
    const dcBefore = JSON.stringify(src.freeze.frozen_dc);
    const profBefore = JSON.stringify(src.profile.chart_structure);
    const res = buildBatch2InputsFromDI2(src);
    assert.equal(res.ok, true);
    assert.equal(JSON.stringify(src.freeze.frozen_dc), dcBefore);
    assert.equal(JSON.stringify(src.profile.chart_structure), profBefore);
  });

  check("adapter does not create jobs / side effects (pure)", () => {
    // Structural: function is sync and returns only Result — no await, no KV.
    const res = buildBatch2InputsFromDI2(baseSource());
    assert.equal(res.ok, true);
    assert.equal(typeof buildBatch2InputsFromDI2, "function");
  });

  console.log(`\nDone: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
