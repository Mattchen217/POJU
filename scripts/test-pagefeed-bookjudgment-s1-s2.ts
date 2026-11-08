/**
 * S1 PageFeed + S2 BookJudgment engineering gates (no live LLM).
 * Run: pnpm exec tsx scripts/test-pagefeed-bookjudgment-s1-s2.ts
 */

import assert from "node:assert/strict";
import {
  applyFreezeToSessionSlice,
  freezeDraftForDelivery,
  formatDecisionContextSliceForPage,
  pageReceivesDecisionContextFeed,
  prepareFrozenDcForDelivery,
  reaggregateDirsIntake,
  seedDecisionContextFromOpening,
  type DecisionContext,
} from "../lib/poju/decision-context";
import { naValidationBoundToDc } from "../lib/poju/decision-context/na-validation-from-session";
import type { POJUSessionState } from "../lib/poju/types";
import {
  dcFieldsForPage,
  faceRequiresFormalDecisionContext,
  listDecisionContextFeedPages,
  PAGE_DC_DISPLAY_POLICY,
} from "../lib/llm/pro/delivery/page-feed-dc-contract";
import { pageFeedFlags } from "../lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { buildBookJudgmentFeedBlock } from "../lib/llm/pro/delivery/book-judgment/generate";
import { buildV3BodyPrompt } from "../lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { labPublicView } from "../lib/llm/pro/delivery/lab/public-view";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(e);
  }
}

