# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
path = ROOT / "scripts/test-m1-production-adaptive-question-loop.ts"
text = path.read_text(encoding="utf-8")
assert "M2.4-R2-FU1 Case G:" not in text, "G-M already inserted"

def repl(old, new, label):
    global text
    n = text.count(old)
    if n != 1:
        raise SystemExit("%s: count=%s" % (label, n))
    text = text.replace(old, new, 1)
    print("ok", label)

repl(
'''  const { interpretUserAnswer } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
''',
'''  const { interpretUserAnswer, answerEventFromModelDraft } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
''',
"import",
)

old_auth = text[text.index("    function authorizedFrom(session: POJUSessionState): {"):text.index("    async function seedAnswerReadySession")]
new_auth = r'''    function authorizedFrom(session: POJUSessionState): {
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

'''
if text.count(old_auth) != 1:
    raise SystemExit("authorizedFrom unique block missing")
text = text.replace(old_auth, new_auth, 1)
print("ok authorizedFrom")

# Case A r1: two explicit facts with role_hint null
repl(
'''              text: "\u6211\u76ee\u524d\u4ecd\u5728\u804c\uff0c\u6708\u85aa\u4e09\u4e07\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
''',
'''              text: "\u6211\u76ee\u524d\u4ecd\u5728\u804c\uff0c\u6708\u85aa\u4e09\u4e07\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth1.fact_role_codes[0] ?? null,
              certainty: "explicit",
''',
"A r1 fact1",
)
repl(
'''              text: "\u5bb6\u91cc\u6709\u4e00\u4e2a\u5b69\u5b50\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
''',
'''              text: "\u5bb6\u91cc\u6709\u4e00\u4e2a\u5b69\u5b50\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth1.fact_role_codes[0] ?? null,
              certainty: "explicit",
''',
"A r1 fact2",
)

repl(
'''              text: "\u5927\u6982\u8fd8\u80fd\u6491 6 \u4e2a\u6708\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "estimated",
''',
'''              text: "\u5927\u6982\u8fd8\u80fd\u6491 6 \u4e2a\u6708\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth2.fact_role_codes[0] ?? null,
              certainty: "estimated",
''',
"A r2 estimate",
)
repl(
'''              text: "\u786c\u7ea6\u675f\u662f\u5fc5\u987b\u4fdd\u7559\u793e\u4fdd\u3002",
              semantic_kind: "constraint",
              role_hint: null,
              certainty: "explicit",
''',
'''              text: "\u786c\u7ea6\u675f\u662f\u5fc5\u987b\u4fdd\u7559\u793e\u4fdd\u3002",
              semantic_kind: "constraint",
              role_hint: null,
              role_code_hint: auth2.fact_role_codes[0] ?? null,
              certainty: "explicit",
''',
"A r2 constraint",
)

repl(
'''        const mergedCodes = Array.from(new Set([...(lastSent.fact_role_codes ?? []), ...extraCodes]));
''',
'''        const mergedCodes = Array.from(new Set([...(lastSent.fact_role_codes ?? []), ...extraCodes]));
        // FU1: capture codes after merge for role_code_hint injection below.
''',
"A r3 marker",
)

# Insert correction/supplement codes just before const v2 after the merge block
repl(
'''      }
      const v2 = s.decision_context!.version;
''',
'''      }
      const auth3 = authorizedFrom(s);
      const correctionCode =
        extraCodes[0] ??
        auth3.fact_role_codes.find((c) => (originalStay.fact_roles ?? []).some((r) => c.endsWith("/role/" + r))) ??
        auth3.fact_role_codes[0] ??
        null;
      const supplementCode =
        auth3.fact_role_codes.find((c) => c !== correctionCode && c.includes("/role/option")) ??
        auth3.fact_role_codes.find((c) => c !== correctionCode) ??
        correctionCode;
      const v2 = s.decision_context!.version;
''',
"A r3 codes",
)

repl(
'''              text: "\u6211\u5df2\u7ecf\u79bb\u804c\u4e86\uff0c\u4e0d\u662f\u4ecd\u5728\u804c\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
''',
'''              text: "\u6211\u5df2\u7ecf\u79bb\u804c\u4e86\uff0c\u4e0d\u662f\u4ecd\u5728\u804c\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: correctionCode,
              certainty: "explicit",
''',
"A r3 correction",
)
repl(
'''              text: "\u8fd8\u6709\u4e00\u4e2a\u5907\u9009\u662f\u5185\u90e8\u8f6c\u5c97\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              certainty: "explicit",
''',
'''              text: "\u8fd8\u6709\u4e00\u4e2a\u5907\u9009\u662f\u5185\u90e8\u8f6c\u5c97\u3002",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: supplementCode,
              certainty: "explicit",
''',
"A r3 supplement",
)

