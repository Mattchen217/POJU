from pathlib import Path
root = Path(r"D:/POJU/pojulife")
rel = root / "scripts/test-m2-3-decision-blueprint.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")
if "M2.3-R2-FU3 Case E" in s:
    print("case E already present")
    raise SystemExit(0)

finally_idx = s.find("\n  } finally {\n    globalThis.fetch = originalFetch;")
assert finally_idx > 0, "finally missing"

case_e = r'''
    await check("M2.3-R2-FU3 Case E: Understanding build failure -> planner_blocked fail-closed", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu3_e",
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

      // Keep P0 unfinished + hard budget remaining. Make question_budget.hard throw
      // so buildUnderstandingState (defaultBudget) fails on first build and rebuild.
      // activateNextBlueprintPriorityBand does not read question_budget.hard.
      const qb = { ...s.decision_blueprint!.question_budget };
      Object.defineProperty(qb, "hard", {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("controlled_understanding_exception_fu3");
        },
      });
      s = {
        ...s,
        decision_blueprint: {
          ...s.decision_blueprint!,
          question_budget: qb as typeof s.decision_blueprint.question_budget,
        },
        decision_understanding: {
          ...s.decision_understanding!,
          budget: {
            ...s.decision_understanding!.budget,
            session_asked_count: 1,
            remaining_hard_budget: Math.max(
              1,
              s.decision_understanding!.budget.hard_budget_limit - 1,
            ),
          },
        },
        agent_v2: {
          ...(s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu3_e_exception",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `expected planner_blocked, got ${turn.outcome} ask_error=${turn.ask_error}`,
      );
      assert.notEqual(turn.outcome, "ready_no_question");
      assert.ok(
        (turn.ask_error ?? "").includes("understanding_exception") ||
          (turn.ask_error ?? "").includes("controlled_understanding_exception_fu3"),
        `ask_error must carry understanding_exception, got ${turn.ask_error}`,
      );
      assert.equal(turn.understanding, null, "must not fabricate Understanding");
      assert.equal(turn.authorized_question, null);
      assert.equal(turn.plan, null);
      const unfinished = (s.decision_context!.dirs ?? []).filter(
        (d) =>
          d.id_lifecycle === "active" &&
          d.current_state !== "known" &&
          d.current_state !== "n_a",
      );
      assert.ok(unfinished.length > 0, "P0/P1 obligations must remain unfinished on DC");

      const mapped = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "r2fu3_e_exception_map",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.equal(mapped.outcome, "planner_blocked");
      assert.equal(mapped.ask_planned, false);
      assert.equal(mapped.authorized_question, null);
      assert.equal(mapped.plan, null);

      const agentOut = await handleUserMessage({
        session: {
          ...s,
          agent_v2: {
            ...(s.agent_v2 ?? out1.agent_v2!),
            current_phase: "collecting_context" as const,
          },
        },
        userMessage: "continue collecting please",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(!last.content.includes(stubResponse), "no unauthorized free-form question");
      assert.notEqual(agentOut.agent_v2?.current_phase, "awaiting_confirmation");
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true,
        `Agent must fail-closed, meta=${JSON.stringify((last as { meta?: unknown }).meta)} content=${last.content.slice(0, 160)}`,
      );
      console.log(
        `    outcome=${turn.outcome}; ask_error=${turn.ask_error}; phase=${agentOut.agent_v2?.current_phase}`,
      );
    });

'''
s = s[:finally_idx] + "\n" + case_e + s[finally_idx:]
out = s.replace("\n", "\r\n") if nl == "\r\n" else s
rel.write_text(out, encoding="utf-8", newline="")
print("case E inserted", len(out))
