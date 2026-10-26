/**
 * Joint decision coordination: shared question + dual dyad seeds.
 * Open to all users; charge 1 PASS per side via consumePassSmart (sub then flex).
 */

import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { normalizeEmail } from "@/lib/auth/auth-helpers";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { BirthInfo } from "@/lib/profile/types";
import {
  JOINT_INVITE_TTL_MS,
  type JointDecisionPublicView,
  type JointDecisionRow,
  type JointStatus,
} from "@/lib/passes/household-types";
import { consumePassSmart } from "@/lib/passes/consume-pass-smart";
import {
  findHouseholdForUser,
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

async function emailForUserId(userId: string): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export async function lookupJointPartner(params: {
  actorUserId: string;
  actorEmail?: string | null;
  partnerEmail: string;
}): Promise<
  | { ok: true; user_id: string; email: string }
  | { ok: false; reason: string }
> {
  const email = normalizeEmail(params.partnerEmail);
  if (!email || !email.includes("@")) {
    return { ok: false, reason: "invalid_email" };
  }
  const self = normalizeEmail(params.actorEmail ?? "");
  if (self && self === email) {
    return { ok: false, reason: "cannot_invite_self" };
  }
  const found = await findAuthUserByEmail(email);
  if (!found?.id) {
    return { ok: false, reason: "partner_not_registered" };
  }
  if (found.id === params.actorUserId) {
    return { ok: false, reason: "cannot_invite_self" };
  }
  return { ok: true, user_id: found.id, email: found.email || email };
}

export async function createJointInvite(params: {
  initiatorUserId: string;
  initiatorEmail?: string | null;
  sharedQuestion: string;
  initiatorBirth: BirthInfo;
  /** Partner email (required unless partnerUserId given). */
  partnerEmail?: string | null;
  /** Pre-resolved partner (e.g. bound seat). */
  partnerUserId?: string | null;
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

  let inviteeId = params.partnerUserId?.trim() || "";
  let inviteeEmail: string | null = null;

  if (inviteeId) {
    if (inviteeId === params.initiatorUserId) {
      return { ok: false, reason: "cannot_invite_self" };
    }
    inviteeEmail = await emailForUserId(inviteeId);
  } else {
    const looked = await lookupJointPartner({
      actorUserId: params.initiatorUserId,
      actorEmail: params.initiatorEmail,
      partnerEmail: params.partnerEmail ?? "",
    });
    if (!looked.ok) return looked;
    inviteeId = looked.user_id;
    inviteeEmail = looked.email;
  }

  const hh = await findHouseholdForUser(params.initiatorUserId);
  const householdId =
    hh &&
    (hh.seat_a_user_id === params.initiatorUserId ||
      hh.seat_b_user_id === params.initiatorUserId)
      ? hh.id
      : null;

  const admin = createSupabaseAdminClient();
  const expires = new Date(Date.now() + JOINT_INVITE_TTL_MS).toISOString();
  const { data, error } = await admin
    .from("joint_decision_sessions")
    .insert({
      household_id: householdId,
      initiator_user_id: params.initiatorUserId,
      invitee_user_id: inviteeId,
      invitee_email: inviteeEmail,
      shared_question: q,
      status: "invited",
      birth_snapshot_a: params.initiatorBirth,
      birth_snapshot_b: null,
      unread_a: false,
      unread_b: true,
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
    joint: await toPublicViewAsync(joint, params.initiatorUserId),
  };
}

/** Invitee agrees and submits birth → partner_ready (initiator can start alone). */
export async function agreeJointInvite(params: {
  jointId: string;
  inviteeUserId: string;
  inviteeBirth: BirthInfo;
}): Promise<
  | { ok: true; joint: JointDecisionPublicView }
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
  if (joint.status === "partner_ready" || joint.status === "running") {
    return {
      ok: true,
      joint: await toPublicViewAsync(joint, params.inviteeUserId),
    };
  }
  if (joint.status !== "invited" && joint.status !== "accepted") {
    return { ok: false, reason: `bad_status:${joint.status}` };
  }
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

  const { data: updated, error } = await admin
    .from("joint_decision_sessions")
    .update({
      status: "partner_ready" as JointStatus,
      birth_snapshot_b: params.inviteeBirth,
      accepted_at: new Date().toISOString(),
      unread_a: true,
      unread_b: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", joint.id)
    .in("status", ["invited", "accepted"])
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    console.error("[joint] agree update", error?.code ?? error?.message);
    return { ok: false, reason: "agree_failed" };
  }
  return {
    ok: true,
    joint: await toPublicViewAsync(updated as JointDecisionRow, params.inviteeUserId),
  };
}

export type JointStartResult =
  | {
      ok: true;
      joint: JointDecisionPublicView;
      seed: JointSessionSeed;
      charged_from: "sub" | "flex";
      already_charged: boolean;
    }
  | { ok: false; reason: string };

/** Charge 1 PASS for current user and return dyad seed. Idempotent via pass_ref. */
export async function startJointSide(params: {
  jointId: string;
  userId: string;
}): Promise<JointStartResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const admin = createSupabaseAdminClient();
  const { data: raw } = await admin
    .from("joint_decision_sessions")
    .select("*")
    .eq("id", params.jointId)
    .maybeSingle();
  let joint = asJoint(raw as Record<string, unknown> | null);
  if (!joint) return { ok: false, reason: "joint_not_found" };

  const isInitiator = joint.initiator_user_id === params.userId;
  const isInvitee = joint.invitee_user_id === params.userId;
  if (!isInitiator && !isInvitee) return { ok: false, reason: "forbidden" };

  // Initiator may start only after partner agreed + birth.
  if (isInitiator && joint.status === "invited") {
    return { ok: false, reason: "waiting_for_partner" };
  }
  if (!joint.birth_snapshot_a) {
    return { ok: false, reason: "initiator_birth_required" };
  }
  if (!joint.birth_snapshot_b) {
    return { ok: false, reason: "invitee_birth_required" };
  }

  const passRef = isInitiator ? `joint:${joint.id}:a` : `joint:${joint.id}:b`;
  const existingRef = isInitiator ? joint.pass_ref_a : joint.pass_ref_b;
  let sessionId = isInitiator ? joint.pivot_session_id_a : joint.pivot_session_id_b;
  let alreadyCharged = Boolean(existingRef);
  let chargedFrom: "sub" | "flex" = "flex";

  if (!existingRef) {
    const charge = await consumePassSmart({
      userId: params.userId,
      product: "pivot",
      refId: passRef,
      description: `Joint decision · ${joint.shared_question.slice(0, 80)}`,
    });
    if (!charge.ok) {
      return {
        ok: false,
        reason:
          charge.reason === "insufficient_balance" || charge.reason === "insufficient_passes"
            ? "insufficient_pass"
            : (charge.reason ?? "charge_failed"),
      };
    }
    chargedFrom = charge.passSource === "sub" ? "sub" : "flex";
    if (!sessionId) sessionId = safeRandomUUID();

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (isInitiator) {
      patch.pass_ref_a = passRef;
      patch.pivot_session_id_a = sessionId;
      patch.unread_a = false;
    } else {
      patch.pass_ref_b = passRef;
      patch.pivot_session_id_b = sessionId;
      patch.unread_b = false;
    }

    const { data: updated, error } = await admin
      .from("joint_decision_sessions")
      .update(patch)
      .eq("id", joint.id)
      .select("*")
      .maybeSingle();
    if (error || !updated) {
      console.error("[joint] start update", error?.code ?? error?.message);
      return { ok: false, reason: "start_failed" };
    }
    joint = updated as JointDecisionRow;

    // Promote to running when both charged.
    if (joint.pass_ref_a && joint.pass_ref_b && joint.status !== "running") {
      const { data: runRow } = await admin
        .from("joint_decision_sessions")
        .update({
          status: "running",
          updated_at: new Date().toISOString(),
        })
        .eq("id", joint.id)
        .select("*")
        .maybeSingle();
      if (runRow) joint = runRow as JointDecisionRow;
    }
  } else {
    alreadyCharged = true;
    // Clear unread on open/retry when already charged
    const clearPatch = isInitiator ? { unread_a: false } : { unread_b: false };
    await admin
      .from("joint_decision_sessions")
      .update({ ...clearPatch, updated_at: new Date().toISOString() })
      .eq("id", joint.id);
    joint = {
      ...joint,
      unread_a: isInitiator ? false : joint.unread_a,
      unread_b: isInvitee ? false : joint.unread_b,
    };
  }

  // Ensure session ids exist for seed
  if (!sessionId) {
    sessionId = safeRandomUUID();
    const sidPatch = isInitiator
      ? { pivot_session_id_a: sessionId }
      : { pivot_session_id_b: sessionId };
    const { data: withSid } = await admin
      .from("joint_decision_sessions")
      .update({ ...sidPatch, updated_at: new Date().toISOString() })
      .eq("id", joint.id)
      .select("*")
      .maybeSingle();
    if (withSid) joint = withSid as JointDecisionRow;
  }

  try {
    const seed = buildSeed(joint, params.userId);
    return {
      ok: true,
      joint: await toPublicViewAsync(joint, params.userId, {
        includePartnerBirth: true,
        includeSelfBirth: true,
      }),
      seed,
      charged_from: chargedFrom,
      already_charged: alreadyCharged,
    };
  } catch {
    return { ok: false, reason: "joint_seed_incomplete" };
  }
}

export async function markJointRead(params: {
  jointId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isSupabaseAdminConfigured()) return { ok: false, reason: "admin_unconfigured" };
  const admin = createSupabaseAdminClient();
  const { data: raw } = await admin
    .from("joint_decision_sessions")
    .select("id, initiator_user_id, invitee_user_id")
    .eq("id", params.jointId)
    .maybeSingle();
  if (!raw) return { ok: false, reason: "joint_not_found" };
  const isA = raw.initiator_user_id === params.userId;
  const isB = raw.invitee_user_id === params.userId;
  if (!isA && !isB) return { ok: false, reason: "forbidden" };
  await admin
    .from("joint_decision_sessions")
    .update({
      ...(isA ? { unread_a: false } : { unread_b: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jointId);
  return { ok: true };
}

/** @deprecated Prefer agreeJointInvite + startJointSide */
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
  const agreed = await agreeJointInvite(params);
  if (!agreed.ok) return agreed;
  const started = await startJointSide({
    jointId: params.jointId,
    userId: params.inviteeUserId,
  });
  if (!started.ok) return started;
  return { ok: true, joint: started.joint, seed: started.seed };
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
  opts?: {
    includePartnerBirth?: boolean;
    includeSelfBirth?: boolean;
    peerLabel?: string | null;
  },
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
  const selfBirth = opts?.includeSelfBirth
    ? isInitiator
      ? joint.birth_snapshot_a
      : joint.birth_snapshot_b
    : null;
  // Invitee pending invite is always unread until they open/agree (DB flag + status fallback).
  const unread = isInitiator
    ? Boolean(joint.unread_a)
    : Boolean(joint.unread_b) || joint.status === "invited";
  const myCharged = isInitiator
    ? Boolean(joint.pass_ref_a)
    : Boolean(joint.pass_ref_b);
  const partnerReady =
    joint.status === "partner_ready" ||
    joint.status === "running" ||
    Boolean(joint.birth_snapshot_b && joint.accepted_at);
  return {
    id: joint.id,
    household_id: joint.household_id,
    role,
    shared_question: joint.shared_question,
    status: joint.status,
    my_pivot_session_id: mySession,
    peer_user_id: peer,
    peer_label: opts?.peerLabel ?? joint.invitee_email ?? null,
    unread,
    waiting_for_partner: isInitiator && joint.status === "invited",
    partner_ready: partnerReady,
    my_charged: myCharged,
    accepted_at: joint.accepted_at,
    created_at: joint.created_at,
    partner_birth_for_my_session: partnerBirth ?? null,
    self_birth_for_my_session: selfBirth ?? null,
    joint_decision: true,
  };
}

async function toPublicViewAsync(
  joint: JointDecisionRow,
  viewerUserId: string,
  opts?: { includePartnerBirth?: boolean; includeSelfBirth?: boolean },
): Promise<JointDecisionPublicView> {
  const isInitiator = joint.initiator_user_id === viewerUserId;
  const peerId = isInitiator ? joint.invitee_user_id : joint.initiator_user_id;
  const peerLabel =
    (isInitiator ? joint.invitee_email : null) ?? (await emailForUserId(peerId));
  return toPublicView(joint, viewerUserId, {
    ...opts,
    peerLabel,
  });
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
  const canSeed =
    Boolean(joint.birth_snapshot_a && joint.birth_snapshot_b) &&
    (joint.initiator_user_id === userId
      ? Boolean(joint.pass_ref_a && joint.pivot_session_id_a)
      : Boolean(joint.pass_ref_b && joint.pivot_session_id_b));
  const view = await toPublicViewAsync(joint, userId, {
    includePartnerBirth: Boolean(joint.birth_snapshot_a && joint.birth_snapshot_b),
    includeSelfBirth: Boolean(joint.birth_snapshot_a && joint.birth_snapshot_b),
  });
  if (canSeed) {
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
    .limit(40);
  const rows = (data ?? []) as JointDecisionRow[];
  return Promise.all(
    rows.map((j) =>
      toPublicViewAsync(j, userId, {
        includePartnerBirth: false,
      }),
    ),
  );
}

/** Bound peer email for prefill when subscriber. */
export async function getBoundPeerEmail(userId: string): Promise<{
  peer_user_id: string | null;
  peer_email: string | null;
}> {
  const hh = await findHouseholdForUser(userId);
  if (!hh) return { peer_user_id: null, peer_email: null };
  const peer = householdPeerUserId(hh, userId);
  if (!peer) return { peer_user_id: null, peer_email: null };
  return { peer_user_id: peer, peer_email: await emailForUserId(peer) };
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
