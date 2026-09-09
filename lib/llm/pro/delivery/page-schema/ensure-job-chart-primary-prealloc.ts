/**
 * Build + persist chart-primary prealloc for a delivery job (idempotent).
 */

import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import {
  buildCategoryTokenSetsFromStructured,
  tryStructuredFromBaseAnalysis,
} from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import {
  preallocateChartPrimaries,
  type ChartPrimaryPreallocMap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { ensureChartPrimaryPrealloc } from "@/lib/llm/pro/delivery/dispatch/task-store";

export async function ensureJobChartPrimaryPrealloc(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<ChartPrimaryPreallocMap> {
  return ensureChartPrimaryPrealloc(job_id, () => {
    const structured = tryStructuredFromBaseAnalysis(input.base_analysis);
    const sets = buildCategoryTokenSetsFromStructured(structured);
    return preallocateChartPrimaries({
      category_token_sets: sets,
      eastern_calc_slice_by_key: {
        // Slice not always available at finalize seed — P4 moat uses null → default eligible.
        metaphysics_action: null,
      },
    });
  });
}
