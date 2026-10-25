/**
 * Phase D acceptance: joint privacy views, gate skip, pass-ref shape, pricing copy markers.
 * Run: npx tsx scripts/test-joint-decision-acceptance.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  shouldPresentDyadGate,
  shouldOfferDyadGateForSession,
  resolveDyadRelationStructureFeed,
} from "../lib/poju/dyad-compat";
import { toPublicView } from "../lib/passes/joint-decision";
import type { JointDecisionRow } from "../lib/passes/household-types";
import type { BirthInfo } from "../lib/profile/types";

const root = resolve(__dirname, "..");
function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

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

const joint: JointDecisionRow = {
  id: "j-acc",
  household_id: "h1",
  initiator_user_id: "user-a",
  invitee_user_id: "user-b",
  shared_question: "我们是否应该一起创业？",
  status: "running",
  pivot_session_id_a: "sess-a",
  pivot_session_id_b: "sess-b",
  pass_ref_a: "joint:j-acc:a",
  pass_ref_b: "joint:j-acc:b",
  birth_snapshot_a: birthA,
  birth_snapshot_b: birthB,
  invite_expires_at: null,
  accepted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Privacy: list-style view must not leak peer birth without includePartnerBirth
const listA = toPublicView(joint, "user-a", { includePartnerBirth: false });
assert.equal(listA.partner_birth_for_my_session, null);
assert.equal(listA.my_pivot_session_id, "sess-a");
const seedA = toPublicView(joint, "user-a", { includePartnerBirth: true });
assert.equal(seedA.partner_birth_for_my_session?.year, 1992);
const seedB = toPublicView(joint, "user-b", { includePartnerBirth: true });
assert.equal(seedB.partner_birth_for_my_session?.year, 1990);
assert.notEqual(seedA.my_pivot_session_id, seedB.my_pivot_session_id);

// Gate skip
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
  shouldOfferDyadGateForSession({ joint_decision: true }),
  false,
);

// Prompt micro-copy
const feed = resolveDyadRelationStructureFeed({
  partner_bazi: "present",
  pivot_chart_path: "dyad",
  joint_decision: true,
});
assert.ok(feed.includes("joint_decision=true"));
assert.ok(feed.includes("本侧立场"));

// Pass ref shape used by consume idempotency
assert.ok(joint.pass_ref_a?.startsWith("joint:"));
assert.ok(joint.pass_ref_b?.startsWith("joint:"));
assert.notEqual(joint.pass_ref_a, joint.pass_ref_b);

// Wiring markers (static)
assert.ok(read("app/api/poju/final-delivery/route.ts").includes("joint_pass_ref"));
assert.ok(read("lib/passes/consume-pass-smart.ts").includes("consumeHouseholdPass"));
assert.ok(read("lib/passes/credit-passes.ts").includes("createOrRefreshDuoHousehold"));
assert.ok(read("components/account/DuoHouseholdCard.tsx").includes("JointDecisionPanel"));
assert.ok(read("supabase/migrations/20261025_duo_household_joint.sql").includes("consume_household_pass"));
assert.ok(read("messages/en.json").includes("Duo joint-decision plan"));
assert.ok(read("messages/zh.json").includes("双人共同决策订阅"));
assert.ok(read("components/account/PassPurchaseModal.tsx").includes("TEAM_CHECKOUT_ENABLED = false"));
assert.ok(read("lib/poju/hydrate-joint-session.ts").includes("joint_pass_ref"));
assert.ok(read("components/poju/POJUChatUI.tsx").includes("共同决策 · 共同问题"));

console.log("OK Phase D joint-decision acceptance");
