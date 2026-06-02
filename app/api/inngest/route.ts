import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncroGenerateAll } from "@/lib/inngest/functions/syncro-generate-all";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncroGenerateAll],
});
