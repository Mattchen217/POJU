import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refund Policy — Eastern OS",
  description: "pojulife refund policy — Version 1.1",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      version="Version 1.1"
      title="Refund Policy"
      updated="Last updated: 2026-06-15"
      intro={
        <>
          <p>
            <strong>Governing Language:</strong> This agreement is formulated and executed exclusively in the English
            language. Any localized translations provided elsewhere are for convenience only, and this English version
            shall govern and prevail in all aspects of interpretation and dispute resolution.
          </p>
          <p>
            At pojulife, we are committed to building an ecosystem anchored in cryptographic integrity and mutual respect.
            Because our tools function entirely on a localized cloud-API handshake without persistent server-side narrative
            archives, our operational refund parameters are structured with strict mathematical boundaries.
          </p>
        </>
      }
    >
      <h2>1. Standalone Token Purchases (Pay-Per-Use Eligible Situations)</h2>
      <p>
        We authorize full transaction reversals for standalone session initializations ($9.99 POJU, $4.99
        Glyph/Syncro/Match) strictly under the following scenarios within a <strong>seven (7) day</strong> post-transaction
        window:
      </p>
      <ul>
        <li>
          <strong>Verified Infrastructure Failure:</strong> If a catastrophic systemic error completely interrupted the
          transmission pipeline (e.g., global upstream AI API total service blackout, payment verification failure where
          funds were deducted but zero local processing tokens were issued).
        </li>
        <li>
          <strong>Unused Architecture Units:</strong>
          <ul>
            <li>
              For <strong>POJU</strong>: If you completed a single-session checkout but did not input any initial prompt
              into the chat vector (the conversation was never initialized), you are eligible for an unconditional
              reversal within <strong>24 hours</strong> of purchase.
            </li>
            <li>
              For <strong>Glyph, Syncro, and Match</strong>: The conceptual matrix processing is considered &quot;fully
              executed and delivered&quot; the exact millisecond our generative AI endpoints compile the analytical text
              blocks. No partial refunds are permitted once generation commences.
            </li>
          </ul>
        </li>
        <li>
          <strong>Duplicate Technical Billings:</strong> In the event that our payment infrastructure registers
          synchronous duplicate charges for a single intended action, all identical extra billing occurrences will be
          systematically reversed immediately.
        </li>
      </ul>

      <h2>2. Monthly Pass Subscription Plans (Billing Tier Protections)</h2>
      <p>
        By subscribing to the <strong>pojulife Monthly Pass ($29.99/mo)</strong>, you gain an expedited commercial
        allocation of high-value ecosystem vouchers (valued at $125).
      </p>
      <ul>
        <li>
          <strong>No Mid-Cycle Partial Pro-Rata Refunds:</strong> Because premium cryptographic tokens are fully
          dispatched and deposited to your localized device fingerprint at the immediate dawn of each monthly billing
          cycle, we do not offer fractional refunds for mid-month cancellations or partial non-usage.
        </li>
        <li>
          <strong>Absolute Cancellation Autonomy:</strong> You hold unrestricted control over your financial cycles. You
          may revoke your automated subscription renewal at any moment via your secure self-service billing link or by
          alerting <a href="mailto:support@easternos.com">support@easternos.com</a>. Upon cancellation, your existing
          token package remains valid and executable until the natural expiration date of your current active billing
          iteration.
        </li>
      </ul>

      <h2>3. Absolute Non-Refundable Scenarios</h2>
      <p>We fundamentally reject refund applications arising from the following non-technical variables:</p>
      <ul>
        <li>
          <strong>Subjective Dissatisfaction with AI Linguistic Outputs:</strong> Algorithmic interpretations,
          spatial-temporal orientations, and linguistic reframings are probabilistic and inherently subjective. They are
          engineered as analytical lenses for journaling, not deterministic absolute truths. Dissatisfaction with
          narrative phrasing or subjective guidance does not constitute a valid legal basis for reimbursement.
        </li>
        <li>
          <strong>Operational Latency or Human Over-Expectation:</strong> Errors in personal judgment or a sudden
          &quot;change of mind&quot; following the generation of data will be systematically denied.
        </li>
        <li>
          <strong>System Flushing or Local Cache Deletion:</strong> Because all history data resides exclusively
          encrypted on your personal machine via browser storage (<code>IndexedDB</code>), we bear zero liability if you
          lose your logs due to voluntary browser clearing, incognito browsing deletion, or local physical device loss.
        </li>
      </ul>

      <h2>4. How to Submit a Valid Verification Request</h2>
      <p>
        To initiate an official administrative review, please dispatch an inquiry to our operations team at{" "}
        <a href="mailto:support@easternos.com">support@easternos.com</a> within your statutory 7-day technical window. You
        must include the following precise metadata parameters:
      </p>
      <ol>
        <li>
          Your secure Transaction/Confirmation Reference ID received from our Merchant of Record (
          <strong>Dodo Payments</strong>).
        </li>
        <li>The specific sub-engine node utilized (POJU / Glyph / Syncro / Match).</li>
        <li>
          A clear, unedited contextual description or error printout demonstrating the architectural delivery failure.
        </li>
      </ol>
      <p>
        Valid requests will be processed and decided by our auditing stack within two (2) business days. Once approved,
        the funds will be directed to your original payment infrastructure within 5 to 10 standard banking days.
      </p>

      <h2>5. Mandatory Anti-Fraud &amp; Chargeback Escalation Notice</h2>
      <p>We maintain an unyielding stance against friendly fraud and unauthorized commercial reversals.</p>
      <ul>
        <li>
          <strong>The Voluntary First-Contact Framework:</strong> If you experience any technical transactional friction,
          you explicitly pledge to contact <a href="mailto:support@easternos.com">support@easternos.com</a> prior to filing
          external banking disputes. We resolve 100% of validated structural issues exponentially faster than legacy
          financial institutions.
        </li>
        <li>
          <strong>Automated Defensive Blacklisting:</strong> If you bypass our dedicated internal resolution framework
          and initiate an unnotified bank-level dispute or chargeback action, <strong>our edge network will automatically
          and permanently blacklist your unique localized cryptographic device fingerprint.</strong> This irreversible
          defensive security measure terminates your access to all existing platform nodes, invalidates all unspent token
          assets across our ecosystem, and blacklists your transaction profile from all adjacent applications routed
          through our merchant gateway network.
        </li>
      </ul>
    </LegalPageShell>
  );
}
