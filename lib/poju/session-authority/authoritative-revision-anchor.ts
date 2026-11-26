/**
 * Request-scoped anchor for the server Session Authority revision.
 *
 * working_session_revision (memory persist / IndexedDB CAS) may advance many
 * times inside one authoritative chat turn. Those bumps must never be used as
 * commitAuthoritativeSessionUpdate.expectedRevision.
 *
 * Only a real server Session Authority CAS (e.g. clarification reservation)
 * may advance this anchor via noteAuthoritativeSessionCasRevision().
 */

import { AsyncLocalStorage } from "node:async_hooks";

type AuthoritativeRevisionFrame = {
  revision: number;
};

const authoritativeRevisionAls = new AsyncLocalStorage<AuthoritativeRevisionFrame>();

export function runWithAuthoritativeRevisionAnchor<T>(
  revision: number,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(
    authoritativeRevisionAls.run({ revision }, fn),
  );
}

/** Current server Authority revision for this turn, or null outside the frame. */
export function getAuthoritativeRevisionAnchor(): number | null {
  const frame = authoritativeRevisionAls.getStore();
  if (!frame) return null;
  return frame.revision;
}

/**
 * Record that a server Session Authority CAS succeeded at `revision`
 * (the revision stored after the write, i.e. the new head).
 */
export function noteAuthoritativeSessionCasRevision(revision: number): void {
  const frame = authoritativeRevisionAls.getStore();
  if (!frame) return;
  if (!Number.isFinite(revision) || revision < 0) return;
  if (revision > frame.revision) {
    frame.revision = revision;
  }
}
