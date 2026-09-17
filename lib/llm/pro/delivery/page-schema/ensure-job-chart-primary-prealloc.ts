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

export async function ensureJobChartPrimaryPrealloc(
  job_id: string,
  _input: FinalDeliveryJobInput,
): Promise<ChartPrimaryPreallocMap> {
  return ensureChartPrimaryPrealloc(job_id, async () => {
    const thesis = await loadChartThesis(job_id);
    return preallocateChartPrimaries({
      thesis,
      eastern_calc_slice_by_key: {
        // Slice not always available at finalize seed — P4 moat uses null → default eligible.
        metaphysics_action: null,
      },
    });
  });
}
