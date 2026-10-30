/**
 * Phase 3 — qimen field labels + bazi combination SSOT authority.
 *
 *   pnpm test:qimen-bazi-phase3
 */

import {
  isValidSexagenaryGanzhi,
  SEXAGENARY_GANZHI,
  TEN_GOD_TENSION_MARKER_IDS,
  TEN_GOD_TENSION_SOFT,
} from "@/lib/glossary/term-closed-set";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";
import { findPojuTerms, resolvePojuTerm } from "@/lib/glossary/term-resolve";
import {
  QIMEN_FIELD_POLICIES,
  assertQimenXunShouValue,
  formatQimenJuNumber,
  qimenElementalPhaseHeader,
  resolveQimenFieldLabel,
} from "@/lib/qimen/display-policy";
import { QIMEN_SLUG } from "@/lib/qimen/qimen-slug";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

function main() {
  console.log("\n========== test-qimen-bazi-phase3 ==========\n");

  // Namespace isolation
  assert(
    resolvePojuTerm("空亡", { namespace: "bazi" }).status === "forbidden",
    "空亡@bazi forbidden",
  );
  assert(
    resolvePojuTerm("空亡", { namespace: "qimen" }).status === "resolved",
    "空亡@qimen resolved",
  );
  assert(
    resolvePojuTerm("白虎", { namespace: "bazi" }).status === "forbidden",
    "白虎@bazi forbidden",
  );
  assert(
    resolvePojuTerm("白虎", { namespace: "qimen" }).status === "resolved",
    "白虎@qimen resolved",
  );
  const yiB = resolvePojuTerm("驿马", { namespace: "bazi" });
  const yiQ = resolvePojuTerm("驿马", { namespace: "qimen" });
  assert(yiB.status === "resolved" && yiB.term.slug === "yi_ma", "驿马@bazi yi_ma");
  assert(
    yiQ.status === "resolved" && yiQ.term.slug === "qm_mobility_marker",
    "驿马@qimen qm_mobility_marker",
  );
  const cross = findPojuTerms("驿马");
  assert(
    cross.some((t) => t.ns === "bazi") && cross.some((t) => t.ns === "qimen"),
    "findPojuTerms(驿马) both ns",
  );

  // New field labels
  for (const trad of ["旬首", "空亡", "驿马", "节气", "局数", "旺相休囚死"] as const) {
    const r = resolvePojuTerm(trad, { namespace: "qimen" });
    assert(r.status === "resolved", `${trad}@qimen resolved`);
    const label = resolveQimenFieldLabel(trad, "zh");
    assert(label.status === "resolved" && label.label.length > 0, `${trad} display label`);
  }
  assert(QIMEN_SLUG["旬首"] === "qm_cycle_anchor", "QIMEN_SLUG 旬首");
  assert(QIMEN_SLUG["空亡"] === "qm_coverage_gap", "QIMEN_SLUG 空亡");
  assert(QIMEN_SLUG["旺相休囚死"] === "qm_elemental_phase_profile", "QIMEN_SLUG 旺相休囚死");

  // Value policies
  assert(assertQimenXunShouValue("甲午"), "旬首 value 甲午 ok");
  assert(!assertQimenXunShouValue("甲丑"), "旬首 value 甲丑 rejected");
  assert(formatQimenJuNumber(5) === "5", "局数 5");
  assert(formatQimenJuNumber(0) === null, "局数 0 invalid");
  assert(formatQimenJuNumber(10) === null, "局数 10 invalid");
  assert(QIMEN_FIELD_POLICIES.some((p) => p.field === "是否空亡"), "boolean 是否空亡 policy");
  assert(QIMEN_FIELD_POLICIES.some((p) => p.field === "是否驛馬"), "boolean 是否驛馬 policy");
  assert(
    qimenElementalPhaseHeader("zh") === "元素阶段谱",
    "旺相休囚死 soft header",
  );

  // No 60 glossary rows for sexagenary
  const ganzhiAsTerms = SEXAGENARY_GANZHI.filter((g) =>
    Boolean(pojuTermBySlug(g) || resolvePojuTerm(g, { namespace: "qimen" }).status === "resolved"),
  );
  assert(ganzhiAsTerms.length === 0, "no 60 sexagenary glossary terms");
  assert(SEXAGENARY_GANZHI.length === 60, "sexagenary closed set still 60");
  assert(isValidSexagenaryGanzhi("丙午"), "sexagenary validator ok");

  // Bazi combination single authority
  for (const id of TEN_GOD_TENSION_MARKER_IDS) {
    const t = pojuTermBySlug(id);
    assert(Boolean(t) && t!.ns === "bazi", `SSOT has ${id}`);
    const soft = TEN_GOD_TENSION_SOFT[id];
    assert(soft.zh === t!.definition.zh, `${id} TEN_GOD_TENSION_SOFT ≡ SSOT definition`);
    const r = resolvePojuTerm(t!.traditional, { namespace: "bazi" });
    assert(r.status === "resolved" && r.term.slug === id, `${t!.traditional} → ${id}`);
  }

  console.log("");
  if (failed) {
    console.error(`${failed} failure(s) — test-qimen-bazi-phase3 FAILED\n`);
    process.exit(1);
  }
  console.log("All Phase 3 qimen/bazi tests passed.\n");
}

main();
