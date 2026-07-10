/**
 * Match v5 — local session storage (IndexedDB `match_sessions`).
 * @see docs/Match_v5.0_New.md Step 1
 */

import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { getPojuDb, type MatchSessionRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { normalizeMatchSessionPayload } from "./synergy-normalize";
import type { MatchReport, MatchSession, MatchSessionPayload } from "./types";

const MATCH_SESSION_SECRET = "pojulife_v5_match_session"; // legacy encryptJson arg; not a security boundary

export type CreateMatchSessionInput = {
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  report: MatchReport;
  is_free: boolean;
  cost_usd: number;
  locale: string;
  resonance_index?: number;
  engine_version?: "v5.1";
};

export type MatchSessionListItem = {
  match_id: string;
  a_profile_id: string;
  b_profile_id: string;
  created_at: Date;
};

function toPayload(session: MatchSession): MatchSessionPayload {
  return {
    ...session,
    created_at: session.created_at.toISOString(),
  };
}

function fromPayload(payload: MatchSessionPayload): MatchSession {
  const normalized = normalizeMatchSessionPayload(payload);
  return {
    ...normalized,
    created_at: new Date(normalized.created_at),
  };
}

export async function createMatchSession(input: CreateMatchSessionInput): Promise<string> {
  const deviceId = getPojuDeviceId();
  const matchId = safeRandomUUID();
  const now = new Date();

  const session: MatchSession = {
    match_id: matchId,
    device_id: deviceId,
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    relationship_description: input.relationship_description,
    report: input.report,
    created_at: now,
    is_free: input.is_free,
    cost_usd: input.cost_usd,
    locale: input.locale,
    resonance_index: input.resonance_index,
    engine_version: input.engine_version ?? "v5.1",
  };

  const { cipher, iv } = await encryptJson(MATCH_SESSION_SECRET, toPayload(session));

  const row: MatchSessionRecord = {
    match_id: matchId,
    device_id: deviceId,
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    encrypted_data: cipher,
    iv,
    created_at: now,
  };

  await getPojuDb().match_sessions.put(row);
  return matchId;
}

export async function loadMatchSession(matchId: string): Promise<MatchSession | null> {
  const record = await getPojuDb().match_sessions.get(matchId);
  if (!record) return null;

  try {
    const payload = await decryptJson<MatchSessionPayload>(MATCH_SESSION_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
    return fromPayload(payload);
  } catch (e) {
    console.error("[match-session] Decrypt failed:", e);
    return null;
  }
}

export async function listUserMatchSessions(): Promise<MatchSessionListItem[]> {
  const deviceId = getPojuDeviceId();
  const records = await getPojuDb().match_sessions.where("device_id").equals(deviceId).toArray();

  return records
    .map((r) => ({
      match_id: r.match_id,
      a_profile_id: r.a_profile_id,
      b_profile_id: r.b_profile_id,
      created_at: new Date(r.created_at),
    }))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export async function deleteMatchSession(matchId: string): Promise<void> {
  await getPojuDb().match_sessions.delete(matchId);
}