repl(
'''                role_hint: "not_a_real_authorized_role",
                certainty: "explicit",
''',
'''                role_hint: "not_a_real_authorized_role",
                role_code_hint: "v1/dir/DIR-NOT-AUTHORIZED/role/not_a_real_authorized_role",
                certainty: "explicit",
''',
"Case B overreach",
)
repl(
'''                role_hint: auth.fact_roles[0] ?? null,
                certainty: "explicit",
''',
'''                role_hint: auth.fact_roles[0] ?? null,
                role_code_hint: auth.fact_role_codes[0] ?? null,
                certainty: "explicit",
''',
"Case B legal",
)

repl(
'''                role_hint: null,
                certainty: "explicit",
                user_confirmed: true,
''',
'''                role_hint: null,
                role_code_hint: authorizedFrom(before).fact_role_codes[0] ?? null,
                certainty: "explicit",
                user_confirmed: true,
''',
"Case C",
)

repl(
'''        const before = await seedAnswerReadySession(item.tag);
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => item.draft },
        });
''',
'''        const before = await seedAnswerReadySession(item.tag);
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
''',
"Case E hook",
)

repl(
'''          assert.ok(
            written.every((f) => f.status !== "confirmed" && f.verification_level !== "user_asserted"),
            `${item.tag} must not be classified as an explicit fact`,
          );
''',
'''          // FU1: certainty=unclear must not become user_estimate or user_asserted.
          assert.equal(
            written.length,
            0,
            `${item.tag} unclear certainty must not write a RealityFact`,
          );
''',
"Case E unclear",
)

# Case F: first then replay. Both have role_hint null + explicit constraint text.
# Distinguish by explanation.
repl(
'''                text: "\u786c\u7ea6\u675f\u662f\u5fc5\u987b\u4fdd\u7559\u793e\u4fdd\uff0c\u9884\u7b97\u4e0d\u80fd\u4f4e\u4e8e\u73b0\u5728\u7684 70%\u3002",
                semantic_kind: "constraint",
                role_hint: null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint",
''',
'''                text: "\u786c\u7ea6\u675f\u662f\u5fc5\u987b\u4fdd\u7559\u793e\u4fdd\uff0c\u9884\u7b97\u4e0d\u80fd\u4f4e\u4e8e\u73b0\u5728\u7684 70%\u3002",
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: authorizedFrom(before).fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint",
''',
"Case F first",
)
repl(
'''                text: "\u786c\u7ea6\u675f\u662f\u5fc5\u987b\u4fdd\u7559\u793e\u4fdd\uff0c\u9884\u7b97\u4e0d\u80fd\u4f4e\u4e8e\u73b0\u5728\u7684 70%\u3002",
                semantic_kind: "constraint",
                role_hint: null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint replay",
''',
'''                text: "\u786c\u7ea6\u675f\u662f\u5fc5\u987b\u4fdd\u7559\u793e\u4fdd\uff0c\u9884\u7b97\u4e0d\u80fd\u4f4e\u4e8e\u73b0\u5728\u7684 70%\u3002",
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: authorizedFrom(committed).fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint replay",
''',
"Case F replay",
)

# Insert G-M
anchor = '    await check("M2.4-R2 static: production path uses model interpretation before DC write", async () => {'
gm_path = Path(r"D:\POJU\pojulife\temp\m24r2fu1\cases_gm.ts")
gm = gm_path.read_text(encoding="utf-8")
if not gm.endswith("\n"):
    gm += "\n"
if text.count(anchor) != 1:
    raise SystemExit("static anchor count=%s" % text.count(anchor))
text = text.replace(anchor, gm + "\n" + anchor, 1)
print("ok Cases G-M")

path.write_text(text, encoding="utf-8", newline="\n")
print("WROTE", path)
print("has G", "M2.4-R2-FU1 Case G:" in text)
print("has withTwo", "withTwoAuthorizedRoleCodes" in text)
print("has correctionCode", "correctionCode" in text)
