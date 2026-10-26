/**
 * Duo household: 2 seats, shared PASS pool.
 */

import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import {
  DUO_FIRST_GRANT,
  DUO_MONTHLY_QUOTA,
  SEAT_INVITE_TTL_MS,
  type HouseholdRow,
} from "@/lib/passes/household-types";
import {
  verifyPartnerPasswordNoSession,
  verifyPartnerSignupOtpNoSession,
} from "@/lib/passes/partner-credential-check";

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

export type EnsureHouseholdResult = {
  household: HouseholdRow | null;
  subscriptionActive: boolean;
  /**
   * Why household is missing when caller expected one.
   * Never use "no_subscription" when subscriptionActive is true.
   */
  reason?:
    | "admin_unconfigured"
    | "no_subscription"
    | "create_failed"
    | "update_failed"
    | "household_schema_missing"
    | "lookup_failed";
};

function isMissingRelationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

/**
 * Backfill: active Personal/Team subscriber without a household row
 * still gets a duo household so joint CTA can light up and seats can bind.
 * Subscription UI reads user_passes; bind/invite require this household row —
 * keep them aligned.
 */
export async function ensureHouseholdForActiveSubscriber(
  userId: string,
): Promise<EnsureHouseholdResult> {
  if (!isSupabaseAdminConfigured()) {
    return {
      household: null,
      subscriptionActive: false,
      reason: "admin_unconfigured",
    };
  }

  const admin = createSupabaseAdminClient();
  const existingLookup = await admin
    .from("pass_households")
    .select("*")
    .eq("seat_a_user_id", userId)
    .in("status", ["pending_partner", "active"])
    .maybeSingle();

  if (existingLookup.error && isMissingRelationError(existingLookup.error)) {
    console.error(
      "[household] ensure schema missing",
      existingLookup.error.code,
      existingLookup.error.message,
    );
    return {
      household: null,
      subscriptionActive: false,
      reason: "household_schema_missing",
    };
  }

  let existing = asHousehold(
    (existingLookup.data as Record<string, unknown> | null) ?? null,
  );
  if (!existing) {
    const asB = await admin
      .from("pass_households")
      .select("*")
      .eq("seat_b_user_id", userId)
      .in("status", ["pending_partner", "active"])
      .maybeSingle();
    if (asB.error && isMissingRelationError(asB.error)) {
      return {
        household: null,
        subscriptionActive: false,
        reason: "household_schema_missing",
      };
    }
    existing = asHousehold((asB.data as Record<string, unknown> | null) ?? null);
  }

  const { data: passes, error: passesErr } = await admin
    .from("user_passes")
    .select(
      "subscription_status, subscription_plan, sub_balance, sub_quota, sub_carryover, stripe_subscription_id, current_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (passesErr) {
    console.error("[household] ensure passes", passesErr.code, passesErr.message);
  }

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
    return { household: null, subscriptionActive: false, reason: "no_subscription" };
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
    // Race: another request created the row — re-read.
    const raced = await findHouseholdForUser(userId);
    if (raced) {
      return { household: raced, subscriptionActive: true };
    }
    console.error("[household] ensure create failed", created.reason);
    return {
      household: null,
      subscriptionActive: true,
      reason:
        created.reason === "household_schema_missing"
          ? "household_schema_missing"
          : created.reason === "update_failed"
            ? "update_failed"
            : "create_failed",
    };
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
  /** Overwrite existing seat B. */
  replace?: boolean;
}): Promise<
  | { ok: true; household: HouseholdRow }
  | { ok: false; reason: string }
> {
  if (params.partnerUserId === params.actorUserId) {
    return { ok: false, reason: "cannot_bind_self" };
  }
  const other = await findHouseholdForUser(params.partnerUserId);
  if (other && other.id !== params.householdId) {
    return { ok: false, reason: "already_in_household" };
  }

  const admin = createSupabaseAdminClient();
  let query = admin
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
    .eq("seat_a_user_id", params.actorUserId);

  if (!params.replace) {
    query = query.is("seat_b_user_id", null);
  }

  const { data, error } = await query.select("*").maybeSingle();

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
  replace?: boolean;
}): Promise<
  | { ok: true; household: HouseholdRow; partner_user_id: string }
  | { ok: false; reason: string }
