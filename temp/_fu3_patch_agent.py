from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
text = p.read_text(encoding="utf-8")
old = '''        pending_answer_resolution:
          m1CollectingTurn.session.pending_answer_resolution ??
          sessionOut.pending_answer_resolution,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
      m1CollectingTurn.plan,
      turnId,
    );
'''
new = '''        pending_answer_resolution:
          m1CollectingTurn.session.pending_answer_resolution !== undefined
            ? m1CollectingTurn.session.pending_answer_resolution
            : sessionOut.pending_answer_resolution,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
      m1CollectingTurn.plan,
      turnId,
    );
'''
assert old in text, "first pending merge not found"
text = text.replace(old, new)
old2 = '''      pending_answer_resolution:
        m1CollectingTurn.session.pending_answer_resolution ??
        sessionOut.pending_answer_resolution,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
'''
new2 = '''      pending_answer_resolution:
        m1CollectingTurn.session.pending_answer_resolution !== undefined
          ? m1CollectingTurn.session.pending_answer_resolution
          : sessionOut.pending_answer_resolution,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
'''
assert old2 in text, "second pending merge not found"
text = text.replace(old2, new2)

# planner_blocked return: add explicit pending copy
old3 = '''          intake_ask_plan:
              m1CollectingTurn.session.intake_ask_plan ??
              blockedSession.intake_ask_plan,
          });
'''
# This might match with different indent. Let's find it.
if old3 not in text:
    # try exact from earlier read
    idx = text.find("adaptive_ask_plan: null,")
    print("adaptive_ask_plan:null idx", idx)
    print(repr(text[idx:idx+500]))
else:
    print("old3 found")
p.write_text(text, encoding="utf-8", newline="\n")
print("agent pending ?? patched")
