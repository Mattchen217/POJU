import type { BirthInfo } from "@/lib/profile/types";

export type HouseholdStatus = "pending_partner" | "active" | "canceled";

export type HouseholdRow = {
  id: string;
  plan: "duo";
  status: HouseholdStatus;
  seat_a_user_id: string;
  seat_b_user_id: string | null;
  shared_sub_balance: number;
  quota: number;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  seat_invite_token: string | null;
  seat_invite_email: string | null;
  seat_invite_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JointStatus =
  | "invited"
  | "accepted"
  | "partner_ready"
  | "running"
  | "sealed"
  | "canceled"
  | "expired";

export type JointDecisionRow = {
  id: string;
  household_id: string | null;
  initiator_user_id: string;
  invitee_user_id: string;
  invitee_email: string | null;
  shared_question: string;
  status: JointStatus;
  pivot_session_id_a: string | null;
  pivot_session_id_b: string | null;
  pass_ref_a: string | null;
  pass_ref_b: string | null;
  birth_snapshot_a: BirthInfo | null;
  birth_snapshot_b: BirthInfo | null;
  unread_a: boolean;
  unread_b: boolean;
  invite_expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Client-safe joint view: never includes the other user's birth snapshot. */
export type JointDecisionPublicView = {
  id: string;
  household_id: string | null;
  role: "initiator" | "invitee";
  shared_question: string;
  status: JointStatus;
  my_pivot_session_id: string | null;
  peer_user_id: string;
  peer_label: string | null;
  unread: boolean;
  waiting_for_partner: boolean;
  partner_ready: boolean;
  my_charged: boolean;
  accepted_at: string | null;
  created_at: string;
  /** Partner birth for *this* user's local dyad session only (encrypted client-side). */
  partner_birth_for_my_session?: BirthInfo | null;
  /** This user's own birth snapshot (for hydrate after partner ready). */
  self_birth_for_my_session?: BirthInfo | null;
  joint_decision: true;
};

export const DUO_MONTHLY_QUOTA = 5;
export const DUO_FIRST_GRANT = 5;
export const JOINT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SEAT_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
