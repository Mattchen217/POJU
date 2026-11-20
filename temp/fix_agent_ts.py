from pathlib import Path
root = Path(r"D:/POJU/pojulife")
rel = root / "lib/poju/agent.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")

old1 = '''        const m1UnderstandingFailClosed =
          !m1CollectingTurn.authorized_question &&
          Boolean(m1CollectingTurn.ask_error) &&
          (m1CollectingTurn.ask_error!.includes("understanding_exception") ||
            m1CollectingTurn.ask_error!.includes("planner_exception") ||
            (m1CollectingTurn.understanding == null &&
              m1CollectingTurn.outcome === "ready_no_question" &&
              Boolean(m1CollectingTurn.session.decision_blueprint)));'''

new1 = '''        const m1UnderstandingFailClosed =
          !m1CollectingTurn.authorized_question &&
          Boolean(m1CollectingTurn.ask_error) &&
          (m1CollectingTurn.ask_error!.includes("understanding_exception") ||
            m1CollectingTurn.ask_error!.includes("planner_exception") ||
            (m1CollectingTurn.understanding == null &&
              Boolean(m1CollectingTurn.session.decision_blueprint)));'''

assert old1 in s, "block1"
s = s.replace(old1, new1, 1)

old2 = '''  const m1BlockedOrUnderstandingFail =
    Boolean(m1CollectingTurn) &&
    (m1CollectingTurn!.outcome === "planner_blocked" ||
      (!m1CollectingTurn!.authorized_question &&
        Boolean(m1CollectingTurn!.ask_error) &&
        (m1CollectingTurn!.ask_error!.includes("understanding_exception") ||
          m1CollectingTurn!.ask_error!.includes("planner_exception") ||
          (m1CollectingTurn!.understanding == null &&
            m1CollectingTurn!.outcome === "ready_no_question" &&
            Boolean(m1CollectingTurn!.session.decision_blueprint)))));'''

new2 = '''  const m1BlockedOrUnderstandingFail =
    Boolean(m1CollectingTurn) &&
    (m1CollectingTurn!.outcome === "planner_blocked" ||
      (!m1CollectingTurn!.authorized_question &&
        Boolean(m1CollectingTurn!.ask_error) &&
        (m1CollectingTurn!.ask_error!.includes("understanding_exception") ||
          m1CollectingTurn!.ask_error!.includes("planner_exception") ||
          (m1CollectingTurn!.understanding == null &&
            Boolean(m1CollectingTurn!.session.decision_blueprint)))));'''

assert old2 in s, "block2"
s = s.replace(old2, new2, 1)

out = s.replace("\n", "\r\n") if nl == "\r\n" else s
rel.write_text(out, encoding="utf-8", newline="")
print("agent TS fixed")
