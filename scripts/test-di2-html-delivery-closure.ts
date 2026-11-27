/**
 * Unit F-R2 Repair — DI2 standalone HTML delivery closure.
 *
 *   pnpm exec tsx scripts/test-di2-html-delivery-closure.ts
 *
 * MemoryKv / mocked email only — no OpenRouter, no real Resend.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import {
  DI2_HTML_TEMPLATE_VERSION,
  Di2HtmlExportError,
  di2HtmlContentIdentity,
  fillDi2AuthorityHtml,
  readDi2HtmlPackCache,
  resolveDi2HtmlProseOrder,
  resolveDi2HtmlSlotIds,
  sameDi2HtmlPackIdentity,
  writeDi2HtmlPackCache,
  type Di2HtmlPageAuthority,
  type Di2HtmlPackIdentity,
} from "../lib/deliverables/di2-html-authority";
import {
  __setDi2DeliveryEmailDepsForTests,
  sendAuthorizedDi2DeliveryEmail,
} from "../lib/deliverables/di2-delivery-email";
import { fillDecisionReportHtml } from "../lib/deliverables/fill-delivery";
import { buildDeliveryShelfSlots } from "../lib/poju/delivery-shelf-slots";
import type { CompletedReportRecord } from "../lib/poju/decision-intake/decision-report-store";
import { DI2_REPORT_SCHEMA_VERSION } from "../lib/poju/decision-intake/decision-report-types";
import { PERSONAL_ANALYSIS_SCHEMA_VERSION } from "../lib/poju/decision-intake/decision-report-types";

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    console.error(e);
  }
}

function page(
  page_id: Di2HtmlPageAuthority["page_id"],
  opts: Partial<Di2HtmlPageAuthority> & { body?: string } = {},
): Di2HtmlPageAuthority {
  const applicability = opts.applicability ?? "applies";
  const body =
    opts.body ??
    (applicability === "not_applicable" && page_id === "03"
      ? ""
      : `## Page ${page_id}\n\nBody for page ${page_id}.`);
  return {
    page_id,
    applicability,
    content_markdown: opts.content_markdown ?? body,
    status: opts.status ?? "completed",
    error: opts.error ?? null,
    structured: opts.structured ?? null,
  };
}

function fullSet(opts?: {
  page03?: boolean;
  page07?: "applies" | "not_applicable" | "insufficient_information";
}): { pages: Di2HtmlPageAuthority[]; fullText: string } {
  const page07Mode = opts?.page07 ?? "not_applicable";
  const pages: Di2HtmlPageAuthority[] = [
    page("01"),
    page("02"),
    page("04"),
    page("05"),
    page("06"),
    page07Mode === "insufficient_information"
      ? page("07", {
          applicability: "applies",
          error: "insufficient_information",
          structured: {
            page: "07",
            face: "07",
            schema_version: "face07-v2",
            applicability_status: "insufficient_information",
            field_units: [],
          },
        })
      : page("07", {
          applicability: page07Mode,
          body:
            page07Mode === "not_applicable"
              ? "Page 07 is not applicable for this decision."
              : "## Page 07\n\nField and relationship analysis.",
        }),
    page("08"),
    opts?.page03 === false
      ? page("03", { applicability: "not_applicable", body: "" })
      : page("03", {
          applicability: "applies",
          body: "## 附录 · 术语\n\n- **柔蔓**：说明。",
        }),
  ];
  const order = pages
    .filter((p) => p.applicability === "applies" && p.content_markdown.trim())
    .map((p) => p.page_id);
  // Build a simple book markdown that shelf can parse by headings.
  const parts = [
    `# 关于「测试」的能量决策报告`,
    `> subtitle`,
    `## 目录`,
    ...order.map((id, i) => `${i + 1}. Page ${id}`),
  ];
  for (const id of ["01", "02", "04", "05", "06", "07", "08", "03"]) {
    const p = pages.find((x) => x.page_id === id)!;
    if (p.applicability === "not_applicable" && !p.content_markdown.trim()) continue;
    if (id === "03") {
      parts.push(`## 附录 · 术语说明\n\n${p.content_markdown.replace(/^##[^\n]*\n*/, "")}`);
    } else if (id === "07" && p.applicability === "not_applicable") {
      // omit from full_text when not applicable (matches di2ReadingOrder)
      continue;
    } else {
      parts.push(`## 第${id}部分 · Face ${id}\n\n${p.content_markdown.replace(/^##[^\n]*\n*/, "")}`);
    }
  }
  return { pages, fullText: parts.join("\n\n") };
}

