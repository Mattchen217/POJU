# -*- coding: utf-8 -*-
from pathlib import Path

cc = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\conflict-clarification.ts")
ts = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")

cc_text = cc.read_text(encoding="utf-8")
ts_text = ts.read_text(encoding="utf-8")
assert "\r\n" not in cc_text and "\r\n" not in ts_text

old_family_a = """const INSUFFICIENT_ACCURACY_RE =
  /(?:不够|不算|不太|不怎么|不完全|谈不上|称不上)(?:第?(?:一|1|二|2)(?:条|项))?(?:准确|正确)|准确(?:度|性|程度)(?:不高|不足|有限)/;

// Family B:"""

new_family_a = """const INSUFFICIENT_ACCURACY_RE =
  /(?:不够|不算|不太|不怎么|不完全|谈不上|称不上)(?:第?(?:一|1|二|2)(?:条|项))?(?:准确|正确)|准确(?:度|性|程度)(?:不高|不足|有限)/;

// Accuracy-rate insufficiency (准确率 / 正确率). An optional option
// mention may sit between the rate noun and the evaluator so that
// both 第一条准确率不高 and 准确率第一条不高 are recognized as a unit.
const ACCURACY_RATE_INSUFFICIENCY_RE =
  /(?:准确率|正确率)(?:第?(?:一|1|二|2)(?:条|项))?(?:不高|偏低|较低|低|不足|有限|不够|不理想)/;

// Family B:"""

assert cc_text.count(old_family_a) == 1, "family A anchor missing or not unique"

old_affirm = """// Affirmation keywords must not fire on 不准确 / 不正确, and must not treat
// 准确度 / 准确性 / 准确程度 noun forms as affirmative evidence.
const AFFIRM_KW_RE =
  /是对的|是正确的|(?<!不)准确(?![度性]|程度)|(?<!不)正确(?!性)|(?<!不)对的|为准/;"""

new_affirm = """// Affirmation keywords must not fire on 不准确 / 不正确, and must not treat
// 准确度 / 准确性 / 准确程度 / 准确率 / 正确率 noun forms as affirmative evidence.
const AFFIRM_KW_RE =
  /是对的|是正确的|(?<!不)准确(?![度性率]|程度)|(?<!不)正确(?![性率])|(?<!不)对的|为准/;"""

assert cc_text.count(old_affirm) == 1, "AFFIRM_KW_RE anchor missing or not unique"

old_analyze = """  const insufficientAccuracy = INSUFFICIENT_ACCURACY_RE.test(fragment);
  const uncertainAccuracy = UNCERTAIN_ACCURACY_RE.test(fragment);
  const explicitRejection = EXPLICIT_REJECTION_RE.test(fragment);
  const hasNeg =
    NEGATION_CUES_RE.test(fragment) ||
    insufficientAccuracy ||
    explicitRejection;"""

new_analyze = """  const insufficientAccuracy = INSUFFICIENT_ACCURACY_RE.test(fragment);
  const accuracyRateInsufficient =
    ACCURACY_RATE_INSUFFICIENCY_RE.test(fragment);
  const uncertainAccuracy = UNCERTAIN_ACCURACY_RE.test(fragment);
  const explicitRejection = EXPLICIT_REJECTION_RE.test(fragment);
  const hasNeg =
    NEGATION_CUES_RE.test(fragment) ||
    insufficientAccuracy ||
    accuracyRateInsufficient ||
    explicitRejection;"""

assert cc_text.count(old_analyze) == 1, "analyzeFragment hasNeg anchor missing or not unique"

old_residual = """  const residual = fragment
    .replace(INSUFFICIENT_ACCURACY_RE, \"\")
    .replace(UNCERTAIN_ACCURACY_RE, \"\");"""

new_residual = """  const residual = fragment
    .replace(INSUFFICIENT_ACCURACY_RE, \"\")
    .replace(UNCERTAIN_ACCURACY_RE, \"\")
    .replace(ACCURACY_RATE_INSUFFICIENCY_RE, \"\");"""

