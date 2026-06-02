import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncroGenerateRemaining } from "@/lib/inngest/functions/syncro-generate-remaining";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncroGenerateRemaining],
});
