/**
 * Smoke: account-scoped local owner keys isolate session lists.
 * Run: pnpm exec tsx scripts/test-local-owner-isolation.ts
 */

import assert from "node:assert/strict";

import {
  guestOwnerKey,
  isRowOwnedBy,
  userOwnerKey,
} from "../lib/storage/local-owner";

type FakeSession = {
  session_id: string;
  device_id: string;
  owner_key?: string;
  status: "active" | "archived";
};

function listForOwner(rows: FakeSession[], ownerKey: string): FakeSession[] {
  return rows.filter((r) => isRowOwnedBy(r, ownerKey) && r.status === "active");
}

function main(): void {
  const deviceId = "device-shared-browser";
  const ownerA = userOwnerKey("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  const ownerB = userOwnerKey("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  const guest = guestOwnerKey(deviceId);

  assert.equal(ownerA, "user:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(guest, `guest:${deviceId}`);
  assert.notEqual(ownerA, ownerB);
  assert.notEqual(ownerA, guest);

  const rows: FakeSession[] = [
    { session_id: "s-a1", device_id: deviceId, owner_key: ownerA, status: "active" },
    { session_id: "s-a2", device_id: deviceId, owner_key: ownerA, status: "active" },
    { session_id: "s-b1", device_id: deviceId, owner_key: ownerB, status: "active" },
    { session_id: "s-g1", device_id: deviceId, owner_key: guest, status: "active" },
    { session_id: "s-legacy", device_id: deviceId, status: "active" },
  ];

  const listA = listForOwner(rows, ownerA);
  const listB = listForOwner(rows, ownerB);
  const listGuest = listForOwner(rows, guest);

  assert.deepEqual(
    listA.map((r) => r.session_id).sort(),
    ["s-a1", "s-a2"],
  );
  assert.deepEqual(
    listB.map((r) => r.session_id),
    ["s-b1"],
  );
  assert.deepEqual(
    listGuest.map((r) => r.session_id),
    ["s-g1"],
  );

  // Foreign load guard: missing / wrong owner → not owned
  assert.equal(isRowOwnedBy(rows[0], ownerB), false);
  assert.equal(isRowOwnedBy(rows[4], ownerA), false);
  assert.equal(isRowOwnedBy(null, ownerA), false);

  // Usage id shape (owner-scoped)
  const usageId = (ownerKey: string, product: string) => `${ownerKey}__${product}`;
  assert.equal(usageId(ownerA, "syncro"), `${ownerA}__syncro`);
  assert.notEqual(usageId(ownerA, "syncro"), usageId(ownerB, "syncro"));
  assert.notEqual(usageId(ownerA, "syncro"), usageId(guest, "syncro"));

  console.log("ok: local-owner isolation (same device_id, separate owner_key partitions)");
}

main();
