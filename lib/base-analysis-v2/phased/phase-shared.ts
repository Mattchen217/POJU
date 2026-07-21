import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { acquireLock, renewLockIfHeld } from "@/lib/base-analysis/job-store";
import { auditBaseAnalysisDelivery } from "@/lib/base-analysis/delivery-gate";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import { validateReportComputed } from "@/lib/base-analysis-v2/report-schema";
import { mergeToMarkdown } from "@/lib/base-analysis-v2/orchestrate/run-report";
import {
  validateSegmentKeys,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";
import { forceSsotPlainInMarkers, demoteWuxingMarkers } from "@/lib/llm/sanitize/term-marking";

/** 第1/2/3次永远中文；外文在 finalize 里翻译。 */
export const PIPELINE_LOCALE = "zh";

/** Renew if held; otherwise acquire (resume after lock TTL with local checkpoint). */
export async function ensurePhasedLock(profileId: string): Promise<boolean> {
  if (await renewLockIfHeld(profileId)) return true;
  if (await acquireLock(profileId)) return true;
  // narrative ∥ evidence 同时抢锁时，败者稍等再 renew（同 profile 流水线）
  await new Promise((r) => setTimeout(r, 80));
  return renewLockIfHeld(profileId);
}

export function requireStructured(
  structured: unknown,
): ProfileStructured | { error: string } {
  if (!structured || typeof structured !== "object") {
    return { error: "Missing local_data.structured" };
  }
  return structured as ProfileStructured;
}

export function requireReportComputed(
  value: unknown,
): ReportComputed | { error: string } {
  const v = validateReportComputed(value);
  if (v.ok) return v.value;
  // soft：个别段缺但仍有可用树（与 compute-call 放行策略一致）
  if (v.severity === "soft" && v.value) return v.value;
  return { error: `Invalid report_computed: ${v.reason}` };
}

export function requireSegmentTree(
  value: unknown,
  kind: "narrative" | "evidence",
): ReportSegmentTextTree | { error: string } {
  const err = validateSegmentKeys(value, kind);
  if (err) return { error: err };
  return value as ReportSegmentTextTree;
}

/**
 * merge → compliance sanitize → soft-label fill → wuxing demote.
 * Gate is observe-only (never fail).
 */
export function finalizeReportMarkdown(
  rc: ReportComputed,
  narrative: ReportSegmentTextTree,
  evidence: ReportSegmentTextTree,
  locale: string,
  structured: ProfileStructured,
): string {
  const merged = mergeToMarkdown(rc, narrative, evidence, locale);
  const gated = demoteWuxingMarkers(
    forceSsotPlainInMarkers(applyComplianceSanitize(merged, locale).text, locale),
  );
  const gate = auditBaseAnalysisDelivery(gated, locale, structured, {
    skipEvidenceProse: true,
  });
  if (!gate.ok) {
    console.warn(
      `[base-analysis-v2/phase] gate observe:`,
      gate.violations.slice(0, 5).map((v) => v.label).join(", "),
    );
  }
  return gated;
}
