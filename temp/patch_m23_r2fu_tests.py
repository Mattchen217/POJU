# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"D:\POJU\pojulife\scripts\test-m2-3-decision-blueprint.ts")
t = p.read_text(encoding="utf-8")

# Update header comment
old_hdr = ''' *  M2.3-R2  Production priority activation / Readiness ordering via runAdaptiveQuestionTurn
 */'''
new_hdr = ''' *  M2.3-R2  Production priority activation / Readiness ordering via runAdaptiveQuestionTurn
 *  M2.3-R2-FU  Planner cannot bypass open P0/P1 (no selectable / all rejected → blocked)
 */'''
if old_hdr not in t:
    raise SystemExit("header not found")
t = t.replace(old_hdr, new_hdr, 1)

# Add import for runM1ProductionPreLlmTurn
old_imp = '''  const { handleUserMessage } = await import("../lib/poju/agent");
  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
    activateNextBlueprintPriorityBand,
    gateClassForDirFromCatalog,
    buildUnderstandingState,
    runAdaptiveQuestionTurn,
    attachAuthorizedAssistantQuestion,
  } = await import("../lib/poju/decision-intake");'''

new_imp = '''  const { handleUserMessage } = await import("../lib/poju/agent");
  const { runM1ProductionPreLlmTurn } = await import(
    "../lib/poju/collecting-dc-turn"
  );
  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
    activateNextBlueprintPriorityBand,
    gateClassForDirFromCatalog,
    buildUnderstandingState,
    runAdaptiveQuestionTurn,
    attachAuthorizedAssistantQuestion,
  } = await import("../lib/poju/decision-intake");'''

if old_imp not in t:
    raise SystemExit("imports not found")
t = t.replace(old_imp, new_imp, 1)

# Insert FU tests before the finally block that restores fetch
marker = '''      console.log(
        `    p1Need=${p1Need && p1Need.kind === "dir_based" ? p1Need.dir_id : "?"}; can_ask=${u.readiness.can_ask}; remaining=${u.budget.remaining_hard_budget}`,
      );
    });

  } finally {
    globalThis.fetch = originalFetch;
  }'''

if marker not in t:
    raise SystemExit("R2 Case C end marker not found")

