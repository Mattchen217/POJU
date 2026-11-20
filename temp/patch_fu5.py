# -*- coding: utf-8 -*-
from pathlib import Path

prod = Path(r"lib/poju/decision-intake/conflict-clarification.ts")
text = prod.read_text(encoding="utf-8")

old_block = '''const FIRST_OPT_RE = /第?(?:一|1)(?:条|项)/;
const SECOND_OPT_RE = /第?(?:二|2)(?:条|项)/;

// Affirmation keywords must not fire on 不准确 / 不正确.
const AFFIRM_KW_RE = /是对的|是正确的|(?<!不)准确|(?<!不)正确|(?<!不)对的|为准/;
const SELECT_KW_RE = /我?选|选择/;
'''

new_block = '''// Family A: insufficient-accuracy constructions. Match the construction as a
// unit so that 准确 / 正确 inside it cannot be treated as affirmation.
const INSUFFICIENT_ACCURACY_RE =
  /(?:不够|不算|不太|不怎么|不完全|谈不上|称不上)(?:第?(?:一|1|二|2)(?:条|项))?(?:准确|正确)|准确(?:度|性|程度)(?:不高|不足|有限)/;

// Family B: uncertain accuracy, including when an option mention sits
// between the hedge and 准确 / 正确.
const UNCERTAIN_ACCURACY_RE =
  /(?:不见得|未必|不一定|不能确定|无法确认|不敢确认|不好判断是否)(?:第?(?:一|1|二|2)(?:条|项))?(?:准确|正确)?/;

// Family C: explicit rejection of an option. Scope is assigned via the
// option mention in the same fragment, not by inferring the other option.
const EXPLICIT_REJECTION_RE =
  /不认可|不接受|不成立|不符合实际|不是事实|有误|存在错误/;

const FIRST_OPT_RE = /第?(?:一|1)(?:条|项)/;
const SECOND_OPT_RE = /第?(?:二|2)(?:条|项)/;

// Affirmation keywords must not fire on 不准确 / 不正确, and must not treat
// 准确度 / 准确性 / 准确程度 noun forms as affirmative evidence.
const AFFIRM_KW_RE =
  /是对的|是正确的|(?<!不)准确(?![度性]|程度)|(?<!不)正确(?!性)|(?<!不)对的|为准/;
const SELECT_KW_RE = /我?选|选择/;
'''

if old_block not in text:
    raise SystemExit("prod: FIRST_OPT / AFFIRM block not found")
text = text.replace(old_block, new_block, 1)

old_analyze = '''function analyzeFragment(fragment: string): FragmentSemantics {
  const mentionsFirst = FIRST_OPT_RE.test(fragment);
  const mentionsSecond = SECOND_OPT_RE.test(fragment);
  const hasNeg = NEGATION_CUES_RE.test(fragment);
  const hasHedge = HEDGE_CUES_RE.test(fragment);
  const bothRejected = BOTH_INACCURATE_RE.test(fragment);

  const first = emptyPolarity(mentionsFirst);
  const second = emptyPolarity(mentionsSecond);
  let unknownNegationScope = false;

  if (hasNeg) {
    if (mentionsFirst && mentionsSecond) {
      // Negation and two options in one fragment: scope cannot be assigned safely.
      unknownNegationScope = true;
    } else if (mentionsFirst) {
      first.negated = true;
    } else if (mentionsSecond) {
      second.negated = true;
    } else {
      unknownNegationScope = true;
    }
  }

  if (hasHedge) {
    if (mentionsFirst && !mentionsSecond) {
      first.hedged = true;
    } else if (mentionsSecond && !mentionsFirst) {
      second.hedged = true;
    } else {
      first.hedged = true;
      second.hedged = true;
    }
  }

  const hasAffirmKw = AFFIRM_KW_RE.test(fragment) || SELECT_KW_RE.test(fragment);

  // Affirmative keywords in a fragment cannot override negation or hedge
  // of the same option in that fragment.
  if (hasAffirmKw) {
    if (mentionsFirst && !first.negated && !first.hedged) {
      first.affirmed = true;
    }
    if (mentionsSecond && !second.negated && !second.hedged) {
      second.affirmed = true;
    }
  }

  return { first, second, bothRejected, unknownNegationScope };
}
'''

