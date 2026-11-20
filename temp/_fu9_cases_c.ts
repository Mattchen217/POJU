    async function seedFu9GoalChange(
      tag: string,
      opts?: {
        statement?: string;
        extracted_items?: import("../lib/poju/decision-intake/types").ModelAnswerDraft["extracted_items"];
      },
    ) {
      const ctx = await seedFu8Ready(tag);
      const statement = opts?.statement ?? "我想换个方向，改成要不要立刻出国读书。";
      const extracted_items =
        opts?.extracted_items ??
        [
          fu9Item("要不要立刻出国读书", {
            legalCode: ctx.legalCode,
            kind: "definition_patch",
          }),
        ];
      stubResponse = `${tag} FREEFORM 1 MUST NOT WIN`;
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft(extracted_items, {
              classification: "goal_change",
              explanation: "proposed target change",
            }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: `op_${tag}_goal`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      return { ctx, first, committed: await durable(first.session_id), statement };
    }

    await check("M2.4-R2-FU9-C1: proposed target is extracted separately from introductory wording", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c1");
      const control = seeded.first.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items[0]!.kind, "goal_change");
      assert.equal(control!.items[0]!.proposed_decision_target, "要不要立刻出国读书");
      assert.notEqual(control!.items[0]!.proposed_decision_target, seeded.statement);
      assert.equal(isOrdinaryNeedItemPlan(seeded.first.adaptive_ask_plan), false);
      assert.ok(lastAssistant(seeded.first).content.includes("要不要立刻出国读书"));
      assert.ok(lastAssistant(seeded.first).content.includes("确认更换决策目标"));
      assert.equal(lastAssistant(seeded.first).content.includes("请直接重述"), false);
    });

    await check("M2.4-R2-FU9-C2: the exact target phrase is retained", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c2");
      assert.equal(
        seeded.first.pending_intake_control!.items[0]!.proposed_decision_target,
        "要不要立刻出国读书",
      );
      assert.ok(lastAssistant(seeded.first).content.includes("「要不要立刻出国读书」"));
    });

    await check("M2.4-R2-FU9-C3: a paraphrased or ungrounded target is not accepted", async () => {
      const ctx = await seedFu8Ready("m24r2fu9c3");
      const statement = "我想换个方向，改成要不要立刻出国读书。";
      stubResponse = "FU9C3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft(
              [
                fu9Item("是否立即赴海外留学", {
                  legalCode: ctx.legalCode,
                  kind: "definition_patch",
                  source_quote: "要不要立刻出国读书",
                }),
              ],
              { classification: "goal_change", explanation: "paraphrased target" },
            ),
        },
      });
      const item = out.pending_intake_control?.items[0];
      assert.ok(item && item.kind === "goal_change");
      assert.equal(item!.proposed_decision_target, undefined, "FU9-C3 must not accept a paraphrased target");
      assert.ok(groundingRejectionsOf(out).some((r) => r.reason === "extraction_text_not_source_equivalent"));
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.ok(lastAssistant(out).content.includes("请直接重述"));
      assert.equal(lastAssistant(out).content.includes("确认更换决策目标"), false);
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
      assert.equal(definitionQuestion(out), ctx.dqBefore);
    });

    await check("M2.4-R2-FU9-C4: missing target phrase asks the user to restate, not to confirm", async () => {
      const ctx = await seedFu8Ready("m24r2fu9c4");
      stubResponse = "FU9C4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想换一个决策目标。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([], { classification: "goal_change", explanation: "no target phrase" }),
        },
      });
      const item = out.pending_intake_control?.items[0];
      assert.ok(item && item.kind === "goal_change" && item.status === "pending");
      assert.equal(item!.proposed_decision_target, undefined);
      const q = lastAssistant(out).content;
      assert.ok(q.includes("请直接重述"));
      assert.equal(q.includes("确认更换决策目标"), false);
      assert.equal(q.includes("1. 确认更换决策目标"), false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.ok(String(out.adaptive_ask_plan?.ask_now_reason ?? "").includes("goal_change_restate"));
    });

    await check("M2.4-R2-FU9-C5: explicit confirmation still does not mutate Blueprint or DC definition", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c5");
      stubResponse = "FU9C5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "1",
        locale: "zh-CN",
      });
      assert.deepEqual(blueprintSnapshot(out), seeded.ctx.bpBefore);
      assert.equal(definitionQuestion(out), seeded.ctx.dqBefore);
      assert.equal(out.pending_intake_control?.entered_controlled_blueprint_update, true);
      assert.equal(out.pending_intake_control?.items[0]!.status, "confirmed");
      assert.equal(out.pending_intake_control?.items[0]!.proposed_decision_target, "要不要立刻出国读书");
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.ok(lastAssistant(out).content.includes("受控的 Blueprint 更新路径"));
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
    });

    await check("M2.4-R2-FU9-C6: explicit refusal retains the original target", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c6");
      const oldClarify = lastAssistant(seeded.first).content;
      stubResponse = "FU9C6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "2",
        locale: "zh-CN",
      });
      assert.deepEqual(blueprintSnapshot(out), seeded.ctx.bpBefore);
      assert.equal(definitionQuestion(out), seeded.ctx.dqBefore);
      assert.equal(out.pending_intake_control?.items[0]!.status, "declined");
      assert.equal(out.pending_intake_control?.entered_controlled_blueprint_update ?? false, false);
      assert.notEqual(lastAssistant(out).content, oldClarify);
      assert.ok(isOrdinaryNeedItemPlan(out.adaptive_ask_plan) || out.adaptive_ask_plan);
    });

    await check("M2.4-R2-FU9-C7: uncertainty keeps the control item pending", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c7");
      const oldClarify = lastAssistant(seeded.first).content;
      const asked1 = seeded.first.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU9C7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我不确定",
        locale: "zh-CN",
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.ok(control!.items[0]!.status === "pending" || control!.items[0]!.status === "uncertain");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.equal(lastAssistant(out).content, oldClarify);
      assert.equal(out.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.deepEqual(blueprintSnapshot(out), seeded.ctx.bpBefore);
    });

    await check("M2.4-R2-FU9-C8: replay does not repeat the target-change operation", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c8");
      const confirmed = await handleUserMessage({
        session: seeded.committed,
        userMessage: "1",
        locale: "zh-CN",
      });
      await mutatePOJUSession(confirmed.session_id, {
        operation_id: "op_m24r2fu9c8_confirm",
        kind: "session_patch",
        bump_dc: true,
        apply: () => confirmed,
      });
      const committed = await durable(confirmed.session_id);
      const turnId = lastUserId(committed);
      const q1 = lastAssistant(committed).content;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU9C8 FREEFORM MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: "1", timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: "1",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      assert.equal(replay.pending_intake_control?.entered_controlled_blueprint_update, true);
      assert.deepEqual(blueprintSnapshot(replay), seeded.ctx.bpBefore);
      assert.equal(definitionQuestion(replay), seeded.ctx.dqBefore);
      assert.equal(replay.decision_context!.version, seeded.ctx.vBefore);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });
