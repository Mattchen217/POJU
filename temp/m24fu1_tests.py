from pathlib import Path
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
t = p.read_text(encoding="utf-8")

# Update header comment for FU1
t = t.replace(
  " * M1 — Production Adaptive Question Loop E2E (real production Agent path).",
  " * M1 — Production Adaptive Question Loop E2E (real production Agent path).\n * M2.4-R1-FU1: role authorization, conservative conflicts, Cases I–M + G/H.",
  1,
)

# Find start of Case G through end of Case H (before `  } finally {`)
start = t.find('    await check("M2.4-R1 Case G:')
end = t.find("  } finally {\n    globalThis.fetch = originalFetch;")
if start < 0 or end < 0:
    raise SystemExit(f"markers not found start={start} end={end}")

new_cases = r'''    await check("M2.4-R1 Case G: open Conflict → Understanding conflict; DIR not known; ask resolves", async () => {
      const { sid } = await withAuthorizedAsk("m24g", jobDirs);
      let s = await durable(sid);
      const dirId = "DIR-OPT-ON-TABLE";
      // Turn 1: seed contradictory facts + open Conflict
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            {
              fact_id: "fact_g_old",
              statement: "只有一个选项：留任",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "g_old",
              user_confirmed: false,
              fact_roles: ["option"],
              related_dir_ids: [dirId],
              updated_at: NOW,
            },
            {
              fact_id: "fact_g_new",
              statement: "其实还有创业选项",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "g_new",
              user_confirmed: false,
              fact_roles: ["option"],
              related_dir_ids: [dirId],
              updated_at: NOW,
            },
          ],
          conflicts: [
            {
              conflict_id: "cf_g_open",
              fact_ids: ["fact_g_old", "fact_g_new"],
              conflict_field: "statement",
              statements_snapshot: ["只有一个选项：留任", "其实还有创业选项"],
              source_refs: [
                { fact_id: "fact_g_old", source_stage: "collecting", source_turn_id: "g_old" },
                { fact_id: "fact_g_new", source_stage: "collecting", source_turn_id: "g_new" },
              ],
              state: "open",
              resolution: null,
              user_confirmation: false,
              affects_preferred_path: true,
              updated_at: NOW,
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            d.dir_id === dirId
              ? { ...d, current_state: "conflict" as const, partial_satisfaction: true }
              : d,
          ),
          version: (s.decision_context!.version ?? 1) + 1,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_m24g_seed",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const u = buildUnderstandingState({
        session: s,
        blueprint: s.decision_blueprint!,
        now: NOW,
      });
      assert.ok(u.current_understanding.conflict_briefs.length >= 1);
      assert.equal(
        u.understood.items.some((i) => i.dir_id === dirId),
        false,
        "conflict DIR must not be Understood/known",
      );
      const need = u.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && n.dir_id === dirId,
      );
      assert.ok(need && need.kind === "dir_based");
      if (need && need.kind === "dir_based") {
        assert.equal(need.gap_type, "conflict");
      }

      // Turn 2: Agent/planner emits conflict-clarification question; persist last_sent.
      const turn = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "turn_m24g_plan",
        now: NOW,
        init_only: true,
      });
      assert.ok(turn.plan && turn.authorized_question, "must emit clarification plan");
      if (turn.authorized_question) {
        assert.match(turn.authorized_question, /冲突|澄清|属实|哪一项/);
      }
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      s = attachAuthorizedAssistantQuestion(turn.session, turn.plan!, "ask_m24g_clarify");
      await mutatePOJUSession(sid, {
        operation_id: "op_m24g_attach",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const lastSent = s.decision_understanding?.last_sent_question;
      assert.ok(lastSent, "last_sent_question must be persisted");
      assert.ok(lastSent!.dir_ids.length >= 1);
      assert.ok(lastSent!.ddr_ids.length >= 1);
      assert.ok(
        Array.isArray(lastSent!.fact_role_codes) && lastSent!.fact_role_codes.length >= 1,
        "last_sent_question.fact_role_codes must come from sent Plan",
      );
      assert.equal(lastSent!.plan_id, turn.plan!.plan_id);
      assert.deepEqual(lastSent!.fact_role_codes, turn.plan!.fact_role_codes);

      // Turn 3: clarification answer via real handleUserMessage.
      // NOTE: formal Conflict Resolution (`clarifyConflict` in conflict-lifecycle.ts)
      // is NOT wired into applyAnswerEventToSessionDc / runAdaptiveQuestionTurn /
      // handleUserMessage. Do not forge Conflict.state=resolved/clarified here.
      const factsBefore = new Set(
        (s.decision_context?.reality_facts ?? []).map((f) => f.fact_id),
      );
      const openBefore = (s.decision_context?.conflicts ?? []).filter((c) => c.state === "open").length;
      s = await handleUserMessage({
        session: s,
        userMessage: "澄清：创业选项是真实的，留任不是唯一选项。",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const dc3 = s.decision_context!;
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === "fact_g_old"), "old fact kept");
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === "fact_g_new"), "prior conflict fact kept");
      const added = dc3.reality_facts.filter((f) => !factsBefore.has(f.fact_id));
      assert.ok(added.length >= 1, "clarification fact must be appended via production chain");
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, dc3.context_id);
        assert.equal(s.decision_understanding.context_version, dc3.version);
      }
      const openAfter = dc3.conflicts.filter((c) => c.state === "open");
      // Honest: without production clarifyConflict wiring, open Conflict remains.
      assert.ok(openAfter.length >= openBefore, "must not forge auto-resolve; open conflicts remain");
      assert.equal(
        (s.decision_understanding?.understood.items ?? []).some((i) => i.dir_id === dirId),
        false,
        "unresolved conflict DIR must not enter Understood",
      );
      console.log(
        `[m24g] conflict_briefs=${u.current_understanding.conflict_briefs.length}; gap=${need && need.kind==="dir_based"?need.gap_type:"?"}; clarifyQ=${(turn.authorized_question ?? "").slice(0,80)}; last_roles=${(lastSent?.fact_role_codes ?? []).join(",")}; added=${added.length}; open_after=${openAfter.length}; blocker=clarifyConflict_not_wired_into_answer_path`,
      );
    });

    await check("M2.4-R1 Case H: real Agent main path ≥3 turns; Understanding advances", async () => {
      fetchCalls.length = 0;
      const llmBefore = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      // Seed collecting session so authorized Plan/roles exist from turn 1.
      const { sid, plan: plan0, q0 } = await withAuthorizedAsk("m24h", jobDirs, {
        decision_question: "要不要接受新 offer？",
      });
      let s = await durable(sid);
      stubResponse = "STUB_SHOULD_NOT_OVERRIDE_AUTH_Q";

      // Turn 1: establish decision_question via real Agent (session already has DQ).
      s = await handleUserMessage({
        session: s,
        userMessage: "决策问题就是：要不要接受新 offer？",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const phase1 = s.agent_v2?.current_phase;
      const v1 = s.decision_context?.version ?? 0;
      const q1 = s.adaptive_ask_plan?.question_text ?? lastAssistant(s).content;
      const last1 = s.decision_understanding?.last_sent_question;
      assert.ok(last1?.fact_role_codes && last1.fact_role_codes.length >= 1, "t1 last_sent roles");
      // Re-interpret the user statement against the pre-turn target to inspect authorization.
      // (Production already applied; we rebuild targets from the plan that was active.)
      const llmAfter1 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(`[m24h-t1] phase=${phase1}; dc_v=${v1}; q=${String(q1).slice(0, 80)}; llmDelta=${llmAfter1 - llmBefore}; roles=${(last1?.fact_role_codes ?? []).join(",")}`);

      // Ensure last_sent present for turn 2 answers
      if (s.adaptive_ask_plan && !s.decision_understanding?.last_sent_question) {
        const { attachAuthorizedAssistantQuestion } = await import(
          "../lib/poju/decision-intake/adaptive-turn"
        );
        s = attachAuthorizedAssistantQuestion(s, s.adaptive_ask_plan, "ask_m24h_t2");
        await savePOJUSession(s);
      }

      const vBefore2 = s.decision_context!.version;
      const llmBefore2 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      const qPrev = s.decision_understanding?.last_sent_question?.question_text ?? s.adaptive_ask_plan?.question_text;
      const rolesBefore2 = [
        ...(s.decision_understanding?.last_sent_question?.fact_role_codes ?? []),
      ];
      const targetDirs2 = [
        ...(s.decision_understanding?.last_sent_question?.dir_ids ?? s.adaptive_ask_plan?.dir_ids ?? []),
      ];

      // Turn 2: state real options clearly
      const ans2 = "真实选项有两个：接受 offer，或留任争取加薪。";
      // Capture AnswerEvent authorization by interpreting against current last_sent
      const ev2 = interpretUserAnswer({
        session: s,
        statement: ans2,
        source_turn_id: "preview_m24h_t2",
      });
      assert.ok(ev2.targets.dir_ids.length >= 1);
      for (const d of ev2.targets.dir_ids) {
        assert.ok(targetDirs2.includes(d), `t2 target dir ${d}`);
      }
      for (const w of ev2.proposed_writes) {
        assert.ok(w.fact_roles.length >= 1);
        // Authorized roles only — must not silently expand beyond last_sent codes
        const authRoles = rolesBefore2.map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        }).filter(Boolean);
        if (authRoles.length) {
          for (const r of w.fact_roles) {
            if (r === "hard_constraint") continue; // constraint companion may add
            assert.ok(authRoles.includes(r), `t2 role ${r} must be authorized; auth=${authRoles}`);
          }
        }
      }

      s = await handleUserMessage({
        session: await durable(s.session_id),
        userMessage: ans2,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const v2 = s.decision_context!.version;
      if (ev2.proposed_writes.length > 0 && ev2.classification !== "invalid_input") {
        assert.equal(v2, vBefore2 + 1, "t2 DC version must increase exactly once on legal write");
      }
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, s.decision_context!.context_id);
        assert.equal(s.decision_understanding.context_version, s.decision_context!.version);
      }
      const asst2 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan?.question_text, "turn2 must have authorized plan question");
      assert.equal(asst2.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst2.content, stubResponse);
      assert.equal(asst2.content.includes("【系统】"), false);
      assert.ok(s.adaptive_ask_plan!.dir_ids.length >= 1);
      assert.ok(s.adaptive_ask_plan!.ddr_ids.length >= 1);
      assert.equal(s.agent_v2?.current_phase, "collecting_context");
      // Satisfied roles from t2 writes should not remain as gaps when they match authorized roles
      const u2 = s.decision_understanding!;
      const writtenRoles2 = new Set(
        s.decision_context!.reality_facts.flatMap((f) => f.fact_roles ?? []),
      );
      for (const n of u2.need_to_understand.items) {
        if (n.kind !== "dir_based") continue;
        const missingRolesMatch = /missing_roles:([^;]+)/.exec(n.missing_content);
        const missingRoles = missingRolesMatch
          ? missingRolesMatch[1]!.split(",").map((x) => x.trim()).filter(Boolean)
          : [];
        for (const r of missingRoles) {
          // A role with a fact on this DIR must not stay listed missing.
          const hasFact = s.decision_context!.reality_facts.some(
            (f) =>
              (f.related_dir_ids ?? []).includes(n.dir_id) &&
              (f.fact_roles ?? []).includes(r) &&
              f.status !== "unknown" &&
              f.status !== "declined",
          );
          assert.equal(hasFact, false, `satisfied role ${r} on ${n.dir_id} must not remain a gap`);
        }
      }
      assert.ok(
        u2.need_to_understand.items.some(
          (n) => n.kind === "dir_based" && (n.priority === "P0" || n.priority === "P1"),
        ),
        "unmet P0/P1 gaps must still exist after t2",
      );
      const llmAfter2 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(
        `[m24h-t2] dc_v=${v2}; phase=${s.agent_v2?.current_phase}; authQ=${(s.adaptive_ask_plan?.question_text ?? asst2.content).slice(0, 80)}; llmDelta=${llmAfter2 - llmBefore2}; prevQ_same=${asst2.content === qPrev}; targets=${ev2.targets.dir_ids.join(",")}; write_roles=${ev2.proposed_writes.map((w)=>w.fact_roles.join("+")).join("|")}`,
      );

      const vBefore3 = s.decision_context!.version;
      const q2 = s.adaptive_ask_plan?.question_text ?? asst2.content;
      const llmBefore3 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      const rolesBefore3 = [
        ...(s.decision_understanding?.last_sent_question?.fact_role_codes ?? s.adaptive_ask_plan?.fact_role_codes ?? []),
      ];
      const targetDirs3 = [
        ...(s.decision_understanding?.last_sent_question?.dir_ids ?? s.adaptive_ask_plan?.dir_ids ?? []),
      ];

      // Turn 3: state hard constraints clearly
      const ans3 = "硬约束是年薪不能低于现在，且三个月内要决定。";
      const ev3 = interpretUserAnswer({
        session: s,
        statement: ans3,
        source_turn_id: "preview_m24h_t3",
      });
      assert.ok(ev3.targets.dir_ids.length >= 1 || ev3.classification === "invalid_input");
      if (ev3.classification !== "invalid_input") {
        for (const d of ev3.targets.dir_ids) {
          assert.ok(targetDirs3.includes(d), `t3 target dir ${d}`);
        }
      }

      s = await handleUserMessage({
        session: await durable(s.session_id),
        userMessage: ans3,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const v3 = s.decision_context!.version;
      if (ev3.proposed_writes.length > 0 && ev3.classification !== "invalid_input") {
        assert.equal(v3, vBefore3 + 1, "t3 DC version must increase exactly once on legal write");
      }
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, s.decision_context!.context_id);
        assert.equal(s.decision_understanding.context_version, s.decision_context!.version);
      }
      const asst3 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan?.question_text, "turn3 must have authorized plan question");
      assert.equal(asst3.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst3.content, stubResponse);
      assert.equal(asst3.content.includes("【系统】"), false);
      assert.notEqual(asst3.content, q2);
      // Must not fall back to already-clear decision_question without cause
      const dqTemplate = "请把要做的决策问题说得更具体一点";
      const dqComplete =
        Boolean(s.decision_context?.definition.decision_question) &&
        String(s.decision_context!.definition.decision_question).trim().length >= 4;
      if (dqComplete) {
        assert.notEqual(
          asst3.content,
          dqTemplate,
          "t3 must not re-ask decision_question when DQ already established",
        );
        assert.equal(
          s.adaptive_ask_plan!.dir_ids.includes("decision_question"),
          false,
        );
      }
      // Question must bind a legal Need/Planner gap (DIR/DDR present)
      assert.ok(s.adaptive_ask_plan!.dir_ids.length >= 1 || s.adaptive_ask_plan!.ddr_ids.length >= 1);
      assert.ok(
        s.agent_v2?.current_phase === "collecting_context" ||
          s.agent_v2?.current_phase === "awaiting_confirmation",
      );
      const llmAfter3 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(
        `[m24h-t3] dc_v=${v3}; phase=${s.agent_v2?.current_phase}; authQ=${(s.adaptive_ask_plan?.question_text ?? asst3.content).slice(0, 80)}; llmDelta=${llmAfter3 - llmBefore3}; dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; roles=${(s.adaptive_ask_plan!.fact_role_codes ?? []).join(",")}`,
      );
      console.log(
        `[m24h] path=handleUserMessage×3; versions=${v1}->${v2}->${v3}; total_llm_fetches=${fetchCalls.filter((u)=>u==="/api/poju/chat").length}; q0=${q0.slice(0,40)}; plan0_dirs=${plan0.dir_ids.join(",")}`,
      );
    });

    // ---------- M2.4-R1-FU1 Cases I–M ----------
    await check("M2.4-R1-FU1 Case I: Plan-authorized option only; other roles remain needs", async () => {
      const optDirs = [
        dir("DIR-OPT-ON-TABLE", "有哪些真实可选方案", ["option", "status_quo", "risk"]),
        dir("DIR-OPT-CONSTRAINTS", "硬性约束（钱/时间/责任）", ["hard_constraint"]),
      ];
      const { sid, plan } = await withAuthorizedAsk("m24i", optDirs, {
        decision_question: "要不要接受 offer？",
      });
      let s = await durable(sid);
      // Force actually-sent Plan to authorize ONLY option (not full DIR required roles).
      const optionOnlyPlan = {
        ...plan,
        plan_id: `${plan.plan_id}_option_only`,
        dir_ids: ["DIR-OPT-ON-TABLE"],
        fact_role_codes: ["v1/dir/DIR-OPT-ON-TABLE/role/option"],
      };
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      s = attachAuthorizedAssistantQuestion(s, optionOnlyPlan, "ask_m24i_option");
      await mutatePOJUSession(sid, {
        operation_id: "op_m24i_attach",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      assert.deepEqual(
        s.decision_understanding!.last_sent_question!.fact_role_codes,
        ["v1/dir/DIR-OPT-ON-TABLE/role/option"],
      );

      const event = interpretUserAnswer({
        session: s,
        statement: "现实中有两个选项：接受 offer，或者留任。",
        source_turn_id: "turn_m24i",
      });
      assert.deepEqual(event.targets.dir_ids, ["DIR-OPT-ON-TABLE"]);
      assert.ok(event.proposed_writes.length >= 1);
      for (const w of event.proposed_writes) {
        assert.deepEqual(w.fact_roles, ["option"]);
      }
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      assert.equal(applied.applied, true);
      const facts = applied.session.decision_context!.reality_facts.filter(
        (f) => f.source_turn_id === "turn_m24i",
      );
      assert.ok(facts.length >= 1);
      for (const f of facts) {
        assert.deepEqual(f.fact_roles, ["option"]);
      }
      const u = buildUnderstandingState({
        session: applied.session,
        blueprint: applied.session.decision_blueprint!,
        now: NOW,
      });
      const need = u.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && n.dir_id === "DIR-OPT-ON-TABLE",
      );
      assert.ok(need && need.kind === "dir_based", "DIR must remain in need_to_understand");
      if (need && need.kind === "dir_based") {
        assert.match(need.missing_content, /status_quo/);
        assert.match(need.missing_content, /risk/);
        assert.equal(/missing_roles:[^;]*\boption\b/.test(need.missing_content), false);
      }
      assert.equal(
        u.understood.items.some((i) => i.dir_id === "DIR-OPT-ON-TABLE"),
        false,
        "must not mark whole DIR known from option-only fact",
      );
      // Subsequent planner can continue asking status_quo or risk
      const next = await runCollectingDcTurn(applied.session, {
        statement: "",
        source_turn_id: "turn_m24i_next",
        now: NOW,
        init_only: true,
      });
      assert.ok(next.plan, "planner must continue");
      const nextRoles = (next.plan!.fact_role_codes ?? [])
        .map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        })
        .filter(Boolean);
      assert.ok(
        nextRoles.some((r) => r === "status_quo" || r === "risk" || r === "hard_constraint" || r === "option") ||
          next.plan!.dir_ids.length >= 1,
        `subsequent plan must target remaining gaps; roles=${nextRoles.join(",")}`,
      );
      console.log(
        `[m24i] dirs=${event.targets.dir_ids.join(",")}; write_roles=${event.proposed_writes.map((w)=>w.fact_roles.join("+")).join("|")}; need=${need && need.kind==="dir_based"?need.missing_content:"?"}; next_roles=${nextRoles.join(",")}`,
      );
    });

    await check("M2.4-R1-FU1 Case J: historical last_sent missing fact_role_codes + mismatched plan_id → invalid", async () => {
      const { sid, plan } = await withAuthorizedAsk("m24j", jobDirs);
      let s = await durable(sid);
      const last = s.decision_understanding!.last_sent_question!;
      // Strip fact_role_codes and mismatch plan_id vs next_question_plan
      s = {
        ...s,
        decision_understanding: {
          ...s.decision_understanding!,
          last_sent_question: {
            question_text: last.question_text,
            plan_id: "historical_plan_without_roles",
            direction_id: last.direction_id,
            dir_ids: [...last.dir_ids],
            ddr_ids: [...last.ddr_ids],
            turn_id: last.turn_id,
            // fact_role_codes intentionally omitted
          },
          next_question_plan: {
            ...plan,
            plan_id: "different_current_plan_id",
          },
        },
        adaptive_ask_plan: {
          ...plan,
          plan_id: "different_current_plan_id",
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_m24j_hist",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const vBefore = s.decision_context!.version;
      const factsBefore = s.decision_context!.reality_facts.length;
      const event = interpretUserAnswer({
        session: s,
        statement: "真实选项有两个：接受或留任。",
        source_turn_id: "turn_m24j",
      });
      assert.equal(event.classification, "invalid_input");
      assert.ok(event.notes.includes("missing_authorized_fact_roles"));
      assert.equal(event.proposed_writes.length, 0);
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      assert.equal(applied.applied, false);
      assert.equal(applied.session.decision_context!.version, vBefore);
      assert.equal(applied.session.decision_context!.reality_facts.length, factsBefore);
      console.log(
        `[m24j] cls=${event.classification}; notes=${event.notes.join(",")}; writes=${event.proposed_writes.length}; dc_v=${applied.session.decision_context!.version}`,
      );
    });

    await check("M2.4-R1-FU1 Case K: correction supplement must not create Conflict", async () => {
      const { sid } = await withAuthorizedAsk("m24k", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "目前在职",
        source_turn_id: "turn_m24k_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      const corr = interpretUserAnswer({
        session: s,
        statement: "更正一下，我还有一份兼职收入。",
        source_turn_id: "turn_m24k_2",
      });
      assert.equal(corr.classification, "correction");
      const a2 = await applyAnswerEventToSessionDc(s, corr, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      assert.ok(dc.reality_facts.some((f) => f.fact_id === oldId), "old fact kept");
      assert.ok(dc.reality_facts.some((f) => f.source_turn_id === "turn_m24k_2"), "new fact appended");
      assert.equal(dc.conflicts.filter((c) => c.state === "open").length, 0, "supplement must not create Conflict");
      console.log(
        `[m24k] old=${oldId}; new_facts=${dc.reality_facts.filter((f)=>f.source_turn_id==="turn_m24k_2").map(f=>f.fact_id).join(",")}; open=${dc.conflicts.filter(c=>c.state==="open").length}; cls=${corr.classification}`,
      );
    });

    await check("M2.4-R1-FU1 Case L: explicit contradiction creates open Conflict", async () => {
      const { sid } = await withAuthorizedAsk("m24l", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "目前没有其他工作收入",
        source_turn_id: "turn_m24l_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      const contra = interpretUserAnswer({
        session: s,
        statement: "之前说的不准确，我实际上还有一份固定兼职收入。",
        source_turn_id: "turn_m24l_2",
      });
      assert.equal(contra.classification, "contradiction");
      const a2 = await applyAnswerEventToSessionDc(s, contra, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      assert.ok(dc.reality_facts.some((f) => f.fact_id === oldId), "old fact kept");
      const neu = dc.reality_facts.find((f) => f.source_turn_id === "turn_m24l_2");
      assert.ok(neu);
      const open = dc.conflicts.filter((c) => c.state === "open");
      assert.ok(open.length >= 1, "explicit contradiction must open Conflict");
      const hit = open.find((c) => c.fact_ids.includes(oldId) && c.fact_ids.includes(neu!.fact_id));
      assert.ok(hit, "both fact ids in Conflict.fact_ids");
      assert.equal(hit!.state, "open");
      assert.ok(hit!.source_refs.length >= 2);
      assert.ok(hit!.source_refs.every((r) => r.fact_id && r.source_turn_id));
      console.log(
        `[m24l] old=${oldId}; new=${neu!.fact_id}; open=${open.length}; source_refs=${hit!.source_refs.length}; cls=${contra.classification}`,
      );
    });

    await check("M2.4-R1-FU1 Case M: time change must not create Conflict", async () => {
      const { sid } = await withAuthorizedAsk("m24m", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "2025 年仍在职",
        source_turn_id: "turn_m24m_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      // Use correction framing so conflict path is evaluated; different years must not conflict.
      const corr = interpretUserAnswer({
        session: s,
        statement: "更正：2026 年初已经离职。",
        source_turn_id: "turn_m24m_2",
      });
      assert.ok(
        corr.classification === "correction" || corr.classification === "contradiction",
        `expected correction/contradiction, got ${corr.classification}`,
      );
      const a2 = await applyAnswerEventToSessionDc(s, corr, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      assert.ok(dc.reality_facts.some((f) => f.fact_id === oldId), "old fact kept");
      assert.ok(dc.reality_facts.some((f) => f.source_turn_id === "turn_m24m_2"), "new fact kept");
      assert.equal(dc.conflicts.filter((c) => c.state === "open").length, 0, "time change must not create Conflict");
      console.log(
        `[m24m] old=${oldId}; open=${dc.conflicts.filter(c=>c.state==="open").length}; cls=${corr.classification}`,
      );
    });

'''

t2 = t[:start] + new_cases + t[end:]
p.write_text(t2, encoding="utf-8")
print("tests updated; lines", len(t2.splitlines()))