new_analyze = '''function analyzeFragment(fragment: string): FragmentSemantics {
  const mentionsFirst = FIRST_OPT_RE.test(fragment);
  const mentionsSecond = SECOND_OPT_RE.test(fragment);

  // Detect negative or insufficient-accuracy constructions before any
  // affirmative polarity assignment.
  const insufficientAccuracy = INSUFFICIENT_ACCURACY_RE.test(fragment);
  const uncertainAccuracy = UNCERTAIN_ACCURACY_RE.test(fragment);
  const explicitRejection = EXPLICIT_REJECTION_RE.test(fragment);
  const hasNeg =
    NEGATION_CUES_RE.test(fragment) ||
    insufficientAccuracy ||
    explicitRejection;
  const hasHedge = HEDGE_CUES_RE.test(fragment) || uncertainAccuracy;
  const bothRejected = BOTH_INACCURATE_RE.test(fragment);

  const first = emptyPolarity(mentionsFirst);
  const second = emptyPolarity(mentionsSecond);
  let unknownNegationScope = false;

  if (hasNeg) {
    if (mentionsFirst && mentionsSecond) {
      // Negation and two options in one fragment: scope cannot be assigned safely.
      unknownNegationScope = true;
    } else if (mentionsFirst) {
      first.negated = true;
    } else if (mentionsSecond) {
      second.negated = true;
    } else {
      unknownNegationScope = true;
    }
  }

  if (hasHedge) {
    if (mentionsFirst && !mentionsSecond) {
      first.hedged = true;
    } else if (mentionsSecond && !mentionsFirst) {
      second.hedged = true;
    } else {
      first.hedged = true;
      second.hedged = true;
    }
  }

  // Strip insufficient / uncertain accuracy constructions so leftover
  // 准确 / 正确 cannot override a negative or hedged reading.
  const residual = fragment
    .replace(INSUFFICIENT_ACCURACY_RE, "")
    .replace(UNCERTAIN_ACCURACY_RE, "");
  const hasAffirmKw = AFFIRM_KW_RE.test(residual) || SELECT_KW_RE.test(residual);

  // Affirmative keywords in a fragment cannot override negation or hedge
  // of the same option in that fragment.
  if (hasAffirmKw) {
    if (mentionsFirst && !first.negated && !first.hedged) {
      first.affirmed = true;
    }
    if (mentionsSecond && !second.negated && !second.hedged) {
      second.affirmed = true;
    }
  }

  return { first, second, bothRejected, unknownNegationScope };
}
'''

if old_analyze not in text:
    raise SystemExit("prod: analyzeFragment block not found")
text = text.replace(old_analyze, new_analyze, 1)

old_rest = '''  if (NEGATION_CUES_RE.test(compact) || BOTH_INACCURATE_RE.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }
'''

new_rest = '''  if (NEGATION_CUES_RE.test(compact) || BOTH_INACCURATE_RE.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }
  if (
    INSUFFICIENT_ACCURACY_RE.test(compact) ||
    UNCERTAIN_ACCURACY_RE.test(compact) ||
    EXPLICIT_REJECTION_RE.test(compact)
  ) {
    return CHOICE_AMBIGUOUS;
  }
'''

if old_rest not in text:
    raise SystemExit("prod: restatement negation guard not found")
text = text.replace(old_rest, new_rest, 1)

prod.write_text(text, encoding="utf-8", newline="\n")
print("patched production", prod)

tests = Path(r"scripts/test-m1-production-adaptive-question-loop.ts")
t = tests.read_text(encoding="utf-8")
anchor = '''    await check("M2.4-R1-FU4 Case Z10: affirming both options stays ambiguous", async () => {
      const result = await answerSeededConflict("m24z10", "第一条准确，第二条也准确");
      assertAmbiguousClarification("m24z10", result);
    });
'''
insert = anchor + '''
    await check("M2.4-R1-FU5 Case Z11: 不够准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z11", "第一条不够准确");
      assertAmbiguousClarification("m24z11", result);
    });

    await check("M2.4-R1-FU5 Case Z12: 不够准确 second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z12", "第二条不够准确");
      assertAmbiguousClarification("m24z12", result);
    });

    await check("M2.4-R1-FU5 Case Z13: 不算准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z13", "第一条不算准确");
      assertAmbiguousClarification("m24z13", result);
    });

    await check("M2.4-R1-FU5 Case Z14: 准确度不高 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z14", "第一条准确度不高");
      assertAmbiguousClarification("m24z14", result);
    });

    await check("M2.4-R1-FU5 Case Z15: 准确性不足 second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z15", "第二条准确性不足");
      assertAmbiguousClarification("m24z15", result);
    });

    await check("M2.4-R1-FU5 Case Z16: 不完全准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z16", "第一条不完全准确");
      assertAmbiguousClarification("m24z16", result);
    });

    await check("M2.4-R1-FU5 Case Z17: 不见得准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z17", "第一条不见得准确");
      assertAmbiguousClarification("m24z17", result);
    });

    await check("M2.4-R1-FU5 Case Z18: 不符合实际 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z18", "第一条不符合实际");
      assertAmbiguousClarification("m24z18", result);
    });

    await check("M2.4-R1-FU5 Case Z19: insufficient first and affirmed second selects the second fact", async () => {
      const result = await answerSeededConflict("m24z19", "第一条不够准确，但第二条准确");
      assertSelectedClarification("m24z19", result, result.seeded.factB.fact_id);
    });

    await check("M2.4-R1-FU5 Case Z20: insufficient second and affirmed first selects the first fact", async () => {
      const result = await answerSeededConflict("m24z20", "第二条不算准确，而是第一条准确");
      assertSelectedClarification("m24z20", result, result.seeded.factA.fact_id);
    });
'''
if anchor not in t:
    raise SystemExit("tests: Z10 anchor not found")
if "M2.4-R1-FU5 Case Z11" in t:
    raise SystemExit("tests: Z11 already present")
t = t.replace(anchor, insert, 1)
tests.write_text(t, encoding="utf-8", newline="\n")
print("patched tests", tests)