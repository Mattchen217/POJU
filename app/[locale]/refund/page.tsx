import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refund Policy — Eastern OS",
  description: "Eastern OS Refund Policy — Version 1.1",
};

export default function RefundPage() {
  return (
    <LegalPageShell
      version="Version 1.1"
      title="Refund Policy"
      updated="Last updated: 2026-10-19"
      intro={
        <>
          <p>
            <strong>Governing Language.</strong> This Refund Policy is written and intended to be
            interpreted exclusively in the English language. Any translation provided elsewhere is
            for convenience only. In the event of conflict or ambiguity,{" "}
            <strong>this English version governs and prevails</strong>.
          </p>
        </>
      }
      footer={
        <p>
          <strong>PENDING COUNSEL REVIEW / 须真人律师确认</strong>
          {" "}
          — Counsel must review before relying on this as the live /refund page.
        </p>
      }
    >
      <h2>Purpose of this Policy</h2>
      <p>This Refund Policy explains, in plain English:</p>
      <ol>
        <li>Which Eastern OS purchases it covers;</li>
        <li>How payment-provider / merchant-of-record rules interact with refund processing;</li>
        <li>
          Situations that may be eligible for a refund (including in-product self-serve for unused
          purchased Buy Pass, and support review for other categories);
        </li>
        <li>
          Subscription cancellation, period-end access, and why mid-cycle pro-rata refunds are not
          offered solely for unused time or unused PASS;
        </li>
        <li>
          Situations that are generally <strong>not</strong> refundable;
        </li>
        <li>How to request a refund (PASS details self-serve where available, or support);</li>
        <li>Chargebacks and disputes; and</li>
        <li>
          How this Policy relates to the Terms of Service, Privacy Policy, Disclaimer, Cookies, and
          Pricing materials.
        </li>
      </ol>
      <p>Related policies you should also read:</p>
      <ul>
        <li>
          <Link href="/terms">Terms of Service</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/disclaimer">Disclaimer &amp; Sovereignty Architecture</Link>
        </li>
        <li>
          <Link href="/cookies">Cookie &amp; Local Storage Policy / Cookie Settings</Link>
        </li>
      </ul>
      <p>
        Commercial entitlements, illustrative pricing awareness, and account rules are governed by
        the <strong>Terms of Service</strong> and live <strong>Pricing</strong> / checkout materials
        at the time of purchase. This Refund Policy governs{" "}
        <strong>when a payment may be refunded</strong> after purchase—not product features,
        privacy storage architecture, or professional-advice boundaries (see Disclaimer).
      </p>
      <p>
        By purchasing a PASS, starting a subscription, or otherwise completing checkout for Eastern
        OS, you acknowledge this Refund Policy together with the then-current Terms. If you do not
        agree, do not complete the purchase.
      </p>

      <h2>1. Scope — purchases this Policy covers</h2>
      <h3>1.1 Covered transactions</h3>
      <p>
        This Policy applies to payments made for Eastern OS (easternos.com) commercial offerings as
        actually presented at checkout, including:
      </p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Offering (illustrative packaging)</th>
              <th scope="col">What it is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Buy Pass (one-time)</strong>
              </td>
              <td>
                Approximately <strong>USD $19.99</strong> for <strong>1 PASS</strong>, one-time
                purchase, <strong>no auto-renew</strong>, valid until used under then-current ledger
                rules.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Monthly subscription</strong>
              </td>
              <td>
                Approximately <strong>USD $59.99 per month</strong> for <strong>5 PASS</strong> per
                paid billing period, with a <strong>new-user first-month +2 PASS</strong> promotion
                when that promotion is active (illustratively <strong>7 PASS</strong> in that first
                month).
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>
          Always confirm live prices, taxes, currency presentation, promotions, and entitlements on
          Pricing / at checkout.
        </strong> 
        Figures above are illustrative launch packaging only—<strong>not</strong> a permanent
        price schedule. The amount shown for your transaction at checkout and on your receipt
        controls for that purchase.
      </p>

      <h3>1.2 What 1 PASS unlocks (context only)</h3>
      <p>
        <strong>1 PASS</strong> is intended to unlock, as a{" "}
        <strong>bundled entitlement provided together</strong>:
      </p>
      <ol>
        <li>A multi-turn decision dialogue;</li>
        <li>Main path + backup framing;</li>
        <li>A report (structured written deliverable); and</li>
        <li>30-day daily same-line reminders associated with that line of work.</li>
      </ol>
      <p>
        Exact packaging is defined by the Terms and live Pricing at purchase. This Refund Policy
        does not redefine the entitlement.
      </p>

      <h3>1.3 Spend order (brief cross-ref)</h3>
      <p>
        Where multiple PASS balance types exist (for example, carryover, subscription allotment, and
        separately purchased / flex PASS), product spend order follows then-current{" "}
        <strong>Pricing / FAQ / in-product ledger</strong> rules. Launch posture is{" "}
        <strong>carryover → subscription → purchased / flex PASS</strong>, unless a
        then-current UI / ledger rule expressly states otherwise. Confirm live ledger behavior
        in-product. This Policy does not establish a separate spend-order rule for refund
        eligibility beyond verifying whether a PASS was <strong>consumed / initialized</strong>.
      </p>

      <h3>1.4 What this Policy does not cover</h3>
      <p>
        This Policy does <strong>not</strong>:
      </p>
      <ul>
        <li>Promise professional, medical, legal, financial, or fortune-telling outcomes;</li>
        <li>
          Treat dislike of AI framing, tone, or reflective usefulness as a technical delivery
          failure;
        </li>
        <li>
          Restore browser-local chat history lost to cache clear, Incognito, device switch, or
          similar local events; or
        </li>
        <li>Override mandatory consumer rights that cannot be waived under applicable law.</li>
      </ul>
      <p>
        Eastern OS is an <strong>18+</strong> product. See the Terms and Disclaimer.
      </p>

      <h2>2. Payment provider / merchant-of-record rules</h2>
      <h3>2.1 Who processes payments</h3>
      <p>
        Payments are processed through the{" "}
        <strong>
          payment processor and/or merchant-of-record (MoR) stack actually integrated at launch
        </strong> 
        (secure hosted checkout or equivalent).
      </p>
      <p>
        <strong>
          The exact name shown at live checkout and on your bank / wallet statement or receipt
          controls
        </strong> 
        for that transaction. Do not rely on marketing copy or third-party descriptions that
        conflict with your receipt.
      </p>

      <h3>2.2 Provider rules govern processing mechanics</h3>
      <p>
        Where this Policy and the Terms allow a refund (or where the provider independently requires
        one):
      </p>
      <ul>
        <li>
          <strong>Processing timing</strong>, refund <strong>method</strong>, any provider{" "}
          <strong>windows</strong>, and any provider <strong>fees</strong> follow the{" "}
          <strong>
            payment provider’s / merchant-of-record’s then-current rules
          </strong> 
          as actually integrated at launch;
        </li>
        <li>
          Refunds are typically returned to the <strong>original payment method</strong>, subject to
          provider and banking rails;
        </li>
        <li>
          Eastern OS does <strong>not</strong> claim a universal{" "}
          <strong>one-click refund</strong> for all refund types. Where the product shows an
          in-product unused purchased-PASS refund control (for example in{" "}
          <strong>PASS details</strong>), that control applies only to the unused{" "}
          <strong>purchased / Buy Pass</strong> path in §3.3—not to subscription
          allotment, consumed PASS, or other categories. Settlement{" "}
          <strong>timing follows the payment provider</strong>; Eastern OS does not promise instant
          bank clearing.
        </li>
      </ul>
      <p>
        For self-serve unused purchased Buy Pass under §3.3, the product initiates the related
        full refund(s) of the original payment(s) to the original payment method (N unused purchased
        units → N full refunds of those related payments, typically FIFO—see §3.3),
        and the provider executes (or declines) the monetary movement under its own rules and
        timelines. For other eligible categories, Eastern OS support reviews eligibility under this
        Policy; the provider then executes (or declines) the monetary movement under its own rules
        and timelines.
      </p>

      <h3>2.3 Card / wallet data</h3>
      <p>
        Eastern OS does <strong>not</strong> intend to store raw full card Primary Account Numbers
        on its own servers. Card / wallet handling is performed by the processor / MoR under their
        terms and privacy policies. See the Privacy Policy for billing-metadata handling.
      </p>

      <h2>3. Eligible refund situations</h2>
      <p>
        Except for unused <strong>purchased / one-time Buy Pass</strong> refunded in product under
        §3.3 where that control is shown, refunds are <strong>not automatic</strong>.
        Eligibility for support-path categories requires a support review and, where relevant,
        technical verification against account / billing / fulfillment records. Submitting a support
        request does not guarantee approval.
      </p>

      <h3>3.1 Verified technical / fulfillment failure</h3>
      <p>
        You may be eligible for a refund (full or partial as appropriate to the charge) if we verify
        that:
      </p>
      <ul>
        <li>
          You were <strong>charged</strong>, but the corresponding{" "}
          <strong>PASS entitlement was never issued</strong> to your account ledger; or
        </li>
        <li>
          A <strong>catastrophic pipeline failure</strong> on our side (or our generation
          infrastructure) prevented <strong>any</strong> dialogue delivery for a PASS that was
          properly spent / initialized, such that the bundled entitlement could not be fulfilled in
          any usable form.
        </li>
      </ul>
      <p>
        Ordinary slowdowns, temporary third-party outages that later resolve, user network issues,
        unsupported browsers, or incomplete user inputs do <strong>not</strong> automatically
        qualify. We will assess good-faith technical evidence.
      </p>
      <p>
        <strong>Request window:</strong> Unless a longer window is required by applicable law or by
        the payment provider’s then-current rules, please submit technical-failure claims
        within <strong>seven (7) days</strong> of the charge or of the failed fulfillment event
        (whichever is later and reasonably knowable to you).
      </p>

      <h3>3.2 Duplicate identical charges</h3>
      <p>
        If our payment infrastructure registers <strong>duplicate identical charges</strong> for a
        single intended purchase action (same offering, same intended transaction), we will reverse
        the <strong>extra</strong> identical charge(s) after verification. Keep both receipt
        references so we can match them.
      </p>

      <h3>3.3 Unused purchased Buy Pass — self-serve in PASS details</h3>
      <p>
        For <strong>purchased / one-time Buy Pass</strong> remaining on your account ledger only
        (purchased / flex balance)—<strong>not</strong> subscription allotment:
      </p>
      <p>
        A purchased Buy Pass remains <strong>valid until used</strong> (permanent until consumed
        under ledger rules). It is <strong>not</strong> subject to a short expiry window merely
        because time has passed since purchase.
      </p>
      <p>
        While a purchased Buy Pass unit remains <strong>unused</strong>—meaning the associated
        decision dialogue was <strong>never started / initialized</strong> and that unit was{" "}
        <strong>never consumed</strong> on the ledger—you may refund it{" "}
        <strong>in product</strong> through <strong>PASS details</strong> (self-serve), for up to
        the <strong>remaining purchased quantity</strong> (you may select quantity from{" "}
        <strong>1</strong> through remaining purchased, where the product shows that control). There
        is <strong>no twenty-four (24) hour (or other short-cap) request deadline</strong> for this
        unused purchased Buy Pass path.
      </p>
      <p>
        <strong>How the money moves:</strong> Each purchased Buy Pass unit maps to its own related
        original payment. Refunding <strong>N</strong> unused purchased units means{" "}
        <strong>N</strong> full refunds of those related original payments (typically oldest-first /
        FIFO by purchase)—<strong>not</strong> a single partial-amount refund of one combined
        charge. The dollar amount shown is the sum of those related full payments. Refunds return to
        the <strong>original payment method</strong>, subject to provider and banking rails. The
        payment provider executes the money movement;{" "}
        <strong>timing follows the payment provider</strong>—Eastern OS does not promise
        instant bank clearing.
      </p>
      <p>
        <strong>
          Subscription credits / allotment are not refundable through this PASS-detail path.
        </strong> 
        To stop future charges, cancel your subscription per §4. This path does{" "}
        <strong>not</strong> convert a monthly subscription allotment into a permanent one-time
        refundable credit, and does <strong>not</strong> create a mid-cycle pro-rata refund for
        subscription fees or unused subscription PASS.
      </p>
      <p>
        Once a given PASS unit is consumed / dialogue has started, <strong>that unit</strong> is out
        of this unused purchased-PASS refund path. Change of mind or subjective dissatisfaction
        after consumption remains non-refundable except as §3.1 (verified technical failure),
        §3.2 (duplicate charges), or §3.4 (mandatory law / provider-required remedies)
        separately allow.
      </p>
      <p>
        If the self-serve control is <strong>unavailable</strong>, <strong>fails</strong>, or the
        provider declines the monetary movement, contact <strong>support@easternos.com</strong>.
        Support remains available for technical failure, duplicates, mandatory law /
        provider-required remedies, and self-serve unavailability or provider failure.
      </p>

      <h3>3.4 Mandatory law / provider-required remedies</h3>
      <p>
        Nothing in this Policy limits <strong>non-waivable</strong> consumer or statutory rights
        that apply to you, or refunds that the payment provider / MoR is required to process under
        its then-current rules or applicable card-network / wallet policies. Where such a right
        applies, we will handle the request consistently with that obligation.
      </p>

      <h3>3.5 Verification</h3>
      <p>
        <strong>Self-serve unused purchased Buy Pass (§3.3):</strong> Where the PASS-details
        control is shown, eligibility is verified in-product against your ledger (remaining
        purchased quantity; unused / not dialogue-started) and the related original payments mapped
        to those units. Refunding N units triggers N full refunds of those related payments
        (typically FIFO)—not a partial-amount cut of one combined charge. You do not need a
        separate support review for that path unless the control is unavailable or fails.
      </p>
      <p>
        <strong>Support-path categories</strong> (§3.1, §3.2, §3.4, and §3.3
        when self-serve is unavailable or fails): We may request:
      </p>
      <ul>
        <li>Receipt / transaction / confirmation reference as shown on your checkout receipt;</li>
        <li>Account email or other account identifiers;</li>
        <li>Description of the failure;</li>
        <li>Screenshots, error messages, timestamps, and browser / device context.</li>
      </ul>
      <p>
        Fraudulent or materially incomplete requests may be denied. Not every refund under this
        Policy requires a support review—only the categories that go through support.
      </p>

      <h2>4. Subscriptions — cancel anytime; no mid-cycle pro-rata solely for unused time</h2>
      <h3>4.1 Cancel anytime</h3>
      <p>
        You may <strong>cancel automatic renewal at any time</strong> via the secure self-service
        billing / customer portal provided at purchase, or by contacting{" "}
        <strong>support@easternos.com</strong>.
      </p>

      <h3>4.2 Access through the end of the paid period</h3>
      <p>Upon cancellation:</p>
      <ul>
        <li>
          You retain access to PASS already allotted for the{" "}
          <strong>current paid billing period</strong> through the end of that period, subject to
          Terms and ledger rules;
        </li>
        <li>
          Cancellation stops <strong>future</strong> renewals; it does not, by itself, erase already
          allotted current-period PASS before period end.
        </li>
      </ul>

      <h3>4.3 Unused current-period PASS expire at period end</h3>
      <p>
        Unused PASS from the <strong>current paid billing period expire when that period ends</strong>.
        They do <strong>not</strong> become permanent one-time credits solely because you cancelled.
        Align this commercial rule with live Pricing / FAQ and the Terms.
      </p>

      <h3>4.4 No mid-cycle pro-rata refund solely for cancel / unused time / unused PASS</h3>
      <p>
        <strong>No mid-cycle partial pro-rata refund</strong> of subscription fees is authorized{" "}
        <strong>solely</strong> because you cancelled mid-period, did not use all PASS, or have
        unused time remaining in the paid period—except as this Policy separately allows (for
        example, verified technical delivery failure or duplicate charge) or as mandatory law /
        provider rules require.
      </p>

      <h2>5. Non-refundable scenarios</h2>
      <p>
        The following are <strong>generally not eligible</strong> for a refund under this Policy
        (subject to mandatory law and §3):
      </p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Subjective dissatisfaction with AI outputs</strong>
              </td>
              <td>
                Dislike of style, tone, framing, cultural-analytical lens, probabilistic phrasing,
                or reflective usefulness is <strong>not</strong> a verified technical delivery
                failure. Eastern OS is not medical, legal, financial, or fortune-telling advice. See
                Disclaimer and Terms §7.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Change of mind after PASS spent / dialogue commenced</strong>
              </td>
              <td>
                Once a given PASS unit is consumed and dialogue / generation has started, that unit
                is not refundable under the unused purchased Buy Pass self-serve path (§3.3).
                Subscription allotment is never refundable via PASS details—cancel per
                §4.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Local data loss</strong>
              </td>
              <td>
                Loss of browser-local chat / deliverables due to clearing cache, cookies,
                IndexedDB, or site data; using or closing Incognito / Private windows; switching
                browsers or devices; uninstalling a PWA; privacy extensions; or similar local events
                does <strong>not</strong>, by itself, entitle you to a refund or free PASS
                restoration. <strong>Receipt email ≠ chat backup.</strong> Prefer
                user-initiated export / email where offered. See Privacy and Disclaimer.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Mid-cycle cancel seeking pro-rata solely for unused time / unused PASS</strong>
              </td>
              <td>See §4.4.</td>
            </tr>
            <tr>
              <td>
                <strong>Expectation of professional outcomes</strong>
              </td>
              <td>
                Treating the Service as a clinic, law firm, broker, or fortune-teller, then seeking
                a refund when it does not provide those services, is not a fulfillment failure.
              </td>
            </tr>
            <tr>
              <td>
                <strong>User network / device / unsupported environment issues</strong>
              </td>
              <td>
                Failures attributable primarily to your connectivity, device, browser configuration,
                or unsupported environment—absent a verified platform fulfillment
                failure—are not refundable under §3.1.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Abuse, fraud, or Terms violations</strong>
              </td>
              <td>
                Purchases obtained or used in violation of the Terms, or associated with payment
                fraud, may be denied refund and may result in suspension.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>6. How to request a refund</h2>
      <h3>6.1 Unused purchased Buy Pass — primary path (PASS details)</h3>
      <p>
        If you have <strong>unused purchased / one-time Buy Pass</strong> remaining on the ledger,
        use the in-product <strong>Refund unused PASS</strong> (or equivalent) control in{" "}
        <strong>PASS details</strong> where the product shows it. That is the{" "}
        <strong>primary path</strong> for this category. See §3.3.
      </p>
      <p>
        If that control is unavailable or fails, email <strong>support@easternos.com</strong>.
      </p>

      <h3>6.2 Other categories — contact support</h3>
      <p>
        For verified technical / fulfillment failure, duplicate charges, mandatory law /
        provider-required remedies, subscription billing help, or other situations under this
        Policy, email{" "}
        <strong>
          <a href="mailto:support@easternos.com">support@easternos.com</a>
        </strong> 
        (preferred for refunds and billing operations).
      </p>
      <p>
        You may also use the{" "}
        <a href="https://www.easternos.com/contact" rel="noopener noreferrer" target="_blank">
          contact hub
        </a>
        . For privacy / data requests use <strong>privacy@easternos.com</strong>; for legal
        correspondence use <strong>legal@easternos.com</strong>.
      </p>

      <h3>6.3 What to include (support requests)</h3>
      <p>Please include:</p>
      <ol>
        <li>
          <strong>Receipt / transaction / confirmation reference</strong> as shown on your checkout
          receipt or payment confirmation;
        </li>
        <li>
          The <strong>email / account</strong> associated with the purchase (if any);
        </li>
        <li>
          Whether the purchase was a <strong>Buy Pass</strong> or a <strong>subscription</strong> 
          charge;
        </li>
        <li>
          A clear description of the issue (technical failure, duplicate charge, self-serve unused
          Buy Pass control unavailable / failed, etc.);
        </li>
        <li>
          Relevant <strong>screenshots</strong>, error messages, and approximate{" "}
          <strong>date/time</strong> (with timezone if known).
        </li>
      </ol>

      <h3>6.4 Processing targets</h3>
      <ul>
        <li>
          <strong>Self-serve unused purchased Buy Pass (§3.3):</strong> The product initiates
          the related full refund(s) of the original payment(s) for the selected unused purchased
          quantity (N units → N full refunds, typically FIFO—see §3.3); the provider
          executes money movement. <strong>Timing follows the payment provider</strong>—we do
          not promise instant bank clearing.
        </li>
        <li>
          <strong>Support-path requests:</strong> We aim to <strong>decide</strong> valid, complete
          requests within approximately <strong>two (2) business days</strong> after receiving the
          information needed for verification; if approved, the monetary refund is executed through
          the payment provider / MoR under <strong>provider timelines</strong>, which may take
          additional banking or wallet processing days beyond our decision.
        </li>
        <li>
          We do <strong>not</strong> promise or guarantee a fixed bank clearing SLA beyond those
          provider timelines.
        </li>
      </ul>
      <p>Incomplete support requests may be delayed until you provide missing references.</p>

      <h3>6.5 Windows summary</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Claim type</th>
              <th scope="col">Request path / window (launch rule)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Unused purchased Buy Pass (never started / never consumed; remaining purchased qty)
              </td>
              <td>
                <strong>PASS details</strong> self-serve <strong>anytime while unused</strong> 
                (valid until used; see §3.3); support if self-serve unavailable / fails
              </td>
            </tr>
            <tr>
              <td>Verified technical / fulfillment failure</td>
              <td>
                Email support within <strong>7 days</strong> of the charge or failed fulfillment
                event (see §3.1)
              </td>
            </tr>
            <tr>
              <td>Duplicate identical charges</td>
              <td>
                Email support promptly after you notice the duplicate; include both references
              </td>
            </tr>
            <tr>
              <td>Mandatory statutory / provider-required remedies</td>
              <td>As required by applicable law or provider rules</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>7. Chargebacks and disputes</h2>
      <h3>7.1 Contact support before a chargeback</h3>
      <p>
        If you experience a billing or fulfillment problem, please contact{" "}
        <strong>support@easternos.com</strong> <strong>before</strong> filing a bank, card, or
        wallet dispute / chargeback. Most verified structural issues can be resolved faster through
        support than through an external dispute.
      </p>

      <h3>7.2 Unnotified chargebacks after delivery</h3>
      <p>
        If you initiate a chargeback or payment dispute <strong>without</strong> first contacting
        support, for a transaction where entitlements were{" "}
        <strong>issued and/or delivered</strong> in accordance with the Terms:
      </p>
      <ul>
        <li>
          Resolution may be <strong>delayed</strong> while we gather fulfillment records for the
          provider / network;
        </li>
        <li>
          Where we reasonably determine the dispute constitutes <strong>fraud or abuse</strong> 
          (including “friendly fraud” after clear delivery), we may{" "}
          <strong>suspend</strong> the related account and/or <strong>void</strong> related unused
          entitlements, consistent with the Terms and provider rules.
        </li>
      </ul>
      <p>
        This is a conservative fraud/abuse response—not a theatrical permanent device
        blacklist. We cooperate with payment providers and networks as appropriate. Nothing here
        limits your non-waivable dispute rights under applicable law or card-network rules; it
        describes our account and entitlement response when abuse is reasonably indicated.
      </p>

      <h2>8. Changes to this Policy</h2>
      <p>
        We may update this Refund Policy from time to time to reflect product, pricing,
        payment-stack, or legal changes. The “Last updated” date at the top will change
        when we do.
      </p>
      <p>
        Material changes will be communicated by updating this page and, where appropriate, by
        notice through the Service, email, or checkout acknowledgment. For a given completed
        purchase, the Refund Policy (together with checkout terms and provider rules){" "}
        <strong>as applicable at the time of that purchase</strong>—plus any mandatory later
        consumer protections—governs that transaction, unless a newer Policy expressly states
        otherwise with your assent where required.
      </p>
      <p>
        If you do not agree to a material update, stop using the Service and cancel future renewals;
        updates do not automatically rewrite closed historical transactions except as law requires.
      </p>

      <h2>9. Contact</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col">Contact</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Refunds / billing / support operations</strong>
              </td>
              <td>
                <a href="mailto:support@easternos.com">support@easternos.com</a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Privacy / data requests</strong>
              </td>
              <td>
                <a href="mailto:privacy@easternos.com">privacy@easternos.com</a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Legal</strong>
              </td>
              <td>
                <a href="mailto:legal@easternos.com">legal@easternos.com</a>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Contact hub</strong>
              </td>
              <td>
                <a
                  href="https://www.easternos.com/contact"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  https://www.easternos.com/contact
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>10. Relationship to other policies</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Role relative to refunds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>This Refund Policy</strong>
              </td>
              <td>
                When a payment may be refunded (self-serve unused purchased Buy Pass in PASS
                details; support review for other categories); chargeback posture; subscription
                cancel vs. pro-rata.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Terms of Service</strong>
              </td>
              <td>
                Account rules, PASS / subscription commerce, acceptable use, payments, liability /
                indemnity, dispute mechanics; refunds cross-reference this page.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Privacy Policy</strong>
              </td>
              <td>
                What billing / account data is stored; browser-local chat vs. server-side PASS
                ledger; receipt email ≠ chat backup.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Disclaimer &amp; Sovereignty Architecture</strong>
              </td>
              <td>
                Product boundaries (no medical / legal / financial / fortune-telling); local-session
                limits; dissatisfaction ≠ malpractice.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Cookie Settings</strong>
              </td>
              <td>Browser cookie / similar-tech preferences (not a refund schedule).</td>
            </tr>
            <tr>
              <td>
                <strong>Pricing / checkout</strong>
              </td>
              <td>Live prices, promotions, and the amount that controls for your purchase.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        If a commercial refund rule here conflicts with Marketing copy,{" "}
        <strong>this Refund Policy, the Terms, and checkout / receipt</strong> control for the
        specific purchase—subject to mandatory law and provider rules. If a technical privacy
        detail here conflicts with the Privacy Policy, prefer the Privacy Policy for storage facts.
      </p>

      <h2>11. Acknowledgment</h2>
      <p>
        By completing a purchase or using paid Eastern OS entitlements, you acknowledge that you
        have read and understood this Refund Policy, including that:
      </p>
      <ul>
        <li>
          Eastern OS is a <strong>unified multi-turn decision dialogue</strong> product;{" "}
          <strong>1 PASS</strong> unlocks dialogue → main path + backup + report → 30-day
          same-line reminders <strong>provided together</strong>;
        </li>
        <li>
          Illustrative launch packaging (~<strong>USD $19.99</strong> / 1 PASS; ~
          <strong>USD $59.99/mo</strong> → 5 PASS; new-user first month <strong>+2</strong> 
          when active) is <strong>not</strong> a permanent price list—
          <strong>checkout and your receipt control</strong>;
        </li>
        <li>
          Refunds follow <strong>this Policy</strong> and the{" "}
          <strong>payment provider’s / MoR’s then-current rules</strong> as shown at
          checkout and on your receipt—<strong>not</strong> a universal one-click refund for
          all types; unused <strong>purchased</strong> Buy Pass may be refunded{" "}
          <strong>in product</strong> via PASS details where that control is shown (§3.3), and
          settlement <strong>timing follows the payment provider</strong>;
        </li>
        <li>
          <strong>Cancel anytime</strong>; unused <strong>current-period</strong> subscription PASS{" "}
          <strong>expire when that period ends</strong>; <strong>no mid-cycle pro-rata</strong> 
          solely for unused time / unused PASS; subscription allotment is <strong>not</strong> 
          refundable via PASS details;
        </li>
        <li>
          Unused <strong>purchased / one-time Buy Pass</strong> (never started / never consumed;
          remaining purchased qty) may be refunded <strong>anytime while unused</strong> via PASS
          details self-serve (valid until used); if self-serve is unavailable or fails, contact
          support; technical-failure claims should be requested within <strong>7 days</strong> 
          (subject to law / provider rules);
        </li>
        <li>
          Subjective AI dissatisfaction, change of mind after PASS spent, and{" "}
          <strong>local data loss</strong> are generally <strong>not</strong> refundable by
          themselves;
        </li>
        <li>
          Chat / deliverables are <strong>browser-local</strong>;{" "}
          <strong>account = PASS + billing</strong>, not chat sync;{" "}
          <strong>receipt email ≠ chat backup</strong>;
        </li>
        <li>
          You are <strong>18+</strong>; and
        </li>
        <li>
          You should contact <strong>support@easternos.com</strong> before filing a chargeback.
        </li>
      </ul>
    </LegalPageShell>
  );
}
