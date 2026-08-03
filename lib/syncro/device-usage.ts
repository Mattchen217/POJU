/**
 * Syncro v5 — per-owner product usage (first free + paid sessions).
 * @see docs/Syncro_v5.0_Refactor.md Step 4
 */

import { getPojuDb, type DeviceUsageRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";

export type SyncroProduct = DeviceUsageRecord["product"];

function usageId(ownerKey: string, product: SyncroProduct): string {
  return `${ownerKey}__${product}`;
}

export async function isFirstTimeFree(product: SyncroProduct): Promise<boolean> {
  if (!isPaymentGatewayEnabled()) return true;
  const ownerKey = await resolveLocalOwnerKey();
  const record = await getPojuDb().device_usage.get(usageId(ownerKey, product));
  return !record?.free_used;
}

export async function recordUsage(
  product: SyncroProduct,
  isFree: boolean,
  costUsd: number,
): Promise<void> {
  const deviceId = getPojuDeviceId();
  const ownerKey = await resolveLocalOwnerKey();
  const id = usageId(ownerKey, product);
  const existing = await getPojuDb().device_usage.get(id);
  const now = new Date();

  const row: DeviceUsageRecord = {
    id,
    device_id: deviceId,
    owner_key: ownerKey,
    product,
    free_used: Boolean(existing?.free_used) || isFree,
    free_used_at:
      isFree && !existing?.free_used_at ? now : existing?.free_used_at,
    paid_count: (existing?.paid_count ?? 0) + (isFree ? 0 : 1),
    last_used_at: now,
    total_cost_usd: (existing?.total_cost_usd ?? 0) + costUsd,
  };

  await getPojuDb().device_usage.put(row);
}

export async function getProductUsage(
  product: SyncroProduct,
): Promise<DeviceUsageRecord | undefined> {
  const ownerKey = await resolveLocalOwnerKey();
  return getPojuDb().device_usage.get(usageId(ownerKey, product));
}
