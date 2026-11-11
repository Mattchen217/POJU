/**
 * M2.4-R2 — Phase 4 production-closure integration tests (HOOK-BASED).
 *
 *   pnpm test:m2-4-r2-production-closure
 *
 * Drives handleUserMessage / runM1ProductionPreLlmTurn with a scripted
 * interpretation hook (no OpenRouter). These prove the deterministic
 * orchestration around the model; they are NOT real-model validation.
 * Real-model evidence: scripts/m2-4-r2-openrouter-smoke.ts and
 * scripts/m2-4-r2-real-e2e.ts.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_m2_4_r2_closure");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

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
  console.log("M2.4-R2 production closure (hook-based orchestration tests)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { runM1ProductionPreLlmTurn } = await import("../lib/poju/collecting-dc-turn");
  const {
    interpretAnswerWithModel,
    buildModelInterpretationContext,
    ANSWER_INTERPRETATION_ROUTE,
  } = await import("../lib/poju/decision-intake/answer-interpretation-model");
  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const { freezeIdFromBinding, prepareFreezeBoundFinalDelivery, loadAuthoritativeFreeze } =
    await import("../lib/poju/decision-intake/freeze-bound-report");
  const route = await import("../app/api/poju/answer-interpretation/route");

  type Session = import("../lib/poju/types").POJUSessionState;
  type Draft = import("../lib/poju/decision-intake/types").ModelAnswerDraft;
  type Ctx = import("../lib/poju/decision-intake/answer-interpretation-model").ModelInterpretationContext;
  type Hooks = NonNullable<Parameters<typeof handleUserMessage>[0]["__testOnlyM1Hooks"]>;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  let fetchMode: "stub" | "route_ok" | "route_timeout" | "route_502" = "stub";
  const routeBodies: unknown[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "/api/poju/chat") {
      return new Response(
        JSON.stringify({ response: "LEGACY_FREEFORM_MUST_NOT_SHOW", collection_progress: "advancing", question_status: "asked" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === ANSWER_INTERPRETATION_ROUTE) {
      routeBodies.push(JSON.parse(String(init?.body ?? "{}")));
      if (fetchMode === "route_ok") {
        const draft: Draft = {
          classification: "clear_answer",
          extracted_items: [],
          unresolved_aspects: [],
          explanation: "route transport",
        };
        return new Response(
          JSON.stringify({ ok: true, text: JSON.stringify(draft), provider: "p", model: "m", finish_reason: "stop" }),
          { status: 200 },
        );
      }
      if (fetchMode === "route_timeout") {
        return new Response(JSON.stringify({ ok: false, error: "timeout" }), { status: 504 });
      }
      return new Response(JSON.stringify({ ok: false, error: "call_failed" }), { status: 502 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const item = (statement: string, code: string | null, quote = statement, certainty: "explicit" | "estimated" | "unclear" = "explicit") => ({
    text: quote,
    semantic_kind: "reality_fact" as const,
    role_hint: null,
    role_code_hint: code,
    certainty,
    source_quote: quote,
    source_start: null,
    source_end: null,
  });

  /** Scripted hook: per-statement drafts, default = clear answer bound to the first authorized role. */
  const script = new Map<string, (ctx: Ctx, statement: string) => unknown>();
  let hookCalls = 0;
  const hooks: Hooks = {
    interpretAnswerModel: ({ context, statement }) => {
      hookCalls += 1;
      const custom = script.get(statement.trim());
      if (custom) return custom(context, statement);
      return {
        classification: "clear_answer",
        extracted_items: [item(statement.trim(), context.authorized.fact_role_codes[0] ?? null)],
        unresolved_aspects: [],
        explanation: "scripted",
      } satisfies Draft;
    },
  };

  async function load(sid: string): Promise<Session> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `missing ${sid}`);
    return s!;
  }
  async function say(sid: string, text: string, h: Hooks = hooks): Promise<Session> {
    const s = await load(sid);
    const out = await handleUserMessage({ session: s, userMessage: text, locale: "zh", __testOnlyM1Hooks: h });
    await savePOJUSession(out);
    return load(sid);
  }
  async function fresh(tag: string): Promise<string> {
    const sid = await createPOJUSession({ payment_id: `pay_m24r2_${tag}`, original_question: "要不要离职去创业？" });
    await say(sid, "我在犹豫要不要离职去创业，家里还有贷款。");
    return sid;
  }
  const lastUser = (s: Session) => [...s.messages].reverse().find((m) => m.role === "user" && !m.is_rejected)!;
  const lastAssistant = (s: Session) => [...s.messages].reverse().find((m) => m.role === "assistant")!;
  const sent = (s: Session) => s.decision_understanding?.last_sent_question ?? null;
  const asked = (s: Session) => s.decision_understanding?.budget.session_asked_count ?? -1;

  try {
    // ---------- Raw answer integrity + persisted locators ----------
    await check("R2C-01 raw answer record per turn + persisted locators, statement = raw answer", async () => {
      const sid = await fresh("c01");
      const raw = "  收入靠服务费，每家月费八千；关键依赖是三家工厂资源。  ";
      script.set(raw.trim(), (ctx) => ({
        classification: "clear_answer",
        extracted_items: [
          item(raw.trim(), ctx.authorized.fact_role_codes[0]!, "收入靠服务费，每家月费八千"),
          item(raw.trim(), ctx.authorized.fact_role_codes[0]!, "关键依赖是三家工厂资源"),
        ],
        unresolved_aspects: [],
        explanation: "MODEL PARAPHRASE MUST NOT BE STORED",
      }));
      const s = await say(sid, raw);
      const turnId = lastUser(s).client_id!;
      const rec = s.intake_answer_sources!.find((r) => r.source_turn_id === turnId)!;
      assert.equal(rec.raw_user_statement, raw.trim());
      assert.equal(rec.turn_kind, "ordinary_answer");
      assert.ok(rec.sent_question_id);
      const facts = s.decision_context!.reality_facts.filter((f) => f.source_turn_id === turnId);
      assert.equal(facts.length, 1);
      assert.equal(facts[0]!.statement, raw.trim());
      const audit = rec.interpretation!;
      assert.equal(audit.writes.length, 1);
      assert.equal(audit.writes[0]!.locators.length, 2);
      for (const loc of audit.writes[0]!.locators) {
        assert.equal(raw.trim().slice(loc.located_start!, loc.located_end!), loc.source_quote);
      }
      assert.equal(JSON.stringify(s.decision_context).includes("MODEL PARAPHRASE"), false);
    });

    // ---------- Model failure fails closed ----------
    await check("R2C-02 model failure: no write, no version bump, no charge, same question, raw kept", async () => {
      const sid = await fresh("c02");
      const before = await load(sid);
      const failing: Hooks = {
        interpretAnswerModel: () => {
          throw new Error("llm_timeout");
        },
      };
      const after = await say(sid, "我打算做代运营。", failing);
      assert.equal(after.decision_context!.version, before.decision_context!.version);
      assert.equal(after.decision_context!.reality_facts.length, before.decision_context!.reality_facts.length);
      assert.equal(sent(after)!.plan_id, sent(before)!.plan_id);
      assert.equal(asked(after), asked(before));
      assert.match(lastAssistant(after).content, /^【系统】/);
      const turnId = lastUser(after).client_id!;
      assert.ok(after.intake_answer_sources!.some((r) => r.source_turn_id === turnId && !r.interpretation));
      // Invalid model JSON fails the same way.
      const invalid: Hooks = { interpretAnswerModel: () => "这不是JSON" };
      const after2 = await say(sid, "我打算做代运营。", invalid);
      assert.equal(after2.decision_context!.version, before.decision_context!.version);
      assert.equal(asked(after2), asked(before));
      // Recovery: next valid answer commits.
      const ok = await say(sid, "我打算做代运营。");
      assert.equal(ok.decision_context!.version, before.decision_context!.version + 1);
    });

    // ---------- Single call per turn ----------
    await check("R2C-03 exactly one model call per ordinary turn (no second judge)", async () => {
      const sid = await fresh("c03");
      hookCalls = 0;
      await say(sid, "我打算做跨境代运营。");
      assert.equal(hookCalls, 1);
    });

    // ---------- Cross-turn correction ----------
    await check("R2C-04 correction of an earlier turn binds to that turn's role and links the old fact", async () => {
      const sid = await fresh("c04");
      const s1 = await say(sid, "每家客户月费八千。");
      const t1 = lastUser(s1).client_id!;
      const oldFact = s1.decision_context!.reality_facts.find((f) => f.source_turn_id === t1)!;
      const oldCode = `v1/dir/${oldFact.related_dir_ids![0]}/role/${oldFact.fact_roles![0]}`;
      assert.notDeepEqual(sent(s1)!.fact_role_codes, [oldCode], "next question must be a different role");
      let seenCtx: Ctx | null = null;
      const corr = "更正一下，月费其实是一万二，不是八千。";
      script.set(corr, (ctx) => {
        seenCtx = ctx;
        return {
          classification: "correction",
          extracted_items: [item(corr, oldCode, "月费其实是一万二，不是八千")],
          unresolved_aspects: [],
          explanation: "",
        };
      });
      const s2 = await say(sid, corr);
      assert.ok(seenCtx);
      assert.ok(seenCtx!.correctable_prior_answers.some((p) => p.role_code === oldCode));
      const t2 = lastUser(s2).client_id!;
      const newFact = s2.decision_context!.reality_facts.find((f) => f.source_turn_id === t2)!;
      assert.equal(newFact.statement, corr);
      assert.deepEqual(newFact.corrects_fact_ids, [oldFact.fact_id]);
      assert.ok(s2.decision_context!.reality_facts.some((f) => f.fact_id === oldFact.fact_id), "old fact kept");
      assert.equal(s2.decision_context!.conflicts.length, s1.decision_context!.conflicts.length);
    });

    await check("R2C-05 a prior role code is NOT authorized for non-correction classes (no role widening)", async () => {
      const sid = await fresh("c05");
      const s1 = await say(sid, "每家客户月费八千。");
      const t1 = lastUser(s1).client_id!;
      const oldFact = s1.decision_context!.reality_facts.find((f) => f.source_turn_id === t1)!;
      const oldCode = `v1/dir/${oldFact.related_dir_ids![0]}/role/${oldFact.fact_roles![0]}`;
      const sneaky = "另外，月费还要再加上咨询费。";
      script.set(sneaky, () => ({
        classification: "supplement",
        extracted_items: [item(sneaky, oldCode)],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s2 = await say(sid, sneaky);
      const t2 = lastUser(s2).client_id!;
      assert.equal(
        s2.decision_context!.reality_facts.filter((f) => f.source_turn_id === t2 && (f.related_dir_ids ?? []).includes(oldFact.related_dir_ids![0]!)).length,
        0,
      );
      const audit = s2.intake_answer_sources!.find((r) => r.source_turn_id === t2)!.interpretation!;
      assert.ok(audit.unresolved.some((u) => u.reason === "unauthorized_role_code"));
    });

    // ---------- Unknown refund + information boundary + dedupe ----------
    await check("R2C-06 unknown answer: no fact claim, budget refunded, DIR not re-asked", async () => {
      const sid = await fresh("c06");
      const s0 = await load(sid);
      const dir = sent(s0)!.dir_ids[0]!;
      const askedBefore = asked(s0);
      script.set("这个我真不知道。", () => ({
        classification: "unknown",
        extracted_items: [],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s1 = await say(sid, "这个我真不知道。");
      const t1 = lastUser(s1).client_id!;
      const f = s1.decision_context!.reality_facts.filter((x) => x.source_turn_id === t1);
      assert.ok(f.length >= 1 && f.every((x) => x.status === "unknown"));
      assert.ok(s1.decision_understanding!.budget.ineffective_plan_ids!.includes(sent(s0)!.plan_id));
      // asked = before - refund(1) + next question(1)
      assert.equal(asked(s1), askedBefore);
      assert.equal(sent(s1)!.dir_ids.includes(dir), false);
      const boundary = s1.decision_understanding!.answered_pending_confirmation!.items.find((i) => i.dir_id === dir);
      assert.ok(boundary?.information_boundary);
    });

    await check("R2C-07 off_topic: no write, same question re-presented, no new charge", async () => {
      const sid = await fresh("c07");
      const s0 = await load(sid);
      script.set("今天天气不错。", () => ({
        classification: "off_topic",
        extracted_items: [],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s1 = await say(sid, "今天天气不错。");
      assert.equal(s1.decision_context!.version, s0.decision_context!.version);
      assert.equal(sent(s1)!.plan_id, sent(s0)!.plan_id);
      assert.equal(asked(s1), asked(s0));
    });

    // ---------- Replay idempotency ----------
    await check("R2C-08 replaying the same turn id: no second write, no second charge, raw record unchanged", async () => {
      const sid = await fresh("c08");
      const s0 = await load(sid);
      const first = await runM1ProductionPreLlmTurn(s0, {
        statement: "我打算做代运营。",
        source_turn_id: "turn_replay_r2c08",
        now: new Date().toISOString(),
        test_hooks: hooks,
      });
      await savePOJUSession(first.session);
      const s1 = await load(sid);
      const second = await runM1ProductionPreLlmTurn(s1, {
        statement: "我打算做代运营，换个说法重放。",
        source_turn_id: "turn_replay_r2c08",
        now: new Date().toISOString(),
        test_hooks: hooks,
      });
      assert.equal(second.session.decision_context!.version, s1.decision_context!.version);
      assert.equal(
        second.session.decision_context!.reality_facts.filter((f) => f.source_turn_id === "turn_replay_r2c08").length,
        s1.decision_context!.reality_facts.filter((f) => f.source_turn_id === "turn_replay_r2c08").length,
      );
      assert.equal(asked(second.session), asked(s1));
      const rec = second.session.intake_answer_sources!.filter((r) => r.source_turn_id === "turn_replay_r2c08");
      assert.equal(rec.length, 1);
      assert.equal(rec[0]!.raw_user_statement, "我打算做代运营。");
    });

    // ---------- Multi-item pending across turns ----------
    await check("R2C-09 multi-item pending: one at a time, priority over planning, fully drained", async () => {
      const sid = await fresh("c09");
      const vague = "可能先做咨询，也可能做代运营。";
      script.set(vague, (ctx) => ({
        classification: "vague_answer",
        extracted_items: [
          item(vague, ctx.authorized.fact_role_codes[0]!, "可能先做咨询", "unclear"),
          item(vague, ctx.authorized.fact_role_codes[0]!, "也可能做代运营", "unclear"),
        ],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s1 = await say(sid, vague);
      const p1 = s1.pending_answer_resolution!;
      assert.equal(p1.status, "pending");
      assert.equal(p1.unresolved_items.length, 2);
      const firstId = p1.resolving_item_id!;
      const s2 = await say(sid, "2");
      const p2 = s2.pending_answer_resolution;
      assert.ok(p2 && p2.resolving_item_id && p2.resolving_item_id !== firstId, "second item now resolving");
      const s3 = await say(sid, "1");
      assert.ok(!s3.pending_answer_resolution || s3.pending_answer_resolution.status !== "pending");
      const t = lastUser(s1).client_id!;
      const facts = s3.decision_context!.reality_facts.filter((f) => f.source_turn_id === t);
      assert.ok(facts.length >= 1);
      assert.ok(facts.every((f) => f.statement === vague));
      assert.ok(facts.some((f) => f.verification_level === "user_estimate"));
      assert.ok(sent(s3), "ordinary loop resumes");
    });

    await check("R2C-09b selecting \"3 目前无法确定\" is an answer: unknown record, item closed, never asserted", async () => {
      const sid = await fresh("c09b");
      const vague = "也许做咨询，也许做代运营。";
      script.set(vague, (ctx) => ({
        classification: "vague_answer",
        extracted_items: [
          item(vague, ctx.authorized.fact_role_codes[0]!, "也许做咨询", "unclear"),
          item(vague, ctx.authorized.fact_role_codes[0]!, "也许做代运营", "unclear"),
        ],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s1 = await say(sid, vague);
      const t = lastUser(s1).client_id!;
      const v1 = s1.decision_context!.version;
      // First item, no sibling written yet → unknown record for the role.
      const s2 = await say(sid, "3");
      const unknown = s2.decision_context!.reality_facts.filter((f) => f.source_turn_id === t);
      assert.equal(s2.decision_context!.version, v1 + 1);
      assert.ok(unknown.length === 1 && unknown[0]!.status === "unknown" && unknown[0]!.statement === vague);
      assert.equal(s2.pending_answer_resolution!.unresolved_items.length, 1, "second item still queued");
      // Second item → role already has a record from this answer → closes without a write.
      const s3 = await say(sid, "3. 目前无法确定");
      assert.equal(s3.decision_context!.version, s2.decision_context!.version);
      const rej = s3.pending_answer_resolution?.rejected_items ?? [];
      assert.ok(rej.some((r) => r.terminal_reason === "user_cannot_determine"));
      assert.ok(!s3.pending_answer_resolution || s3.pending_answer_resolution.status !== "pending");
      assert.ok(s3.decision_context!.reality_facts.every((f) => f.source_turn_id !== t || f.verification_level !== "user_asserted"));
      assert.ok(sent(s3), "ordinary loop resumes");
      // Free-form hedge is still only a bounded retry.
      const sid2 = await fresh("c09c");
      script.set("可能咨询吧", (ctx) => ({
        classification: "vague_answer",
        extracted_items: [item("可能咨询吧", ctx.authorized.fact_role_codes[0]!, "可能咨询吧", "unclear")],
        unresolved_aspects: [],
        explanation: "",
      }));
      const h1 = await say(sid2, "可能咨询吧");
      const h2 = await say(sid2, "不确定");
      assert.equal(h2.decision_context!.version, h1.decision_context!.version);
      assert.equal(h2.pending_answer_resolution!.status, "pending");
    });

    // ---------- Goal change via handleUserMessage ----------
    await check("R2C-10 goal change: explicit confirm → Blueprint vN+1, history, DC definition, Understanding rebuilt", async () => {
      const sid = await fresh("c10");
      const gc = "其实我真正要决定的是要不要接受杭州那家公司的offer。";
      script.set(gc, () => ({
        classification: "goal_change",
        extracted_items: [
          { ...item(gc, null, "要不要接受杭州那家公司的offer"), semantic_kind: "definition_patch" as const },
        ],
        unresolved_aspects: [],
        explanation: "",
      }));
      const askedBefore = asked(await load(sid));
      const s1 = await say(sid, gc);
      assert.equal(asked(s1), askedBefore, "goal-change confirmation is not charged");
      const bp1 = s1.decision_blueprint!.blueprint_version;
      assert.ok(s1.pending_intake_control?.items.some((i) => i.kind === "goal_change" && i.proposed_decision_target === "要不要接受杭州那家公司的offer"));
      hookCalls = 0;
      const s2 = await say(sid, "1");
      assert.equal(hookCalls, 0, "confirmation is deterministic");
      assert.equal(s2.decision_blueprint!.blueprint_version, bp1 + 1);
      assert.equal(s2.decision_blueprint!.decision_question, "要不要接受杭州那家公司的offer");
      assert.equal(s2.decision_context!.definition.decision_question, "要不要接受杭州那家公司的offer");
      assert.equal(s2.decision_blueprint_history!.at(-1)!.blueprint_version, bp1);
      const log = s2.blueprint_change_log!.at(-1)!;
      assert.equal(log.proposal_statement, gc);
      assert.equal(log.confirmation_statement, "1");
      assert.equal(s2.decision_understanding!.blueprint_version, bp1 + 1);
      assert.equal(s2.decision_understanding!.context_version, s2.decision_context!.version);
      assert.ok(sent(s2) && s2.decision_blueprint!.dir_ids.some((d) => sent(s2)!.dir_ids.includes(d)));
    });

    // ---------- Browser transport + route ----------
    await check("R2C-11 browser transport posts context to the server route and parses its text", async () => {
      const sid = await fresh("c11");
      const s = await load(sid);
      fetchMode = "route_ok";
      routeBodies.length = 0;
      const ok = await interpretAnswerWithModel({ session: s, statement: "我打算做代运营。", source_turn_id: "t11" });
      assert.equal(ok.ok, true);
      assert.equal(ok.call_meta?.source, "openrouter");
      assert.equal(routeBodies.length, 1);
      const body = routeBodies[0] as { context: Ctx; session_id: string };
      assert.equal(body.session_id, s.session_id);
      assert.equal(body.context.user_answer, "我打算做代运营。");
      assert.equal(JSON.stringify(body).includes("OPENROUTER"), false);
      fetchMode = "route_timeout";
      const to = await interpretAnswerWithModel({ session: s, statement: "x答", source_turn_id: "t11b" });
      assert.equal(to.ok, false);
      if (!to.ok) assert.equal(to.reason, "timeout");
      fetchMode = "route_502";
      const cf = await interpretAnswerWithModel({ session: s, statement: "x答", source_turn_id: "t11c" });
      assert.equal(cf.ok, false);
      if (!cf.ok) assert.equal(cf.reason, "call_failed");
      fetchMode = "stub";
    });

    await check("R2C-12 server route validates input and fails closed without a key", async () => {
      const bad = await route.POST(new Request("http://localhost/api/poju/answer-interpretation", { method: "POST", body: "{}" }));
      assert.equal(bad.status, 400);
      const sid = await fresh("c12");
      const s = await load(sid);
      const context = buildModelInterpretationContext({ session: s, statement: "我打算做代运营。" });
      const saved = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      try {
        const res = await route.POST(
          new Request("http://localhost/api/poju/answer-interpretation", {
            method: "POST",
            body: JSON.stringify({ context, session_id: s.session_id }),
          }),
        );
        assert.equal(res.status, 502);
        const json = (await res.json()) as { ok: boolean; error: string };
        assert.deepEqual(json, { ok: false, error: "call_failed" });
      } finally {
        if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
      }
    });

    // ---------- Aspect dedupe ----------
    await check("R2C-14 an unresolved aspect already handled is never queued again; follow-ups add no aspects", async () => {
      const sid = await fresh("c14");
      const withAspect = (statement: string) => (ctx: Ctx) => ({
        classification: "partial_answer",
        extracted_items: [item(statement, ctx.authorized.fact_role_codes[0] ?? null)],
        unresolved_aspects: ["具体什么时候开始还没说"],
        explanation: "",
      });
      const a1 = "先做代运营，起步资金够半年。";
      script.set(a1, withAspect(a1));
      const s1 = await say(sid, a1);
      const aspects1 = s1.pending_intake_control!.items.filter((i) => i.kind === "unresolved_aspect");
      assert.equal(aspects1.length, 1);
      assert.equal(aspects1[0]!.status, "pending");
      const follow = "下个月开始。";
      script.set(follow, withAspect(follow));
      const s2 = await say(sid, follow);
      const aspects2 = s2.pending_intake_control!.items.filter((i) => i.kind === "unresolved_aspect");
      assert.equal(aspects2.length, 1, "follow-up must not spawn a new aspect");
      assert.notEqual(aspects2[0]!.status, "pending");
      const a3 = "客户主要来自老东家的合作方。";
      script.set(a3, withAspect(a3));
      const s3 = await say(sid, a3);
      const aspects3 = s3.pending_intake_control!.items.filter((i) => i.kind === "unresolved_aspect");
      assert.equal(aspects3.length, 1, "same aspect text is not re-queued");
      assert.equal(aspects3.filter((i) => i.status === "pending").length, 0);
      assert.ok(sent(s3) && !sent(s3)!.plan_id.includes("control"), "ordinary loop continues");
    });

    // ---------- Hard cap covers clarifications ----------
    await check("R2C-15 clarifications obey hard budget and per-DIR depth: unasked items close auditably, readiness reached", async () => {
      const sid = await fresh("c15");
      let s = await load(sid);
      let n = 0;
      let guard = 0;
      while (s.decision_understanding?.readiness.can_ask !== false && guard < 40) {
        guard += 1;
        assert.ok(asked(s) <= 15, `asked=${asked(s)}`);
        const q = sent(s)!;
        assert.ok(q, "question sent while can_ask");
        const text = `第${guard}轮回答：这部分情况已经说清楚了。`;
        const ordinary = !s.pending_intake_control || s.pending_intake_control.status !== "pending";
        if (ordinary) {
          n += 1;
          script.set(text, (ctx) => ({
            classification: "partial_answer",
            extracted_items: [item(text, ctx.authorized.fact_role_codes[0] ?? null)],
            unresolved_aspects: [`待补充细节甲${n}`, `待补充细节乙${n}`, `待补充细节丙${n}`],
            explanation: "",
          }));
        }
        s = await say(sid, text);
      }
      assert.equal(s.decision_understanding!.readiness.can_ask, false);
      assert.ok(asked(s) <= 15, `asked=${asked(s)}`);
      assert.equal(s.agent_v2?.current_phase, "awaiting_confirmation");
      const items = s.pending_intake_control?.items ?? [];
      assert.ok(
        items.some((i) => i.status === "closed_budget_exhausted") &&
          items.some((i) => i.status === "closed_depth_exhausted"),
        "unasked aspects closed auditably by hard budget and by depth",
      );
      assert.equal(items.filter((i) => i.status === "pending" || i.status === "uncertain").length, 0);
      assert.notEqual(s.pending_intake_control?.status, "pending");
      for (const [dir, depth] of Object.entries(s.decision_understanding!.budget.depth_by_dir)) {
        assert.ok(depth <= 3, `depth ${dir}=${depth}`);
      }
    });

    await check("R2C-16 scarce hard budget goes to Freeze-blocking DIRs; answer-resolution clarifications do not deepen a DIR", async () => {
      const sid = await fresh("c16");
      const vague = "大概做代运营，也可能做咨询。";
      script.set(vague, (ctx) => ({
        classification: "vague_answer",
        extracted_items: [item(vague, ctx.authorized.fact_role_codes[0]!, "大概做代运营", "unclear")],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s0 = await load(sid);
      const dir0 = sent(s0)!.dir_ids[0]!;
      const s1 = await say(sid, vague);
      assert.equal(s1.pending_answer_resolution!.status, "pending");
      assert.equal(s1.decision_understanding!.budget.depth_by_dir[dir0], 1, "clarification charged but not deepening");
      assert.equal(asked(s1), asked(s0) + 1);
      let s = await say(sid, "1");
      // Leave room for fewer questions than open blocking DIRs.
      const u = s.decision_understanding!;
      s = {
        ...s,
        decision_understanding: {
          ...u,
          budget: { ...u.budget, session_asked_count: u.budget.hard_budget_limit - 2, remaining_hard_budget: 2 },
        },
      };
      await savePOJUSession(s);
      for (let i = 0; i < 2; i++) {
        s = await say(sid, `关于这个问题我的明确回答是第${i}点：已经核实清楚。`);
        const q = sent(s);
        if (!q || s.decision_understanding!.readiness.can_ask === false) break;
        for (const d of q.dir_ids) {
          const dir = s.decision_context!.dirs.find((x) => x.dir_id === d);
          assert.notEqual(dir?.may_affect_p5_ranking, false, `scarce budget spent on non-blocking ${d}`);
        }
      }
      assert.ok(asked(s) <= 15);
    });

    await check("R2C-17 an estimate on a Freeze-blocking DIR gets one follow-up; an explicit reply lets the session freeze", async () => {
      const sid = await fresh("c17");
      let s = await load(sid);
      let guard = 0;
      let estimateDir: string | null = null;
      const askedByDir = new Map<string, number>();
      while (s.decision_understanding?.readiness.can_ask !== false && guard < 30) {
        guard += 1;
        const q = sent(s)!;
        for (const d of q.dir_ids) askedByDir.set(d, (askedByDir.get(d) ?? 0) + 1);
        const text = `第${guard}点回答：情况已经核实。`;
        const dir = s.decision_context!.dirs.find((d) => d.dir_id === q.dir_ids[0]);
        if (!estimateDir && dir?.may_affect_p5_ranking !== false && guard > 2) {
          estimateDir = q.dir_ids[0]!;
          script.set(text, (ctx) => ({
            classification: "clear_answer",
            extracted_items: [item(text, ctx.authorized.fact_role_codes[0]!, text, "estimated")],
            unresolved_aspects: [],
            explanation: "",
          }));
        }
        s = await say(sid, text);
      }
      assert.ok(estimateDir);
      assert.equal(askedByDir.get(estimateDir!), 2, "estimate-only blocking DIR gets exactly one follow-up");
      assert.ok(asked(s) <= 15);
      s = await say(sid, "确认");
      assert.match(lastAssistant(s).content, /【已冻结】/);
      assert.equal(s.decision_context!.status, "final");
      const est = s.decision_context!.reality_facts.filter(
        (f) => (f.related_dir_ids ?? []).includes(estimateDir!) && f.verification_level === "user_estimate",
      );
      assert.ok(est.length >= 1 && est.every((f) => f.status === "unverified"), "the estimate stays an estimate");
    });

    await check("R2C-18 a second estimate closes the follow-up: no third ask of the same DIR", async () => {
      const sid = await fresh("c18");
      let s = await load(sid);
      let guard = 0;
      let estimateDir: string | null = null;
      const askedByDir = new Map<string, number>();
      while (s.decision_understanding?.readiness.can_ask !== false && guard < 30) {
        guard += 1;
        const q = sent(s)!;
        for (const d of q.dir_ids) askedByDir.set(d, (askedByDir.get(d) ?? 0) + 1);
        const text = `第${guard}点回答：大概是这样吧。`;
        const dir = s.decision_context!.dirs.find((d) => d.dir_id === q.dir_ids[0]);
        if ((!estimateDir && dir?.may_affect_p5_ranking !== false && guard > 2) || q.dir_ids[0] === estimateDir) {
          estimateDir = q.dir_ids[0]!;
          script.set(text, (ctx) => ({
            classification: "clear_answer",
            extracted_items: [item(text, ctx.authorized.fact_role_codes[0]!, text, "estimated")],
            unresolved_aspects: [],
            explanation: "",
          }));
        }
        s = await say(sid, text);
      }
      assert.equal(askedByDir.get(estimateDir!), 2);
      assert.ok(asked(s) <= 15);
    });

    await check("R2C-19 estimated constraint: \"still an estimate\" twice resolves as a user_estimate fact, never a Constraint, no endless re-ask", async () => {
      const sid = await fresh("c19");
      const est = "预算大概五万左右，可能还会多一点。";
      script.set(est, (ctx) => ({
        classification: "estimate",
        extracted_items: [
          { ...item(est, ctx.authorized.fact_role_codes[0]!, "预算大概五万左右", "estimated"), semantic_kind: "constraint" as const },
        ],
        unresolved_aspects: [],
        explanation: "",
      }));
      const s1 = await say(sid, est);
      const t = lastUser(s1).client_id!;
      assert.equal(s1.pending_answer_resolution!.unresolved_items[0]!.reason, "estimated_constraint_not_persistable");
      const cst0 = s1.decision_context!.constraints.length;
      const s2 = await say(sid, "2");
      assert.equal(s2.pending_answer_resolution!.status, "pending", "first 'still estimate' keeps the upgrade option open");
      assert.equal(s2.decision_context!.version, s1.decision_context!.version);
      const s3 = await say(sid, "2");
      assert.ok(!s3.pending_answer_resolution || s3.pending_answer_resolution.status !== "pending");
      assert.equal(s3.decision_context!.constraints.length, cst0, "never a Constraint");
      const facts = s3.decision_context!.reality_facts.filter((f) => f.source_turn_id === t);
      assert.equal(facts.length, 1);
      assert.equal(facts[0]!.statement, est);
      assert.equal(facts[0]!.verification_level, "user_estimate");
      assert.ok(sent(s3), "loop continues");
    });

    // ---------- Full loop to Freeze + report binding ----------
    await check("R2C-13 loop to readiness: one question per turn, no DIR re-asked, budget ≤ 15, then 确认 → Freeze → bound job", async () => {
      const sid = await fresh("c13");
      let s = await load(sid);
      const askedDirs: string[] = [];
      const planIds: string[] = [];
      let guard = 0;
      while (s.decision_understanding?.readiness.can_ask !== false && guard < 30) {
        guard += 1;
        const q = sent(s)!;
        assert.ok(q, "a bound question is always sent while can_ask");
        assert.ok(q.dir_ids.length >= 1 && (q.fact_role_codes ?? []).length >= 1);
        for (const d of q.dir_ids) {
          assert.equal(askedDirs.includes(d), false, `DIR ${d} asked twice`);
        }
        assert.equal(planIds.includes(q.plan_id), false, "plan repeated");
        askedDirs.push(...q.dir_ids);
        planIds.push(q.plan_id);
        assert.equal(lastAssistant(s).content.includes("LEGACY_FREEFORM"), false);
        s = await say(sid, `关于这个问题我的明确回答是第${guard}点：情况已经核实清楚。`);
      }
      assert.equal(s.decision_understanding!.readiness.can_ask, false);
      assert.ok(asked(s) <= 15, `asked=${asked(s)}`);
      assert.equal(s.agent_v2?.current_phase, "awaiting_confirmation");
      const draftV = s.decision_context!.version;
      s = await say(sid, "确认");
      assert.match(lastAssistant(s).content, /【已冻结】/);
      const dc = s.decision_context!;
      assert.equal(dc.status, "final");
      assert.ok(dc.version > draftV);
      assert.equal(computeContentHash(dc), dc.content_hash);
      const freezeId = freezeIdFromBinding({ context_id: dc.context_id, context_version: dc.version, context_hash: dc.content_hash! });
      const auth = loadAuthoritativeFreeze(s, { freezeId, expected_hash: dc.content_hash! });
      assert.equal(auth.binding.context_version, dc.version);
      const prepared = await prepareFreezeBoundFinalDelivery({
        session: s,
        freezeId,
        expected_hash: dc.content_hash!,
        deps: {
          now: () => new Date().toISOString(),
          persistSession: async (x: Session) => {
            await savePOJUSession(x);
          },
          loadSession: async (id: string) => loadPOJUSession(id),
        },
      });
      assert.equal(prepared.ok, true);
      if (prepared.ok) {
        assert.equal(prepared.job.binding.freezeId, freezeId);
        assert.equal(prepared.job.binding.contentHash, dc.content_hash);
        assert.equal(prepared.job.binding.decisionContextVersion, dc.version);
        assert.equal(prepared.job.pages.length, 0, "no page generated here");
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\nPASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
