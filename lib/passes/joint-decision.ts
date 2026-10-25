/**
 * Joint decision coordination: shared question + dual dyad seeds.
 * Analysis engine stays solo dyad × 2.
 */

import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { BirthInfo } from "@/lib/profile/types";
import {
  JOINT_INVITE_TTL_MS,
  type JointDecisionPublicView,
  type JointDecisionRow,
} from "@/lib/passes/household-types";
import {
  consumeHouseholdPass,
  findHouseholdForUser,
  householdIsFull,
  householdPeerUserId,
} from "@/lib/passes/household";

function asJoint(row: Record<string, unknown> | null): JointDecisionRow | null {
  if (!row || typeof row.id !== "string") return null;
  return row as unknown as JointDecisionRow;
}

function isBirthInfo(v: unknown): v is BirthInfo {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.year === "number" &&
    typeof o.month === "number" &&
    typeof o.day === "number" &&
    (o.gender === "M" || o.gender === "F") &&
    typeof o.timezone === "string"
  );
}

export async function createJointInvite(params: {
  initiatorUserId: string;
  sharedQuestion: string;
  initiatorBirth: BirthInfo;
}): Promise<
  | { ok: true; joint: JointDecisionPublicView }
  | { ok: false; reason: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const q = params.sharedQuestion.trim();
  if (q.length < 4) return { ok: false, reason: "question_too_short" };
  if (!isBirthInfo(params.initiatorBirth)) {
    return { ok: false, reason: "initiator_birth_required" };
  }

  const hh = await findHouseholdForUser(params.initiatorUserId);
  if (!hh) return { ok: false, reason: "no_duo_household" };
  if (!householdIsFull(hh)) return { ok: false, reason: "household_not_full" };
  const peer = householdPeerUserId(hh, params.initiatorUserId);
  if (!peer) return { ok: false, reason: "peer_missing" };

  if (hh.shared_sub_balance < 2) {
    return { ok: false, reason: "insufficient_household_balance" };
  }

  const admin = createSupabaseAdminClient();
  const expires = new Date(Date.now() + JOINT_INVITE_TTL_MS).toISOString();
  const { data, error } = await admin
    .from("joint_decision_sessions")
    .insert({
      household_id: hh.id,
      initiator_user_id: params.initiatorUserId,
      invitee_user_id: peer,
      shared_question: q,
      status: "invited",
      birth_snapshot_a: params.initiatorBirth,
      birth_snapshot_b: null,
      invite_expires_at: expires,
      pass_ref_a: null,
      pass_ref_b: null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[joint] create", error?.code ?? error?.message);
    return { ok: false, reason: "create_failed" };
  }
  const joint = data as JointDecisionRow;
  return {
    ok: true,
    joint: toPublicView(joint, params.initiatorUserId, { includePartnerBirth: false }),
  };
}

export async function acceptJointInvite(params: {
  jointId: string;
  inviteeUserId: string;
  inviteeBirth: BirthInfo;
}): Promise<
  | {
      ok: true;
      joint: JointDecisionPublicView;
      seed: JointSessionSeed;
    }
  | { ok: false; reason: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  if (!isBirthInfo(params.inviteeBirth)) {
    return { ok: false, reason: "invitee_birth_required" };
  }

  const admin = createSupabaseAdminClient();
  const { data: raw } = await admin
    .from("joint_decision_sessions")
    .select("*")
    .eq("id", params.jointId)
    .maybeSingle();
  const joint = asJoint(raw as Record<string, unknown> | null);
  if (!joint) return { ok: false, reason: "joint_not_found" };
  if (joint.invitee_user_id !== params.inviteeUserId) {
    return { ok: false, reason: "not_invitee" };
  }
  if (joint.status === "accepted" || joint.status === "running") {
    // Idempotent re-fetch
    return {
      ok: true,
      joint: toPublicView(joint, params.inviteeUserId, { includePartnerBirth: true }),
      seed: buildSeed(joint, params.inviteeUserId),
    };
  }
  if (joint.status !== "invited") return { ok: false, reason: `bad_status:${joint.status}` };
  if (
    joint.invite_expires_at &&
    new Date(joint.invite_expires_at).getTime() < Date.now()
  ) {
    await admin
      .from("joint_decision_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", joint.id);
    return { ok: false, reason: "invite_expired" };
  }

  const hh = await findHouseholdForUser(params.inviteeUserId);
  if (!hh || hh.id !== joint.household_id) {
    return { ok: false, reason: "household_mismatch" };
  }
  if (!householdIsFull(hh)) return { ok: false, reason: "household_not_full" };

  const refA = `joint:${joint.id}:a`;
  const refB = `joint:${joint.id}:b`;
  const sessionA = safeRandomUUID();
  const sessionB = safeRandomUUID();

  // Charge both (2 PASS from shared pool)
  const chargeA = await consumeHouseholdPass({
    householdId: hh.id,
    userId: joint.initiator_user_id,
    product: "pivot",
    refId: refA,
    description: `Joint decision (initiator) · ${joint.shared_question.slice(0, 80)}`,
  });
  if (!chargeA.ok) {
    return { ok: false, reason: chargeA.reason ?? "charge_a_failed" };
  }
  const chargeB = await consumeHouseholdPass({
    householdId: hh.id,
    userId: joint.invitee_user_id,
    product: "pivot",
    refId: refB,
    description: `Joint decision (invitee) · ${joint.shared_question.slice(0, 80)}`,
  });
  if (!chargeB.ok) {
    return { ok: false, reason: chargeB.reason ?? "charge_b_failed" };
  }

  const { data: updated, error } = await admin
    .from("joint_decision_sessions")
    .update({
      status: "running",
      birth_snapshot_b: params.inviteeBirth,
      pivot_session_id_a: sessionA,
      pivot_session_id_b: sessionB,
      pass_ref_a: refA,
      pass_ref_b: refB,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", joint.id)
    .eq("status", "invited")
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    console.error("[joint] accept update", error?.code ?? error?.message);
    return { ok: false, reason: "accept_update_failed" };
  }

  const next = updated as JointDecisionRow;
  return {
    ok: true,
    joint: toPublicView(next, params.inviteeUserId, { includePartnerBirth: true }),
    seed: buildSeed(next, params.inviteeUserId),
  };
}

export type JointSessionSeed = {
  joint_id: string;
  pivot_session_id: string;
  shared_question: string;
  partner_birth: BirthInfo;
  joint_decision: true;
  pass_ref: string;
};

function buildSeed(joint: JointDecisionRow, userId: string): JointSessionSeed {
  const isInitiator = joint.initiator_user_id === userId;
  const mySession = isInitiator
    ? joint.pivot_session_id_a
    : joint.pivot_session_id_b;
  const partnerBirth = isInitiator
    ? joint.birth_snapshot_b
    : joint.birth_snapshot_a;
  const passRef = isInitiator ? joint.pass_ref_a : joint.pass_ref_b;
  if (!mySession || !partnerBirth || !passRef) {
    throw new Error("joint_seed_incomplete");
  }
  return {
    joint_id: joint.id,
    pivot_session_id: mySession,
    shared_question: joint.shared_question,
    partner_birth: partnerBirth,
    joint_decision: true,
    pass_ref: passRef,
  };
}

export function toPublicView(
  joint: JointDecisionRow,
  viewerUserId: string,
  opts?: { includePartnerBirth?: boolean },
): JointDecisionPublicView {
  const isInitiator = joint.initiator_user_id === viewerUserId;
  const role = isInitiator ? "initiator" : "invitee";
  const mySession = isInitiator
    ? joint.pivot_session_id_a
    : joint.pivot_session_id_b;
  const peer = isInitiator ? joint.invitee_user_id : joint.initiator_user_id;
  const partnerBirth = opts?.includePartnerBirth
    ? isInitiator
      ? joint.birth_snapshot_b
      : joint.birth_snapshot_a
    : null;
  return {
    id: joint.id,
    household_id: joint.household_id,
    role,
    shared_question: joint.shared_question,
    status: joint.status,
    my_pivot_session_id: mySession,
    peer_user_id: peer,
    accepted_at: joint.accepted_at,
    created_at: joint.created_at,
    partner_birth_for_my_session: partnerBirth ?? null,
    joint_decision: true,
  };
}

export async function getJointForUser(
  jointId: string,
  userId: string,
): Promise<
  | { ok: true; joint: JointDecisionPublicView; seed?: JointSessionSeed }
  | { ok: false; reason: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("joint_decision_sessions")
    .select("*")
    .eq("id", jointId)
    .maybeSingle();
  const joint = asJoint(data as Record<string, unknown> | null);
  if (!joint) return { ok: false, reason: "joint_not_found" };
  if (
    joint.initiator_user_id !== userId &&
    joint.invitee_user_id !== userId
  ) {
    return { ok: false, reason: "forbidden" };
  }
  const running =
    joint.status === "accepted" ||
    joint.status === "running" ||
    joint.status === "sealed";
  const view = toPublicView(joint, userId, { includePartnerBirth: running });
  if (running && joint.pivot_session_id_a && joint.birth_snapshot_a && joint.birth_snapshot_b) {
    try {
      return { ok: true, joint: view, seed: buildSeed(joint, userId) };
    } catch {
      return { ok: true, joint: view };
    }
  }
  return { ok: true, joint: view };
}

export async function listJointsForUser(userId: string): Promise<JointDecisionPublicView[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("joint_decision_sessions")
    .select("*")
    .or(`initiator_user_id.eq.${userId},invitee_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []) as JointDecisionRow[];
  return rows.map((j) =>
    toPublicView(j, userId, {
      includePartnerBirth: j.status === "running" || j.status === "accepted",
    }),
  );
}

/** Initiator fetches seed after invitee accepted (poll). */
export async function getJointSeedForInitiator(params: {
  jointId: string;
  initiatorUserId: string;
}): Promise<
  | { ok: true; seed: JointSessionSeed; joint: JointDecisionPublicView }
  | { ok: false; reason: string }
> {
  const res = await getJointForUser(params.jointId, params.initiatorUserId);
  if (!res.ok) return res;
  if (res.joint.role !== "initiator") return { ok: false, reason: "not_initiator" };
  if (!res.seed) return { ok: false, reason: "not_ready" };
  return { ok: true, seed: res.seed, joint: res.joint };
}
