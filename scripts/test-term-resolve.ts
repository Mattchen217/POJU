/**
 * Phase 1 — strict term resolver acceptance tests.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/test-term-resolve.ts
 *   pnpm test:term-resolve
 */

import { matchForbidden } from "@/lib/glossary/term-forbidden-registry";
import { termHanVariants } from "@/lib/glossary/term-han-normalize";
import { TERM_NS_AVAILABILITY } from "@/lib/glossary/term-ns";
import {
  findPojuTerms,
  resolvePojuTerm,
} from "@/lib/glossary/term-resolve";
import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";

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
  console.log("\n========== test-term-resolve (Phase 1) ==========\n");

  // --- 六合 cross-ns ---
  const liuheQ = resolvePojuTerm("六合", { namespace: "qimen" });
  assert(liuheQ.status === "resolved" && liuheQ.term.slug === "qm_liu_he", "六合@qimen → qm_liu_he");
  const liuheB = resolvePojuTerm("六合", { namespace: "bazi" });
  assert(liuheB.status === "resolved" && liuheB.term.slug === "liuhe", "六合@bazi → liuhe");

  // --- 空亡: bazi forbidden, qimen not globally blocked ---
  const kwB = resolvePojuTerm("空亡", { namespace: "bazi" });
  assert(kwB.status === "forbidden", "空亡@bazi → forbidden");
  const kwQ = resolvePojuTerm("空亡", { namespace: "qimen" });
  assert(kwQ.status !== "forbidden", "空亡@qimen not forbidden");
  assert(
    kwQ.status === "resolved" && kwQ.term.slug === "qm_coverage_gap",
    "空亡@qimen → qm_coverage_gap",
  );

  // --- 白虎 ---
  const bhB = resolvePojuTerm("白虎", { namespace: "bazi" });
  assert(bhB.status === "forbidden", "白虎@bazi → forbidden");
  const bhQ = resolvePojuTerm("白虎", { namespace: "qimen" });
  assert(
    bhQ.status === "resolved" && bhQ.term.slug === "qm_bai_hu",
    "白虎@qimen → qm_bai_hu (冲击)",
  );

  // --- 驿马: separate namespaces, no silent cross-hit ---
  const ymB = resolvePojuTerm("驿马", { namespace: "bazi" });
  assert(ymB.status === "resolved" && ymB.term.slug === "yi_ma", "驿马@bazi → yi_ma");
  const ymQ = resolvePojuTerm("驿马", { namespace: "qimen" });
  assert(
    ymQ.status === "resolved" && ymQ.term.slug === "qm_mobility_marker",
    "驿马@qimen → qm_mobility_marker",
  );
  const ymQTrad = resolvePojuTerm("驛馬", { namespace: "qimen" });
  assert(
    ymQTrad.status === "resolved" && ymQTrad.term.slug === "qm_mobility_marker",
    "驛馬@qimen alias → qm_mobility_marker",
  );

  // --- ambiguous within bazi (财星) ---
  const cai = resolvePojuTerm("财星", { namespace: "bazi" });
  assert(cai.status === "ambiguous", "财星@bazi → ambiguous");
  if (cai.status === "ambiguous") {
    const slugs = new Set(cai.candidates.map((c) => c.slug));
    assert(slugs.has("zheng_cai") && slugs.has("class_cai_xing"), "财星 candidates include both");
  }

  // --- ziwei active (Phase 2 structure labels) ---
  assert(TERM_NS_AVAILABILITY.ziwei === "active", "ziwei marked active");
  const zw = resolvePojuTerm("命宫", { namespace: "ziwei" });
  assert(zw.status === "resolved" && zw.term.slug === "zw_identity_field", "命宫@ziwei → zw_identity_field");
  const lu = resolvePojuTerm("禄", { namespace: "ziwei" });
  assert(lu.status === "resolved" && lu.term.slug === "zw_resource_shift", "禄@ziwei → zw_resource_shift");

  // --- forbidden beats alias: 白虎 cannot resolve via any path under bazi ---
  assert(
    matchForbidden("bazi", "白虎", termHanVariants("白虎"))?.token === "白虎",
    "forbidden registry hit for bazi 白虎",
  );
  assert(
    matchForbidden("qimen", "白虎", termHanVariants("白虎")) === undefined,
    "no qimen forbidden for 白虎",
  );

  // --- findPojuTerms diagnostic ---
  const found = findPojuTerms("六合");
  assert(found.length >= 2, "findPojuTerms(六合) cross-ns ≥ 2");
  assert(
    found.some((t) => t.ns === "bazi") && found.some((t) => t.ns === "qimen"),
    "findPojuTerms(六合) includes bazi+qimen",
  );

  // --- raw preserved ---
  const rawKeep = resolvePojuTerm("  六合  ", { namespace: "bazi" });
  assert(rawKeep.raw === "  六合  " && rawKeep.normalized === "六合", "raw vs normalized preserved");

  // --- Han variant (阳遁 style path uses 阳/陽) ---
  const yang = resolvePojuTerm("阳遁", { namespace: "qimen" });
  const yangTrad = resolvePojuTerm("陽遁", { namespace: "qimen" });
  assert(
    yang.status === "resolved" &&
      yangTrad.status === "resolved" &&
      yang.status === "resolved" &&
      yangTrad.status === "resolved" &&
      yang.term.slug === yangTrad.term.slug,
    "阳遁/陽遁 same qimen term via confirmed Han variants",
  );

  // --- legacy list is bazi-only derivation ---
  assert(
    (OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).includes("空亡"),
    "legacy OUT_OF_SET_FORBIDDEN_HAN still lists 空亡 (bazi)",
  );
  assert(
    (OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).includes("白虎"),
    "legacy OUT_OF_SET_FORBIDDEN_HAN still lists 白虎 (bazi)",
  );

  // --- unknown does not invent term ---
  const unk = resolvePojuTerm("完全不存在的词", { namespace: "bazi" });
  assert(unk.status === "unknown" && !("term" in unk), "unknown has no term field");

  console.log("");
  if (failed) {
    console.error(`${failed} failure(s) — test-term-resolve FAILED\n`);
    process.exit(1);
  }
  console.log("All Phase 1 resolver tests passed.\n");
}

main();
