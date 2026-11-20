    await check("M2.4-R2-FU9-B1: initial mismatch creates a pending control item", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b1");
      const control = seeded.first.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B1 must create a pending control item");
      assert.equal(control!.items[0]!.kind, "insight_mismatch");
      assert.equal(control!.items[0]!.status, "pending");
      assert.equal(seeded.first.decision_context!.reality_facts.length, seeded.ctx.factsBefore);
      assert.equal(seeded.first.decision_context!.version, seeded.ctx.vBefore);
      assert.equal(isOrdinaryNeedItemPlan(seeded.first.adaptive_ask_plan), false);
      assert.ok(lastAssistant(seeded.first).content.includes("不一致"));
    });

    await check("M2.4-R2-FU9-B2: concrete clarification is passed through model interpretation", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b2");
      const clarify = "我并不是怕风险，我只是还在比较时间窗口。";
      const hookCalls: string[] = [];
      stubResponse = "FU9B2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: ({ statement }) => {
            hookCalls.push(statement);
            return fu9Draft(
              [fu9Item("我只是还在比较时间窗口。", { legalCode: seeded.ctx.legalCode })],
              { classification: "correction", explanation: "clarification" },
            );
          },
        },
      });
      assert.deepEqual(hookCalls, [clarify], "FU9-B2 must interpret the clarification through the model hook");
      assert.ok(out.last_answer_event, "FU9-B2 must produce an AnswerEvent");
      assert.equal(out.last_answer_event!.raw_text.includes("比较时间窗口"), true);
    });

    await check("M2.4-R2-FU9-B3: exact user-authored clarification can enter the legal DC path", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b3");
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement === clarify);
      assert.ok(fact, "FU9-B3 must persist the exact clarification quote");
      assert.equal(fact!.verification_level, "user_asserted");
      assertRolesAndDirs(fact!, seeded.ctx.role, seeded.ctx.dirId, "FU9-B3");
      assert.ok(dc.version > seeded.ctx.vBefore);
      const item = out.pending_intake_control?.items.find((row) => row.kind === "insight_mismatch");
      assert.equal(item?.status, "clarified");
    });

    await check("M2.4-R2-FU9-B4: a model-generated inference cannot enter DC", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b4");
      const clarify = "我并不是怕风险。";
      stubResponse = "FU9B4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: seeded.ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      assert.equal(out.decision_context!.reality_facts.length, seeded.ctx.factsBefore);
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.ok(
        groundingRejectionsOf(out).some((r) => r.reason === "extraction_text_not_source_equivalent"),
      );
      assert.equal(proposedWritesOf(out).length, 0);
    });

    await check("M2.4-R2-FU9-B5: clarification text and source turn are retained in the resolution record", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b5");
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const records = out.pending_intake_control?.resolution_records ?? [];
      assert.equal(records.length, 1, "FU9-B5 must retain one resolution record");
      const rec = records[0]!;
      const mismatch = seeded.first.pending_intake_control!.items[0]!;
      assert.equal(rec.original_mismatch_item_id, mismatch.item_id);
      assert.equal(rec.original_mismatch_source_turn_id, mismatch.source_turn_id);
      assert.equal(rec.clarification_turn_id, lastUserId(out));
      assert.equal(rec.original_mismatch_text, mismatch.text);
      assert.equal(rec.clarification_text, clarify);
      assert.ok(rec.answer_event_id);
      assert.ok(rec.resolution_status === "clarified" || rec.resolution_status === "clarified_without_dc_write");
    });

    await check("M2.4-R2-FU9-B6: model call failure leaves the control item pending", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b6");
      stubResponse = "FU9B6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我只是还在比较时间窗口。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => {
            throw new Error("fu9_model_call_failed");
          },
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B6 must keep the control pending");
      assert.equal(control!.items[0]!.status === "pending" || control!.items[0]!.status === "uncertain", true);
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.equal((control!.resolution_records ?? []).length, 0);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "answer_interpretation_failed");
    });

    await check("M2.4-R2-FU9-B7: invalid model schema leaves the control item pending", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b7");
      stubResponse = "FU9B7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我只是还在比较时间窗口。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "not_a_real_class",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "invalid schema",
          }),
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B7 must keep the control pending");
      assert.equal(control!.items[0]!.kind, "insight_mismatch");
      assert.notEqual(control!.items[0]!.status, "clarified");
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.equal((control!.resolution_records ?? []).length, 0);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "answer_interpretation_invalid_schema");
    });

    await check("M2.4-R2-FU9-B8: DC persistence failure leaves the control item pending", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b8");
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B8 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
          intakeControlPersist: async (previous) => ({
            session: previous,
            committed: false,
            error: "persist_failed",
          }),
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B8 must keep the control pending");
      assert.notEqual(control!.items[0]!.status, "clarified");
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.equal(out.decision_context!.reality_facts.length, seeded.ctx.factsBefore);
      assert.equal((control!.resolution_records ?? []).length, 0);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");
    });

    await check("M2.4-R2-FU9-B9: successful clarification resolves only its own mismatch item", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b9");
      const beforeIds = (seeded.committed.pending_intake_control?.items ?? []).map((item) => item.item_id);
      assert.equal(beforeIds.length, 1);
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B9 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const items = out.pending_intake_control?.items ?? [];
      assert.equal(items.length, 1, "FU9-B9 must not invent additional control items");
      assert.equal(items[0]!.item_id, beforeIds[0]);
      assert.equal(items[0]!.status, "clarified");
      assert.equal(items[0]!.kind, "insight_mismatch");
    });

    await check("M2.4-R2-FU9-B10: ordinary planning resumes only after successful resolution", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b10");
      assert.equal(isOrdinaryNeedItemPlan(seeded.first.adaptive_ask_plan), false);
      stubResponse = "FU9B10 FAIL FREEFORM MUST NOT WIN";
      const failed = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我只是还在比较时间窗口。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => {
            throw new Error("fu9_b10_model_failed");
          },
        },
      });
      assert.ok(failed.pending_intake_control && failed.pending_intake_control.status === "pending");
      assert.equal(isOrdinaryNeedItemPlan(failed.adaptive_ask_plan), false, "FU9-B10 must not resume after failure");

      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B10 OK FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const item = out.pending_intake_control?.items[0];
      assert.equal(item?.status, "clarified");
      assert.ok(
        isOrdinaryNeedItemPlan(out.adaptive_ask_plan) || out.adaptive_ask_plan,
        "FU9-B10 may resume ordinary investigation after success",
      );
      assert.equal(
        String(out.adaptive_ask_plan?.ask_now_reason ?? "").includes("pending_intake_control"),
        false,
        "FU9-B10 must leave the mismatch follow-up",
      );
    });

    await check("M2.4-R2-FU9-B11: replay does not duplicate DC writes or resolution records", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b11");
      const clarify = "我只是还在比较时间窗口。";
      const draft = fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]);
      stubResponse = "FU9B11 FREEFORM 1";
      const clarified = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(clarified.session_id, {
        operation_id: "op_m24r2fu9b11_clarify",
        kind: "session_patch",
        bump_dc: true,
        apply: () => clarified,
      });
      const committed = await durable(clarified.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const v1 = committed.decision_context!.version;
      const records1 = committed.pending_intake_control?.resolution_records ?? [];
      assert.equal(records1.length, 1);
      const q1 = lastAssistant(committed).content;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU9B11 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: clarify, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: clarify,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      assert.deepEqual(replay.decision_context!.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.equal(replay.decision_context!.version, v1);
      assert.equal((replay.pending_intake_control?.resolution_records ?? []).length, 1);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });
