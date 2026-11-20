from pathlib import Path

path = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
s = path.read_text(encoding="utf-8")

# Strengthen static assert for reuse provenance
old_static = """      assert.match(mod, /require_confirmation_turn_id/);
      assert.match(mod, /isEligibleForConfirmEvent/);"""
new_static = """      assert.match(mod, /require_confirmation_turn_id/);
      assert.match(mod, /reuseProvenanceCtx/);
      assert.match(mod, /assertConfirmationEventProvenance\\(reuseProvenanceCtx/);
      assert.match(mod, /eventsForAuthority/);
      assert.match(mod, /isEligibleForConfirmEvent/);"""
if old_static not in s:
    raise SystemExit("static assert block not found")
s = s.replace(old_static, new_static, 1)
print("static assert updated")

# Insert C12/C13 before the blank lines after C11 (before E2E section).
# Find the end of C11 by locating the unique closing after C11.
marker = """    await check(\"M21-C11 first event ok then later provenance fail"""
idx = s.find(marker)
if idx < 0:
    raise SystemExit("C11 marker not found")
# Find the closing of this check: next "    await check(" after C11 body, or the E2E section
# Look for the pattern after C11 ends - typically blank lines then another check or comment
rest = s[idx:]
# Find end of C11 check callback - the "    });\n\n" after the before JSON assert
# Search for next await check after C11
next_check_rel = rest.find("\n    await check(", 10)
if next_check_rel < 0:
    # maybe E2E uses different spacing - find after C11's closing
    next_check_rel = rest.find("\n\n    await check(", 10)
if next_check_rel < 0:
    raise SystemExit("could not find next check after C11")

insert_at = idx + next_check_rel
# Verify we're at a boundary after C11 closed
print("insert boundary snippet:", repr(s[insert_at:insert_at+80]))