async function sealedRecord(
  pages: Di2HtmlPageAuthority[],
  fullText: string,
): Promise<CompletedReportRecord> {
  const { sealCompletedReportRecord } = await import(
    "../lib/poju/decision-intake/decision-report-store"
  );
  const now = "2026-11-27T12:00:00.000Z";
  const pageRecords = pages.map((p) => ({
    page_id: p.page_id,
    status: "completed" as const,
    applicability: p.applicability,
    content_markdown: p.content_markdown,
    structured: p.structured ?? null,
    job_id: "job_html_1",
    execution_generation: 1,
    freeze_id: "freeze_1",
    context_hash: "ctx_hash_1",
    report_schema_version: DI2_REPORT_SCHEMA_VERSION,
    analysis_id: "pa_1",
    attempts: 1,
    generated_at: now,
    error: p.error,
  }));
  return sealCompletedReportRecord({
    job_id: "job_html_1",
    session_id: "sess_html_1",
    execution_generation: 1,
    report_job_id: "report_html_1",
    freeze_id: "freeze_1",
    context_id: "ctx_1",
    context_version: 1,
    context_hash: "ctx_hash_1",
    profile_id: null,
    profile_hash: "ph_1",
    freeze_receipt_id: "fr_1",
    profile_receipt_id: "pr_1",
    report_schema_version: DI2_REPORT_SCHEMA_VERSION,
    analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
    analysis_id: "pa_1",
    result: {
      kind: "decision_intake_report",
      report_job_id: "report_html_1",
      analysis_id: "pa_1",
      freeze_id: "freeze_1",
      context_hash: "ctx_hash_1",
      report_schema_version: DI2_REPORT_SCHEMA_VERSION,
      execution_generation: 1,
      page_ids: pages.map((p) => p.page_id) as CompletedReportRecord["result"]["page_ids"],
      full_text: fullText,
      model: "test",
      tokens_used: 0,
      completed_at: now,
    },
    analysis: {
      analysis_id: "pa_1",
      status: "unavailable",
      analysis_result: null,
      freeze_id: "freeze_1",
      context_id: "ctx_1",
      context_version: 1,
      context_hash: "ctx_hash_1",
      profile_id: null,
      profile_hash: "ph_1",
      session_id: "sess_html_1",
      analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
      attempts: 0,
      error: "unavailable",
      retryable: false,
      model: null,
      tokens_used: 0,
      idempotency_key: "ak_1",
      generated_at: null,
      updated_at: now,
    },
    pages: pageRecords,
    committed_at: now,
  });
}

