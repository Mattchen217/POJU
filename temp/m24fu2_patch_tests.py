# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
text = path.read_text(encoding="utf-8")

old_header = """ * M2.4-R1-FU1: role authorization, conservative conflicts, Cases I–M + G/H."""
new_header = """ * M2.4-R1-FU1: role authorization, conservative conflicts, Cases I–M + G/H.
 * M2.4-R1-FU2: formal Conflict Resolution wired into the production answer path (Cases N–T)."""
if old_header not in text:
    raise SystemExit("header not found")
text = text.replace(old_header, new_header, 1)

# ---- Case G: honest update after wiring ----
old_g_note = """      // Turn 3: clarification answer via real handleUserMessage.
      // NOTE: formal Conflict Resolution (`clarifyConflict` in conflict-lifecycle.ts)
      // is NOT wired into applyAnswerEventToSessionDc / runAdaptiveQuestionTurn /
      // handleUserMessage. Do not forge Conflict.state=resolved/clarified here.
      const factsBefore = new Set(
        (s.decision_context?.reality_facts ?? []).map((f) => f.fact_id),
      );
      const openBefore = (s.decision_context?.conflicts ?? []).filter((c) => c.state === "open").length;
      s = await handleUserMessage({
        session: s,
        userMessage: \"澄清：创业选项是真实的，留任不是唯一选项。\",
        locale: \"zh-CN\",
      });
      await savePOJUSession(s);
      const dc3 = s.decision_context!;
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === \"fact_g_old\"), \"old fact kept\");
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === \"fact_g_new\"), \"prior conflict fact kept\");
      const added = dc3.reality_facts.filter((f) => !factsBefore.has(f.fact_id));
      assert.ok(added.length >= 1, \"clarification fact must be appended via production chain\");
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, dc3.context_id);
        assert.equal(s.decision_understanding.context_version, dc3.version);
      }
      const openAfter = dc3.conflicts.filter((c) => c.state === \"open\");
      // Honest: without production clarifyConflict wiring, open Conflict remains.
      assert.ok(openAfter.length >= openBefore, \"must not forge auto-resolve; open conflicts remain\");
      assert.equal(
        (s.decision_understanding?.understood.items ?? []).some((i) => i.dir_id === dirId),
        false,
        \"unresolved conflict DIR must not enter Understood\",
      );
      console.log(
        `[m24g] conflict_briefs=${u.current_understanding.conflict_briefs.length}; gap=${need && need.kind===\"dir_based\"?need.gap_type:\"?\"}; clarifyQ=${(turn.authorized_question ?? \"\").slice(0,80)}; last_roles=${(lastSent?.fact_role_codes ?? []).join(\",\")}; added=${added.length}; open_after=${openAfter.length}; blocker=clarifyConflict_not_wired_into_answer_path`,
      );"""

