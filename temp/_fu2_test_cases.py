from pathlib import Path
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
anchor = '''    await check("M2.4-R2 static: production path uses model interpretation before DC write", async () => {
'''
if anchor not in text:
    raise SystemExit("static check anchor not found")

cases = r'''
    async function runFu2NullRolePending(tag: string) {
      const seeded = await seedAnswerReadySession(tag);
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前仍在职。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "null role under multi-role auth",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return {
        before,
        out,
        codeA,
        codeB,
        lastSentBefore,
        askedBefore,
        vBefore,
        factsBefore,
        cstBefore,
        draft,
      };
    }

    await check("M2.4-R2-FU2-A: no last_sent_question cannot authorize from next plan", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu2a");
      const plan =
        seeded.decision_understanding?.next_question_plan ?? seeded.adaptive_ask_plan ?? null;
      assert.ok(plan, "FU2-A needs a next_question_plan");
      assert.ok(seeded.decision_understanding?.last_sent_question, "seed should start with last_sent");
      const before = {
        ...seeded,
        decision_understanding: {
          ...seeded.decision_understanding!,
          last_sent_question: null,
          next_question_plan: plan,
        },
        adaptive_ask_plan: plan,
      };
      const targets = activeTargets(before);
      assert.equal(targets.auth_error, "missing_authorized_answer_target");
      assert.equal(targets.fact_role_codes.length, 0);
      const legalCode = plan.fact_role_codes[0] ?? null;
      assert.ok(legalCode, "FU2-A plan should have a role code that must not authorize this turn");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前仍在职。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "should not authorize from unsent plan",
      };
      stubResponse = "FU2A FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU2-A must not write RealityFacts");
      assert.equal(dc.constraints.length, cstBefore, "FU2-A must not write Constraints");
      assert.equal(dc.version, vBefore, "FU2-A must not bump DC version");
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "我目前仍在职。",
        source_turn_id: "probe_m24r2fu2a",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0);
      assert.ok(
        probe.notes.includes("missing_authorized_answer_target") ||
          probe.notes.some((n) => n.includes("missing_authorized_answer_target")),
        `FU2-A must fail closed on missing last_sent, notes=${probe.notes.join("|")}`,
      );
      assert.equal(before.decision_understanding?.last_sent_question ?? null, null);
      const wroteFromPlan = dc.reality_facts.some((f) => f.statement.includes("我目前仍在职"));
      assert.equal(wroteFromPlan, false);
      console.log(
        `[m24r2fu2a] auth=${targets.auth_error}; plan_id=${plan.plan_id}; last_sent_before=null; last_sent_after=${out.decision_understanding?.last_sent_question?.plan_id ?? "null"}; facts=${factsBefore}->${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; writes=${probe.proposed_writes.length}; notes=${probe.notes.join(",")}`,
      );
    });

    await check("M2.4-R2-FU2-B: null role_code_hint under multi-role keeps pending clarification", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2b");
      const { out, before, codeA, codeB, lastSentBefore, askedBefore, vBefore, factsBefore, cstBefore, draft } = ctx;
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU2-B must not write the unbound fact");
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "FU2-B pending_answer_resolution must be persisted on the session");
      assert.equal(pending!.source_turn_id, lastUserId(out));
      assert.ok(pending!.unresolved_items.some((i) => i.reason === "unlocated_role_code"));
      assert.deepEqual([...pending!.authorized_role_codes].sort(), [codeA, codeB].sort());
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        `FU2-B must ask a role clarification, got=${asst.content.slice(0, 160)}`,
      );
      assert.ok(asst.content.includes("我目前仍在职"));
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "FU2-B must not jump to the next unrelated NeedItem");
      assert.ok((out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"));
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "我目前仍在职。",
        source_turn_id: "probe_m24r2fu2b",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0);
      assert.ok((probe.unresolved_items ?? []).some((i) => i.reason === "unlocated_role_code"));
      console.log(
        `[m24r2fu2b] codes=${codeA}|${codeB}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${out.decision_understanding?.budget.session_asked_count ?? askedBefore}; pending=${pending!.status}:${pending!.unresolved_items.map((i)=>i.reason).join(",")}; next_q=${asst.content.replace(/\\n/g, " / ").slice(0, 180)}; next_dirs=${nextDirs.join(",")}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-C: clarification binds only the chosen role and clears pending", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2c");
      const { out: pendingSession, codeA, codeB, vBefore, factsBefore } = ctx;
      assert.ok(pendingSession.pending_answer_resolution, "FU2-C setup must have pending");
      const chosen = codeA;
      const other = codeB;
      stubResponse = "FU2C FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: `这条信息属于 ${chosen}`,
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement.includes("我目前仍在职"));
      assert.ok(fact, "FU2-C must write the original unresolved item after bind");
      assert.deepEqual(fact!.fact_roles, [chosen.split("/role/")[1]]);
      assert.deepEqual(fact!.related_dir_ids, [roleCodeDir(chosen)]);
      const otherFilled = dc.reality_facts.some(
        (f) =>
          (f.fact_roles ?? []).includes(other.split("/role/")[1] ?? "") &&
          (f.related_dir_ids ?? []).includes(roleCodeDir(other)),
      );
      assert.equal(otherFilled, false, "FU2-C must not fill the other authorized role");
      assert.equal(out.pending_answer_resolution ?? null, null, "FU2-C must clear pending after successful bind");
      assert.ok(dc.version > vBefore);
      assert.ok(dc.reality_facts.length > factsBefore);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      assert.equal(
        (out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"),
        false,
        "successful bind should leave the clarification question",
      );
      console.log(
        `[m24r2fu2c] chosen=${chosen}; other=${other}; fact=${fact!.fact_id}:${(fact!.fact_roles ?? []).join(",")}:${(fact!.related_dir_ids ?? []).join(",")}; pending=${out.pending_answer_resolution ?? "null"}; dc=${vBefore}->${dc.version}; next=${out.decision_understanding?.last_sent_question?.plan_id ?? "null"}`,
      );
    });

    await check("M2.4-R2-FU2-D: unclear clarification keeps pending and does not jump NeedItem", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2d");
      const { out: pendingSession, lastSentBefore, vBefore, factsBefore, cstBefore, askedBefore } = ctx;
      const pendingBefore = pendingSession.pending_answer_resolution!;
      const clarifyPlanId = pendingSession.decision_understanding?.last_sent_question?.plan_id;
      const askedMid = pendingSession.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU2D FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "不确定",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore);
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "FU2-D must keep pending");
      assert.equal(pending!.source_turn_id, pendingBefore.source_turn_id);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        "FU2-D must stay on the role clarification question",
      );
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? pendingSession.adaptive_ask_plan?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "FU2-D must not jump to the next unrelated NeedItem");
      assert.equal(out.decision_understanding?.last_sent_question?.plan_id, clarifyPlanId);
      const askedAfter = out.decision_understanding?.budget.session_asked_count ?? askedMid;
      assert.equal(askedAfter, askedMid, "FU2-D must not deduct budget again for the same clarification");
      console.log(
        `[m24r2fu2d] facts=${factsBefore}->${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${askedMid}->${askedAfter}; pending=${pending!.status}:${pending!.source_turn_id}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-E: illegal role stays pending; legal item writes; plan not polluted", async () => {
      const before = await seedAnswerReadySession("m24r2fu2e");
      const auth = authorizedFrom(before);
      const legalCode = auth.fact_role_codes[0] ?? null;
      assert.ok(legalCode, "FU2-E needs a legal authorized role code");
      const forged = "v1/dir/DIR-FORGED/role/forged_role";
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "伪造角色不应写入。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: forged,
            certainty: "explicit",
          },
          {
            text: "这是合法授权条目。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "illegal + legal",
      };
      stubResponse = "FU2E FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "伪造角色不应写入。另外这是合法授权条目。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const overreach = dc.reality_facts.filter((f) => f.statement.includes("伪造角色不应写入"));
      const legal = dc.reality_facts.filter((f) => f.statement.includes("合法授权条目"));
      assert.equal(overreach.length, 0, "illegal item must not write");
      assert.ok(legal.length >= 1, "legal item should write");
      assert.ok(dc.version > vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "illegal item must stay pending");
      assert.ok(pending!.unresolved_items.some((i) => i.reason === "unauthorized_role_code" || i.reason === "illegal_role_code"));
      assert.equal((out.adaptive_ask_plan?.fact_role_codes ?? []).includes(forged), false);
      assert.equal((out.decision_understanding?.last_sent_question?.fact_role_codes ?? []).includes(forged), false);
      const asst = lastAssistant(out);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        "FU2-E next question must address the pending illegal item",
      );
      assert.ok((out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"));
      console.log(
        `[m24r2fu2e] legal=${legalCode}; forged=${forged}; overreach=${overreach.length}; legal_facts=${legal.length}; pending=${pending!.status}:${pending!.unresolved_items.map((i)=>i.reason).join(",")}; dc=${vBefore}->${dc.version}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-F: partial success writes legal item and keeps unbound pending first", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu2f");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "合法事实已能绑定。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: codeA,
            certainty: "explicit",
          },
          {
            text: "这条还无法定位角色。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "partial success",
      };
      stubResponse = "FU2F FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "合法事实已能绑定。另外这条还无法定位角色。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const legal = dc.reality_facts.find((f) => f.statement.includes("合法事实已能绑定"));
      const unbound = dc.reality_facts.find((f) => f.statement.includes("这条还无法定位角色"));
      assert.ok(legal, "FU2-F legal item must write");
      assert.deepEqual(legal!.fact_roles, [codeA.split("/role/")[1]]);
      assert.deepEqual(legal!.related_dir_ids, [roleCodeDir(codeA)]);
      assert.equal(unbound, undefined, "FU2-F unbound item must not write yet");
      assert.ok(dc.version > vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "FU2-F must keep the unbound item pending");
      assert.ok(pending!.unresolved_items.some((i) => i.text.includes("这条还无法定位角色")));
      const asst = lastAssistant(out);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        "FU2-F next question must address pending first",
      );
      assert.ok(asst.content.includes("这条还无法定位角色"));
      assert.ok((out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"));
      console.log(
        `[m24r2fu2f] legal=${codeA}; other=${codeB}; wrote=${legal!.fact_id}:${(legal!.fact_roles ?? []).join(",")}; unbound_written=false; pending=${pending!.status}:${pending!.unresolved_items.map((i)=>i.reason).join(",")}; dc=${vBefore}->${dc.version}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-G: pending survives reload; replay does not duplicate write/pending/budget", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2g");
      const { out: first, askedBefore, vBefore, factsBefore, cstBefore } = ctx;
      const pendingFirst = first.pending_answer_resolution!;
      assert.ok(pendingFirst, "FU2-G first turn must create pending");
      const asked1 = first.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(first).content;
      const turnId = lastUserId(first);
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu2g_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const reloaded = await durable(first.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU2-G pending must survive persist/reload");
      assert.equal(reloaded.pending_answer_resolution!.source_turn_id, pendingFirst.source_turn_id);
      assert.equal(reloaded.pending_answer_resolution!.status, "pending");
      const replaySession = {
        ...reloaded,
        messages: [
          ...reloaded.messages,
          {
            role: "user" as const,
            content: "我目前仍在职。",
            timestamp: NOW,
            client_id: turnId,
          },
        ],
      };
      stubResponse = "FU2G FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: replaySession,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      const dc = replay.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "replay must not write DC");
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      assert.ok(replay.pending_answer_resolution, "replay must not drop pending");
      assert.equal(replay.pending_answer_resolution!.source_turn_id, pendingFirst.source_turn_id);
      const asked2 = replay.decision_understanding?.budget.session_asked_count ?? 0;
      assert.equal(asked2, asked1, "replay must not deduct budget again");
      const asst = lastAssistant(replay);
      assert.equal(asst.content, q1, "replay must restore the already-sent clarification");
      console.log(
        `[m24r2fu2g] turn=${turnId}; pending_reloaded=${Boolean(reloaded.pending_answer_resolution)}; pending_after=${replay.pending_answer_resolution?.status}; facts=${factsBefore}->${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${asked1}->${asked2}; q_recovered=${asst.content === q1}`,
      );
    });

    await check("M2.4-R2-FU2-H: last_sent historical recovery only when plan_id matches", async () => {
      const matchSeeded = await seedAnswerReadySession("m24r2fu2h_match");
      const matchLast = matchSeeded.decision_understanding!.last_sent_question!;
      const matchPlan =
        matchSeeded.decision_understanding?.next_question_plan ?? matchSeeded.adaptive_ask_plan!;
      assert.equal(matchPlan.plan_id, matchLast.plan_id, "seeded last_sent and plan should share plan_id");
      const legalCode = matchPlan.fact_role_codes[0] ?? null;
      assert.ok(legalCode);
      const { fact_role_codes: _ignored, ...lastNoCodes } = matchLast;
      const matchBefore = {
        ...matchSeeded,
        decision_understanding: {
          ...matchSeeded.decision_understanding!,
          last_sent_question: lastNoCodes,
          next_question_plan: matchPlan,
        },
        adaptive_ask_plan: matchPlan,
      };
      const matchTargets = activeTargets(matchBefore);
      assert.equal(matchTargets.auth_error, undefined);
      assert.ok(matchTargets.fact_role_codes.includes(legalCode));
      const matchFactsBefore = matchBefore.decision_context!.reality_facts.length;
      const matchVBefore = matchBefore.decision_context!.version;
      const matchDraft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "历史恢复后写入合法事实。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "historical recover",
      };
      stubResponse = "FU2H MATCH FREEFORM MUST NOT WIN";
      const matchOut = await handleUserMessage({
        session: matchBefore,
        userMessage: "历史恢复后写入合法事实。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => matchDraft },
      });
      const matchFact = matchOut.decision_context!.reality_facts.find((f) =>
        f.statement.includes("历史恢复后写入合法事实"),
      );
      assert.ok(matchFact, "matching plan_id must allow historical role-code recovery and write");
      assert.ok(matchOut.decision_context!.version > matchVBefore);
      assert.ok(matchOut.decision_context!.reality_facts.length > matchFactsBefore);

      const mismatchSeeded = await seedAnswerReadySession("m24r2fu2h_mismatch");
      const mismatchLast = mismatchSeeded.decision_understanding!.last_sent_question!;
      const mismatchPlan =
        mismatchSeeded.decision_understanding?.next_question_plan ?? mismatchSeeded.adaptive_ask_plan!;
      const { fact_role_codes: _ignored2, ...mismatchLastNoCodes } = mismatchLast;
      const mismatchBefore = {
        ...mismatchSeeded,
        decision_understanding: {
          ...mismatchSeeded.decision_understanding!,
          last_sent_question: {
            ...mismatchLastNoCodes,
            plan_id: "historical_plan_without_roles",
          },
          next_question_plan: { ...mismatchPlan, plan_id: "different_current_plan_id" },
        },
        adaptive_ask_plan: { ...mismatchPlan, plan_id: "different_current_plan_id" },
      };
      const mismatchTargets = activeTargets(mismatchBefore);
      assert.equal(mismatchTargets.auth_error, "missing_authorized_fact_roles");
      const mmFactsBefore = mismatchBefore.decision_context!.reality_facts.length;
      const mmVBefore = mismatchBefore.decision_context!.version;
      stubResponse = "FU2H MISMATCH FREEFORM MUST NOT WIN";
      const mismatchOut = await handleUserMessage({
        session: mismatchBefore,
        userMessage: "历史恢复失败不应写入。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "历史恢复失败不应写入。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: mismatchPlan.fact_role_codes[0] ?? null,
                certainty: "explicit" as const,
              },
            ],
            unresolved_aspects: [],
            explanation: "mismatch must not recover",
          }),
        },
      });
      assert.equal(mismatchOut.decision_context!.version, mmVBefore);
      assert.equal(mismatchOut.decision_context!.reality_facts.length, mmFactsBefore);
      assert.equal(
        mismatchOut.decision_context!.reality_facts.some((f) => f.statement.includes("历史恢复失败不应写入")),
        false,
      );

      const noneSeeded = await seedAnswerReadySession("m24r2fu2h_none");
      const nonePlan =
        noneSeeded.decision_understanding?.next_question_plan ?? noneSeeded.adaptive_ask_plan!;
      const noneBefore = {
        ...noneSeeded,
        decision_understanding: {
          ...noneSeeded.decision_understanding!,
          last_sent_question: null,
          next_question_plan: nonePlan,
        },
        adaptive_ask_plan: nonePlan,
      };
      const noneTargets = activeTargets(noneBefore);
      assert.equal(noneTargets.auth_error, "missing_authorized_answer_target");
      const noneVBefore = noneBefore.decision_context!.version;
      const noneFactsBefore = noneBefore.decision_context!.reality_facts.length;
      stubResponse = "FU2H NONE FREEFORM MUST NOT WIN";
      const noneOut = await handleUserMessage({
        session: noneBefore,
        userMessage: "没有已发送问题不得授权。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "没有已发送问题不得授权。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: nonePlan.fact_role_codes[0] ?? null,
                certainty: "explicit" as const,
              },
            ],
            unresolved_aspects: [],
            explanation: "no last_sent",
          }),
        },
      });
      assert.equal(noneOut.decision_context!.version, noneVBefore);
      assert.equal(noneOut.decision_context!.reality_facts.length, noneFactsBefore);

      console.log(
        `[m24r2fu2h] match_auth=${matchTargets.auth_error ?? "ok"}:${matchTargets.fact_role_codes.join("|")}; match_write=${Boolean(matchFact)}; match_dc=${matchVBefore}->${matchOut.decision_context!.version}; mismatch_auth=${mismatchTargets.auth_error}; mismatch_dc=${mmVBefore}->${mismatchOut.decision_context!.version}; none_auth=${noneTargets.auth_error}; none_dc=${noneVBefore}->${noneOut.decision_context!.version}`,
      );
    });

'''
# The raw string used \\n in console.log replace - in the actual TS we want /\\n/g
# In the r''' string, `asst.content.replace(/\\n/g` becomes replace(/\\n/g which is correct for TS regex for newline? 
# We want TS: asst.content.replace(/\n/g, " / ")
# In r''' , I wrote replace(/\\n/g) which is the JS source `/\n/g`... wait:
# r''' ... replace(/\\n/g ... '''  gives text: replace(/\\n/g  which in TS is regex of backslash-n, not newline.
# Fix after insert if needed. I'll fix in the file.

if text.count(anchor) != 1:
    raise SystemExit("static anchor not unique")
text = text.replace(anchor, cases + "\n" + anchor, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("FU2-A..H inserted, lines", text.count("\n"))
