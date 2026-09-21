/**
 * Build + persist chart-primary prealloc for a delivery job (idempotent).
 * Pool SSOT = job chart thesis menu (D1), never raw inventory.
 */

import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import {
  preallocateChartPrimaries,
  type ChartPrimaryPreallocMap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import {
  ensureChartPrimaryPrealloc,
  loadChartThesis,
} from "@/lib/llm/pro/delivery/dispatch/task-store";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";

export async function ensureJobChartPrimaryPrealloc(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<ChartPrimaryPreallocMap> {
  return ensureChartPrimaryPrealloc(job_id, async () => {
    const thesis = await loadChartThesis(job_id);
    const structured = tryStructuredFromBaseAnalysis(input.base_analysis);
    const asOf = thesis?.as_of_day ? new Date(`${thesis.as_of_day}T12:00:00Z`) : undefined;
    return preallocateChartPrimaries({
      thesis,
      structured,
      as_of: asOf && !Number.isNaN(asOf.getTime()) ? asOf : undefined,
      eastern_calc_slice_by_key: {
        metaphysics_action: null,
      },
    });
  });
}
