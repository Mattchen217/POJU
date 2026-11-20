/**
 * Fresh-session opening statement → discrete user_asserted RealityFacts.
 * Does not invent beyond clear assertions in the user's first dilemma text.
 * Fact IDs are stable per context so Understanding labels can cite them.
 */

import { buildRealityFact } from "@/lib/poju/decision-context/fact-combination";
import { reaggregateDirs } from "@/lib/poju/decision-context/dir-aggregator";
import type { POJUSessionState } from "@/lib/poju/types";

export type OpeningClaimSpec = {
  claim_key: string;
  label_zh: string;
  label_en: string;
  test: (text: string) => boolean;
  fact_roles: string[];
  related_dir_ids: string[];
};

/** Category-level extractors — not case-specific Lab sentence patches. */
export const OPENING_CLAIM_SPECS: readonly OpeningClaimSpec[] = [
  {
    claim_key: "past_venture_failure",
    label_zh: "过去有创业失败经历",
    label_en: "Has a past entrepreneurial failure",
    test: (t) =>
      /创业失败|创业.{0,8}失败|上次创业|上一次的创业|venture failed|startup failed|business failed/i.test(
        t,
      ),
    fact_roles: ["past_attempt"],
    related_dir_ids: ["DIR-PAST-ATTEMPTS"],
  },
  {
    claim_key: "prolonged_no_income",
    label_zh: "已经好几年没有收入",
    label_en: "Has had no income for several years",
    test: (t) =>
      /好几年没有收入|多年没有收入|几年没.{0,4}收入|长期没有收入|no income for (years|several years)|without income for/i.test(
        t,
      ),
    fact_roles: ["status_quo"],
    related_dir_ids: ["DIR-STATUS-QUO"],
  },
  {
    claim_key: "no_clear_next_work",
    label_zh: "当前找不到明确可以做的事情",
    label_en: "Currently cannot find clear work to do",
    test: (t) =>
      /找不到事情做|找不到.*做|一直找不到|没有明确.*做|can't find .{0,20}(work|job)|nothing to do|stuck finding/i.test(
        t,
      ),
    fact_roles: ["status_quo"],
    related_dir_ids: ["DIR-STATUS-QUO"],
  },
];

export function matchOpeningClaims(statement: string): OpeningClaimSpec[] {
  const text = statement.trim();
  if (!text) return [];
  return OPENING_CLAIM_SPECS.filter((spec) => spec.test(text));
}

export function seedOpeningAssertedFacts(
  session: POJUSessionState,
  statement: string,
  source_turn_id: string,
  now: string,
  locale = "zh",
): POJUSessionState {
  const dc = session.decision_context;
  if (!dc || (dc.status !== "draft" && dc.status !== "final")) return session;
  const activeDirIds = new Set(
    (dc.dirs ?? [])
      .filter((d) => d.id_lifecycle === "active" || d.id_lifecycle == null)
      .map((d) => d.dir_id),
  );
  const existingKeys = new Set(
    (dc.reality_facts ?? [])
      .map((f) => f.fact_id)
      .filter((id) => id.startsWith("fact_open_")),
  );
  const claims = matchOpeningClaims(statement);
  if (!claims.length) return session;

  const isZh = locale.toLowerCase().startsWith("zh");
  const reality_facts = [...(dc.reality_facts ?? [])];
  let added = 0;
  for (const claim of claims) {
    const fact_id = `fact_open_${claim.claim_key}_${dc.context_id}`.slice(0, 120);
    if (existingKeys.has(fact_id)) continue;
    if (reality_facts.some((f) => f.fact_id === fact_id)) continue;
    const related = claim.related_dir_ids.filter((id) => activeDirIds.has(id));
    // Keep fact even if related DIR not active yet — label still usable for Understood UI.
    const fact = buildRealityFact({
      fact_id,
      statement: isZh ? claim.label_zh : claim.label_en,
      status: "unverified",
      verification_level: "user_asserted",
      source_stage: "opening",
      source_turn_id,
      fact_roles: [...claim.fact_roles],
      related_dir_ids: related.length ? related : [...claim.related_dir_ids],
      updated_at: now,
    });
    reality_facts.push(fact);
    existingKeys.add(fact_id);
    added += 1;
  }
  if (!added) return session;
  const dirs = reaggregateDirs(dc.dirs, reality_facts, dc.conflicts ?? []);
  return {
    ...session,
    decision_context: {
      ...dc,
      reality_facts,
      dirs,
      updated_at: now,
    },
  };
}