c12 = r'''

    await check("M21-C12 reuse existing event with forged confirmation_turn_id → fail-closed", async () => {
      async function runForgedConfirmTurn(kind: "missing" | "assistant") {
        const session0 = await craftReadySession({
          payment_id: `pay_m21_c12_${kind}`,
          facts: [
            buildRealityFact({
              fact_id: "fact_reuse_bad",
              statement: "复用路径伪造确认轮次",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "turn_asserted",
              fact_roles: ["option"],
              related_dir_ids: ["dir_options"],
            }),
            buildRealityFact({
              fact_id: "fact_reuse_peer",
              statement: "同伴",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "turn_asserted",
              fact_roles: ["status_quo"],
              related_dir_ids: ["dir_status_quo"],
            }),
            buildRealityFact({
              fact_id: "fact_reuse_peer2",
              statement: "同伴2",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "turn_constraint",
              fact_roles: ["hard_constraint"],
              related_dir_ids: ["dir_hard_constraint"],
            }),
          ],
        });
        const forgedConfirmTurn =
          kind === "missing" ? "turn_confirm_forged_missing" : "turn_assistant_bogus";
        const withAssistantMsg =
          kind === "assistant"
            ? [
                ...session0.messages,
                {
                  role: "assistant" as const,
                  content: "assistant should not be confirm authority",
                  timestamp: nowIso,
                  client_id: "turn_assistant_bogus",
                },
              ]
            : session0.messages;
        const forgedEvent = {
          event_id: `fact_confirm_event_reuse_forged_${kind}`,
          target_type: "fact" as const,
          fact_id: "fact_reuse_bad",
          source_turn_id: "turn_asserted",
          confirmation_turn_id: forgedConfirmTurn,
          confirmation_action_id: `m21_final_confirm_fact_fact_reuse_bad__turn_asserted_${kind}`,
          event_type: "confirm_fact" as const,
          actor: "user" as const,
          confirmed_at: nowIso,
          event_version: 1 as const,
        };
        const poisoned: typeof session0 = {
          ...session0,
          messages: withAssistantMsg,
          confirmation_events: [forgedEvent],
        };
        await savePOJUSession(poisoned);
        const session = await durable(poisoned.session_id);
        const before = JSON.stringify({
          dc: session.decision_context,
          events: session.confirmation_events ?? [],
          frozen: session.decision_context?.status,
        });
        const result = await confirmUnderstandingAndFreeze({
          session,
          statement: "确认",
          confirmation_turn_id: "turn_confirm",
          now: nowIso,
        });
        assert.equal(result.outcome, "promote_failed", `kind=${kind}`);
        assert.match(result.error ?? "", /confirmation_turn_id/);
        assert.equal(result.promoted_fact_ids.length, 0);
        assert.notEqual(result.outcome, "frozen");
        const out = result.session.decision_context!.reality_facts.find(
          (f) => f.fact_id === "fact_reuse_bad",
        )!;
        assert.equal(out.user_confirmed, false, `kind=${kind} must not derive user_confirmed`);
        assert.equal(out.status, "unverified", `kind=${kind} must not promote`);
        assert.equal(result.session.decision_context!.status, "draft");
        assert.equal(
          JSON.stringify({
            dc: result.session.decision_context,
            events: result.session.confirmation_events ?? [],
            frozen: result.session.decision_context?.status,
          }),
          before,
          `kind=${kind} must leave session unchanged`,
        );
      }
      await runForgedConfirmTurn("missing");
      await runForgedConfirmTurn("assistant");
    });

    await check("M21-C13 reuse prior legitimate confirmation_turn_id (not this turn) allowed", async () => {
      const session0 = await craftReadySession({
        payment_id: "pay_m21_c13",
        facts: [
          buildRealityFact({
            fact_id: "fact_prior_ok",
            statement: "先前合法确认可复用",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
          buildRealityFact({
            fact_id: "fact_prior_peer",
            statement: "同伴",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["status_quo"],
            related_dir_ids: ["dir_status_quo"],
          }),
          buildRealityFact({
            fact_id: "fact_prior_peer2",
            statement: "同伴2",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_constraint",
            fact_roles: ["hard_constraint"],
            related_dir_ids: ["dir_hard_constraint"],
          }),
        ],
      });
      const withPrior: typeof session0 = {
        ...session0,
        messages: [
          ...session0.messages,
          {
            role: "user" as const,
            content: "先前确认",
            timestamp: nowIso,
            client_id: "turn_confirm_prior",
          },
        ],
        confirmation_events: [
          {
            event_id: "fact_confirm_event_prior_legit",
            target_type: "fact" as const,
            fact_id: "fact_prior_ok",
            source_turn_id: "turn_asserted",
            confirmation_turn_id: "turn_confirm_prior",
            confirmation_action_id: "m21_final_confirm_fact_fact_prior_ok__turn_asserted",
            event_type: "confirm_fact" as const,
            actor: "user" as const,
            confirmed_at: nowIso,
            event_version: 1 as const,
          },
        ],
      };
      await savePOJUSession(withPrior);
      const session = await durable(withPrior.session_id);
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      assert.notEqual(result.outcome, "promote_failed");
      const out = result.session.decision_context!.reality_facts.find(
        (f) => f.fact_id === "fact_prior_ok",
      )!;
      assert.equal(out.user_confirmed, true);
      assert.equal(out.status, "confirmed");
      // Prior event reused — no second event required for same target+source.
      const matching = (result.session.confirmation_events ?? []).filter(
        (e) =>
          e.target_type === "fact" &&
          e.fact_id === "fact_prior_ok" &&
          e.source_turn_id === "turn_asserted",
      );
      assert.equal(matching.length, 1);
      assert.equal(matching[0]!.confirmation_turn_id, "turn_confirm_prior");
    });
'''

# Normalize newlines in c12 to match file
if "\r\n" in s:
    c12 = c12.replace("\n", "\r\n")

s = s[:insert_at] + c12 + s[insert_at:]
path.write_text(s, encoding="utf-8", newline="")
print("tests patched OK, len", len(s))