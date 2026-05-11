import { detectAbuse } from "@/lib/poju/abuse-detection";
import { applyUserProfileToSession, canLeavePhase2 } from "@/lib/poju/apply-profile";
import { getPojuPhaseCopy } from "@/lib/poju/phase-messages";
import { MECHANICAL_REFUSALS } from "@/lib/i18n/mechanical-refusals";
import { generatePhase4Actions } from "@/lib/poju/actions";
import { detectTopicDrift } from "@/lib/poju/drift-detection";
import { lockSessionTopicIfNeeded, topicAnchorText } from "@/lib/poju/topic-lock";
import { confirmRuleBasedDriftWithLLM, generatePojuPhaseReply } from "@/lib/llm/poju-llm";
import type { SessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

function routePhase(session: SessionState, _input: string, locale: string): { nextPhase: SessionState["phase"]; reply: string } {
  const copy = getPojuPhaseCopy(locale);
  if (session.phase === 1) {
    const hasProfile = !!session.userProfileId;
    if (hasProfile) {
      return { nextPhase: 3, reply: copy.phase1HasProfileTo3 };
    }
    return { nextPhase: 2, reply: copy.phase1To2NeedForm };
  }

  if (session.phase === 2) {
    if (canLeavePhase2(session)) {
      return { nextPhase: 3, reply: copy.phase2To3Complete };
    }
    return { nextPhase: 2, reply: copy.phase2NeedMore };
  }

  if (session.phase === 3) {
    const turns = session.messages.filter((m) => m.role === "user").length;
    if (turns >= 4) {
      return { nextPhase: 4, reply: copy.phase3To4 };
    }
    return { nextPhase: 3, reply: copy.phase3Loop };
  }

  if (session.phase === 4) {
    const lines =
      session.actions.length > 0
        ? session.actions.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
        : "1. (Actions will appear on your next turn.)";
    return {
      nextPhase: 5,
      reply: `${copy.phase4ActionIntro}\n${lines}\n${copy.phase4ActionFooter}`,
    };
  }

  return { nextPhase: 5, reply: copy.phase5Track };
}

function enrichCollection(session: SessionState, input: string): void {
  if (session.phase !== 2) return;
  const lower = input.toLowerCase();
  if (!session.collection.name && /(my name is|i am|我是)/i.test(lower)) session.collection.name = input.slice(0, 40);
  if (!session.collection.birthDate && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(input)) session.collection.birthDate = input.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0];
  if (!session.collection.birthTime && /\b([01]?\d|2[0-3]):[0-5]\d\b/.test(input)) session.collection.birthTime = input.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0];
  if (!session.collection.location && /(city|born in|在|市|province)/i.test(lower)) session.collection.location = input.slice(0, 40);
}

export async function runPojuTurn(
  session: SessionState,
  input: string,
  locale: string = "en",
  userProfile?: UserProfile | null,
): Promise<{ reply: string; next: SessionState }> {
  const refusal = MECHANICAL_REFUSALS[locale] ?? MECHANICAL_REFUSALS.en;
  if (userProfile) {
    applyUserProfileToSession(session, userProfile);
  }
  const totalChars = session.abuse.totalChars + input.length;
  const abuse = detectAbuse(input, totalChars);
  if (abuse.blocked) {
    session.abuse.blockedCount += 1;
    session.status = "suspended";
    return {
      reply: `${refusal.abuse} (${abuse.reason})`,
      next: session,
    };
  }

  session.abuse.messageCount += 1;
  session.abuse.totalChars = totalChars;
  session.lastInteractionAt = Date.now();

  lockSessionTopicIfNeeded(session, input);

  const firstUser = session.messages.find((m) => m.role === "user")?.text ?? "";
  const anchor = topicAnchorText(session, firstUser);
  if (session.phase >= 3 && anchor) {
    const drift = detectTopicDrift(anchor, input);
    if (drift.drift) {
      const llmOffTopic = await confirmRuleBasedDriftWithLLM(anchor, input, locale);
      // Only refuse on explicit LLM "off topic". `null` = no client, parse error, or ambiguous — fail open so the main Gemini path still runs.
      if (llmOffTopic === true) {
        return {
          reply: refusal.drift,
          next: session,
        };
      }
    }
  }

  enrichCollection(session, input);
  const prevPhase = session.phase;
  const routed = routePhase(session, input, locale);
  if (session.phase === 3 && routed.nextPhase === 4) {
    session.actions = generatePhase4Actions(session, input);
  }
  session.phase = routed.nextPhase;

  let reply = routed.reply;
  const llmReply = await generatePojuPhaseReply({
    session,
    locale,
    userInput: input,
    templateReply: reply,
    phaseBefore: prevPhase,
    phaseAfter: routed.nextPhase,
  });
  if (llmReply) reply = llmReply;

  return {
    reply,
    next: session,
  };
}