new_g_note = """      // Turn 3: non-explicit clarification wording via real handleUserMessage.
      // Formal clarifyConflict is now wired, but this wording is not an explicit
      // choice of fact 1 or 2, so the Conflict must stay open (Cases N–T cover close).
      assert.ok(
        lastSent!.conflict_clarification &&
          lastSent!.conflict_clarification.conflict_id === \"cf_g_open\",
        \"last_sent_question must bind the open Conflict\",
      );
      const factsBefore = new Set(
        (s.decision_context?.reality_facts ?? []).map((f) => f.fact_id),
      );
      const openBefore = (s.decision_context?.conflicts ?? []).filter((c) => c.state === \"open\").length;
      const vBeforeG = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: \"澄清：创业选项是真实的，留任不是唯一选项。\",
        locale: \"zh-CN\",
      });
      await savePOJUSession(s);
      s = await durable(sid);
      const dc3 = s.decision_context!;
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === \"fact_g_old\"), \"old fact kept\");
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === \"fact_g_new\"), \"prior conflict fact kept\");
      const added = dc3.reality_facts.filter((f) => !factsBefore.has(f.fact_id));
      assert.equal(added.length, 0, \"ambiguous clarification must not append a new RealityFact\");
      assert.equal(dc3.version, vBeforeG, \"ambiguous clarification must not bump DC version\");
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, dc3.context_id);
        assert.equal(s.decision_understanding.context_version, dc3.version);
      }
      const openAfter = dc3.conflicts.filter((c) => c.state === \"open\");
      assert.equal(openAfter.length, openBefore, \"non-explicit choice must leave Conflict open\");
      const gHit = openAfter.find((c) => c.conflict_id === \"cf_g_open\");
      assert.ok(gHit);
      assert.equal(gHit!.user_confirmation, false);
      assert.equal(gHit!.resolution, null);
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.ok(nextTarget, \"next question must still target the same Conflict\");
      assert.equal(nextTarget!.conflict_id, \"cf_g_open\");
      assert.equal(
        (s.decision_understanding?.understood.items ?? []).some((i) => i.dir_id === dirId),
        false,
        \"unresolved conflict DIR must not enter Understood\",
      );
      console.log(
        `[m24g] conflict_briefs=${u.current_understanding.conflict_briefs.length}; gap=${need && need.kind===\"dir_based\"?need.gap_type:\"?\"}; clarifyQ=${(turn.authorized_question ?? \"\").slice(0,80)}; last_roles=${(lastSent?.fact_role_codes ?? []).join(\",\")}; added=${added.length}; open_after=${openAfter.length}; path=wired_ambiguous; next_cf=${nextTarget!.conflict_id}`,
      );"""

# The Case G user message in the file may have a period / encoding; locate by unique ASCII anchors.
g_start = text.find("      // Turn 3: clarification answer via real handleUserMessage.")
g_end = text.find('        `[m24g] conflict_briefs=', g_start)
if g_start < 0 or g_end < 0:
    raise SystemExit(f"Case G anchors not found start={g_start} end={g_end}")
g_end = text.find("      );\n", g_end) + len("      );\n")
old_g_actual = text[g_start:g_end]
# Use the actual userMessage from the file when building new_g
import re
um = re.search(r'userMessage: "([^"]*)"', old_g_actual)
if not um:
    raise SystemExit("Case G userMessage not found")
user_g = um.group(1)
new_g = new_g_note.replace("澄清：创业选项是真实的，留任不是唯一选项。", user_g)
text = text[:g_start] + new_g + text[g_end:]

