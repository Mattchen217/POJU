
    // M2.4-R2-FU9: persisted content must be user-authored; insight_mismatch
    // clarifications are interpreted and retained; goal_change extracts an
    // exact target phrase instead of the entire original sentence.
    function fu9Item(
      text: string,
      opts: {
        legalCode: string;
        kind?: "reality_fact" | "constraint" | "definition_patch";
        source_quote?: string;
        certainty?: "explicit" | "estimated" | "unclear";
      },
    ) {
      return {
        text,
        semantic_kind: opts.kind ?? "reality_fact",
        role_hint: null,
        role_code_hint: opts.legalCode,
        certainty: opts.certainty ?? "explicit",
        source_quote: opts.source_quote ?? text,
      };
    }
    function fu9Draft(
      items: ReturnType<typeof fu9Item>[],
      extra?: Partial<import("../lib/poju/decision-intake/types").ModelAnswerDraft>,
    ): import("../lib/poju/decision-intake/types").ModelAnswerDraft {
      return {
        classification: "clear_answer",
        extracted_items: items,
        unresolved_aspects: [],
        explanation: "fu9",
        ...extra,
      };
    }
    function groundingRejectionsOf(session: POJUSessionState) {
      return session.last_answer_event?.grounding_rejections ?? [];
    }
    function proposedWritesOf(session: POJUSessionState) {
      return session.last_answer_event?.proposed_writes ?? [];
    }
    async function seedFu9Mismatch(
      tag: string,
      statement = "你刚才的分析跟我的实际情况不一致，我并不是怕风险。",
    ) {
      const ctx = await seedFu8Ready(tag);
      stubResponse = `${tag} FREEFORM 1 MUST NOT WIN`;
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft(
              [
                fu9Item("用户其实是风险偏好型人格", {
                  legalCode: ctx.legalCode,
                  source_quote: "我并不是怕风险",
                }),
              ],
              {
                classification: "insight_mismatch",
                explanation: "psychological inference",
              },
            ),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: `op_${tag}_mismatch`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      return { ctx, first, committed: await durable(first.session_id) };
    }

    await check("M2.4-R2-FU9-A1: exact user statement as text and source_quote is accepted", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a1");
      const statement = "我目前月薪三万。";
      stubResponse = "FU9A1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(statement, { legalCode: ctx.legalCode })]),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement === statement);
      assert.ok(fact, "FU9-A1 must persist the original unnormalized quote");
      assert.equal(fact!.verification_level, "user_asserted");
      assert.equal(fact!.status, "unverified");
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU9-A1");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.ok(dc.version > ctx.vBefore);
      assert.equal(groundingRejectionsOf(out).length, 0);
    });

    await check("M2.4-R2-FU9-A2: source_quote exists but text changes the meaning is rejected", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a2");
      const statement = "我并不是怕风险。";
      stubResponse = "FU9A2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我其实愿意承担风险。", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU9-A2 must not write a paraphrase");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      const rejections = groundingRejectionsOf(out);
      assert.ok(
        rejections.some((r) => r.reason === "extraction_text_not_source_equivalent"),
        "FU9-A2 must record extraction_text_not_source_equivalent",
      );
      assert.equal(proposedWritesOf(out).length, 0);
      assert.equal(
        proposedWritesOf(out).some((w) => w.verification_level === "user_asserted" || w.verification_level === "user_estimate"),
        false,
      );
    });

    await check("M2.4-R2-FU9-A3: inferred personality label is rejected", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a3");
      const statement = "我并不是怕风险。";
      stubResponse = "FU9A3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU9-A3 must not write a personality inference");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      assert.ok(
        groundingRejectionsOf(out).some((r) => r.reason === "extraction_text_not_source_equivalent"),
      );
      assert.equal(proposedWritesOf(out).length, 0);
    });

    await check("M2.4-R2-FU9-A4: polarity-flipped substring paraphrase is rejected", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a4");
      const statement = "我不想离职。";
      stubResponse = "FU9A4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我想离职", {
                legalCode: ctx.legalCode,
                source_quote: "想离职",
              }),
            ]),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU9-A4 must not write 我想离职");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      assert.ok(
        groundingRejectionsOf(out).some((r) => r.reason === "extraction_text_not_source_equivalent"),
        "FU9-A4 must reject text that is not source-equivalent",
      );
      assert.equal(proposedWritesOf(out).length, 0);
    });

    await check("M2.4-R2-FU9-A5: mixed exact item and paraphrased inference writes only the exact item", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a5");
      const statement = "我目前月薪三万。我并不是怕风险。";
      stubResponse = "FU9A5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我目前月薪三万。", { legalCode: ctx.legalCode }),
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      const dc = out.decision_context!;
      const exact = dc.reality_facts.filter((f) => f.statement === "我目前月薪三万。");
      const inferred = dc.reality_facts.filter((f) => f.statement.includes("风险偏好"));
      assert.equal(exact.length, 1, "FU9-A5 must persist the exact item");
      assert.equal(inferred.length, 0, "FU9-A5 must not persist the paraphrase");
      assert.equal(exact[0]!.verification_level, "user_asserted");
      assertRolesAndDirs(exact[0]!, ctx.role, ctx.dirId, "FU9-A5");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.ok(dc.version > ctx.vBefore);
      assert.ok(
        groundingRejectionsOf(out).some((r) => r.reason === "extraction_text_not_source_equivalent"),
      );
      assert.equal(
        proposedWritesOf(out).some((w) => w.statement.includes("风险偏好")),
        false,
      );
    });

    await check("M2.4-R2-FU9-A6: missing, blank, and oversized source quotes never write DC", async () => {
      const ctxMissing = await seedFu8Ready("m24r2fu9a6m");
      stubResponse = "FU9A6M FREEFORM MUST NOT WIN";
      const missing = await handleUserMessage({
        session: ctxMissing.before,
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
                role_code_hint: ctxMissing.legalCode,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "missing source_quote",
          }),
        },
      });
      assert.equal(missing.decision_context!.reality_facts.length, ctxMissing.factsBefore);
      assert.equal(missing.decision_context!.constraints.length, ctxMissing.cstBefore);
      assert.equal(missing.decision_context!.version, ctxMissing.vBefore);

      const ctxBlank = await seedFu8Ready("m24r2fu9a6b");
      stubResponse = "FU9A6B FREEFORM MUST NOT WIN";
      const blank = await handleUserMessage({
        session: ctxBlank.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我目前月薪三万。", { legalCode: ctxBlank.legalCode, source_quote: "   " }),
            ]),
        },
      });
      assert.equal(blank.decision_context!.reality_facts.length, ctxBlank.factsBefore);
      assert.equal(blank.decision_context!.version, ctxBlank.vBefore);
      assert.ok(groundingRejectionsOf(blank).some((r) => r.reason === "source_quote_empty"));
      assert.equal(proposedWritesOf(blank).length, 0);

      const ctxLong = await seedFu8Ready("m24r2fu9a6l");
      const tooLong = `${"我目前月薪三万。".repeat(200)}x`;
      stubResponse = "FU9A6L FREEFORM MUST NOT WIN";
      const oversized = await handleUserMessage({
        session: ctxLong.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我目前月薪三万。", { legalCode: ctxLong.legalCode, source_quote: tooLong }),
            ]),
        },
      });
      assert.equal(oversized.decision_context!.reality_facts.length, ctxLong.factsBefore);
      assert.equal(oversized.decision_context!.version, ctxLong.vBefore);
      assert.ok(groundingRejectionsOf(oversized).some((r) => r.reason === "source_quote_too_long"));
      assert.equal(proposedWritesOf(oversized).length, 0);
    });

    await check("M2.4-R2-FU9-A7: rejected content never receives user_asserted or user_estimate", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a7");
      const statement = "我并不是怕风险。";
      stubResponse = "FU9A7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
                certainty: "explicit",
              }),
            ]),
        },
      });
      assert.equal(out.decision_context!.version, ctx.vBefore);
      assert.equal(proposedWritesOf(out).length, 0);
      assert.equal(
        (out.decision_context!.reality_facts ?? []).some(
          (f) =>
            (f.statement.includes("风险偏好") || f.statement.includes("怕风险")) &&
            (f.verification_level === "user_asserted" || f.verification_level === "user_estimate"),
        ),
        false,
      );
    });

    await check("M2.4-R2-FU9-A8: rejected items have structured inspectable rejection reasons", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a8");
      stubResponse = "FU9A8 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我并不是怕风险。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      const rejections = groundingRejectionsOf(out);
      assert.ok(rejections.length >= 1, "FU9-A8 must expose grounding_rejections on the session");
      assert.equal(rejections[0]!.reason, "extraction_text_not_source_equivalent");
      assert.equal(rejections[0]!.source_quote, "我并不是怕风险");
      assert.equal(rejections[0]!.text.includes("风险偏好型人格"), true);
      assert.equal(typeof rejections[0]!.extracted_index, "number");
    });

    await check("M2.4-R2-FU9-A9: replay does not duplicate writes or rejection records", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a9");
      const statement = "我目前月薪三万。我并不是怕风险。";
      const draft = fu9Draft([
        fu9Item("我目前月薪三万。", { legalCode: ctx.legalCode }),
        fu9Item("用户其实是风险偏好型人格", {
          legalCode: ctx.legalCode,
          source_quote: "我并不是怕风险",
        }),
      ]);
      stubResponse = "FU9A9 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu9a9_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const rejections1 = groundingRejectionsOf(committed);
      assert.equal(committed.decision_context!.reality_facts.length, ctx.factsBefore + 1);
      assert.ok(rejections1.some((r) => r.reason === "extraction_text_not_source_equivalent"));
      const v1 = committed.decision_context!.version;
      stubResponse = "FU9A9 FREEFORM 2 MUST NOT WIN";
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
      assert.equal(dc.version, v1);
      assert.equal(groundingRejectionsOf(replay).length, rejections1.length);
    });
