/**
 * Block 58 — signal-only confirmation + delivery sanitizer (never 422/retry)
 *
 *   pnpm exec tsx scripts/test-poju-block58-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { detectOutputPolicyViolations } from "@/lib/llm/compliance/audit-output";
import { isCriticalDeliveryAuditFailure } from "@/lib/llm/services/delivery-audit-regen";
import { sanitizeDeliveryText } from "@/lib/llm/sanitize/compliance-terms";
import { encodeTermMarker } from "@/lib/llm/sanitize/term-marking";
import type { ComplianceViolation } from "@/lib/llm/sanitize/compliance-terms";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n=== Block 58 acceptance ===\n");

  const route = read("app/api/poju/final-delivery/route.ts");
  const agent = read("lib/poju/agent.ts");
  const confirmReply = read("lib/poju/confirmation-reply.ts");
  const auditOut = read("lib/llm/compliance/audit-output.ts");
  const regen = read("lib/llm/services/delivery-audit-regen.ts");
  const compliance = read("lib/llm/sanitize/compliance-terms.ts");

  console.log("=== Q2 · signal-only confirmation ===\n");
  assert("agent no appendConfirmationInvite", !agent.includes("appendConfirmationInvite"));
  assert("agent no hasConfirmationInviteCue", !agent.includes("hasConfirmationInviteCue"));
  assert("confirmation-reply exports classify only", confirmReply.includes("classifyConfirmationAffirmative"));
  assert("confirmation-reply removed invite helpers", !confirmReply.includes("appendConfirmationInvite"));

  console.log("\n=== Q3 · single-pass delivery sanitizer ===\n");
  assert("route single generate", !route.includes("maxRetries") && !route.includes("delivery_audit_exhausted"));
  assert("route sanitize then strip", route.includes("sanitizeDeliveryText") && route.includes("stripOutOfSetFactTerms"));
  assert("route always ok:true success path", route.includes("ok: true"));
  assert("sanitizeDeliveryText mutates body", compliance.includes("sanitizeDeliveryBodyPart"));
  assert("audit-output uses maskMarkersForAudit for bazi", auditOut.includes("markerSafeText = maskMarkersForAudit"));
  assert("isCriticalDeliveryAuditFailure no bazi_", !regen.includes('label.includes("bazi_")'));
  assert("isCriticalDeliveryAuditFailure no term:", !regen.includes('startsWith("term:")'));

  console.log("\n=== Q3 · bazi soft-translate no false positive ===\n");
  const marked = encodeTermMarker("eating_god", "表达从容（食神）", "You express with ease.");
  const baziHits = detectOutputPolicyViolations(marked, "zh").filter((v) => v.category === "bazi_term");
  assert("食神 in marker visible does not flag bazi_term", baziHits.length === 0);

  console.log("\n=== Q3 · redline scrub ===\n");
  const scrubbed = sanitizeDeliveryText("═══ ANALYSIS ═══\n涉及占卜。运转与拒绝都正常。", "zh");
  assert("sanitize removes 占卜", !scrubbed.includes("占卜"));
  assert("sanitize preserves 拒绝/运转", scrubbed.includes("拒绝") && scrubbed.includes("运转"));

  console.log("\n=== Q3 · bazi violations not critical ===\n");
  const baziViolations: ComplianceViolation[] = [
    { label: "bazi_term:bazi_zh_term", snippet: "食神" },
    { label: "term:食神", snippet: "食神" },
    { label: "stem_element", snippet: "乙木" },
  ];
  assert("bazi/term/stem not critical", !isCriticalDeliveryAuditFailure(baziViolations));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 58 checks passed.\n");
}

main();