assert cc_text.count(old_residual) == 1, "residual strip anchor missing or not unique"

old_restatement = """    INSUFFICIENT_ACCURACY_RE.test(compact) ||
    UNCERTAIN_ACCURACY_RE.test(compact) ||
    EXPLICIT_REJECTION_RE.test(compact)"""

new_restatement = """    INSUFFICIENT_ACCURACY_RE.test(compact) ||
    UNCERTAIN_ACCURACY_RE.test(compact) ||
    EXPLICIT_REJECTION_RE.test(compact) ||
    ACCURACY_RATE_INSUFFICIENCY_RE.test(compact)"""

assert cc_text.count(old_restatement) == 1, "restatementChoice anchor missing or not unique"

cc_new = (
    cc_text
    .replace(old_family_a, new_family_a)
    .replace(old_affirm, new_affirm)
    .replace(old_analyze, new_analyze)
    .replace(old_residual, new_residual)
    .replace(old_restatement, new_restatement)
)
assert cc_new != cc_text
assert "ACCURACY_RATE_INSUFFICIENCY_RE" in cc_new
assert cc_new.count("ACCURACY_RATE_INSUFFICIENCY_RE") >= 4

old_z20 = """    await check(\"M2.4-R1-FU5 Case Z20: insufficient second and affirmed first selects the first fact\", async () => {
      const result = await answerSeededConflict(\"m24z20\", \"第二条不算准确，而是第一条准确\");
      assertSelectedClarification(\"m24z20\", result, result.seeded.factA.fact_id);
    });

  } finally {"""

new_z20 = """    await check(\"M2.4-R1-FU5 Case Z20: insufficient second and affirmed first selects the first fact\", async () => {
      const result = await answerSeededConflict(\"m24z20\", \"第二条不算准确，而是第一条准确\");
      assertSelectedClarification(\"m24z20\", result, result.seeded.factA.fact_id);
    });

    await check(\"M2.4-R1-FU6 Case Z21: 准确率不高 first must stay ambiguous\", async () => {
      const result = await answerSeededConflict(\"m24z21\", \"第一条准确率不高\");
      assertAmbiguousClarification(\"m24z21\", result);
    });

    await check(\"M2.4-R1-FU6 Case Z22: 准确率偏低 second must stay ambiguous\", async () => {
      const result = await answerSeededConflict(\"m24z22\", \"第二条准确率偏低\");
      assertAmbiguousClarification(\"m24z22\", result);
    });

    await check(\"M2.4-R1-FU6 Case Z23: 正确率不高 first must stay ambiguous\", async () => {
      const result = await answerSeededConflict(\"m24z23\", \"第一条正确率不高\");
      assertAmbiguousClarification(\"m24z23\", result);
    });

    await check(\"M2.4-R1-FU6 Case Z24: 正确率不足 second must stay ambiguous\", async () => {
      const result = await answerSeededConflict(\"m24z24\", \"第二条正确率不足\");
      assertAmbiguousClarification(\"m24z24\", result);
    });

    await check(\"M2.4-R1-FU6 Case Z25: accuracy-rate insufficient first and affirmed second selects the second fact\", async () => {
      const result = await answerSeededConflict(\"m24z25\", \"第一条准确率不高，但第二条准确\");
      assertSelectedClarification(\"m24z25\", result, result.seeded.factB.fact_id);
    });

  } finally {"""

assert ts_text.count(old_z20) == 1, "Z20 anchor missing or not unique"
ts_new = ts_text.replace(old_z20, new_z20)
assert "m24z21" in ts_new and "m24z25" in ts_new

cc.write_text(cc_new, encoding="utf-8", newline="\n")
ts.write_text(ts_new, encoding="utf-8", newline="\n")
print("patched ok")
print("cc bytes", cc.stat().st_size, "ts bytes", ts.stat().st_size)