> {
  const ensured = await ensureHouseholdForActiveSubscriber(params.actorUserId);
  const hh = ensured.household;
  if (!hh) {
    return {
      ok: false,
      reason:
        ensured.reason === "no_subscription" || !ensured.subscriptionActive
          ? "no_subscription"
          : (ensured.reason ?? "create_failed"),
    };
  }
  if (hh.seat_a_user_id !== params.actorUserId) {
    return { ok: false, reason: "only_seat_a_can_bind" };
  }
  if (hh.seat_b_user_id && !params.replace) {
    return { ok: false, reason: "already_full" };
  }

  const attached = await attachSeatB({
    householdId: hh.id,
    actorUserId: params.actorUserId,
    partnerUserId: params.partnerUserId,
    replace: params.replace === true,
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
  replace?: boolean;
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
  if (!hh) {
    return {
      ok: false,
      reason:
        ensured.reason === "no_subscription" || !ensured.subscriptionActive
          ? "no_subscription"
          : (ensured.reason ?? "create_failed"),
    };
  }
  if (hh.seat_a_user_id !== params.actorUserId) {
    return { ok: false, reason: "only_seat_a_can_bind" };
  }
  if (hh.seat_b_user_id && !params.replace) {
    return { ok: false, reason: "already_full" };
  }

  // Raw GoTrue password check only — never write Cookie session for partner.
  const verified = await verifyPartnerPasswordNoSession({ email, password });
  if (!verified.ok) {
    return { ok: false, reason: verified.reason === "unconfigured" ? "admin_unconfigured" : verified.reason };
  }
  const partnerId = verified.userId;

  const attached = await attachSeatB({
    householdId: hh.id,
    actorUserId: params.actorUserId,
    partnerUserId: partnerId,
    replace: params.replace === true,
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
  replace?: boolean;
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

  // Raw GoTrue OTP verify — discard tokens; seat A cookies must not change.
  const verified = await verifyPartnerSignupOtpNoSession({ email, token });
  if (!verified.ok) {
    return {
      ok: false,
      reason: verified.reason === "unconfigured" ? "admin_unconfigured" : verified.reason,
    };
  }

  return bindSeatByUserId({
    actorUserId: params.actorUserId,
    partnerUserId: verified.userId,
    replace: params.replace === true,
  });
}

/** Seat A clears seat B so a new partner can be invited/bound. */
export async function clearSeatBForReplace(params: {
  actorUserId: string;
}): Promise<{ ok: true; household: HouseholdRow } | { ok: false; reason: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }
  const ensured = await ensureHouseholdForActiveSubscriber(params.actorUserId);
  const hh = ensured.household;
  if (!hh) return { ok: false, reason: "no_subscription" };
  if (hh.seat_a_user_id !== params.actorUserId) {
    return { ok: false, reason: "only_seat_a_can_bind" };
  }
  if (!hh.seat_b_user_id) {
    return { ok: true, household: hh };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pass_households")
    .update({
      seat_b_user_id: null,
      status: "pending_partner",
      updated_at: new Date().toISOString(),
    })
    .eq("id", hh.id)
    .eq("seat_a_user_id", params.actorUserId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("[household] clear seat b", error?.code ?? error?.message);
    return { ok: false, reason: "clear_failed" };
  }
  return { ok: true, household: data as HouseholdRow };
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
    if (isMissingRelationError(error)) {
      return { ok: false, reason: "household_schema_missing" };
    }
    // Unique seat_a race — caller should re-fetch.
    if (error?.code === "23505") {
      const again = await findHouseholdForUser(params.seatAUserId);
      if (again && again.seat_a_user_id === params.seatAUserId) {
        return { ok: true, household: again };
      }
    }
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
  // Seat B already filled — cannot mint invite unless caller cleared via replace.
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
    .eq("id", params.householdId)
    .is("seat_b_user_id", null);
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
