# patch existing R2 Cases A-F and helpers
from pathlib import Path
import os
root = Path(os.environ.get("POJU_ROOT", os.getcwd()))
path = root / "scripts/test-m1-production-adaptive-question-loop.ts"
text = path.read_text(encoding="utf-8")

def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"missing: {label}")
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ambiguous ({n}): {label}")
    text = text.replace(old, new, 1)
    print("ok", label)

repl(
"""  const { interpretUserAnswer } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
""",
"""  const { interpretUserAnswer, answerEventFromModelDraft } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
""",
"import answerEventFromModelDraft",
)

repl(
"""    function authorizedFrom(session: POJUSessionState): {
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
""",
"""    function authorizedFrom(session: POJUSessionState): {
      dir_ids: string[];
      ddr_ids: string[];
      fact_roles: string[];
      fact_role_codes: string[];
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
        fact_role_codes: [...codes],
      };
    }

    function roleCodeDir(code: string): string {
      const m = /^v1\/dir\/([^/]+)\/role\/([^/]+)$/.exec(code);
      return m?.[1] ?? "";
    }

    const EXTRA_JOB_ROLE_CODES = [
      "v1/dir/DIR-OPT-ON-TABLE/role/option",
      "v1/dir/DIR-STATUS-QUO/role/status_quo",
      "v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint",
      "v1/dir/DIR-RISK-TOLERANCE/role/risk",
    ] as const;

    function withTwoAuthorizedRoleCodes(session: POJUSessionState): {
      session: POJUSessionState;
      codeA: string;
      codeB: string;
    } {
      const last = session.decision_understanding?.last_sent_question;
      assert.ok(last, "last_sent_question required for two-role authorization setup");
      const existing = [...(last.fact_role_codes ?? [])];
      const codeA = existing[0] ?? EXTRA_JOB_ROLE_CODES[0];
      const codeB =
        existing.find((c) => c !== codeA) ??
        EXTRA_JOB_ROLE_CODES.find((c) => c !== codeA) ??
        EXTRA_JOB_ROLE_CODES[1];
      const dirs = Array.from(
        new Set(
          [...last.dir_ids, roleCodeDir(codeA), roleCodeDir(codeB)].filter((d) => d.length > 0),
        ),
      );
      const patched: POJUSessionState = {
        ...session,
        decision_understanding: session.decision_understanding
          ? {
              ...session.decision_understanding,
              last_sent_question: {
                ...last,
                dir_ids: dirs,
                fact_role_codes: [codeA, codeB],
              },
            }
          : session.decision_understanding,
      };
      return { session: patched, codeA, codeB };
    }
""",
"authorizedFrom + two-role helper",
)

repl(
"""            {
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
            },""",
"""            {
              text: "我目前仍在职，月薪三万。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth1.fact_role_codes[0] ?? null,
              certainty: "explicit",
            },
            {
              text: "家里有一个孩子。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth1.fact_role_codes[0] ?? null,
              certainty: "explicit",
            },""",
"Case A r1",
)

repl(
"""            {
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
            },""",
"""            {
              text: "大概还能撑 6 个月。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth2.fact_role_codes[0] ?? null,
              certainty: "estimated",
            },
            {
              text: "硬约束是必须保留社保。",
              semantic_kind: "constraint",
              role_hint: null,
              role_code_hint: auth2.fact_role_codes[0] ?? null,
              certainty: "explicit",
            },""",
"Case A r2",
)

