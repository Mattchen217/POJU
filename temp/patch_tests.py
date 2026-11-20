from pathlib import Path

p = Path(r"D:\POJU\pojulife\scripts\test-m2-3-decision-blueprint.ts")
text = p.read_text(encoding="utf-8")

# Update header comment
old_hdr = " *  M2.3-R1  Full DDR scope (P0+P1+P2) on Blueprint; seed vs schedule split; P1/P2 activation\n */"
new_hdr = (
    " *  M2.3-R1  Full DDR scope (P0+P1+P2) on Blueprint; seed vs schedule split; P1/P2 activation\n"
    " *  M2.3-R2  Production priority activation / Readiness ordering via runAdaptiveQuestionTurn\n"
    " */"
)
assert old_hdr in text, "header not found"
text = text.replace(old_hdr, new_hdr, 1)

# Add imports for runAdaptiveQuestionTurn + attachAuthorizedAssistantQuestion
old_imp = """  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
    activateNextBlueprintPriorityBand,
    gateClassForDirFromCatalog,
    buildUnderstandingState,
  } = await import(\"../lib/poju/decision-intake\");"""

new_imp = """  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
    activateNextBlueprintPriorityBand,
    gateClassForDirFromCatalog,
    buildUnderstandingState,
    runAdaptiveQuestionTurn,
    attachAuthorizedAssistantQuestion,
  } = await import(\"../lib/poju/decision-intake\");"""

assert old_imp in text, "imports not found"
text = text.replace(old_imp, new_imp, 1)

# Insert R2 tests before the finally block that restores fetch.
# Find the unique end of R1 test then `} finally {`
marker = "      console.log(\n        `    scope=${bp.dir_ids.length} seed=${seed.length} p0Ask=${plan0.gate_class} p1Cands=${p1Cands.length}`,\n      );\n    });\n\n  } finally {"
assert marker in text, "R1 end / finally marker not found"

