
    // ------------------------------------------------------------------
    // M2.4-R2 — model-backed answer interpretation main path (A–F)
    // ------------------------------------------------------------------

    function authorizedFrom(session: POJUSessionState): {
      dir_ids: string[];
      ddr_ids: string[];
      fact_roles: string[];
    } {
      const last = session.decision_understanding?.last_sent_question;
      const plan = session.decision_understanding?.next_question_plan ?? session.adaptive_ask_plan;
      const src = last && (last.dir_ids.length > 0 || last.ddr_ids.length > 0) ? last : plan;
      const codes = src && "fact_role_codes" in src ? src.fact_role_codes ?? [] : [];
      const roles = codes
        .map((c: string) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        })
        .filter(Boolean);
      return {
        dir_ids: src ? [...src.dir_ids] : [],
        ddr_ids: src ? [...src.ddr_ids] : [],
        fact_roles: roles,
      };
    }

    async function seedAnswerReadySession(tag: string): Promise<POJUSessionState> {
      const sid = await seedSession(tag, jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: `init_${tag}`,
        now: NOW,
        init_only: true,
      });
      assert.ok(seeded.plan && seeded.authorized_question, `${tag} first plan required`);
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      const attached = attachAuthorizedAssistantQuestion(
        seeded.session,
        seeded.plan!,
        `ask_${tag}`,
      );
      await mutatePOJUSession(sid, {
        operation_id: `op_${tag}_init`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => attached,
      });
      return durable(sid);
    }

    await check("M2.4-R2 Case A: three consecutive real handleUserMessage rounds", async () => {
      let s = await seedAnswerReadySession("m24r2a");
      const logs: string[] = [];

      const hookFor = (draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft) => ({
        interpretAnswerModel: () => draft,
      });

      // Round 1: two explicit facts
      const auth1 = authorizedFrom(s);
      assert.ok(auth1.dir_ids.length >= 1 && auth1.fact_roles.length >= 1, "round1 must have authorized targets");
      const v0 = s.decision_context!.version;
      const asked0 = s.decision_understanding?.budget.session_asked_count ?? 0;
      fetchCalls.length = 0;
      stubResponse = "R2A FREEFORM ROUND 1";
      const r1Text = "我目前仍在职，月薪三万。另外家里有一个孩子。";
      const out1 = await handleUserMessage({
        session: s,
        userMessage: r1Text,
        locale: "zh-CN",
        __testOnlyM1Hooks: hookFor({
          classification: "clear_answer",
          extracted_items: [
            {
              text: "我目前仍在职，月薪三万。",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
            },
            {
              text: "家里有一个孩子。",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
            },
          ],
          unresolved_aspects: [],
          explanation: "two explicit facts",
        }),
      });
      await mutatePOJUSession(s.session_id, {
        operation_id: "op_m24r2a_r1",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out1,
      });
      s = await durable(s.session_id);
      const facts1 = s.decision_context!.reality_facts.filter((f) => f.statement.includes("仍在职") || f.statement.includes("孩子"));
      assert.ok(facts1.length >= 2, `round1 must write two facts, got ${facts1.length}`);
      for (const fact of facts1) {
        assert.equal(fact.status, "unverified");
        assert.notEqual(fact.status, "confirmed");
        assert.ok(fact.related_dir_ids.some((id) => auth1.dir_ids.includes(id)));
        assert.ok(fact.fact_roles.some((role) => auth1.fact_roles.includes(role)));
        assert.equal(fact.statement.includes("two explicit facts"), false, "explanation must not become a fact");
      }
      assert.ok(s.decision_context!.version > v0, "round1 DC version must increase");
      assert.ok(s.decision_understanding);
      assert.equal(
        s.decision_understanding!.context_version,
        s.decision_context!.version,
        "round1 Understanding.context_version must match DC.version",
      );
      const asst1 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan, "round1 next question required");
      assert.equal(asst1.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst1.content, stubResponse);
      const needDirs1 = new Set(
        s.decision_understanding!.need_to_understand.items
          .filter((n) => n.kind === "dir_based")
          .map((n) => n.dir_id),
      );
      for (const d of s.adaptive_ask_plan!.dir_ids) {
        assert.ok(
          needDirs1.has(d) || s.decision_context!.dirs.some((x) => x.dir_id === d),
          `round1 next Q dir ${d} must come from latest NeedItem or live DIR`,
        );
      }
      const q1 = asst1.content;
      const roles1Satisfied = new Set(facts1.flatMap((f) => f.fact_roles));
      logs.push(
        `[m24r2a] round=1 input=${r1Text}; facts=${s.decision_context!.reality_facts.length}; written=${facts1.map((f) => `${f.fact_id}:${f.status}:${f.verification_level}:${f.fact_roles.join(",")}`).join("|")}; dc=${v0}->${s.decision_context!.version}; ctx_ver=${s.decision_understanding!.context_version}; next_q=${q1}; next_dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; next_roles=${(s.adaptive_ask_plan!.fact_role_codes ?? []).join(",")}; asked=${asked0}->${s.decision_understanding!.budget.session_asked_count}`,
      );

      // Round 2: estimate + explicit constraint
      const auth2 = authorizedFrom(s);
      const v1 = s.decision_context!.version;
      const asked1 = s.decision_understanding!.budget.session_asked_count;
      fetchCalls.length = 0;
      stubResponse = "R2A FREEFORM ROUND 2";
      const r2Text = "大概还能撑 6 个月。硬约束是必须保留社保。";
      const out2 = await handleUserMessage({
        session: s,
        userMessage: r2Text,
        locale: "zh-CN",
        __testOnlyM1Hooks: hookFor({
          classification: "partial_answer",
          extracted_items: [
            {
              text: "大概还能撑 6 个月。",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "estimated",
            },
            {
              text: "硬约束是必须保留社保。",
              semantic_kind: "constraint",
              role_hint: null,
              certainty: "explicit",
            },
          ],
          unresolved_aspects: [],
          explanation: "estimate plus constraint",
        }),
      });
      await mutatePOJUSession(s.session_id, {
        operation_id: "op_m24r2a_r2",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out2,
      });
      s = await durable(s.session_id);
      const estimateFact = s.decision_context!.reality_facts.find((f) => f.statement.includes("撑 6 个月") || f.statement.includes("撑6个月"));
      assert.ok(estimateFact, "round2 estimate fact missing");
      assert.equal(estimateFact!.verification_level, "user_estimate");
      assert.equal(estimateFact!.status, "unverified");
      assert.notEqual(estimateFact!.status, "confirmed");
      const cst = s.decision_context!.constraints.find((c) => c.statement.includes("必须保留社保"));
      assert.ok(cst, "round2 constraint missing");
      assert.equal(cst!.status, "unverified");
      assert.equal(cst!.user_confirmed, false);
      assert.ok(s.decision_context!.version > v1);
      assert.equal(s.decision_understanding!.context_version, s.decision_context!.version);
      const asst2 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan, "round2 next question required");
      assert.equal(asst2.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst2.content, stubResponse);
      const nextRoles2 = (s.adaptive_ask_plan!.fact_role_codes ?? [])
        .map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        })
        .filter(Boolean);
      if (roles1Satisfied.size > 0 && nextRoles2.length > 0) {
        const onlyRepeatSatisfied =
          nextRoles2.every((role) => roles1Satisfied.has(role)) &&
          s.adaptive_ask_plan!.dir_ids.every((d) => facts1.some((f) => f.related_dir_ids.includes(d))) &&
          s.decision_understanding!.need_to_understand.items.some(
            (n) =>
              n.kind === "dir_based" &&
              !s.adaptive_ask_plan!.dir_ids.includes(n.dir_id),
          );
        assert.equal(
          onlyRepeatSatisfied,
          false,
          "round2 next question must not only repeat already-satisfied roles when other needs remain",
        );
      }
      const q2 = asst2.content;
      logs.push(
        `[m24r2a] round=2 input=${r2Text}; estimate=${estimateFact!.fact_id}:${estimateFact!.status}:${estimateFact!.verification_level}; constraint=${cst!.constraint_id}:${cst!.status}; facts=${s.decision_context!.reality_facts.length}; constraints=${s.decision_context!.constraints.length}; dc=${v1}->${s.decision_context!.version}; ctx_ver=${s.decision_understanding!.context_version}; next_q=${q2}; next_dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; next_roles=${(s.adaptive_ask_plan!.fact_role_codes ?? []).join(",")}; asked=${asked1}->${s.decision_understanding!.budget.session_asked_count}`,
      );

      // Round 3: correction + supplement, keep original fact, open Conflict if mutex holds
      const v2 = s.decision_context!.version;
      const factIdsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const originalStay = s.decision_context!.reality_facts.find((f) => f.statement.includes("仍在职"));
      assert.ok(originalStay, "original 仍在职 fact must exist before correction");
      fetchCalls.length = 0;
      stubResponse = "R2A FREEFORM ROUND 3";
      const r3Text = "更正一下，我已经离职了，不是仍在职。另外还有一个备选是内部转岗。";
      const out3 = await handleUserMessage({
        session: s,
        userMessage: r3Text,
        locale: "zh-CN",
        __testOnlyM1Hooks: hookFor({
          classification: "correction",
          extracted_items: [
            {
              text: "我已经离职了，不是仍在职。",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
            },
            {
              text: "还有一个备选是内部转岗。",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
            },
          ],
          unresolved_aspects: [],
          explanation: "correction plus supplement",
        }),
      });
      await mutatePOJUSession(s.session_id, {
        operation_id: "op_m24r2a_r3",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out3,
      });
      s = await durable(s.session_id);
      const stillOriginal = s.decision_context!.reality_facts.find((f) => f.fact_id === originalStay!.fact_id);
      assert.ok(stillOriginal, "original fact must not be silently deleted");
      const correctionFact = s.decision_context!.reality_facts.find((f) => f.statement.includes("已经离职"));
      const supplementFact = s.decision_context!.reality_facts.find((f) => f.statement.includes("内部转岗"));
      assert.ok(correctionFact, "correction fact missing");
      assert.ok(supplementFact, "supplement fact missing");
      assert.notEqual(correctionFact!.fact_id, originalStay!.fact_id);
      assert.ok(s.decision_context!.version > v2);
      assert.equal(s.decision_understanding!.context_version, s.decision_context!.version);
      const openConflicts = s.decision_context!.conflicts.filter((c) => c.state === "open");
      assert.ok(
        openConflicts.some((c) => c.fact_ids.includes(originalStay!.fact_id) && c.fact_ids.includes(correctionFact!.fact_id)),
        "mutex correction must keep both facts and create an open Conflict",
      );
      const asst3 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan, "round3 next question required");
      assert.equal(asst3.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst3.content, stubResponse);
      const nextCf = s.decision_understanding?.last_sent_question?.conflict_clarification
        ?? s.adaptive_ask_plan?.conflict_clarification
        ?? null;
      const needOrConflictBound =
        Boolean(nextCf) ||
        s.adaptive_ask_plan!.dir_ids.some((d) =>
          s.decision_understanding!.need_to_understand.items.some(
            (n) => n.kind === "dir_based" && n.dir_id === d,
          ),
        );
      assert.equal(needOrConflictBound, true, "round3 next Q must bind remaining need or Conflict");
      logs.push(
        `[m24r2a] round=3 input=${r3Text}; kept_original=${stillOriginal!.fact_id}; correction=${correctionFact!.fact_id}; supplement=${supplementFact!.fact_id}; conflicts=${s.decision_context!.conflicts.map((c) => `${c.conflict_id}:${c.state}:${c.fact_ids.join("+")}`).join("|")}; fact_ids_before=${factIdsBefore.join(",")}; fact_ids_after=${s.decision_context!.reality_facts.map((f) => f.fact_id).join(",")}; dc=${v2}->${s.decision_context!.version}; ctx_ver=${s.decision_understanding!.context_version}; next_q=${asst3.content}; next_dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; next_cf=${nextCf?.conflict_id ?? "none"}`,
      );

      for (const line of logs) console.log(line);
    });

    await check("M2.4-R2 Case B: unauthorized model role/DIR/DDR is rejected", async () => {
      const before = await seedAnswerReadySession("m24r2b");
      const auth = authorizedFrom(before);
      const vBefore = before.decision_context!.version;
      const factIdsBefore = before.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      stubResponse = "R2B FREEFORM";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我有一个方案是留任。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "越权角色不应写入。",
                semantic_kind: "reality_fact",
                role_hint: "not_a_real_authorized_role",
                certainty: "explicit",
              },
              {
                text: "我有一个方案是留任。",
                semantic_kind: "reality_fact",
                role_hint: auth.fact_roles[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "overreach",
            dir_ids: ["DIR-NOT-AUTHORIZED"],
            ddr_ids: ["DDR-NOT-AUTHORIZED"],
            user_confirmed: true,
          }),
        },
      });
      const dc = out.decision_context!;
      const overreach = dc.reality_facts.filter((f) => f.statement.includes("越权角色不应写入"));
      assert.equal(overreach.length, 0, "unauthorized role must not write a fact");
      const legal = dc.reality_facts.filter((f) => f.statement.includes("留任"));
      assert.ok(legal.length >= 1, "authorized item may still write");
      for (const fact of legal) {
        assert.ok(fact.related_dir_ids.every((id) => auth.dir_ids.includes(id)));
        assert.ok(fact.fact_roles.every((role) => auth.fact_roles.includes(role)));
        assert.equal(fact.related_dir_ids.includes("DIR-NOT-AUTHORIZED"), false);
      }
      assert.equal(
        out.decision_understanding?.last_sent_question?.dir_ids.includes("DIR-NOT-AUTHORIZED") ?? false,
        false,
      );
      assert.ok(dc.version >= vBefore);
      assert.deepEqual(
        dc.reality_facts.filter((f) => factIdsBefore.includes(f.fact_id)).map((f) => f.fact_id).sort(),
        factIdsBefore,
      );
      console.log(
        `[m24r2b] auth_dirs=${auth.dir_ids.join(",")}; auth_roles=${auth.fact_roles.join(",")}; overreach_facts=${overreach.length}; legal_facts=${legal.length}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R2 Case C: model confirmation fields cannot become confirmed facts", async () => {
      const before = await seedAnswerReadySession("m24r2c");
      const out = await handleUserMessage({
        session: before,
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
                certainty: "explicit",
                user_confirmed: true,
                verification_level: "confirmed",
                confirmed: true,
              },
            ],
            unresolved_aspects: [],
            explanation: "sounds reasonable so confirmed",
            user_confirmed: true,
            confirmed: true,
            verification_level: "confirmed",
            readiness: "ready_for_final_confirm",
          }),
        },
      });
      const facts = out.decision_context!.reality_facts.filter((f) => f.statement.includes("月薪三万"));
      assert.ok(facts.length >= 1, "fact should be written");
      for (const fact of facts) {
        assert.equal(fact.status, "unverified");
        assert.notEqual(fact.status, "confirmed");
        assert.equal(fact.has_user_confirm_event, false);
        assert.notEqual(fact.verification_level, "confirmed" as string);
      }
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, "R2C FREEFORM");
      console.log(
        `[m24r2c] facts=${facts.map((f) => `${f.fact_id}:${f.status}:${f.verification_level}:confirm=${f.has_user_confirm_event}`).join("|")}`,
      );
    });

    async function assertInterpretationFailClosed(
      tag: string,
      hookResult: unknown | Error,
    ): Promise<void> {
      const before = await seedAnswerReadySession(tag);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.map((f) => `${f.fact_id}:${f.statement}`).sort();
      const cstBefore = before.decision_context!.constraints.map((c) => `${c.constraint_id}:${c.statement}`).sort();
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      fetchCalls.length = 0;
      stubResponse = `${tag} FREEFORM MUST NOT APPEAR`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => {
            if (hookResult instanceof Error) throw hookResult;
            return hookResult;
          },
        },
      });
      const asst = lastAssistant(out);
      assert.match(asst.content, /未能完成语义理解|请稍后重试/);
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content === stubResponse, false);
      const meta = (asst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } }).meta;
      assert.equal(meta?.m1_fail_closed, true);
      assert.ok(
        meta?.m1_outcome === "answer_interpretation_failed" ||
          meta?.m1_outcome === "answer_interpretation_invalid_schema",
        `unexpected outcome ${meta?.m1_outcome}`,
      );
      const dc = out.decision_context!;
      assert.equal(dc.version, vBefore, `${tag} DC version must be unchanged`);
      assert.deepEqual(
        dc.reality_facts.map((f) => `${f.fact_id}:${f.statement}`).sort(),
        factsBefore,
      );
      assert.deepEqual(
        dc.constraints.map((c) => `${c.constraint_id}:${c.statement}`).sort(),
        cstBefore,
      );
      assert.equal(
        out.decision_understanding?.budget.session_asked_count ?? askedBefore,
        askedBefore,
        `${tag} must not spend question budget`,
      );
      assert.equal(
        out.decision_understanding?.last_sent_question?.plan_id ?? lastSentBefore?.plan_id,
        lastSentBefore?.plan_id,
        `${tag} must not change last_sent_question authorization`,
      );
      assert.equal(
        fetchCalls.includes("/api/poju/chat"),
        false,
        `${tag} must not fall back to free-form LLM questioning`,
      );
      console.log(
        `[${tag}] outcome=${meta?.m1_outcome}; dc=${vBefore}->${dc.version}; facts=${dc.reality_facts.length}; constraints=${dc.constraints.length}; asked=${askedBefore}; last_sent=${lastSentBefore?.plan_id}; asst=${asst.content}`,
      );
    }

    await check("M2.4-R2 Case D: timeout is fail-closed", async () => {
      await assertInterpretationFailClosed("m24r2d_timeout", new Error("llm_timeout"));
    });
    await check("M2.4-R2 Case D: invalid JSON is fail-closed", async () => {
      await assertInterpretationFailClosed("m24r2d_json", "this is not json {");
    });
    await check("M2.4-R2 Case D: missing fields are fail-closed", async () => {
      await assertInterpretationFailClosed("m24r2d_schema", { classification: "clear_answer" });
    });

    await check("M2.4-R2 Case E: uncertainty and decline are not explicit facts", async () => {
      const cases: Array<{
        tag: string;
        text: string;
        draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft;
        expect: "estimate" | "unknown" | "declined" | "unverified";
      }> = [
        {
          tag: "m24r2e_estimate",
          text: "这个数字只是估计。",
          draft: {
            classification: "estimate",
            extracted_items: [
              {
                text: "这个数字只是估计。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "estimated",
              },
            ],
            unresolved_aspects: [],
            explanation: "estimate",
          },
          expect: "estimate",
        },
        {
          tag: "m24r2e_unknown",
          text: "我现在还无法确定。",
          draft: {
            classification: "unknown",
            extracted_items: [
              {
                text: "我现在还无法确定。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "unclear",
              },
            ],
            unresolved_aspects: [],
            explanation: "unknown",
          },
          expect: "unknown",
        },
        {
          tag: "m24r2e_declined",
          text: "这部分我不想回答。",
          draft: {
            classification: "declined",
            extracted_items: [
              {
                text: "这部分我不想回答。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "unclear",
              },
            ],
            unresolved_aspects: [],
            explanation: "declined",
          },
          expect: "declined",
        },
        {
          tag: "m24r2e_unverified",
          text: "我需要再核实一下。",
          draft: {
            classification: "vague_answer",
            extracted_items: [
              {
                text: "我需要再核实一下。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "unclear",
              },
            ],
            unresolved_aspects: [],
            explanation: "needs verification",
          },
          expect: "unverified",
        },
      ];
      for (const item of cases) {
        const before = await seedAnswerReadySession(item.tag);
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => item.draft },
        });
        const written = out.decision_context!.reality_facts.filter((f) =>
          f.statement.includes(item.text.replace(/。$/, "")) || f.statement === item.text,
        );
        if (item.expect === "declined") {
          assert.ok(written.length >= 1);
          assert.ok(written.every((f) => f.status === "declined" && f.verification_level === "none"));
        } else if (item.expect === "unknown") {
          assert.ok(written.length >= 1);
          assert.ok(written.every((f) => f.status === "unknown" && f.verification_level === "none"));
        } else if (item.expect === "estimate") {
          assert.ok(written.length >= 1);
          assert.ok(written.every((f) => f.status === "unverified" && f.verification_level === "user_estimate"));
        } else {
          assert.ok(
            written.every((f) => f.status !== "confirmed" && f.verification_level !== "user_asserted"),
            `${item.tag} must not be classified as an explicit fact`,
          );
        }
        assert.ok(written.every((f) => f.status !== "confirmed"));
        console.log(
          `[m24r2e] tag=${item.tag}; input=${item.text}; writes=${written.map((f) => `${f.status}:${f.verification_level}`).join("|") || "none"}`,
        );
      }
    });

    await check("M2.4-R2 Case F: real persist + same source_turn_id resubmit is idempotent", async () => {
      const before = await seedAnswerReadySession("m24r2f");
      stubResponse = "R2F FREEFORM 1";
      const first = await handleUserMessage({
        session: before,
        userMessage: "硬约束是必须保留社保，预算不能低于现在的 70%。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2f_first",
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
      const q1 = lastAssistant(committed).content;
      stubResponse = "R2F FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: committed,
        userMessage: "硬约束是必须保留社保，预算不能低于现在的 70%。",
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint replay",
          }),
        },
      });
      assert.equal(lastUserId(replay), turnId);
      const dc = replay.decision_context!;
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.deepEqual(dc.constraints.map((c) => c.constraint_id).sort(), cst1);
      assert.equal(dc.version, v1, "replay must not bump DC version");
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      const asst = lastAssistant(replay);
      assert.notEqual(asst.content, stubResponse);
      if (replay.adaptive_ask_plan) {
        assert.equal(asst.content, replay.adaptive_ask_plan.question_text);
      }
      // Recovered question should be the already-authorized one, not a second logical question.
      assert.equal(asst.content, q1, "replay must recover the existing authorized question");
      console.log(
        `[m24r2f] turn=${turnId}; facts=${facts1.length}; constraints=${cst1.length}; dc=${v1}->${dc.version}; asked=${asked1}; q_recovered=${asst.content === q1}`,
      );
    });

    await check("M2.4-R2 static: production path uses model interpretation before DC write", async () => {
      const adaptive = readFileSync(join(process.cwd(), "lib/poju/decision-intake/adaptive-turn.ts"), "utf8");
      assert.match(adaptive, /interpretAnswerWithModel/);
      assert.match(adaptive, /answerEventFromModelDraft/);
      assert.match(adaptive, /answer_interpretation_failed/);
      const agentSrc = readFileSync(join(process.cwd(), "lib/poju/agent.ts"), "utf8");
      assert.match(agentSrc, /answer_interpretation_failed|未能完成语义理解/);
      const modelSrc = readFileSync(
        join(process.cwd(), "lib/poju/decision-intake/answer-interpretation-model.ts"),
        "utf8",
      );
      assert.match(modelSrc, /openRouterChatCompletion/);
      assert.match(modelSrc, /Decision Intake Answer Interpretation/);
      assert.match(modelSrc, /timeout_ms: ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS/);
      assert.equal(/OPENROUTER_API_KEY|fetch\(OPENROUTER/.test(modelSrc), false);
    });
