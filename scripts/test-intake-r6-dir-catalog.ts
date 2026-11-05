/**
 * S0 — DIR N/A Catalog SSOT & loader.
 *   pnpm test:intake-r6-dir-catalog
 */
import assert from "node:assert/strict";
import * as catalogApi from "../lib/poju/decision-context/catalog";
import {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  DIR_NA_CATALOG_VERSION,
  assertNaConditionInDirCatalog,
  loadDirNaCatalog,
  resolveDirNaCatalog,
} from "../lib/poju/decision-context/catalog";
import {
  additiveV1V2Registries,
  registryNonArrayEntries,
  registryThrowingOnGet,
  registryThrowingOnHas,
  registryVersionMismatch,
  registryWithoutVersion,
} from "./fixtures/dir-na-catalog-test-registry";

const EXPECTED_DIR_IDS = [
  "DIR-DEF-QUESTION",
  "DIR-DEF-OUTCOME",
  "DIR-DEF-STAKES",
  "DIR-DEF-PRIORITIES",
  "DIR-DEF-UNACCEPTABLE",
  "DIR-OPT-ON-TABLE",
  "DIR-STATUS-QUO",
  "DIR-OPT-CONSTRAINTS",
  "DIR-OPT-IRREV",
  "DIR-PAST-ATTEMPTS",
  "DIR-TIMING-WINDOW",
  "DIR-RISK-TOLERANCE",
  "DIR-EXIT-CRITERIA",
  "DIR-VALIDATION-CAPACITY",
  "DIR-STAKEHOLDERS",
  "DIR-REL-DYNAMICS",
  "DIR-JOB-OFFER",
  "DIR-BIZ-MODEL",
  "DIR-LOCALE-MOVE",
  "DIR-EDU-PATH",
] as const;

const EXPECTED_TOKENS: Record<string, readonly string[]> = {
  "DIR-DEF-QUESTION": [],
  "DIR-DEF-OUTCOME": [],
  "DIR-DEF-STAKES": ["explicit_stakes_unknowable_boundary"],
  "DIR-DEF-PRIORITIES": [],
  "DIR-DEF-UNACCEPTABLE": ["explicit_no_hard_red_lines"],
  "DIR-OPT-ON-TABLE": [],
  "DIR-STATUS-QUO": ["explicit_no_current_state"],
  "DIR-OPT-CONSTRAINTS": ["explicit_no_material_constraints"],
  "DIR-OPT-IRREV": ["explicit_fully_reversible"],
  "DIR-PAST-ATTEMPTS": ["explicit_first_time_decision"],
  "DIR-TIMING-WINDOW": ["explicit_open_ended_timing"],
  "DIR-RISK-TOLERANCE": [],
  "DIR-EXIT-CRITERIA": ["explicit_no_exit_all_in"],
  "DIR-VALIDATION-CAPACITY": ["explicit_nothing_testable"],
  "DIR-STAKEHOLDERS": ["explicit_solo_decision"],
  "DIR-REL-DYNAMICS": [],
  "DIR-JOB-OFFER": [],
  "DIR-BIZ-MODEL": [],
  "DIR-LOCALE-MOVE": [],
  "DIR-EDU-PATH": [],
};

