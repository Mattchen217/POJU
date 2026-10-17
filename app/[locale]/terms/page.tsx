import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service — Eastern OS",
  description: "Eastern OS Terms of Service — Version 1.0",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      version="Version 1.0 (first public launch baseline)"
      title="Terms of Service"
      updated="Last updated: 2026-10-16"
      intro={
        <>
          <p>
            <strong>Governing Language:</strong> This agreement is formulated and executed exclusively in the English
            language. Any localized translations provided elsewhere are for convenience only, and this English version
            shall govern and prevail in all aspects of interpretation and dispute resolution.
          </p>
        </>
      }
    >
      <h2>Purpose of these Terms</h2>
      <p>These Terms of Service (“<strong>Terms</strong>”) form the commercial and use agreement between you and the operator of Eastern OS. They explain, in plain English:</p>
      <ol>
        <li>Who “we” are;</li>
        <li>Eligibility (18+) and how you accept these Terms;</li>
        <li>What the Service is (unified multi-turn decision dialogue) and what one <strong>PASS</strong> unlocks;</li>
        <li>Accounts, PASS / subscription commerce, and illustrative pricing (not a permanent price schedule);</li>
        <li>Acceptable use and prohibited conduct;</li>
        <li>AI outputs, user responsibility, and cross-reference to the Disclaimer;</li>
        <li>Intellectual property and user content / browser-local data;</li>
        <li>Payments, refunds cross-reference, and suspension;</li>
        <li>Disclaimers, limitation of liability, and indemnity;</li>
        <li>Governing law, changes, contact, and acknowledgment.</li>
      </ol>
      <p>Related policies you should also read:</p>
      <ul>
        <li><Link href="/disclaimer">Disclaimer &amp; Sovereignty Architecture</Link></li>
        <li><Link href="/privacy">Privacy Policy</Link></li>
        <li><Link href="/refund">Refund Policy</Link></li>
        <li><Link href="/cookies">Cookie &amp; Local Storage Policy / Cookie Settings</Link></li>
      </ul>
      <p>If you do not agree to these Terms, the Privacy Policy, the Refund Policy, or the Disclaimer, <strong>do not use Eastern OS</strong>.</p>
      <h2>1. Acceptance of these Terms</h2>
      <h3>1.1 Binding agreement</h3>
      <p>By accessing, browsing, creating an account, purchasing a PASS, starting a dialogue, initiating a subscription, or otherwise using Eastern OS (the “<strong>Service</strong>”), you confirm that you have read, understood, and agree to be bound by these Terms and by the then-current Privacy Policy, Refund Policy, and Disclaimer &amp; Sovereignty Architecture incorporated by reference.</p>
      <h3>1.2 Assent mechanisms</h3>
      <p>Assent may occur through clickwrap acknowledgment (for example, an entry modal that requires acceptance of Terms / Privacy / Refund / Disclaimer themes), checkout confirmation, account creation, or continued use after notice of material updates. Where law requires fresh consent, we will seek it.</p>
      <h3>1.3 Related documents</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>These Terms</strong></td>
              <td>Account rules, PASS / subscription commerce, acceptable use, IP, payments, liability / indemnity posture, and dispute mechanics.</td>
            </tr>
            <tr>
              <td><strong>Disclaimer</strong></td>
              <td>Product nature, no medical / legal / financial / fortune-telling, sovereignty / user responsibility, crisis resources, high-level local-session limits.</td>
            </tr>
            <tr>
              <td><strong>Privacy Policy</strong></td>
              <td>What is collected, what stays browser-local, processors, retention, deletion rights.</td>
            </tr>
            <tr>
              <td><strong>Refund Policy</strong></td>
              <td>When payments may be refunded (e.g., verified technical delivery failure) vs. not (e.g., dislike of AI framing; local data loss).</td>
            </tr>
            <tr>
              <td><strong>Cookie Settings</strong></td>
              <td>Browser cookie / similar-tech preferences.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>If a commercial rule here conflicts with Marketing / Pricing copy, <strong>checkout and these Terms control</strong> for the specific purchase. If a technical privacy detail here conflicts with the Privacy Policy, prefer the Privacy Policy—and revise this page if needed.</p>
      <h2>2. Operator identity (“we”)</h2>
      <h3>2.1 Definitions</h3>
      <p>In these Terms, “<strong>Eastern OS</strong>,” “<strong>we</strong>,” “<strong>us</strong>,” and “<strong>our</strong>” mean the operator of easternos.com / the Eastern OS Service <strong>as identified on this site and in these Terms</strong>.</p>
      <p>For legal, privacy, and support correspondence, use the contact emails in <strong>§19</strong>.</p>
      <h3>2.2 “You”</h3>
      <p>“<strong>You</strong>” means the individual adult who accesses or uses the Service, creates an account, or purchases a PASS / subscription. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization—<strong>but Family / Team / multi-seat plans are not offered</strong> under this launch baseline (see §5.8).</p>
      <h2>3. Eligibility (18+)</h2>
      <h3>3.1 Adults only</h3>
      <p>Eastern OS is intended <strong>exclusively for adults aged 18 or older</strong>.</p>
      <p>By creating an account, purchasing a PASS, starting a paid dialogue, or otherwise using the Service, you represent and warrant that you are <strong>at least 18 years of age</strong> and have legal capacity to enter these Terms.</p>
      <h3>3.2 No minors</h3>
      <p>We do not knowingly facilitate paid sessions or accounts for individuals under 18. If you believe a minor has accessed the Service or provided personal information, contact <strong>privacy@easternos.com</strong> promptly so we can take reasonable steps consistent with the Privacy Policy and applicable law.</p>
      <h3>3.3 Lawful use location</h3>
      <p>You are responsible for determining whether your use of the Service is lawful in your jurisdiction. You may not use the Service where prohibited by applicable law.</p>
      <h2>4. Service description</h2>
      <h3>4.1 What Eastern OS is</h3>
      <p><strong>Eastern OS</strong> (easternos.com) is a <strong>unified multi-turn decision dialogue</strong> product. It is designed to help adults think more clearly about situations they bring into the conversation—through structured dialogue, reflective framing, and written deliverables grounded in <strong>cultural and historical Eastern decision-wisdom traditions</strong> used as <strong>analytical lenses</strong>, together with modern systems-thinking and behavioral-science style reasoning.</p>
      <p>Eastern OS is presented and sold as <strong>one unified Service</strong>—a multi-turn decision dialogue experience—not as a bundle of separately marketed modules.</p>
      <h3>4.2 What one PASS is intended to provide</h3>
      <p><strong>1 PASS</strong> is intended to unlock, as a <strong>bundled entitlement provided together</strong>:</p>
      <ol>
        <li>A <strong>multi-turn decision dialogue</strong>;</li>
        <li><strong>Main path + backup</strong> framing within the dialogue / deliverable flow; and</li>
        <li>A <strong>report</strong> (structured written deliverable); and</li>
        <li><strong>30-day daily same-line reminders</strong> associated with that line of work.</li>
      </ol>
      <p>Exact packaging, eligibility, reminder delivery channels (in-product vs. optional email), timezone behavior, and any new-user promotions are defined by live <strong>Pricing</strong> materials and these Terms as current at purchase. Reminder delivery may depend on your device, browser, notification settings, email provider (if opted in), and network conditions; we do <strong>not</strong> warrant that every reminder will arrive on a particular minute across all environments (see Disclaimer and §14).</p>
      <h3>4.3 What Eastern OS is not</h3>
      <p>Eastern OS, its operators, interfaces, prompts, reports, reminders, and AI-assisted outputs <strong>do not</strong> constitute, and must not be treated as:</p>
      <ul>
        <li>Medical, psychiatric, psychological, or clinical care;</li>
        <li>Legal advice or representation;</li>
        <li>Financial, investment, tax, or fiduciary advice;</li>
        <li>Fortune-telling, destiny prediction, divination, occult revelation, or scare / fear-harvest claims;</li>
        <li>An emergency or crisis service;</li>
        <li>A substitute for your own judgment or licensed professional advice.</li>
      </ul>
      <p>Full product-boundary disclosure lives in the <strong><Link href="/disclaimer">Disclaimer &amp; Sovereignty Architecture</Link></strong>. Crisis resources for the United States and Canada include <strong>988</strong>. If you are in crisis, stop using the Service for that purpose and contact emergency services or a certified human crisis line.</p>
      <h3>4.4 Intended use</h3>
      <p>The Service is intended for personal reflection, structured self-inquiry, decision framing, intellectual journaling, and situational analysis based on <strong>your</strong> inputs, plus optional retention of outputs via <strong>user-initiated export or email</strong> where offered.</p>
      <h3>4.5 Service changes</h3>
      <p>We may modify, suspend, or discontinue features, models, packaging, or availability of the Service (including reminder channels) with or without notice, subject to mandatory law and any vested commercial entitlements you have already paid for under these Terms and the Refund Policy. We are not obligated to maintain any particular feature indefinitely.</p>
      <h2>5. Accounts; PASS &amp; subscription commerce</h2>
      <h3>5.1 Accounts</h3>
      <p>Where accounts are used for PASS purchase / subscription management:</p>
      <ul>
        <li>You must provide accurate account information and keep credentials confidential;</li>
        <li>You are responsible for activity under your account;</li>
        <li><strong>Accounts hold PASS balances, billing / subscription state, and related account records</strong>—<strong>not</strong> a primary cloud archive of full chat history;</li>
        <li>Creating or signing into an account does <strong>not</strong> create a syncable cloud chat backup.</li>
      </ul>
      <p>See the <strong>Privacy Policy</strong> for what is stored server-side vs. browser-local.</p>
      <h3>5.2 PASS as commercial unit</h3>
      <p>A “<strong>PASS</strong>” is the commercial entitlement unit that unlocks one bundled dialogue experience as described in §4.2. PASS balances are tracked in your account ledger. Spending a PASS initiates the associated dialogue / deliverable entitlement under then-current product rules.</p>
      <h3>5.3 Illustrative pricing (not a permanent price schedule)</h3>
      <p>For commercial awareness only—<strong>always confirm live prices and entitlements on Pricing / at checkout</strong>:</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Offering (illustrative)</th>
              <th scope="col">Approximate figure</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>One-time purchase</td>
              <td><strong>USD $19.99 per 1 PASS</strong></td>
            </tr>
            <tr>
              <td>Monthly subscription</td>
              <td><strong>USD $59.99 per month for 5 PASS</strong></td>
            </tr>
            <tr>
              <td>New-user promotion (when active)</td>
              <td>First month <strong>+2 PASS</strong> (in addition to the subscription allotment, under then-current promo rules)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Prices, taxes, currency presentation, and promotions may change. <strong>These Terms do not hardcode a permanent price schedule.</strong> The amount shown at checkout for your transaction controls for that purchase.</p>
      <h3>5.4 Dual balances — spend order</h3>
      <p>Where multiple PASS balance types exist (for example, carryover, subscription allotment, and separately purchased / flex PASS), product spend order follows then-current Pricing / FAQ / in-product ledger rules. Launch posture is <strong>carryover → subscription → purchased / flex PASS</strong>, unless a then-current UI / ledger rule expressly states otherwise. Confirm live ledger behavior in-product.</p>
      <h3>5.5 Subscription billing</h3>
      <p>By starting a paid subscription:</p>
      <ul>
        <li>You authorize recurring charges at the then-current subscription rate for each billing period until you cancel;</li>
        <li>PASS allotments for a paid period are provisioned according to then-current Pricing / ledger rules (illustratively 5 PASS per month, plus any active new-user first-month +2);</li>
        <li>Renewal timing, grace periods, and failed-payment handling follow the payment processor / merchant-of-record stack and in-product billing portal rules.</li>
      </ul>
      <h3>5.6 Cancellation</h3>
      <p>You may cancel automatic renewal at any time via the secure self-service billing portal / checkout customer portal provided at purchase, or by contacting <strong>support@easternos.com</strong>.</p>
      <p>Upon cancellation:</p>
      <ul>
        <li>You retain access to PASS already allotted for the <strong>current paid billing period</strong> through the end of that period (subject to §5.7);</li>
        <li><strong>No mid-cycle partial pro-rata refund</strong> of subscription fees is authorized solely because you cancelled mid-period or did not use all PASS—except as the <strong>Refund Policy</strong> separately allows (e.g., verified technical delivery failure, duplicate charge).</li>
      </ul>
      <h3>5.7 Unused PASS after cancel / period end</h3>
      <p>Unless then-current Pricing and ledger rules state otherwise:</p>
      <ul>
        <li>Unused <strong>subscription</strong> PASS expire at the end of the current paid billing period upon cancel or non-renewal;</li>
        <li>One-time purchased (or promotional) PASS follow then-published Pricing / ledger rules.</li>
      </ul>
      <p>When those rules change, we will update these Terms, Pricing, the Refund Policy, and related Privacy retention language as needed.</p>
      <h3>5.8 Family / Team plans — not offered</h3>
      <p><strong>Family, Team, multi-seat, or organization-wide plans are not offered</strong> under this Version 1.0 launch baseline. Sharing account credentials to circumvent per-user commerce is prohibited (see §6).</p>
      <h3>5.9 Promotions</h3>
      <p>New-user first-month +2 PASS (and any other promotions) apply only when active under then-current Pricing rules, eligibility criteria, and anti-abuse limits. Promotions may be modified or withdrawn prospectively.</p>
      <h2>6. Acceptable use</h2>
      <h3>6.1 Permitted use</h3>
      <p>You may use the Service only for lawful, personal, adult reflective / decision-framing purposes consistent with these Terms and the Disclaimer.</p>
      <h3>6.2 Prohibited conduct</h3>
      <p>You agree <strong>not</strong> to:</p>
      <ol>
        <li>Use the Service if you are under 18;</li>
        <li>Scrape, harvest, crawl, or systematically extract content, prompts, outputs, or non-public APIs beyond ordinary interactive use;</li>
        <li>Reverse-engineer, decompile, or attempt to derive source code or model weights except to the limited extent mandatory law permits;</li>
        <li>Deploy bots, scripts, or high-frequency automated traffic to bypass rate limits, spending rules, or safety guardrails;</li>
        <li>Circumvent PASS metering, subscription limits, or payment flows;</li>
        <li>Share, resell, sublicense, or commercially redistribute the Service, PASS, or generated outputs as a competing product or bulk content service without prior written authorization;</li>
        <li>Upload or generate illegal, threatening, harassing, exploitative, or otherwise unlawful content;</li>
        <li>Attempt unauthorized access to accounts, systems, or data;</li>
        <li>Interfere with Service integrity, security, or availability (including DDoS, malware injection, or credential stuffing);</li>
        <li>Misrepresent your identity or age in connection with accounts or payments;</li>
        <li>Use outputs to train competing machine-learning models at scale, or to build a substantially similar competing decision-dialogue product from scraped Eastern OS materials;</li>
        <li>Use the Service for fortune-telling / scare / “pay to remove doom” schemes, medical diagnosis, legal practice, or investment advising marketed as professional services.</li>
      </ol>
      <h3>6.3 Enforcement</h3>
      <p>We may investigate suspected violations and suspend or terminate access, withhold or reverse improperly obtained PASS, and cooperate with payment processors or authorities as appropriate. See §13.</p>
      <h2>7. AI outputs &amp; user responsibility (cross-ref Disclaimer)</h2>
      <h3>7.1 AI-assisted generation</h3>
      <p>Dialogues, reports, main path + backup framing, and reminders are produced with <strong>automated artificial intelligence / large-language-model pipelines</strong> (and related software). Outputs are <strong>probabilistic</strong>, <strong>non-deterministic</strong>, and may contain errors, omissions, or misleading phrasing.</p>
      <h3>7.2 Your judgment required</h3>
      <p><strong>You must critically evaluate every output before acting.</strong> You—not Eastern OS, not AI providers, not operators—retain exclusive responsibility for how you interpret and whether you act on any dialogue, report, path framing, or reminder.</p>
      <h3>7.3 No professional advice</h3>
      <p>Nothing in the Service is medical, mental-health, legal, or financial advice. Prefer licensed professionals for those domains. See the full <strong><Link href="/disclaimer">Disclaimer</Link></strong>.</p>
      <h3>7.4 No fortune-telling / destiny claims</h3>
      <p>Cultural or historical Eastern decision-wisdom framing, if present, is an <strong>analytical vocabulary</strong>—not prediction of destiny, fate, or inevitable future events. Scare or fear-harvest framing is rejected as product posture.</p>
      <h3>7.5 Crisis</h3>
      <p>Eastern OS is <strong>not</strong> a crisis service. If you are in danger or acute distress, contact local emergency services and, for US/CA, <strong>988</strong>. Additional publicly known helplines appear on the Disclaimer for convenience only.</p>
      <h3>7.6 Dissatisfaction with reflective content</h3>
      <p>Dislike of style, tone, framing, or usefulness of AI-assisted reflective content is <strong>not</strong>, by itself, a verified technical delivery failure under the Refund Policy and is <strong>not</strong> a professional-malpractice claim against a non-professional product.</p>
      <h2>8. Intellectual property</h2>
      <h3>8.1 Our IP</h3>
      <p>Eastern OS, easternos.com, and related branding, site design, software, prompt architectures, product copy, logos, and proprietary structural frameworks (including any branded card / path / category systems as shipped) are owned by the operator or its licensors. All rights not expressly granted are reserved.</p>
      <p>You receive a limited, revocable, non-exclusive, non-transferable license to access and use the Service for your personal, non-commercial reflective use in accordance with these Terms—for so long as you have a valid entitlement (PASS / subscription access) and comply with these Terms.</p>
      <h3>8.2 Your inputs and generated outputs (personal use)</h3>
      <p>Subject to these Terms and applicable law:</p>
      <ul>
        <li><strong>Inputs you type</strong> remain yours as between you and us (you still grant the licenses below needed to operate the Service);</li>
        <li><strong>Generated outputs</strong> surfaced to you in a dialogue / report / reminder for a PASS you validly spent may be used by you for <strong>private personal</strong> journaling, reflection, and non-commercial personal sharing;</li>
        <li>You may <strong>not</strong> mass-distribute outputs to train competing models, sell bulk output libraries, or commercially exploit Eastern OS frameworks as if they were your product.</li>
      </ul>
      <h3>8.3 License you grant us</h3>
      <p>You grant us a worldwide, non-exclusive, royalty-free license to host, transmit, process, and display your inputs and related contextual payloads <strong>as needed to operate the Service</strong>—including transient transmission to AI / infrastructure providers—consistent with the Privacy Policy. This license is not a claim that we operate a permanent cloud chat archive.</p>
      <h3>8.4 Public-domain classical texts</h3>
      <p>Classical historical texts referenced as cultural-analytical context (for example, historical editions of the <em>I Ching</em> / Book of Changes or other public-domain materials) belong to the public domain or their respective rights holders. We assert no ownership over classical public-domain texts themselves.</p>
      <h3>8.5 Feedback</h3>
      <p>If you send feedback or suggestions, you grant us a perpetual, irrevocable, royalty-free license to use them without restriction or attribution obligation, to the extent permitted by law.</p>
      <h2>9. User content &amp; browser-local data</h2>
      <h3>9.1 Browser-local chat / deliverables</h3>
      <p>Under the current product design:</p>
      <ul>
        <li><strong>Dialogue / chat content and related in-browser deliverables</strong> are intended to remain <strong>local to the browser / device session context</strong> in which you use them (e.g., IndexedDB / local storage in the <strong>current</strong> browser profile);</li>
        <li>Content is <strong>not</strong> offered as a cloud chat archive synced via your account;</li>
        <li><strong>Accounts = PASS + billing</strong>, not chat sync.</li>
      </ul>
      <h3>9.2 What can erase local content</h3>
      <p>Local content may be <strong>permanently lost</strong> if you clear site data / cache / cookies / IndexedDB / local storage; use or close Incognito / Private windows; switch browsers or devices; uninstall a PWA / clear app storage; use aggressive privacy extensions; or use another browser profile.</p>
      <p><strong>Eastern OS does not promise server-side recovery of lost local chat logs.</strong></p>
      <h3>9.3 Export / email for your retention</h3>
      <p>Where the product offers <strong>export</strong> or <strong>email</strong> of reports or companion materials, that is a <strong>user-initiated retention / delivery</strong> feature—not an automatic cloud chat backup of the entire dialogue.</p>
      <h3>9.4 Receipt email ≠ chat backup</h3>
      <p>A payment receipt, invoice, or billing email does <strong>not</strong> store or restore your dialogue history. Optional reminder email (if you opt in) delivers reminder content under companion / reminder rules—it is <strong>not</strong> a promise that the full chat lives in your inbox forever.</p>
      <h3>9.5 Transient processing for AI generation</h3>
      <p>To generate replies, your inputs are transmitted securely to processing pipelines as described in the Privacy Policy. Transient processing for generation is <strong>not</strong> the same as Eastern OS maintaining a permanent cloud copy of your chat for cross-device reopen.</p>
      <h3>9.6 No refunds for local data loss (commercial rule)</h3>
      <p>Accidental or user-caused loss of browser-local content does <strong>not</strong>, by itself, entitle you to PASS refunds, free PASS restoration, or complimentary resets—except as the <strong>Refund Policy</strong> separately allows for verified technical delivery failures. See also Disclaimer §7 and Privacy §3.</p>
      <h3>9.7 Your responsibility for sensitive inputs</h3>
      <p>Do not enter secrets you are unwilling to transmit for AI generation (passwords, full government ID numbers, others’ private data, etc.). You are responsible for the legality and appropriateness of content you submit.</p>
      <h2>10. Payments</h2>
      <h3>10.1 Checkout</h3>
      <p>By initiating checkout, you agree to pay the price shown at checkout for the selected PASS or subscription, including applicable taxes as presented.</p>
      <h3>10.2 Payment processor / merchant of record</h3>
      <p>Payments are processed through the <strong>payment processor and/or merchant-of-record (MoR) stack actually integrated at launch</strong> (secure hosted checkout or equivalent).</p>
      <p><strong>The exact name shown at live checkout and on your bank / wallet statement or receipt controls</strong> for that transaction.</p>
      <ul>
        <li>Eastern OS does <strong>not</strong> intend to store raw full card Primary Account Numbers on its own servers;</li>
        <li>Card / wallet data is handled by the processor / MoR under their terms and privacy policies;</li>
        <li>Those providers may act as seller of record or processor depending on the live arrangement.</li>
      </ul>
      <h3>10.3 Authorization</h3>
      <p>You represent that you are authorized to use the payment method presented and authorize charges for the selected products and recurring subscription renewals until cancelled.</p>
      <h3>10.4 Failed payments</h3>
      <p>If a renewal payment fails, we or the processor may retry, suspend entitlements, or cancel the subscription according to then-current billing rules. Outstanding fees may remain due where legally collectible.</p>
      <h3>10.5 Taxes</h3>
      <p>Prices may be tax-exclusive or tax-inclusive as shown at checkout. You are responsible for any taxes not collected by the MoR / processor, to the extent permitted by law.</p>
      <h2>11. Refunds (cross-reference)</h2>
      <p>Transactions are governed by the dedicated <strong><Link href="/refund">Refund Policy</Link></strong> and by the <strong>rules of the payment provider / merchant-of-record actually integrated at launch</strong>. In summary posture aligned to this launch baseline (not a substitute for the Refund Policy page):</p>
      <p><strong>May be eligible (subject to verification and Refund Policy detail):</strong></p>
      <ul>
        <li>Verified <strong>technical delivery failures</strong> caused by platform / payment fulfillment errors (e.g., charge succeeded but PASS entitlement never issued; catastrophic generation pipeline failure preventing any dialogue delivery);</li>
        <li><strong>Duplicate</strong> identical charges for a single intended purchase;</li>
        <li>Other categories expressly listed in the then-current Refund Policy (including any unused-PASS / time-window rules).</li>
      </ul>
      <p><strong>Generally not eligible:</strong></p>
      <ul>
        <li>Subjective dissatisfaction with AI linguistic style, framing, or reflective usefulness;</li>
        <li>Change of mind after a PASS has been spent and generation / dialogue has commenced (except as Refund Policy expressly allows);</li>
        <li>Loss of <strong>browser-local</strong> chat / deliverables due to cache clear, Incognito, device switch, etc.;</li>
        <li>Mid-cycle subscription cancel seeking pro-rata refund solely for unused time / unused PASS (unless Refund Policy expressly allows).</li>
      </ul>
      <p><strong>Provider rules:</strong> Where the Refund Policy and these Terms allow a refund, processing timing, method, and any fees or windows may also follow the <strong>payment provider’s then-current rules</strong>. Do not market or imply a universal “one-click refund” unless that feature is actually shipped at checkout.</p>
      <p><strong>How to request:</strong> Contact <strong>support@easternos.com</strong> within any window stated in the Refund Policy, and include transaction / confirmation reference from your receipt, description of the failure, and relevant screenshots or error detail.</p>
      <p>Chargebacks initiated without first contacting support may delay resolution; fraud / abuse chargebacks may result in account suspension.</p>
      <h2>12. Suspension &amp; termination</h2>
      <h3>12.1 By you</h3>
      <p>You may stop using the Service at any time. You may cancel subscriptions as described in §5.6. You may request deletion of server-side account personal data via <strong>privacy@easternos.com</strong>, subject to legal retention exceptions (especially payment / tax records)—see Privacy Policy.</p>
      <p>Stopping use does not automatically refund unused PASS or subscription fees except as the Refund Policy provides.</p>
      <h3>12.2 By us</h3>
      <p>We may suspend or terminate access, accounts, or entitlements immediately if we reasonably believe you:</p>
      <ul>
        <li>Violated these Terms or applicable law;</li>
        <li>Engaged in fraud, chargeback abuse, or payment manipulation;</li>
        <li>Threatened security, other users, or infrastructure;</li>
        <li>Are under 18;</li>
        <li>Create legal or operational risk we cannot reasonably mitigate.</li>
      </ul>
      <p>We may also suspend the Service for maintenance, security incidents, or force majeure.</p>
      <h3>12.3 Effect of termination</h3>
      <p>Upon termination, your license to use the Service ends. Browser-local content remains on your device until you clear it. Server-side account / billing records are handled per Privacy Policy. Sections that by nature should survive (including intellectual property, disclaimers, liability limits, indemnity, and governing-law provisions) survive termination.</p>
      <h2>13. Disclaimers / warranty</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE AND ALL RELATED OUTPUTS ARE PROVIDED <strong>“AS IS”</strong> AND <strong>“AS AVAILABLE,”</strong> WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY—INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>
      <p>We do not warrant that:</p>
      <ul>
        <li>Outputs will be accurate, complete, current, or error-free;</li>
        <li>The Service will be uninterrupted, secure, or available at any particular time;</li>
        <li>Defects will be corrected;</li>
        <li>The Service will meet your personal or professional requirements;</li>
        <li>Reminders will arrive on any particular schedule across all devices, email providers, or notification settings;</li>
        <li>Browser-local data will persist across browsers, devices, or storage clears;</li>
        <li>Any particular professional, financial, legal, medical, or life outcome will result from use.</li>
      </ul>
      <p>Some jurisdictions do not allow certain warranty disclaimers. Where mandatory consumer protections apply, those protections remain available to the extent they cannot be waived.</p>
      <p>Product-boundary detail is in the <strong>Disclaimer</strong>. Privacy and security posture is in the <strong>Privacy Policy</strong>.</p>
      <h2>14. Limitation of liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, EASTERN OS, ITS OPERATORS (AS IDENTIFIED ON THIS SITE AND IN THESE TERMS), AND ITS INFRASTRUCTURE AND AI PROCESSING PARTNERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, BUSINESS OPPORTUNITY, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF—OR INABILITY TO USE—THE SERVICE, WHETHER BASED IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
      <p>Without limiting the foregoing, this includes claims related to:</p>
      <ul>
        <li>Decisions you make after reading dialogues, reports, paths, or reminders;</li>
        <li>Relationship, career, financial, academic, or relocation outcomes;</li>
        <li>Emotional distress;</li>
        <li>Local data loss (browser clear, device switch, Incognito, etc.);</li>
        <li>Third-party AI processor behavior, outages, or content quality;</li>
        <li>Payment-processor or merchant-of-record operational issues.</li>
      </ul>
      <p><strong>Exclusive remedy.</strong> Your sole and exclusive remedy for dissatisfaction with the software, outputs, or availability—subject to mandatory law and the Refund Policy—is to <strong>stop using the Service</strong>. Transaction-specific remedies (if any) are governed by the <strong>Refund Policy</strong>.</p>
      <p><strong>Liability cap.</strong> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNTS YOU PAID TO EASTERN OS FOR THE SERVICE DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) USD $100 IF YOU HAVE PAID NOTHING IN THAT PERIOD.</p>
      <p><strong>Mandatory law.</strong> Nothing in these Terms excludes liability that cannot be excluded under applicable law (including liability for death or personal injury caused by negligence where such exclusion is prohibited, fraud, or other non-waivable consumer rights).</p>
      <p>If the Disclaimer and these Terms conflict on liability mechanics, treat <strong>these Terms</strong> as the commercial contract and the Disclaimer as the product-boundary disclosure.</p>
      <h2>15. Indemnity</h2>
      <p>To the maximum extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Eastern OS and its operators (as identified on this site and in these Terms), and their respective officers, contractors, and agents, from and against third-party claims, damages, losses, and expenses (including reasonable attorneys’ fees) arising out of or related to:</p>
      <ol>
        <li>Your misuse of the Service;</li>
        <li>Your violation of these Terms or applicable law;</li>
        <li>Your inputs (including content that infringes others’ rights or is unlawful);</li>
        <li>Decisions or actions you take based on AI-assisted outputs;</li>
        <li>Disputes between you and third parties stemming from your use of outputs.</li>
      </ol>
      <h2>16. Governing law &amp; dispute resolution</h2>
      <h3>16.1 Governing law</h3>
      <p>These Terms are governed by the laws applicable to the operator of the Service as stated when you purchase, or as updated on this page. Venue and formal dispute-resolution procedures (including any arbitration, court venue, or class-action terms) may be stated on this page or in the then-current Terms when you purchase.</p>
      <h3>16.2 Consumer protections</h3>
      <p>Mandatory consumer protections in your place of residence may apply where they cannot be waived.</p>
      <h3>16.3 Informal resolution first</h3>
      <p>Before formal proceedings, please contact <strong>legal@easternos.com</strong> and <strong>support@easternos.com</strong> with a brief description of the dispute so we can attempt good-faith resolution. This informal step does not extend statutes of limitation except as law requires.</p>
      <h2>17. Changes to these Terms</h2>
      <p>We may revise these Terms to reflect product changes, pricing / PASS rule updates, payment-stack confirmation, regulatory expectations, or legal guidance. The <strong>Last updated</strong> date at the top marks the current version.</p>
      <p>Material updates may be surfaced via site notice, entry acknowledgment / version gate, email to your account address, or checkout notice where implemented. Continued use after an update is posted may be treated as acceptance. Where law requires fresh consent, we will seek it.</p>
      <p>If you do not agree to updated Terms, stop using the Service and cancel any subscription.</p>
      <h2>18. Miscellaneous</h2>
      <h3>18.1 Entire agreement</h3>
      <p>These Terms, together with the Privacy Policy, Refund Policy, Disclaimer, and Cookie disclosures (and any checkout-specific terms presented at purchase), constitute the entire agreement between you and us regarding the Service and supersede prior conflicting statements about the same subject matter.</p>
      <h3>18.2 Severability</h3>
      <p>If a provision is held unenforceable, the remaining provisions remain in effect, and the unenforceable provision will be modified to the minimum extent necessary to make it enforceable.</p>
      <h3>18.3 No waiver</h3>
      <p>Failure to enforce a provision is not a waiver of the right to enforce it later.</p>
      <h3>18.4 Assignment</h3>
      <p>You may not assign these Terms without our prior written consent. We may assign these Terms in connection with a reorganization, sale, or to an affiliate / successor operator. Subject to the foregoing, these Terms bind permitted successors.</p>
      <h3>18.5 Force majeure</h3>
      <p>We are not liable for delays or failures caused by events beyond reasonable control (including outages of third-party AI, hosting, email, or payment providers; war; natural disaster; epidemic; government action; or widespread internet failure).</p>
      <h3>18.6 Export / sanctions</h3>
      <p>You may not use the Service in violation of applicable export-control or sanctions laws.</p>
      <h3>18.7 No third-party beneficiaries</h3>
      <p>Except as expressly stated (e.g., indemnified operators / agents), these Terms create no third-party beneficiary rights.</p>
      <h3>18.8 Headings</h3>
      <p>Headings are for convenience only and do not affect interpretation.</p>
      <h3>18.9 Relationship of parties</h3>
      <p>Nothing in these Terms creates a partnership, joint venture, employment, or fiduciary relationship.</p>
      <h2>19. Contact</h2>
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
              <td><strong>Legal</strong></td>
              <td><a href="mailto:legal@easternos.com">legal@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Privacy / data requests</strong></td>
              <td><a href="mailto:privacy@easternos.com">privacy@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Support / billing / refunds operations</strong></td>
              <td><a href="mailto:support@easternos.com">support@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Contact hub</strong></td>
              <td><a href="https://www.easternos.com/contact" rel="noopener noreferrer" target="_blank">https://www.easternos.com/contact</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2>20. Acknowledgment</h2>
      <p>By using Eastern OS, you acknowledge that you have read and understood these Terms, including that:</p>
      <ul>
        <li>Eastern OS is a <strong>unified multi-turn decision dialogue</strong> product, not a clinic, law firm, broker, or fortune-teller;</li>
        <li><strong>1 PASS</strong> is intended to unlock dialogue → main path + backup + report → 30-day daily same-line reminders <strong>provided together</strong>;</li>
        <li>Outputs are <strong>AI-assisted</strong> and require <strong>your</strong> critical judgment;</li>
        <li><strong>You</strong> remain responsible for your decisions;</li>
        <li>Chat / deliverables are <strong>browser-local</strong> with real loss risk; <strong>account = PASS + billing</strong>, not chat sync; <strong>receipt email ≠ chat backup</strong>;</li>
        <li>Illustrative pricing (~$19.99 / 1 PASS; ~$59.99/mo · 5 PASS; new-user first month +2 when active) is <strong>not</strong> a permanent price list—checkout controls;</li>
        <li><strong>Family / Team</strong> plans are <strong>not</strong> offered under this baseline;</li>
        <li>Payment vendor identity follows the <strong>live checkout / receipt</strong> name;</li>
        <li>The operator is as identified on this site and in these Terms;</li>
        <li>You are <strong>18+</strong>; and</li>
        <li>Crisis situations require <strong>human emergency resources</strong> (including <strong>988</strong> for US/CA), not this app.</li>
      </ul>
    </LegalPageShell>
  );
}
