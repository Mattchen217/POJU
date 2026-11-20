from pathlib import Path
root = Path(r"D:/POJU/pojulife")
rel = root / "lib/poju/agent.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")
if "m1UnderstandingFailClosed" in s:
    print("already")
    raise SystemExit(0)

needle = (
    "        if (m1CollectingTurn.outcome === \"planner_blocked\") {\n"
    "          // M2.3-R2-FU: open P0/P1 remain; do not confirm, do not free-form ask.\n"
)
if needle not in s:
    raise SystemExit("needle1 missing")
repl = (
    "        // M2.3-R2-FU3: also fail-closed when Understanding could not be built\n"
    "        // (ask_error carries understanding_exception / planner_exception) or when\n"
    "        // readiness cannot be computed (understanding==null) with no authorized Q.\n"
    "        const m1UnderstandingFailClosed =\n"
    "          !m1CollectingTurn.authorized_question &&\n"
    "          Boolean(m1CollectingTurn.ask_error) &&\n"
    "          (m1CollectingTurn.ask_error!.includes(\"understanding_exception\") ||\n"
    "            m1CollectingTurn.ask_error!.includes(\"planner_exception\") ||\n"
    "            (m1CollectingTurn.understanding == null &&\n"
    "              m1CollectingTurn.outcome === \"ready_no_question\" &&\n"
    "              Boolean(m1CollectingTurn.session.decision_blueprint)));\n"
    "        if (\n"
    "          m1CollectingTurn.outcome === \"planner_blocked\" ||\n"
    "          m1UnderstandingFailClosed\n"
    "        ) {\n"
    "          // M2.3-R2-FU / FU3: open P0/P1 or Understanding failure -- no confirm, no free-form ask.\n"
)
s = s.replace(needle, repl, 1)

old_if2 = (
    "  if (\n"
    "    m1CollectingTurn &&\n"
    "    m1CollectingTurn.outcome === \"planner_blocked\" &&\n"
    "    agent_v2.current_phase !== \"delivered\"\n"
    "  ) {\n"
    "    // Belt-and-suspenders: planner_blocked is nonterminal collecting.\n"
    "    agent_v2 = {\n"
    "      ...agent_v2,\n"
    "      current_phase: \"collecting_context\",\n"
    "      stall_offer_pending: false,\n"
    "    };\n"
    "  } else if (\n"
    "    m1CollectingTurn &&\n"
    "    m1CollectingTurn.outcome !== \"planner_blocked\" &&\n"
    "    m1CollectingTurn.understanding &&\n"
    "    m1CollectingTurn.understanding.readiness.can_ask === false &&\n"
    "    agent_v2.current_phase !== \"delivered\"\n"
    "  ) {"
)
new_if2 = (
    "  const m1BlockedOrUnderstandingFail =\n"
    "    Boolean(m1CollectingTurn) &&\n"
    "    (m1CollectingTurn!.outcome === \"planner_blocked\" ||\n"
    "      (!m1CollectingTurn!.authorized_question &&\n"
    "        Boolean(m1CollectingTurn!.ask_error) &&\n"
    "        (m1CollectingTurn!.ask_error!.includes(\"understanding_exception\") ||\n"
    "          m1CollectingTurn!.ask_error!.includes(\"planner_exception\") ||\n"
    "          (m1CollectingTurn!.understanding == null &&\n"
    "            m1CollectingTurn!.outcome === \"ready_no_question\" &&\n"
    "            Boolean(m1CollectingTurn!.session.decision_blueprint)))));\n"
    "  if (\n"
    "    m1CollectingTurn &&\n"
    "    m1BlockedOrUnderstandingFail &&\n"
    "    agent_v2.current_phase !== \"delivered\"\n"
    "  ) {\n"
    "    // Belt-and-suspenders: planner_blocked / understanding failure is nonterminal collecting.\n"
    "    agent_v2 = {\n"
    "      ...agent_v2,\n"
    "      current_phase: \"collecting_context\",\n"
    "      stall_offer_pending: false,\n"
    "    };\n"
    "  } else if (\n"
    "    m1CollectingTurn &&\n"
    "    !m1BlockedOrUnderstandingFail &&\n"
    "    m1CollectingTurn.understanding &&\n"
    "    m1CollectingTurn.understanding.readiness.can_ask === false &&\n"
    "    agent_v2.current_phase !== \"delivered\"\n"
    "  ) {"
)
if old_if2 not in s:
    raise SystemExit("old_if2 missing")
s = s.replace(old_if2, new_if2, 1)

old_g = (
    "  } else if (\n"
    "    m1CollectingTurn &&\n"
    "    m1CollectingTurn.outcome !== \"planner_blocked\" &&\n"
    "    !m1CollectingTurn.authorized_question &&\n"
    "    m1CollectingTurn.understanding &&\n"
    "    m1CollectingTurn.understanding.readiness.can_ask === false\n"
    "  ) {\n"
    "    // Readiness stop"
)
new_g = (
    "  } else if (\n"
    "    m1CollectingTurn &&\n"
    "    m1CollectingTurn.outcome !== \"planner_blocked\" &&\n"
    "    !(\n"
    "      !m1CollectingTurn.authorized_question &&\n"
    "      Boolean(m1CollectingTurn.ask_error) &&\n"
    "      (m1CollectingTurn.ask_error!.includes(\"understanding_exception\") ||\n"
    "        m1CollectingTurn.ask_error!.includes(\"planner_exception\"))\n"
    "    ) &&\n"
    "    !m1CollectingTurn.authorized_question &&\n"
    "    m1CollectingTurn.understanding &&\n"
    "    m1CollectingTurn.understanding.readiness.can_ask === false\n"
    "  ) {\n"
    "    // Readiness stop"
)
if old_g not in s:
    raise SystemExit("old_g missing")
s = s.replace(old_g, new_g, 1)
out = s.replace("\n", "\r\n") if nl == "\r\n" else s
rel.write_text(out, encoding="utf-8", newline="")
print("agent patched", len(out))