cases = r'''
    const { openConflict, markOpenConflictsUnresolvedInFinal } = await import(
      "../lib/poju/decision-context/conflict-lifecycle"
    );
    const { reaggregateDirsOnSession } = await import(
      "../lib/poju/decision-context/na-validation-from-session"
    );
    type RealityFact = import("../lib/poju/decision-context/types").RealityFact;
    type Conflict = import("../lib/poju/decision-context/types").Conflict;

    function makeFact(input: {
      fact_id: string;
      statement: string;
      dir_id: string;
      role: string;
      source_turn_id: string;
      status?: RealityFact["status"];
    }): RealityFact {
      return {
        fact_id: input.fact_id,
        statement: input.statement,
        status: input.status ?? "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: input.source_turn_id,
        user_confirmed: false,
        fact_roles: [input.role],
        related_dir_ids: [input.dir_id],
        updated_at: NOW,
      };
    }

    async function persistFactsAndConflicts(
      sid: string,
      facts: RealityFact[],
      conflicts: Conflict[],
      op: string,
    ): Promise<POJUSessionState> {
      const s0 = await durable(sid);
      const reality_facts = [...s0.decision_context!.reality_facts, ...facts];
      const allConflicts = [...s0.decision_context!.conflicts, ...conflicts];
      const dirs = await reaggregateDirsOnSession(s0, s0.decision_context!.dirs, {
        realityFacts: reality_facts,
        conflicts: allConflicts,
        nowIso: NOW,
      });
      const next: POJUSessionState = {
        ...s0,
        decision_context: {
          ...s0.decision_context!,
          reality_facts,
          conflicts: allConflicts,
          dirs,
          version: (s0.decision_context!.version ?? 1) + 1,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: op,
        kind: "session_patch",
        bump_dc: true,
        apply: () => next,
      });
      return durable(sid);
    }

    async function emitAndAttachClarification(sid: string, tag: string) {
      const turn = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: `plan_${tag}`,
        now: NOW,
        init_only: true,
      });
      assert.ok(turn.plan && turn.authorized_question, `${tag} must emit a plan`);
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      const attached = attachAuthorizedAssistantQuestion(
        turn.session,
        turn.plan!,
        `ask_${tag}`,
      );
      await mutatePOJUSession(sid, {
        operation_id: `op_${tag}_attach`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => attached,
      });
      const s = await durable(sid);
      return { s, turn, plan: turn.plan!, q: turn.authorized_question! };
    }

    async function seedSameDirConflict(tag: string) {
      const { sid } = await withAuthorizedAsk(tag, jobDirs);
      const dirId = "DIR-OPT-ON-TABLE";
      const factA = makeFact({
        fact_id: `fact_${tag}_a`,
        statement: "目前只有留任一条路",
        dir_id: dirId,
        role: "option",
        source_turn_id: `${tag}_a`,
      });
      const factB = makeFact({
        fact_id: `fact_${tag}_b`,
        statement: "其实还有外部 offer 可选",
        dir_id: dirId,
        role: "option",
        source_turn_id: `${tag}_b`,
      });
      const conflict = openConflict({
        fact_ids: [factA.fact_id, factB.fact_id],
        conflict_field: "statement",
        facts: [factA, factB],
        now: NOW,
      });
      await persistFactsAndConflicts(
        sid,
        [factA, factB],
        [conflict],
        `op_${tag}_seed`,
      );
      const emitted = await emitAndAttachClarification(sid, tag);
      const last = emitted.s.decision_understanding?.last_sent_question;
      assert.ok(last?.conflict_clarification, `${tag} last_sent must bind conflict`);
      assert.equal(last!.conflict_clarification!.conflict_id, conflict.conflict_id);
      assert.deepEqual(last!.conflict_clarification!.fact_ids, [
        factA.fact_id,
        factB.fact_id,
      ]);
      assert.match(emitted.q, /请明确选择哪一条准确/);
      return { sid, dirId, factA, factB, conflict, ...emitted };
    }

    await check("M2.4-R1-FU2 unknown/declined old fact must not create Conflict", async () => {
      for (const status of ["unknown", "declined"] as const) {
        const { sid } = await withAuthorizedAsk(`m24ud_${status}`, jobDirs);
        let s = await durable(sid);
        const last = s.decision_understanding!.last_sent_question!;
        const dirId = last.dir_ids[0]!;
        const roleCode = (last.fact_role_codes ?? [])[0] ?? "";
        const role = roleCode.includes("/role/")
          ? roleCode.split("/role/").pop()!
          : "option";
        const old = makeFact({
          fact_id: `fact_ud_${status}`,
          statement: "目前没有其他工作收入",
          dir_id: dirId,
          role,
          source_turn_id: `seed_ud_${status}`,
          status,
        });
        s = await persistFactsAndConflicts(sid, [old], [], `op_ud_${status}_seed`);
        const contra = interpretUserAnswer({
          session: s,
          statement: "之前说的不准确，我实际上还有一份固定兼职收入",
          source_turn_id: `turn_ud_${status}`,
        });
        const applied = await applyAnswerEventToSessionDc(s, contra, { now: NOW });
        assert.equal(applied.applied, true, `${status} new answer should still write`);
        const dc = applied.session.decision_context!;
        const open = dc.conflicts.filter((c) => c.state === "open");
        assert.equal(open.length, 0, `${status} old fact must not be opposing evidence`);
        console.log(
          `[m24ud] status=${status}; cls=${contra.classification}; open=${open.length}; facts=${dc.reality_facts.length}`,
        );
      }
    });

    await check("M2.4-R1-FU2 Case N: explicit choice of the first fact", async () => {
      const seeded = await seedSameDirConflict("m24n");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id);
      assert.ok(hit, "conflict must still exist");
      assert.equal(hit!.state, "clarified");
      assert.equal(hit!.user_confirmation, true);
      assert.ok(hit!.resolution, "resolution required");
      const res = JSON.parse(hit!.resolution!) as {
        selected_fact_id?: string;
        source_turn_id?: string;
      };
      assert.equal(res.selected_fact_id, seeded.factA.fact_id);
      assert.equal(res.source_turn_id, lastUserId(s));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id), "fact A kept");
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id), "fact B kept");
      assert.equal(dc.reality_facts.length, factCountBefore, "must not invent a new RealityFact");
      assert.equal(dc.version, vBefore + 1);
      const briefs = s.decision_understanding?.current_understanding.conflict_briefs ?? [];
      assert.equal(
        briefs.some((b) => b.includes(seeded.conflict.conflict_id)),
        false,
        "Understanding must not treat clarified Conflict as open",
      );
      assert.equal(
        dc.conflicts.filter((c) => c.state === "open" && c.conflict_id === seeded.conflict.conflict_id).length,
        0,
      );
      console.log(
        `[m24n] cf=${hit!.conflict_id}; facts=${seeded.factA.fact_id},${seeded.factB.fact_id}; state=${hit!.state}; confirm=${hit!.user_confirmation}; selected=${res.selected_fact_id}; turn=${res.source_turn_id}; dc=${vBefore}->${dc.version}; fact_count=${dc.reality_facts.length}; briefs=${briefs.length}`,
      );
    });

    await check("M2.4-R1-FU2 Case O: explicit choice of the second fact", async () => {
      const seeded = await seedSameDirConflict("m24o");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "第二条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "clarified");
      assert.equal(hit.user_confirmation, true);
      const res = JSON.parse(hit.resolution!) as { selected_fact_id?: string; source_turn_id?: string };
      assert.equal(res.selected_fact_id, seeded.factB.fact_id, "must select the second fact, not the first or newest by default");
      assert.notEqual(res.selected_fact_id, seeded.factA.fact_id);
      assert.equal(res.source_turn_id, lastUserId(s));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id));
      assert.equal(dc.version, vBefore + 1);
      console.log(
        `[m24o] cf=${hit.conflict_id}; selected=${res.selected_fact_id}; expected_second=${seeded.factB.fact_id}; first=${seeded.factA.fact_id}; confirm=${hit.user_confirmation}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R1-FU2 Case P: vague answer must not close Conflict", async () => {
      const seeded = await seedSameDirConflict("m24p");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      s = await handleUserMessage({
        session: s,
        userMessage: "不太确定",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.equal(dc.reality_facts.length, factCountBefore, "must not add a RealityFact");
      assert.equal(dc.version, vBefore, "must not bump DC version");
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.ok(nextTarget, "next question must still target the same Conflict");
      assert.equal(nextTarget!.conflict_id, seeded.conflict.conflict_id);
      assert.deepEqual(nextTarget!.fact_ids, [seeded.factA.fact_id, seeded.factB.fact_id]);
      console.log(
        `[m24p] cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; next_cf=${nextTarget!.conflict_id}`,
      );
    });

    await check("M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close", async () => {
      const seeded = await seedSameDirConflict("m24q");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factIdsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      s = await handleUserMessage({
        session: s,
        userMessage: "两条都不准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.deepEqual(
        dc.reality_facts.map((f) => f.fact_id).sort(),
        factIdsBefore,
        "must not delete or add facts",
      );
      assert.equal(dc.version, vBefore);
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.equal(nextTarget?.conflict_id, seeded.conflict.conflict_id);
      console.log(
        `[m24q] cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent", async () => {
      const seeded = await seedSameDirConflict("m24r");
      let s = seeded.s;
      const vSeed = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const turnId = lastUserId(s);
      const dc1 = s.decision_context!;
      const vAfter = dc1.version;
      const asked1 = s.decision_understanding?.budget.session_asked_count ?? 0;
      const clarified1 = dc1.conflicts.filter((c) => c.state === "clarified");
      const resolution1 = clarified1[0]?.resolution ?? null;
      assert.equal(vAfter, vSeed + 1);
      assert.equal(clarified1.length, 1);
      const replay = await runCollectingDcTurn(s, {
        statement: "第一条准确",
        source_turn_id: turnId,
        now: NOW,
      });
      const dc2 = replay.session.decision_context!;
      const asked2 = replay.session.decision_understanding?.budget.session_asked_count ?? asked1;
      const clarified2 = dc2.conflicts.filter((c) => c.state === "clarified");
      assert.equal(dc2.version, vAfter, "replay must not bump DC version again");
      assert.equal(clarified2.length, 1, "must not create a duplicate clarified record");
      assert.equal(clarified2[0]!.conflict_id, clarified1[0]!.conflict_id);
      assert.equal(clarified2[0]!.resolution, resolution1);
      assert.equal(asked2, asked1, "must not consume another real question budget");
      console.log(
        `[m24r] turn=${turnId}; outcome=${replay.outcome}; persist=${replay.persist_error}; dc=${vSeed}->${vAfter}->${dc2.version}; asked=${asked1}->${asked2}; clarified=${clarified2.length}; key_skip=${String(replay.persist_error ?? "")}`,
      );
    });

    await check("M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op", async () => {
      const seeded = await seedSameDirConflict("m24s");
      let s = seeded.s;
      const lastTarget = s.decision_understanding!.last_sent_question!.conflict_clarification!;
      const closed = markOpenConflictsUnresolvedInFinal(s.decision_context!.conflicts, NOW);
      const stale = closed.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(stale.state, "unresolved_in_final");
      const vFixture = (s.decision_context!.version ?? 1) + 1;
      const fixture: POJUSessionState = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          conflicts: closed,
          version: vFixture,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(seeded.sid, {
        operation_id: "op_m24s_stale",
        kind: "session_patch",
        bump_dc: true,
        apply: () => fixture,
      });
      s = await durable(seeded.sid);
      assert.equal(
        s.decision_understanding?.last_sent_question?.conflict_clarification?.conflict_id,
        lastTarget.conflict_id,
        "sent clarification target must remain",
      );
      const factsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const otherBefore = s.decision_context!.conflicts.map((c) => ({
        id: c.conflict_id,
        state: c.state,
        resolution: c.resolution,
        confirmation: c.user_confirmation,
      }));
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "unresolved_in_final", "must not overwrite the new non-open state");
      assert.equal(hit.resolution, stale.resolution);
      assert.equal(hit.user_confirmation, stale.user_confirmation);
      assert.equal(dc.version, vFixture, "stale target must not bump DC version");
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), factsBefore);
      assert.equal(
        dc.conflicts.filter((c) => c.state === "clarified").length,
        0,
        "must not apply the answer to this or another Conflict via clarifyConflict",
      );
      console.log(
        `[m24s] cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; dc=${vFixture}->${dc.version}; target=${lastTarget.conflict_id}; persist=stale_conflict_target`,
      );
      void otherBefore;
    });

    await check("M2.4-R1-FU2 Case T: other DIR Conflict is untouched", async () => {
      const { sid } = await withAuthorizedAsk("m24t", jobDirs);
      const factA1 = makeFact({
        fact_id: "fact_t_opt_a",
        statement: "目前只有留任一条路",
        dir_id: "DIR-OPT-ON-TABLE",
        role: "option",
        source_turn_id: "t_opt_a",
      });
      const factA2 = makeFact({
        fact_id: "fact_t_opt_b",
        statement: "其实还有外部 offer 可选",
        dir_id: "DIR-OPT-ON-TABLE",
        role: "option",
        source_turn_id: "t_opt_b",
      });
      const factB1 = makeFact({
        fact_id: "fact_t_sq_a",
        statement: "我还在原公司任职",
        dir_id: "DIR-STATUS-QUO",
        role: "status_quo",
        source_turn_id: "t_sq_a",
      });
      const factB2 = makeFact({
        fact_id: "fact_t_sq_b",
        statement: "我已经从原公司离职",
        dir_id: "DIR-STATUS-QUO",
        role: "status_quo",
        source_turn_id: "t_sq_b",
      });
      const cOpt = openConflict({
        fact_ids: [factA1.fact_id, factA2.fact_id],
        conflict_field: "statement",
        facts: [factA1, factA2],
        now: NOW,
      });
      const cSq = openConflict({
        fact_ids: [factB1.fact_id, factB2.fact_id],
        conflict_field: "statement",
        facts: [factB1, factB2],
        now: NOW,
      });
      await persistFactsAndConflicts(
        sid,
        [factA1, factA2, factB1, factB2],
        [cOpt, cSq],
        "op_m24t_seed",
      );
      const emitted = await emitAndAttachClarification(sid, "m24t");
      const bound = emitted.s.decision_understanding?.last_sent_question?.conflict_clarification;
      assert.ok(bound, "one Conflict must be bound to the sent question");
      const otherId = bound!.conflict_id === cOpt.conflict_id ? cSq.conflict_id : cOpt.conflict_id;
      assert.ok(
        bound!.conflict_id === cOpt.conflict_id || bound!.conflict_id === cSq.conflict_id,
      );
      const otherBefore = emitted.s.decision_context!.conflicts.find((c) => c.conflict_id === otherId)!;
      const otherSnapshot = {
        state: otherBefore.state,
        fact_ids: [...otherBefore.fact_ids],
        source_refs: otherBefore.source_refs.map((r) => ({ ...r })),
        resolution: otherBefore.resolution,
        user_confirmation: otherBefore.user_confirmation,
      };
      let s = emitted.s;
      const vBefore = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(sid);
      const dc = s.decision_context!;
      const chosen = dc.conflicts.find((c) => c.conflict_id === bound!.conflict_id)!;
      const other = dc.conflicts.find((c) => c.conflict_id === otherId)!;
      assert.equal(chosen.state, "clarified");
      assert.equal(chosen.user_confirmation, true);
      const res = JSON.parse(chosen.resolution!) as { selected_fact_id?: string };
      assert.equal(res.selected_fact_id, bound!.fact_ids[0]);
      assert.equal(other.state, otherSnapshot.state);
      assert.deepEqual(other.fact_ids, otherSnapshot.fact_ids);
      assert.deepEqual(other.source_refs, otherSnapshot.source_refs);
      assert.equal(other.resolution, otherSnapshot.resolution);
      assert.equal(other.user_confirmation, otherSnapshot.user_confirmation);
      assert.equal(dc.version, vBefore + 1);
      console.log(
        `[m24t] bound=${bound!.conflict_id}; other=${otherId}; chosen=${chosen.state}; other_state=${other.state}; selected=${res.selected_fact_id}; dc=${vBefore}->${dc.version}; other_facts=${other.fact_ids.join(",")}; other_refs=${other.source_refs.length}`,
      );
    });

'''

anchor = "  } finally {\n    globalThis.fetch = originalFetch;\n  }"
if anchor not in text:
    raise SystemExit("finally anchor not found")
if "M2.4-R1-FU2 Case N:" not in text:
    text = text.replace(anchor, cases + "\n" + anchor, 1)

path.write_text(text, encoding="utf-8", newline="\n")
print("patched tests", path.stat().st_size)
print("Case N present", "M2.4-R1-FU2 Case N:" in text)
print("Case G blocker gone", "clarifyConflict_not_wired_into_answer_path" not in text)
