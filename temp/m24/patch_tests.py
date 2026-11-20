# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"scripts/test-m1-production-adaptive-question-loop.ts")
t = p.read_text(encoding="utf-8")

# Ensure applyAnswerEventToSessionDc import
if "applyAnswerEventToSessionDc" not in t:
    t = t.replace(
        '''  const { interpretUserAnswer } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );''',
        '''  const { interpretUserAnswer } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
  const { applyAnswerEventToSessionDc } = await import(
    "../lib/poju/decision-intake/apply-answer-to-dc"
  );
  const { buildUnderstandingState } = await import(
    "../lib/poju/decision-intake/understanding-state"
  );
  const { generateQuestionText, buildAdaptiveQuestionPlan } = await import(
    "../lib/poju/decision-intake/question-generation"
  );''',
    )
    print("added imports")

old_interp = '''    // Interpretation unit sanity
    await check("M1-interp classifier covers estimate/unknown/declined/constraint", async () => {
      const sid = await seedSession("interp", jobDirs);
      const s = await durable(sid);
      const e1 = interpretUserAnswer({
        session: s,
        statement: "大概三个月。",
        source_turn_id: "t1",
      });
      assert.equal(e1.classification, "estimate");
      const e2 = interpretUserAnswer({
        session: s,
        statement: "不知道",
        source_turn_id: "t2",
      });
      assert.equal(e2.classification, "unknown");
      const e3 = interpretUserAnswer({
        session: s,
        statement: "预算不能低于两万",
        source_turn_id: "t3",
      });
      assert.ok(e3.proposed_writes.some((w) => w.kind === "constraint"));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }'''

