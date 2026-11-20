from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")
anchor = '''      const modelSrc = readFileSync(
        join(process.cwd(), "lib/poju/decision-intake/answer-interpretation-model.ts"),
        "utf8",
      );
'''
assert anchor in text, "modelSrc anchor not found"

tests = r'''
    function withAuthorizedRoleCodes(
      session: POJUSessionState,
      codes: string[],
    ): POJUSessionState {
      const last = session.decision_understanding?.last_sent_question;
      assert.ok(last, "last_sent_question required for authorized role setup");
      const dirs = Array.from(
        new Set(
          [...last.dir_ids, ...codes.map((c) => roleCodeDir(c))].filter((d) => d.length > 0),
        ),
      );
      return {
        ...session,
        decision_understanding: session.decision_understanding
          ? {
              ...session.decision_understanding,
              last_sent_question: {
                ...last,
                dir_ids: dirs,
                fact_role_codes: [...codes],
              },
            }
          : session.decision_understanding,
      };
    }

    function roleName(code: string): string {
      return code.split("/role/")[1] ?? "";
    }

    function factForRole(
      dc: NonNullable<POJUSessionState["decision_context"]>,
      code: string,
      text: string,
    ) {
      const role = roleName(code);
      const dir = roleCodeDir(code);
      return dc.reality_facts.find(
        (f) =>
          f.statement.includes(text) &&
          (f.fact_roles ?? []).includes(role) &&
          (f.related_dir_ids ?? []).includes(dir),
      );
    }

    await check("M2.4-R2-FU3-A: three unresolved items are bound one at a time", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu3a");
      const codes = [...EXTRA_JOB_ROLE_CODES.slice(0, 3)];
      const before = withAuthorizedRoleCodes(seeded, codes);
      const texts = ["第一条待绑定事实。", "第二条待绑定事实。", "第三条待绑定事实。"];
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: texts.map((text) => ({
          text,
          semantic_kind: "reality_fact" as const,
          role_hint: null,
          role_code_hint: null,
          certainty: "explicit" as const,
        })),
        unresolved_aspects: [],
        explanation: "three unlocated items",
      };
      stubResponse = "FU3A FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: texts.join("另外"),
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0 && pending0.status === "pending", "FU3-A must create pending");
      assert.equal(pending0!.unresolved_items.length, 3, "FU3-A must keep all three unresolved items");
      const itemIds = pending0!.unresolved_items.map((i) => i.item_id);
      assert.equal(new Set(itemIds).size, 3, "FU3-A item_id values must be unique");
      assert.equal(
        s.decision_context!.reality_facts.length,
        before.decision_context!.reality_facts.length,
        "FU3-A first turn must not write DC",
      );
      const asst0 = lastAssistant(s);
      assert.ok(
        asst0.content.includes("已授权的调查角色") || asst0.content.includes("可选角色"),
        `FU3-A must ask a role clarification, got=${asst0.content.slice(0, 160)}`,
      );
      assert.ok(
        asst0.content.includes(texts[0]!),
        "FU3-A first clarification must address the first item only",
      );
      assert.equal(asst0.content.includes(texts[1]!), false, "FU3-A first question must not bind later items");

      for (let i = 0; i < 3; i++) {
        const pendingBefore = s.pending_answer_resolution;
        assert.ok(pendingBefore, `FU3-A item ${i} must still be pending`);
        const remainingBefore = pendingBefore!.unresolved_items.length;
        const factsBefore = s.decision_context!.reality_facts.length;
        const chosen = codes[i]!;
        stubResponse = `FU3A FREEFORM ROUND ${i}`;
        s = await handleUserMessage({
          session: s,
          userMessage: `这条信息属于 ${chosen}`,
          locale: "zh-CN",
        });
        const dc = s.decision_context!;
        assert.equal(dc.reality_facts.length, factsBefore + 1, `FU3-A turn ${i} must write exactly one fact`);
        const written = factForRole(dc, chosen, texts[i]!);
        assert.ok(written, `FU3-A must write item ${i} to ${chosen}`);
        const nextPending = s.pending_answer_resolution ?? null;
        if (i < 2) {
          assert.ok(nextPending && nextPending.status === "pending", `FU3-A after item ${i} must keep pending`);
          assert.equal(
            nextPending!.unresolved_items.length,
            remainingBefore - 1,
            `FU3-A after item ${i} must shrink pending by one`,
          );
          assert.equal(
            nextPending!.unresolved_items.some((item) => item.text === texts[i]),
            false,
            `FU3-A resolved item ${i} must leave pending`,
          );
          assert.ok(
            texts.slice(i + 1).every((text) =>
              nextPending!.unresolved_items.some((item) => item.text === text),
            ),
            `FU3-A remaining texts after item ${i} must be preserved`,
          );
          const asst = lastAssistant(s);
          assert.ok(
            asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
            `FU3-A next question after item ${i} must stay on role clarification`,
          );
          assert.ok(
            asst.content.includes(texts[i + 1]!),
            `FU3-A next question must address the next unresolved item`,
          );
        } else {
          assert.equal(nextPending, null, "FU3-A must clear pending only after the last item");
        }
      }
    });

    await check("M2.4-R2-FU3-B: same text different item_id writes both DIR/role", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu3b");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const shared = "同一条文本需要分别写入两个角色。";
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: shared,
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
          {
            text: shared,
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "same text two items",
      };
      stubResponse = "FU3B FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: shared,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0 && pending0.unresolved_items.length === 2, "FU3-B must keep both same-text items");
      assert.notEqual(
        pending0!.unresolved_items[0]!.item_id,
        pending0!.unresolved_items[1]!.item_id,
        "FU3-B same text must still have distinct item_id values",
      );
      s = await handleUserMessage({
        session: s,
        userMessage: `这条信息属于 ${codeA}`,
        locale: "zh-CN",
      });
      const first = factForRole(s.decision_context!, codeA, shared);
      assert.ok(first, "FU3-B first clarification must write role A");
      assert.ok(s.pending_answer_resolution, "FU3-B must keep the second item pending");
      s = await handleUserMessage({
        session: s,
        userMessage: `这条信息属于 ${codeB}`,
        locale: "zh-CN",
      });
      const dc = s.decision_context!;
      const second = factForRole(dc, codeB, shared);
      assert.ok(second, "FU3-B second clarification must write role B");
      assert.ok(factForRole(dc, codeA, shared), "FU3-B first write must still be present");
      assert.notEqual(first!.fact_id, second!.fact_id);
      assert.equal(s.pending_answer_resolution ?? null, null, "FU3-B must clear pending after both writes");
    });

    await check("M2.4-R2-FU3-C: unclear certainty stays pending and does not jump", async () => {
      const before = await seedAnswerReadySession("m24r2fu3c");
      const auth = authorizedFrom(before);
      const legalCode = auth.fact_role_codes[0];
      assert.ok(legalCode, "FU3-C needs an authorized role code");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "partial_answer",
        extracted_items: [
          {
            text: "目前大概还在职吧。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "unclear",
          },
        ],
        unresolved_aspects: [],
        explanation: "unclear certainty",
      };
      stubResponse = "FU3C FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "目前大概还在职吧。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-C must not write RealityFacts");
      assert.equal(dc.constraints.length, cstBefore, "FU3-C must not write Constraints");
      assert.equal(dc.version, vBefore, "FU3-C must not bump DC version");
      const pending = out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU3-C must create pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "unclear_certainty");
      const asst = lastAssistant(out);
      assert.ok(
        asst.content.includes("明确事实") && asst.content.includes("个人估计"),
        `FU3-C must ask a certainty clarification, got=${asst.content.slice(0, 200)}`,
      );
      assert.deepEqual(
        [...(out.adaptive_ask_plan?.dir_ids ?? [])].sort(),
        [...(lastSentBefore?.dir_ids ?? [])].sort(),
        "FU3-C must not jump to another NeedItem",
      );

      stubResponse = "FU3C STILL FREEFORM";
      const again = await handleUserMessage({
        session: out,
        userMessage: "不确定",
        locale: "zh-CN",
      });
      assert.equal(again.decision_context!.version, vBefore, "FU3-C uncertain follow-up must not write");
      assert.ok(again.pending_answer_resolution, "FU3-C pending must remain when still uncertain");
      assert.equal(again.pending_answer_resolution!.status, "pending");
      assert.deepEqual(
        [...(again.adaptive_ask_plan?.dir_ids ?? [])].sort(),
        [...(lastSentBefore?.dir_ids ?? [])].sort(),
        "FU3-C must still not jump after an uncertain reply",
      );
    });

    await check("M2.4-R2-FU3-D: estimated constraint writes only after explicit confirm", async () => {
      const before = await seedAnswerReadySession("m24r2fu3d");
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, "FU3-D needs an authorized role code");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "estimate",
        extracted_items: [
          {
            text: "预算大概不能超过五万。",
            semantic_kind: "constraint",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "estimated",
          },
        ],
        unresolved_aspects: [],
        explanation: "estimated constraint",
      };
      stubResponse = "FU3D FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: "预算大概不能超过五万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      let dc = s.decision_context!;
      assert.equal(dc.constraints.length, cstBefore, "FU3-D must not write the estimated Constraint");
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-D must not disguise an estimated constraint as a fact");
      assert.equal(dc.version, vBefore, "FU3-D must not bump DC version before confirm");
      const pending = s.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU3-D must create pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "estimated_constraint_not_persistable");
      assert.ok(
        lastAssistant(s).content.includes("明确约束") || lastAssistant(s).content.includes("明确陈述"),
        "FU3-D must ask the user to confirm the constraint as an explicit assertion",
      );

      stubResponse = "FU3D STILL FREEFORM";
      s = await handleUserMessage({
        session: s,
        userMessage: "仍然只是估计",
        locale: "zh-CN",
      });
      dc = s.decision_context!;
      assert.equal(dc.constraints.length, cstBefore, "FU3-D unconfirmed estimate must not write");
      assert.equal(dc.version, vBefore);
      assert.ok(s.pending_answer_resolution, "FU3-D must keep pending when still estimated");

      s = await handleUserMessage({
        session: s,
        userMessage: "确认这是明确约束",
        locale: "zh-CN",
      });
      dc = s.decision_context!;
      const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
      assert.ok(cst, "FU3-D must write the Constraint after explicit confirmation");
      assert.equal(cst!.verification_level, "user_asserted");
      assert.equal(s.pending_answer_resolution ?? null, null, "FU3-D must clear pending after confirm");
      assert.ok(dc.version > vBefore);
    });

    await check("M2.4-R2-FU3-E: refusal is auditable, not a fact, and survives reload", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3e");
      const pendingSession = ctx.out;
      const vBefore = pendingSession.decision_context!.version;
      const factsBefore = pendingSession.decision_context!.reality_facts.length;
      const lastSentBefore = pendingSession.decision_understanding?.last_sent_question ?? null;
      stubResponse = "FU3E FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-E must not write a fact from refusal");
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU3-E must keep pending after refusal");
      assert.equal(pending!.status, "rejected");
      assert.ok(
        (pending!.rejected_items ?? []).some((item) => item.text.includes("我目前仍在职")),
        "FU3-E must record an auditable rejected item",
      );
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? lastSentBefore?.dir_ids ?? [])].sort();
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "FU3-E must not silently jump to another NeedItem");
      const asst = lastAssistant(out);
      assert.equal(asst.content.includes("要不要离职") && !asst.content.includes("待澄清"), false);

      await savePOJUSession(out);
      const reloaded = await durable(out.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU3-E refusal must survive reload");
      assert.equal(reloaded.pending_answer_resolution!.status, "rejected");
      assert.ok((reloaded.pending_answer_resolution!.rejected_items ?? []).length >= 1);
    });

    await check("M2.4-R2-FU3-F: C1 persist failure keeps pending and retry does not duplicate", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3f");
      const pendingSession = ctx.out;
      const vBefore = pendingSession.decision_context!.version;
      const factsBefore = pendingSession.decision_context!.reality_facts.length;
      const chosen = ctx.codeA;
      stubResponse = "FU3F FREEFORM MUST NOT WIN";
      const failed = await handleUserMessage({
        session: pendingSession,
        userMessage: `这条信息属于 ${chosen}`,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          pendingBindPersist: async (previous) => ({
            session: previous,
            committed: false,
            error: "persist_failed",
          }),
        },
      });
      const failedDc = failed.decision_context!;
      assert.equal(failedDc.version, vBefore, "FU3-F failed persist must not commit DC");
      assert.equal(failedDc.reality_facts.length, factsBefore, "FU3-F must not leave a half-committed fact");
      assert.ok(failed.pending_answer_resolution, "FU3-F pending must not be lost on persist failure");
      const failAsst = [...failed.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");

      await savePOJUSession(failed);
      const reloaded = await durable(failed.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU3-F pending must survive the failed persist");
      assert.equal(reloaded.decision_context!.version, vBefore);

      const retried = await handleUserMessage({
        session: reloaded,
        userMessage: `这条信息属于 ${chosen}`,
        locale: "zh-CN",
      });
      const written = retried.decision_context!.reality_facts.filter((f) =>
        f.statement.includes("我目前仍在职"),
      );
      assert.equal(written.length, 1, "FU3-F retry must write the fact once, not twice");
      assert.ok(retried.decision_context!.version > vBefore);
      assert.equal(retried.pending_answer_resolution ?? null, null);
    });

    await check("M2.4-R2-FU3-G: pending fields survive persist/reload between item binds", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu3g");
      const codes = [...EXTRA_JOB_ROLE_CODES.slice(0, 3)];
      const before = withAuthorizedRoleCodes(seeded, codes);
      const texts = ["重载条目一。", "重载条目二。", "重载条目三。"];
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: texts.map((text) => ({
          text,
          semantic_kind: "reality_fact" as const,
          role_hint: null,
          role_code_hint: null,
          certainty: "explicit" as const,
        })),
        unresolved_aspects: [],
        explanation: "reload lifecycle",
      };
      stubResponse = "FU3G FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: texts.join("另外"),
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await savePOJUSession(s);
      s = await durable(s.session_id);
      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0, "FU3-G pending must persist after the first turn");
      const originalIds = pending0!.unresolved_items.map((i) => i.item_id);
      const asked0 = s.decision_understanding?.budget.session_asked_count ?? 0;
      const plan0 = s.pending_answer_resolution!.clarification_plan_id;

      for (let i = 0; i < 2; i++) {
        const remainingBefore = s.pending_answer_resolution!.unresolved_items.map((item) => item.item_id);
        const askedBefore = s.decision_understanding?.budget.session_asked_count ?? 0;
        s = await handleUserMessage({
          session: s,
          userMessage: `这条信息属于 ${codes[i]!}`,
          locale: "zh-CN",
        });
        await savePOJUSession(s);
        s = await durable(s.session_id);
        const pending = s.pending_answer_resolution;
        assert.ok(pending, `FU3-G pending must survive reload after item ${i}`);
        const remaining = pending!.unresolved_items.map((item) => item.item_id);
        assert.equal(remaining.length, remainingBefore.length - 1);
        assert.equal(remaining.includes(remainingBefore[0]!), false);
        assert.deepEqual(remaining, remainingBefore.slice(1));
        assert.ok(
          pending!.unresolved_items.every((item) => originalIds.includes(item.item_id)),
          "FU3-G item identity must stay stable across reloads",
        );
        assert.deepEqual(
          [...pending!.authorized_role_codes].sort(),
          [...codes].sort(),
          "FU3-G authorized role codes must be preserved",
        );
        assert.ok(pending!.clarification_plan, "FU3-G must keep a clarification plan for remaining items");
        assert.notEqual(pending!.clarification_plan_id, plan0, "FU3-G next item must get its own clarification plan");
        const askedAfter = s.decision_understanding?.budget.session_asked_count ?? 0;
        assert.ok(askedAfter >= askedBefore, "FU3-G must not lose budget accounting");
        assert.ok(factForRole(s.decision_context!, codes[i]!, texts[i]!));
      }
      assert.equal(asked0 > 0, true);
    });

    await check("M2.4-R2-FU3-H: missing clarification plan fails closed and keeps pending", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3h");
      const broken: POJUSessionState = {
        ...ctx.out,
        pending_answer_resolution: {
          ...ctx.out.pending_answer_resolution!,
          clarification_plan: null,
          clarification_plan_id: null,
          authorized_role_codes: [],
          authorized_dir_ids: [],
          unresolved_items: ctx.out.pending_answer_resolution!.unresolved_items.map((item) => ({
            ...item,
            authorized_role_codes: [],
          })),
        },
        decision_understanding: ctx.out.decision_understanding
          ? {
              ...ctx.out.decision_understanding,
              last_sent_question: null,
              next_question_plan: null,
            }
          : ctx.out.decision_understanding,
        adaptive_ask_plan: null,
      };
      const vBefore = broken.decision_context!.version;
      const factsBefore = broken.decision_context!.reality_facts.length;
      stubResponse = "FU3H FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: broken,
        userMessage: "继续下一个问题",
        locale: "zh-CN",
      });
      assert.ok(out.pending_answer_resolution, "FU3-H must keep pending");
      assert.equal(out.decision_context!.version, vBefore, "FU3-H must not write DC");
      assert.equal(out.decision_context!.reality_facts.length, factsBefore);
      const asst = lastAssistant(out);
      const meta = (asst as { meta?: { m1_planner_blocked?: boolean; m1_outcome?: string; m1_ask_error?: string; m1_fail_closed?: boolean } }).meta;
      assert.ok(
        meta?.m1_planner_blocked === true || meta?.m1_outcome === "planner_blocked" || asst.content.includes("未能生成合规的授权提问"),
        `FU3-H must return an explicit fail-closed status, got=${asst.content.slice(0, 200)} meta=${JSON.stringify(meta)}`,
      );
      assert.notEqual(asst.content, stubResponse);
      assert.equal(
        Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        "FU3-H must not call ordinary planFromState for an unrelated NeedItem",
      );
    });

'''
text = text.replace(anchor, tests + "    " + anchor.lstrip())
# The above might mess indentation of modelSrc. Check.
p.write_text(text, encoding="utf-8", newline="\n")
print("tests inserted, lines", text.count("\n")+1)
# verify modelSrc still present once
print("modelSrc count", text.count("lib/poju/decision-intake/answer-interpretation-model.ts"))
