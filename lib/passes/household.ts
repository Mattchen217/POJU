/**
 * Duo household: 2 seats, shared PASS pool.
 */

import {
  createSupabaseAdminClient,
  createSupabaseAnonClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import {
  DUO_FIRST_GRANT,
  DUO_MONTHLY_QUOTA,
  SEAT_INVITE_TTL_MS,
  type HouseholdRow,
} from "@/lib/passes/household-types";

export type HouseholdSeatPublic = {
  role: "seat_a" | "seat_b";
  user_id: string | null;
  email: string | null;
  is_you: boolean;
};

function asHousehold(row: Record<string, unknown> | null): HouseholdRow | null {
  if (!row || typeof row.id !== "string") return null;
  return row as unknown as HouseholdRow;
}

export async function findHouseholdForUser(
  userId: string,
): Promise<HouseholdRow | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const admin = createSupabaseAdminClient();
  const { data: a } = await admin
    .from("pass_households")
    .select("*")
    .eq("seat_a_user_id", userId)
    .in("status", ["pending_partner", "active"])
    .maybeSingle();
  if (a) return asHousehold(a as Record<string, unknown>);
  const { data: b } = await admin
    .from("pass_households")
    .select("*")
    .eq("seat_b_user_id", userId)
    .in("status", ["pending_partner", "active"])
    .maybeSingle();
  return asHousehold((b as Record<string, unknown> | null) ?? null);
}

export function householdIsFull(hh: HouseholdRow): boolean {
  return Boolean(hh.seat_a_user_id && hh.seat_b_user_id && hh.status === "active");
}

export function householdPeerUserId(
  hh: HouseholdRow,
  userId: string,
): string | null {
  if (hh.seat_a_user_id === userId) return hh.seat_b_user_id;
  if (hh.seat_b_user_id === userId) return hh.seat_a_user_id;
  return null;
}

/**
 * Backfill: active Personal/Team/Duo subscriber without a household row
 * still gets a duo household so joint CTA can light up and seats can bind.
 */