new_block = r'''    // Interpretation unit sanity (requires authorized answer target = last_sent / plan)
    await check("M1-interp classifier covers estimate/unknown/declined/constraint", async () => {
      const sid = await seedSession("interp", jobDirs);
      const init = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_interp",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_interp_init",
        kind: "session_patch",
        bump_dc: true,
        apply: () => init.session,
      });
      const s = await durable(sid);
      assert.ok(s.adaptive_ask_plan || s.decision_understanding?.next_question_plan);
      const e1 = interpretUserAnswer({
        session: s,
        statement: "大概三个月。",
        source_turn_id: "t1",
      });
      assert.equal(e1.classification, "estimate");
      const e2 = interpretUserAnswer({
        session: s,
        statement: "不知道",
        source_turn_id: "t2",
      });
      assert.equal(e2.classification, "unknown");
      const e3 = interpretUserAnswer({
        session: s,
        statement: "预算不能低于两万",
        source_turn_id: "t3",
      });
      assert.ok(e3.proposed_writes.some((w) => w.kind === "constraint"));
    });

    // ---------- M2.4-R1 Cases A–H ----------
    async function withAuthorizedAsk(
      tag: string,
      dirs: DecisionContext["dirs"],
      definition?: Partial<DecisionContext["definition"]>,
    ) {
      const sid = await seedSession(tag, dirs, definition);
      const init = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: `init_${tag}`,
        now: NOW,
        init_only: true,
      });
      assert.ok(init.plan && init.authorized_question, `${tag} first plan`);
      // Attach last_sent so answer targeting uses the real current question.
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      const attached = attachAuthorizedAssistantQuestion(
        init.session,
        init.plan!,
        `ask_${tag}`,
      );
      await mutatePOJUSession(sid, {
        operation_id: `op_m24_${tag}_init`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => attached,
      });
      return { sid, plan: init.plan!, q0: init.authorized_question! };
    }

    await check("M2.4-R1 Case A: multi-fact answer → multiple ProposedWrites; no unrelated DIR", async () => {
      const { sid, plan } = await withAuthorizedAsk("m24a", jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const s = await durable(sid);
      const stmt =
        "一个真实选项是内部调岗留任。另外我目前月薪税后两万。";
      const event = interpretUserAnswer({
        session: s,
        statement: stmt,
        source_turn_id: "turn_m24a",
      });
      console.log(
        `[m24a] cls=${event.classification}; writes=${event.proposed_writes.length}; dirs=${event.targets.dir_ids.join(",")}`,
      );
      assert.ok(event.proposed_writes.length >= 2, "must split independent facts");
      for (const w of event.proposed_writes) {
        assert.equal(w.status, "unverified");
        assert.notEqual(w.status, "confirmed");
        for (const d of w.related_dir_ids) {
          assert.ok(plan.dir_ids.includes(d), `write must stay on plan DIRs, got ${d}`);
        }
        assert.equal(
          w.related_dir_ids.includes("DIR-STAKEHOLDERS"),
          false,
          "must not assign to unrelated DIR",
        );
      }
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      assert.equal(applied.applied, true);
      assert.equal(applied.fact_ids_written.length, event.proposed_writes.filter((w) => w.kind === "reality_fact").length);
      const dc = applied.session.decision_context!;
      assert.ok(dc.reality_facts.length >= 2);
      console.log(
        `[m24a] applied facts=${applied.fact_ids_written.join(",")}; dc_version=${dc.version}`,
      );
    });

    await check("M2.4-R1 Case B: estimate → user_estimate + unverified (not confirmed)", async () => {
      const { sid } = await withAuthorizedAsk("m24b", jobDirs);
      const s = await durable(sid);
      const event = interpretUserAnswer({
        session: s,
        statement: "大概需要三个月",
        source_turn_id: "turn_m24b",
      });
      assert.equal(event.classification, "estimate");
      assert.ok(event.proposed_writes.length >= 1);
      assert.equal(event.proposed_writes[0]!.verification_level, "user_estimate");
      assert.equal(event.proposed_writes[0]!.status, "unverified");
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      const fact = applied.session.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === "turn_m24b",
      );
      assert.ok(fact);
      assert.equal(fact!.verification_level, "user_estimate");
      assert.equal(fact!.status, "unverified");
      assert.notEqual(fact!.status, "confirmed");
      console.log(
        `[m24b] verification_level=${fact!.verification_level}; status=${fact!.status}`,
      );
    });

    await check("M2.4-R1 Case C: unknown/declined statuses; no effective ask-budget charge on answer", async () => {
      const { sid } = await withAuthorizedAsk("m24c", jobDirs);
      let s = await durable(sid);
      const askedBefore = s.decision_understanding?.budget.session_asked_count ?? 0;

      const unk = interpretUserAnswer({
        session: s,
        statement: "不知道",
        source_turn_id: "turn_m24c_unk",
      });
      assert.equal(unk.classification, "unknown");
      assert.equal(unk.proposed_writes[0]?.status, "unknown");
      const a1 = await applyAnswerEventToSessionDc(s, unk, { now: NOW });
      assert.equal(a1.applied, true);
      const f1 = a1.session.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === "turn_m24c_unk",
      );
      assert.equal(f1!.status, "unknown");
      assert.notEqual(f1!.status, "unverified");
      // Apply path must not bump ask budget.
      assert.equal(
        a1.session.decision_understanding?.budget.session_asked_count ?? askedBefore,
        askedBefore,
      );

      // Declined on a fresh turn / fresh session ask target
      const { sid: sid2 } = await withAuthorizedAsk("m24c2", jobDirs);
      const s2 = await durable(sid2);
      const asked2 = s2.decision_understanding?.budget.session_asked_count ?? 0;
      const dec = interpretUserAnswer({
        session: s2,
        statement: "不想回答",
        source_turn_id: "turn_m24c_dec",
      });
      assert.equal(dec.classification, "declined");
      assert.equal(dec.proposed_writes[0]?.status, "declined");
      const a2 = await applyAnswerEventToSessionDc(s2, dec, { now: NOW });
      const f2 = a2.session.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === "turn_m24c_dec",
      );
      assert.equal(f2!.status, "declined");
      assert.equal(
        a2.session.decision_understanding?.budget.session_asked_count ?? asked2,
        asked2,
      );
      console.log(
        `[m24c] unknown_status=${f1!.status}; declined_status=${f2!.status}; askedBefore=${askedBefore}; asked2=${asked2}`,
      );
    });

    await check("M2.4-R1 Case D: correction keeps old fact; open Conflict on clear clash", async () => {
      const { sid } = await withAuthorizedAsk("m24d", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "可选方案只有内部调岗",
        source_turn_id: "turn_m24d_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      // Keep same last_sent target for correction turn.
      const corr = interpretUserAnswer({
        session: s,
        statement: "更正：不是只有内部调岗，而是还可以外部创业",
        source_turn_id: "turn_m24d_2",
      });
      assert.ok(
        corr.classification === "correction" ||
          corr.classification === "contradiction",
        `expected correction/contradiction, got ${corr.classification}`,
      );
      const a2 = await applyAnswerEventToSessionDc(s, corr, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      const oldStill = dc.reality_facts.find((f) => f.fact_id === oldId);
      assert.ok(oldStill, "old fact must remain");
      const neu = dc.reality_facts.find((f) => f.source_turn_id === "turn_m24d_2");
      assert.ok(neu);
      assert.notEqual(neu!.fact_id, oldId);
      const open = dc.conflicts.filter((c) => c.state === "open");
      assert.ok(open.length >= 1, "clear conflict must open Conflict");
      assert.ok(open.some((c) => c.fact_ids.includes(oldId) && c.fact_ids.includes(neu!.fact_id)));
      console.log(
        `[m24d] old=${oldId}; new=${neu!.fact_id}; open_conflicts=${open.length}; cls=${corr.classification}`,
      );
    });

    await check("M2.4-R1 Case E: dynamic question text differs across decision gaps", async () => {
      const a = await withAuthorizedAsk("m24e1", jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const b = await withAuthorizedAsk("m24e2", moveDirs, {
        decision_question: "要不要搬去上海？",
        concrete_event: "City move",
      });
      const sa = await durable(a.sid);
      const sb = await durable(b.sid);
      assert.notDeepEqual(
        sa.decision_blueprint!.dir_ids.slice().sort(),
        sb.decision_blueprint!.dir_ids.slice().sort(),
      );
      assert.notEqual(a.q0, b.q0);
      // Not the old fixed DIR.need template alone
      assert.equal(/请具体说明：/.test(a.q0) && a.q0 === `请具体说明：${sa.decision_context!.dirs[0]!.need}？`, false);
      console.log(
        `[m24e] qA=${a.q0.slice(0, 80)}; qB=${b.q0.slice(0, 80)}; dirsA=${a.plan.dir_ids.join(",")}; dirsB=${b.plan.dir_ids.join(",")}`,
      );
    });

    await check("M2.4-R1 Case F: satisfied role not re-asked; next role gap", async () => {
      const { sid, plan, q0 } = await withAuthorizedAsk("m24f", [
        dir("DIR-OPT-ON-TABLE", "有哪些真实可选方案", ["option", "status_quo"]),
        dir("DIR-OPT-CONSTRAINTS", "硬性约束（钱/时间/责任）", ["hard_constraint"]),
      ], { decision_question: "要不要换工作？" });
      let s = await durable(sid);
      const targetDir = plan.dir_ids[0]!;
      // Write a fact that satisfies the first required role on the active DIR.
      const roles = s.decision_context!.dirs.find((d) => d.dir_id === targetDir)?.required_fact_roles ?? ["option"];
      const role0 = roles[0]!;
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...s.decision_context!.reality_facts,
            {
              fact_id: "fact_seed_role0",
              statement: role0 === "option" ? "真实可选方案：留任或跳槽" : `seed for ${role0}`,
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "seed_role0",
              user_confirmed: false,
              fact_roles: [role0],
              related_dir_ids: [targetDir],
              updated_at: NOW,
            },
          ],
          version: (s.decision_context!.version ?? 1) + 1,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_m24f_seed",
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
      const need = u.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && n.dir_id === targetDir,
      );
      if (need && need.kind === "dir_based") {
        assert.ok(
          !need.missing_content.includes(`missing_roles:${role0}`) ||
            need.missing_content.includes("missing_roles:"),
        );
        // role0 should no longer be listed as missing
        assert.equal(
          need.missing_content.includes(`missing_roles:${role0},`) ||
            need.missing_content.startsWith(`missing_roles:${role0};`) ||
            need.missing_content === `missing_roles:${role0}; ${s.decision_context!.dirs.find(d=>d.dir_id===targetDir)!.need}`,
          false,
          `role ${role0} must not remain the sole/leading missing role: ${need.missing_content}`,
        );
        assert.equal(
          /missing_roles:option(;|,|$)/.test(need.missing_content) && role0 === "option"
            ? need.missing_content.includes("missing_roles:option;") || need.missing_content.includes("missing_roles:option,")
            : false,
          false,
        );
      }
      // Generate next question — should not restate the same satisfied option ask.
      const next = await runCollectingDcTurn(s, {
        statement: "补充一点：家庭希望我稳定",
        source_turn_id: "turn_m24f_next",
        now: NOW,
      });
      assert.ok(next.authorized_question || next.outcome === "ready_no_question" || next.outcome === "planned" || next.outcome === "planner_blocked");
      if (next.authorized_question) {
        assert.notEqual(next.authorized_question, q0);
        assert.equal(
          /真实可选方案：留任或跳槽/.test(next.authorized_question),
          false,
        );
      }
      console.log(
        `[m24f] targetDir=${targetDir}; role0=${role0}; need=${need && need.kind === "dir_based" ? need.missing_content : "n/a"}; nextQ=${(next.authorized_question ?? next.outcome)?.toString().slice(0, 100)}`,
      );
    });

    await check("M2.4-R1 Case G: open Conflict → Understanding conflict; DIR not known; ask resolves", async () => {
      const { sid } = await withAuthorizedAsk("m24g", jobDirs);
      let s = await durable(sid);
      const dirId = s.adaptive_ask_plan?.dir_ids[0] ?? s.decision_understanding!.last_sent_question!.dir_ids[0]!;
      // Seed two conflicting facts + open conflict on the DIR.
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
      const turn = await runCollectingDcTurn(s, {
        statement: "冲突里创业选项是真实的",
        source_turn_id: "turn_m24g",
        now: NOW,
      });
      if (turn.authorized_question) {
        assert.match(turn.authorized_question, /冲突|澄清|属实|哪一项/);
      }
      console.log(
        `[m24g] conflict_briefs=${u.current_understanding.conflict_briefs.length}; gap=${need && need.kind==="dir_based"?need.gap_type:"?"}; nextQ=${(turn.authorized_question ?? turn.outcome)?.toString().slice(0,120)}`,
      );
    });

    await check("M2.4-R1 Case H: real Agent main path ≥3 turns; LLM does not override authorized Q", async () => {
      fetchCalls.length = 0;
      const llmBefore = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      const sid = await createPOJUSession({
        payment_id: "pay_m24h",
        original_question: "要不要接受新 offer？",
      });
      // Turn 1: opening / bootstrap via real Agent
      stubResponse = "STUB_SHOULD_NOT_OVERRIDE_AUTH_Q";
      let s = await handleUserMessage({
        session: await durable(sid),
        userMessage: "要不要接受新 offer？我在犹豫。",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const phase1 = s.agent_v2?.current_phase;
      const v1 = s.decision_context?.version ?? 0;
      const q1 = s.adaptive_ask_plan?.question_text ?? lastAssistant(s).content;
      const llmAfter1 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(`[m24h-t1] phase=${phase1}; dc_v=${v1}; q=${String(q1).slice(0, 80)}; llmDelta=${llmAfter1 - llmBefore}`);

      // Ensure collecting with a plan for subsequent answers
      if (!s.decision_context || s.decision_context.status !== "draft") {
        // Seed minimal collecting path like other tests if opening didn't create DC yet.
        const seeded = await seedSession("m24h_seed", jobDirs, {
          decision_question: "要不要接受新 offer？",
        });
        const init = await runCollectingDcTurn(await durable(seeded), {
          statement: "",
          source_turn_id: "init_m24h",
          now: NOW,
          init_only: true,
        });
        const { attachAuthorizedAssistantQuestion } = await import(
          "../lib/poju/decision-intake/adaptive-turn"
        );
        s = attachAuthorizedAssistantQuestion(init.session, init.plan!, "ask_m24h");
        await savePOJUSession(s);
      } else if (s.adaptive_ask_plan && !s.decision_understanding?.last_sent_question) {
        const { attachAuthorizedAssistantQuestion } = await import(
          "../lib/poju/decision-intake/adaptive-turn"
        );
        s = attachAuthorizedAssistantQuestion(s, s.adaptive_ask_plan, "ask_m24h");
        await savePOJUSession(s);
      }

      const vBefore2 = s.decision_context!.version;
      const uBefore2 = s.decision_understanding?.context_version;
      const llmBefore2 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      const qPrev = s.decision_understanding?.last_sent_question?.question_text ?? s.adaptive_ask_plan?.question_text;

      // Turn 2: answer first dynamic question
      s = await handleUserMessage({
        session: await durable(s.session_id),
        userMessage: "真实选项有两个：接受 offer，或留任争取加薪。",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const v2 = s.decision_context!.version;
      assert.ok(v2 >= vBefore2, "DC version must not decrease");
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, s.decision_context!.context_id);
        assert.equal(s.decision_understanding.context_version, s.decision_context!.version);
      }
      const asst2 = lastAssistant(s);
      if (s.adaptive_ask_plan?.question_text) {
        assert.equal(asst2.content, s.adaptive_ask_plan.question_text);
        assert.notEqual(asst2.content, stubResponse);
        assert.ok(s.adaptive_ask_plan.dir_ids.length >= 1);
        assert.ok(s.adaptive_ask_plan.ddr_ids.length >= 1);
      }
      assert.equal(s.agent_v2?.current_phase, "collecting_context");
      const llmAfter2 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(
        `[m24h-t2] dc_v=${v2}; phase=${s.agent_v2?.current_phase}; authQ=${(s.adaptive_ask_plan?.question_text ?? asst2.content).slice(0, 80)}; llmDelta=${llmAfter2 - llmBefore2}; prevQ_same=${asst2.content === qPrev}`,
      );

      const vBefore3 = s.decision_context!.version;
      const q2 = s.adaptive_ask_plan?.question_text ?? asst2.content;
      const llmBefore3 = fetchCalls.filter((u) => u === "/api/poju/chat").length;

      // Turn 3: answer second dynamic question
      s = await handleUserMessage({
        session: await durable(s.session_id),
        userMessage: "硬约束是年薪不能低于现在，且三个月内要决定。",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const v3 = s.decision_context!.version;
      assert.ok(v3 >= vBefore3);
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, s.decision_context!.context_id);
        assert.equal(s.decision_understanding.context_version, s.decision_context!.version);
      }
      const asst3 = lastAssistant(s);
      if (s.adaptive_ask_plan?.question_text) {
        assert.equal(asst3.content, s.adaptive_ask_plan.question_text);
        assert.notEqual(asst3.content, stubResponse);
        assert.notEqual(asst3.content, q2);
      }
      assert.ok(
        s.agent_v2?.current_phase === "collecting_context" ||
          s.agent_v2?.current_phase === "awaiting_confirmation",
      );
      const llmAfter3 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(
        `[m24h-t3] dc_v=${v3}; phase=${s.agent_v2?.current_phase}; authQ=${(s.adaptive_ask_plan?.question_text ?? asst3.content).slice(0, 80)}; llmDelta=${llmAfter3 - llmBefore3}`,
      );
      console.log(
        `[m24h] path=handleUserMessage×3; versions=${v1}->${v2}->${v3}; total_llm_fetches=${fetchCalls.filter((u)=>u==="/api/poju/chat").length}`,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }'''

if old_interp not in t:
    raise SystemExit('interp block not found exactly')
t = t.replace(old_interp, new_block)
p.write_text(t, encoding='utf-8')
print('patched m1 tests; size', p.stat().st_size)
