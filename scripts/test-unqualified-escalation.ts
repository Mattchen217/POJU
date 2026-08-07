/**
 * Smoke: unqualified-answer gate — no force-cover; streak; escalation copy.
 * Run: pnpm exec tsx scripts/test-unqualified-escalation.ts
 */
import assert from "node:assert/strict";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  extractModelTurnSignals,
  parseReplyQuality,
} from "@/lib/poju/state-machine";
import {
  clampUnqualifiedLevel,
  formatUnqualifiedEscalationCopy,
  resolveUnqualifiedEscalation,
  UNQUALIFIED_ESCALATION_MAX,
  UNQUALIFIED_REFUND_EMAIL,
  UNQUALIFIED_WIPE_AFTER_MS,
} from "@/lib/poju/unqualified-escalation";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";

function baseCollectingAgent(agenda: AgendaItem[]) {
  const agent = createInitialAgentState({ original_question: "Should I leave this job?" });
  return {
    ...agent,
    current_phase: "collecting_context" as const,
    investigation_agenda: agenda,
    agenda_generated: true,
  };
}

function agendaItem(label: string, status: AgendaItem["status"] = "unexplored"): AgendaItem {
  return {
    id: `a-${label}`,
    label,
    critical: true,
    status,
    unqualified_streak: 0,
  };
}

function testParseReplyQuality() {
  assert.equal(parseReplyQuality("clear"), "clear");
  assert.equal(parseReplyQuality("vague"), "vague");
  assert.equal(parseReplyQuality("fuzzy"), "vague");
  assert.equal(parseReplyQuality("nope"), undefined);
  console.log("ok parseReplyQuality");
}

function testNoForceCoverOnTwoVague() {
  let agent = baseCollectingAgent([agendaItem("What triggered this?")]);

  for (let i = 0; i < 2; i++) {
    const signals = extractModelTurnSignals({
      reply_quality: "vague",
      agenda_updates: { completed_in_this_turn: [] },
    });
    const r = advanceStateMachine(agent, signals, "嗯");
    agent = r.next_agent;
  }

  const item = agent.investigation_agenda[0]!;
  assert.notEqual(item.status, "covered", "vague twice must not force-cover");
  assert.equal(item.status, "partial");
  assert.equal(item.unqualified_streak, 2);
  assert.equal(agent.current_phase, "collecting_context");
  console.log("ok no force-cover on two vague");
}

function testClearCompletesAndResetsStreak() {
  let agent = baseCollectingAgent([
    { ...agendaItem("What triggered this?"), status: "partial", unqualified_streak: 2 },
  ]);

  const signals = extractModelTurnSignals({
    reply_quality: "clear",
    agenda_updates: { completed_in_this_turn: ["What triggered this?"] },
  });
  const r = advanceStateMachine(agent, signals, "It started after the promotion last March.");
  agent = r.next_agent;
  const item = agent.investigation_agenda[0]!;
  assert.equal(item.status, "covered");
  assert.equal(item.unqualified_streak, 0);
  console.log("ok clear completes + resets streak");
}

function testVagueBlocksCompletedReport() {
  let agent = baseCollectingAgent([agendaItem("What triggered this?")]);
  const signals = extractModelTurnSignals({
    reply_quality: "vague",
    agenda_updates: { completed_in_this_turn: ["What triggered this?"] },
  });
  const r = advanceStateMachine(agent, signals, "asdf");
  const item = r.next_agent.investigation_agenda[0]!;
  assert.notEqual(item.status, "covered", "vague must block cover even if model listed completed");
  assert.equal(item.unqualified_streak, 1);
  console.log("ok vague blocks completed report");
}

function testStreakToFour() {
  let agent = baseCollectingAgent([agendaItem("Focus A")]);
  for (let i = 1; i <= UNQUALIFIED_ESCALATION_MAX; i++) {
    const signals = extractModelTurnSignals({
      reply_quality: "vague",
      agenda_updates: { completed_in_this_turn: [] },
    });
    const r = advanceStateMachine(agent, signals, "???");
    agent = r.next_agent;
    assert.equal(agent.investigation_agenda[0]!.unqualified_streak, i);
  }
  console.log("ok streak climbs to 4");
}

function testEscalationCopy() {
  assert.equal(clampUnqualifiedLevel(1), 1);
  assert.equal(clampUnqualifiedLevel(99), 4);
  const l1 = resolveUnqualifiedEscalation({ streak: 1, sessionId: "sid-1", locale: "en" });
  assert.ok(l1 && !l1.lock);
  assert.match(l1!.content, /didn’t quite catch|didn't quite catch/i);

  const l4 = resolveUnqualifiedEscalation({
    streak: 4,
    sessionId: "abc-session-99",
    locale: "en",
  });
  assert.ok(l4?.lock);
  assert.equal(l4!.wipeAfterMs, UNQUALIFIED_WIPE_AFTER_MS);
  assert.ok(l4!.content.includes("abc-session-99"));
  assert.ok(l4!.content.includes(UNQUALIFIED_REFUND_EMAIL));

  const zh = formatUnqualifiedEscalationCopy({
    level: 4,
    sessionId: "zh-id",
    locale: "zh",
  });
  assert.ok(zh.includes("zh-id"));
  assert.ok(zh.includes("PASS"));
  console.log("ok escalation copy L1–L4");
}

function testMissingQualityWithoutCompleteCountsVague() {
  let agent = baseCollectingAgent([agendaItem("Focus B")]);
  const signals = extractModelTurnSignals({
    agenda_updates: { completed_in_this_turn: [] },
  });
  const r = advanceStateMachine(agent, signals, "whatever");
  assert.equal(r.next_agent.investigation_agenda[0]!.unqualified_streak, 1);
  assert.notEqual(r.next_agent.investigation_agenda[0]!.status, "covered");
  console.log("ok missing reply_quality without complete → vague streak");
}

function main() {
  testParseReplyQuality();
  testNoForceCoverOnTwoVague();
  testClearCompletesAndResetsStreak();
  testVagueBlocksCompletedReport();
  testStreakToFour();
  testEscalationCopy();
  testMissingQualityWithoutCompleteCountsVague();
  console.log("\nAll unqualified-escalation smoke checks passed.");
}

main();
