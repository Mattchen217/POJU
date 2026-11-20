    await check("M2.4-R2-FU1 Case G: multi-role auth + null role_code_hint writes nothing", async () => {
      const seeded = await seedAnswerReadySession("m24r2g");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      assert.notEqual(codeA, codeB, "Case G needs two distinct authorized role codes");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
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
      fetchCalls.length = 0;
      stubResponse = "R2G FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "Case G must not write RealityFacts");
      assert.equal(dc.constraints.length, cstBefore, "Case G must not write Constraints");
      assert.equal(dc.version, vBefore, "Case G must not bump DC version");
      const bothFilled = [codeA, codeB].every((code) => {
        const role = code.split("/role/")[1] ?? "";
        const dir = roleCodeDir(code);
        return dc.reality_facts.some(
          (f) => (f.fact_roles ?? []).includes(role) && (f.related_dir_ids ?? []).includes(dir),
        );
      });
      assert.equal(bothFilled, false, "Case G must not fill both authorized roles");
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "我目前仍在职。",
        source_turn_id: "probe_m24r2g",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0);
      assert.ok(
        probe.notes.some((n) => n.includes("unlocated_role_code") || n.includes("unresolved:unlocated_role_code")),
        `Case G must keep unresolved aspect, notes=${probe.notes.join("|")}`,
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      if (out.adaptive_ask_plan) {
        assert.equal(asst.content, out.adaptive_ask_plan.question_text);
      }
      assert.equal(
        out.decision_understanding?.last_sent_question?.plan_id ?? lastSentBefore?.plan_id,
        lastSentBefore?.plan_id,
        "Case G must not change the actually-sent Plan identity",
      );
      console.log(
        `[m24r2g] codes=${codeA}|${codeB}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${out.decision_understanding?.budget.session_asked_count ?? askedBefore}; unresolved=${probe.notes.join(",")}; writes=${probe.proposed_writes.length}; next_q=${asst.content}; next_dirs=${(out.adaptive_ask_plan?.dir_ids ?? []).join(",")}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU1 Case H: exact role codes bind independently", async () => {
      const seeded = await seedAnswerReadySession("m24r2h");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "事实A绑定角色A。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: codeA,
            certainty: "explicit",
          },
          {
            text: "事实B绑定角色B。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: codeB,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "exact role codes",
      };
      stubResponse = "R2H FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "事实A绑定角色A。另外事实B绑定角色B。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const factA = dc.reality_facts.find((f) => f.statement.includes("事实A绑定角色A"));
      const factB = dc.reality_facts.find((f) => f.statement.includes("事实B绑定角色B"));
      assert.ok(factA, "fact A missing");
      assert.ok(factB, "fact B missing");
      const dirA = roleCodeDir(codeA);
      const dirB = roleCodeDir(codeB);
      const roleA = codeA.split("/role/")[1]!;
      const roleB = codeB.split("/role/")[1]!;
      assert.deepEqual(factA!.fact_roles, [roleA]);
      assert.deepEqual(factA!.related_dir_ids, [dirA]);
      assert.deepEqual(factB!.fact_roles, [roleB]);
      assert.deepEqual(factB!.related_dir_ids, [dirB]);
      assert.equal(factA!.fact_roles.includes(roleB) && dirA !== dirB, false);
      assert.equal((factA!.related_dir_ids ?? []).includes(dirB) && dirA !== dirB, false);
      assert.equal((factB!.related_dir_ids ?? []).includes(dirA) && dirA !== dirB, false);
      assert.equal((factA!.related_dir_ids ?? []).includes("DIR-NOT-AUTHORIZED"), false);
      assert.equal((factB!.related_dir_ids ?? []).includes("DIR-NOT-AUTHORIZED"), false);
      assert.equal(dc.version, vBefore + 1, "DC version must increment once");
      console.log(
        `[m24r2h] codeA=${codeA}; codeB=${codeB}; factA=${factA!.fact_id}:${factA!.fact_roles.join(",")}:${(factA!.related_dir_ids ?? []).join(",")}; factB=${factB!.fact_id}:${factB!.fact_roles.join(",")}:${(factB!.related_dir_ids ?? []).join(",")}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R2-FU1 Case I: forged role code is rejected; legal item still writes", async () => {
      const before = await seedAnswerReadySession("m24r2i");
      const auth = authorizedFrom(before);
      const legalCode = auth.fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case I needs a legal authorized role code");
      const forged = "v1/dir/DIR-FORGED/role/forged_role";
      const vBefore = before.decision_context!.version;
      const lastPlan = before.decision_understanding?.last_sent_question?.plan_id;
      const lastCodes = [...(before.decision_understanding?.last_sent_question?.fact_role_codes ?? [])];
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
        explanation: "forged role code",
      };
      stubResponse = "R2I FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "伪造角色不应写入。另外这是合法授权条目。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const overreach = dc.reality_facts.filter((f) => f.statement.includes("伪造角色不应写入"));
      const legal = dc.reality_facts.filter((f) => f.statement.includes("合法授权条目"));
      assert.equal(overreach.length, 0, "forged role must not write");
      assert.ok(legal.length >= 1, "legal item should still write");
      for (const fact of legal) {
        assert.deepEqual(fact.fact_roles, [legalCode.split("/role/")[1]]);
        assert.deepEqual(fact.related_dir_ids, [roleCodeDir(legalCode)]);
        assert.equal((fact.fact_roles ?? []).includes("forged_role"), false);
        assert.equal((fact.related_dir_ids ?? []).includes("DIR-FORGED"), false);
      }
      assert.equal(
        (out.decision_understanding?.last_sent_question?.fact_role_codes ?? []).includes(forged),
        false,
      );
      assert.equal(out.decision_understanding?.last_sent_question?.plan_id, lastPlan);
      assert.deepEqual(
        out.decision_understanding?.last_sent_question?.fact_role_codes ?? [],
        lastCodes,
      );
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "伪造角色不应写入。另外这是合法授权条目。",
        source_turn_id: "probe_m24r2i",
        draft,
      });
      console.log(
        `[m24r2i] legal=${legalCode}; forged=${forged}; overreach=${overreach.length}; legal_facts=${legal.length}; legal_bind=${legal.map((f) => `${f.fact_id}:${(f.fact_roles ?? []).join(",")}:${(f.related_dir_ids ?? []).join(",")}`).join("|")}; dc=${vBefore}->${dc.version}; notes=${probe.notes.join(",")}; plan=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU1 Case J: unclear must not become estimate", async () => {
      const before = await seedAnswerReadySession("m24r2j");
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case J needs a legal authorized role code");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "partial_answer",
        extracted_items: [
          {
            text: "用户可能有一定资金储备",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "unclear",
          },
        ],
        unresolved_aspects: [],
        explanation: "unclear certainty test",
      };
      stubResponse = "R2J FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "用户可能有一定资金储备",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore);
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      assert.equal(
        dc.reality_facts.some((f) => f.verification_level === "user_estimate"),
        false,
      );
      assert.equal(
        dc.reality_facts.some((f) => f.verification_level === "user_asserted" && f.statement.includes("资金储备")),
        false,
      );
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "用户可能有一定资金储备",
        source_turn_id: "probe_m24r2j",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0, "only-unclear turn must have empty proposed_writes");
      assert.ok(
        probe.notes.some((n) => n.includes("unclear_certainty")),
        `Case J must keep unclear unresolved, notes=${probe.notes.join("|")}`,
      );
      console.log(
        `[m24r2j] code=${legalCode}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; writes=${probe.proposed_writes.length}; unresolved=${probe.notes.join(",")}`,
      );
    });

    await check("M2.4-R2-FU1 Case K: estimated is kept as user_estimate", async () => {
      const before = await seedAnswerReadySession("m24r2k");
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case K needs a legal authorized role code");
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "estimate",
        extracted_items: [
          {
            text: "大概还能撑 6 个月。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "estimated",
          },
        ],
        unresolved_aspects: [],
        explanation: "estimated fact",
      };
      stubResponse = "R2K FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "大概还能撑 6 个月。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const fact = out.decision_context!.reality_facts.find((f) => f.statement.includes("撑 6 个月"));
      assert.ok(fact, "estimated fact missing");
      assert.equal(fact!.status, "unverified");
      assert.equal(fact!.verification_level, "user_estimate");
      assert.notEqual(fact!.verification_level, "user_asserted");
      assert.notEqual(fact!.status, "confirmed");
      assert.deepEqual(fact!.fact_roles, [legalCode.split("/role/")[1]]);
      assert.deepEqual(fact!.related_dir_ids, [roleCodeDir(legalCode)]);
      assert.ok(out.decision_context!.version > vBefore);
      console.log(
        `[m24r2k] code=${legalCode}; fact=${fact!.fact_id}:${fact!.status}:${fact!.verification_level}:${(fact!.fact_roles ?? []).join(",")}:${(fact!.related_dir_ids ?? []).join(",")}; dc=${vBefore}->${out.decision_context!.version}`,
      );
    });

    await check("M2.4-R2-FU1 Case L: explicit is kept as user_asserted and not confirmed", async () => {
      const before = await seedAnswerReadySession("m24r2l");
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case L needs a legal authorized role code");
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前月薪三万。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "explicit fact",
      };
      stubResponse = "R2L FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const fact = out.decision_context!.reality_facts.find((f) => f.statement.includes("月薪三万"));
      assert.ok(fact, "explicit fact missing");
      assert.equal(fact!.status, "unverified");
      assert.equal(fact!.verification_level, "user_asserted");
      assert.notEqual(fact!.status, "confirmed");
      assert.equal(fact!.user_confirmed, false);
      assert.ok(fact!.has_user_confirm_event !== true);
      assert.deepEqual(fact!.fact_roles, [legalCode.split("/role/")[1]]);
      assert.deepEqual(fact!.related_dir_ids, [roleCodeDir(legalCode)]);
      assert.ok(out.decision_context!.version > vBefore);
      console.log(
        `[m24r2l] code=${legalCode}; fact=${fact!.fact_id}:${fact!.status}:${fact!.verification_level}:confirmed=${fact!.status === "confirmed"}:user_confirmed=${fact!.user_confirmed}:${(fact!.fact_roles ?? []).join(",")}:${(fact!.related_dir_ids ?? []).join(",")}; dc=${vBefore}->${out.decision_context!.version}`,
      );
    });

    await check("M2.4-R2-FU1 Case M: constraint certainty semantics", async () => {
      const variants: Array<{
        tag: string;
        certainty: "explicit" | "estimated" | "unclear";
        text: string;
      }> = [
        { tag: "m24r2m_explicit", certainty: "explicit", text: "硬约束是必须保留社保。" },
        { tag: "m24r2m_estimated", certainty: "estimated", text: "估计必须保留社保。" },
        { tag: "m24r2m_unclear", certainty: "unclear", text: "可能有必须保留社保的约束。" },
      ];
      for (const item of variants) {
        const before = await seedAnswerReadySession(item.tag);
        const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
        assert.ok(legalCode, `${item.tag} needs a legal authorized role code`);
        const vBefore = before.decision_context!.version;
        const factsBefore = before.decision_context!.reality_facts.length;
        const cstBefore = before.decision_context!.constraints.length;
        const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
          classification: "partial_answer",
          extracted_items: [
            {
              text: item.text,
              semantic_kind: "constraint",
              role_hint: null,
              role_code_hint: legalCode,
              certainty: item.certainty,
            },
          ],
          unresolved_aspects: [],
          explanation: `constraint ${item.certainty}`,
        };
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes(item.text.replace(/。$/, "")) || c.statement === item.text);
        const companion = dc.reality_facts.find(
          (f) => f.statement.includes(item.text.replace(/。$/, "")) || f.statement === item.text,
        );
        const probe = answerEventFromModelDraft({
          session: before,
          statement: item.text,
          source_turn_id: `probe_${item.tag}`,
          draft,
        });
        if (item.certainty === "explicit") {
          assert.ok(cst, "explicit constraint missing");
          assert.ok(companion, "explicit companion RealityFact missing");
          assert.equal(cst!.status, "unverified");
          assert.equal(cst!.verification_level, "user_asserted");
          assert.equal(companion!.status, "unverified");
          assert.equal(companion!.verification_level, "user_asserted");
          assert.deepEqual(companion!.fact_roles, [legalCode.split("/role/")[1]]);
          assert.deepEqual(companion!.related_dir_ids, [roleCodeDir(legalCode)]);
          assert.deepEqual(cst!.related_dir_ids, [roleCodeDir(legalCode)]);
          assert.equal(cst!.verification_level, companion!.verification_level);
          assert.ok(dc.version > vBefore);
        } else if (item.certainty === "estimated") {
          // applyAnswerEventToSessionDc hardcodes Constraint verification_level
          // to user_asserted; estimated Constraint is not legally persistable
          // on this path, so FU1 fail-closes to unresolved (no disguise).
          assert.equal(cst, undefined, "estimated constraint must not persist as user_asserted");
          assert.equal(companion, undefined, "estimated constraint must not write a mismatched companion");
          assert.equal(dc.version, vBefore);
          assert.equal(dc.reality_facts.length, factsBefore);
          assert.equal(dc.constraints.length, cstBefore);
          assert.equal(probe.proposed_writes.length, 0);
          assert.ok(
            probe.notes.some((n) => n.includes("estimated_constraint_not_persistable")),
            `estimated constraint must stay unresolved, notes=${probe.notes.join("|")}`,
          );
        } else {
          assert.equal(cst, undefined, "unclear must not write a Constraint");
          assert.equal(companion, undefined, "unclear must not write a companion RealityFact");
          assert.equal(dc.version, vBefore);
          assert.equal(dc.reality_facts.length, factsBefore);
          assert.equal(dc.constraints.length, cstBefore);
          assert.equal(probe.proposed_writes.length, 0);
          assert.ok(
            probe.notes.some((n) => n.includes("unclear_certainty")),
            `unclear constraint must stay unresolved, notes=${probe.notes.join("|")}`,
          );
        }
        console.log(
          `[m24r2m] tag=${item.tag}; certainty=${item.certainty}; code=${legalCode}; cst=${cst ? `${cst.constraint_id}:${cst.status}:${cst.verification_level}:${(cst.related_dir_ids ?? []).join(",")}` : "none"}; companion=${companion ? `${companion.fact_id}:${companion.status}:${companion.verification_level}:${(companion.fact_roles ?? []).join(",")}:${(companion.related_dir_ids ?? []).join(",")}` : "none"}; same_level=${cst && companion ? cst.verification_level === companion.verification_level : "n/a"}; same_dir=${cst && companion ? JSON.stringify(cst.related_dir_ids) === JSON.stringify(companion.related_dir_ids) : "n/a"}; dc=${vBefore}->${dc.version}; notes=${probe.notes.join(",")}`,
        );
      }
    });