function main() {
  console.log("intake-r6-dir-catalog (S0)");

  assert.equal(DIR_NA_CATALOG_VERSION, 1);
  assert.equal(ACTIVE_DIR_NA_CATALOG_VERSION, 1);

  // Valid ACTIVE
  const ok = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("unreachable");
  assert.equal(ok.dir_catalog_version, 1);
  assert.equal(ok.entries.length, 20);
  console.log("  PASS  loadDirNaCatalog(ACTIVE) → ok, version 1, 20 entries");

  // Phase 2 id + token inventory
  const ids = new Set(ok.entries.map((e) => e.dir_id));
  assert.equal(ids.size, EXPECTED_DIR_IDS.length);
  for (const id of EXPECTED_DIR_IDS) {
    assert.ok(ids.has(id), `missing dir_id ${id}`);
    const entry = ok.entries.find((e) => e.dir_id === id)!;
    assert.deepEqual(
      [...entry.na_conditions],
      [...EXPECTED_TOKENS[id]!],
      `token mismatch for ${id}`,
    );
  }
  console.log("  PASS  Phase 2 20 DIR ids + condition tokens match");

  // Deep freeze
  assert.ok(Object.isFrozen(ok.entries));
  for (const entry of ok.entries) {
    assert.ok(Object.isFrozen(entry), `entry not frozen: ${entry.dir_id}`);
    assert.ok(
      Object.isFrozen(entry.na_conditions),
      `na_conditions not frozen: ${entry.dir_id}`,
    );
  }
  console.log("  PASS  deep freeze (entries / entry / na_conditions)");

  // Explicit undefined / null → missing (not ACTIVE)
  const missU = loadDirNaCatalog(undefined);
  assert.equal(missU.ok, false);
  if (!missU.ok) assert.equal(missU.reason_code, "dir_catalog_version_missing");
  const missN = loadDirNaCatalog(null);
  assert.equal(missN.ok, false);
  if (!missN.ok) assert.equal(missN.reason_code, "dir_catalog_version_missing");
  console.log("  PASS  undefined/null → dir_catalog_version_missing");

  // Invalid
  for (const bad of [1.1, 0, -1, Number.NaN] as const) {
    const r = resolveDirNaCatalog(bad, new Map(), ACTIVE_DIR_NA_CATALOG_VERSION);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, "dir_catalog_version_invalid");
  }
  console.log("  PASS  invalid versions → dir_catalog_version_invalid");

  // Unknown (non-ACTIVE absent)
  const unk = resolveDirNaCatalog(
    999,
    new Map([
      [
        1,
        {
          dir_catalog_version: 1,
          entries: ok.entries,
        },
      ],
    ]),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(unk.ok, false);
  if (!unk.ok) assert.equal(unk.reason_code, "dir_catalog_version_unknown");
  console.log("  PASS  999 → dir_catalog_version_unknown");

  // DC-4(1) ACTIVE absent from test-local registry
  const ssot = resolveDirNaCatalog(
    1,
    registryWithoutVersion(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(ssot.ok, false);
  if (!ssot.ok) assert.equal(ssot.reason_code, "dir_catalog_ssot_unavailable");
  console.log("  PASS  ACTIVE∉registry → dir_catalog_ssot_unavailable");

  // load_failed matrix — must not throw out
  const failHasThrow = resolveDirNaCatalog(
    1,
    registryThrowingOnHas(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failHasThrow.ok, false);
  if (!failHasThrow.ok) {
    assert.equal(failHasThrow.reason_code, "dir_catalog_load_failed");
  }

  const failThrow = resolveDirNaCatalog(
    1,
    registryThrowingOnGet(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failThrow.ok, false);
  if (!failThrow.ok) {
    assert.equal(failThrow.reason_code, "dir_catalog_load_failed");
  }

  const failMismatch = resolveDirNaCatalog(
    1,
    registryVersionMismatch(1, 2),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failMismatch.ok, false);
  if (!failMismatch.ok) {
    assert.equal(failMismatch.reason_code, "dir_catalog_load_failed");
  }

  const failNonArray = resolveDirNaCatalog(
    1,
    registryNonArrayEntries(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failNonArray.ok, false);
  if (!failNonArray.ok) {
    assert.equal(failNonArray.reason_code, "dir_catalog_load_failed");
  }
  console.log(
    "  PASS  load_failed: has-throw / get-throw / version mismatch / non-array (no rethrow)",
  );

  // Membership
  const allow = assertNaConditionInDirCatalog(
    ok,
    "DIR-DEF-UNACCEPTABLE",
    "explicit_no_hard_red_lines",
  );
  assert.equal(allow.ok, true);
  const denyDir = assertNaConditionInDirCatalog(ok, "DIR-NOT-REAL", "x");
  assert.equal(denyDir.ok, false);
  if (!denyDir.ok) assert.equal(denyDir.reason_code, "dir_not_in_catalog");
  const denyCode = assertNaConditionInDirCatalog(
    ok,
    "DIR-DEF-UNACCEPTABLE",
    "explicit_no_material_constraints",
  );
  assert.equal(denyCode.ok, false);
  if (!denyCode.ok) {
    assert.equal(denyCode.reason_code, "na_condition_not_in_catalog");
  }
  console.log("  PASS  membership allow / deny DIR / deny condition");

  // Additive-only: every non-empty v1 (dir_id, code) still ok under v2
  const expectedNonEmptyPairs: Array<{ dir_id: string; code: string }> = [];
  for (const [dirId, codes] of Object.entries(EXPECTED_TOKENS)) {
    for (const code of codes) {
      expectedNonEmptyPairs.push({ dir_id: dirId, code });
    }
  }
  const { v2, v1Pairs } = additiveV1V2Registries();
  assert.equal(v1Pairs.length, expectedNonEmptyPairs.length);
  assert.deepEqual(
    [...v1Pairs].sort((a, b) =>
      `${a.dir_id}:${a.code}`.localeCompare(`${b.dir_id}:${b.code}`),
    ),
    [...expectedNonEmptyPairs].sort((a, b) =>
      `${a.dir_id}:${a.code}`.localeCompare(`${b.dir_id}:${b.code}`),
    ),
  );
  const v2Load = resolveDirNaCatalog(2, v2, 2);
  assert.equal(v2Load.ok, true);
  if (!v2Load.ok) throw new Error("unreachable");
  for (const pair of v1Pairs) {
    const m = assertNaConditionInDirCatalog(v2Load, pair.dir_id, pair.code);
    assert.equal(m.ok, true, `additive fail ${pair.dir_id}/${pair.code}`);
  }
  console.log(
    `  PASS  additive-only all ${v1Pairs.length} v1 pairs still ok under v2`,
  );

  // Production Registry must not be a public export of the catalog barrel
  assert.equal("productionDirNaRegistry" in catalogApi, false);
  assert.equal("PRODUCTION_DIR_NA_REGISTRY" in catalogApi, false);
  console.log("  PASS  production Registry not exported from catalog barrel");

  console.log("\nAll intake-r6-dir-catalog (S0) checks passed.");
}

main();
