/**
 * Unit checks for joint decision public views + dyad gate skip.
 * Run: npx tsx scripts/test-joint-decision-unit.ts
 */

import assert from "node:assert/strict";
import {
  shouldPresentDyadGate,
  shouldOfferDyadGateForSession,
} from "../lib/poju/dyad-compat";
import { toPublicView } from "../lib/passes/joint-decision";
import type { JointDecisionRow } from "../lib/passes/household-types";
import type { BirthInfo } from "../lib/profile/types";

const birthA: BirthInfo = {
  year: 1990,
  month: 5,
  day: 12,
  hour_period: "wu",
  gender: "M",
  timezone: "Asia/Shanghai",
};
const birthB: BirthInfo = {
  year: 1992,
  month: 8,
  day: 3,
  hour_period: "shen",
  gender: "F",
  timezone: "Asia/Shanghai",
};

const baseJoint: JointDecisionRow = {
  id: "j1",
  household_id: "h1",
  initiator_user_id: "user-a",
  invitee_user_id: "user-b",
  shared_question: "我们是否应该搬到另一个城市？",
  status: "running",
  pivot_session_id_a: "sess-a",
  pivot_session_id_b: "sess-b",
  pass_ref_a: "joint:j1:a",
  pass_ref_b: "joint:j1:b",
  birth_snapshot_a: birthA,
  birth_snapshot_b: birthB,
  invite_expires_at: null,
  accepted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// A sees B's birth only as partner_for_my_session when includePartnerBirth
const viewA = toPublicView(baseJoint, "user-a", { includePartnerBirth: true });
assert.equal(viewA.role, "initiator");
assert.equal(viewA.my_pivot_session_id, "sess-a");
assert.equal(viewA.peer_user_id, "user-b");
assert.equal(viewA.partner_birth_for_my_session?.year, 1992);
assert.equal(viewA.shared_question.includes("搬到"), true);

const viewB = toPublicView(baseJoint, "user-b", { includePartnerBirth: true });
assert.equal(viewB.role, "invitee");
assert.equal(viewB.partner_birth_for_my_session?.year, 1990);

const viewANoBirth = toPublicView(baseJoint, "user-a", { includePartnerBirth: false });
assert.equal(viewANoBirth.partner_birth_for_my_session, null);

// Gate skip for joint
assert.equal(
  shouldPresentDyadGate({
    openingTurn: true,
    dyadHit: true,
    dyadOfferStatus: "none",
    jointDecision: true,
  }),
  false,
);
assert.equal(
  shouldOfferDyadGateForSession({ joint_decision: true, dyad_offer_status: "none" }),
  false,
);
assert.equal(
  shouldPresentDyadGate({
    openingTurn: true,
    dyadHit: true,
    dyadOfferStatus: "none",
    jointDecision: false,
  }),
  true,
);

console.log("OK joint-decision unit checks");