fu_tests = r'''      console.log(
        `    p1Need=${p1Need && p1Need.kind === "dir_based" ? p1Need.dir_id : "?"}; can_ask=${u.readiness.can_ask}; remaining=${u.budget.remaining_hard_budget}`,
      );
    });

    // ---------- M2.3-R2-FU ----------
    await check("M2.3-R2-FU Case A: open P0 + budget + no selectable candidate → blocked, not final-confirm", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu_a",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);
      assert.ok(p0Ids.length >= 1, "need P0 DIRs");
      assert.ok(s.decision_understanding, "understanding present after first turn");
      const depthCap = bp.question_budget.depth_per_direction;
      const depth_by_dir: Record<string, number> = {
        ...(s.decision_understanding!.budget.depth_by_dir ?? {}),
      };
      for (const id of p0Ids) depth_by_dir[id] = depthCap;

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu_a",
              statement: "Collecting evidence while P0 still open",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu_a",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: [p0Ids[0]!],
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? {
                  ...d,
                  current_state: "unknown" as const,
                  partial_satisfaction: true,
                }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
        decision_understanding: {
          ...s.decision_understanding!,
          budget: {
            ...s.decision_understanding!.budget,
            session_asked_count: Math.min(
              2,
              s.decision_understanding!.budget.hard_budget_limit - 1,
            ),
            remaining_hard_budget: Math.max(
              1,
              s.decision_understanding!.budget.hard_budget_limit - 2,
            ),
            depth_by_dir,
          },
        },
      };

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_a_init",
        now,
        init_only: true,
      });
      assert.ok(turn.understanding, "understanding required");
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `expected planner_blocked, got ${turn.outcome} verdict=${turn.understanding!.readiness.verdict} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.equal(turn.understanding!.readiness.can_ask, true);
      assert.equal(turn.understanding!.readiness.verdict, "continue");
      assert.ok(
        !turn.understanding!.readiness.reasons.includes("ready_for_final_confirm"),
      );
      assert.notEqual(
        turn.understanding!.readiness.verdict,
        "ready_for_final_confirm",
      );
      assert.equal(turn.plan, null);
      assert.equal(turn.authorized_question, null);
      const p0Need = turn.understanding!.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && p0Ids.includes(n.dir_id),
      );
      assert.ok(p0Need, "open P0 must remain in need_to_understand");
      assert.ok(
        turn.understanding!.budget.remaining_hard_budget > 0,
        "hard budget remains",
      );

      // Production Agent entry: same nonterminal blocked outcome
      const pre = await runM1ProductionPreLlmTurn(turn.session, {
        statement: "补充一点背景：我还在犹豫",
        source_turn_id: "r2fu_a_agent_entry",
        now: new Date().toISOString(),
      });
      // Answer path may change DC; re-seed depth exhaustion on the session used by Agent
      let sAgent = {
        ...s,
        agent_v2: {
          ...(s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "我还在收集信息，请继续",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true ||
          last.content.includes("未能生成合规的授权提问") ||
          last.content.includes("未完成的必要调查"),
        `agent must surface planner_blocked system reply, got: ${last.content.slice(0, 120)}`,
      );
      assert.ok(
        !last.content.includes("【理解确认】"),
        "must not show final understanding-confirmation prompt",
      );
      assert.ok(
        !last.content.includes(stubResponse),
        "must not emit unauthorized model free-form question",
      );
      const phase =
        agentOut.agent_v2?.current_phase ?? "missing";
      assert.equal(
        phase,
        "collecting_context",
        `session must stay nonterminal collecting_context, got ${phase}`,
      );
      // pre may or may not block depending on answer writes; log for evidence
      console.log(
        `    orchestrator=${turn.outcome}; agent_phase=${phase}; pre=${pre.outcome}; p0Need=${p0Need && p0Need.kind === "dir_based" ? p0Need.dir_id : "?"}`,
      );
    });

    await check("M2.3-R2-FU Case B: open P1 + budget + all candidates rejected → blocked", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu_b",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      // Complete P0 so P1 activates on next orchestrator turn
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu_b_p0",
              statement: "P0 complete fixture for FU Case B",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu_b",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      // First orchestrator pass activates P1 and would normally plan — capture activated session
      const activated = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_b_activate",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(
        activated.session.decision_context!.dirs.some(
          (d) =>
            d.dir_id === "DIR-VALIDATION-CAPACITY" ||
            d.dir_id === "DIR-OPT-IRREV",
        ),
        "precondition: P1 activated",
      );

      // Force every candidate to fail scope/depth validation while budget remains:
      // depth_soft_cap=0 ⇒ plan.depth(1) always exceeds cap, while depth_per_direction
      // filter still admits candidates (used=0 < 3).
      s = {
        ...activated.session,
        decision_blueprint: {
          ...activated.session.decision_blueprint!,
          directions: activated.session.decision_blueprint!.directions.map(
            (d) => ({ ...d, depth_soft_cap: 0 }),
          ),
        },
        decision_understanding: {
          ...activated.session.decision_understanding!,
          budget: {
            ...activated.session.decision_understanding!.budget,
            session_asked_count: 1,
            remaining_hard_budget: Math.max(
              1,
              activated.session.decision_understanding!.budget.hard_budget_limit -
                1,
            ),
            depth_by_dir: {},
          },
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_b_blocked",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(turn.understanding);
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `expected planner_blocked, got ${turn.outcome} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.equal(turn.understanding!.readiness.verdict, "continue");
      assert.equal(turn.understanding!.readiness.can_ask, true);
      assert.notEqual(
        turn.understanding!.readiness.verdict,
        "ready_for_final_confirm",
      );
      assert.ok(
        turn.understanding!.readiness.reasons.some(
          (r) =>
            r.includes("scope_budget_reject") ||
            r.includes("planner_blocked") ||
            r.includes("all_candidates_rejected") ||
            r.includes("direction_depth_exceeded"),
        ),
        `must preserve validation failure reason, got ${turn.understanding!.readiness.reasons.join(",")}`,
      );
      const p1Need = turn.understanding!.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" ||
            n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "open P1 must remain in need_to_understand");
      assert.equal(turn.authorized_question, null);
      assert.equal(turn.plan, null);

      // Agent integration: no unauthorized assistant question / no final confirm
      const sAgent = {
        ...s,
        agent_v2: {
          ...(s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "关于验证能力我想再想想",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        !last.content.includes("【理解确认】"),
        "no false final confirmation",
      );
      assert.ok(
        !last.content.includes(stubResponse),
        "no unauthorized model free-form question",
      );
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true ||
          last.content.includes("未能生成合规的授权提问") ||
          last.content.includes("未完成的必要调查"),
        `expected planner_blocked agent reply, got: ${last.content.slice(0, 160)}`,
      );
      console.log(
        `    outcome=${turn.outcome}; reasons=${turn.understanding!.readiness.reasons.filter((r) => r.includes("reject") || r.includes("blocked") || r.includes("depth")).join("|")}; agent_phase=${agentOut.agent_v2?.current_phase}`,
      );
    });

    await check("M2.3-R2-FU Case C: P0/P1 genuinely complete → readiness/final-confirm unchanged", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu_c",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu_c",
              statement: "Collecting evidence after P0/P1 complete",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu_c",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      // Activate P1, then mark P1 known as well (genuinely complete P0/P1)
      const activated = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_c_activate",
        now: new Date().toISOString(),
        init_only: true,
      });
      const p1Ids = activated.session
        .decision_context!.dirs.filter(
          (d) =>
            d.dir_id === "DIR-VALIDATION-CAPACITY" ||
            d.dir_id === "DIR-OPT-IRREV",
        )
        .map((d) => d.dir_id);
      assert.ok(p1Ids.length >= 1, "P1 should activate");

      s = {
        ...activated.session,
        decision_context: {
          ...activated.session.decision_context!,
          dirs: activated.session.decision_context!.dirs.map((d) =>
            p1Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: activated.session.decision_context!.version + 1,
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_c_ready",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(turn.understanding);
      assert.equal(
        turn.understanding!.readiness.can_ask,
        false,
        `when P0/P1 complete, can_ask should be false; verdict=${turn.understanding!.readiness.verdict} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.ok(
        turn.understanding!.readiness.verdict === "ready_for_final_confirm" ||
          turn.understanding!.readiness.verdict === "hard_budget_exhausted",
        `expected terminal readiness verdict, got ${turn.understanding!.readiness.verdict}`,
      );
      assert.notEqual(turn.outcome, "planner_blocked");
      const openP0P1 = turn.understanding!.need_to_understand.items.filter(
        (n) =>
          n.kind === "dir_based" &&
          (n.priority === "P0" || n.priority === "P1"),
      );
      assert.equal(openP0P1.length, 0, "no open P0/P1 obligations");

      // Agent: readiness stop → understanding confirmation (existing behavior)
      const sAgent = {
        ...turn.session,
        agent_v2: {
          ...(turn.session.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "信息已经差不多了",
        locale: "zh",
      });
      // After P0/P1 complete, Agent may show confirm OR stay collecting if answer re-opens needs.
      // At minimum: must NOT be planner_blocked, and if can_ask false path fires, confirm appears.
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked !== true,
        "must not planner_block when P0/P1 genuinely complete",
      );
      console.log(
        `    verdict=${turn.understanding!.readiness.verdict}; outcome=${turn.outcome}; agent_phase=${agentOut.agent_v2?.current_phase}; confirm=${last.content.includes("理解确认")}`,
      );
    });

  } finally {
    globalThis.fetch = originalFetch;
  }'''

t = t.replace(marker, fu_tests, 1)
p.write_text(t, encoding="utf-8")
print("patched tests")
assert "M2.3-R2-FU Case A" in p.read_text(encoding="utf-8")
assert "M2.3-R2-FU Case B" in p.read_text(encoding="utf-8")
assert "M2.3-R2-FU Case C" in p.read_text(encoding="utf-8")
print("test sanity ok")
