# -*- coding: utf-8 -*-
"""Apply M2.4-R2-FU5 parser + test patches on the Windows checkout."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
PENDING = ROOT / "lib" / "poju" / "decision-intake" / "pending-answer-resolution.ts"
TESTS = ROOT / "scripts" / "test-m1-production-adaptive-question-loop.ts"

OLD_CONFIRM = '''function confirmNegated(t: string): boolean {
  return (
    /不确认/.test(t) ||
    /不能确认/.test(t) ||
    /无法确认/.test(t) ||
    /不是明确约束/.test(t) ||
    /不是明确/.test(t) ||
    /不可以写入/.test(t) ||
    /不能写入/.test(t) ||
    /不可写入/.test(t) ||
    /不要写入/.test(t) ||
    /不许写入/.test(t)
  );
}'''

NEW_CONFIRM = '''function confirmNegated(t: string): boolean {
  // Negation of confirm/write action, including intervening words.
  // Evaluated before any affirmative keyword such as 可以写入.
  return (
    /不确认/.test(t) ||
    /不能确认/.test(t) ||
    /无法确认/.test(t) ||
    /不是明确约束/.test(t) ||
    /不是明确/.test(t) ||
    /不可以写入/.test(t) ||
    /不能写入/.test(t) ||
    /不可写入/.test(t) ||
    /不要写入/.test(t) ||
    /不许写入/.test(t) ||
    /不认为.{0,16}(可以写入|写入|确认|作为明确约束|明确约束)/.test(t) ||
    /不觉得.{0,16}(可以写入|写入|确认|作为明确约束|明确约束)/.test(t) ||
    /并非.{0,8}(可以写入|写入|确认|明确约束)/.test(t) ||
    /不同意.{0,16}(将它|把它|这个约束|它)?作为明确约束/.test(t) ||
    /不接受.{0,16}(这个约束|将它|把它|它)?作为明确约束/.test(t)
  );
}'''

OLD_DEF = '''export function parseDefinitionPatchChoice(
  statement: string,
): DefinitionPatchChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t) || /暂时不处理|先不处理/.test(t)) {
    return { ok: false, reason: "refused" };
  }
  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, as_fact: true };
  if (numbered === 2) return { ok: false, reason: "refused" };
  if (hasUncertaintyExpression(t) || HEDGE_CUES_RE.test(t)) {
    return { ok: false, reason: "unclear" };
  }
  if (
    /不作为|不改为|不当作|不记录|不要作为|不要改为/.test(t) ||
    /不是明确事实/.test(t)
  ) {
    return { ok: false, reason: "unclear" };
  }
  if (/(作为明确事实|改为事实|当作事实|记录为事实|作为事实)/i.test(t)) {
    return { ok: true, as_fact: true };
  }
  return { ok: false, reason: "unclear" };
}'''

NEW_DEF_HELPERS_AND_FN = '''/**
 * Negation governing the action of recording or converting the item into a fact.
 * Intervening words are allowed. Evaluated before any affirmative keyword.
 */
function hasDefinitionPatchNegativeAction(t: string): boolean {
  return (
    /不想.{0,16}(把它|将它|它)?(作为明确事实|作为事实|改为事实|当作事实|记录为事实)/.test(t) ||
    /不要.{0,16}(把它|将它|它)?(作为明确事实|作为事实|改为事实|当作事实|记录为事实)/.test(t) ||
    /不认为.{0,20}(作为明确事实|作为事实|改为事实|当作事实|记录为事实)/.test(t) ||
    /不愿意.{0,16}(把它|将它|它)?(改为事实|作为明确事实|作为事实|当作事实|记录为事实)/.test(t) ||
    /不应该.{0,12}(记录为事实|作为明确事实|作为事实|改为事实|当作事实)/.test(t) ||
    /不是要.{0,12}(作为事实记录|作为明确事实|作为事实|记录为事实)/.test(t) ||
    /不作为|不改为|不当作|不记录|不要作为|不要改为/.test(t) ||
    /不是明确事实/.test(t) ||
    /不能.{0,8}(作为明确事实|作为事实|记录为事实)/.test(t) ||
    /不可.{0,8}(作为明确事实|作为事实|记录为事实)/.test(t) ||
    /并非.{0,12}(作为明确事实|作为事实|记录为事实)/.test(t)
  );
}

function hasDefinitionPatchAffirmativeAction(t: string): boolean {
  return /(作为明确事实|改为事实|当作事实|记录为事实|作为事实)/i.test(t);
}

export function parseDefinitionPatchChoice(
  statement: string,
): DefinitionPatchChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t) || /暂时不处理|先不处理/.test(t)) {
    return { ok: false, reason: "refused" };
  }
  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, as_fact: true };
  if (numbered === 2) return { ok: false, reason: "refused" };

  // Refusal, uncertainty, and negative intent are evaluated before affirmation.
  if (hasUncertaintyExpression(t) || HEDGE_CUES_RE.test(t)) {
    return { ok: false, reason: "unclear" };
  }

  const negated = hasDefinitionPatchNegativeAction(t);
  const affirmed = hasDefinitionPatchAffirmativeAction(t);
  if (negated) {
    // A meaningful negation of the record-as-fact action must never be
    // classified as affirmative merely because an affirmative keyword remains
    // in the sentence. Conflicting or ambiguous polarity stays unclear.
    return { ok: false, reason: "unclear" };
  }
  if (affirmed) {
    return { ok: true, as_fact: true };
  }
  return { ok: false, reason: "unclear" };
}'''

OLD_CONSTRAINT_FN_TAIL = '''  if (hasUncertaintyExpression(t)) {
    return { ok: true, confirmed: false, still_uncertain: true };
  }
  if (confirmNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasEstimateExpression(t) && !estimateNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasConstraintConfirmAffirm(t)) {
    return { ok: true, confirmed: true, still_uncertain: false };
  }
  return { ok: false, reason: "unclear" };
}'''

NEW_CONSTRAINT_FN_TAIL = '''  // Uncertainty and negative intent are evaluated before affirmation.
  // An earlier negation governing the confirm/write action is never overridden
  // by a later affirmative substring such as 可以写入 or 确认这是明确约束.
  if (hasUncertaintyExpression(t)) {
    return { ok: true, confirmed: false, still_uncertain: true };
  }
  if (confirmNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasEstimateExpression(t) && !estimateNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasConstraintConfirmAffirm(t)) {
    return { ok: true, confirmed: true, still_uncertain: false };
  }
  return { ok: false, reason: "unclear" };
}'''

TEST_INSERT = r'''
    // M2.4-R2-FU5: clarification negation safety closure.
    // A meaningful negation of the proposed action must never be classified
    // as affirmative merely because an affirmative keyword also appears.

    await check("M2.4-R2-FU5-DP-N: definition-patch negatives never write as fact", async () => {
      const cases = [
        { tag: "fu5dpna", phrase: "我不想把它作为明确事实记录" },
        { tag: "fu5dpnb", phrase: "不要将它作为明确事实" },
        { tag: "fu5dpnc", phrase: "我不认为应该把它作为明确事实" },
        { tag: "fu5dpnd", phrase: "我不愿意把它改为事实" },
        { tag: "fu5dpne", phrase: "不应该记录为事实" },
        { tag: "fu5dpnf", phrase: "不是要作为事实记录" },
      ];
      for (const item of cases) {
        const ctx = await seedDefinitionPatchPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.constraints.length, ctx.cstBefore, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must keep pending active`);
        assert.ok(
          pending!.unresolved_items.some((u) => u.item_id === itemId),
          `${item.phrase} must not silently remove the pending item`,
        );
        assert.equal(
          pending!.unresolved_items.find((u) => u.item_id === itemId)?.reason,
          "definition_patch_not_persistable",
        );
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.ok(
          asst.content.includes("待澄清信息") || asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
          `${item.phrase} must keep the pending clarification, got=${asst.content.slice(0, 200)}`,
        );
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU5-DP-P: definition-patch affirmatives still write through DC C1", async () => {
      const cases = [
        { tag: "fu5dppa", phrase: "改为作为明确事实记录" },
        { tag: "fu5dppb", phrase: "作为明确事实" },
      ];
      for (const item of cases) {
        const ctx = await seedDefinitionPatchPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const written = factWritten(dc, "把决策问题改成是否立刻辞职");
        assert.ok(written, `${item.phrase} must write the converted RealityFact`);
        const role = ctx.legalCode.split("/role/")[1]!;
        const dirId = roleCodeDir(ctx.legalCode);
        assert.ok((written!.fact_roles ?? []).includes(role), `${item.phrase} must keep the authorized role`);
        assert.ok((written!.related_dir_ids ?? []).includes(dirId), `${item.phrase} must keep the authorized DIR`);
        assert.equal(dc.constraints.length, ctx.cstBefore, `${item.phrase} must not write a Constraint`);
        assert.ok(dc.version > ctx.vBefore, `${item.phrase} must persist through DC C1`);
        assert.equal(out.pending_answer_resolution ?? null, null, `${item.phrase} must clear pending after persist`);
        assert.notEqual(lastAssistant(out).content, stubResponse);
      }
    });

    await check("M2.4-R2-FU5-CC-N: constraint-confirm negatives never confirm a write", async () => {
      const cases = [
        { tag: "fu5ccna", phrase: "我不认为可以写入" },
        { tag: "fu5ccnb", phrase: "我不觉得可以写入" },
        { tag: "fu5ccnc", phrase: "并非可以写入" },
        { tag: "fu5ccnd", phrase: "我认为不能写入" },
        { tag: "fu5ccne", phrase: "我不同意将它作为明确约束" },
        { tag: "fu5ccnf", phrase: "我不接受这个约束作为明确约束" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        assert.equal(cst, undefined, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must remain pending`);
        const kept = pending!.unresolved_items.find((u) => u.item_id === itemId);
        assert.ok(kept, `${item.phrase} must keep the pending item`);
        assert.notEqual(kept!.certainty, "explicit", `${item.phrase} must not be marked confirmed`);
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU5-CC-P: constraint-confirm affirmatives still write user_asserted", async () => {
      const cases = [
        { tag: "fu5ccpa", phrase: "确认这是明确约束" },
        { tag: "fu5ccpb", phrase: "1" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        assert.ok(cst, `${item.phrase} must write the Constraint`);
        assert.equal(cst!.verification_level, "user_asserted", `${item.phrase} must be user_asserted`);
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.ok(dc.version > ctx.vBefore, `${item.phrase} must persist through DC C1`);
        assert.equal(out.pending_answer_resolution ?? null, null, `${item.phrase} must clear pending after persist`);
        assert.notEqual(lastAssistant(out).content, stubResponse);
      }
    });

'''

ANCHOR = '''      if (replay.adaptive_ask_plan) {
        assert.equal(String(replay.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
      }
    });

    const modelSrc = readFileSync(
'''

REPLACEMENT_ANCHOR = '''      if (replay.adaptive_ask_plan) {
        assert.equal(String(replay.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
      }
    });
''' + TEST_INSERT + '''    const modelSrc = readFileSync(
'''


def detect_nl(data: str) -> str:
    return "\r\n" if "\r\n" in data else "\n"


def apply_block(text: str, old: str, new: str, label: str) -> str:
    nl = detect_nl(text)
    old_n = old.replace("\n", nl)
    new_n = new.replace("\n", nl)
    count = text.count(old_n)
    if count != 1:
        # try lf-normalized search for diagnostics
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old_n, new_n, 1)


def main() -> None:
    pending = PENDING.read_text(encoding="utf-8")
    pending = apply_block(pending, OLD_CONFIRM, NEW_CONFIRM, "confirmNegated")
    pending = apply_block(pending, OLD_CONSTRAINT_FN_TAIL, NEW_CONSTRAINT_FN_TAIL, "parseConstraintConfirmChoice tail")
    pending = apply_block(pending, OLD_DEF, NEW_DEF_HELPERS_AND_FN, "parseDefinitionPatchChoice")
    PENDING.write_text(pending, encoding="utf-8", newline="")
    print("patched", PENDING)

    tests = TESTS.read_text(encoding="utf-8")
    tests = apply_block(tests, ANCHOR, REPLACEMENT_ANCHOR, "FU5 tests insert")
    TESTS.write_text(tests, encoding="utf-8", newline="")
    print("patched", TESTS)
    print("ok")


if __name__ == "__main__":
    main()
