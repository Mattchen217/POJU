/**
 * M4.1 — Freeze commit recovery (server sealed, device C1 adoption failed) + strict
 * Freeze ledger anchor.
 *
 *   pnpm test:m4-1-freeze-recovery
 *
 * Device path: production `ensureSessionFrozenForDelivery` → `sealFreezeWithAuthority`
 * → in-process transport (JSON round-trip into the same `handleDecisionAuthority` the
 * API route calls) → server ledger / Freeze / profile on the process-memory KV.
 * C1 failure: real IndexedDB transaction abort on the Session store (fake-indexeddb,
 * scripts/fixtures/idb-storage-fault) — production code is not stubbed.
 * Not exercised: HTTP route over a network, Upstash Redis, multiple devices / tabs,
 * browser UI, real OpenRouter / model calls.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { withIdbWriteFault } from "./fixtures/idb-storage-fault";
import { inProcessDecisionAuthorityTransport } from "./fixtures/in-process-decision-authority";

installIntakeR6TestGlobals("dev_m4_1_freeze_recovery");

const SESSION_STORE = "pojuSessionRecords";

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
  console.log("M4.1 Freeze commit recovery + strict ledger anchor");

  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const { durableKv } = await import("../lib/kv/client");
  const ledger = await import("../lib/poju/decision-authority/server/ledger-store");
  const freezeAuth = await import("../lib/poju/decision-authority/server/freeze-authority");
  const profileAuth = await import("../lib/poju/decision-authority/server/profile-authority");
  const hash = await import("../lib/poju/decision-authority/hash");
  const transport = await import("../lib/poju/decision-authority/client-transport");
  const clientFreeze = await import("../lib/poju/decision-authority/client-freeze");
  const clientSync = await import("../lib/poju/decision-authority/client-sync");
  const service = await import("../lib/poju/decision-intake/decision-report-service");
  const reportClient = await import("../lib/poju/decision-intake/decision-report-client");
  const { runWithEphemeralXhighKv } = await import("../lib/poju/xhigh-job-store");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const sm = await import("../lib/poju/session-manager");
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
  const wire = await import("../lib/poju/decision-context/production-freeze-wire");

  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type ConfirmationEvent = import("../lib/poju/decision-context/confirmation-event").ConfirmationEvent;
  type DecisionBlueprint = import("../lib/poju/decision-intake/types").DecisionBlueprint;
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type Transport = import("../lib/poju/decision-authority/client-transport").DecisionAuthorityTransport;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  // ─── counting in-process transport (to prove which server action the device used) ──
  const calls = { append: 0, freeze: 0, recoverFreeze: 0, registerProfile: 0, head: 0 };
  const resetCalls = () => {
    for (const k of Object.keys(calls) as (keyof typeof calls)[]) calls[k] = 0;
  };
  const inner = inProcessDecisionAuthorityTransport();
  const counting: Transport = {
    append: (r) => ((calls.append += 1), inner.append(r)),
    freeze: (r) => ((calls.freeze += 1), inner.freeze(r)),
    recoverFreeze: (r) => ((calls.recoverFreeze += 1), inner.recoverFreeze(r)),
    registerProfile: (r) => ((calls.registerProfile += 1), inner.registerProfile(r)),
    head: (r) => ((calls.head += 1), inner.head(r)),
  };
  transport.setDecisionAuthorityTransport(counting);

  const NOW = "2026-11-11T10:00:00.000Z";
  const BIRTH = { year: 1985, month: 7, day: 15, hour_period: "chou", gender: "M", timezone: "Asia/Shanghai" };
  const PROFILE = { profile_id: "p_a", birth_info: BIRTH };

  function draft(context_id: string, opts?: { version?: number; parent_version?: number; extra?: string }): DecisionContext {
    const dc = {
      context_id,
      version: opts?.version ?? 1,
      ...(opts?.parent_version != null ? { parent_version: opts.parent_version } : {}),
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
        ...(opts?.extra
          ? [
              {
                fact_id: `f_${opts.extra}`,
                statement: opts.extra,
                status: "unverified",
                verification_level: "user_asserted",
                source_stage: "collecting",
                source_turn_id: "t2",
                user_confirmed: false,
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
          may_affect_p5_ranking: false,
          id_lifecycle: "active",
        },
      ],
      conflicts: [],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
      information_boundaries: [],
    } as unknown as DecisionContext;
    dc.content_hash = computeContentHash(dc);
    return dc;
  }

  const EVENTS: ConfirmationEvent[] = [
    {
      event_id: "e_f_conf",
      target_type: "fact",
      fact_id: "f_conf",
      source_turn_id: "t1",
      confirmation_turn_id: null,
      confirmation_action_id: "a_f_conf",
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at: NOW,
      event_version: 1,
    } as ConfirmationEvent,
  ];

  function blueprint(session_id: string, context_id: string): DecisionBlueprint {
    return {
      blueprint_id: `bp_${session_id}`,
      blueprint_version: 1,
      ddr_version: "t",
      dir_catalog_version: "t",
      session_id,
      context_id,
      decision_question: "要不要接受新公司的工作邀请",
      definition_snapshot: draft(context_id).definition,
      directions: [],
      dir_ids: ["dir_options"],
    } as unknown as DecisionBlueprint;
  }

  /** DI2 Session with a draft DC committed through the real CAS writer (ledger genesis). */
  async function seededDraft(payment_id: string): Promise<POJUSessionState> {
    const sid = await sm.createPOJUSession({ payment_id, original_question: "要不要接受新公司的工作邀请" });
    const s = (await sm.loadPOJUSession(sid))!;
    await sm.savePOJUSessionCore({
      ...s,
      decision_blueprint: blueprint(sid, `ctx_${sid}`),
      confirmation_events: EVENTS,
      selected_stored_profile_id: "p_a",
      has_profile: true,
      decision_context: draft(`ctx_${sid}`),
    } as POJUSessionState);
    return (await sm.loadPOJUSession(sid))!;
  }

  /** Production Freeze wire with the C1 IndexedDB write aborted: server sealed, device kept its draft. */
  async function sealButLoseLocalCommit(
    s: POJUSessionState,
    profile: typeof PROFILE | null = PROFILE,
  ): Promise<POJUSessionState> {
    const { value, hits } = await withIdbWriteFault(SESSION_STORE, () =>
      wire.ensureSessionFrozenForDelivery(s, { trigger: "sufficiency_end_confirm", profile }),
    );
    assert.equal(hits, 1, "the storage fault must hit the C1 write");
    assert.equal(value.ok, false, JSON.stringify(value).slice(0, 300));
    if (!value.ok) assert.equal(value.reason_code, wire.FREEZE_WIRE_PERSIST_FAIL_CODE);
    const head = await ledger.readLedgerHead(s.session_id);
    assert.equal(head?.change_type, "freeze", "server Freeze was sealed");
    const local = (await sm.loadPOJUSession(s.session_id))!;
    assert.equal(local.decision_context?.status, "draft", "device kept its draft");
    assert.equal(local.dc_ledger?.head.change_type, "genesis", "device kept its old mirror");
    assert.equal((local.dc_freeze_receipts ?? []).length, 0);
    return local;
  }

  function localState(s: POJUSessionState | null) {
    return JSON.stringify({
      dc: s?.decision_context,
      versions: s?.decision_context_versions ?? [],
      mirror: s?.dc_ledger ?? null,
      fr: s?.dc_freeze_receipts ?? [],
      pr: s?.dc_profile_receipts ?? [],
      rev: s?.session_revision,
    });
  }

  async function code(p: Promise<unknown>): Promise<string> {
    try {
      const r = (await p) as { ok?: boolean; code?: string };
      if (r && r.ok === false) return r.code ?? "?";
      return "ok";
    } catch (e) {
      return (e as { code?: string }).code ?? (e instanceof Error ? e.message : String(e));
    }
  }

  function anchorOf(s: POJUSessionState) {
    const dc = s.decision_context!;
    return {
      commit_version: s.dc_ledger!.head.commit_version,
      entry_hash: s.dc_ledger!.head.entry_hash,
      context_id: dc.context_id,
      dc_version: dc.version,
      content_hash: computeContentHash(dc),
    };
  }

  // ─── 1. C1 failure after server seal → production wire retry recovers ─────

  let recoveredSession: POJUSessionState = null as never;

  await check("1 server sealed, C1 aborted, wire retry → recovered via recover_freeze; one Freeze entry", async () => {
    const s = await seededDraft("pay_m41_1");
    const local = await sealButLoseLocalCommit(s);
    const serverHead = (await ledger.readLedgerHead(s.session_id))!;
    const record = await freezeAuth.loadVerifiedFreezeRecord(s.session_id, `ctx_${s.session_id}@v1`);

    resetCalls();
    const retry = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: PROFILE });
    assert.ok(retry.ok && !retry.skipped, JSON.stringify(retry).slice(0, 300));
    assert.equal(calls.recoverFreeze, 1, "device used the recovery action");
    assert.equal(calls.freeze, 0, "no new seal requested");

    const after = (await sm.loadPOJUSession(s.session_id))!;
    assert.equal(after.decision_context?.status, "final");
    assert.equal(after.decision_context?.content_hash, record.context_hash);
    assert.deepEqual(after.dc_freeze_receipts, [record.receipt]);
    const prof = await profileAuth.loadVerifiedProfileRecord({ session_id: s.session_id, freeze: record });
    assert.deepEqual(after.dc_profile_receipts, [prof.receipt], "original profile receipt recovered");
    assert.equal(after.dc_ledger?.head.entry_hash, serverHead.entry_hash, "mirror = server Freeze head");
    assert.equal(after.dc_ledger?.head.change_type, "freeze");
    assert.equal(after.dc_ledger?.writer_token, local.dc_ledger?.writer_token);
    assert.equal((await ledger.readLedgerHead(s.session_id))?.commit_version, serverHead.commit_version);
    assert.equal(await ledger.loadLedgerEntry(s.session_id, serverHead.commit_version + 1), null, "no second Freeze entry");
    recoveredSession = after;
  });

  await check("1b a draft write landing on the unadopted Freeze fails as REMOTE_FROZEN (not a draft conflict); wire then recovers", async () => {
    const s = await seededDraft("pay_m41_1b");
    const local = await sealButLoseLocalCommit(s);
    let err: unknown = null;
    try {
      await mutatePOJUSession(s.session_id, {
        operation_id: `dc_collect:${s.session_id}:late`,
        kind: "session_patch",
        apply: (b) => ({ ...b, decision_context: draft(`ctx_${s.session_id}`, { extra: "late answer" }) }),
      } as Parameters<typeof mutatePOJUSession>[1]);
    } catch (e) {
      err = e;
    }
    assert.ok(clientSync.isDcLedgerSyncError(err), String(err));
    assert.equal((err as { code: string }).code, clientSync.DC_LEDGER_REMOTE_FROZEN);
    assert.equal((err as { head: { change_type: string } }).head.change_type, "freeze");
    assert.equal(localState(await sm.loadPOJUSession(s.session_id)), localState(local), "local state untouched");
    const retry = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: PROFILE });
    assert.ok(retry.ok && !retry.skipped, JSON.stringify(retry).slice(0, 300));
    assert.equal((await sm.loadPOJUSession(s.session_id))?.decision_context?.status, "final");
  });

  // ─── 2. repeated recovery ──────────────────────────────────────────────────

  await check("2 recovering the same old draft twice → identical receipts, no extra ledger entry", async () => {
    const s = await seededDraft("pay_m41_2");
    const local = await sealButLoseLocalCommit(s);
    const headBefore = (await ledger.readLedgerHead(s.session_id))!;
    resetCalls();
    const a = await clientFreeze.sealFreezeWithAuthority(local, { profile: PROFILE });
    const b = await clientFreeze.sealFreezeWithAuthority(local, { profile: PROFILE });
    assert.equal(a.outcome, "recovered");
    assert.equal(b.outcome, "recovered");
    assert.equal(calls.recoverFreeze, 2);
    assert.equal(calls.freeze, 0);
    assert.deepEqual(a.receipt, b.receipt);
    assert.deepEqual(a.profile_receipt, b.profile_receipt);
    assert.deepEqual(a.frozen_dc, b.frozen_dc);
    assert.deepEqual(a.mirror.head, b.mirror.head);
    const s1 = await freezeAuth.recoverFreeze({ session_id: s.session_id, writer_token: local.dc_ledger!.writer_token, expected: anchorOf(local) });
    const s2 = await freezeAuth.recoverFreeze({ session_id: s.session_id, writer_token: local.dc_ledger!.writer_token, expected: anchorOf(local) });
    assert.ok(s1.ok && s2.ok);
    if (s1.ok && s2.ok) assert.deepEqual(s1.receipt, s2.receipt);
    assert.equal((await ledger.readLedgerHead(s.session_id))?.entry_hash, headBefore.entry_hash);
    assert.equal(await ledger.loadLedgerEntry(s.session_id, headBefore.commit_version + 1), null);
  });

  // ─── 3. wrong source / token → refused, local untouched ───────────────────

  await check("3 wrong source commit / entry hash / context / version / token → refused; local state unchanged", async () => {
    const s = await seededDraft("pay_m41_3");
    const local = await sealButLoseLocalCommit(s);
    const sid = s.session_id;
    const token = local.dc_ledger!.writer_token;
    const good = anchorOf(local);
    const rec = (expected: typeof good, writer_token = token) =>
      code(freezeAuth.recoverFreeze({ session_id: sid, writer_token, expected }));
    assert.equal(await rec({ ...good, commit_version: 2 }), "FREEZE_RECOVERY_SOURCE_MISMATCH");
    assert.equal(await rec({ ...good, commit_version: 9 }), "FREEZE_RECOVERY_SOURCE_MISMATCH");
    assert.equal(await rec({ ...good, entry_hash: "0".repeat(64) }), "FREEZE_RECOVERY_SOURCE_MISMATCH");
    assert.equal(await rec({ ...good, context_id: "ctx_other" }), "FREEZE_RECOVERY_SOURCE_MISMATCH");
    assert.equal(await rec({ ...good, dc_version: 2 }), "FREEZE_RECOVERY_SOURCE_MISMATCH");
    assert.equal(await rec({ ...good, content_hash: "1".repeat(64) }), "FREEZE_RECOVERY_SOURCE_MISMATCH");
    assert.equal(await rec(good, "f".repeat(64)), "DC_AUTHORITY_FORBIDDEN");
    assert.equal(await code(freezeAuth.recoverFreeze({ session_id: "sess_nobody", writer_token: token, expected: good })), "DC_LEDGER_NOT_FOUND");

    // Same refusals through the device path: nothing reaches the local Session.
    const before = localState(await sm.loadPOJUSession(sid));
    const variants: Array<[string, POJUSessionState]> = [
      ["entry_hash", { ...local, dc_ledger: { ...local.dc_ledger!, head: { ...local.dc_ledger!.head, entry_hash: "0".repeat(64) } } }],
      ["commit_version", { ...local, dc_ledger: { ...local.dc_ledger!, head: { ...local.dc_ledger!.head, commit_version: 2 } } }],
      ["writer_token", { ...local, dc_ledger: { ...local.dc_ledger!, writer_token: "f".repeat(64) } }],
      ["context_id", { ...local, dc_ledger: { ...local.dc_ledger!, head: { ...local.dc_ledger!.head, context_id: "ctx_other" } } }],
      ["dc_version", { ...local, dc_ledger: { ...local.dc_ledger!, head: { ...local.dc_ledger!.head, dc_version: 2 } } }],
    ];
    for (const [label, v] of variants) {
      resetCalls();
      const r = await wire.ensureSessionFrozenForDelivery(v, { trigger: "sufficiency_end_confirm", profile: PROFILE });
      assert.equal(r.ok, false, `${label} must be refused`);
      assert.equal(calls.freeze, 0, `${label}: no new seal`);
      assert.equal(localState(await sm.loadPOJUSession(sid)), before, `${label}: local Session unchanged`);
    }
    assert.equal((await ledger.readLedgerHead(sid))?.change_type, "freeze");
  });

  // ─── 4. historical Freeze cannot be recovered over V2 ─────────────────────

  await check("4 Freeze V1, V2 opened + committed elsewhere → old V1 draft gets FREEZE_NOT_CURRENT; V2 kept", async () => {
    const s = await seededDraft("pay_m41_4");
    const local = await sealButLoseLocalCommit(s);
    const sid = s.session_id;
    const v1Head = (await ledger.readLedgerHead(sid))!;
    const token = local.dc_ledger!.writer_token;
    const v2 = draft(`ctx_${sid}`, { version: 2, parent_version: 1, extra: "goal changed" });
    const open = await ledger.appendDcLedgerCommit({
      session_id: sid,
      writer_token: token,
      idempotency_key: "v2_open_other_tab",
      source_op: "test",
      expected_previous: { commit_version: v1Head.commit_version, entry_hash: v1Head.entry_hash },
      snapshot: v2,
      blueprint: null,
      confirmation_events: EVENTS,
    });
    assert.ok(open.ok, open.ok ? "" : open.code);
    const v2Head = (await ledger.readLedgerHead(sid))!;

    assert.equal(
      await code(freezeAuth.recoverFreeze({ session_id: sid, writer_token: token, expected: anchorOf(local) })),
      "FREEZE_NOT_CURRENT",
    );
    const before = localState(await sm.loadPOJUSession(sid));
    const r = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: PROFILE });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /FREEZE_NOT_CURRENT/);
    assert.equal(localState(await sm.loadPOJUSession(sid)), before, "V1 never written back over local state");
    assert.equal((await ledger.readLedgerHead(sid))?.entry_hash, v2Head.entry_hash, "server V2 head kept");

    // V2 sealed as well: the old V1 draft is still refused.
    const s2 = await freezeAuth.sealFreeze({
      session_id: sid,
      writer_token: token,
      expected: {
        commit_version: v2Head.commit_version,
        entry_hash: v2Head.entry_hash,
        context_id: v2.context_id,
        dc_version: 2,
        content_hash: computeContentHash(v2),
      },
      authority: {
        confirmation_events: EVENTS,
        na_declaration_actions: [],
        topic_applicability_evals: [],
        profile_state: { selected_stored_profile_id: null, has_profile: false, birth_submitted_in_session: false, profile_skipped: true },
      },
      profile: null,
    });
    assert.ok(s2.ok, s2.ok ? "" : `${s2.code}: ${s2.error}`);
    assert.equal(
      await code(freezeAuth.recoverFreeze({ session_id: sid, writer_token: token, expected: anchorOf(local) })),
      "FREEZE_NOT_CURRENT",
    );
    const r2 = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: PROFILE });
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.match(r2.reason, /FREEZE_NOT_CURRENT/);
    assert.equal(localState(await sm.loadPOJUSession(sid)), before);
  });

  // ─── 5. strict ledger anchor ───────────────────────────────────────────────

  await check("5 Freeze record without / with a corrupted / mismatching ledger anchor is never verified", async () => {
    const s = await seededDraft("pay_m41_5");
    await sealButLoseLocalCommit(s);
    const sid = s.session_id;
    const fid = `ctx_${sid}@v1`;
    const rec = await freezeAuth.loadVerifiedFreezeRecord(sid, fid);
    const entryKey = `poju-auth:ledger:${sid}:e:${rec.freeze_commit_version}`;
    const recordKey = `poju-auth:freeze:${sid}:${fid}`;
    const kv = durableKv();
    const rawEntry = (await kv.get<Record<string, unknown>>(entryKey))!;
    const rawRecord = (await kv.get<Record<string, unknown>>(recordKey))!;
    const reseal = (e: Record<string, unknown>) => {
      const { entry_hash: _drop, ...rest } = e;
      return { ...rest, entry_hash: hash.canonicalHash(rest) };
    };

    await kv.del(entryKey);
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISSING");
    await kv.set(entryKey, rawEntry);

    const snap = rawEntry.snapshot as DecisionContext;
    const alteredSnap = { ...snap, definition: { ...snap.definition, stakes: "changed after freeze" } };
    await kv.set(entryKey, { ...rawEntry, snapshot: alteredSnap });
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_CORRUPT", "unsealed edit");
    await kv.set(entryKey, reseal({ ...rawEntry, snapshot: alteredSnap }));
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISMATCH", "re-hashed snapshot edit");
    await kv.set(
      entryKey,
      reseal({ ...rawEntry, snapshot: alteredSnap, snapshot_hash: hash.dcSnapshotHash(alteredSnap) }),
    );
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISMATCH", "consistent forged snapshot");

    const prov = rawEntry.provenance as { freeze: Record<string, unknown> };
    await kv.set(
      entryKey,
      reseal({ ...rawEntry, provenance: { ...prov, freeze: { ...prov.freeze, source_entry_hash: "2".repeat(64) } } }),
    );
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISMATCH", "provenance edit");
    await kv.set(entryKey, reseal({ ...rawEntry, change_type: "draft_update" }));
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISMATCH", "change_type edit");
    await kv.set(entryKey, reseal({ ...rawEntry, session_id: "sess_other" }));
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISSING", "foreign session entry");
    await kv.set(entryKey, rawEntry);

    await kv.set(recordKey, { ...rawRecord, freeze_commit_version: (rawRecord.freeze_commit_version as number) - 1 });
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISMATCH", "record commit pointer");
    await kv.set(recordKey, { ...rawRecord, source_entry_hash: "3".repeat(64) });
    assert.equal(await code(freezeAuth.loadVerifiedFreezeRecord(sid, fid)), "FREEZE_ANCHOR_MISMATCH", "record source");
    await kv.set(recordKey, rawRecord);

    await freezeAuth.loadVerifiedFreezeRecord(sid, fid);
    // Recovery is fail-closed on a broken anchor too.
    await kv.del(entryKey);
    const local = (await sm.loadPOJUSession(sid))!;
    const before = localState(local);
    const r = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: PROFILE });
    assert.equal(r.ok, false);
    assert.equal(localState(await sm.loadPOJUSession(sid)), before);
    await kv.set(entryKey, rawEntry);
  });

  // ─── 6. profile receipt recovery ──────────────────────────────────────────

  await check("6a Freeze sealed without birth → recovery returns profile_receipt null (nothing invented)", async () => {
    const s = await seededDraft("pay_m41_6a");
    const local = await sealButLoseLocalCommit(s, null);
    const r = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: null });
    assert.ok(r.ok && !r.skipped, JSON.stringify(r).slice(0, 300));
    const after = (await sm.loadPOJUSession(s.session_id))!;
    assert.equal(after.decision_context?.status, "final");
    assert.equal((after.dc_freeze_receipts ?? []).length, 1);
    assert.deepEqual(after.dc_profile_receipts ?? [], [], "no profile receipt invented");
  });

  await check("6b profile registered after the seal but never stored locally → recovery returns that receipt", async () => {
    const s = await seededDraft("pay_m41_6b");
    const local = await sealButLoseLocalCommit(s, null);
    const sid = s.session_id;
    const rec = await freezeAuth.loadVerifiedFreezeRecord(sid, `ctx_${sid}@v1`);
    const reg = await freezeAuth.registerProfileForFreeze({
      session_id: sid,
      writer_token: local.dc_ledger!.writer_token,
      freeze_receipt: rec.receipt,
      profile_id: "p_a",
      birth_info: BIRTH,
    });
    const r = await wire.ensureSessionFrozenForDelivery(local, { trigger: "sufficiency_end_confirm", profile: null });
    assert.ok(r.ok && !r.skipped);
    const after = (await sm.loadPOJUSession(sid))!;
    assert.deepEqual(after.dc_profile_receipts, [reg.receipt]);
  });

  await check("6c profile record not bound to this Freeze is refused (session / freeze / sealed hash)", async () => {
    const a = recoveredSession;
    const fa = await freezeAuth.loadVerifiedFreezeRecord(a.session_id, `ctx_${a.session_id}@v1`);
    const keyA = `poju-auth:profile:${a.session_id}:ctx_${a.session_id}@v1`;
    const rawA = (await durableKv().get<Record<string, unknown>>(keyA))!;
    const s = await seededDraft("pay_m41_6c");
    const sealed = await clientFreeze.sealFreezeWithAuthority(s, { profile: PROFILE });
    const keyB = `poju-auth:profile:${s.session_id}:ctx_${s.session_id}@v1`;
    const rawB = (await durableKv().get<Record<string, unknown>>(keyB))!;
    await durableKv().set(keyA, rawB);
    assert.equal(
      await code(profileAuth.loadVerifiedProfileRecord({ session_id: a.session_id, freeze: fa })),
      "PROFILE_FREEZE_MISMATCH",
    );
    await durableKv().set(keyA, rawA);
    assert.equal(
      await code(profileAuth.loadVerifiedProfileRecord({ session_id: a.session_id, freeze: { ...fa, profile_hash: "4".repeat(64) } })),
      "PROFILE_FREEZE_MISMATCH",
    );
    assert.equal(
      await code(profileAuth.loadVerifiedProfileRecord({ session_id: "sess_other", freeze: fa })),
      "PROFILE_FREEZE_MISMATCH",
    );
    assert.equal(
      await code(profileAuth.loadVerifiedProfileRecord({ session_id: a.session_id, freeze: { ...fa, frozen_at: NOW } })),
      "PROFILE_TIME_MISMATCH",
    );
    assert.ok(sealed.profile_receipt);
  });

  // ─── 7. recovered Session → existing M3 start ─────────────────────────────

  await runWithEphemeralXhighKv(
    async () => {
      await check("7 after recovery the M3 client starts with the recovered Freeze + profile receipts", async () => {
        const s = recoveredSession;
        const originalFetch = globalThis.fetch;
        let startBody: Record<string, unknown> | null = null;
        let startResult: Awaited<ReturnType<typeof service.startDecisionReportJob>> | null = null;
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          if (url !== "/api/poju/decision-report") throw new Error(`unexpected fetch ${url}`);
          const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          startBody = body;
          startResult = await service.startDecisionReportJob({
            session_id: body.session_id as string,
            locale: body.locale as string,
            writer_token: body.writer_token,
            freeze_receipt: body.freeze_receipt,
            profile_receipt: body.profile_receipt,
            regenerate: body.regenerate === true,
          });
          // Stop the client before it polls / runs any stage (no model calls in this test).
          return new Response(JSON.stringify({ ok: false, code: "TEST_HALT_AFTER_START", error: "halt" }), {
            status: 409,
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch;
        let err: unknown = null;
        try {
          await reportClient.runDecisionReportForSession(s, "zh", { persist: async () => {} });
        } catch (e) {
          err = e;
        } finally {
          globalThis.fetch = originalFetch;
        }
        assert.equal((err as { code?: string })?.code, "TEST_HALT_AFTER_START");
        assert.ok(startBody, "client posted start");
        const body = startBody as unknown as Record<string, unknown>;
        assert.equal(body.action, "start");
        assert.deepEqual(body.freeze_receipt, s.dc_freeze_receipts![0]);
        assert.deepEqual(body.profile_receipt, s.dc_profile_receipts![0]);
        assert.equal(body.writer_token, s.dc_ledger!.writer_token);
        assert.ok(!("decision_context" in body) && !("base_analysis" in body), "no DC / chart uploaded");
        const res = startResult as unknown as Awaited<ReturnType<typeof service.startDecisionReportJob>>;
        assert.ok(res && res.ok, res && !res.ok ? `${res.code}: ${res.error}` : "no result");
        if (res.ok) {
          const input = res.job.input as import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobInput;
          assert.equal(input.freeze_receipt_id, s.dc_freeze_receipts![0]!.receipt_id);
          assert.equal(input.profile_receipt_id, s.dc_profile_receipts![0]!.receipt_id);
          assert.equal(input.context_hash, s.decision_context!.content_hash);
        }
      });
    },
    { deadlineMs: 5 * 60_000 },
  );

  transport.setDecisionAuthorityTransport(null);
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
