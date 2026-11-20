import "fake-indexeddb/auto";
import { installIntakeR6TestGlobals } from "../scripts/fixtures/test-browser-globals";
import { withIdbWriteFault } from "../scripts/fixtures/idb-storage-fault";

installIntakeR6TestGlobals("dev_m41_repro");

async function main() {
  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const sm = await import("../lib/poju/session-manager");
  const ledger = await import("../lib/poju/decision-authority/server/ledger-store");
  const { ensureSessionFrozenForDelivery } = await import("../lib/poju/decision-context/production-freeze-wire");
  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  const NOW = "2026-11-10T10:00:00.000Z";
  const sid = await sm.createPOJUSession({ payment_id: "pay_repro", original_question: "q" });
  const s = (await sm.loadPOJUSession(sid))!;
  const dc = {
    context_id: `ctx_${sid}`, version: 1, status: "draft",
    definition: { concrete_event: "e", stakes: "s", desired_outcome: "o", decision_question: "q", goal_priorities: ["a"], unacceptable_outcomes: ["b"] },
    reality_facts: [{ fact_id: "f_conf", statement: "x", status: "confirmed", verification_level: "user_asserted", source_stage: "collecting", source_turn_id: "t1", user_confirmed: true }],
    constraints: [], hypotheses: [],
    dirs: [{ dir_id: "dir_options", need: "n", why: "w", required_fact_roles: ["option"], current_state: "unknown", partial_satisfaction: false, agenda_item_ids: [], may_affect_p5_ranking: false, id_lifecycle: "active" }],
    conflicts: [], content_hash: null, created_at: NOW, updated_at: NOW, information_boundaries: [],
  } as any;
  dc.content_hash = computeContentHash(dc);
  const ev = [{ event_id: "e1", target_type: "fact", fact_id: "f_conf", source_turn_id: "t1", confirmation_turn_id: null, confirmation_action_id: "a1", event_type: "confirm_fact", actor: "user", confirmed_at: NOW, event_version: 1 }];
  await sm.savePOJUSessionCore({
    ...s,
    decision_blueprint: { blueprint_id: "bp", blueprint_version: 1, ddr_version: "t", dir_catalog_version: "t", session_id: sid, context_id: dc.context_id, decision_question: "q", definition_snapshot: dc.definition, directions: [], dir_ids: ["dir_options"] } as any,
    confirmation_events: ev as any,
    decision_context: dc,
  });
  const before = (await sm.loadPOJUSession(sid))!;
  const profile = { profile_id: "p", birth_info: { year: 1985, month: 7, day: 15, hour_period: "chou", gender: "M", timezone: "Asia/Shanghai" } };
  const { value: first, hits } = await withIdbWriteFault("pojuSessionRecords", () =>
    ensureSessionFrozenForDelivery(before, { trigger: "sufficiency_end_confirm", profile }),
  );
  console.log("first", hits, first.ok, (first as any).reason_code, (first as any).reason);
  console.log("server head", (await ledger.readLedgerHead(sid))?.change_type);
  const reloaded = (await sm.loadPOJUSession(sid))!;
  console.log("local", reloaded.decision_context?.status, reloaded.dc_ledger?.head.commit_version);
  const retry = await ensureSessionFrozenForDelivery(reloaded, { trigger: "sufficiency_end_confirm", profile });
  console.log("retry", retry.ok, (retry as any).reason_code, (retry as any).reason);
}
main().catch((e) => { console.error(e); process.exit(1); });
