const fs = require("fs");
const path = require("path");

const root = "D:/POJU/pojulife";

function read(p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}
function write(p, s) {
  fs.writeFileSync(path.join(root, p), s, "utf8");
  console.log("wrote", p, "bytes", Buffer.byteLength(s));
}

// ---------- 1. adaptive-turn.ts ----------
{
  const p = "lib/poju/decision-intake/adaptive-turn.ts";
  let s = read(p);
  const oldCatchTail = `    if (u) {
      const openP0P1 = openBlueprintP0P1Needs(u);
      if (openP0P1.length > 0 && u.budget.remaining_hard_budget > 0) {
        const blockedU: UnderstandingState = {
          ...u,
          next_question_plan: null,
          readiness: {
            ...u.readiness,
            verdict: "continue",
            can_ask: true,
            reasons: [
              ...u.readiness.reasons,
              "open_blueprint_p0_p1_obligations",
              "planner_blocked",
              "planner_exception",
            ],
          },
        };
        return {
          session: withUnderstanding(
            current,
            blockedU,
            null,
            current.intake_ask_plan ?? null,
          ),
          outcome: "planner_blocked",
          ask_error: \`planner_exception:\${err}\`,
          answer_event,
          understanding: blockedU,
          plan: null,
          authorized_question: null,
          persist_error,
        };
      }
    }
    return {
      session: current,
      outcome: "ready_no_question",
      answer_event,
      understanding: u,
      plan: null,
      authorized_question: null,
      persist_error,
      ask_error: err,
    };
  }
}`;

  if (!s.includes(oldCatchTail)) {
    console.error("adaptive-turn catch tail not found exactly");
    process.exit(1);
  }

  const newCatchTail = `    if (u) {
      const openP0P1 = openBlueprintP0P1Needs(u);
      if (openP0P1.length > 0 && u.budget.remaining_hard_budget > 0) {
        const blockedU: UnderstandingState = {
          ...u,
          next_question_plan: null,
          readiness: {
            ...u.readiness,
            verdict: "continue",
            can_ask: true,
            reasons: [
              ...u.readiness.reasons,
              "open_blueprint_p0_p1_obligations",
              "planner_blocked",
              "planner_exception",
            ],
          },
        };
        return {
          session: withUnderstanding(
            current,
            blockedU,
            null,
            current.intake_ask_plan ?? null,
          ),
          outcome: "planner_blocked",
          ask_error: \`planner_exception:\${err}\`,
          answer_event,
          understanding: blockedU,
          plan: null,
          authorized_question: null,
          persist_error,
        };
      }
    }

    // M2.3-R2-FU3: Understanding rebuild failed (u==null). Cannot infer P0/P1
    // complete from missing needs. Conservative fail-closed while Blueprint
    // exists and hard budget may remain — never ready_no_question / free-ask.
    if (!u && current.decision_blueprint) {
      let hardBudgetRemains = true;
      try {
        const hard = current.decision_blueprint.question_budget.hard;
        const asked =
          current.decision_understanding?.budget?.session_asked_count ?? 0;
        hardBudgetRemains = hard - asked > 0;
      } catch {
        // Cannot read budget either — treat as remaining (fail-closed).
        hardBudgetRemains = true;
      }
      if (hardBudgetRemains) {
        return {
          session: current,
          outcome: "planner_blocked",
          ask_error: \`understanding_exception:\${err}\`,
          answer_event,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error,
        };
      }
    }

    return {
      session: current,
      outcome: "ready_no_question",
      answer_event,
      understanding: u,
      plan: null,
      authorized_question: null,
      persist_error,
      ask_error: err,
    };
  }
}`;

  s = s.replace(oldCatchTail, newCatchTail);
  write(p, s);
}

