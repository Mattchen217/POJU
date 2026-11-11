/**
 * M4 — server-authoritative Decision Context ledger, Freeze seal and profile provenance.
 *
 *   pnpm test:m4-decision-authority
 *
 * Real: ledger rules, append/idempotency/concurrency on the process-memory KV, HMAC
 * receipts, server Freeze (freezeDecisionContext + production N/A authority builder),
 * server profile recompute (shunshi-bazi-core + iztro), M3 start verification, device
 * Session CAS hook on fake-indexeddb with the in-process transport.
 * Not exercised: Upstash Redis, HTTP route over a network, real OpenRouter / model calls.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { installInProcessDecisionAuthority } from "./fixtures/in-process-decision-authority";

installIntakeR6TestGlobals("dev_m4_decision_authority");

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

async function main() {
  console.log("M4 decision authority — ledger / Freeze seal / profile provenance / M3 start");

  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const { durableKv } = await import("../lib/kv/client");
  const ledger = await import("../lib/poju/decision-authority/server/ledger-store");
  const freezeAuth = await import("../lib/poju/decision-authority/server/freeze-authority");
  const profileAuth = await import("../lib/poju/decision-authority/server/profile-authority");
  const signing = await import("../lib/poju/decision-authority/server/signing");
  const hash = await import("../lib/poju/decision-authority/hash");
  const authTypes = await import("../lib/poju/decision-authority/types");
  const transport = await import("../lib/poju/decision-authority/client-transport");
  const clientSync = await import("../lib/poju/decision-authority/client-sync");
  const pa = await import("../lib/poju/decision-intake/personal-analysis");
  const service = await import("../lib/poju/decision-intake/decision-report-service");
  const reportTypes = await import("../lib/poju/decision-intake/decision-report-types");
  const { runWithEphemeralXhighKv } = await import("../lib/poju/xhigh-job-store");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const sm = await import("../lib/poju/session-manager");
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
  const { ensureSessionFrozenForDelivery } = await import("../lib/poju/decision-context/production-freeze-wire");

  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type ConfirmationEvent = import("../lib/poju/decision-context/confirmation-event").ConfirmationEvent;
  type DecisionBlueprint = import("../lib/poju/decision-intake/types").DecisionBlueprint;
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const NOW = "2026-11-10T10:00:00.000Z";
  const BIRTH_A = { year: 1985, month: 7, day: 15, hour_period: "chou", gender: "M", timezone: "Asia/Shanghai" };
  const BIRTH_B = { year: 1992, month: 3, day: 2, hour_period: "wu", gender: "F", timezone: "Asia/Shanghai" };

  function draft(opts: {
    context_id: string;
    version?: number;
    parent_version?: number;
    extraFact?: { id: string; statement: string; confirmed?: boolean };
    blocking?: boolean;
  }): DecisionContext {
    const dc: DecisionContext = {
      context_id: opts.context_id,
      version: opts.version ?? 1,
      ...(opts.parent_version != null ? { parent_version: opts.parent_version } : {}),
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
        {
          fact_id: "f_conf",
          statement: "现岗位月收入已确认",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t1",
          user_confirmed: true,
        },
        {
          fact_id: "f_unv",
          statement: "新公司团队氛围据说不错",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t2",
          user_confirmed: false,
        },
        ...(opts.extraFact
          ? [
              {
                fact_id: opts.extraFact.id,
                statement: opts.extraFact.statement,
                status: (opts.extraFact.confirmed ? "confirmed" : "unverified") as "confirmed" | "unverified",
                verification_level: "user_asserted" as const,
                source_stage: "user_supplement",
                source_turn_id: "t9",
                user_confirmed: opts.extraFact.confirmed === true,
              },
            ]
          : []),
      ],
      constraints: [],
      hypotheses: [],
      dirs: [
        {
          dir_id: "dir_options",
          need: "新岗位的真实职责范围",
          why: "决定路径排序",
          required_fact_roles: ["option"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: opts.blocking === true,
          id_lifecycle: "active",
        },
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

  function evt(fact_id: string, turn: string, id = `e_${fact_id}`): ConfirmationEvent {
    return {
      event_id: id,
      target_type: "fact",
      fact_id,
      source_turn_id: turn,
      confirmation_turn_id: null,
      confirmation_action_id: `a_${id}`,
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at: NOW,
      event_version: 1,
    };
  }

  function blueprint(session_id: string, context_id: string, v = 1): DecisionBlueprint {
    return {
      blueprint_id: `bp_${session_id}`,
      blueprint_version: v,
      ddr_version: "t",
      dir_catalog_version: "t",
      session_id,
      context_id,
      decision_question: "要不要接受新公司的工作邀请",
      definition_snapshot: draft({ context_id }).definition,
      directions: [],
      dir_ids: ["dir_options"],
    } as unknown as DecisionBlueprint;
  }

  const EVENTS = [evt("f_conf", "t1")];

  async function genesis(sid: string, dc: DecisionContext, key = `k_gen_${sid}`) {
    const r = await ledger.appendDcLedgerCommit({
      session_id: sid,
      writer_token: null,
      idempotency_key: key,
      source_op: "test",
      expected_previous: null,
      snapshot: dc,
      blueprint: blueprint(sid, dc.context_id),
      confirmation_events: EVENTS,
    });
    assert.ok(r.ok, r.ok ? "" : `${r.code}: ${r.error}`);
    return r.ok ? r : (null as never);
  }

  async function failCode(p: Promise<unknown>): Promise<string> {
    try {
      const r = (await p) as { ok?: boolean; code?: string };
      if (r && r.ok === false) return r.code ?? "?";
      return "ok";
    } catch (e) {
      return (e as { code?: string }).code ?? (e instanceof Error ? e.message : String(e));
    }
  }

  function envelope(events = EVENTS) {
    return {
      confirmation_events: events,
      na_declaration_actions: [],
      topic_applicability_evals: [],
      profile_state: {
        selected_stored_profile_id: "p_a",
        has_profile: true,
        birth_submitted_in_session: false,
        profile_skipped: false,
      },
    };
  }

  async function seal(sid: string, token: string, head: import("../lib/poju/decision-authority/types").DcLedgerHeadRef, dc: DecisionContext, birth: unknown = BIRTH_A) {
    return freezeAuth.sealFreeze({
      session_id: sid,
      writer_token: token,
      expected: {
        commit_version: head.commit_version,
        entry_hash: head.entry_hash,
        context_id: dc.context_id,
        dc_version: dc.version,
        content_hash: computeContentHash(dc),
      },
      authority: envelope(),
      profile: birth ? { profile_id: "p_a", birth_info: birth } : null,
    });
  }

  // ─── Part 1: ledger append rules ───────────────────────────────────────────

  await check("genesis commit: draft accepted, writer token issued, server-classified change type", async () => {
    const r = await genesis("sess_l1", draft({ context_id: "ctx_l1" }));
    assert.equal(r.outcome, "committed");
    assert.equal(r.head.commit_version, 1);
    assert.equal(r.head.change_type, "genesis");
    assert.equal(r.head.dc_status, "draft");
    assert.ok(r.writer_token.length >= 32);
    const e = await ledger.loadLedgerEntry("sess_l1", 1);
    assert.equal(e?.previous_entry_hash, null);
    assert.equal(e?.provenance.promoted_fact_ids.join(","), "f_conf");
    assert.equal(e?.provenance.confirmation_events.length, 1);
    assert.ok(e?.blueprint_hash && e.blueprint_version === 1);
  });

  await check("duplicate request (network retry) returns the same effective commit, no second entry", async () => {
    const r = await genesis("sess_l1", draft({ context_id: "ctx_l1" }));
    assert.equal(r.outcome, "duplicate");
    assert.equal(r.head.commit_version, 1);
    assert.equal(await ledger.loadLedgerEntry("sess_l1", 2), null);
  });

  await check("same idempotency key with different content is refused, effective commit returned", async () => {
    const first = await genesis("sess_l1", draft({ context_id: "ctx_l1" }));
    const r = await ledger.appendDcLedgerCommit({
      session_id: "sess_l1",
      writer_token: first.writer_token,
      idempotency_key: "k_gen_sess_l1",
      source_op: "test",
      expected_previous: { commit_version: 1, entry_hash: first.head.entry_hash },
      snapshot: draft({ context_id: "ctx_l1", extraFact: { id: "f_x", statement: "x" } }),
      blueprint: null,
      confirmation_events: EVENTS,
    });
    assert.equal(r.ok, false);
    assert.equal(!r.ok ? r.code : "", "DC_LEDGER_IDEMPOTENCY_CONFLICT");
    assert.equal(!r.ok ? r.effective?.head.commit_version : 0, 1);
  });

  await check("model-made confirmation (no user Confirmation Event) is refused", async () => {
    const dc = draft({ context_id: "ctx_l2" });
    const code = await failCode(
      ledger.appendDcLedgerCommit({
        session_id: "sess_l2",
        writer_token: null,
        idempotency_key: "k1",
        source_op: "test",
        expected_previous: null,
        snapshot: dc,
        blueprint: null,
        confirmation_events: [],
      }),
    );
    assert.equal(code, "DC_LEDGER_UNBACKED_CONFIRMATION");
    const forged = { ...evt("f_conf", "t1"), actor: "assistant" } as unknown as ConfirmationEvent;
    const code2 = await failCode(
      ledger.appendDcLedgerCommit({
        session_id: "sess_l2",
        writer_token: null,
        idempotency_key: "k2",
        source_op: "test",
        expected_previous: null,
        snapshot: dc,
        blueprint: null,
        confirmation_events: [forged],
      }),
    );
    assert.equal(code2, "DC_LEDGER_UNBACKED_CONFIRMATION");
    assert.equal(await ledger.readLedgerHead("sess_l2"), null, "nothing committed");
  });

  await check("version transitions: no regression, no context swap, no client-written final; draft bumps coalesce", async () => {
    const sid = "sess_l3";
    const g = await genesis(sid, draft({ context_id: "ctx_l3", version: 2 }));
    const base = { session_id: sid, writer_token: g.writer_token, source_op: "test", blueprint: null, confirmation_events: EVENTS };
    const exp = { commit_version: 1, entry_hash: g.head.entry_hash };
    assert.equal(
      await failCode(ledger.appendDcLedgerCommit({ ...base, idempotency_key: "b", expected_previous: exp, snapshot: draft({ context_id: "ctx_l3", version: 1 }) })),
      "DC_LEDGER_VERSION_REGRESSION",
    );
    assert.equal(
      await failCode(ledger.appendDcLedgerCommit({ ...base, idempotency_key: "c", expected_previous: exp, snapshot: draft({ context_id: "ctx_other", version: 2 }) })),
      "DC_LEDGER_CONTEXT_CHANGED",
    );
    const fin = { ...draft({ context_id: "ctx_l3", version: 2 }), status: "final" as const };
    assert.equal(
      await failCode(ledger.appendDcLedgerCommit({ ...base, idempotency_key: "d", expected_previous: exp, snapshot: fin })),
      "DC_LEDGER_STATUS_FORBIDDEN",
    );
    // One device write may carry several local draft bumps (answer + N/A in one turn).
    const ok = await ledger.appendDcLedgerCommit({
      ...base,
      idempotency_key: "e",
      expected_previous: exp,
      snapshot: draft({ context_id: "ctx_l3", version: 4, extraFact: { id: "f_new", statement: "新事实" } }),
    });
    assert.ok(ok.ok, ok.ok ? "" : ok.code);
    if (!ok.ok) return;
    assert.equal(ok.head.change_type, "draft_update");
    assert.equal(ok.head.dc_version, 4);
    assert.equal(ok.head.commit_version, 2, "ledger commit sequence stays continuous");
    const e2 = await ledger.loadLedgerEntry(sid, 2);
    assert.equal(e2?.previous_dc_version, 2);
    assert.equal(e2?.previous_commit_version, 1);
  });

  await check("writer token, stale expected head and Blueprint ownership are enforced", async () => {
    const sid = "sess_l4";
    const g = await genesis(sid, draft({ context_id: "ctx_l4" }));
    const req = {
      session_id: sid,
      source_op: "test",
      blueprint: null,
      confirmation_events: EVENTS,
      snapshot: draft({ context_id: "ctx_l4", extraFact: { id: "f_n", statement: "n" } }),
    };
    assert.equal(
      await failCode(ledger.appendDcLedgerCommit({ ...req, writer_token: "f".repeat(64), idempotency_key: "x1", expected_previous: { commit_version: 1, entry_hash: g.head.entry_hash } })),
      "DC_AUTHORITY_FORBIDDEN",
    );
    assert.equal(
      await failCode(ledger.appendDcLedgerCommit({ ...req, writer_token: g.writer_token, idempotency_key: "x2", expected_previous: null })),
      "DC_LEDGER_HEAD_MISMATCH",
    );
    assert.equal(
      await failCode(
        ledger.appendDcLedgerCommit({
          ...req,
          writer_token: g.writer_token,
          idempotency_key: "x3",
          expected_previous: { commit_version: 1, entry_hash: g.head.entry_hash },
          blueprint: blueprint("someone_else", "ctx_l4"),
        }),
      ),
      "DC_LEDGER_BLUEPRINT_MISMATCH",
    );
  });

  await check("concurrent commits from the same head: exactly one wins; parallel duplicates collapse", async () => {
    const sid = "sess_l5";
    const g = await genesis(sid, draft({ context_id: "ctx_l5" }));
    const mk = (key: string, fid: string) =>
      ledger
        .appendDcLedgerCommit({
          session_id: sid,
          writer_token: g.writer_token,
          idempotency_key: key,
          source_op: "test",
          expected_previous: { commit_version: 1, entry_hash: g.head.entry_hash },
          snapshot: draft({ context_id: "ctx_l5", extraFact: { id: fid, statement: fid } }),
          blueprint: null,
          confirmation_events: EVENTS,
        })
        .catch((e: { code?: string }) => ({ ok: false as const, code: e.code ?? "throw" }));
    const [a, b] = await Promise.all([mk("ka", "f_a"), mk("kb", "f_b")]);
    assert.equal([a, b].filter((r) => r.ok).length, 1, `a=${JSON.stringify(a).slice(0, 80)} b=${JSON.stringify(b).slice(0, 80)}`);
    const loser = [a, b].find((r) => !r.ok) as { code: string };
    assert.ok(["DC_LEDGER_CONCURRENT_COMMIT", "DC_LEDGER_HEAD_MISMATCH"].includes(loser.code), loser.code);
    const head = await ledger.readLedgerHead(sid);
    const [c, d] = await Promise.all([
      ledger.appendDcLedgerCommit({
        session_id: sid,
        writer_token: g.writer_token,
        idempotency_key: "kc",
        source_op: "test",
        expected_previous: { commit_version: head!.commit_version, entry_hash: head!.entry_hash },
        snapshot: draft({ context_id: "ctx_l5", extraFact: { id: "f_c", statement: "c" } }),
        blueprint: null,
        confirmation_events: EVENTS,
      }),
      ledger.appendDcLedgerCommit({
        session_id: sid,
        writer_token: g.writer_token,
        idempotency_key: "kc",
        source_op: "test",
        expected_previous: { commit_version: head!.commit_version, entry_hash: head!.entry_hash },
        snapshot: draft({ context_id: "ctx_l5", extraFact: { id: "f_c", statement: "c" } }),
        blueprint: null,
        confirmation_events: EVENTS,
      }),
    ]);
    assert.ok(c.ok && d.ok);
    assert.equal(c.ok && d.ok ? c.head.commit_version === d.head.commit_version : false, true);
    assert.deepEqual([c.ok ? c.outcome : "", d.ok ? d.outcome : ""].sort(), ["committed", "duplicate"]);
  });

  await check("ledger chain is continuous and tamper-evident", async () => {
    const sid = "sess_l5";
    const head = await ledger.readLedgerHead(sid);
    let prevHash: string | null = null;
    for (let n = 1; n <= head!.commit_version; n += 1) {
      const e = await ledger.loadLedgerEntry(sid, n);
      assert.ok(e, `entry ${n}`);
      assert.equal(e!.previous_entry_hash, prevHash);
      assert.equal(e!.previous_commit_version, n === 1 ? null : n - 1);
      assert.equal(e!.snapshot_hash, hash.dcSnapshotHash(e!.snapshot));
      prevHash = e!.entry_hash;
    }
    const key = `poju-auth:ledger:${sid}:e:1`;
    const raw = await durableKv().get<Record<string, unknown>>(key);
    await durableKv().set(key, { ...raw, change_type: "draft_update" });
    assert.equal(await failCode(ledger.loadLedgerEntry(sid, 1)), "DC_LEDGER_ENTRY_CORRUPT");
    await durableKv().set(key, raw);
  });

  // ─── Part 2: Freeze seal + receipts ───────────────────────────────────────

  const FSID = "sess_f1";
  let fGenesis: Awaited<ReturnType<typeof genesis>>;
  let firstSeal: Extract<Awaited<ReturnType<typeof freezeAuth.sealFreeze>>, { ok: true }>;

  await check("server seals the ledger head: final snapshot commit + signed receipt + profile receipt", async () => {
    const dc = draft({ context_id: "ctx_f1" });
    fGenesis = await genesis(FSID, dc);
    const r = await seal(FSID, fGenesis.writer_token, fGenesis.head, dc);
    assert.ok(r.ok, r.ok ? "" : `${r.code}: ${r.error}`);
    if (!r.ok) return;
    firstSeal = r;
    assert.equal(r.outcome, "sealed");
    assert.equal(r.frozen_dc.status, "final");
    assert.equal(r.receipt.freeze_id, "ctx_f1@v1");
    assert.equal(r.receipt.context_hash, r.frozen_dc.content_hash);
    assert.equal(r.receipt.session_id, FSID);
    assert.equal(r.receipt.blueprint_hash, fGenesis.head.blueprint_hash);
    assert.ok(signing.verifyFreezeReceiptSignature(r.receipt));
    assert.equal(r.head.change_type, "freeze");
    assert.equal(r.head.commit_version, 2);
    assert.ok(r.profile_receipt, "profile recomputed during seal");
    assert.equal(r.profile_receipt!.calculation_timestamp, r.receipt.frozen_at);
    assert.ok(signing.verifyProfileReceiptSignature(r.profile_receipt!));
    const entry = await ledger.loadLedgerEntry(FSID, 2);
    assert.equal(entry?.provenance.freeze?.source_entry_hash, fGenesis.head.entry_hash);
    assert.equal(entry?.dc_status, "final");
  });

  await check("repeated Freeze request returns the identical receipt (no second seal)", async () => {
    const dc = draft({ context_id: "ctx_f1" });
    const r = await seal(FSID, fGenesis.writer_token, fGenesis.head, dc);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.outcome, "duplicate");
    assert.deepEqual(r.receipt, firstSeal.receipt);
    assert.deepEqual(r.profile_receipt, firstSeal.profile_receipt);
    assert.equal(await ledger.loadLedgerEntry(FSID, 3), null);
  });

  await check("forged / altered receipts never verify against the server record", async () => {
    const rec = await freezeAuth.loadVerifiedFreezeRecord(FSID, "ctx_f1@v1");
    const altered = { ...firstSeal.receipt, context_hash: "0".repeat(64) };
    assert.equal(signing.verifyFreezeReceiptSignature(altered), false);
    assert.throws(() => freezeAuth.assertFreezeReceiptMatches(altered, rec), /signature/);
    const selfSigned = { ...firstSeal.receipt, signature: "a".repeat(64) };
    assert.throws(() => freezeAuth.assertFreezeReceiptMatches(selfSigned, rec));
  });

  await check("frozen version is immutable; a goal change opens V2; historical Freeze stays intact", async () => {
    const sameVersion = draft({ context_id: "ctx_f1", extraFact: { id: "f_g", statement: "目标改了" } });
    assert.equal(
      await failCode(
        ledger.appendDcLedgerCommit({
          session_id: FSID,
          writer_token: fGenesis.writer_token,
          idempotency_key: "v1_edit",
          source_op: "test",
          expected_previous: { commit_version: 2, entry_hash: firstSeal.head.entry_hash },
          snapshot: sameVersion,
          blueprint: null,
          confirmation_events: EVENTS,
        }),
      ),
      "DC_LEDGER_FROZEN_IMMUTABLE",
    );
    const v2 = draft({ context_id: "ctx_f1", version: 2, parent_version: 1, extraFact: { id: "f_g", statement: "目标改了" } });
    const open = await ledger.appendDcLedgerCommit({
      session_id: FSID,
      writer_token: fGenesis.writer_token,
      idempotency_key: "v2_open",
      source_op: "test",
      expected_previous: { commit_version: 2, entry_hash: firstSeal.head.entry_hash },
      snapshot: v2,
      blueprint: null,
      confirmation_events: EVENTS,
    });
    assert.ok(open.ok, open.ok ? "" : open.code);
    if (!open.ok) return;
    assert.equal(open.head.change_type, "version_open");
    const s2 = await seal(FSID, fGenesis.writer_token, open.head, v2);
    assert.ok(s2.ok, s2.ok ? "" : `${s2.code}: ${s2.error}`);
    if (!s2.ok) return;
    assert.equal(s2.receipt.freeze_id, "ctx_f1@v2");
    const old = await freezeAuth.loadVerifiedFreezeRecord(FSID, "ctx_f1@v1");
    assert.deepEqual(old.receipt, firstSeal.receipt, "historical Freeze record unchanged");
    assert.equal(old.frozen_dc.version, 1);
  });

  await check("Freeze target must be the latest committed head with matching hash; insufficient DC refused", async () => {
    const sid = "sess_f2";
    const dc = draft({ context_id: "ctx_f2" });
    const g = await genesis(sid, dc);
    const stale = await freezeAuth
      .sealFreeze({
        session_id: sid,
        writer_token: g.writer_token,
        expected: { commit_version: 1, entry_hash: g.head.entry_hash, context_id: "ctx_f2", dc_version: 1, content_hash: "f".repeat(64) },
        authority: envelope(),
        profile: null,
      })
      .catch((e: { code?: string }) => ({ ok: false as const, code: e.code }));
    assert.equal((stale as { code?: string }).code, "FREEZE_TARGET_MISMATCH");

    const sid3 = "sess_f3";
    const blocking = draft({ context_id: "ctx_f3", blocking: true });
    const g3 = await genesis(sid3, blocking);
    const r = await seal(sid3, g3.writer_token, g3.head, blocking).catch((e: { code?: string; message?: string }) => ({
      ok: false as const,
      code: e.code,
      error: e.message,
    }));
    assert.equal(r.ok, false, "insufficient DC must not seal");
    const head = await ledger.readLedgerHead(sid3);
    assert.equal(head?.commit_version, 1, "nothing appended on a refused Freeze");
    assert.equal(head?.dc_status, "draft");
  });

  await check("crash after the seal commit: replay re-materializes the identical record and receipt", async () => {
    const sid = "sess_f4";
    const dc = draft({ context_id: "ctx_f4" });
    const g = await genesis(sid, dc);
    const r1 = await seal(sid, g.writer_token, g.head, dc);
    assert.ok(r1.ok);
    if (!r1.ok) return;
    await durableKv().del(`poju-auth:freeze:${sid}:ctx_f4@v1`);
    await durableKv().del(`poju-auth:profile:${sid}:ctx_f4@v1`);
    const r2 = await seal(sid, g.writer_token, g.head, dc);
    assert.ok(r2.ok, r2.ok ? "" : `${r2.code}: ${r2.error}`);
    if (!r2.ok) return;
    assert.equal(r2.outcome, "duplicate");
    assert.deepEqual(r2.receipt, r1.receipt);
    assert.deepEqual(r2.profile_receipt, r1.profile_receipt);
  });

  await check("concurrent Freeze requests for the same head yield one seal and one receipt", async () => {
    const sid = "sess_f5";
    const dc = draft({ context_id: "ctx_f5" });
    const g = await genesis(sid, dc);
    const [a, b] = await Promise.all([seal(sid, g.writer_token, g.head, dc), seal(sid, g.writer_token, g.head, dc)]);
    assert.ok(a.ok && b.ok, `a=${a.ok ? "ok" : a.code} b=${b.ok ? "ok" : b.code}`);
    if (!a.ok || !b.ok) return;
    assert.deepEqual(a.receipt, b.receipt);
    assert.equal((await ledger.readLedgerHead(sid))?.commit_version, 2);
  });

  // ─── Part 3: profile provenance ────────────────────────────────────────────

  await check("server profile: real engines, deterministic, bound to schema + calculation time", async () => {
    const t = "2026-11-10T12:00:00.000Z";
    const a = await profileAuth.computeServerProfile(BIRTH_A, t);
    const a2 = await profileAuth.computeServerProfile(BIRTH_A, t);
    assert.ok(a.ok && a2.ok);
    if (!a.ok || !a2.ok) return;
    assert.equal(a.profile_hash, a2.profile_hash);
    assert.ok(a.structured.day_master);
    assert.equal(a.source.bazi_engine, "shunshi-bazi-core");
    const later = await profileAuth.computeServerProfile(BIRTH_A, "2027-11-10T12:00:00.000Z");
    assert.ok(later.ok && later.profile_hash !== a.profile_hash);
    const otherSchema = pa.computeProfileHash({
      structured: a.structured,
      ziwei_closed_set: a.ziwei_closed_set,
      calculation_schema_version: "poju-profile-calc-v0",
      calculation_timestamp: t,
    });
    assert.notEqual(otherSchema, a.profile_hash);
    const b = await profileAuth.computeServerProfile(BIRTH_B, t);
    assert.ok(b.ok && b.profile_hash !== a.profile_hash);
    const bad = await profileAuth.computeServerProfile({ year: 1990 }, t);
    assert.equal(bad.ok ? "" : bad.code, "PROFILE_BIRTH_INVALID");
  });

  await check("profile registry: no raw birth stored; tampered chart fails its hash; one profile per Freeze", async () => {
    const rec = await profileAuth.loadVerifiedProfileRecord({
      session_id: FSID,
      freeze_id: "ctx_f1@v1",
      frozen_at: firstSeal.receipt.frozen_at,
    });
    const json = JSON.stringify(rec);
    assert.ok(!json.includes("hour_period") && !json.includes("Asia/Shanghai"), "raw birth input must not be stored");
    assert.equal(rec.source.kind, "server_recompute_from_birth");
    assert.equal(rec.calculation_timestamp, firstSeal.receipt.frozen_at);
    const key = `poju-auth:profile:${FSID}:ctx_f1@v1`;
    const raw = await durableKv().get<Record<string, unknown>>(key);
    await durableKv().set(key, { ...raw, chart_structure: { ...(raw!.chart_structure as object), day_master: "篡改" } });
    assert.equal(
      await failCode(profileAuth.loadVerifiedProfileRecord({ session_id: FSID, freeze_id: "ctx_f1@v1", frozen_at: firstSeal.receipt.frozen_at })),
      "PROFILE_HASH_MISMATCH",
    );
    await durableKv().set(key, raw);
    assert.equal(
      await failCode(
        freezeAuth.registerProfileForFreeze({
          session_id: FSID,
          writer_token: fGenesis.writer_token,
          freeze_receipt: firstSeal.receipt,
          profile_id: "p_b",
          birth_info: BIRTH_B,
        }),
      ),
      "PROFILE_ALREADY_REGISTERED",
    );
  });

  await check("Freeze without birth → profile registered later at the Freeze instant (idempotent)", async () => {
    const sid = "sess_p1";
    const dc = draft({ context_id: "ctx_p1" });
    const g = await genesis(sid, dc);
    const s = await seal(sid, g.writer_token, g.head, dc, null);
    assert.ok(s.ok, s.ok ? "" : `${s.code}: ${s.error}`);
    if (!s.ok) return;
    assert.equal(s.profile_receipt, null);
    const r1 = await freezeAuth.registerProfileForFreeze({
      session_id: sid,
      writer_token: g.writer_token,
      freeze_receipt: s.receipt,
      profile_id: "p_a",
      birth_info: BIRTH_A,
    });
    assert.equal(r1.outcome, "registered");
    assert.equal(r1.receipt.calculation_timestamp, s.receipt.frozen_at);
    const r2 = await freezeAuth.registerProfileForFreeze({
      session_id: sid,
      writer_token: g.writer_token,
      freeze_receipt: s.receipt,
      profile_id: "p_a",
      birth_info: BIRTH_A,
    });
    assert.equal(r2.outcome, "duplicate");
    assert.deepEqual(r2.receipt, r1.receipt);
  });

  // ─── Part 4: M3 start consumes only server authority ──────────────────────

  await runWithEphemeralXhighKv(
    async () => {
      const sid = "sess_s1";
      const dc = draft({ context_id: "ctx_s1" });
      const g = await genesis(sid, dc);
      const s = await seal(sid, g.writer_token, g.head, dc);
      assert.ok(s.ok);
      if (!s.ok) return;

      await check("start verifies receipts and builds the job only from server records", async () => {
        const r = await service.startDecisionReportJob({
          session_id: sid,
          locale: "zh",
          writer_token: g.writer_token,
          freeze_receipt: s.receipt,
          profile_receipt: s.profile_receipt,
          regenerate: false,
        });
        assert.ok(r.ok, r.ok ? "" : `${r.code}: ${r.error}`);
        if (!r.ok) return;
        const input = r.job.input as import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobInput;
        assert.equal(input.freeze_id, "ctx_s1@v1");
        assert.equal(input.context_hash, s.receipt.context_hash);
        assert.equal(input.freeze_receipt_id, s.receipt.receipt_id);
        assert.equal(input.frozen_at, s.receipt.frozen_at);
        assert.equal(input.profile_hash, s.profile_receipt!.profile_hash);
        assert.equal(input.profile_receipt_id, s.profile_receipt!.receipt_id);
        assert.equal(input.profile_calculation_schema_version, authTypes.PROFILE_CALC_SCHEMA_VERSION);
        assert.equal(
          input.analysis_key,
          reportTypes.personalAnalysisIdempotencyKey({
            session_id: sid,
            freeze_id: "ctx_s1@v1",
            context_hash: s.receipt.context_hash,
            profile_hash: s.profile_receipt!.profile_hash,
          }),
        );
        const again = await service.startDecisionReportJob({
          session_id: sid,
          locale: "zh",
          writer_token: g.writer_token,
          freeze_receipt: s.receipt,
          profile_receipt: s.profile_receipt,
          regenerate: false,
        });
        assert.ok(again.ok && again.reused && again.job.job_id === r.job.job_id);
      });

      await check("start refuses missing / altered / foreign receipts and a wrong writer", async () => {
        const base = { session_id: sid, locale: "zh", regenerate: false };
        const r1 = await service.startDecisionReportJob({ ...base, writer_token: g.writer_token, freeze_receipt: null, profile_receipt: s.profile_receipt });
        assert.equal(!r1.ok ? r1.code : "", "FREEZE_RECEIPT_REQUIRED");
        const r2 = await service.startDecisionReportJob({
          ...base,
          writer_token: g.writer_token,
          freeze_receipt: { ...s.receipt, context_hash: "1".repeat(64) },
          profile_receipt: s.profile_receipt,
        });
        assert.equal(!r2.ok ? r2.code : "", "FREEZE_RECEIPT_INVALID");
        const r3 = await service.startDecisionReportJob({ ...base, writer_token: "0".repeat(64), freeze_receipt: s.receipt, profile_receipt: s.profile_receipt });
        assert.equal(!r3.ok ? r3.code : "", "DC_AUTHORITY_FORBIDDEN");
        const r4 = await service.startDecisionReportJob({ ...base, writer_token: g.writer_token, freeze_receipt: s.receipt, profile_receipt: null });
        assert.equal(!r4.ok ? r4.code : "", "PROFILE_RECEIPT_REQUIRED");
        const r5 = await service.startDecisionReportJob({
          ...base,
          writer_token: g.writer_token,
          freeze_receipt: s.receipt,
          profile_receipt: { ...s.profile_receipt!, profile_hash: "2".repeat(64) },
        });
        assert.ok(!r5.ok && ["PROFILE_HASH_MISMATCH", "PROFILE_RECEIPT_INVALID"].includes(r5.code), !r5.ok ? r5.code : "ok");
        const r6 = await service.startDecisionReportJob({
          ...base,
          session_id: "sess_intruder",
          writer_token: g.writer_token,
          freeze_receipt: s.receipt,
          profile_receipt: s.profile_receipt,
        });
        assert.equal(!r6.ok ? r6.code : "", "FREEZE_RECEIPT_INVALID");
      });

      await check("a historical Freeze cannot start a report once V2 is open", async () => {
        const v2 = draft({ context_id: "ctx_s1", version: 2, parent_version: 1, extraFact: { id: "f_v2", statement: "v2" } });
        const open = await ledger.appendDcLedgerCommit({
          session_id: sid,
          writer_token: g.writer_token,
          idempotency_key: "s1_v2",
          source_op: "test",
          expected_previous: { commit_version: s.head.commit_version, entry_hash: s.head.entry_hash },
          snapshot: v2,
          blueprint: null,
          confirmation_events: EVENTS,
        });
        assert.ok(open.ok);
        const r = await service.startDecisionReportJob({
          session_id: sid,
          locale: "zh",
          writer_token: g.writer_token,
          freeze_receipt: s.receipt,
          profile_receipt: s.profile_receipt,
          regenerate: true,
        });
        assert.equal(!r.ok ? r.code : "", "FREEZE_NOT_CURRENT");
      });

      await check("runner sources: projection time is the profile calculation time, not wall clock", async () => {
        const store = await import("../lib/poju/decision-intake/decision-report-store");
        const prof = await store.loadRegisteredProfile({
          session_id: sid,
          freeze_id: "ctx_s1@v1",
          frozen_at: s.receipt.frozen_at,
          profile_hash: s.profile_receipt!.profile_hash,
          receipt_id: s.profile_receipt!.receipt_id,
        });
        const proj = pa.buildProfileProjection(prof);
        assert.equal(proj.calculated_at, s.receipt.frozen_at);
        assert.ok(proj.chart_lines.length >= 2);
        const fr = await store.loadRegisteredFreeze({
          session_id: sid,
          freeze_id: "ctx_s1@v1",
          context_hash: s.receipt.context_hash,
          receipt_id: s.receipt.receipt_id,
        });
        assert.equal(fr.decision_context.content_hash, s.receipt.context_hash);
        assert.equal(await failCode(store.loadRegisteredFreeze({ session_id: sid, freeze_id: "ctx_s1@v1", context_hash: s.receipt.context_hash, receipt_id: "frr_other" })), "FREEZE_CONFLICT");
      });
    },
    { deadlineMs: 5 * 60_000 },
  );

  // ─── Part 5: device Session CAS hook ──────────────────────────────────────

  async function di2Session(payment_id: string, withBlueprint = true): Promise<POJUSessionState> {
    const sid = await sm.createPOJUSession({ payment_id, original_question: "要不要接受新公司的工作邀请" });
    const s = await sm.loadPOJUSession(sid);
    assert.ok(s);
    return {
      ...s!,
      decision_blueprint: withBlueprint ? blueprint(sid, `ctx_${sid}`) : null,
      confirmation_events: EVENTS,
      selected_stored_profile_id: "p_a",
      has_profile: true,
    } as POJUSessionState;
  }

  await check("DI2 Session write commits the DC to the ledger before the local blob; mirror only from server", async () => {
    const s = await di2Session("pay_m4_dev_1");
    const withDc = { ...s, decision_context: draft({ context_id: `ctx_${s.session_id}` }) };
    await sm.savePOJUSessionCore(withDc, { dc_ledger_idempotency_key: `dc_seed:opening:${s.session_id}` });
    const loaded = await sm.loadPOJUSession(s.session_id);
    const head = await ledger.readLedgerHead(s.session_id);
    assert.equal(head?.commit_version, 1);
    assert.equal(head?.idempotency_key, `dc_seed:opening:${s.session_id}`);
    assert.deepEqual(loaded?.dc_ledger?.head, authTypes.headRefFromEntry(head!));
    assert.equal(loaded?.dc_ledger?.head.snapshot_hash, hash.dcSnapshotHash(loaded!.decision_context!));

    await mutatePOJUSession(s.session_id, {
      operation_id: `dc_collect:${s.session_id}:t5`,
      kind: "session_patch",
      apply: (b) => ({
        ...b,
        decision_context: draft({ context_id: `ctx_${s.session_id}`, extraFact: { id: "f_t5", statement: "第五轮回答" } }),
      }),
    } as Parameters<typeof mutatePOJUSession>[1]);
    const h2 = await ledger.readLedgerHead(s.session_id);
    assert.equal(h2?.commit_version, 2);
    assert.equal(h2?.change_type, "draft_update");
    const l2 = await sm.loadPOJUSession(s.session_id);
    assert.equal(l2?.dc_ledger?.head.commit_version, 2);

    await mutatePOJUSession(s.session_id, {
      operation_id: `ui:${s.session_id}:x`,
      kind: "session_patch",
      apply: (b) => ({ ...b, tokens_used: (b.tokens_used ?? 0) + 1 }),
    } as Parameters<typeof mutatePOJUSession>[1]);
    assert.equal((await ledger.readLedgerHead(s.session_id))?.commit_version, 2, "non-DC writes add no commit");
  });

  await check("authority unreachable → local DC write fails (retryable); nothing half-applied", async () => {
    const s = await di2Session("pay_m4_dev_2");
    await sm.savePOJUSessionCore({ ...s, decision_context: draft({ context_id: `ctx_${s.session_id}` }) });
    const before = await sm.loadPOJUSession(s.session_id);
    transport.setDecisionAuthorityTransport({
      append: async () => {
        throw new transport.DecisionAuthorityUnreachableError("offline");
      },
      freeze: async () => {
        throw new transport.DecisionAuthorityUnreachableError("offline");
      },
      registerProfile: async () => {
        throw new transport.DecisionAuthorityUnreachableError("offline");
      },
      head: async () => {
        throw new transport.DecisionAuthorityUnreachableError("offline");
      },
    });
    let err: unknown = null;
    try {
      await mutatePOJUSession(s.session_id, {
        operation_id: `dc_collect:${s.session_id}:off`,
        kind: "session_patch",
        apply: (b) => ({
          ...b,
          decision_context: draft({ context_id: `ctx_${s.session_id}`, extraFact: { id: "f_off", statement: "离线" } }),
        }),
      } as Parameters<typeof mutatePOJUSession>[1]);
    } catch (e) {
      err = e;
    } finally {
      installInProcessDecisionAuthority();
    }
    assert.ok(clientSync.isDcLedgerSyncError(err), String(err));
    assert.equal((err as { retryable: boolean }).retryable, true);
    const after = await sm.loadPOJUSession(s.session_id);
    assert.equal(after?.session_revision, before?.session_revision);
    assert.deepEqual(after?.decision_context, before?.decision_context);
    // Retry with the same operation id once the network is back → exactly one commit.
    await mutatePOJUSession(s.session_id, {
      operation_id: `dc_collect:${s.session_id}:off`,
      kind: "session_patch",
      apply: (b) => ({
        ...b,
        decision_context: draft({ context_id: `ctx_${s.session_id}`, extraFact: { id: "f_off", statement: "离线" } }),
      }),
    } as Parameters<typeof mutatePOJUSession>[1]);
    assert.equal((await ledger.readLedgerHead(s.session_id))?.commit_version, 2);
  });

  await check("lost local mirror write self-heals onto the server head holding the same base", async () => {
    const s = await di2Session("pay_m4_dev_3");
    await sm.savePOJUSessionCore({ ...s, decision_context: draft({ context_id: `ctx_${s.session_id}` }) });
    const base = (await sm.loadPOJUSession(s.session_id))!;
    // Server accepted a Blueprint-only update whose local write never landed.
    const lost = { ...base, decision_blueprint: blueprint(s.session_id, `ctx_${s.session_id}`, 2) };
    await clientSync.syncDcLedgerBeforeWrite({ base, candidate: lost, idempotency_key: "lost_write" });
    assert.equal((await ledger.readLedgerHead(s.session_id))?.commit_version, 2);
    const reloaded = (await sm.loadPOJUSession(s.session_id))!;
    assert.equal(reloaded.dc_ledger?.head.commit_version, 1, "local mirror never saw commit 2");
    // The next write starts from a base that equals the server head on DC but not Blueprint →
    // explicit failure instead of silently overwriting history.
    let err: unknown = null;
    try {
      await mutatePOJUSession(s.session_id, {
        operation_id: `dc_collect:${s.session_id}:after_lost`,
        kind: "session_patch",
        apply: (b) => ({ ...b, decision_context: draft({ context_id: `ctx_${s.session_id}`, extraFact: { id: "f_al", statement: "al" } }) }),
      } as Parameters<typeof mutatePOJUSession>[1]);
    } catch (e) {
      err = e;
    }
    assert.equal((err as { code?: string })?.code, "DC_LEDGER_HEAD_MISMATCH");
    // Same content re-sent under a new operation id after the local write was lost → adopt head.
    const s2 = await di2Session("pay_m4_dev_4");
    await sm.savePOJUSessionCore({ ...s2, decision_context: draft({ context_id: `ctx_${s2.session_id}` }) });
    const b2 = (await sm.loadPOJUSession(s2.session_id))!;
    const nextDc = draft({ context_id: `ctx_${s2.session_id}`, extraFact: { id: "f_lw", statement: "lost write" } });
    await clientSync.syncDcLedgerBeforeWrite({ base: b2, candidate: { ...b2, decision_context: nextDc }, idempotency_key: "lw_1" });
    await sm.savePOJUSessionCore({ ...b2, decision_context: nextDc }, { dc_ledger_idempotency_key: "lw_2" });
    const h = await ledger.readLedgerHead(s2.session_id);
    const l = await sm.loadPOJUSession(s2.session_id);
    assert.equal(h?.commit_version, 2, "no extra commit for the re-sent state");
    assert.equal(l?.dc_ledger?.head.entry_hash, h?.entry_hash);

    // Server head already equals the local base (catch-up commit whose local write was lost) → rebase.
    const s3 = await di2Session("pay_m4_dev_8");
    const dc0 = draft({ context_id: `ctx_${s3.session_id}` });
    await sm.savePOJUSessionCore({ ...s3, decision_context: dc0 });
    const b3 = (await sm.loadPOJUSession(s3.session_id))!;
    const dcX = draft({ context_id: `ctx_${s3.session_id}`, extraFact: { id: "f_x", statement: "x" } });
    const midCandidate = { ...b3, decision_context: dcX };
    await clientSync.syncDcLedgerBeforeWrite({ base: b3, candidate: midCandidate, idempotency_key: "rb_1" });
    await clientSync.syncDcLedgerBeforeWrite({
      base: midCandidate,
      candidate: { ...midCandidate, decision_context: dc0 },
      idempotency_key: "rb_2",
    });
    assert.equal((await ledger.readLedgerHead(s3.session_id))?.commit_version, 3);
    const dcY = draft({ context_id: `ctx_${s3.session_id}`, extraFact: { id: "f_y", statement: "y" } });
    await sm.savePOJUSessionCore({ ...b3, decision_context: dcY }, { dc_ledger_idempotency_key: "rb_3" });
    const h3 = await ledger.readLedgerHead(s3.session_id);
    assert.equal(h3?.commit_version, 4);
    assert.equal(h3?.previous_commit_version, 3);
    assert.equal((await sm.loadPOJUSession(s3.session_id))?.dc_ledger?.head.entry_hash, h3?.entry_hash);
  });

  await check("legacy sessions (no Blueprint) never touch the ledger", async () => {
    const s = await di2Session("pay_m4_dev_5", false);
    await sm.savePOJUSessionCore({ ...s, decision_context: draft({ context_id: `ctx_${s.session_id}` }) });
    assert.equal(await ledger.readLedgerHead(s.session_id), null);
    assert.equal((await sm.loadPOJUSession(s.session_id))?.dc_ledger ?? null, null);
  });

  await check("DI2 Freeze wire: server seal adopted through C1 with receipts; device cannot self-freeze", async () => {
    const s = await di2Session("pay_m4_dev_6");
    await sm.savePOJUSessionCore({ ...s, decision_context: draft({ context_id: `ctx_${s.session_id}` }) });
    const cur = (await sm.loadPOJUSession(s.session_id))!;
    const res = await ensureSessionFrozenForDelivery(cur, {
      trigger: "sufficiency_end_confirm",
      profile: { profile_id: "p_a", birth_info: BIRTH_A },
    });
    assert.ok(res.ok && !res.skipped, JSON.stringify(res).slice(0, 300));
    const after = (await sm.loadPOJUSession(s.session_id))!;
    const head = await ledger.readLedgerHead(s.session_id);
    assert.equal(after.decision_context?.status, "final");
    assert.equal(head?.change_type, "freeze");
    assert.equal(after.dc_ledger?.head.entry_hash, head?.entry_hash);
    assert.equal(hash.dcSnapshotHash(after.decision_context!), head?.snapshot_hash);
    const receipt = after.dc_freeze_receipts?.[0];
    assert.equal(receipt?.freeze_id, `ctx_${s.session_id}@v1`);
    assert.equal(receipt?.context_hash, after.decision_context?.content_hash);
    assert.equal(after.dc_profile_receipts?.[0]?.freeze_id, receipt?.freeze_id);

    // A device-made final for a fresh draft is refused by the ledger → local write fails.
    const s2 = await di2Session("pay_m4_dev_7");
    await sm.savePOJUSessionCore({ ...s2, decision_context: draft({ context_id: `ctx_${s2.session_id}` }) });
    const cur2 = (await sm.loadPOJUSession(s2.session_id))!;
    const selfFrozen = { ...cur2.decision_context!, status: "final" as const };
    let err: unknown = null;
    try {
      await sm.savePOJUSessionCore({ ...cur2, decision_context: selfFrozen });
    } catch (e) {
      err = e;
    }
    assert.equal((err as { code?: string })?.code, "DC_LEDGER_STATUS_FORBIDDEN");
    assert.equal((await sm.loadPOJUSession(s2.session_id))?.decision_context?.status, "draft");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
