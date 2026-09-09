import { randomBytes } from "node:crypto";
import { kv, KV_TTL } from "@/lib/kv/client";
import {
  initLabSteps,
  LAB_TTL_SEC,
  type DeliveryLabSession,
  type LabSource,
} from "@/lib/llm/pro/delivery/lab/types";

export function deliveryLabKey(lab_id: string): string {
  return `poju-delivery-lab:${lab_id}`;
}

export function newLabId(): string {
  return `lab_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export async function createDeliveryLab(input: {
  ops_user: string;
  source: LabSource;
}): Promise<DeliveryLabSession> {
  const lab_id = newLabId();
  const now = Date.now();
  const session: DeliveryLabSession = {
    version: 1,
    lab_id,
    created_at: now,
    updated_at: now,
    ops_user: input.ops_user,
    source: {
      ...input.source,
      session_id: input.source.session_id?.trim() || `lab-${lab_id}`,
    },
    cursor_index: 0,
    steps: initLabSteps(),
    artifacts: { by_page: {} },
    approved_order: [],
  };
  await saveDeliveryLab(session);
  return session;
}

export async function loadDeliveryLab(lab_id: string): Promise<DeliveryLabSession | null> {
  const raw = await kv.get<DeliveryLabSession>(deliveryLabKey(lab_id));
  if (!raw || typeof raw !== "object" || raw.version !== 1) return null;
  return raw;
}

export async function saveDeliveryLab(session: DeliveryLabSession): Promise<void> {
  session.updated_at = Date.now();
  await kv.set(deliveryLabKey(session.lab_id), session, {
    ex: Math.max(LAB_TTL_SEC, KV_TTL.POJU_XHIGH_JOB),
  });
}

export async function appendLabAudit(entry: {
  ops_user: string;
  lab_id: string;
  action: string;
  detail?: string;
}): Promise<void> {
  const key = `poju-delivery-lab:audit:${entry.lab_id}`;
  try {
    const prev = (await kv.get<unknown[]>(key)) ?? [];
    const list = Array.isArray(prev) ? prev.slice(-200) : [];
    list.push({ ...entry, ts: new Date().toISOString() });
    await kv.set(key, list, { ex: LAB_TTL_SEC });
  } catch (e) {
    console.warn("[delivery/lab] audit write failed", {
      lab_id: entry.lab_id,
      err: e instanceof Error ? e.message : String(e),
    });
  }
}
