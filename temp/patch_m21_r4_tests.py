from pathlib import Path

path = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
s = path.read_text(encoding="utf-8")

old_static = '''      assert.match(mod, /reuseProvenanceCtx/);
      assert.match(mod, /assertConfirmationEventProvenance\\(reuseProvenanceCtx/);
      assert.match(mod, /eventsForAuthority/);'''

new_static = '''      assert.match(mod, /reuseProvenanceCtx/);
      assert.match(mod, /assertAuthoritativeConfirmationEvent\\(reuseProvenanceCtx/);
      assert.match(mod, /assertAuthoritativeConfirmationEvent/);
      assert.match(mod, /eventsForAuthority/);
      // R4: authority gate must call structure validate before provenance.
      const ceSrc = readFileSync(
        join(process.cwd(), "lib/poju/decision-context/confirmation-event.ts"),
        "utf8",
      );
      assert.match(ceSrc, /export function assertAuthoritativeConfirmationEvent/);
      assert.match(
        ceSrc,
        /assertAuthoritativeConfirmationEvent[\\s\\S]*?validateConfirmationEvent\\([\\s\\S]*?assertConfirmationEventProvenance/,
      );'''

if old_static not in s:
    raise SystemExit("static asserts not found")
s = s.replace(old_static, new_static, 1)

# Insert C14 before M21-01
marker = '''    await check("M21-01 fresh session'''
# Find exact marker line
idx = s.find('await check("M21-01 fresh session')
if idx < 0:
    raise SystemExit("M21-01 marker not found")

c14 = r'''    await check("M21-C14 reuse structurally illegal existing event → fail-closed", async () => {
      async function runIllegalStructure(kind: "bad_actor" | "bad_event_type") {
        const session0 = await craftReadySession({
          payment_id: `pay_m21_c14_${kind}`,
          facts: [
            buildRealityFact({
              fact_id: "fact_struct_bad",
              statement: "结构非法旧事件不可复用",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "turn_asserted",
              fact_roles: ["option"],
              related_dir_ids: ["dir_options"],
            }),
            buildRealityFact({
              fact_id: "fact_struct_peer",
              statement: "同伴",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "turn_asserted",
              fact_roles: ["status_quo"],
              related_dir_ids: ["dir_status_quo"],
            }),
            buildRealityFact({
              fact_id: "fact_struct_peer2",
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
        // Target + source + confirmation_turn are all legitimate; only structure is illegal.
        const illegalEvent =
          kind === "bad_actor"
            ? {
                event_id: "fact_confirm_event_struct_bad_actor",
                target_type: "fact" as const,
                fact_id: "fact_struct_bad",
                source_turn_id: "turn_asserted",
                confirmation_turn_id: "turn_confirm_prior",
                confirmation_action_id:
                  "m21_final_confirm_fact_fact_struct_bad__turn_asserted_actor",
                event_type: "confirm_fact" as const,
                actor: "system" as const,
                confirmed_at: nowIso,
                event_version: 1 as const,
              }
            : {
                event_id: "fact_confirm_event_struct_bad_type",
                target_type: "fact" as const,
                fact_id: "fact_struct_bad",
                source_turn_id: "turn_asserted",
                confirmation_turn_id: "turn_confirm_prior",
                confirmation_action_id:
                  "m21_final_confirm_fact_fact_struct_bad__turn_asserted_type",
                // event_type inconsistent with target_type fact
                event_type: "confirm_constraint" as const,
                actor: "user" as const,
                confirmed_at: nowIso,
                event_version: 1 as const,
              };
        const poisoned: typeof session0 = {
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
          // Cast: intentionally inject structurally illegal payload past the typed store.
          confirmation_events: [illegalEvent as unknown as (typeof session0.confirmation_events extends (infer E)[] | null | undefined ? E : never)],
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
        if (kind === "bad_actor") {
          assert.match(result.error ?? "", /actor must be user/);
        } else {
          assert.match(result.error ?? "", /event_type must match target_type/);
        }
        assert.equal(result.promoted_fact_ids.length, 0);
        assert.notEqual(result.outcome, "frozen");
        const out = result.session.decision_context!.reality_facts.find(
          (f) => f.fact_id === "fact_struct_bad",
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
      await runIllegalStructure("bad_actor");
      await runIllegalStructure("bad_event_type");
    });

    '''

# Simpler cast for confirmation_events to avoid complex conditional type
c14 = c14.replace(
    "confirmation_events: [illegalEvent as unknown as (typeof session0.confirmation_events extends (infer E)[] | null | undefined ? E : never)],",
    "confirmation_events: [illegalEvent as never],",
)

s = s[:idx] + c14 + s[idx:]
path.write_text(s, encoding="utf-8")
print("OK tests: static + C14")
print("C14 present:", 'M21-C14 reuse structurally illegal' in path.read_text(encoding='utf-8'))
