import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncroGenerateBatch } from "@/lib/inngest/functions/syncro-generate-batch";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncroGenerateBatch],
});