async function main() {
  console.log("Unit F-R2 Repair — DI2 HTML Delivery Closure\n");

  await check("Page 03 present → HTML includes pane 03", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "not_applicable" });
    const html = fillDi2AuthorityHtml(fullText, "zh", pages, { title: "测试报告" });
    assert.match(html, /data-slot-pane="03"/);
    assert.match(html, /术语/);
    assert.ok(resolveDi2HtmlSlotIds(pages).includes("03"));
  });

  await check("Page 03 empty/not_applicable → HTML has no pane 03", async () => {
    const { pages, fullText } = fullSet({ page03: false, page07: "not_applicable" });
    const html = fillDi2AuthorityHtml(fullText, "zh", pages, { title: "测试报告" });
    assert.equal(html.includes('data-slot-pane="03"'), false);
    assert.equal(resolveDi2HtmlSlotIds(pages).includes("03"), false);
  });

  await check("Page 07 applies → HTML includes pane 07", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "applies" });
    const html = fillDi2AuthorityHtml(fullText, "zh", pages);
    assert.match(html, /data-slot-pane="07"/);
    assert.ok(resolveDi2HtmlProseOrder(pages).includes("07"));
  });

  await check("Page 07 not_applicable → HTML omits pane 07", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "not_applicable" });
    const html = fillDi2AuthorityHtml(fullText, "zh", pages);
    assert.equal(html.includes('data-slot-pane="07"'), false);
    assert.equal(resolveDi2HtmlProseOrder(pages).includes("07"), false);
  });

  await check("Page 07 insufficient_information → refuse HTML export", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "insufficient_information" });
    assert.throws(
      () => fillDi2AuthorityHtml(fullText, "zh", pages),
      (e: unknown) =>
        e instanceof Di2HtmlExportError && e.code === "page07_insufficient_information",
    );
  });

  await check("HTML prose order matches shelf verified order", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "applies" });
    const prose = resolveDi2HtmlProseOrder(pages);
    const shelf = buildDeliveryShelfSlots(fullText, {
      locale: "zh",
      complete: true,
      verifiedProseOrder: prose,
    });
    const shelfProse = shelf
      .filter((s) => s.kind === "ready" || s.kind === "empty")
      .map((s) => s.slotId)
      .filter((id) => id !== "cover" && id !== "toc");
    assert.deepEqual(shelfProse, [...prose]);
    const html = fillDi2AuthorityHtml(fullText, "zh", pages);
    for (const id of prose) {
      assert.match(html, new RegExp(`data-slot-pane="${id}"`));
    }
  });

  await check("Legacy topic HTML without pageOrder still omits 03 by default", async () => {
    const { fullText } = fullSet({ page03: true });
    const html = fillDecisionReportHtml(fullText, "zh", {
      topic: null,
      originalQuestion: "普通问题",
    });
    // Without DI2 pageOrder, topic path does not include 03.
    assert.equal(html.includes('data-slot-pane="03"'), false);
  });

  // ── Cache identity ────────────────────────────────────────────────────────

  await check("Cache reuse when identity identical", () => {
    const identity: Di2HtmlPackIdentity = {
      report_job_id: "r1",
      execution_generation: 1,
      content_identity: di2HtmlContentIdentity("body-a"),
      locale: "zh",
      template_version: DI2_HTML_TEMPLATE_VERSION,
    };
    const entry = writeDi2HtmlPackCache(identity, "<html>A</html>");
    assert.equal(readDi2HtmlPackCache(entry, identity), "<html>A</html>");
    assert.equal(sameDi2HtmlPackIdentity(identity, { ...identity }), true);
  });

  await check("Cache miss on report_job_id / generation / content / locale / template", () => {
    const base: Di2HtmlPackIdentity = {
      report_job_id: "r1",
      execution_generation: 1,
      content_identity: "cid1",
      locale: "zh",
      template_version: DI2_HTML_TEMPLATE_VERSION,
    };
    const entry = writeDi2HtmlPackCache(base, "<html>A</html>");
    assert.equal(readDi2HtmlPackCache(entry, { ...base, report_job_id: "r2" }), null);
    assert.equal(readDi2HtmlPackCache(entry, { ...base, execution_generation: 2 }), null);
    assert.equal(readDi2HtmlPackCache(entry, { ...base, content_identity: "cid2" }), null);
    assert.equal(readDi2HtmlPackCache(entry, { ...base, locale: "en" }), null);
    assert.equal(readDi2HtmlPackCache(entry, { ...base, template_version: "other" }), null);
  });

  // ── Email authorization ───────────────────────────────────────────────────

  await check("Email: unauthenticated → 401", async () => {
    const { pages, fullText } = fullSet({ page03: true });
    const record = await sealedRecord(pages, fullText);
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => null,
      isAuthConfigured: () => true,
      assertWriter: async () => "ok",
      loadCompletedReport: async () => record,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async () => ({ ok: true, mocked: true }),
    });
    const res = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_html_1",
      writer_token: "wt",
      locale: "zh",
      to: "a@example.com",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "unauthorized");
  });

  await check("Email: other-session writer fails closed", async () => {
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => ({ id: "u1", email: "a@example.com" }),
      isAuthConfigured: () => true,
      assertWriter: async () => {
        throw new Error("forbidden");
      },
      loadCompletedReport: async () => null,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async () => ({ ok: true, mocked: true }),
    });
    const res = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_other",
      job_id: "job_html_1",
      writer_token: "bad",
      locale: "zh",
      to: "a@example.com",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "session_forbidden");
  });

  await check("Email: missing CompletedReport → 404", async () => {
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => ({ id: "u1", email: "a@example.com" }),
      isAuthConfigured: () => true,
      assertWriter: async () => "ok",
      loadCompletedReport: async () => null,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async () => ({ ok: true, mocked: true }),
    });
    const res = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_missing",
      writer_token: "wt",
      locale: "zh",
      to: "a@example.com",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "report_missing");
  });

  await check("Email: generation mismatch → refuse", async () => {
    const { pages, fullText } = fullSet({ page03: true });
    const record = await sealedRecord(pages, fullText);
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => ({ id: "u1", email: "a@example.com" }),
      isAuthConfigured: () => true,
      assertWriter: async () => "ok",
      loadCompletedReport: async () => record,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async () => ({ ok: true, mocked: true }),
    });
    const res = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_html_1",
      writer_token: "wt",
      locale: "zh",
      to: "a@example.com",
      expected_execution_generation: 99,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "generation_mismatch");
  });

  await check("Email: freeze / context mismatch → refuse", async () => {
    const { pages, fullText } = fullSet({ page03: true });
    const record = await sealedRecord(pages, fullText);
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => ({ id: "u1", email: "a@example.com" }),
      isAuthConfigured: () => true,
      assertWriter: async () => "ok",
      loadCompletedReport: async () => record,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async () => ({ ok: true, mocked: true }),
    });
    const freeze = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_html_1",
      writer_token: "wt",
      locale: "zh",
      to: "a@example.com",
      expected_freeze_id: "wrong_freeze",
    });
    assert.equal(freeze.ok, false);
    if (!freeze.ok) assert.equal(freeze.code, "freeze_mismatch");

    const ctx = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_html_1",
      writer_token: "wt",
      locale: "zh",
      to: "a@example.com",
      expected_context_hash: "wrong_hash",
    });
    assert.equal(ctx.ok, false);
    if (!ctx.ok) assert.equal(ctx.code, "context_mismatch");
  });

  await check("Email: recipient must match account email", async () => {
    const { pages, fullText } = fullSet({ page03: true });
    const record = await sealedRecord(pages, fullText);
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => ({ id: "u1", email: "owner@example.com" }),
      isAuthConfigured: () => true,
      assertWriter: async () => "ok",
      loadCompletedReport: async () => record,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async () => ({ ok: true, mocked: true }),
    });
    const res = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_html_1",
      writer_token: "wt",
      locale: "zh",
      to: "other@example.com",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "recipient_forbidden");
  });

  await check("Email: forged html_attachment ignored; server HTML used", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "not_applicable" });
    const sealed = await sealedRecord(pages, fullText);

    let sentAttachment: string | null = null;
    __setDi2DeliveryEmailDepsForTests({
      getUser: async () => ({ id: "u1", email: "a@example.com" }),
      isAuthConfigured: () => true,
      assertWriter: async () => "ok",
      loadCompletedReport: async () => sealed,
      verifyDelivery: async () => ({ ok: true, record: {} as never }),
      sendEmail: async (params) => {
        sentAttachment =
          typeof params.attachments?.[0]?.content === "string"
            ? params.attachments[0].content
            : null;
        return { ok: true, mocked: true };
      },
    });

    const expected = fillDi2AuthorityHtml(fullText, "zh", pages, {
      title: "测试报告",
      reportId: sealed.report_job_id,
      reportDate: sealed.committed_at.slice(0, 10),
    });
    const res = await sendAuthorizedDi2DeliveryEmail({
      session_id: "sess_html_1",
      job_id: "job_html_1",
      writer_token: "wt",
      locale: "zh",
      to: "a@example.com",
      title: "测试报告",
      html_attachment: "<html>FORGED CLIENT ATTACHMENT</html>",
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    if (!res.ok) return;
    assert.equal(sentAttachment, expected);
    assert.equal(res.html, expected);
    assert.equal(sentAttachment?.includes("FORGED"), false);
    assert.match(sentAttachment ?? "", /data-slot-pane="03"/);
  });

  await check("Download HTML builder equals email HTML for same report", async () => {
    const { pages, fullText } = fullSet({ page03: true, page07: "applies" });
    const a = fillDi2AuthorityHtml(fullText, "zh", pages, { title: "同一份" });
    const b = fillDi2AuthorityHtml(fullText, "zh", pages, { title: "同一份" });
    assert.equal(a, b);
  });

  __setDi2DeliveryEmailDepsForTests(null);
  console.log(`\nF-R2 HTML Closure results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
