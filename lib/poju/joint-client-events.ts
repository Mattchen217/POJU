/** Client events for joint-decision sidebar / open host. */

import type { JointDecisionPublicView } from "@/lib/passes/household-types";

export const JOINT_LIST_UPDATED_EVENT = "pojulife:joint-list-updated";

export const JOINT_ENTRY_MODE_EVENT = "pojulife:joint-entry-mode";

export const JOINT_OPEN_EVENT = "pojulife:joint-open";

export const JOINT_PORTRAIT_CLOSED_EVENT = "pojulife:joint-portrait-closed";

/** Chat paywall tip under welcome — retry joint PASS charge. */
export const JOINT_PASS_RETRY_EVENT = "pojulife:joint-pass-retry";

/** sessionStorage: set while waiting for baseline portrait close during joint start. */
export const JOINT_AWAIT_PORTRAIT_KEY = "pojulife:joint-await-portrait";

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

export function markAwaitJointPortraitClose(jointId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(JOINT_AWAIT_PORTRAIT_KEY, jointId);
  } catch {
    /* private mode */
  }
}

export function clearAwaitJointPortraitClose(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(JOINT_AWAIT_PORTRAIT_KEY);
  } catch {
    /* private mode */
  }
}

export function readAwaitJointPortraitClose(): string | null {
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
  if (!jointId) return;
  clearAwaitJointPortraitClose();
  window.dispatchEvent(
    new CustomEvent(JOINT_PORTRAIT_CLOSED_EVENT, { detail: { jointId } }),
  );
}

export function requestJointPassRetry(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(JOINT_PASS_RETRY_EVENT));
}
