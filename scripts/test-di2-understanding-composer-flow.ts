import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deliveryConfirmButtonLabel } from "../lib/poju/delivery-confirm-reply";
import { understandingGateConfirmButtonLabel } from "../lib/poju/understanding-gate-reply";
import {
  isDi2FinalUnderstandingSupplementTurn,
  isFinalUnderstandingConfirmText,
  isOfficialFinalConfirmLabel,
  sessionEligibleForFinalConfirm,
  sessionReadyForFinalConfirm,
} from "../lib/poju/decision-intake/confirm-and-freeze";
import { projectDecisionUnderstandingBox } from "../lib/poju/decision-intake/ui-projection";
import type { POJUSessionState } from "../lib/poju/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { DecisionBlueprint, UnderstandingState } from "../lib/poju/decision-intake/types";

const t = (name: string, fn: () => void) => {
  fn();
  console.log(`PASS ${name}`);
};

let passed = 0;
const wrap = (name: string, fn: () => void) => {
  t(name, fn);
  passed += 1;
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function baseBlueprint(): DecisionBlueprint {
  return {
    blueprint_id: "bp_test",
    schema_version: "1",
    decision_type: "career",
    directions: [
      { direction_id: "dir_primary", label: "Timing", priority: "P0", dir_ids: ["DIR_TIME"], required_for_stop: true },
    ],
    question_budget: { soft: 6, hard: 10 },
    created_at: "2026-11-18T12:00:00.000Z",
  } as DecisionBlueprint;
}

function readyUnderstanding(overrides: Partial<UnderstandingState> = {}): UnderstandingState {
  return {
    current_understanding: {
      summary: "The user is weighing a job change against a family move.",
      confirmed_briefs: ["Has a written offer"],
      unconfirmed_briefs: [],
      analysis_briefs: [],
      fingerprint: "fp1",
    },
    understood: {
      items: [
        { dir_id: "DIR_TIME", label: "Has a written offer", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
      ],
    },
    need_to_understand: {
      items: [
        {
          kind: "dir_based",
          missing_content: "The latest date a decision must be made",
          why: "deadline still open",
          priority: "P0",
          direction_id: "dir_primary",
          dir_ids: ["DIR_TIME"],
          gap_type: "unknown",
        },
      ],
    },
    personal_pattern_insight: { status: "none", insights: [] },
    readiness: {
      verdict: "ready_for_final_confirm",
      can_ask: false,
      reasons: ["sufficiency gate passed"],
    },
    readiness_progress: { percent: 91, complete: false, weights_version: "1" },
    budget: {
      soft_budget_limit: 6,
      hard_budget_limit: 10,
      session_asked_count: 4,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 6,
      depth_by_dir: {},
    },
    last_sent_question: { question_text: "What is the latest date you must decide?", plan_id: "plan_1" },
    next_question_plan: null,
    ...overrides,
  } as UnderstandingState;
}

function readySession(overrides: Partial<POJUSessionState> = {}): POJUSessionState {
  return {
    session_id: "sess_di2_box",
    decision_blueprint: baseBlueprint(),
    decision_context: {
      context_id: "dc_1",
      version: 3,
      status: "draft",
      content_hash: "hash",
      reality_facts: [
        { fact_id: "f1", text: "Has a written offer", status: "confirmed", user_confirmed: true },
        { fact_id: "f2", text: "Might relocate", status: "unverified" },
        { fact_id: "f3", text: "Would not say the salary", status: "declined" },
      ],
      dirs: [{ dir_id: "DIR_TIME", need: "Decision deadline", current_state: "unknown", id_lifecycle: "active" }],
      conflicts: [
        { conflict_id: "c1", conflict_field: "move_date", state: "open", statements_snapshot: ["Wants to move in May", "Lease ends in August"] },
      ],
    } as DecisionContext,
    decision_understanding: readyUnderstanding(),
    agent_v2: { current_phase: "awaiting_confirmation", stall_offer_pending: false },
    ...overrides,
  } as POJUSessionState;
}

function main() {
  const chat = read("components/poju/PojuChat.tsx");
  const ui = read("components/poju/POJUChatUI.tsx");
  const panel = read("components/poju/DecisionUnderstandingPanel.tsx");
  const css = read("components/poju/poju-chat.css");

  wrap("A/layout: composerTop slot sits in the input bar above the composer unit", () => {
    assert.match(chat, /composerTop\?: ReactNode/);
    const inputbar = chat.slice(chat.indexOf("pchat__inputbar"));
    const top = inputbar.indexOf("pchat__composer-top");
    const unit = inputbar.indexOf("pchat__composer-unit");
    assert.ok(top >= 0 && unit > top, "composer-top must be rendered before composer-unit inside the input bar");
    assert.doesNotMatch(inputbar.slice(unit, unit + 800), /composerTop/);
    assert.match(css, /\.pchat__composer-top\s*\{/);
    assert.match(css, /max-height:\s*min\(42vh/);
  });

  wrap("A/layout: composerTop is not a message and is not hidden by centerSlot", () => {
    assert.doesNotMatch(chat, /composerTop[\s\S]{0,200}hidden=\{Boolean\(centerSlot\)\}/);
    const notice = chat.slice(chat.indexOf("pchat__inline-notice") >= 0 ? chat.indexOf("className=\"pchat__inline-notice\"") : 0);
    assert.match(chat, /hidden=\{Boolean\(centerSlot\)\}/);
    assert.doesNotMatch(chat.slice(chat.indexOf("pchat__composer-top"), chat.indexOf("pchat__composer-top") + 200), /centerSlot/);
    assert.match(ui, /composerTop=\{composerTopNode\}/);
    assert.doesNotMatch(ui.slice(ui.indexOf("inlineNotice={"), ui.indexOf("editDialog={")), /DecisionUnderstandingPanel/);
    assert.match(ui, /composerTopNode[\s\S]*DecisionUnderstandingPanel/);
  });

  wrap("A/layout: three quick replies stay inside the composer unit, not in the Understanding box", () => {
    const unitStart = chat.indexOf("pchat__composer-unit");
    const unitBlock = chat.slice(unitStart, unitStart + 1600);
    assert.match(unitBlock, /pchat__composer-options/);
    assert.match(unitBlock, /<PojuReplyOptions/);
    assert.doesNotMatch(panel, /PojuReplyOptions|UnderstandingGateActions|composerOptions|activeComposerOptions/);
    assert.match(ui, /composerOptions=\{activeComposerOptions\}/);
    assert.match(ui, /withoutDyad\.length >= 2 \? withoutDyad\.slice\(0, 3\)/);
  });

  wrap("B/7.2: panel order and no internal IDs or debug fields", () => {
    const titleIdx = panel.indexOf('isZh ? "\\u51b3\\u7b56\\u7406\\u89e3" : "DECISION UNDERSTANDING"') >= 0
      ? panel.indexOf('isZh ? "\\u51b3\\u7b56\\u7406\\u89e3" : "DECISION UNDERSTANDING"')
      : panel.indexOf("DECISION UNDERSTANDING");
    assert.ok(titleIdx >= 0, "title must be DECISION UNDERSTANDING / Chinese equivalent");
    const currentIdx = panel.indexOf("Current understanding");
    const alreadyIdx = panel.indexOf("Already understood");
    const needIdx = panel.indexOf("Still need to understand");
    const insightIdx = panel.indexOf("Personal Pattern Insight");
    const qIdx = panel.indexOf("Current question");
    assert.ok(titleIdx < currentIdx && currentIdx < alreadyIdx && alreadyIdx < needIdx && needIdx < insightIdx && insightIdx < qIdx);
    assert.match(panel, /projectDecisionUnderstandingBox/);
    assert.doesNotMatch(panel, /dir_id|direction_id|ddr_id|readiness_verdict|budget_asked|readiness_can_ask|investigation_directions|personal_pattern_status/);
  });

  wrap("C/data: confirmed facts only; unknown/declined/unverified stay out of already understood", () => {
    const box = projectDecisionUnderstandingBox(readySession());
    assert.deepEqual(box.already_understood, ["Has a written offer"]);
    assert.ok(box.still_need.some((item) => item.includes("latest date")));
    assert.ok(box.conflicts.some((item) => item.includes("May") && item.includes("August")));
    assert.equal(box.progress_percent, 91);
    assert.equal(box.progress_complete, false);
    assert.equal(box.show_personal_pattern, false);
    assert.equal(box.current_question, "What is the latest date you must decide?");
    const leaked = JSON.stringify(box);
    assert.doesNotMatch(leaked, /DIR_TIME|dir_primary|bp_test|move_date|c1|f2|f3/);
  });

  wrap("C/data: progress never shows 100% before completion; insights only when substantive", () => {
    const incomplete = projectDecisionUnderstandingBox(
      readySession({
        decision_understanding: readyUnderstanding({
          readiness_progress: { percent: 100, complete: false, weights_version: "1" },
        }),
      }),
    );
    assert.equal(incomplete.progress_percent, 99);
    const complete = projectDecisionUnderstandingBox(
      readySession({
        decision_understanding: readyUnderstanding({
          readiness_progress: { percent: 100, complete: true, weights_version: "1" },
        }),
      }),
    );
    assert.equal(complete.progress_percent, 100);
    const withInsight = projectDecisionUnderstandingBox(
      readySession({
        decision_understanding: readyUnderstanding({
          personal_pattern_insight: {
            status: "available",
            insights: [{ text: "A helpful career pattern", source: "bazi_dir_primary", related_dir_ids: ["DIR_TIME"] }],
          },
        } as Partial<UnderstandingState>),
      }),
    );
    assert.equal(withInsight.show_personal_pattern, true);
    assert.deepEqual(withInsight.personal_pattern_insights, ["A helpful career pattern"]);
    assert.doesNotMatch(JSON.stringify(withInsight), /bazi_dir_primary|DIR_TIME|related_dir_ids/);
  });

  wrap("D/confirm: official in-input confirm labels enter the existing Freeze path", () => {
    for (const locale of ["zh", "en", "es", "fr"]) {
      const label = deliveryConfirmButtonLabel(locale);
      assert.equal(isOfficialFinalConfirmLabel(label), true, label);
      assert.equal(isFinalUnderstandingConfirmText(label), true, label);
      assert.equal(sessionEligibleForFinalConfirm(readySession(), label), true, label);
      assert.equal(isDi2FinalUnderstandingSupplementTurn(readySession(), label), false, label);
    }
    assert.equal(isFinalUnderstandingConfirmText("\u786e\u8ba4"), true);
    assert.equal(isOfficialFinalConfirmLabel(understandingGateConfirmButtonLabel("zh")), true);
  });

  wrap("E/supplement: non-confirm text at the readiness gate returns to Adaptive Question, keeping DC", () => {
    const session = readySession();
    const facts = session.decision_context?.reality_facts?.map((f) => f.fact_id);
    assert.equal(isDi2FinalUnderstandingSupplementTurn(session, "\u6211\u4e0b\u5468\u8981\u642c\u5bb6\uff0c\u8fd9\u70b9\u4e4b\u524d\u6ca1\u8bf4\u6e05\u695a\u3002"), true);
    assert.equal(isDi2FinalUnderstandingSupplementTurn(session, "\u8865\u5145\u4e00\u70b9"), true);
    assert.equal(sessionReadyForFinalConfirm(session), true);
    assert.deepEqual(session.decision_context?.reality_facts?.map((f) => f.fact_id), facts);
    assert.equal(isDi2FinalUnderstandingSupplementTurn(readySession({ decision_blueprint: undefined }), "need to add a deadline"), false);
    assert.equal(
      isDi2FinalUnderstandingSupplementTurn(
        readySession({
          decision_understanding: readyUnderstanding({
            readiness: { verdict: "continue", can_ask: true, reasons: [] },
          }),
        }),
        "need to add a deadline",
      ),
      false,
    );
  });

  wrap("F/UI: DI2 confirm chip is not routed to legacy synthesis; report surface hides Q&A", () => {
    const marker = "Official confirm chip must enter confirm-and-freeze";
    const pickStart = ui.indexOf(marker);
    assert.ok(pickStart >= 0, "DI2 confirm routing comment missing");
    const pick = ui.slice(pickStart - 400, pickStart + 500);
    assert.match(pick, /isDecisionIntakeV2Session\(session\)/);
    assert.match(pick, /void handlePojuSend\(opt\)/);
    assert.doesNotMatch(pick, /void handleDeliveryConfirmGateClick\("confirmed"\)/);
    assert.match(ui, /di2ReportSurfaceActive/);
    assert.match(ui, /pending_decision_report_job_id/);
    assert.match(ui, /showUnderstandingDock = Boolean\(session\.agent_v2\) && !di2ReportSurfaceActive/);
    assert.match(ui, /!session\.decision_understanding \? \(/);
    assert.match(ui, /<AgendaProgressPanel/);
  });

  wrap("G/report chain: confirm-and-freeze auto-starts the existing Freeze-bound report client", () => {
    assert.match(ui, /runDecisionReportForSession/);
    assert.match(ui, /di2ReportNeedsAutoStart/);
    assert.match(ui, /di2ReportShouldResume/);
    assert.match(ui, /currentDi2FreezeId/);
    const client = read("lib/poju/decision-intake/decision-report-client.ts");
    assert.match(client, /dc\.status !== "final"/);
    assert.match(client, /pending_decision_report_job_id/);
    assert.match(client, /freeze_bound_report_jobs/);
    assert.match(client, /reused/);
  });

  function sessionWithUnderstoodItems(items: UnderstandingState["understood"]["items"]) {
    return readySession({
      decision_understanding: readyUnderstanding({
        understood: { items },
        personal_pattern_insight: {
          status: "available",
          insights: [{ text: "A helpful career pattern", source: "bazi_dir_primary", related_dir_ids: ["DIR_TIME"] }],
        },
      } as Partial<UnderstandingState>),
    });
  }

  wrap("H/filter: known + user_confirmed_any true enters already_understood", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_TIME", label: "Has a written offer", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
      ]),
    );
    assert.deepEqual(box.already_understood, ["Has a written offer"]);
  });

  wrap("H/filter: known + user_confirmed_any false must not enter already_understood", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_INFERRED", label: "Model inferred the team is unstable", fact_ids: ["f2"], status: "known", user_confirmed_any: false },
      ]),
    );
    assert.deepEqual(box.already_understood, []);
    assert.ok(!box.already_understood.includes("Model inferred the team is unstable"));
  });

  wrap("H/filter: n_a + user_confirmed_any true is confirmed not-applicable, not an ordinary fact", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_VISA", label: "Visa requirement", fact_ids: ["f_na"], status: "n_a", user_confirmed_any: true },
      ]),
    );
    assert.equal(box.already_understood.length, 1);
    assert.ok(box.already_understood.includes("Visa requirement"));
    // Keep the existing string-list contract. Do not substitute a confirmed RealityFact
    // sentence, so this n_a item is not disguised as "Has a written offer" or similar.
    assert.ok(!box.already_understood.includes("Has a written offer"));
    assert.ok(!box.already_understood.includes("Might relocate"));
    assert.ok(!box.already_understood.some((label) => /confirmed fact/i.test(label)));
  });

  wrap("H/filter: n_a + user_confirmed_any false must not enter already_understood", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_VISA", label: "Visa requirement", fact_ids: [], status: "n_a", user_confirmed_any: false },
      ]),
    );
    assert.deepEqual(box.already_understood, []);
    assert.ok(!box.already_understood.includes("Visa requirement"));
  });

  wrap("H/filter: mixed items output only confirmation-eligible labels", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_TIME", label: "Has a written offer", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
        { dir_id: "DIR_INFERRED", label: "Model inferred the team is unstable", fact_ids: ["f2"], status: "known", user_confirmed_any: false },
        { dir_id: "DIR_VISA", label: "Visa requirement", fact_ids: ["f_na"], status: "n_a", user_confirmed_any: true },
        { dir_id: "DIR_SKIP", label: "Covered but unconfirmed skip", fact_ids: [], status: "n_a", user_confirmed_any: false },
        { dir_id: "DIR_BLANK", label: "   \n\t  ", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
      ]),
    );
    assert.deepEqual(box.already_understood, ["Has a written offer", "Visa requirement"]);
    assert.ok(!box.already_understood.includes("Model inferred the team is unstable"));
    assert.ok(!box.already_understood.includes("Covered but unconfirmed skip"));
    assert.ok(!box.already_understood.some((label) => label.trim() === ""));
  });

  wrap("H/filter: still_need, conflicts, progress, insight, and current question are preserved", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_INFERRED", label: "Model inferred the team is unstable", fact_ids: ["f2"], status: "known", user_confirmed_any: false },
        { dir_id: "DIR_TIME", label: "Has a written offer", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
      ]),
    );
    assert.deepEqual(box.already_understood, ["Has a written offer"]);
    assert.ok(box.still_need.some((item) => item.includes("latest date")));
    assert.ok(box.conflicts.some((item) => item.includes("May") && item.includes("August")));
    assert.equal(box.progress_percent, 91);
    assert.equal(box.progress_complete, false);
    assert.equal(box.show_personal_pattern, true);
    assert.deepEqual(box.personal_pattern_insights, ["A helpful career pattern"]);
    assert.equal(box.current_question, "What is the latest date you must decide?");
  });

  wrap("H/filter: empty cleaned labels are omitted even when otherwise eligible", () => {
    const box = projectDecisionUnderstandingBox(
      sessionWithUnderstoodItems([
        { dir_id: "DIR_BLANK", label: " \n  \t ", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
        { dir_id: "DIR_TIME", label: "Has a written offer", fact_ids: ["f1"], status: "known", user_confirmed_any: true },
      ]),
    );
    assert.deepEqual(box.already_understood, ["Has a written offer"]);
  });

  console.log(`Passed ${passed} checks`);
}

main();
