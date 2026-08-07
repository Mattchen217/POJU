import type { Metadata } from "next";
import { UNQUALIFIED_REFUND_EMAIL } from "@/lib/poju/unqualified-escalation";

export const metadata: Metadata = {
  title: "Refund check · Eastern OS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * Orphan ops surface — not linked from marketing/nav.
 * Bind a separate subdomain here later if needed.
 * Never Stored: session_id only; no chat content.
 */
export default async function RefundCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; sid?: string }>;
}) {
  const sp = await searchParams;
  const sessionId = (sp.session_id ?? sp.sid ?? "").trim();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0f12",
        color: "#e8eaed",
        fontFamily: "system-ui, sans-serif",
        padding: "48px 24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <p style={{ color: "#f2ca50", letterSpacing: "0.08em", fontSize: 12, marginBottom: 12 }}>
          EASTERN OS
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 16px" }}>Refund check</h1>
        <p style={{ lineHeight: 1.55, color: "#c4c8cc", marginBottom: 20 }}>
          If a session was closed because the conversation could not continue productively, email
          your session ID to{" "}
          <a href={`mailto:${UNQUALIFIED_REFUND_EMAIL}`} style={{ color: "#9cf0ff" }}>
            {UNQUALIFIED_REFUND_EMAIL}
          </a>
          . Eastern OS will return your PASS within 7 business days after verification.
        </p>
        {sessionId ? (
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "16px 18px",
              background: "#101417",
            }}
          >
            <p style={{ fontSize: 12, color: "#8a9096", margin: "0 0 6px" }}>Session ID</p>
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 14,
                wordBreak: "break-all",
                margin: 0,
                color: "#f2ca50",
              }}
            >
              {sessionId}
            </p>
          </div>
        ) : (
          <p style={{ color: "#8a9096", fontSize: 14 }}>
            Open this page with <code>?session_id=…</code> from your closed session, or include the
            ID in your email.
          </p>
        )}
        <p style={{ marginTop: 28, fontSize: 12, color: "#5c636a" }}>
          This page is for refund reconciliation only. It does not store chat content.
        </p>
      </div>
    </main>
  );
}
