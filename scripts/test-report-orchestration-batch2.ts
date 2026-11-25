/**
 * Report orchestration Batch 2 — delegates to R1 harness (durable KV + registered Inngest).
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch2.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";
import "./test-report-orchestration-batch2-r1";