export async function ensureHouseholdForActiveSubscriber(
  userId: string,
): Promise<{
  household: HouseholdRow | null;
  subscriptionActive: boolean;
}> {
  if (!isSupabaseAdminConfigured()) {
    return { household: null, subscriptionActive: false };
  }
  const existing = await findHouseholdForUser(userId);
  const admin = createSupabaseAdminClient();
  const { data: passes } = await admin
    .from("user_passes")
    .select(
      "subscription_status, subscription_plan, sub_balance, sub_quota, sub_carryover, stripe_subscription_id, current_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const plan =
    passes?.subscription_plan === "personal" || passes?.subscription_plan === "team"
      ? passes.subscription_plan
      : null;
  const status = typeof passes?.subscription_status === "string"
    ? passes.subscription_status
    : "none";
  const subscriptionActive =
    status === "active" ||
    Boolean(plan) ||
    Boolean(
      typeof passes?.stripe_subscription_id === "string" &&
        passes.stripe_subscription_id.trim(),
    );

  if (existing) {
    return { household: existing, subscriptionActive: true };
  }
  if (!subscriptionActive) {
    return { household: null, subscriptionActive: false };
  }

  const sub = typeof passes?.sub_balance === "number" ? passes.sub_balance : 0;
  const carry =
    typeof passes?.sub_carryover === "number" ? passes.sub_carryover : 0;
  const planQuota =
    typeof passes?.sub_quota === "number" && passes.sub_quota > 0
      ? passes.sub_quota
      : DUO_MONTHLY_QUOTA;
  const shared = Math.max(0, sub + carry);
  const created = await createOrRefreshDuoHousehold({
    seatAUserId: userId,
    sharedBalance: shared,
    quota: planQuota,
    stripeSubscriptionId:
      typeof passes?.stripe_subscription_id === "string"
        ? passes.stripe_subscription_id
        : null,
    currentPeriodEnd:
      typeof passes?.current_period_end === "string"
        ? passes.current_period_end
        : null,
  });
  if (!created.ok) {
    return { household: null, subscriptionActive: true };
  }
  return { household: created.household, subscriptionActive: true };
}

async function emailForUserId(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

/** Two seat slots for UI — always length 2; empty seat has null email. */
export async function listHouseholdSeatsForViewer(
  hh: HouseholdRow,
  viewerUserId: string,
): Promise<HouseholdSeatPublic[]> {
  const aEmail = hh.seat_a_user_id
    ? await emailForUserId(hh.seat_a_user_id)
    : null;
  const bEmail = hh.seat_b_user_id
    ? await emailForUserId(hh.seat_b_user_id)
    : null;
  return [
    {
      role: "seat_a",
      user_id: hh.seat_a_user_id,
      email: aEmail,
      is_you: hh.seat_a_user_id === viewerUserId,
    },
    {
      role: "seat_b",
      user_id: hh.seat_b_user_id,
      email: bEmail,
      is_you: hh.seat_b_user_id === viewerUserId,
    },
  ];
}

async function attachSeatB(params: {
  householdId: string;
  actorUserId: string;
  partnerUserId: string;
}): Promise<
  | { ok: true; household: HouseholdRow }
  | { ok: false; reason: string }
> {
  if (params.partnerUserId === params.actorUserId) {
    return { ok: false, reason: "cannot_bind_self" };
  }
  const other = await findHouseholdForUser(params.partnerUserId);
  if (other) return { ok: false, reason: "already_in_household" };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pass_households")
    .update({
      seat_b_user_id: params.partnerUserId,
      status: "active",
      seat_invite_token: null,
      seat_invite_email: null,
      seat_invite_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.householdId)
    .is("seat_b_user_id", null)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("[household] attach seat b", error?.code ?? error?.message);
    return { ok: false, reason: "bind_failed" };
  }
  return { ok: true, household: data as HouseholdRow };
}

/** Bind partner user id onto seat B (caller must be seat A). */
export async function bindSeatByUserId(params: {
  actorUserId: string;
  partnerUserId: string;
}): Promise<
  | { ok: true; household: HouseholdRow; partner_user_id: string }
  | { ok: false; reason: string }
> {
  const ensured = await ensureHouseholdForActiveSubscriber(params.actorUserId);
  const hh = ensured.household;
  if (!hh) return { ok: false, reason: "no_subscription" };
  if (hh.seat_a_user_id !== params.actorUserId) {
    return { ok: false, reason: "only_seat_a_can_bind" };
  }
  if (hh.seat_b_user_id) return { ok: false, reason: "already_full" };

  const attached = await attachSeatB({
    householdId: hh.id,
    actorUserId: params.actorUserId,
    partnerUserId: params.partnerUserId,
  });
  if (!attached.ok) return attached;
  return {
    ok: true,
    household: attached.household,
    partner_user_id: params.partnerUserId,
  };
}

/**
 * Seat A binds seat B by email+password (existing account login).
 * Does not switch the caller's session.
 */
export async function bindSeatByCredentials(params: {
  actorUserId: string;
  email: string;
  password: string;
}): Promise<
  | { ok: true; household: HouseholdRow; partner_user_id: string; created: boolean }
  | { ok: false; reason: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const email = params.email.trim().toLowerCase();
  const password = params.password;
  if (!email || password.length < 8) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const ensured = await ensureHouseholdForActiveSubscriber(params.actorUserId);
  const hh = ensured.household;
  if (!hh) return { ok: false, reason: "no_subscription" };
  if (hh.seat_a_user_id !== params.actorUserId) {
    return { ok: false, reason: "only_seat_a_can_bind" };
  }
  if (hh.seat_b_user_id) return { ok: false, reason: "already_full" };

  const anon = createSupabaseAnonClient();
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  const partnerId = signedIn.data.user?.id ?? null;
  await anon.auth.signOut().catch(() => undefined);

  if (!partnerId) {
    if (signedIn.error) {
      const msg = (signedIn.error.message ?? "").toLowerCase();
      if (msg.includes("confirm") || msg.includes("not confirmed")) {
        return { ok: false, reason: "email_not_confirmed" };
      }
    }
    return { ok: false, reason: "invalid_credentials" };
  }

  const attached = await attachSeatB({
    householdId: hh.id,
    actorUserId: params.actorUserId,
    partnerUserId: partnerId,
  });
  if (!attached.ok) return attached;
  return {
    ok: true,
    household: attached.household,
    partner_user_id: partnerId,
    created: false,
  };
}

/**
 * After partner signup OTP (ephemeral anon verify — no cookie session switch).
 */
export async function bindSeatAfterSignupOtp(params: {
  actorUserId: string;
  email: string;
  token: string;
}): Promise<
  | { ok: true; household: HouseholdRow; partner_user_id: string }
  | { ok: false; reason: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const email = params.email.trim().toLowerCase();
  const token = params.token.trim();
  if (!email || token.length !== 6) {
    return { ok: false, reason: "invalid_code" };
  }

  const anon = createSupabaseAnonClient();
  const verified = await anon.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  const partnerId = verified.data.user?.id ?? null;
  await anon.auth.signOut().catch(() => undefined);

  if (!partnerId) {
    return { ok: false, reason: "invalid_code" };
  }

  return bindSeatByUserId({
    actorUserId: params.actorUserId,
    partnerUserId: partnerId,
  });
}

/** Create household when duo subscription credits; seat A = subscriber. */
export async function createOrRefreshDuoHousehold(params: {
  seatAUserId: string;
  sharedBalance: number;
  quota?: number;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<{ ok: true; household: HouseholdRow } | { ok: false; reason: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const admin = createSupabaseAdminClient();
  const quota =
    typeof params.quota === "number" && params.quota > 0
      ? params.quota
      : DUO_MONTHLY_QUOTA;
  const existing = await findHouseholdForUser(params.seatAUserId);
  if (existing && existing.seat_a_user_id === params.seatAUserId) {
    const { data, error } = await admin
      .from("pass_households")
      .update({
        shared_sub_balance: Math.max(0, params.sharedBalance),
        quota,
        stripe_subscription_id: params.stripeSubscriptionId ?? existing.stripe_subscription_id,
        current_period_end: params.currentPeriodEnd ?? existing.current_period_end,
        status: existing.seat_b_user_id ? "active" : "pending_partner",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) {
      console.error("[household] refresh", error?.code ?? error?.message);
      return { ok: false, reason: "update_failed" };
    }
    return { ok: true, household: data as HouseholdRow };
  }

  const { data, error } = await admin
    .from("pass_households")
    .insert({
      plan: "duo",
      status: "pending_partner",
      seat_a_user_id: params.seatAUserId,
      seat_b_user_id: null,
      shared_sub_balance: Math.max(0, params.sharedBalance || DUO_FIRST_GRANT),
      quota,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[household] create", error?.code ?? error?.message);
    return { ok: false, reason: "create_failed" };
  }
  return { ok: true, household: data as HouseholdRow };
}

export async function createSeatInvite(params: {
  householdId: string;
  actorUserId: string;
  inviteEmail?: string | null;
}): Promise<
  | { ok: true; token: string; expires_at: string }
  | { ok: false; reason: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const admin = createSupabaseAdminClient();
  const { data: hh } = await admin
    .from("pass_households")
    .select("*")
    .eq("id", params.householdId)
    .maybeSingle();
  const row = asHousehold(hh as Record<string, unknown> | null);
  if (!row) return { ok: false, reason: "household_not_found" };
  if (row.seat_a_user_id !== params.actorUserId) {
    return { ok: false, reason: "only_seat_a_can_invite" };
  }
  if (row.seat_b_user_id) return { ok: false, reason: "already_full" };

  const token = safeRandomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + SEAT_INVITE_TTL_MS).toISOString();
  const { error } = await admin
    .from("pass_households")
    .update({
      seat_invite_token: token,
      seat_invite_email: params.inviteEmail?.trim().toLowerCase() || null,
      seat_invite_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.householdId);
  if (error) {
    console.error("[household] seat invite", error.code ?? error.message);
    return { ok: false, reason: "invite_failed" };
  }
  return { ok: true, token, expires_at: expires };
}

export async function acceptSeatInvite(params: {
  token: string;
  userId: string;
}): Promise<{ ok: true; household: HouseholdRow } | { ok: false; reason: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const admin = createSupabaseAdminClient();
  const { data: hh } = await admin
    .from("pass_households")
    .select("*")
    .eq("seat_invite_token", params.token.trim())
    .maybeSingle();
  const row = asHousehold(hh as Record<string, unknown> | null);
  if (!row) return { ok: false, reason: "invite_not_found" };
  if (row.seat_b_user_id) return { ok: false, reason: "already_full" };
  if (row.seat_a_user_id === params.userId) {
    return { ok: false, reason: "cannot_bind_self" };
  }
  if (
    row.seat_invite_expires_at &&
    new Date(row.seat_invite_expires_at).getTime() < Date.now()
  ) {
    return { ok: false, reason: "invite_expired" };
  }

  // User already in another household?
  const other = await findHouseholdForUser(params.userId);
  if (other) return { ok: false, reason: "already_in_household" };

  const { data, error } = await admin
    .from("pass_households")
    .update({
      seat_b_user_id: params.userId,
      status: "active",
      seat_invite_token: null,
      seat_invite_email: null,
      seat_invite_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[household] accept seat", error?.code ?? error?.message);
    return { ok: false, reason: "accept_failed" };
  }
  return { ok: true, household: data as HouseholdRow };
}

export type ConsumeHouseholdResult = {
  ok: boolean;
  reason?: string;
  balanceAfter?: number;
  passSource?: "household" | "flex" | null;
};

export async function consumeHouseholdPass(params: {
  householdId: string;
  userId: string;
  product: string;
  refId: string;
  description?: string;
}): Promise<ConsumeHouseholdResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: true, reason: "admin_unconfigured" };
  }
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_household_pass", {
      target_household_id: params.householdId,
      target_user_id: params.userId,
      target_product: params.product,
      target_ref_id: params.refId.trim(),
      usage_desc: params.description ?? null,
    });
    if (error) {
      console.error("[household] consume", error.code ?? error.message);
      return { ok: false, reason: "rpc_error" };
    }
    const row = (Array.isArray(data) ? data[0] : data) as {
      ok?: boolean;
      reason?: string;
      balance_after?: number;
      pass_source?: string | null;
    } | null;
    return {
      ok: Boolean(row?.ok),
      reason: typeof row?.reason === "string" ? row.reason : undefined,
      balanceAfter: typeof row?.balance_after === "number" ? row.balance_after : undefined,
      passSource:
        row?.pass_source === "household" || row?.pass_source === "flex"
          ? row.pass_source
          : null,
    };
  } catch (e) {
    console.error("[household] consume", e instanceof Error ? e.name : "unknown");
    return { ok: false, reason: "rpc_error" };
  }
}
