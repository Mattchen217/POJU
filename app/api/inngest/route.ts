import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { companionBatchFill } from "@/lib/inngest/functions/companion-batch-fill";
import { companionDripTick } from "@/lib/inngest/functions/companion-drip-tick";
import { pojuFinalDeliveryContinue } from "@/lib/inngest/functions/poju-final-delivery-continue";
import { pojuFinalDeliveryTask } from "@/lib/inngest/functions/poju-final-delivery-task";
import { reportBatch2InngestFunctions } from "@/lib/inngest/functions/report-batch2";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    pojuFinalDeliveryContinue,
    pojuFinalDeliveryTask,
    companionBatchFill,
    companionDripTick,
    ...reportBatch2InngestFunctions,
  ],
});
