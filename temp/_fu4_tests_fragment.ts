    // M2.4-R2-FU4: clarification semantic safety + terminal pending lifecycle.
    // FU3-E was updated honestly: after the last item is refused, a new legal
    // NeedItem may be sent. The refusal remains auditable, writes nothing to DC,
    // survives reload, and must not resend the old clarification plan.

    async function seedDefinitionPatchPending(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, `${tag} needs an authorized role code`);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "把决策问题改成是否立刻辞职。",
            semantic_kind: "definition_patch",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "definition patch cannot persist",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "把决策问题改成是否立刻辞职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return { before, out, legalCode, vBefore, factsBefore, cstBefore, askedBefore, draft };
    }

    async function seedUnclearCertaintyPending(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, `${tag} needs an authorized role code`);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
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
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "目前大概还在职吧。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return { before, out, legalCode, vBefore, factsBefore, cstBefore };
    }

    async function seedEstimatedConstraintPending(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, `${tag} needs an authorized role code`);
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
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "预算大概不能超过五万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return { before, out, legalCode, vBefore, factsBefore, cstBefore };
    }

    function factWritten(
      dc: NonNullable<POJUSessionState["decision_context"]>,
      text: string,
    ) {
      return dc.reality_facts.find((f) => f.statement.includes(text));
    }

    await check("M2.4-R2-FU4-A: definition_patch creates pending and does not write DC", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4a");
      const dc = ctx.out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU4-A must not write RealityFacts");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU4-A must not write Constraints");
      assert.equal(dc.version, ctx.vBefore, "FU4-A must not bump DC version");
      const pending = ctx.out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU4-A must create pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "definition_patch_not_persistable");
      const asst = lastAssistant(ctx.out);
      assert.ok(
        asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
        `FU4-A must ask a definition-patch clarification, got=${asst.content.slice(0, 200)}`,
      );
      assert.equal(
        Boolean(ctx.out.adaptive_ask_plan && !String(ctx.out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        "FU4-A must not enter ordinary NeedItem planning",
      );
    });

    await check("M2.4-R2-FU4-B: user records definition_patch as an authorized fact", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4b");
      const pendingSession = ctx.out;
      stubResponse = "FU4B FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "改为作为明确事实记录",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const written = factWritten(dc, "把决策问题改成是否立刻辞职");
      assert.ok(written, "FU4-B must write the converted RealityFact");
      assert.equal(written!.status, "unverified");
      const role = ctx.legalCode.split("/role/")[1]!;
      const dir = roleCodeDir(ctx.legalCode);
      assert.ok((written!.fact_roles ?? []).includes(role), "FU4-B must keep the authorized role");
      assert.ok((written!.related_dir_ids ?? []).includes(dir), "FU4-B must keep the authorized DIR");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU4-B must not write a Constraint");
      assert.ok(dc.version > ctx.vBefore);
      assert.equal(out.pending_answer_resolution ?? null, null, "FU4-B must clear pending after persist");
    });

    await check("M2.4-R2-FU4-C: refusal records a rejected item and does not resend the old plan", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4c");
      const oldClarify = lastAssistant(ctx.out).content;
      stubResponse = "FU4C FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU4-C must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU4-C must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU4-C must keep an auditable rejection record");
      assert.equal(pending!.status, "rejected");
      assert.equal(pending!.unresolved_items.length, 0);
      assert.equal(pending!.clarification_plan, null, "FU4-C must not keep a resendable clarification_plan");
      assert.ok(
        (pending!.rejected_items ?? []).some((item) => item.text.includes("把决策问题改成是否立刻辞职")),
        "FU4-C must record the rejected item",
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, oldClarify, "FU4-C must not resend the old clarification plan");
      assert.equal(asst.content.includes("待澄清信息"), false, "FU4-C must not re-ask the refused item");
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content.includes("【理解确认】"), false, "FU4-C refusal must not trigger readiness confirm");
      const nextPlan = out.adaptive_ask_plan;
      if (nextPlan) {
        assert.equal(String(nextPlan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
        assert.equal(asst.content, nextPlan.question_text);
      }
    });

    await check("M2.4-R2-FU4-D: uncertain definition_patch stays pending and does not jump", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4d");
      const oldClarify = lastAssistant(ctx.out).content;
      stubResponse = "FU4D FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: "不确定",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.version, ctx.vBefore, "FU4-D must not change DC");
      assert.equal(dc.reality_facts.length, ctx.factsBefore);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU4-D must keep pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "definition_patch_not_persistable");
      const asst = lastAssistant(out);
      assert.equal(asst.content, oldClarify, "FU4-D must keep the current clarification");
      assert.equal(
        Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        "FU4-D must not enter ordinary NeedItem planning",
      );
    });

    await check("M2.4-R2-FU4-E: persist failure keeps definition_patch pending and retry is not duplicated", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4e");
      stubResponse = "FU4E FREEFORM MUST NOT WIN";
      const failed = await handleUserMessage({
        session: ctx.out,
        userMessage: "改为作为明确事实记录",
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
      assert.equal(failedDc.version, ctx.vBefore, "FU4-E failed persist must not commit DC");
      assert.equal(failedDc.reality_facts.length, ctx.factsBefore, "FU4-E must not leave a half-committed fact");
      assert.ok(failed.pending_answer_resolution, "FU4-E pending must not be lost on persist failure");
      const failAsst = [...failed.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");

      await savePOJUSession(failed);
      const reloaded = await durable(failed.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU4-E pending must survive the failed persist");
      assert.equal(reloaded.decision_context!.version, ctx.vBefore);

      const retried = await handleUserMessage({
        session: reloaded,
        userMessage: "改为作为明确事实记录",
        locale: "zh-CN",
      });
      const written = retried.decision_context!.reality_facts.filter((f) =>
        f.statement.includes("把决策问题改成是否立刻辞职"),
      );
      assert.equal(written.length, 1, "FU4-E retry must write the fact once, not twice");
      assert.ok(retried.decision_context!.version > ctx.vBefore);
      assert.equal(retried.pending_answer_resolution ?? null, null);
    });

    await check("M2.4-R2-FU4-N1: certainty parser is negation-first on the production path", async () => {
      const cases: Array<{ tag: string; phrase: string; expect: "write_explicit" | "write_estimated" | "pending_unclear" }> = [
        { tag: "fu4n1a", phrase: "明确事实", expect: "write_explicit" },
        { tag: "fu4n1b", phrase: "这是明确事实", expect: "write_explicit" },
        { tag: "fu4n1c", phrase: "个人估计", expect: "write_estimated" },
        { tag: "fu4n1d", phrase: "仍然只是估计", expect: "write_estimated" },
        { tag: "fu4n1e", phrase: "不确定", expect: "pending_unclear" },
        { tag: "fu4n1f", phrase: "不明确", expect: "pending_unclear" },
        { tag: "fu4n1g", phrase: "我不认为这是明确事实", expect: "pending_unclear" },
        { tag: "fu4n1h", phrase: "不是明确事实", expect: "pending_unclear" },
      ];
      for (const item of cases) {
        const ctx = await seedUnclearCertaintyPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const written = factWritten(dc, "目前大概还在职吧");
        if (item.expect === "write_explicit") {
          assert.ok(written, `${item.phrase} must write an explicit fact`);
          assert.equal(written!.verification_level, "user_asserted", `${item.phrase} must be user_asserted`);
          assert.equal(out.pending_answer_resolution ?? null, null);
        } else if (item.expect === "write_estimated") {
          assert.ok(written, `${item.phrase} must write an estimated fact`);
          assert.equal(written!.verification_level, "user_estimate", `${item.phrase} must be user_estimate`);
        } else {
          assert.equal(written, undefined, `${item.phrase} must not be classified as explicit or write DC`);
          assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC`);
          assert.ok(out.pending_answer_resolution, `${item.phrase} must keep pending`);
          assert.equal(out.pending_answer_resolution!.status, "pending");
        }
      }
    });

    await check("M2.4-R2-FU4-N2: constraint confirmation is negation-first on the production path", async () => {
      const cases: Array<{ tag: string; phrase: string; expect: "confirmed" | "not_confirmed" | "still_uncertain" }> = [
        { tag: "fu4n2a", phrase: "确认这是明确约束", expect: "confirmed" },
        { tag: "fu4n2b", phrase: "1", expect: "confirmed" },
        { tag: "fu4n2c", phrase: "仍然只是估计", expect: "not_confirmed" },
        { tag: "fu4n2d", phrase: "目前无法确定", expect: "still_uncertain" },
        { tag: "fu4n2e", phrase: "我不确认这是明确约束", expect: "not_confirmed" },
        { tag: "fu4n2f", phrase: "不是明确约束", expect: "not_confirmed" },
        { tag: "fu4n2g", phrase: "不可以写入", expect: "not_confirmed" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        if (item.expect === "confirmed") {
          assert.ok(cst, `${item.phrase} must write the Constraint`);
          assert.equal(cst!.verification_level, "user_asserted");
          assert.equal(out.pending_answer_resolution ?? null, null);
        } else {
          assert.equal(cst, undefined, `${item.phrase} must not confirm or write the Constraint`);
          assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC`);
          assert.equal(dc.reality_facts.length, ctx.factsBefore);
          assert.ok(out.pending_answer_resolution, `${item.phrase} must keep pending`);
          assert.equal(out.pending_answer_resolution!.status, "pending");
        }
      }
    });

    await check("M2.4-R2-FU4-N3: role choice does not bind a role named only in a negated clause", async () => {
      const { authorizedRoleOptions } = await import("../lib/poju/decision-intake/pending-answer-resolution");
      const ctx = await runFu2NullRolePending("m24r2fu4n3seed");
      const options = authorizedRoleOptions(ctx.out, [ctx.codeA, ctx.codeB]);
      const work = options.find((o) => o.aliases.includes("工作角色"));
      const other = options.find((o) => o.role_code !== work?.role_code) ?? options.find((o) => o.role_code === ctx.codeB);
      assert.ok(work, "FU4-N3 needs a unique work-role option among the authorized codes");
      assert.ok(other && other.role_code !== work!.role_code, "FU4-N3 needs a second authorized role");

      async function roleReply(tag: string, phrase: string) {
        const seeded = await runFu2NullRolePending(tag);
        stubResponse = `${tag} FREEFORM MUST NOT WIN`;
        return handleUserMessage({
          session: seeded.out,
          userMessage: phrase,
          locale: "zh-CN",
        });
      }

      const bindWork = await roleReply("m24r2fu4n3a", "工作角色");
      const workFact = factForRole(bindWork.decision_context!, work!.role_code, "我目前仍在职");
      assert.ok(workFact, "工作角色 must bind the unique work role");
      assert.equal(factForRole(bindWork.decision_context!, other!.role_code, "我目前仍在职"), undefined);

      const notWork = await roleReply("m24r2fu4n3b", "不是工作角色");
      assert.equal(notWork.decision_context!.version, ctx.vBefore, "不是工作角色 must not write DC");
      assert.ok(notWork.pending_answer_resolution && notWork.pending_answer_resolution.status === "pending");
      assert.equal(factWritten(notWork.decision_context!, "我目前仍在职"), undefined);

      const contrast = await roleReply("m24r2fu4n3c", `不是${work!.role}，是${other!.role}`);
      assert.ok(factForRole(contrast.decision_context!, other!.role_code, "我目前仍在职"), "不是A，是B must bind only B");
      assert.equal(factForRole(contrast.decision_context!, work!.role_code, "我目前仍在职"), undefined);

      const unsure = await roleReply("m24r2fu4n3d", `我不确定是不是${work!.role}`);
      assert.equal(unsure.decision_context!.version, ctx.vBefore, "我不确定是不是A must not write DC");
      assert.ok(unsure.pending_answer_resolution && unsure.pending_answer_resolution.status === "pending");

      const both = await roleReply("m24r2fu4n3e", `${work!.role}和${other!.role}`);
      assert.equal(both.decision_context!.version, ctx.vBefore, "mentioning two authorized roles must stay unclear");
      assert.ok(both.pending_answer_resolution && both.pending_answer_resolution.status === "pending");
    });

    await check("M2.4-R2-FU4-T: last-item refusal completes terminal processing and can resume investigation", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu4t");
      const pendingSession = ctx.out;
      const oldClarify = lastAssistant(pendingSession).content;
      const originalTurnId = lastUserId(pendingSession);
      const askedAfterClarify = pendingSession.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU4T FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU4-T refusal must not write a fact");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU4-T must keep the auditable rejection record");
      assert.equal(pending!.status, "rejected");
      assert.equal(pending!.clarification_plan, null);
      assert.equal(pending!.unresolved_items.length, 0);
      assert.ok((pending!.rejected_items ?? []).length >= 1);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, oldClarify, "FU4-T must not resend the old clarification");
      assert.equal(asst.content.includes("待澄清信息"), false);
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content.includes("【理解确认】"), false, "FU4-T must not trigger readiness confirm");
      const nextPlan = out.adaptive_ask_plan;
      assert.ok(nextPlan, "FU4-T may resume ordinary investigation after terminal refusal");
      assert.equal(String(nextPlan!.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
      assert.equal(asst.content, nextPlan!.question_text);
      const lastSent = out.decision_understanding?.last_sent_question;
      assert.ok(lastSent && lastSent.plan_id === nextPlan!.plan_id);
      const askedAfterTerminal = out.decision_understanding?.budget.session_asked_count ?? 0;
      assert.ok(
        askedAfterTerminal === askedAfterClarify || askedAfterTerminal === askedAfterClarify + 1,
        "FU4-T may deduct budget once for the newly sent NeedItem",
      );

      await savePOJUSession(out);
      const reloaded = await durable(out.session_id);
      assert.equal(reloaded.pending_answer_resolution!.status, "rejected");
      assert.equal(reloaded.pending_answer_resolution!.clarification_plan, null);

      const replaySession = {
        ...reloaded,
        messages: [
          ...reloaded.messages,
          {
            role: "user" as const,
            content: "我目前仍在职。",
            timestamp: NOW,
            client_id: originalTurnId,
          },
        ],
      };
      stubResponse = "FU4T REPLAY FREEFORM MUST NOT WIN";
      const replay = await handleUserMessage({
        session: replaySession,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      assert.equal(replay.decision_context!.version, ctx.vBefore, "FU4-T original-turn replay must not write DC");
      assert.equal(replay.decision_context!.reality_facts.length, ctx.factsBefore);
      const askedReplay = replay.decision_understanding?.budget.session_asked_count ?? 0;
      assert.equal(askedReplay, askedAfterTerminal, "FU4-T original pending replay must not recount budget");
      const replayAsst = lastAssistant(replay);
      assert.notEqual(replayAsst.content, oldClarify, "FU4-T replay must not restore the refused clarification");
      assert.equal(replayAsst.content.includes("待澄清信息"), false);
      if (replay.adaptive_ask_plan) {
        assert.equal(String(replay.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
      }
    });

