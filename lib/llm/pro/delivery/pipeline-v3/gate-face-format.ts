/**
 * Face-native format gate (§生成规格 D).
 * New books: segment fields present; no primary/backup; scare redline.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { FACE_SEGMENT_FIELDS, faceJsonHasLegacyPrimaryBackup } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { facePageSchema } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";

export type FaceFormatGateVerdict = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
  notes: string[];
};

function asFaceId(key: string): DecisionPageId | null {
  return (DECISION_PAGE_IDS as readonly string[]).includes(key)
    ? (key as DecisionPageId)
    : null;
}

export function isFaceDeliveryKey(key: string): boolean {
  return asFaceId(key) != null;
}

export function gateFaceFormat(input: {
  key: string;
  page_schema: unknown;
}): FaceFormatGateVerdict {
  const notes: string[] = ["gate:face_format"];
  const faceId = asFaceId(input.key);
  if (!faceId) {
    return {
      passed: false,
      failed_rule: "gate_not_face_key",
      detail: `期望 face id 01–08，收到 ${input.key}`,
      notes,
    };
  }
  const page = input.page_schema;
  if (!page || typeof page !== "object") {
    return {
      passed: false,
      failed_rule: "gate_missing_page_schema",
      detail: `Face ${faceId} 未产出 JSON。`,
      notes,
    };
  }
  if (faceJsonHasLegacyPrimaryBackup(page)) {
    return {
      passed: false,
      failed_rule: "gate_legacy_primary_backup",
      detail: `新书 Face ${faceId} 不得含 primary/backup（或 toolkit）。按 face zod 重写。`,
      notes,
    };
  }
  const scare = scareRedlineSnippet(JSON.stringify(page));
  if (scare) {
    return {
      passed: false,
      failed_rule: "scare_redline",
      detail: `恐吓红线命中「${scare}」。`,
      notes,
    };
  }
  const parsed = facePageSchema(faceId).safeParse({
    ...(page as object),
    page: faceId,
    face: faceId,
  });
  if (!parsed.success) {
    return {
      passed: false,
      failed_rule: "gate_face_zod_fail",
      detail: `Face ${faceId} zod 未过：${parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; ")}`,
      notes,
    };
  }
  // Extra: required string segments non-empty already via zod NonEmpty;
  // list fields checked by min(1).
  for (const { key } of FACE_SEGMENT_FIELDS[faceId]) {
    notes.push(`seg_ok:${key}`);
  }
  notes.push("face_format_pass");
  return { passed: true, notes };
}