r2_block = r'''      console.log(
        `    scope=${bp.dir_ids.length} seed=${seed.length} p0Ask=${plan0.gate_class} p1Cands=${p1Cands.length}`,
      );
    });

    // ---------- M2.3-R2 ----------
    /** Shared helper: P0 band ids (topic pack treated as P0 when page_07_emit). */
    function p0BandIds(bp: NonNullable<POJUSessionState["decision_blueprint"]>): string[] {
      const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
      assert.ok(ddrLoad.ok);
      return bp.dir_ids.filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        let band = g.gate_class;
        if (
          bp.page_07_emit &&
          bp.directions.some(
            (d) => d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(id),
          )
        ) {
          band = "P0";
        }
        return band === "P0";
      });
    }

    await check("M2.3-R2 Case A: P0 partial — no premature stop; stay in P0; P1 not activated", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2a",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);
      assert.ok(p0Ids.length >= 2, "need multiple P0 DIRs");

      // Partial coverage on all critical/P0 rows + collecting evidence — the stale
      // criticalCovered&&hasCollectingEvidence path used to early-stop here.
      const sampleFact = {
        fact_id: "f_r2a_partial",
        statement: "Partial collecting evidence for readiness early-stop probe",
        status: "unverified" as const,
        verification_level: "user_asserted" as const,
        source_stage: "collecting" as const,
        source_turn_id: "t_r2a",
        user_confirmed: false,
        fact_roles: ["option"] as string[],
        related_dir_ids: [p0Ids[0]!],
      };
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [...(s.decision_context!.reality_facts ?? []), sampleFact],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? {
                  ...d,
                  current_state: "unknown" as const,
                  partial_satisfaction: true,
                }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };
      // Ensure P1 not yet on DC
      assert.ok(
        !s.decision_context!.dirs.some((d) => d.dir_id === "DIR-VALIDATION-CAPACITY"),
        "precondition: P1 not on DC before turn",
      );

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2a_init",
        now,
        init_only: true,
      });
      assert.ok(turn.understanding, "understanding required");
      assert.equal(
        turn.understanding!.readiness.can_ask,
        true,
        `Readiness must not premature-stop; verdict=${turn.understanding!.readiness.verdict} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.ok(turn.plan, "must still plan a next question within unfinished P0");
      assert.equal(turn.plan!.gate_class, "P0", `next Q must stay in P0, got ${turn.plan!.gate_class}`);
      assert.ok(
        turn.plan!.dir_ids.some((id) => p0Ids.includes(id)),
        "authorized plan dirs must intersect unfinished P0",
      );
      // P1 must not activate while required P0 unfinished
      assert.ok(
        !turn.session.decision_context!.dirs.some(
          (d) => d.dir_id === "DIR-VALIDATION-CAPACITY" || d.dir_id === "DIR-OPT-IRREV",
        ),
        "P1 must not activate while P0 unfinished",
      );
      console.log(
        `    can_ask=${turn.understanding!.readiness.can_ask} gate=${turn.plan!.gate_class} reasons=${turn.understanding!.readiness.reasons.filter((r) => r.includes("p0_p1") || r.includes("open_blueprint")).join("|") || "n/a"}`,
      );
    });

    await check("M2.3-R2 Case B: P0 complete → production orchestrator activates P1 + plans P1", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2b",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);

      // Fixture: all P0 known. Do NOT bypass runAdaptiveQuestionTurn after this.
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2b_p0",
              statement: "P0 band fixture evidence",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2b",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const, partial_satisfaction: false }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };
      // Also mark any P0 Blueprint DIRs that might appear after ensure
      const ensured = ensureDecisionBlueprint(s, { now: new Date().toISOString() });
      s = ensured.session;
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
        },
      };
      assert.ok(
        !s.decision_context!.dirs.some((d) => d.dir_id === "DIR-VALIDATION-CAPACITY"),
        "precondition: P1 not yet on DC",
      );

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2b_init",
        now,
        init_only: true,
      });

      // P1 activated onto DC as unknown by production orchestrator
      const p1Val = turn.session.decision_context!.dirs.find(
        (d) => d.dir_id === "DIR-VALIDATION-CAPACITY",
      );
      const p1Irr = turn.session.decision_context!.dirs.find(
        (d) => d.dir_id === "DIR-OPT-IRREV",
      );
      assert.ok(p1Val, "P1 DIR-VALIDATION-CAPACITY must activate onto DC");
      assert.ok(p1Irr, "P1 DIR-OPT-IRREV must activate onto DC");
      assert.equal(p1Val!.current_state, "unknown");
      assert.equal(p1Irr!.current_state, "unknown");

      assert.ok(turn.understanding, "understanding required");
      assert.equal(
        turn.understanding!.context_version,
        turn.session.decision_context!.version,
        "Understanding must bind current DC version after activation",
      );
      assert.equal(
        turn.understanding!.readiness.can_ask,
        true,
        `Readiness must allow asking; verdict=${turn.understanding!.readiness.verdict}`,
      );
      assert.ok(turn.plan, "AQE must select a pending P1 plan");
      assert.equal(
        turn.plan!.gate_class,
        "P1",
        `plan must select P1, got ${turn.plan!.gate_class}`,
      );
      assert.ok(
        turn.plan!.dir_ids.some(
          (id) => id === "DIR-VALIDATION-CAPACITY" || id === "DIR-OPT-IRREV",
        ),
        "plan dirs must include pending P1",
      );
      assert.equal(turn.authorized_question, turn.plan!.question_text);

      // Simulate agent delivery: authorized question equals assistant message sent
      let delivered = attachAuthorizedAssistantQuestion(
        turn.session,
        turn.plan!,
        "t_r2b_ask",
      );
      delivered = {
        ...delivered,
        messages: [
          ...delivered.messages,
          {
            role: "assistant" as const,
            content: turn.authorized_question!,
            timestamp: now,
          },
        ],
      };
      const last = [...delivered.messages].reverse().find((m) => m.role === "assistant");
      assert.ok(last);
      assert.equal(last!.content, turn.authorized_question);
      assert.equal(
        delivered.decision_understanding!.last_sent_question?.question_text,
        turn.authorized_question,
      );
      console.log(
        `    P1 activated; plan=${turn.plan!.gate_class}; ctx_v=${turn.understanding!.context_version}; Q matched assistant`,
      );
    });

    await check("M2.3-R2 Case C: unfinished P1 stays in need_to_understand; Readiness continues", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2c",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2c_p0",
              statement: "P0 complete fixture for Case C",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2c",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2c_init",
        now,
        init_only: true,
      });
      assert.ok(turn.understanding);
      const u = turn.understanding!;
      const p1Need = u.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" || n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "unfinished P1 must remain in need_to_understand");
      assert.ok(
        !u.understood.items.some(
          (i) =>
            i.dir_id === "DIR-VALIDATION-CAPACITY" || i.dir_id === "DIR-OPT-IRREV",
        ),
        "unfinished P1 must not appear in understood",
      );
      assert.equal(u.readiness.can_ask, true, "Readiness must not terminate while P1 open and budget remains");
      assert.ok(
        u.budget.remaining_hard_budget > 0,
        "precondition: budget remains",
      );
      console.log(
        `    p1Need=${p1Need && p1Need.kind === "dir_based" ? p1Need.dir_id : "?"}; can_ask=${u.readiness.can_ask}; remaining=${u.budget.remaining_hard_budget}`,
      );
    });

  } finally {'''

text = text.replace(marker, r2_block, 1)

p.write_text(text, encoding="utf-8")
out = p.read_text(encoding="utf-8")
assert "M2.3-R2 Case A" in out
assert "M2.3-R2 Case B" in out
assert "M2.3-R2 Case C" in out
assert "runAdaptiveQuestionTurn" in out
print("tests patched OK")
