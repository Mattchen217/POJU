from pathlib import Path
p = Path("lib/poju/agent.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

def sub(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"NOT FOUND: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"NOT UNIQUE ({text.count(old)}): {label}")
    text = text.replace(old, new, 1)
    print("patched", label)

# workingSession field pick
sub(
    '''          intake_ask_plan: sessionForLlm.intake_ask_plan,
          session_revision: sessionForLlm.session_revision,
          dc_write_revision: sessionForLlm.dc_write_revision,
        };
''',
    '''          intake_ask_plan: sessionForLlm.intake_ask_plan,
          session_revision: sessionForLlm.session_revision,
          dc_write_revision: sessionForLlm.dc_write_revision,
          pending_answer_resolution: sessionForLlm.pending_answer_resolution,
        };
''',
    "workingSession-pick",
)

# attachAuthorizedAssistantQuestion merge
sub(
    '''        dc_write_revision:
          m1CollectingTurn.session.dc_write_revision ?? sessionOut.dc_write_revision,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
''',
    '''        dc_write_revision:
          m1CollectingTurn.session.dc_write_revision ?? sessionOut.dc_write_revision,
        pending_answer_resolution:
          m1CollectingTurn.session.pending_answer_resolution ??
          sessionOut.pending_answer_resolution,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
''',
    "attach-merge",
)

# readiness stop merge
sub(
    '''      intake_ask_plan:
        m1CollectingTurn.session.intake_ask_plan ?? sessionOut.intake_ask_plan,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
''',
    '''      intake_ask_plan:
        m1CollectingTurn.session.intake_ask_plan ?? sessionOut.intake_ask_plan,
      pending_answer_resolution:
        m1CollectingTurn.session.pending_answer_resolution ??
        sessionOut.pending_answer_resolution,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
''',
    "readiness-merge",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("agent.ts field copies added")