repl(
"""        const mergedCodes = Array.from(new Set([...(lastSent.fact_role_codes ?? []), ...extraCodes]));
        s = {
          ...s,
          decision_understanding: s.decision_understanding
            ? {
                ...s.decision_understanding,
                last_sent_question: {
                  ...lastSent,
                  dir_ids: mergedDirs,
                  fact_role_codes: mergedCodes,
                },
              }
            : s.decision_understanding,
        };
      }
      const v2 = s.decision_context!.version;
""",
"""        const mergedCodes = Array.from(new Set([...(lastSent.fact_role_codes ?? []), ...extraCodes]));
        s = {
          ...s,
          decision_understanding: s.decision_understanding
            ? {
                ...s.decision_understanding,
                last_sent_question: {
                  ...lastSent,
                  dir_ids: mergedDirs,
                  fact_role_codes: mergedCodes,
                },
              }
            : s.decision_understanding,
        };
      }
      const auth3 = authorizedFrom(s);
      const correctionCode =
        extraCodes[0] ??
        auth3.fact_role_codes.find((c) => (originalStay.fact_roles ?? []).some((r) => c.endsWith(`/role/${r}`))) ??
        auth3.fact_role_codes[0] ??
        null;
      const supplementCode =
        auth3.fact_role_codes.find((c) => c !== correctionCode && c.includes("/role/option")) ??
        auth3.fact_role_codes.find((c) => c !== correctionCode) ??
        correctionCode;
      const v2 = s.decision_context!.version;
""",
"Case A r3 setup codes",
)

repl(
"""            {
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
            },""",
"""            {
              text: "我已经离职了，不是仍在职。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: correctionCode,
              certainty: "explicit",
            },
            {
              text: "还有一个备选是内部转岗。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: supplementCode,
              certainty: "explicit",
            },""",
"Case A r3 items",
)

repl(
"""              extracted_items: [
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
""",
"""              extracted_items: [
                {
                  text: "越权角色不应写入。",
                  semantic_kind: "reality_fact",
                  role_hint: "not_a_real_authorized_role",
                  role_code_hint: "v1/dir/DIR-NOT-AUTHORIZED/role/not_a_real_authorized_role",
                  certainty: "explicit",
                },
                {
                  text: "我有一个方案是留任。",
                  semantic_kind: "reality_fact",
                  role_hint: auth.fact_roles[0] ?? null,
                  role_code_hint: auth.fact_role_codes[0] ?? null,
                  certainty: "explicit",
                },
""",
"Case B",
)

repl(
"""                {
                  text: "我目前月薪三万。",
                  semantic_kind: "reality_fact",
                  role_hint: null,
                  certainty: "explicit",
                  user_confirmed: true,
""",
"""                {
                  text: "我目前月薪三万。",
                  semantic_kind: "reality_fact",
                  role_hint: null,
                  role_code_hint: authorizedFrom(before).fact_role_codes[0] ?? null,
                  certainty: "explicit",
                  user_confirmed: true,
""",
"Case C",
)

repl(
"""      for (const item of cases) {
        const before = await seedAnswerReadySession(item.tag);
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => item.draft },
        });
""",
"""      for (const item of cases) {
        const before = await seedAnswerReadySession(item.tag);
        const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
        const draft = {
          ...item.draft,
          extracted_items: item.draft.extracted_items.map((row) => ({
            ...row,
            role_code_hint: row.role_code_hint ?? legalCode,
          })),
        };
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
        });
""",
"Case E fill role_code_hint",
)

repl(
"""        } else {
          assert.ok(
            written.every((f) => f.status !== "confirmed" && f.verification_level !== "user_asserted"),
            `${item.tag} must not be classified as an explicit fact`,
          );
        }
""",
"""        } else {
          // FU1: certainty=unclear must not become user_estimate or user_asserted.
          assert.equal(
            written.length,
            0,
            `${item.tag} unclear certainty must not write a RealityFact`,
          );
        }
""",
"Case E unclear writes nothing",
)

repl(
"""              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint",
""",
"""              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: authorizedFrom(before).fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint",
""",
"Case F first",
)

repl(
"""              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint replay",
""",
"""              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: authorizedFrom(committed).fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint replay",
""",
"Case F replay",
)

path.write_text(text, encoding="utf-8", newline="\n")
print("patched A-F helpers")
