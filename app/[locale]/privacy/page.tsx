import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — Eastern OS",
  description: "Eastern OS Privacy Policy — Version 1.0",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      version="Version 1.0 (first public launch baseline)"
      title="Privacy Policy"
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
      <h2>Purpose of this Policy</h2>
      <p>This Privacy Policy explains, in plain English:</p>
      <ol>
        <li>Who operates Eastern OS and how to contact us about privacy;</li>
        <li>What information we collect <strong>on our servers / through accounts and billing</strong>, versus what stays <strong>local to your browser</strong>;</li>
        <li>How dialogue / chat content and in-browser deliverables are stored and what can make them disappear;</li>
        <li>What leaves your device <strong>transiently</strong> so AI-assisted responses can be generated;</li>
        <li>How payment / PASS / subscription data is handled;</li>
        <li>How email is used (receipts, optional reminders, user-initiated export)—and why <strong>receipt email is not chat backup</strong>;</li>
        <li>Retention, deletion, and your access / export / deletion rights;</li>
        <li>Conservative regional disclosures (including CCPA- and GDPR-style themes) <strong>without</strong> claiming certifications we have not obtained;</li>
        <li>Children (18+), security posture, international transfers, changes, and contact.</li>
      </ol>
      <p>Related policies you should also read:</p>
      <ul>
        <li><Link href="/terms">Terms of Service</Link></li>
        <li><Link href="/disclaimer">Disclaimer &amp; Sovereignty Architecture</Link></li>
        <li><Link href="/refund">Refund Policy</Link></li>
        <li><Link href="/cookies">Cookie &amp; Local Storage Policy / Cookie Settings</Link></li>
      </ul>
      <p>Commercial pricing, PASS entitlements, and billing mechanics are governed by the <strong>Terms of Service</strong> and live <strong>Pricing</strong> materials at purchase—not by this Privacy Policy. This page may mention PASS packaging only for privacy context.</p>
      <p>By accessing, browsing, creating an account, purchasing a PASS, starting a dialogue, or otherwise using Eastern OS, you acknowledge this Privacy Policy. If you do not agree, do not use the Service.</p>
      <h2>1. Who we are (controller / operator)</h2>
      <h3>1.1 Operator identity</h3>
      <p>In this Policy, “<strong>Eastern OS</strong>,” “<strong>we</strong>,” “<strong>us</strong>,” and “<strong>our</strong>” mean the operator of easternos.com / the Eastern OS Service <strong>as identified on this site and in the Terms of Service</strong>.</p>
      <h3>1.2 Privacy contact</h3>
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
              <td><strong>Privacy / data requests</strong></td>
              <td><a href="mailto:privacy@easternos.com">privacy@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Legal</strong></td>
              <td><a href="mailto:legal@easternos.com">legal@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Support / billing operations</strong></td>
              <td><a href="mailto:support@easternos.com">support@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Contact hub</strong></td>
              <td><a href="https://www.easternos.com/contact" rel="noopener noreferrer" target="_blank">https://www.easternos.com/contact</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>For formal access, deletion, or similar requests, email <strong>privacy@easternos.com</strong>. A useful subject convention is <strong>“Data Sovereignty Request”</strong> (you may also use “Privacy Request,” “CCPA Request,” or “GDPR Request”).</p>
      <h3>1.3 What the product is (privacy-relevant framing)</h3>
      <p><strong>Eastern OS</strong> (easternos.com) is a <strong>unified multi-turn decision dialogue</strong> product.</p>
      <p>For product clarity (without replacing Terms / Pricing):</p>
      <p><strong>1 PASS</strong> is intended to unlock, as a <strong>bundled entitlement provided together</strong>:</p>
      <ol>
        <li>A multi-turn decision dialogue;</li>
        <li>Main path + backup framing;</li>
        <li>A report (structured written deliverable); and</li>
        <li>30-day daily same-line reminders associated with that line of work.</li>
      </ol>
      <p>Illustrative commercial awareness only (not a price schedule; confirm live Pricing / checkout):</p>
      <ul>
        <li>On the order of <strong>USD $19.99 per 1 PASS</strong>;</li>
        <li>Subscription on the order of <strong>USD $59.99 per month for 5 PASS</strong>, with a <strong>new-user first-month +2 PASS</strong> promotion when that promotion is active;</li>
        <li>Where multiple PASS balance types exist (for example, carryover, subscription allotment, and separately purchased / flex PASS), product spend order follows then-current Pricing / FAQ / in-product ledger rules. Launch posture is <strong>carryover → subscription → purchased / flex PASS</strong>, unless a then-current UI / ledger rule expressly states otherwise. Confirm live ledger behavior in-product.</li>
      </ul>
      <p>Eastern OS is <strong>not</strong> fortune-telling, destiny prediction, medical care, legal advice, or financial advice. Crisis resources for US/CA include <strong>988</strong>. See the <strong>Disclaimer</strong>.</p>
      <h2>2. Privacy architecture in one page</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Layer</th>
              <th scope="col">What happens</th>
              <th scope="col">Where it lives</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Dialogue / chat &amp; in-browser deliverables</strong></td>
              <td>Stored for your ongoing session experience</td>
              <td><strong>Browser-local</strong> (e.g., IndexedDB / local storage in the <strong>current</strong> browser profile). <strong>Not</strong> offered as a cloud chat archive synced via your account.</td>
            </tr>
            <tr>
              <td><strong>Account</strong></td>
              <td>Sign-in identity; <strong>PASS balances</strong>; billing / subscription state; related account records</td>
              <td>Server-side account systems (see §4)</td>
            </tr>
            <tr>
              <td><strong>AI generation</strong></td>
              <td>Your inputs (and necessary context) are sent over <strong>HTTPS</strong> so models can generate replies</td>
              <td>Transient processing by AI providers / our API routes (see §6). This is <strong>not</strong> the same as Eastern OS keeping a permanent cloud copy of your full chat for cross-device reopen.</td>
            </tr>
            <tr>
              <td><strong>Payments</strong></td>
              <td>Card/wallet handling by payment processor / merchant-of-record stack</td>
              <td>Payment providers; we receive transaction metadata needed for PASS fulfillment and compliance (see §7)</td>
            </tr>
            <tr>
              <td><strong>Email</strong></td>
              <td>Receipts; optional reminder delivery; user-initiated export/email</td>
              <td>Email systems when you provide an address or opt in (see §8). <strong>Receipt ≠ chat backup.</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p><strong>Honest boundary:</strong> “Browser-local chat” means Eastern OS does <strong>not</strong> treat your dialogue history as a syncable cloud backup attached to your account. It does <strong>not</strong> mean “nothing ever leaves your device.” Generation requires sending inputs to processing pipelines.</p>
      <h2>3. How chat stays local (and what can erase it)</h2>
      <h3>3.1 Browser-local by design</h3>
      <p>Under the current product design:</p>
      <ul>
        <li><strong>Dialogue / chat content and related in-browser deliverables</strong> are intended to remain <strong>local to the browser / device session context</strong> in which you use them;</li>
        <li>Content is <strong>not</strong> described here as synced across devices or browsers via your Eastern OS account as a chat backup;</li>
        <li><strong>Accounts hold PASS + billing / subscription state</strong>—<strong>not</strong> a primary cloud archive of full chat history.</li>
      </ul>
      <p>You (or your browser tools) can typically inspect client-side storage via browser developer tools (for example, Application → IndexedDB / Local Storage) for the easternos.com origin. Exact store names may change with product versions.</p>
      <h3>3.2 What can make local content disappear permanently</h3>
      <p>Because chat/deliverables are browser-local, they may be <strong>permanently lost</strong> if, for example, you:</p>
      <ul>
        <li>Clear site data / cache / cookies / IndexedDB / local storage;</li>
        <li>Use or close an <strong>Incognito / Private</strong> window;</li>
        <li>Switch browsers or devices;</li>
        <li>Uninstall a PWA / clear app storage;</li>
        <li>Use aggressive privacy extensions that wipe storage;</li>
        <li>Use another browser profile.</li>
      </ul>
      <p><strong>Eastern OS does not promise server-side recovery of lost local chat logs.</strong> Commercial consequences of local data loss are addressed in the <strong>Refund Policy</strong> and <strong>Terms</strong> (loss of local content is not, by itself, a basis for PASS refunds except as those policies separately allow for verified technical delivery failures).</p>
      <h3>3.3 Export / email for <em>your</em> retention</h3>
      <p>Where the product offers <strong>export</strong> or <strong>email</strong> of reports or companion materials, that is a <strong>user-initiated retention / delivery</strong> feature—not an automatic cloud chat backup of the entire dialogue.</p>
      <p><strong>Receipt email ≠ chat backup.</strong> A payment receipt, invoice, or billing email does <strong>not</strong> store or restore your dialogue history.</p>
      <p>Optional reminder email (if you opt in) delivers reminder content under the companion / reminder rules—it is <strong>not</strong> a promise that the full chat lives in your inbox forever.</p>
      <h3>3.4 Local encryption claims (accuracy over marketing)</h3>
      <p><strong>This Privacy Policy does not warrant AES-256 (or any specific cipher) as a current, universal property of all local stores.</strong> The accurate product statement is: chat/deliverables are intended to be <strong>browser-local</strong>. Whether a particular store uses client-side encryption depends on the shipped implementation. Security of data <strong>on your device</strong> also depends on your device, browser, OS account controls, malware posture, and who can unlock your machine.</p>
      <h2>4. What we collect</h2>
      <p>We distinguish (A) data associated with <strong>accounts, PASS, billing, and service operation</strong>, from (B) <strong>browser-local chat content</strong> that we do not operate as a cloud backup.</p>
      <h3>4.1 Account and authentication data</h3>
      <p>Where accounts are used for PASS purchase / subscription management:</p>
      <ul>
        <li>Email address (and related authentication identifiers);</li>
        <li>Authentication session cookies / tokens needed to keep you signed in;</li>
        <li>Account profile fields you choose to provide (minimal by design);</li>
        <li>PASS balance / entitlement ledgers and subscription status linked to the account.</li>
      </ul>
      <p><strong>Accounts are used for PASS and billing—not as a cloud chat sync product.</strong> Creating or signing into an account does not create a cloud archive of your chat history.</p>
      <h3>4.2 Billing, payment, and PASS records</h3>
      <ul>
        <li>Transaction amounts, currency, timestamps;</li>
        <li>Product / PASS SKU or entitlement identifiers;</li>
        <li>Subscription status, renewal periods, cancellation state;</li>
        <li>Payment-processor session / customer / invoice references (as provided by the processor);</li>
        <li>Limited fraud-prevention / risk signals the processor or our systems require.</li>
      </ul>
      <p>We do <strong>not</strong> intend to store raw full card Primary Account Numbers on Eastern OS systems. Card data is handled by the payment processor / merchant-of-record stack actually integrated at launch (see §7).</p>
      <h3>4.3 Email and communication data</h3>
      <ul>
        <li>Email for <strong>receipts / invoices</strong> when provided at checkout or via the processor;</li>
        <li>Email for <strong>optional</strong> reminder / companion delivery if you opt in;</li>
        <li>Email content you ask us to send when you use <strong>export / email</strong> features;</li>
        <li>Support emails you send to privacy@ / support@ / legal@.</li>
      </ul>
      <h3>4.4 Technical, security, and aggregated usage data</h3>
      <ul>
        <li>Approximate network metadata that hosting / edge providers may log (e.g., IP address or ranges, user-agent, request URLs, timestamps) for security, abuse prevention, reliability, and debugging;</li>
        <li>High-level country / region derived from GeoIP-style lookups where used for localization, fraud, or compliance—not precise GPS tracking as a product feature;</li>
        <li>Device or browser identifiers / hashes where used to support session continuity, entitlement checks, or fraud prevention;</li>
        <li>Aggregated, de-identified or anonymous volumetric stats (e.g., traffic counters) not used to rebuild individual chat histories.</li>
      </ul>
      <h3>4.5 Cookies and similar technologies</h3>
      <p>We use cookies and similar technologies (including local storage) for operation, session continuity, preferences, security, and billing flows. Details and preference controls live in the <strong><Link href="/cookies">Cookie &amp; Local Storage Policy</Link></strong>. This Privacy Policy incorporates that page by cross-reference rather than duplicating every cookie table row.</p>
      <p>We do <strong>not</strong> describe the Service as selling personal information to data brokers or running cross-site advertising pixel programs as a business model. If tooling changes, this Policy and the Cookie page must be updated together.</p>
      <h3>4.6 Content you type into the dialogue (local + transient processing)</h3>
      <ul>
        <li>Text and structured inputs you enter in the dialogue;</li>
        <li>Generated replies, path framings, reports, and reminders as stored in <strong>browser-local</strong> stores;</li>
        <li>The same (or derived) content as <strong>transiently transmitted</strong> for AI generation (§6).</li>
      </ul>
      <p>We do <strong>not</strong> claim that Eastern OS operators routinely read your private dialogues as a default operational practice. Abuse, security, legal process, or support troubleshooting may require limited access to <strong>server-side</strong> logs or account records that exist—not to a cloud copy of chat we do not keep as backup.</p>
      <h3>4.7 What we explicitly try <strong>not</strong> to collect as product defaults</h3>
      <p>Subject to what you voluntarily type into chats or send by email:</p>
      <ul>
        <li>We do not require your legal name, street address, or phone number as a condition of reflective dialogue use (payment processors may collect billing details under their own policies);</li>
        <li>We do not seek precise GPS continuous tracking as a core Eastern OS product feature for the unified dialogue;</li>
        <li>We do not operate a behavioral advertising network that monetizes your chat content;</li>
        <li>We do not treat chat history as a sellable data product.</li>
      </ul>
      <p><strong>You control what you type.</strong> Do not enter secrets you are unwilling to transmit for AI generation (passwords, full government ID numbers, others’ private data, etc.).</p>
      <h2>5. Product privacy boundaries</h2>
      <p>Eastern OS is a <strong>unified multi-turn decision dialogue</strong>. It is <strong>not</strong> sold as fortune-telling, destiny prediction, or metaphysics forecasting, and this Policy does not treat “birth &amp; metaphysics inputs” as a special product data category.</p>
      <p>Accounts are part of PASS / billing posture. “Browser-local chat” means we do <strong>not</strong> offer cloud chat backup; it does <strong>not</strong> mean that nothing ever leaves your device for AI generation.</p>
      <h2>6. What leaves your device for AI generation</h2>
      <h3>6.1 Why transmission happens</h3>
      <p>To generate AI-assisted dialogues, reports, path framings, and related outputs, <strong>your inputs and necessary contextual payloads</strong> are sent over <strong>HTTPS</strong> to Eastern OS application backends and/or third-party model providers.</p>
      <p>That transient processing is required for the Service to function. It is <strong>not</strong> described here as Eastern OS maintaining a permanent, user-reopenable cloud archive of your full chat history.</p>
      <h3>6.2 Processors</h3>
      <p>The following providers are used (or may be used) in connection with the Service. The live inventory can change; where a provider’s role ends, we update this Policy.</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Provider</th>
              <th scope="col">Role (high level)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>AI model API</strong></td>
              <td><strong>Anthropic</strong> (Claude API)</td>
              <td>Generation / linguistic processing. See <a href="https://www.anthropic.com/privacy" rel="noopener noreferrer" target="_blank">anthropic.com/privacy</a>.</td>
            </tr>
            <tr>
              <td><strong>AI model API</strong></td>
              <td><strong>DeepSeek</strong></td>
              <td>Generation / contextual processing. See the provider’s published privacy policy.</td>
            </tr>
            <tr>
              <td><strong>Hosting / edge</strong></td>
              <td><strong>Vercel</strong> and/or <strong>Cloudflare</strong></td>
              <td>Application hosting, edge delivery, DDoS / bot mitigation. Standard edge/access logs may briefly include IP ranges, user-agent, URLs.</td>
            </tr>
            <tr>
              <td><strong>Account / database</strong></td>
              <td><strong>Supabase</strong></td>
              <td>Authentication, account and entitlement data storage. Chat cloud backup is not the intended use.</td>
            </tr>
            <tr>
              <td><strong>Email delivery</strong></td>
              <td><strong>Resend</strong></td>
              <td>Transactional / user-initiated email sending.</td>
            </tr>
            <tr>
              <td><strong>Payments</strong></td>
              <td>As actually integrated at launch (name shown at checkout and on your receipt)</td>
              <td>Checkout, subscriptions, seller-of-record functions. See §7.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Additional processors may appear (analytics, error monitoring, etc.). If added, we will update this Policy and Cookie disclosures.</p>
      <h3>6.3 Training / retention claims (conservative)</h3>
      <p>We configure providers, where available, so that customer content is <strong>not</strong> used to train public models and is not retained longer than needed for generation / abuse safety—<strong>to the extent those configurations are actually enabled and contractually supported</strong>.</p>
      <p>We do not promise that every subprocess or future provider will have identical zero-data-retention terms. Provider policies and abuse-review exceptions can change. Prompt/response content that you voluntarily export or email is outside “local-only” expectations once it leaves your browser under your instruction.</p>
      <h2>7. PASS, billing, and payment processing</h2>
      <h3>7.1 What billing data is for</h3>
      <p>We use payment and PASS records to:</p>
      <ul>
        <li>Fulfill PASS entitlements and subscription allotments;</li>
        <li>Apply then-current spend order across PASS balance types (launch posture <strong>carryover → subscription → purchased / flex PASS</strong>, unless a then-current UI / ledger rule expressly states otherwise; confirm live ledger behavior in-product);</li>
        <li>Provide receipts / invoices;</li>
        <li>Prevent fraud and abuse;</li>
        <li>Meet tax, accounting, and legal recordkeeping obligations;</li>
        <li>Handle refunds / disputes per the Refund Policy and processor rules.</li>
      </ul>
      <h3>7.2 Merchant of Record / payment stack</h3>
      <p>Payments are processed through the <strong>payment processor and/or merchant-of-record stack actually integrated at launch</strong> (secure hosted checkout or equivalent).</p>
      <ul>
        <li>Eastern OS does <strong>not</strong> intend to store raw full card Primary Account Numbers on its own servers.</li>
        <li>Your bank / wallet statement or receipt may show the processor or merchant of record as the seller of record.</li>
        <li><strong>The exact name shown at live checkout and on your receipt controls</strong> for that transaction.</li>
        <li>Those providers’ own privacy policies apply to data they collect as independent controllers or as processors, depending on the arrangement.</li>
      </ul>
      <h3>7.3 Unused PASS after cancel / period end</h3>
      <p>Unused PASS expiry and related ledger rules follow the <strong>Terms of Service</strong> and then-current Pricing / ledger rules. Privacy retention of ledger rows follows those commercial rules.</p>
      <h3>7.4 Pricing cross-reference only</h3>
      <p>Illustrative figures (~<strong>$19.99 / 1 PASS</strong>; ~<strong>$59.99/mo · 5 PASS</strong>; new-user first month <strong>+2</strong> when active) are <strong>not</strong> a price list in this Policy. Live Pricing / Terms / checkout control.</p>
      <h2>8. Email: receipts, optional reminders, export</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Email type</th>
              <th scope="col">Purpose</th>
              <th scope="col">Chat backup?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Payment receipt / invoice</strong></td>
              <td>Transaction confirmation, tax/commerce records</td>
              <td><strong>No</strong></td>
            </tr>
            <tr>
              <td><strong>Optional reminder / companion email</strong></td>
              <td>Deliver same-line reminder content if you opt in</td>
              <td><strong>No</strong> (not a full dialogue archive)</td>
            </tr>
            <tr>
              <td><strong>User-initiated export / email</strong></td>
              <td>You ask to send content to yourself or a recipient you designate</td>
              <td>You are intentionally moving content off-device</td>
            </tr>
            <tr>
              <td><strong>Support / privacy correspondence</strong></td>
              <td>Respond to your requests</td>
              <td>N/A</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>We do not use your email for unsolicited brokered marketing lists. Service, billing, security, and policy notices may still be sent where appropriate to operate the account or meet legal duties.</p>
      <p>Opt-out: use unsubscribe links where provided, reminder settings in-product (when available), or email <strong>privacy@easternos.com</strong> / <strong>support@easternos.com</strong>. Transactional receipts and legally required notices may still be sent when necessary.</p>
      <h2>9. How we use information</h2>
      <p>We use personal information to:</p>
      <ol>
        <li>Provide, maintain, and improve the unified decision-dialogue Service;</li>
        <li>Authenticate accounts and protect against fraud / abuse;</li>
        <li>Process payments and manage PASS / subscriptions;</li>
        <li>Generate AI-assisted outputs you request;</li>
        <li>Send receipts, optional reminders, and user-requested exports;</li>
        <li>Respond to support and privacy requests;</li>
        <li>Comply with law, enforce Terms, and protect rights, safety, and security;</li>
        <li>Produce aggregated statistics that do not re-identify your chat history.</li>
      </ol>
      <p><strong>We do not sell your personal information as a business model</strong> in the ordinary consumer sense of selling lists to data brokers. “Share” for CCPA/CPRA purposes is addressed conservatively in §11. If our practices change, we will update this Policy.</p>
      <p>We do <strong>not</strong> use your dialogues to train <em>our own</em> public foundation models. Third-party model training is governed by provider contracts/settings (§6.3).</p>
      <h2>10. Retention</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Data class</th>
              <th scope="col">Intended retention posture</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Browser-local chat / deliverables</strong></td>
              <td>Until <strong>you</strong> clear them, or browser/OS conditions wipe them. We do not operate a server-side chat backup retention clock because we do not hold that backup.</td>
            </tr>
            <tr>
              <td><strong>Account credentials / profile</strong></td>
              <td>For the life of the account, and for a reasonable wind-down after deletion request, subject to legal holds.</td>
            </tr>
            <tr>
              <td><strong>PASS / entitlement ledgers</strong></td>
              <td>As needed to provide the Service and resolve disputes, consistent with Terms / Pricing ledger rules.</td>
            </tr>
            <tr>
              <td><strong>Subscription / billing metadata</strong></td>
              <td>Active subscription life + period needed for renewals, cancellations, refunds, and compliance.</td>
            </tr>
            <tr>
              <td><strong>Payment / tax transaction references</strong></td>
              <td>Commonly retained up to <strong>seven (7) years</strong> (or longer if law requires) for tax/accounting.</td>
            </tr>
            <tr>
              <td><strong>Email send logs / reminder addressing</strong></td>
              <td>Only as needed for delivery, abuse prevention, and your opt-in window.</td>
            </tr>
            <tr>
              <td><strong>Security / edge logs</strong></td>
              <td>Short-lived operational windows typical of hosting providers, unless needed longer for investigations.</td>
            </tr>
            <tr>
              <td><strong>Support tickets you send</strong></td>
              <td>As needed to resolve and for reasonable business records.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Deletion of local chat is under <strong>your</strong> control on-device. Deletion of server-side account/billing records is requested via <strong>privacy@easternos.com</strong> and may be limited where law requires retention (e.g., payment records).</p>
      <h2>11. Your rights and choices</h2>
      <h3>11.1 Controls you already have</h3>
      <ul>
        <li>Clear browser site data / use in-app wipe controls where offered (e.g., “End &amp; Wipe” style actions if present in the then-current UI);</li>
        <li>Export or email content when the product offers those features;</li>
        <li>Cancel subscription via the billing portal / flows described in Terms (or contact support@);</li>
        <li>Opt out of optional reminder email where offered;</li>
        <li>Stop using the Service.</li>
      </ul>
      <h3>11.2 Access, correction, deletion, export (server-side)</h3>
      <p>Subject to verification and applicable law, you may request:</p>
      <ul>
        <li><strong>Access</strong> to personal information we hold about your account on our systems;</li>
        <li><strong>Correction</strong> of inaccurate account/billing personal information;</li>
        <li><strong>Deletion</strong> of personal information we hold, subject to legal retention exceptions (especially payment/tax records);</li>
        <li><strong>Export / portability</strong> of account-held personal information we can reasonably assemble (note: we generally <strong>cannot</strong> re-export chat content we never stored as cloud backup—export local content from your browser features where available).</li>
      </ul>
      <p>Email <strong>privacy@easternos.com</strong>. We may need to verify control of the account/email before acting. We will respond within timeframes required by applicable law (and otherwise aim for a reasonable period).</p>
      <h3>11.3 California / CCPA–CPRA style disclosures</h3>
      <p>If you are a California resident, applicable law may provide rights to know/access, delete, correct, and to non-discrimination for exercising rights, and rights related to “sale” or “sharing” for cross-context behavioral advertising.</p>
      <p><strong>Our posture:</strong></p>
      <ul>
        <li>We <strong>do not sell</strong> personal information for money to data brokers as a business model;</li>
        <li>We do <strong>not</strong> intentionally operate a cross-context behavioral advertising “share” program as the core Service;</li>
        <li>Service providers / processors receive data only to run hosting, auth, AI generation, email, and payments.</li>
      </ul>
      <p>To exercise California rights, email <strong>privacy@easternos.com</strong> with subject <strong>“CCPA Request”</strong> (or “Data Sovereignty Request”). We do not charge discriminatory prices for exercising privacy rights; PASS pricing is commercial product pricing, not a privacy penalty.</p>
      <p><strong>We do not claim</strong> CCPA “certification,” official seal, or completed regulatory audit on this page.</p>
      <h3>11.4 EEA / UK GDPR-style disclosures</h3>
      <p>If GDPR/UK GDPR applies to you, you may have rights of access, rectification, erasure, restriction, objection, and portability, and the right to lodge a complaint with a supervisory authority.</p>
      <p><strong>Possible legal bases</strong> (listed for transparency):</p>
      <ul>
        <li><strong>Contract</strong> — providing the Service you request (account, PASS fulfillment, generation you initiate);</li>
        <li><strong>Legitimate interests</strong> — security, fraud prevention, service improvement via aggregated metrics, limited logs;</li>
        <li><strong>Legal obligation</strong> — tax and accounting retention;</li>
        <li><strong>Consent</strong> — where we rely on consent (e.g., certain optional emails or non-essential cookies), which you may withdraw.</li>
      </ul>
      <p><strong>We do not claim</strong> that Eastern OS has appointed an EU representative, completed a Schrems II transfer impact assessment package, or obtained specific ISO/SOC certifications unless those are separately documented. Cross-border processing is described in §13.</p>
      <p>Contact <strong>privacy@easternos.com</strong> for GDPR-style requests.</p>
      <h3>11.5 Other regions</h3>
      <p>Residents of other jurisdictions may have analogous rights under local law. Contact <strong>privacy@easternos.com</strong>; we will honor mandatory rights that apply to our processing.</p>
      <h2>12. Children (18+)</h2>
      <p>Eastern OS is intended <strong>exclusively for adults aged 18 or older</strong>.</p>
      <p>We do not knowingly collect personal information from children under 18 for PASS purchase or account use. If you believe a minor has provided personal information, contact <strong>privacy@easternos.com</strong> and we will take reasonable steps to delete server-side personal data associated with that use, consistent with law and this Policy.</p>
      <p>Age representations at account creation / purchase are described further in the Terms and Disclaimer.</p>
      <h2>13. International transfers</h2>
      <p>Eastern OS may be operated from, and use infrastructure located in, multiple countries. Personal information may therefore be processed in countries that may have different data-protection laws than your home jurisdiction.</p>
      <p>Where applicable law requires specific transfer mechanisms (for example, standard contractual clauses or other safeguards), we will implement them as appropriate for the operator of the Service and the processors then in use.</p>
      <h2>14. Security (no overclaim)</h2>
      <p>We take reasonable administrative, technical, and organizational measures appropriate to a software service of this type, including:</p>
      <ul>
        <li>HTTPS / TLS for data in transit to our services;</li>
        <li>Access controls for server-side systems;</li>
        <li>Reliance on reputable infrastructure and payment providers for card handling;</li>
        <li>Browser-local storage of chat/deliverables so Eastern OS does not hold a cloud chat backup to steal in a server breach of <em>chat archives we do not keep</em>.</li>
      </ul>
      <p><strong>No method of transmission or storage is 100% secure.</strong> We do <strong>not</strong> warrant:</p>
      <ul>
        <li>Absolute immunity from breach, misuse, or interception;</li>
        <li>That AES-256 applies universally to all local stores (see §3.4);</li>
        <li>That third-party processors will never experience incidents;</li>
        <li>That local device compromise cannot expose browser-stored content.</li>
      </ul>
      <p>Report suspected security issues affecting personal data to <strong>privacy@easternos.com</strong> or <strong>legal@easternos.com</strong>.</p>
      <h2>15. Third-party links and processor policies</h2>
      <p>The Service may link to third-party sites or checkout pages. Their privacy practices are governed by their own policies. Review processor policies (payment, AI, hosting, email) when you use those flows.</p>
      <h2>16. Changes to this Privacy Policy</h2>
      <p>We may revise this Policy to reflect product, vendor, legal, or operational changes. The <strong>Last updated</strong> date at the top marks the current version.</p>
      <p>Material updates may be surfaced via in-app notice, banner, or entry acknowledgment where implemented. Continued use after an update is posted may be treated as acceptance under the Terms. Where law requires fresh consent, we will seek it.</p>
      <h2>17. Contact</h2>
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
              <td>Privacy / data rights</td>
              <td><a href="mailto:privacy@easternos.com">privacy@easternos.com</a></td>
            </tr>
            <tr>
              <td>Legal</td>
              <td><a href="mailto:legal@easternos.com">legal@easternos.com</a></td>
            </tr>
            <tr>
              <td>Support / billing</td>
              <td><a href="mailto:support@easternos.com">support@easternos.com</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Questions about this Policy: email <strong>privacy@easternos.com</strong>. We read privacy requests.</p>
      <h2>18. Relationship to other legal pages</h2>
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
              <td><strong>This Privacy Policy</strong></td>
              <td>Collection, local vs server data, processors, retention, rights, security, transfers.</td>
            </tr>
            <tr>
              <td><strong>Disclaimer</strong></td>
              <td>Product nature, no medical/legal/financial/fortune-telling, sovereignty, crisis, high-level local-session limits.</td>
            </tr>
            <tr>
              <td><strong>Terms of Service</strong></td>
              <td>Account rules, PASS commerce, acceptable use, liability, disputes.</td>
            </tr>
            <tr>
              <td><strong>Refund Policy</strong></td>
              <td>When payments may be refunded vs not (including local data loss).</td>
            </tr>
            <tr>
              <td><strong>Cookie Policy</strong></td>
              <td>Cookies / similar tech details and settings.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>If a technical privacy detail here conflicts with the Disclaimer’s high-level local-session summary, <strong>prefer this Privacy Policy</strong>—and revise the Disclaimer if needed.</p>
      <h2>19. Acknowledgment summary</h2>
      <p>By using Eastern OS, you acknowledge that:</p>
      <ul>
        <li>Chat/deliverables are <strong>browser-local</strong> with real loss risk across browsers, Incognito, and cache clears;</li>
        <li><strong>Accounts</strong> (where used) hold <strong>PASS / billing</strong>, not cloud chat backup;</li>
        <li><strong>AI generation</strong> requires transmitting inputs to processors;</li>
        <li><strong>Receipt email ≠ chat backup</strong>;</li>
        <li>You are <strong>18+</strong>;</li>
        <li>English governs this Policy.</li>
      </ul>
    </LegalPageShell>
  );
}