// ---------- 2. agent.ts ----------
{
  const p = "lib/poju/agent.ts";
  let s = read(p);

  const oldBlock = `        if (m1CollectingTurn.outcome === "planner_blocked") {
          // M2.3-R2-FU: open P0/P1 remain; do not confirm, do not free-form ask.
          const blockReason =
            m1CollectingTurn.ask_error?.trim() ||
            "planner_blocked_open_p0_p1";`;

  if (!s.includes(oldBlock)) {
    console.error("agent planner_blocked block not found");
    process.exit(1);
  }

  const newBlock = `        // M2.3-R2-FU3: also fail-closed when Understanding could not be built
        // (ask_error carries understanding_exception / planner_exception) or when
        // readiness cannot be computed (understanding==null) with no authorized Q.
        const m1UnderstandingFailClosed =
          !m1CollectingTurn.authorized_question &&
          Boolean(m1CollectingTurn.ask_error) &&
          (m1CollectingTurn.ask_error!.includes("understanding_exception") ||
            m1CollectingTurn.ask_error!.includes("planner_exception") ||
            (m1CollectingTurn.understanding == null &&
              m1CollectingTurn.outcome === "ready_no_question" &&
              Boolean(m1CollectingTurn.session.decision_blueprint)));
        if (
          m1CollectingTurn.outcome === "planner_blocked" ||
          m1UnderstandingFailClosed
        ) {
          // M2.3-R2-FU / FU3: open P0/P1 or Understanding failure — no confirm, no free-form ask.
          const blockReason =
            m1CollectingTurn.ask_error?.trim() ||
            "planner_blocked_open_p0_p1";`;

  s = s.replace(oldBlock, newBlock);

  // Also update the later belt-and-suspenders checks that gate on planner_blocked
  // so Understanding-fail-closed sessions never advance to awaiting_confirmation.
  const oldBelt1 = `  if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome === "planner_blocked" &&
    agent_v2.current_phase !== "delivered"
  ) {
    // Belt-and-suspenders: planner_blocked is nonterminal collecting.
    agent_v2 = {
      ...agent_v2,
      current_phase: "collecting_context",
      stall_offer_pending: false,
    };
  } else if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome !== "planner_blocked" &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false &&
    agent_v2.current_phase !== "delivered"
  ) {`;

  if (!s.includes(oldBelt1)) {
    console.error("agent belt1 not found");
    process.exit(1);
  }

  const newBelt1 = `  const m1BlockedOrUnderstandingFail =
    Boolean(m1CollectingTurn) &&
    (m1CollectingTurn!.outcome === "planner_blocked" ||
      (!m1CollectingTurn!.authorized_question &&
        Boolean(m1CollectingTurn!.ask_error) &&
        (m1CollectingTurn!.ask_error!.includes("understanding_exception") ||
          m1CollectingTurn!.ask_error!.includes("planner_exception") ||
          (m1CollectingTurn!.understanding == null &&
            m1CollectingTurn!.outcome === "ready_no_question" &&
            Boolean(m1CollectingTurn!.session.decision_blueprint)))));
  if (
    m1CollectingTurn &&
    m1BlockedOrUnderstandingFail &&
    agent_v2.current_phase !== "delivered"
  ) {
    // Belt-and-suspenders: planner_blocked / understanding failure is nonterminal collecting.
    agent_v2 = {
      ...agent_v2,
      current_phase: "collecting_context",
      stall_offer_pending: false,
    };
  } else if (
    m1CollectingTurn &&
    !m1BlockedOrUnderstandingFail &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false &&
    agent_v2.current_phase !== "delivered"
  ) {`;

  s = s.replace(oldBelt1, newBelt1);

  const oldConfirmGate = `  } else if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome !== "planner_blocked" &&
    !m1CollectingTurn.authorized_question &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false
  ) {
    // Readiness stop`;

  if (!s.includes(oldConfirmGate)) {
    console.error("agent confirm gate not found");
    // show nearby
    const idx = s.indexOf("m1CollectingTurn.outcome !== \"planner_blocked\"");
    console.error("idx", idx, s.slice(idx, idx + 300));
    process.exit(1);
  }

  const newConfirmGate = `  } else if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome !== "planner_blocked" &&
    !(
      !m1CollectingTurn.authorized_question &&
      Boolean(m1CollectingTurn.ask_error) &&
      (m1CollectingTurn.ask_error!.includes("understanding_exception") ||
        m1CollectingTurn.ask_error!.includes("planner_exception"))
    ) &&
    !m1CollectingTurn.authorized_question &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false
  ) {
    // Readiness stop`;

  s = s.replace(oldConfirmGate, newConfirmGate);
  write(p, s);
}

console.log("phase1 production patches ok");
