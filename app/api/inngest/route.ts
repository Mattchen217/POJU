import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Step B will register syncroGenerateAllHours; empty until then.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
