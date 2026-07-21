import { encryptJson, decryptJson } from "@/lib/crypto";
import { ensurePojuDbReady, type BaseAnalysisV2CheckpointRecord } from "@/lib/db/poju-db";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import type { ReportSegmentTextTree } from "@/lib/base-analysis-v2/segment-text";

const CHECKPOINT_SECRET = "pojulife_v2_base_analysis_checkpoint";

export type V2CheckpointPayload = {
  locale: string;
  report_computed?: ReportComputed;
  narrative?: ReportSegmentTextTree;
  evidence?: ReportSegmentTextTree;
  updated_at: number;
};

export async function loadV2Checkpoint(
  profile_id: string,
): Promise<V2CheckpointPayload | null> {
  const db = await ensurePojuDbReady();
  const row = await db.base_analysis_v2_checkpoints.get(profile_id);
  if (!row) return null;
  try {
    return await decryptJson<V2CheckpointPayload>(CHECKPOINT_SECRET, {
      cipher: row.cipher,
      iv: row.iv,
    });
  } catch (e) {
    console.warn("[v2-checkpoint] decrypt failed, clearing", e);
    await db.base_analysis_v2_checkpoints.delete(profile_id);
    return null;
  }
}

export async function saveV2Checkpoint(
  profile_id: string,
  payload: V2CheckpointPayload,
): Promise<void> {
  const db = await ensurePojuDbReady();
  const updated_at = Date.now();
  const enc = await encryptJson(CHECKPOINT_SECRET, { ...payload, updated_at });
  const row: BaseAnalysisV2CheckpointRecord = {
    profile_id,
    cipher: enc.cipher,
    iv: enc.iv,
    updated_at,
  };
  await db.base_analysis_v2_checkpoints.put(row);
}

export async function clearV2Checkpoint(profile_id: string): Promise<void> {
  const db = await ensurePojuDbReady();
  await db.base_analysis_v2_checkpoints.delete(profile_id);
}
