import type { ActionItem, SessionState } from "@/lib/poju/types";

function makeAction(title: string): ActionItem {
  return {
    id: `act_${Math.random().toString(36).slice(2, 8)}`,
    title,
    status: "todo",
    createdAt: Date.now(),
  };
}

export function generatePhase4Actions(session: SessionState, userInput: string): ActionItem[] {
  const base = userInput.trim().slice(0, 60) || "your core decision";
  return [
    makeAction(`Write a one-page decision brief about ${base} (facts only).`),
    makeAction("Run one low-risk experiment in 48 hours and capture result."),
    makeAction("Set a review checkpoint and decide keep / pivot / stop."),
  ];
}

export function updateActionStatus(session: SessionState, actionId: string, status: ActionItem["status"]): SessionState {
  session.actions = session.actions.map((a) => (a.id === actionId ? { ...a, status } : a));
  return session;
}
