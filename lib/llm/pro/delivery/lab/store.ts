import { randomBytes } from "node:crypto";
import { kv, KV_TTL } from "@/lib/kv/client";
import {
  initLabSteps,
  LAB_TTL_SEC,
  type DeliveryLabSession,
  type LabSource,
} from "@/lib/llm/pro/delivery/lab/types";
import { initLabStepsV3 } from "@/lib/llm/pro/delivery/lab/types-v3";
import {
  DEFAULT_LAB_PIPELINE_STAMP,
  labUsesV3Executor,
} from "@/lib/llm/pro/delivery/lab/pipeline-stamp";
import { createLabChatSession } from "@/lib/llm/pro/delivery/lab/lab-chat-session";
import type { LabPipelineMode } from "@/lib/llm/pro/delivery/lab/lab-pipeline-types";

export function deliveryLabKey(lab_id: string): string {
  return `poju-delivery-lab:${lab_id}`;
}

/** Side-KV for parallel mark chunks (avoids racing the whole lab session). */
export function deliveryLabMarkChunkKey(
  lab_id: string,
  page: string,
  chunk_index: number,
): string {
  return `poju-delivery-lab:${lab_id}:mark:${page}:c${chunk_index}`;
}

export async function saveLabMarkChunkPartial(input: {
  lab_id: string;
  page: string;
  chunk_index: number;
  partial: unknown;
}): Promise<void> {
  await kv.set(
    deliveryLabMarkChunkKey(input.lab_id, input.page, input.chunk_index),
    { partial: input.partial, saved_at: Date.now() },
    { ex: Math.max(LAB_TTL_SEC, KV_TTL.POJU_XHIGH_JOB) },
  );
}

export async function loadLabMarkChunkPartial(
  lab_id: string,
  page: string,
  chunk_index: number,
): Promise<unknown | null> {
  const raw = await kv.get<{ partial?: unknown }>(
    deliveryLabMarkChunkKey(lab_id, page, chunk_index),
  );
  return raw?.partial ?? null;
}

export async function clearLabMarkChunkPartials(
  lab_id: string,
  page: string,
  max_chunks = 16,
): Promise<void> {
  await Promise.all(
    Array.from({ length: max_chunks }, (_, i) =>
      kv.del(deliveryLabMarkChunkKey(lab_id, page, i)).catch(() => undefined),
    ),
  );
}

export function newLabId(): string {
  return `lab_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export async function createDeliveryLab(input: {
  ops_user: string;
  source: LabSource;
  mode?: LabPipelineMode;
  selected_stored_profile_id?: string | null;
}): Promise<DeliveryLabSession> {
  const lab_id = newLabId();
  const now = Date.now();
  /** Decoupled from env DELIVERY_PIPELINE — new Labs match live prod v3. */
  const pipeline = DEFAULT_LAB_PIPELINE_STAMP;
  const useV3 = labUsesV3Executor(pipeline);
  const mode: LabPipelineMode = input.mode === "full_pipeline" ? "full_pipeline" : "delivery_only";
  const sourceSessionId =
    input.source.session_id?.trim() ||
    (mode === "full_pipeline" ? `lab-chat-${lab_id}` : `lab-${lab_id}`);
  const session: DeliveryLabSession = {
    version: 1,
    lab_id,
    created_at: now,
    updated_at: now,
    ops_user: input.ops_user,
    source: {
      ...input.source,
      session_id: sourceSessionId,
    },
    pipeline,
    cursor_index: 0,
    steps: useV3 ? initLabStepsV3() : initLabSteps(),
    artifacts: { by_page: {} },
    approved_order: [],
    mode,
  };
  if (mode === "full_pipeline") {
    session.chat_session = createLabChatSession({
      lab_id,
      original_question: input.source.original_question,
      locale: input.source.locale,
      selected_stored_profile_id: input.selected_stored_profile_id ?? null,
    });
    session.pipeline_turns = [];
    session.pipeline_cursor = "opening";
    session.pipeline_delivery_unlocked = false;
    session.pipeline_pending_job = null;
  }
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
