import { computeContentHash } from "../lib/poju/decision-context/content-hash";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import { appendDcLedgerCommit } from "../lib/poju/decision-authority/server/ledger-store";
import { sealFreeze } from "../lib/poju/decision-authority/server/freeze-authority";

const NOW = "2026-11-10T10:00:00.000Z";

function draft(): DecisionContext {
  const dc: DecisionContext = {
    context_id: "ctx_p",
    version: 1,
    status: "draft",
    definition: {
      concrete_event: "收到一份新的工作邀请，需要在两周内答复",
      stakes: "收入与家庭节奏",
      desired_outcome: "在不拖垮家庭节奏的前提下提升收入",
      decision_question: "要不要接受新公司的工作邀请",
      goal_priorities: ["收入", "家庭节奏"],
      unacceptable_outcomes: ["半年内被迫再次换工作"],
    },
    reality_facts: [
      { fact_id: "f_conf", statement: "现岗位月收入已确认", status: "confirmed", verification_level: "user_asserted", source_stage: "collecting", source_turn_id: "t1", user_confirmed: true },
      { fact_id: "f_unv", statement: "新公司团队氛围据说不错", status: "unverified", verification_level: "user_asserted", source_stage: "collecting", source_turn_id: "t2", user_confirmed: false },
    ],
    constraints: [],
    hypotheses: [],
    dirs: [
      { dir_id: "dir_options", need: "新岗位的真实职责范围", why: "决定路径排序", required_fact_roles: ["option"], current_state: "unknown", partial_satisfaction: false, agenda_item_ids: [], may_affect_p5_ranking: false, id_lifecycle: "active" },
    ],
    conflicts: [],
    content_hash: null,
    created_at: NOW,
    updated_at: NOW,
    information_boundaries: [],
  } as DecisionContext;
  dc.content_hash = computeContentHash(dc);
  return dc;
}

async function main() {
  const dc = draft();
  const ev = [{ event_id: "e1", target_type: "fact", fact_id: "f_conf", source_turn_id: "t1", confirmation_turn_id: null, confirmation_action_id: "a1", event_type: "confirm_fact", actor: "user", confirmed_at: NOW, event_version: 1 }];
  const a = await appendDcLedgerCommit({ session_id: "sess_probe_1", writer_token: null, idempotency_key: "k1", source_op: "probe", expected_previous: null, snapshot: dc, blueprint: null, confirmation_events: ev as never });
  console.log("append", JSON.stringify(a).slice(0, 300));
  if (!a.ok) return;
  const s = await sealFreeze({
    session_id: "sess_probe_1",
    writer_token: a.writer_token,
    expected: { commit_version: a.head.commit_version, entry_hash: a.head.entry_hash, context_id: dc.context_id, dc_version: 1, content_hash: dc.content_hash! },
    authority: { confirmation_events: ev as never, na_declaration_actions: [], topic_applicability_evals: [], profile_state: { selected_stored_profile_id: "p1", has_profile: true, birth_submitted_in_session: false, profile_skipped: false } },
    profile: { profile_id: "p1", birth_info: { year: 1985, month: 7, day: 15, hour_period: "chou", gender: "M", timezone: "Asia/Shanghai" } },
  });
  console.log("seal", s.ok ? JSON.stringify({ outcome: s.outcome, receipt: s.receipt, prof: s.profile_receipt, dirs: s.frozen_dc.dirs }) : JSON.stringify(s));
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
