import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — pojulife",
  description: "pojulife privacy policy",
};

const privacyArchitectureItems = [
  {
    title: "✦ Your conversations are encrypted on your device.",
    body: 'Not "secured on our servers." Encrypted with AES-256-GCM right in your browser, using a key we never see. Even if our servers were breached, there is nothing to steal.',
    verify:
      "Verify it yourself: open DevTools -> Application -> IndexedDB. You'll see encrypted gibberish, not your words.",
  },
  {
    title: "✦ We have no account system.",
    body: "No email at signup. No password. No phone number. No Google/Apple login. Your device fingerprint is your only ID - a one-way hash we use to restore your paid session, nothing else.",
    verify: "Verify it yourself: nothing to sign up for. Try the free tools right now.",
  },
  {
    title: "✦ Your email is forbidden from living on our servers.",
    body: "If you export your reading as PDF, we ask for your email. We send the PDF. Then we delete your address within 24 hours - physically erased from the database. Even we can't reach you after that.",
    verify: "Your control: one-click unsubscribe. Auto-delete everywhere.",
  },
  {
    title: "✦ Anthropic's Zero Data Retention is enabled.",
    body: "Your conversations go through Claude, but Anthropic doesn't save them, doesn't train on them, and doesn't let humans review them. We pay extra specifically for this guarantee.",
    verify: "Verify it yourself: Anthropic's Zero Data Retention policy is public.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPageShell
      version="Version 1.0"
      title="Privacy Policy"
      updated="Last updated: May 1, 2026"
      intro={
        <p>
          POJULIFE was built differently.
          <br />
          <br />
          Most products talk about &quot;respecting your privacy.&quot; We built a product that doesn&apos;t need your
          data to work.
          <br />
          <br />
          Here&apos;s the full picture.
        </p>
      }
      footer={
        <p>
          Questions? Email <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>. We read every message.
        </p>
      }
    >
      <section id="privacy-architecture" className="legal-architecture">
        <p className="legal-architecture__kicker">How we actually keep our word.</p>
        <h2 className="legal-architecture__title">Privacy isn&apos;t a checkbox. It&apos;s our architecture.</h2>
        {privacyArchitectureItems.map((item) => (
          <article key={item.title} className="legal-architecture__item">
            <p className="legal-architecture__item-title">{item.title}</p>
            <p className="legal-architecture__item-body">{item.body}</p>
            <p className="legal-architecture__verify">{item.verify}</p>
          </article>
        ))}
        <div className="legal-architecture__closing">
          <p>
            We&apos;re not a company that sells data because we don&apos;t collect data. We&apos;re a company that
            sells one thing: a $9.99 conversation that helps you move through what&apos;s stuck. That&apos;s the whole
            business model.
          </p>
          <p>
            If you ever doubt us: every claim on this page can be verified in a minute with your browser&apos;s
            DevTools or public documentation.
          </p>
        </div>
      </section>

      <h2>1. What We Collect</h2>
      <p>Minimal, by design:</p>
      <ul>
        <li>
          <strong>Device fingerprint</strong> (one-way hash) — Used to restore your paid session if you refresh.
        </li>
        <li>
          <strong>Payment records</strong> (no personal info) — Amount, timestamp, payment processor session ID. Kept
          for 7 years for tax compliance.
        </li>
        <li>
          <strong>Email</strong> (only when you explicitly provide it) — Used to deliver PDF readings. Deleted within 24
          hours after sending.
        </li>
        <li>
          <strong>Aggregated usage stats</strong> (anonymous) — Total sessions, not per-user behavior.
        </li>
      </ul>

      <h2>2. What We Don&apos;t Collect</h2>
      <p>What stays off our servers:</p>
      <ul>
        <li>Your conversations (lives encrypted on your device only)</li>
        <li>Your name, address, phone number (never asked)</li>
        <li>Your precise location (only country from GeoIP)</li>
        <li>Your behavioral tracking across websites</li>
        <li>Cookies for advertising</li>
        <li>IP addresses (Cloudflare/Vercel may log briefly)</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>Device fingerprint: fraud prevention and session restoration only</li>
        <li>Payment records: tax compliance (required by law)</li>
        <li>Email: deliver PDF readings only, then deleted</li>
        <li>Aggregate stats: improve product</li>
      </ul>
      <p>We NEVER:</p>
      <ul>
        <li>Sell your data</li>
        <li>Use your data for advertising</li>
        <li>Share your data with marketing partners</li>
        <li>Use your conversations to train AI models</li>
      </ul>

      <h2>4. Data Encryption</h2>
      <ul>
        <li>Conversations on your device: AES-256-GCM encryption</li>
        <li>Encryption key: generated on your device, never sent to us</li>
        <li>Transmission: HTTPS only (TLS 1.2+)</li>
        <li>Payment: handled by our payment processor (PCI DSS compliant)</li>
      </ul>
      <p>Even if our servers were breached, there are no conversations to steal.</p>

      <h2>5. Data Deletion</h2>
      <ul>
        <li>Your local data: clear your browser OR click &quot;End &amp; Wipe&quot;</li>
        <li>Email: physically deleted within 24 hours after delivery</li>
        <li>Device fingerprint: auto-deleted after 365 days of inactivity</li>
        <li>Payment records: kept 7 years (tax requirement), then deleted</li>
      </ul>
      <p>
        You can request immediate deletion of all server-side data associated with your device by emailing{" "}
        <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>.
      </p>

      <h2>6. Third-Party Services</h2>
      <p>Services we rely on today and how they handle data:</p>
      <ul>
        <li>
          <strong>Anthropic (Claude API)</strong> — AI processing. Zero Data Retention is enabled for our use; they do
          not retain your conversations for training. Privacy:{" "}
          <a href="https://www.anthropic.com/privacy" rel="noopener noreferrer" target="_blank">
            anthropic.com/privacy
          </a>
        </li>
        <li>
          <strong>Our payment processor (DodoPayments)</strong> — Processes payments; we never see your full card details.
          See the processor&apos;s terms and privacy notice at checkout.
        </li>
        <li>
          <strong>Vercel</strong> — Hosting and edge delivery. Standard server logs may include IP and user agent. Privacy:{" "}
          <a href="https://vercel.com/legal/privacy-policy" rel="noopener noreferrer" target="_blank">
            vercel.com/legal/privacy-policy
          </a>
        </li>
        <li>
          <strong>Transactional email</strong> — When we send PDFs or essential service email, messages pass through a
          provider we select for delivery only; content is not used for marketing.
        </li>
      </ul>

      <h2>7. AI Model Data Handling</h2>
      <p>
        To meet quality requirements, POJULIFE may call upon AI models from leading providers including
        Anthropic&apos;s Claude, OpenAI&apos;s GPT, and Google&apos;s Gemini.
      </p>

      <h3>What this means for your data</h3>
      <p>
        While POJULIFE does not store your conversations (they live encrypted on your device), your inputs are
        transmitted to these AI providers for processing. This is unavoidable — the AI cannot generate responses without
        receiving your inputs.
      </p>

      <h3>How we minimize this</h3>
      <ul>
        <li>
          <strong>Zero Data Retention (ZDR)</strong> is enabled where supported. This is a paid contractual guarantee
          that the provider does not save your API requests or responses, does not use them for training, and does not
          allow human review.
        </li>
        <li>
          <strong>No training on your data</strong>: We have opted out of any data sharing for AI model training across
          all providers we use.
        </li>
        <li>
          <strong>Minimum data principle</strong>: We send only what&apos;s needed for the specific task. Your name,
          email, and other personal identifiers are never sent to AI providers.
        </li>
      </ul>

      <h3>Third-party privacy policies</h3>
      <p>
        When POJULIFE uses an AI provider&apos;s service, that provider&apos;s privacy policy applies to the API
        transaction:
      </p>
      <ul>
        <li>
          Anthropic Privacy Policy:{" "}
          <a href="https://www.anthropic.com/privacy" rel="noopener noreferrer" target="_blank">
            https://www.anthropic.com/privacy
          </a>
        </li>
        <li>
          OpenAI Privacy Policy:{" "}
          <a href="https://openai.com/privacy/" rel="noopener noreferrer" target="_blank">
            https://openai.com/privacy/
          </a>
        </li>
        <li>
          Google Privacy Policy:{" "}
          <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">
            https://policies.google.com/privacy
          </a>
        </li>
      </ul>

      <h2>8. Children&apos;s Privacy</h2>
      <p>POJULIFE is not intended for users under 18.</p>
      <p>
        We do not knowingly collect data from minors. If you believe a minor has used POJULIFE, contact{" "}
        <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a> and we&apos;ll delete any associated data
        immediately.
      </p>

      <h2>9. Your Rights (California Residents)</h2>
      <p>As a California resident, you have the right to:</p>
      <ul>
        <li>Know what personal information we collect, use, disclose</li>
        <li>Delete personal information we hold about you</li>
        <li>Opt out of the &quot;sale&quot; of personal information (We don&apos;t sell data, so this is automatic)</li>
        <li>Non-discrimination for exercising your rights</li>
      </ul>
      <p>
        To exercise any of these rights, email <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a> with
        &quot;CCPA Request&quot; in the subject line.
      </p>

      <h2>10. GDPR Specific (EU Residents)</h2>
      <p>If you&apos;re in the EU, you also have:</p>
      <ul>
        <li>Right to access your personal data</li>
        <li>Right to rectification (correct inaccurate data)</li>
        <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
        <li>Right to data portability</li>
        <li>Right to withdraw consent</li>
        <li>Right to object to processing</li>
      </ul>
      <p>Legal basis for processing:</p>
      <ul>
        <li>Contract (providing the service you paid for)</li>
        <li>Legitimate interest (fraud prevention)</li>
      </ul>
      <p>
        Data Protection Officer: <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>
      </p>

      <h2>11. Contact</h2>
      <p>
        <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a> (privacy) ·{" "}
        <a href="mailto:support@pojulife.com">support@pojulife.com</a> (support) ·{" "}
        <a href="mailto:legal@pojulife.com">legal@pojulife.com</a> (legal)
      </p>

      <h2>12. Updates to This Policy</h2>
      <p>When we update this policy, we&apos;ll:</p>
      <ul>
        <li>Notify users via in-app banner on next visit</li>
        <li>Continued use after update = acceptance</li>
        <li>Major changes (new data collection, etc.) require re-agreement</li>
      </ul>
    </LegalPageShell>
  );
}
