import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Disclaimer — Eastern OS",
  description: "Eastern OS Disclaimer & Sovereignty Architecture — Version 1.0",
};

export default function DisclaimerPage() {
  return (
    <LegalPageShell
      version="Version 1.0 (first public launch baseline)"
      title="Disclaimer & Sovereignty Architecture"
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
      <h2>Purpose of this page</h2>
      <p>This Disclaimer &amp; Sovereignty Architecture explains, in plain English:</p>
      <ol>
        <li>What Eastern OS <strong>is</strong> and what it <strong>is not</strong>;</li>
        <li>The professional, predictive, and clinical boundaries of the Service;</li>
        <li>How AI-assisted outputs relate to <strong>your</strong> judgment and responsibility;</li>
        <li>High-level limits of session persistence (browser-local chat / deliverables);</li>
        <li>Age requirements and crisis resources;</li>
        <li>A conservative limitation-of-liability posture; and</li>
        <li>How this page relates to the <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and <strong>Refund Policy</strong>.</li>
      </ol>
      <p>By accessing, browsing, creating an account, purchasing a PASS, starting a dialogue, or otherwise using Eastern OS, you acknowledge that you have read this Disclaimer and understand that the Service is a <strong>reflective decision-support dialogue product</strong>, not professional advice, not a clinic, and not fortune-telling.</p>
      <p>Related footer policies you should also read:</p>
      <ul>
        <li><Link href="/terms">Terms of Service</Link></li>
        <li><Link href="/privacy">Privacy Policy</Link></li>
        <li><Link href="/refund">Refund Policy</Link></li>
        <li><Link href="/cookies">Cookie Settings</Link></li>
      </ul>
      <p>Commercial pricing, billing mechanics, and entitlements are governed by the <strong>Terms of Service</strong> and the site <strong>Pricing</strong> materials as published at the time of purchase—not by this Disclaimer. This page may mention PASS packaging only for context.</p>
      <h2>1. What Eastern OS is</h2>
      <p><strong>Eastern OS</strong> (easternos.com) is a <strong>unified multi-turn decision dialogue</strong> product. It is designed to help adults think more clearly about situations they bring into the conversation—through structured dialogue, reflective framing, and written deliverables grounded in <strong>cultural and historical Eastern decision-wisdom traditions</strong> used as <strong>analytical lenses</strong>, together with modern systems-thinking and behavioral-science style reasoning.</p>
      <h3>1.1 One unified product</h3>
      <p>Eastern OS is presented and sold as <strong>one unified Service</strong>—a multi-turn decision dialogue experience—not as a bundle of separately marketed modules.</p>
      <h3>1.2 What one PASS is intended to provide</h3>
      <p>For product clarity (and without replacing the Terms or Pricing page):</p>
      <p><strong>1 PASS</strong> is intended to unlock, as a <strong>bundled entitlement provided together</strong>:</p>
      <ol>
        <li>A <strong>multi-turn decision dialogue</strong>;</li>
        <li><strong>Main path + backup</strong> framing within the dialogue / deliverable flow (same product language as the landing page); and</li>
        <li>A <strong>report</strong> (structured written deliverable); and</li>
        <li><strong>30-day daily same-line reminders</strong> associated with that line of work.</li>
      </ol>
      <p>Exact packaging, eligibility, reminder delivery channels (in-product vs. optional email), and any new-user promotions are defined in the <strong>Terms</strong> / <strong>Pricing</strong> materials current at purchase. Illustrative commercial awareness only (not a price list; prices may change):</p>
      <ul>
        <li>One-time purchase on the order of <strong>USD $19.99 per 1 PASS</strong>;</li>
        <li>Subscription on the order of <strong>USD $59.99 per month for 5 PASS</strong>, with a <strong>new-user first-month +2 PASS</strong> promotion when that promotion is active.</li>
      </ul>
      <p><strong>Always confirm live prices and entitlements on Pricing / at checkout.</strong> This Disclaimer does <strong>not</strong> hardcode a permanent price schedule.</p>
      <h3>1.3 Intended use</h3>
      <p>The Service is intended for:</p>
      <ul>
        <li>Personal reflection and structured self-inquiry;</li>
        <li>Decision framing and clarifying options, constraints, and tradeoffs;</li>
        <li>Intellectual journaling and situational analysis based on <strong>your</strong> inputs;</li>
        <li>Optional retention of outputs via <strong>user-initiated export or email</strong>, where offered.</li>
      </ul>
      <h2>2. What Eastern OS is not</h2>
      <p>Eastern OS, its operators, interfaces, prompts, reports, reminders, and AI-assisted outputs <strong>do not</strong> constitute, and must not be treated as:</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Exclusion</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Clinic / healthcare</strong></td>
              <td>Not a hospital, clinic, telehealth service, or medical device.</td>
            </tr>
            <tr>
              <td><strong>Mental-health practice</strong></td>
              <td>Not therapy, psychiatry, counseling, crisis intervention, or clinical assessment.</td>
            </tr>
            <tr>
              <td><strong>Law firm</strong></td>
              <td>Not legal counsel, statutory interpretation, or representation.</td>
            </tr>
            <tr>
              <td><strong>Financial / investment firm</strong></td>
              <td>Not a broker-dealer, investment adviser, tax adviser, or fiduciary.</td>
            </tr>
            <tr>
              <td><strong>Fortune-teller / occult service</strong></td>
              <td>Not divination, destiny prediction, supernatural insight, or metaphysical fate claims.</td>
            </tr>
            <tr>
              <td><strong>Emergency service</strong></td>
              <td>Not equipped to manage psychological or medical emergencies.</td>
            </tr>
            <tr>
              <td><strong>Substitute for human judgment</strong></td>
              <td>Outputs are conceptual lenses—not orders, diagnoses, verdicts, or guaranteed outcomes.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>If your situation requires licensed professional help, <strong>stop using the Service for that purpose</strong> and consult an appropriately licensed professional in your jurisdiction.</p>
      <h2>3. No medical, mental health, legal, or financial advice</h2>
      <h3>3.1 Medical advice — not provided</h3>
      <p>Eastern OS does <strong>not</strong> diagnose, treat, cure, prevent, or mitigate any medical, physiological, or biological condition. Do not use outputs in place of a licensed physician, nurse practitioner, or other qualified clinician. Do not delay seeking medical care because of anything you read in a dialogue, report, or reminder.</p>
      <h3>3.2 Mental health care — not provided</h3>
      <p>Eastern OS is <strong>not</strong> a licensed therapist, psychiatrist, clinical psychologist, counselor, or crisis line. The Service is <strong>not</strong> a substitute for professional mental health care, psychotherapy, medication management, or emergency intervention. Keep expectations <strong>non-clinical</strong>: reflective wording about stress, relationships, or life choices is <strong>not</strong> assessment, diagnosis, or treatment.</p>
      <h3>3.3 Legal advice — not provided</h3>
      <p>Eastern OS does <strong>not</strong> provide legal advice, jurisdictional analysis, contract drafting, immigration guidance, or litigation strategy. For legal matters, consult a licensed attorney authorized in the relevant jurisdiction.</p>
      <h3>3.4 Financial / investment / tax advice — not provided</h3>
      <p>Eastern OS does <strong>not</strong> provide investment recommendations, trading signals, portfolio allocation, tax planning, accounting advice, or fiduciary guidance. For financial decisions, consult a qualified, licensed adviser appropriate to your situation.</p>
      <h3>3.5 Relationship / life-coaching boundaries</h3>
      <p>Even where the dialogue discusses relationships, career, timing, or personal strategy, outputs remain <strong>non-professional reflective framing</strong>. They are <strong>not</strong> couples therapy, HR advice, immigration advice, or guaranteed “life coaching” outcomes.</p>
      <h2>4. No divination, destiny prediction, or scare claims</h2>
      <p>Eastern OS may draw on <strong>cultural and historical “Eastern decision wisdom”</strong> (for example, classical change-philosophy, structural/archetypal metaphors, or systems metaphors historically associated with texts such as the <em>I Ching</em> / Book of Changes and related traditions). When such framing appears, it is used as an <strong>analytical vocabulary</strong> for mapping options, tensions, timing awareness, and self-reflection—<strong>analogous</strong> to how some coaching or strategy tools borrow archetypes or classical strategy metaphors.</p>
      <p>Eastern OS expressly <strong>does not</strong>:</p>
      <ul>
        <li>Claim to <strong>predict</strong> your destiny, fate, or inevitable future events;</li>
        <li>Offer <strong>fortune-telling</strong>, occult revelation, supernatural insight, or mystical forecasting;</li>
        <li>Run a <strong>divination</strong> workflow sold as “casting lots,” “reading fate,” or “revealing what will happen”;</li>
        <li>Issue <strong>scare</strong>, fear-harvest, or “pay to remove doom” claims;</li>
        <li>Guarantee that any path, reminder, or report will produce a particular real-world outcome.</li>
      </ul>
      <p>References to traditional symbols, elemental metaphors, “currents,” timing language, or similar vocabulary—if present—are <strong>figurative / analytical</strong>, not deterministic prophecy.</p>
      <p>Any mention of research, psychology, or “science” is <strong>informational context only</strong>. Eastern OS does <strong>not</strong> claim that traditional frameworks have been clinically or scientifically “proven” as predictive systems.</p>
      <p>Eastern OS is <strong>not</strong> a religious organization and does not require adherence to any religion. Cultural–philosophical framing is not religious instruction.</p>
      <h2>5. AI-assisted nature — human judgment required</h2>
      <h3>5.1 Automated generation</h3>
      <p>Dialogues, reports, path framings, and reminders are produced with <strong>automated artificial intelligence / large-language-model pipelines</strong> (and related software). The Service does <strong>not</strong> possess human consciousness, professional licensure, or guaranteed empirical knowledge of your private life beyond what you input and what the system transiently processes to generate a response.</p>
      <h3>5.2 Probabilistic, imperfect outputs</h3>
      <p>You acknowledge that AI-assisted outputs:</p>
      <ul>
        <li>Are <strong>probabilistic</strong> and <strong>non-deterministic</strong>;</li>
        <li>May contain <strong>errors</strong>, omissions, inconsistencies, outdated assumptions, or misleading phrasing;</li>
        <li>May reflect patterns in training data rather than verified facts about you;</li>
        <li>Are <strong>not</strong> absolute truth, certified expertise, or a complete analysis of all relevant variables.</li>
      </ul>
      <h3>5.3 Critical evaluation is mandatory</h3>
      <p><strong>You must critically evaluate every output before acting.</strong> Do not treat Eastern OS as an authority that overrides your reason, values, loved ones, or licensed professionals. If an output conflicts with professional advice you have received, prefer the licensed professional unless and until you obtain updated professional guidance.</p>
      <h3>5.4 Inputs you should not rely on the Service to handle safely</h3>
      <p>Do not use Eastern OS as your sole channel for emergencies, abuse situations, active self-harm planning, or situations requiring immediate human intervention. See <strong>Crisis resources</strong> below.</p>
      <h2>6. Sovereignty architecture — your responsibility for decisions</h2>
      <p><strong>Sovereignty</strong>, as used on this page, means: <strong>you remain the decision-maker.</strong></p>
      <p>You—not Eastern OS, not the AI providers, not the operators—retain <strong>exclusive responsibility</strong> for:</p>
      <ul>
        <li>How you interpret dialogues, reports, main path + backup framing, and reminders;</li>
        <li>Whether you act, wait, escalate to professionals, or disregard an output;</li>
        <li>Decisions affecting health, relationships, money, legal status, employment, immigration, safety, or any other consequential domain;</li>
        <li>Verifying facts, dates, numbers, and assumptions before relying on them.</li>
      </ul>
      <p>Engagement with Eastern OS is <strong>voluntary</strong>. Outputs are tools for reflection. <strong>Using the Service does not transfer responsibility</strong> for your life outcomes to Eastern OS or its operators.</p>
      <p>If you are dissatisfied with an output’s style, tone, framing, or usefulness, your remedies for commercial issues are described in the <strong>Refund Policy</strong> and <strong>Terms of Service</strong>; dissatisfaction with reflective content alone is not a professional-malpractice claim against a non-professional product.</p>
      <h2>7. Local session data and limits of persistence (high-level)</h2>
      <p>This section is a <strong>high-level product disclosure</strong>. Detailed data practices live in the <strong><Link href="/privacy">Privacy Policy</Link></strong>. If anything here conflicts with the Privacy Policy on a technical privacy point, prefer the Privacy Policy.</p>
      <h3>7.1 Chat / session content: browser-local by design</h3>
      <p>Under the current product design:</p>
      <ul>
        <li><strong>Dialogue / chat content and related in-browser deliverables</strong> are intended to remain <strong>local to the browser/device session context</strong> in which you use them;</li>
        <li><strong>Accounts</strong> (where used) are intended to hold <strong>PASS balances, billing/subscription state, and related account records</strong>—<strong>not</strong> a cloud archive of your full chat history as the primary store;</li>
        <li>Content is <strong>not</strong> described here as synced across devices via your account as a chat backup.</li>
      </ul>
      <h3>7.2 What can make local content disappear</h3>
      <p>Because chat/deliverables are browser-local, they may be <strong>permanently lost</strong> if, for example, you:</p>
      <ul>
        <li>Clear site data / cache / IndexedDB / local storage;</li>
        <li>Use or close an <strong>Incognito / Private</strong> window;</li>
        <li>Switch browsers or devices;</li>
        <li>Uninstall a PWA / clear app storage;</li>
        <li>Use aggressive privacy extensions that wipe storage.</li>
      </ul>
      <p><strong>Eastern OS does not promise server-side recovery of lost local chat logs.</strong> Loss of local session content is <strong>not</strong>, by itself, a basis for PASS refunds except as the <strong>Refund Policy</strong> separately allows for verified technical delivery failures.</p>
      <h3>7.3 Export / email for <em>your</em> retention</h3>
      <p>Where the product offers <strong>export</strong> or <strong>email</strong> of reports or companion materials, that is a <strong>user-initiated retention / delivery</strong> feature—not an automatic cloud chat backup of the entire dialogue.</p>
      <p><strong>Receipt email ≠ chat backup.</strong> A payment receipt, invoice, or billing email does <strong>not</strong> store or restore your dialogue history.</p>
      <p>Optional reminder email (if you opt in) is for delivering reminder content under the companion window rules described in Privacy/Terms—not a promise that the full chat lives in your inbox forever.</p>
      <h3>7.4 Transient processing to generate responses</h3>
      <p>To generate AI-assisted replies, your inputs are transmitted securely to processing pipelines as described in the Privacy Policy. That transient processing for generation is <strong>not</strong> the same as Eastern OS maintaining a permanent cloud copy of your chat for you to re-open everywhere. See Privacy for processor details, retention claims, and your rights.</p>
      <h3>7.5 No refunds for local data loss (commercial cross-ref)</h3>
      <p>Accidental or user-caused loss of browser-local content does not automatically entitle you to free PASS restoration. See <strong>Refund Policy</strong> and <strong>Terms</strong>.</p>
      <h2>8. Age restriction (18+)</h2>
      <p>Eastern OS is intended <strong>exclusively for adults aged 18 or older</strong>.</p>
      <p>By using the Service, purchasing a PASS, or creating an account, you represent that you are <strong>at least 18 years of age</strong>. We do not knowingly facilitate paid sessions for minors.</p>
      <p>If you believe a minor has accessed the Service, contact <strong>privacy@easternos.com</strong> promptly so we can take reasonable steps consistent with the Privacy Policy and applicable law.</p>
      <h2>9. Crisis resources</h2>
      <p><strong>Eastern OS is not a crisis service.</strong> It cannot dispatch help, monitor your safety, or replace emergency responders.</p>
      <p>If you are experiencing suicidal ideation, self-harm urges, acute emotional distress, domestic violence, or any medical or psychological emergency:</p>
      <ol>
        <li><strong>Stop using Eastern OS for that crisis</strong>;</li>
        <li>Contact local emergency services if you are in immediate danger;</li>
        <li>Use a certified human crisis line.</li>
      </ol>
      <h3>Primary (North America)</h3>
      <ul>
        <li><strong>United States:</strong> Call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline)</li>
        <li><strong>Canada:</strong> Call or text <strong>988</strong> (Suicide Crisis Helpline)</li>
      </ul>
      <h3>Additional helplines (verify locally; numbers can change)</h3>
      <ul>
        <li><strong>United Kingdom:</strong> Call <strong>116 123</strong> (Samaritans)</li>
        <li><strong>European Union:</strong> Call <strong>112</strong> or your local emergency number</li>
        <li><strong>Global directory:</strong> <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">https://findahelpline.com</a></li>
      </ul>
      <p>These numbers can change; confirm what works in <strong>your</strong> location. This page prioritizes <strong>988</strong> for US/CA and lists additional publicly known helplines for convenience only.</p>
      <h2>10. No warranty</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, EASTERN OS AND ALL RELATED OUTPUTS ARE PROVIDED <strong>“AS IS”</strong> AND <strong>“AS AVAILABLE,”</strong> WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY—INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>
      <p>We do not warrant that:</p>
      <ul>
        <li>Outputs will be accurate, complete, current, or error-free;</li>
        <li>The Service will be uninterrupted, secure, or available at any particular time;</li>
        <li>Defects will be corrected;</li>
        <li>The Service will meet your personal or professional requirements;</li>
        <li>Reminders will arrive on any particular schedule across all devices, email providers, or notification settings.</li>
      </ul>
      <p>Some jurisdictions do not allow certain warranty disclaimers. Where mandatory consumer protections apply, those protections remain available to the extent they cannot be waived.</p>
      <h2>11. Limitation of liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, EASTERN OS, ITS OPERATORS AS IDENTIFIED ON THIS SITE AND IN THE TERMS OF SERVICE OR PRIVACY POLICY, AND ITS INFRASTRUCTURE AND AI PROCESSING PARTNERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, BUSINESS OPPORTUNITY, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF—OR INABILITY TO USE—THE SERVICE, WHETHER BASED IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
      <p>Without limiting the foregoing, this includes claims related to:</p>
      <ul>
        <li>Decisions you make after reading dialogues, reports, paths, or reminders;</li>
        <li>Relationship, career, financial, academic, or relocation outcomes;</li>
        <li>Emotional distress;</li>
        <li>Local data loss (browser clear, device switch, Incognito, etc.);</li>
        <li>Third-party AI processor behavior, outages, or content quality;</li>
        <li>Payment-processor or merchant-of-record operational issues (as applicable under Terms).</li>
      </ul>
      <p><strong>Exclusive remedy.</strong> Your sole and exclusive remedy for dissatisfaction with the software, outputs, or availability—subject to mandatory law and the Refund Policy—is to <strong>stop using the Service</strong>. Transaction-specific remedies (if any) are governed by the <strong><Link href="/refund">Refund Policy</Link></strong> and <strong><Link href="/terms">Terms of Service</Link></strong>.</p>
      <p><strong>Liability cap.</strong> Any aggregate liability caps stated in the Terms of Service (for example, a cap keyed to amounts you paid in a lookback period) are intended to apply to disputes arising from the Service; this Disclaimer does not invent a separate dollar cap. If Terms and this Disclaimer conflict on liability mechanics, treat the <strong>Terms</strong> as the commercial contract and this page as the product-boundary disclosure.</p>
      <p><strong>Mandatory law.</strong> Nothing in this Disclaimer excludes liability that cannot be excluded under applicable law (including liability for death or personal injury caused by negligence where such exclusion is prohibited, or other non-waivable consumer rights).</p>
      <h2>12. Relationship to Terms, Privacy, Refund, and Cookies</h2>
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
              <td><strong>This Disclaimer</strong></td>
              <td>Product nature, professional exclusions, non-predictive posture, sovereignty/responsibility, crisis, high-level local-session limits, liability posture.</td>
            </tr>
            <tr>
              <td><strong>Terms of Service</strong></td>
              <td>Account rules, PASS/subscription commerce, acceptable use, IP, liability caps, dispute mechanics.</td>
            </tr>
            <tr>
              <td><strong>Privacy Policy</strong></td>
              <td>What is collected, what stays local, processors, retention, deletion rights.</td>
            </tr>
            <tr>
              <td><strong>Refund Policy</strong></td>
              <td>When payments may be refunded (e.g., verified technical failure) vs. not (e.g., dislike of AI framing; local data loss).</td>
            </tr>
            <tr>
              <td><strong>Cookie Settings</strong></td>
              <td>Browser cookie / similar-tech preferences on the site.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>If you do not agree to the Terms, Privacy Policy, Refund Policy, or this Disclaimer, <strong>do not use Eastern OS</strong>.</p>
      <p>Entry modal themes (tools framing, professional exclusions, crisis, local storage risk, 18+) are a <strong>summary</strong>. This page is the fuller Disclaimer &amp; Sovereignty Architecture text linked from that modal (“Read the full Disclaimer &amp; Sovereignty Architecture”).</p>
      <h2>13. Changes to this Disclaimer</h2>
      <p>We may revise this Disclaimer to reflect product changes, regulatory expectations, payment-gateway requirements, or legal guidance. The <strong>Last updated</strong> date at the top marks the current version.</p>
      <p>Material updates may be surfaced via the site entry acknowledgment / disclaimer version gate (where implemented). Continued use after an update is posted may be treated as acceptance under the Terms.</p>
      <h2>14. Contact (legal / privacy / support)</h2>
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
              <td><strong>Legal &amp; regulatory</strong></td>
              <td><a href="mailto:legal@easternos.com">legal@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Privacy / data requests</strong></td>
              <td><a href="mailto:privacy@easternos.com">privacy@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Operational &amp; technical support / billing</strong></td>
              <td><a href="mailto:support@easternos.com">support@easternos.com</a></td>
            </tr>
            <tr>
              <td><strong>Contact hub</strong></td>
              <td><a href="https://www.easternos.com/contact" rel="noopener noreferrer" target="_blank">https://www.easternos.com/contact</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>For privacy erasure or access-style requests, use <strong>privacy@easternos.com</strong> (the Privacy Policy references a “Data Sovereignty Request” subject convention).</p>
      <h2>15. Acknowledgment</h2>
      <p>By using Eastern OS, you acknowledge that you have read and understood this Disclaimer &amp; Sovereignty Architecture, including that:</p>
      <ul>
        <li>Eastern OS is a <strong>unified decision dialogue</strong> product, not a clinic, law firm, broker, or fortune-teller;</li>
        <li>Outputs are <strong>AI-assisted</strong> and require <strong>your</strong> critical judgment;</li>
        <li><strong>You</strong> remain responsible for your decisions;</li>
        <li>Chat/deliverables are <strong>browser-local</strong> with real loss risk;</li>
        <li>You are <strong>18+</strong>; and</li>
        <li>Crisis situations require <strong>human emergency resources</strong>, not this app.</li>
      </ul>
    </LegalPageShell>
  );
}
