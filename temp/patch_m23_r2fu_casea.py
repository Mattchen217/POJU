# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(r"scripts/test-m2-3-decision-blueprint.ts")
t = p.read_text(encoding="utf-8")

old = '''      // Production Agent entry: same nonterminal blocked outcome
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
    });'''

new = '''      // Production Agent entry on revision-aligned fixture (avoid stale C1 persist).
      // Prefer turn.session (orchestrator already applied understanding) + save.
      let sAgent = {
        ...turn.session,
        agent_v2: {
          ...(turn.session.agent_v2 ?? s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      await savePOJUSession(sAgent);
      sAgent = await durable(sid);

      // Direct production pre-LLM entry (same as Agent) — no selectable under depth exhaustion
      const pre = await runM1ProductionPreLlmTurn(sAgent, {
        statement: "嗯",
        source_turn_id: "r2fu_a_agent_entry",
        now: new Date().toISOString(),
      });
      assert.equal(
        pre.outcome,
        "planner_blocked",
        `runM1ProductionPreLlmTurn must be planner_blocked, got ${pre.outcome} ask_error=${pre.ask_error}`,
      );
      assert.equal(pre.authorized_question ?? null, null);
      assert.equal(pre.plan ?? null, null);

      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "嗯",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true ||
          last.content.includes("未能生成合规的授权提问") ||
          last.content.includes("未完成的必要调查"),
        `agent must surface planner_blocked system reply, got: ${last.content.slice(0, 160)}`,
      );
      assert.ok(
        !last.content.includes("【理解确认】"),
        "must not show final understanding-confirmation prompt",
      );
      assert.ok(
        !last.content.includes(stubResponse),
        "must not emit unauthorized model free-form question",
      );
      const phase = agentOut.agent_v2?.current_phase ?? "missing";
      assert.equal(
        phase,
        "collecting_context",
        `session must stay nonterminal collecting_context, got ${phase}`,
      );
      console.log(
        `    orchestrator=${turn.outcome}; pre=${pre.outcome}; agent_phase=${phase}; p0Need=${p0Need && p0Need.kind === "dir_based" ? p0Need.dir_id : "?"}`,
      );
    });'''

if old not in t:
    raise SystemExit("Case A agent block not found")
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("fixed Case A agent integration")
