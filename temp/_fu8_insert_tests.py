from pathlib import Path
tests = r'''
    // M2.4-R2-FU8: source-grounded model extractions, unresolved-aspect
    // scheduling, and explicit goal_change / insight_mismatch control flow.
    function blueprintSnapshot(session: POJUSessionState) {
      const bp = session.decision_blueprint;
      return {
        blueprint_id: bp?.blueprint_id ?? null,
        blueprint_version: bp?.blueprint_version ?? null,
        decision_question: bp?.decision_question ?? null,
        dir_ids: [...(bp?.dir_ids ?? [])].sort(),
        ddr_ids: [...(bp?.ddr_ids ?? [])].sort(),
        scope_locked: bp?.scope_locked ?? null,
      };
    }
    function definitionQuestion(session: POJUSessionState) {
      return session.decision_context?.definition?.decision_question ?? null;
    }
    function isOrdinaryNeedItemPlan(plan: import("../lib/poju/decision-intake/types").AdaptiveQuestionPlan | null | undefined) {
      if (!plan) return false;
      const reason = String(plan.ask_now_reason ?? "");
      return !reason.includes("pending_answer_resolution") && !reason.includes("pending_intake_control");
    }
    async function seedFu8Ready(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, `${tag} needs a legal authorized role code`);
      return {
        before,
        legalCode,
        role: legalCode.split("/role/")[1]!,
        dirId: roleCodeDir(legalCode),
        vBefore: before.decision_context!.version,
        factsBefore: before.decision_context!.reality_facts.length,
        cstBefore: before.decision_context!.constraints.length,
        bpBefore: blueprintSnapshot(before),
        dqBefore: definitionQuestion(before),
      };
    }
    function assertRolesAndDirs(
      written: { fact_roles?: string[]; related_dir_ids?: string[] },
      role: string,
      dirId: string,
      label: string,
    ) {
      assert.ok((written.fact_roles ?? []).includes(role), `${label} must keep the authorized role`);
      assert.ok((written.related_dir_ids ?? []).includes(dirId), `${label} must keep the authorized DIR`);
    }

    await check("M2.4-R2-FU8-A1: exact source quote writes a legal RealityFact", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a1");
      const statement = "我目前月薪三万。";
      stubResponse = "FU8A1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: statement,
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: statement,
              },
            ],
            unresolved_aspects: [],
            explanation: "grounded fact",
          }),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement.includes("月薪三万"));
      assert.ok(fact, "FU8-A1 must write the grounded RealityFact");
      assert.equal(fact!.status, "unverified");
      assert.equal(fact!.verification_level, "user_asserted");
      assert.notEqual(fact!.status, "confirmed");
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU8-A1");
      assert.ok(dc.version > ctx.vBefore, "FU8-A1 must bump DC version");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A1 must not write a Constraint");
    });

    await check("M2.4-R2-FU8-A2: exact source quote writes a legal Constraint path", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a2");
      const statement = "硬约束是必须保留社保。";
      stubResponse = "FU8A2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: statement,
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: statement,
              },
            ],
            unresolved_aspects: [],
            explanation: "grounded constraint",
          }),
        },
      });
      const dc = out.decision_context!;
      const cst = dc.constraints.find((c) => c.statement.includes("必须保留社保"));
      const companion = dc.reality_facts.find((f) => f.statement.includes("必须保留社保"));
      assert.ok(cst, "FU8-A2 must write the Constraint");
      assert.ok(companion, "FU8-A2 must also write the companion RealityFact");
      assert.equal(cst!.status, "unverified");
      assert.equal(cst!.verification_level, "user_asserted");
      assertRolesAndDirs(cst!, ctx.role, ctx.dirId, "FU8-A2 constraint");
      assertRolesAndDirs(companion!, ctx.role, ctx.dirId, "FU8-A2 companion");
      assert.ok(dc.version > ctx.vBefore);
      assert.ok(dc.constraints.length > ctx.cstBefore);
    });

    await check("M2.4-R2-FU8-A3: model fact absent from the user statement does not write DC", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a3");
      const statement = "我目前月薪三万。";
      stubResponse = "FU8A3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "家里有一套房子。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "家里有一套房子。",
              },
            ],
            unresolved_aspects: [],
            explanation: "invented fact",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-A3 must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A3 must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore, "FU8-A3 must not bump DC version");
    });

    await check("M2.4-R2-FU8-A4: partial overlapping quote that changes meaning does not write DC", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a4");
      const statement = "我目前月薪三万，但不想现在离职。";
      stubResponse = "FU8A4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "月薪三万，想现在离职",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "月薪三万，想现在离职",
              },
            ],
            unresolved_aspects: [],
            explanation: "spliced meaning-changing quote",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-A4 must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A4 must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore, "FU8-A4 must not bump DC version");
    });

    await check("M2.4-R2-FU8-A5: only the grounded item may write when mixed with an ungrounded item", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a5");
      const statement = "我目前月薪三万。家里有一个孩子。";
      stubResponse = "FU8A5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "我目前月薪三万。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我目前月薪三万。",
              },
              {
                text: "我已经买了房子。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我已经买了房子。",
              },
            ],
            unresolved_aspects: [],
            explanation: "mixed grounding",
          }),
        },
      });
      const dc = out.decision_context!;
      const grounded = dc.reality_facts.filter((f) => f.statement.includes("月薪三万"));
      const invented = dc.reality_facts.filter((f) => f.statement.includes("买了房子"));
      assert.equal(grounded.length, 1, "FU8-A5 must write the grounded item");
      assert.equal(invented.length, 0, "FU8-A5 must not write the ungrounded item");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(grounded[0]!.verification_level, "user_asserted");
      assertRolesAndDirs(grounded[0]!, ctx.role, ctx.dirId, "FU8-A5");
      assert.ok(dc.version > ctx.vBefore);
      assert.equal(dc.constraints.length, ctx.cstBefore);
    });

    await check("M2.4-R2-FU8-A6: missing source_quote rejects the draft and never writes", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a6");
      stubResponse = "FU8A6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "我目前月薪三万。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "missing source_quote",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-A6 must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A6 must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore, "FU8-A6 must not bump DC version");
    });

    await check("M2.4-R2-FU8-A7: replay of a grounded write does not duplicate", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a7");
      const statement = "我目前月薪三万。";
      const draft = {
        classification: "clear_answer" as const,
        extracted_items: [
          {
            text: statement,
            semantic_kind: "reality_fact" as const,
            role_hint: null,
            role_code_hint: ctx.legalCode,
            certainty: "explicit" as const,
            source_quote: statement,
          },
        ],
        unresolved_aspects: [] as string[],
        explanation: "grounded replay",
      };
      stubResponse = "FU8A7 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8a7_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const cst1 = committed.decision_context!.constraints.map((c) => c.constraint_id).sort();
      const v1 = committed.decision_context!.version;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU8A7 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: statement, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: statement,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = replay.decision_context!;
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.deepEqual(dc.constraints.map((c) => c.constraint_id).sort(), cst1);
      assert.equal(dc.version, v1, "FU8-A7 replay must not bump DC version");
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
    });

    await check("M2.4-R2-FU8-B1: empty extracted_items plus unresolved_aspects are scheduled, not written", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b1");
      stubResponse = "FU8B1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "这件事我只能说一部分。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [],
            unresolved_aspects: ["具体薪资还没说清"],
            explanation: "aspect only",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-B1 must not write facts");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-B1 must not write constraints");
      assert.equal(dc.version, ctx.vBefore, "FU8-B1 must not bump DC version");
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU8-B1 must schedule the aspect");
      assert.equal(control!.items.length, 1);
      assert.equal(control!.items[0]!.kind, "unresolved_aspect");
      assert.equal(control!.items[0]!.text.includes("具体薪资"), true);
      const asst = lastAssistant(out);
      assert.ok(asst.content.includes("具体薪资"), "FU8-B1 must ask about the unresolved aspect");
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-B1 must not jump to an ordinary NeedItem");
      assert.notEqual(asst.content, stubResponse);
    });

    await check("M2.4-R2-FU8-B2: grounded fact plus unresolved aspect writes only the fact and schedules the aspect", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b2");
      const statement = "我目前月薪三万。";
      stubResponse = "FU8B2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [
              {
                text: statement,
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: statement,
              },
            ],
            unresolved_aspects: ["家庭负担还没说清"],
            explanation: "fact plus aspect",
          }),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement.includes("月薪三万"));
      assert.ok(fact, "FU8-B2 must write the grounded fact");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.ok(dc.version > ctx.vBefore);
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU8-B2");
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU8-B2 must keep the aspect pending");
      assert.equal(control!.items.some((i) => i.kind === "unresolved_aspect" && i.text.includes("家庭负担")), true);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-B2 must ask the aspect before ordinary planning");
      assert.ok(lastAssistant(out).content.includes("家庭负担"));
    });

    await check("M2.4-R2-FU8-B3: multiple unresolved aspects are scheduled one at a time", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b3");
      stubResponse = "FU8B3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我只能先说这些。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [],
            unresolved_aspects: ["时间窗口还不清楚", "退出成本还不清楚"],
            explanation: "two aspects",
          }),
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items.length, 2, "FU8-B3 must preserve both aspects");
      assert.ok(control!.items.every((i) => i.kind === "unresolved_aspect"));
      assert.equal(out.decision_context!.version, ctx.vBefore);
      const asst = lastAssistant(out);
      assert.ok(asst.content.includes("时间窗口还不清楚"), "FU8-B3 must ask the first aspect first");
      assert.equal(asst.content.includes("退出成本还不清楚"), false, "FU8-B3 must not merge both aspects into one question");
    });

    await check("M2.4-R2-FU8-B4: replay of an aspect-scheduling turn is idempotent", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b4");
      const statement = "我只能先说这些。";
      const draft = {
        classification: "partial_answer" as const,
        extracted_items: [] as Array<never>,
        unresolved_aspects: ["时间窗口还不清楚"],
        explanation: "aspect replay",
      };
      stubResponse = "FU8B4 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8b4_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(committed).content;
      const itemIds = (committed.pending_intake_control?.items ?? []).map((i) => i.item_id);
      stubResponse = "FU8B4 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: statement, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: statement,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      assert.equal(replay.decision_context!.version, committed.decision_context!.version);
      assert.equal(replay.decision_context!.reality_facts.length, ctx.factsBefore);
      assert.deepEqual((replay.pending_intake_control?.items ?? []).map((i) => i.item_id), itemIds);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1, "FU8-B4 must recover the same aspect question");
    });

    await check("M2.4-R2-FU8-B5: clarification resolves only its intended aspect", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b5");
      stubResponse = "FU8B5 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我只能先说这些。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [],
            unresolved_aspects: ["时间窗口还不清楚", "退出成本还不清楚"],
            explanation: "two aspects",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8b5_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const pending = (await durable(first.session_id)).pending_intake_control;
      assert.ok(pending && pending.items.length === 2);
      const firstId = pending!.resolving_item_id ?? pending!.items[0]!.item_id;
      const secondId = pending!.items.find((i) => i.item_id !== firstId)!.item_id;
      const clarify = "最晚必须在今年六月前决定。";
      stubResponse = "FU8B5 FREEFORM 2 MUST NOT WIN";
      const second = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: clarify,
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: clarify,
              },
            ],
            unresolved_aspects: [],
            explanation: "clarified first aspect",
          }),
        },
      });
      const control = second.pending_intake_control;
      assert.ok(control, "FU8-B5 must keep the remaining aspect");
      const resolved = control!.items.find((i) => i.item_id === firstId);
      const remaining = control!.items.find((i) => i.item_id === secondId);
      assert.equal(resolved?.status, "clarified", "FU8-B5 must resolve only the intended aspect");
      assert.ok(remaining && (remaining.status === "pending" || remaining.status === "uncertain"));
      const fact = second.decision_context!.reality_facts.find((f) => f.statement.includes("今年六月"));
      assert.ok(fact, "FU8-B5 may write the grounded clarification");
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU8-B5");
      assert.ok(lastAssistant(second).content.includes("退出成本还不清楚"));
      assert.equal(isOrdinaryNeedItemPlan(second.adaptive_ask_plan), false);
    });

    await check("M2.4-R2-FU8-C1: proposed goal change is captured without mutating Blueprint or DC definition", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c1");
      const statement = "我想把决策目标改成要不要立刻出国读书。";
      stubResponse = "FU8C1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [
              {
                text: "要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-C1 must not write the new goal as a fact");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore, "FU8-C1 must not write a confirmed DC definition");
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore, "FU8-C1 must not mutate Blueprint");
      assert.equal(definitionQuestion(out), ctx.dqBefore, "FU8-C1 must retain the original decision target");
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items[0]!.kind, "goal_change");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-C1 must not emit an old-target NeedItem");
      assert.ok(lastAssistant(out).content.includes("确认更换决策目标"));
    });

    await check("M2.4-R2-FU8-C4: explicit confirmation enters the controlled path without auto-applying the target", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c4");
      const statement = "我想把决策目标改成要不要立刻出国读书。";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c4_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      stubResponse = "FU8C4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "1",
        locale: "zh-CN",
      });
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore, "FU8-C4 must not auto-mutate Blueprint");
      assert.equal(definitionQuestion(out), ctx.dqBefore, "FU8-C4 must not auto-apply the new target");
      const control = out.pending_intake_control;
      assert.ok(control, "FU8-C4 must keep the control record");
      assert.equal(control!.entered_controlled_blueprint_update, true, "FU8-C4 must enter the controlled Blueprint-update path");
      assert.equal(control!.items[0]!.status, "confirmed");
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-C4 must not resume old-target NeedItem planning");
      assert.ok(lastAssistant(out).content.includes("受控的 Blueprint 更新路径"));
      assert.equal(out.decision_context!.version, ctx.vBefore);
    });

    await check("M2.4-R2-FU8-C5: explicit refusal preserves the original target and resumes investigation", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c5");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想把决策目标改成要不要立刻出国读书。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c5_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const oldClarify = lastAssistant(first).content;
      stubResponse = "FU8C5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "2",
        locale: "zh-CN",
      });
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
      assert.equal(definitionQuestion(out), ctx.dqBefore);
      const control = out.pending_intake_control;
      assert.ok(control);
      assert.equal(control!.items[0]!.status, "declined");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.notEqual(lastAssistant(out).content, oldClarify, "FU8-C5 must not resend the confirmation question");
      assert.ok(isOrdinaryNeedItemPlan(out.adaptive_ask_plan) || out.adaptive_ask_plan, "FU8-C5 may resume original-target investigation");
    });

    await check("M2.4-R2-FU8-C6: uncertain confirmation keeps the control item pending", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c6");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想把决策目标改成要不要立刻出国读书。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c6_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const oldClarify = lastAssistant(first).content;
      const asked1 = first.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU8C6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "我不确定",
        locale: "zh-CN",
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.ok(control!.items[0]!.status === "pending" || control!.items[0]!.status === "uncertain");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.equal(lastAssistant(out).content, oldClarify, "FU8-C6 must keep the confirmation question");
      assert.equal(out.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
    });

    await check("M2.4-R2-FU8-C7: replay does not repeat a confirmed target-change operation", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c7");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想把决策目标改成要不要立刻出国读书。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c7_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const confirmed = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "1",
        locale: "zh-CN",
      });
      await mutatePOJUSession(confirmed.session_id, {
        operation_id: "op_m24r2fu8c7_confirm",
        kind: "session_patch",
        bump_dc: true,
        apply: () => confirmed,
      });
      const committed = await durable(confirmed.session_id);
      const turnId = lastUserId(committed);
      const q1 = lastAssistant(committed).content;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU8C7 FREEFORM MUST NOT WIN";
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
      assert.deepEqual(blueprintSnapshot(replay), ctx.bpBefore);
      assert.equal(definitionQuestion(replay), ctx.dqBefore);
      assert.equal(replay.decision_context!.version, ctx.vBefore);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });

    await check("M2.4-R2-FU8-D1: insight_mismatch is captured as a control item and does not write inferred facts", async () => {
      const ctx = await seedFu8Ready("m24r2fu8d1");
      const statement = "你刚才的分析跟我的实际情况不一致，我并不是怕风险。";
      stubResponse = "FU8D1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "insight_mismatch",
            extracted_items: [
              {
                text: "用户其实是风险偏好型人格",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我并不是怕风险",
              },
            ],
            unresolved_aspects: [],
            explanation: "psychological inference",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-D1 must not write inferred RealityFacts");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items[0]!.kind, "insight_mismatch");
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-D1 must not silently resume ordinary planning");
      assert.ok(lastAssistant(out).content.includes("不一致"));
    });

    await check("M2.4-R2-FU8-D2: insight_mismatch clarification and replay are idempotent", async () => {
      const ctx = await seedFu8Ready("m24r2fu8d2");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "你刚才的分析跟我的实际情况不一致。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "insight_mismatch",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "mismatch",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8d2_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const factsBeforeClarify = first.decision_context!.reality_facts.length;
      stubResponse = "FU8D2 FREEFORM MUST NOT WIN";
      const clarified = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "不一致的地方是我并不是因为怕风险才犹豫。",
        locale: "zh-CN",
      });
      assert.equal(
        clarified.decision_context!.reality_facts.length,
        factsBeforeClarify,
        "FU8-D2 clarification must not write inferred facts",
      );
      await mutatePOJUSession(clarified.session_id, {
        operation_id: "op_m24r2fu8d2_clarify",
        kind: "session_patch",
        bump_dc: true,
        apply: () => clarified,
      });
      const committed = await durable(clarified.session_id);
      const turnId = lastUserId(committed);
      const v1 = committed.decision_context!.version;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(committed).content;
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            {
              role: "user" as const,
              content: "不一致的地方是我并不是因为怕风险才犹豫。",
              timestamp: NOW,
              client_id: turnId,
            },
          ],
        },
        userMessage: "不一致的地方是我并不是因为怕风险才犹豫。",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      assert.equal(replay.decision_context!.version, v1);
      assert.equal(replay.decision_context!.reality_facts.length, factsBeforeClarify);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });

'''
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")
needle = "    const modelSrc = readFileSync("
assert needle in text
text = text.replace(needle, tests + "    const modelSrc = readFileSync(", 1)
# header note
old = " * M2.4-R1-FU3: negation-safe choice parsing + C1 persist-failure rollback (Cases U–Y).\n"
new = " * M2.4-R1-FU3: negation-safe choice parsing + C1 persist-failure rollback (Cases U–Y).\n * M2.4-R2-FU8: source-grounded model extractions, unresolved-aspect scheduling, goal_change / insight_mismatch control flow.\n"
if old in text:
    text = text.replace(old, new, 1)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("tests inserted, lines", text.count("\n"))
