# -*- coding: utf-8 -*-
"""Rewrite Case E and trim Case B Agent claims for FU4."""
from pathlib import Path

p = Path("scripts/test-m2-3-decision-blueprint.ts")
t = p.read_text(encoding="utf-8")

# 1) Add LLM call counter to fetch stub
old_fetch = '''  let stubResponse = "MODEL FREEFORM MUST NEVER REACH USER";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url !== "/api/poju/chat") throw new Error(`unexpected fetch: ${url}`);
    return new Response(
      JSON.stringify({
        response: stubResponse,
        collection_progress: "advancing",
        question_status: "asked",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };'''

new_fetch = '''  let stubResponse = "MODEL FREEFORM MUST NEVER REACH USER";
  /** Counts ordinary POJU LLM endpoint calls (/api/poju/chat). */
  let pojuLlmFetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url !== "/api/poju/chat") throw new Error(`unexpected fetch: ${url}`);
    pojuLlmFetchCount += 1;
    return new Response(
      JSON.stringify({
        response: stubResponse,
        collection_progress: "advancing",
        question_status: "asked",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };'''

if "pojuLlmFetchCount" not in t:
    if old_fetch not in t:
        raise SystemExit("fetch stub block not found")
    t = t.replace(old_fetch, new_fetch, 1)
    print("OK fetch counter")
else:
    print("fetch counter already present")

# 2) Remove Case B Agent exception coverage (keep orchestrator/collecting)
# Find the Agent section after mapped asserts in FU2 Case B
old_case_b_agent = '''      // FU3: same throwing depth_per_direction fixture through Agent chain
      // (runAdaptiveQuestionTurn -> runCollectingDcTurn -> handleUserMessage).
      // Getter lives only in-memory; persistence would drop it, so we do not save.
      const agentOut = await handleUserMessage({
        session: {
          ...s,
          agent_v2: {
            ...(s.agent_v2 ?? out1.agent_v2!),
            current_phase: "collecting_context" as const,
          },
        },
        userMessage: "关于验证能力我想再想想",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(!last.content.includes("【理解确认】"), "no awaiting confirmation prompt");
      assert.ok(!last.content.includes(stubResponse), "no unauthorized question");
      assert.notEqual(agentOut.agent_v2?.current_phase, "awaiting_confirmation");
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      // Same throwing getter + non-empty user statement re-enters answer/persist
      // before planner catch (persist reads blueprint budget fields) → persist_threw.
      // Agent still fail-closes (no free-form / no awaiting_confirmation).
      const metaB = (last as { meta?: { m1_planner_blocked?: boolean; m1_fail_closed?: boolean; m1_outcome?: string } }).meta;
      assert.ok(
        metaB?.m1_planner_blocked === true ||
          (metaB?.m1_fail_closed === true &&
            (metaB.m1_outcome === "persist_threw" ||
              metaB.m1_outcome === "persist_failed" ||
              metaB.m1_outcome === "planner_blocked")),
        `Agent must fail-closed on same throwing fixture, meta=${JSON.stringify(metaB)}`,
      );
      console.log(
        `    outcome=${turn.outcome}; ask_error=${turn.ask_error}; phase=${agentOut.agent_v2?.current_phase}`,
      );
    });'''

# The Chinese/arrow chars may be garbled - find by unique English anchors
start_marker = "      // FU3: same throwing depth_per_direction fixture through Agent chain"
end_marker = "    await check(\"M2.3-R2-FU2 Case C: genuine idempotent replay keeps idempotent_replay (not blocked)\""

si = t.find(start_marker)
ei = t.find(end_marker)
if si < 0 or ei < 0:
    raise SystemExit(f"Case B agent section markers not found si={si} ei={ei}")

# Find the console.log / closing of Case B check before Case C
# Replace from FU3 agent comment through end of Case B check (just before Case C)
replacement_b = '''      // M2.3-R2-FU4: no precise Planner-entry hook yet (__testOnlyM1Hooks only
      // covers Understanding build). Do NOT claim Agent planner-exception coverage
      // via depth_per_direction getter (that path can hit persist_threw first).
      // Orchestrator + collecting layers above already proved planner_blocked with
      // actual exception type: controlled_planner_exception_fu2 / planner_exception.
      console.log(
        `    outcome=${turn.outcome}; ask_error=${turn.ask_error}; exception_type=planner_exception (orchestrator/collecting only; Agent planner inject deferred)`,
      );
    });

'''

t = t[:si] + replacement_b + t[ei:]
print("OK Case B agent claims removed")

# 3) Replace entire Case E
start_e = '    await check("M2.3-R2-FU3 Case E: Understanding build failure -> planner_blocked fail-closed"'
# Prefer rename to FU4
# Find start of Case E through the finally block
ei_finally = t.find("  } finally {\n    globalThis.fetch = originalFetch;")
if ei_finally < 0:
    raise SystemExit("finally block not found")
si_e = t.find(start_e)
if si_e < 0:
    raise SystemExit("Case E start not found")

new_case_e = r'''    await check("M2.3-R2-FU4 Case E: real Agent chain Understanding failure -> planner_blocked; no ordinary LLM", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu4_e",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      assert.ok(s.decision_blueprint, "blueprint required");
      assert.ok(s.decision_context, "dc required");

      const requiredP0 = p0BandIds(s.decision_blueprint!);
      assert.ok(requiredP0.length > 0, "fixture must contain P0 obligations");
      const unfinishedP0 = s.decision_context!.dirs.filter(
        (d) =>
          requiredP0.includes(d.dir_id) &&
          d.id_lifecycle === "active" &&
          d.current_state !== "known" &&
          d.current_state !== "n_a",
      );
      assert.ok(
        unfinishedP0.length > 0,
        "P0 must remain unresolved before injected Understanding failure",
      );
      const unfinishedP0Snapshot = unfinishedP0.map((d) => ({
        dir_id: d.dir_id,
        current_state: d.current_state,
      }));

      let understandingBuildAttempts = 0;
      const llmCountBefore = pojuLlmFetchCount;

      const agentOut = await handleUserMessage({
        session: {
          ...s,
          agent_v2: {
            ...(s.agent_v2 ?? out1.agent_v2!),
            current_phase: "collecting_context" as const,
          },
        },
        userMessage: "我还需要补充一些关于当前情况的信息",
        locale: "zh",
        __testOnlyM1Hooks: {
          beforeUnderstandingBuild() {
            understandingBuildAttempts += 1;
            throw new Error(
              `controlled_understanding_exception_fu4_${understandingBuildAttempts}`,
            );
          },
        },
      });

      const llmCountAfter = pojuLlmFetchCount;
      const last = lastAssistant(agentOut);
      const meta = (
        last as {
          meta?: {
            m1_planner_blocked?: boolean;
            m1_outcome?: string;
            m1_ask_error?: string;
            m1_fail_closed?: boolean;
            m21_confirm_freeze?: boolean;
          };
        }
      ).meta;

      assert.equal(
        understandingBuildAttempts,
        2,
        "must fail both initial Understanding build and catch rebuild",
      );
      assert.equal(meta?.m1_planner_blocked, true);
      assert.equal(meta?.m1_outcome, "planner_blocked");
      assert.ok(
        (meta?.m1_ask_error ?? "").includes("understanding_exception"),
        `must expose the actual Understanding failure, got ${meta?.m1_ask_error}`,
      );
      assert.ok(
        (meta?.m1_ask_error ?? "").includes("controlled_understanding_exception_fu4"),
        `ask_error must carry controlled_understanding_exception_fu4, got ${meta?.m1_ask_error}`,
      );
      assert.equal(
        llmCountAfter,
        llmCountBefore,
        `ordinary LLM fetch count must not increase (before=${llmCountBefore} after=${llmCountAfter})`,
      );
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      assert.notEqual(agentOut.agent_v2?.current_phase, "awaiting_confirmation");
      assert.ok(
        !last.content.includes("【理解确认】"),
        "must not request final understanding confirmation",
      );
      assert.ok(
        !last.content.includes(stubResponse),
        "must not emit ordinary LLM-generated question",
      );
      assert.ok(
        meta?.m21_confirm_freeze !== true,
        "must not mark confirm/freeze assistant turn",
      );
      assert.equal(
        (agentOut.freeze_bound_report_jobs ?? []).length,
        (s.freeze_bound_report_jobs ?? []).length,
        "must not create freeze-bound report jobs",
      );
      assert.equal(
        agentOut.decision_context?.status,
        s.decision_context?.status,
        "DC status must not jump to freeze/final via Understanding failure",
      );

      // P0 DIRs that were unfinished must not be auto-flipped to known/n_a by fail-closed.
      for (const snap of unfinishedP0Snapshot) {
        const after = agentOut.decision_context!.dirs.find(
          (d) => d.dir_id === snap.dir_id,
        );
        assert.ok(after, `P0 dir ${snap.dir_id} must still exist`);
        assert.ok(
          after!.current_state !== "known" && after!.current_state !== "n_a",
          `P0 dir ${snap.dir_id} must not be auto-changed to known/n_a (was ${snap.current_state}, now ${after!.current_state})`,
        );
      }

      console.log(
        `    path=handleUserMessage→runM1ProductionPreLlmTurn→runCollectingDcTurn→runAdaptiveQuestionTurn→Understanding×2→planner_blocked→Agent early return`,
      );
      console.log(
        `    understandingBuildAttempts=${understandingBuildAttempts}; m1_outcome=${meta?.m1_outcome}; m1_ask_error=${meta?.m1_ask_error}; llmDelta=${llmCountAfter - llmCountBefore}; phase=${agentOut.agent_v2?.current_phase}; exception_type=understanding_exception`,
      );
    });


'''

t = t[:si_e] + new_case_e + t[ei_finally:]
print("OK Case E rewritten")

# Update file header comment if present
t = t.replace(
    "M2.3-R2-FU3 Fail-closed when Understanding cannot be built; Case C false-pass fixed",
    "M2.3-R2-FU4 Real Agent-chain Understanding fail-closed via test_hooks; Case E proves no ordinary LLM",
)

p.write_text(t, encoding="utf-8", newline="\n")
print("OK test file written, len=", len(t))
