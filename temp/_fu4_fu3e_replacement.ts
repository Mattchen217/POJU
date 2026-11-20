    await check("M2.4-R2-FU3-E: refusal is auditable, not a fact, and survives reload", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3e");
      const pendingSession = ctx.out;
      const vBefore = pendingSession.decision_context!.version;
      const factsBefore = pendingSession.decision_context!.reality_facts.length;
      const cstBefore = pendingSession.decision_context!.constraints.length;
      const oldClarify = lastAssistant(pendingSession).content;
      stubResponse = "FU3E FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-E must not write a fact from refusal");
      assert.equal(dc.constraints.length, cstBefore, "FU3-E must not write a Constraint from refusal");
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU3-E must keep an auditable rejection record");
      assert.equal(pending!.status, "rejected");
      assert.equal(pending!.clarification_plan, null, "FU3-E must not keep a resendable clarification_plan");
      assert.ok(
        (pending!.rejected_items ?? []).some((item) => item.text.includes("我目前仍在职")),
        "FU3-E must record an auditable rejected item",
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, oldClarify, "FU3-E must not resend the old clarification plan");
      assert.equal(asst.content.includes("待澄清信息"), false, "FU3-E must not re-ask the refused item");
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content.includes("「理解确认」"), false, "FU3-E refusal must not trigger readiness confirm");
      // Honest FU4 change: after terminal refusal processing, a new legal NeedItem may be sent.
      // This no longer requires the session to remain stuck on the refused clarification.
      const nextPlan = out.adaptive_ask_plan;
      if (nextPlan) {
        assert.equal(String(nextPlan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
        assert.equal(asst.content, nextPlan.question_text);
      }

      await savePOJUSession(out);
      const reloaded = await durable(out.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU3-E refusal must survive reload");
      assert.equal(reloaded.pending_answer_resolution!.status, "rejected");
      assert.equal(reloaded.pending_answer_resolution!.clarification_plan, null);
      assert.ok((reloaded.pending_answer_resolution!.rejected_items ?? []).length >= 1);
    });