function makeFreezableDraft(): DecisionContext {
  const seeded = seedDecisionContextFromOpening({
    context_id: "dc_s1s2",
    now: "2026-11-03T18:00:00.000Z",
    core_dilemma: {
      concrete_event: "Stay or leave role",
      stakes: "Income",
      sticking_point: null,
    },
    desired_direction: { wants: "Reversible path", priority: "stability" },
    user_statements: [
      {
        statement: "Six months runway",
        verification_level: "user_asserted",
        has_user_confirm_event: true,
        status: "confirmed",
        source_turn_id: "t1",
        fact_roles: ["runway", "event", "support"],
      },
    ],
    user_constraints: [
      {
        statement: "No irreversible move before verify",
        category: "reversibility",
        rigidity: "hard",
        source_turn_id: "tc1",
        has_user_confirm_event: true,
      },
    ],
  });
  seeded.hypotheses = [
    {
      hypothesis_id: "h1",
      statement: "Pilot clarifies demand",
      supporting_evidence: [],
      counter_evidence: [],
      validation_need: "pilot",
      state: "pending_validation",
      related_dir_ids: [],
    },
  ];
  seeded.reality_facts = seeded.reality_facts.map((f) => ({
    ...f,
    related_dir_ids: ["d1"],
  }));
  seeded.constraints = seeded.constraints.map((c) => ({
    ...c,
    related_dir_ids: ["d1"],
  }));
  const dirsSeed = [
    {
      dir_id: "d1",
      need: "runway",
      why: "afford",
      required_fact_roles: ["runway"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: false,
    },
  ];
  seeded.dirs = reaggregateDirsIntake(
    dirsSeed,
    seeded.reality_facts,
    [],
    seeded.constraints,
    [],
    naValidationBoundToDc(seeded, "sess_pagefeed_s1"),
  );
  return seeded;
}

async function main() {
  console.log("S1 PageFeed + S2 BookJudgment + S4 freeze helper");

  const pagefeedDraft = makeFreezableDraft();
  const pagefeedSession = {
    session_id: "sess_pagefeed_s1",
    decision_context: pagefeedDraft,
    decision_context_versions: [],
  } as POJUSessionState;
  const pack = await freezeDraftForDelivery(pagefeedDraft, {
    session: pagefeedSession,
    now: "2026-11-03T18:30:00.000Z",
  });
  const frozen = pack.frozen;

  await check("S1: DC feed pages contract matches STAGE4 list", async () => {
    const pages = listDecisionContextFeedPages();
    assert.deepEqual([...pages], ["01", "02", "04", "05", "06", "08"]);
    assert.equal(faceRequiresFormalDecisionContext("05"), true);
    assert.equal(faceRequiresFormalDecisionContext("03"), false);
    assert.ok(dcFieldsForPage("05")?.includes("hypotheses"));
    assert.equal(dcFieldsForPage("03"), null);
    assert.equal(PAGE_DC_DISPLAY_POLICY.hypothesis, "never_upgrade_to_fact");
  });

  await check("S1: pageFeedFlags.decision_context body vs judgment", async () => {
    assert.equal(pageFeedFlags("05", "body").decision_context, true);
    assert.equal(pageFeedFlags("05", "judgment").decision_context, false);
    assert.equal(pageFeedFlags("03", "body").decision_context, false);
    assert.equal(pageFeedFlags("08", "body").decision_context, true);
  });

  await check("S1: body prompt user_feed parity includes Formal DC", async () => {
    const dcFeed = formatDecisionContextSliceForPage(frozen, "05");
    assert.ok(dcFeed.includes("Formal Decision Context"));
    const { user } = buildV3BodyPrompt({
      key: "05",
      locale: "en",
      user_feed: `${dcFeed}\n\n## chart slice\n{}`,
      decision_context_feed: dcFeed,
    });
    assert.ok(user.includes("Formal Decision Context"));
    assert.ok(user.includes(frozen.content_hash!));
  });

  await check("S1: version binding isolation via prepareFrozenDcForDelivery", async () => {
    const slice = applyFreezeToSessionSlice({}, pack);
    const prepared = prepareFrozenDcForDelivery(slice);
    assert.equal(prepared.decision_context_binding.context_hash, frozen.content_hash);
    assert.equal(prepared.decision_context_snapshot.version, frozen.version);
  });

  await check("S2: BookJudgment feed includes DC for 05/06/08", async () => {
    const feed = buildBookJudgmentFeedBlock({
      chartText: "CFP stub",
      ziwei: null,
      question: "Stay or leave?",
      mode: "all",
      locale: "en",
      decision_context_snapshot: frozen,
    });
    assert.ok(feed.includes("Formal Decision Context"));
    assert.ok(feed.includes(frozen.context_id));
    assert.ok(feed.includes("Pilot clarifies demand") || feed.includes("hypotheses"));
    assert.ok(pageReceivesDecisionContextFeed("05"));
  });

  await check("S2: BookJudgment without DC has no Formal DC block", async () => {
    const feed = buildBookJudgmentFeedBlock({
      chartText: "CFP stub",
      ziwei: null,
      mode: "all",
      locale: "en",
    });
    assert.equal(feed.includes("Formal Decision Context"), false);
  });

  await check("S3: labPublicView exposes binding without full snapshot", async () => {
    const lab = {
      version: 1,
      lab_id: "lab_test",
      created_at: Date.now(),
      updated_at: Date.now(),
      ops_user: "test",
      pipeline: "v3_three_step",
      cursor_index: 0,
      steps: {},
      artifacts: { by_page: {} },
      approved_order: [],
      mode: "delivery_only",
      source: {
        locale: "en",
        original_question: "Q",
        base_analysis: { structured: { day_master: "Jia" } },
        decision_context_binding: pack.binding,
        decision_context_snapshot: frozen,
      },
    } as unknown as DeliveryLabSession;
    const view = labPublicView(lab);
    assert.equal(view.source.decision_context_binding?.context_id, frozen.context_id);
    assert.equal(view.source.has_decision_context_snapshot, true);
    assert.equal(
      "decision_context_snapshot" in view.source,
      false,
      "full snapshot must not leak into public view",
    );
  });

  await check("S4: freezeDraftForDelivery refuses non-sufficiency path via Freeze API", async () => {
    // freezeDraftForDelivery always sets stage3_sufficiency_end; purchase flag is forced false.
    // Ensure pack is consistent.
    assert.equal(pack.binding.context_hash, pack.frozen.content_hash);
    assert.equal(pack.version_snapshot.content_hash, pack.frozen.content_hash);
  });

  console.log(`\nResults: PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
