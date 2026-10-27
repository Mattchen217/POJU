/** Client events for joint-decision sidebar / open host. */

import type { JointDecisionPublicView } from "@/lib/passes/household-types";

export const JOINT_LIST_UPDATED_EVENT = "pojulife:joint-list-updated";

export const JOINT_ENTRY_MODE_EVENT = "pojulife:joint-entry-mode";

export const JOINT_OPEN_EVENT = "pojulife:joint-open";

export const JOINT_PORTRAIT_CLOSED_EVENT = "pojulife:joint-portrait-closed";

/** Chat paywall tip under welcome — retry joint PASS charge. */
export const JOINT_PASS_RETRY_EVENT = "pojulife:joint-pass-retry";

/** Open Pass purchase / subscribe modal from joint insufficient-PASS copy. */
export const JOINT_PASS_BUY_EVENT = "pojulife:joint-pass-buy";

/** sessionStorage: set while waiting for baseline portrait close during joint start. */
export const JOINT_AWAIT_PORTRAIT_KEY = "pojulife:joint-await-portrait";

/** sessionStorage: joint ids that entered chat after the 10s prepare (invite card must hide). */
export const JOINT_ENTERED_CHAT_KEY = "pojulife:joint-entered-chat";

export const JOINT_ENTERED_CHAT_EVENT = "pojulife:joint-entered-chat";

export type JointEntryMode = "solo" | "joint";

export type JointEntryModeDetail = { mode: JointEntryMode };

export type JointOpenDetail = {
  jointId: string;
  /** Sidebar row already has enough data to paint invite modal immediately. */
  preview?: JointDecisionPublicView | null;
};

export function notifyJointListUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(JOINT_LIST_UPDATED_EVENT));
}

export function requestJointEntryMode(mode: JointEntryMode): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<JointEntryModeDetail>(JOINT_ENTRY_MODE_EVENT, { detail: { mode } }),
  );
}

export function requestJointOpen(
  jointId: string,
  preview?: JointDecisionPublicView | null,
): void {
  if (typeof window === "undefined") return;
  const id = jointId.trim();
  if (!id) return;
  window.dispatchEvent(
    new CustomEvent<JointOpenDetail>(JOINT_OPEN_EVENT, {
      detail: { jointId: id, preview: preview ?? null },
    }),
  );
}

/** In-memory mirror — survives React effect cleanups that must not wipe sessionStorage. */
let awaitPortraitJointId: string | null = null;

export function markAwaitJointPortraitClose(jointId: string): void {
  if (typeof window === "undefined") return;
  const id = jointId.trim();
  if (!id) return;
  awaitPortraitJointId = id;
  try {
    sessionStorage.setItem(JOINT_AWAIT_PORTRAIT_KEY, id);
  } catch {
    /* private mode */
  }
}

export function clearAwaitJointPortraitClose(): void {
  awaitPortraitJointId = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(JOINT_AWAIT_PORTRAIT_KEY);
  } catch {
    /* private mode */
  }
}

export function readAwaitJointPortraitClose(): string | null {
  if (awaitPortraitJointId) return awaitPortraitJointId;
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(JOINT_AWAIT_PORTRAIT_KEY);
  } catch {
    return null;
  }
}

export function notifyJointPortraitClosed(): void {
  if (typeof window === "undefined") return;
  const jointId = readAwaitJointPortraitClose();
  // Always clear; still fire when id known so PASS tip + stage1 can run.
  clearAwaitJointPortraitClose();
  if (!jointId) return;
  window.dispatchEvent(
    new CustomEvent(JOINT_PORTRAIT_CLOSED_EVENT, { detail: { jointId } }),
  );
}

export function requestJointPassRetry(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(JOINT_PASS_RETRY_EVENT));
}

export function requestJointPassBuy(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(JOINT_PASS_BUY_EVENT));
}

function readEnteredChatIdSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(JOINT_ENTERED_CHAT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string" && Boolean(x.trim())));
  } catch {
    return new Set();
  }
}

export function readJointEnteredChatIds(): string[] {
  return [...readEnteredChatIdSet()];
}

/**
 * After 10s prepare → chat: hide invite strip card; history owns this joint.
 * Idempotent; fires JOINT_ENTERED_CHAT_EVENT + list refresh.
 */
export function markJointEnteredChat(jointId: string): void {
  if (typeof window === "undefined") return;
  const id = jointId.trim();
  if (!id) return;
  const set = readEnteredChatIdSet();
  if (set.has(id)) {
    window.dispatchEvent(
      new CustomEvent(JOINT_ENTERED_CHAT_EVENT, { detail: { jointId: id } }),
    );
    return;
  }
  set.add(id);
  try {
    sessionStorage.setItem(JOINT_ENTERED_CHAT_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(
    new CustomEvent(JOINT_ENTERED_CHAT_EVENT, { detail: { jointId: id } }),
  );
  notifyJointListUpdated();
}
