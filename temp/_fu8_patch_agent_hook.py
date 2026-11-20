from pathlib import Path

# agent.ts: copy pending_intake_control wherever pending_answer_resolution is copied
p = Path("lib/poju/agent.ts")
text = p.read_text(encoding="utf-8")

# 1) blockedSession merge
old = '''            pending_answer_resolution:
              m1CollectingTurn.session.pending_answer_resolution !== undefined
                ? m1CollectingTurn.session.pending_answer_resolution
                : blockedSession.pending_answer_resolution,
'''
new = '''            pending_answer_resolution:
              m1CollectingTurn.session.pending_answer_resolution !== undefined
                ? m1CollectingTurn.session.pending_answer_resolution
                : blockedSession.pending_answer_resolution,
            pending_intake_control:
              m1CollectingTurn.session.pending_intake_control !== undefined
                ? m1CollectingTurn.session.pending_intake_control
                : blockedSession.pending_intake_control,
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)

old = '''          pending_answer_resolution: sessionForLlm.pending_answer_resolution,
'''
new = '''          pending_answer_resolution: sessionForLlm.pending_answer_resolution,
          pending_intake_control: sessionForLlm.pending_intake_control,
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)

old = '''        pending_answer_resolution:
          m1CollectingTurn.session.pending_answer_resolution !== undefined
            ? m1CollectingTurn.session.pending_answer_resolution
            : sessionOut.pending_answer_resolution,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
      m1CollectingTurn.plan,
'''
new = '''        pending_answer_resolution:
          m1CollectingTurn.session.pending_answer_resolution !== undefined
            ? m1CollectingTurn.session.pending_answer_resolution
            : sessionOut.pending_answer_resolution,
        pending_intake_control:
          m1CollectingTurn.session.pending_intake_control !== undefined
            ? m1CollectingTurn.session.pending_intake_control
            : sessionOut.pending_intake_control,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
      m1CollectingTurn.plan,
'''
assert text.count(old) == 1, "attachAuthorized merge not unique"
text = text.replace(old, new, 1)

old = '''      pending_answer_resolution:
        m1CollectingTurn.session.pending_answer_resolution !== undefined
          ? m1CollectingTurn.session.pending_answer_resolution
          : sessionOut.pending_answer_resolution,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
'''
new = '''      pending_answer_resolution:
        m1CollectingTurn.session.pending_answer_resolution !== undefined
          ? m1CollectingTurn.session.pending_answer_resolution
          : sessionOut.pending_answer_resolution,
      pending_intake_control:
        m1CollectingTurn.session.pending_intake_control !== undefined
          ? m1CollectingTurn.session.pending_intake_control
          : sessionOut.pending_intake_control,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("agent.ts patched", text.count("pending_intake_control"))

# pending bind draft
p = Path("lib/poju/decision-intake/pending-answer-resolution.ts")
text = p.read_text(encoding="utf-8")
old = '''        text: item.text,
        semantic_kind,
        role_hint: null,
        role_code_hint,
        certainty,
'''
new = '''        text: item.text,
        semantic_kind,
        role_hint: null,
        role_code_hint,
        certainty,
        source_quote: item.text,
'''
assert old in text
p.write_text(text.replace(old, new, 1).replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("pending bind source_quote added")

# deterministic hook
p = Path("scripts/fixtures/test-answer-interpretation-hook.ts")
text = p.read_text(encoding="utf-8")
old = '''    extracted_items.push({
      text: write.statement,
      semantic_kind: write.kind,
      role_hint: null,
      certainty:
        write.verification_level === "user_estimate"
          ? "estimated"
          : write.status === "unknown" || write.status === "declined"
            ? "unclear"
            : "explicit",
    });
'''
new = '''    // write.statement is a clause or slice of the user statement, so it is
    // a contiguous source quote when the deterministic classifier is used.
    extracted_items.push({
      text: write.statement,
      semantic_kind: write.kind,
      role_hint: null,
      certainty:
        write.verification_level === "user_estimate"
          ? "estimated"
          : write.status === "unknown" || write.status === "declined"
            ? "unclear"
            : "explicit",
      source_quote: write.statement,
    });
'''
assert old in text
p.write_text(text.replace(old, new, 1).replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("deterministic hook source_quote added")
