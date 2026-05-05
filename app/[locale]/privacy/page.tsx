import type { Metadata } from "next";

import { StationeryPaperPanel } from "@/components/marketing/stationery-paper-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — POJU",
  description: "POJU privacy policy",
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
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <section className="prose prose-invert prose-lg mx-auto mt-2 max-w-4xl rounded-2xl border border-white/10 bg-black/25 px-5 py-8 text-text-secondary prose-headings:text-text-primary prose-a:text-purple-vivid sm:px-7 md:px-10">
          <p className="text-center text-xs uppercase tracking-[0.16em] text-text-dim not-prose">Version 1.0</p>
          <h1 className="mt-3 text-center text-text-primary not-prose text-[28px] font-semibold sm:text-[34px]">
            Privacy Policy
          </h1>
          <p className="text-center text-sm text-text-dim not-prose">Last updated: October 30, 2025</p>

          <p className="mt-6 text-center not-prose">
            POJU was built differently.
            <br />
            <br />
            Most products talk about &quot;respecting your privacy.&quot; We built a product that doesn&apos;t need your
            data to work.
            <br />
            <br />
            Here&apos;s the full picture.
          </p>

          <section id="privacy-architecture" className="not-prose mx-auto mt-10 max-w-3xl scroll-mt-24 px-1">
            <StationeryPaperPanel>
              <p className="poju-kicker">How we actually keep our word.</p>
              <h2 className="mt-3 max-w-3xl text-xl font-semibold leading-snug text-text-primary sm:text-2xl">
                Privacy isn&apos;t a checkbox. It&apos;s our architecture.
              </h2>
              <div className="mt-8 max-w-3xl space-y-10">
                {privacyArchitectureItems.map((item) => (
                  <article key={item.title}>
                    <p className="font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">{item.body}</p>
                    <p className="mt-2 text-xs italic leading-relaxed text-text-dim">{item.verify}</p>
                  </article>
                ))}
              </div>
              <div className="mt-10 max-w-2xl space-y-4 text-sm leading-7 text-text-secondary">
                <p className="text-pretty hyphens-manual">
                  We&apos;re not a company that sells data because we don&apos;t collect data. We&apos;re a company that
                  sells one thing: a $9.99 conversation that helps you move through what&apos;s stuck. That&apos;s the whole{" "}
                  <span className="whitespace-nowrap">business model.</span>
                </p>
                <p>
                  If you ever doubt us: every claim on this page can be verified in a minute with your browser&apos;s
                  DevTools or public documentation.
                </p>
              </div>
            </StationeryPaperPanel>
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
              <strong>Email</strong> (only when you explicitly provide it) — Used to deliver PDF readings and one check-in
              email. Deleted within 24 hours after sending.
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
            <li>Email: send PDF + optional check-in, then deleted</li>
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
          <p>Services we use and their privacy policies:</p>
          <ul>
            <li>
              Anthropic (Claude API) — AI processing. Zero Data Retention enabled — they don&apos;t save your
              conversations. Privacy:{" "}
              <a href="https://www.anthropic.com/privacy" rel="noopener noreferrer" target="_blank">
                anthropic.com/privacy
              </a>
            </li>
            <li>
              OpenAI — Used ONLY for embedding (converting knowledge base to vectors). Your conversations never go to
              OpenAI. Privacy:{" "}
              <a href="https://openai.com/privacy/" rel="noopener noreferrer" target="_blank">
                openai.com/privacy
              </a>
            </li>
            <li>
              ElevenLabs — Text-to-speech for reading aloud. Optional, user-initiated. Privacy:{" "}
              <a href="https://elevenlabs.io/privacy" rel="noopener noreferrer" target="_blank">
                elevenlabs.io/privacy
              </a>
            </li>
            <li>
              DodoPayments — Payment processing. They handle your payment method. (Stripe is planned as we grow.) Privacy:
              refer to DodoPayments&apos; published policy at checkout.
            </li>
            <li>
              Resend — Email delivery. Auto-deletes messages after 30 days. Privacy:{" "}
              <a href="https://resend.com/legal/privacy-policy" rel="noopener noreferrer" target="_blank">
                resend.com/legal/privacy-policy
              </a>
            </li>
            <li>
              Vercel — Hosting. Standard web server logs (IP, user agent, URL). Privacy:{" "}
              <a href="https://vercel.com/legal/privacy-policy" rel="noopener noreferrer" target="_blank">
                vercel.com/legal/privacy-policy
              </a>
            </li>
            <li>
              Supabase — Database (for payment records + knowledge base). Privacy:{" "}
              <a href="https://supabase.com/privacy" rel="noopener noreferrer" target="_blank">
                supabase.com/privacy
              </a>
            </li>
            <li>FingerprintJS (OSS version) — Device identification. Runs entirely on your device. No data sent to FingerprintJS servers (OSS version).</li>
          </ul>

          <h2>7. AI Model Data Handling</h2>
          <p>Your conversations are sent to Anthropic for processing by Claude. We&apos;ve specifically enabled:</p>
          <ul>
            <li>
              Zero Data Retention (ZDR) — Anthropic does not keep your API requests or responses.
            </li>
            <li>No training on your data — Your conversations are not used to improve Claude.</li>
            <li>
              No human review — Unless you explicitly flag content for abuse, no Anthropic employee will see your
              conversations.
            </li>
          </ul>
          <p>This guarantee is contractual — we pay extra for ZDR.</p>

          <h2>8. Children&apos;s Privacy</h2>
          <p>POJU is not intended for users under 18.</p>
          <p>
            We do not knowingly collect data from minors. If you believe a minor has used POJU, contact{" "}
            <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a> and we&apos;ll delete any associated data
            immediately.
          </p>

          <h2>9. Your Rights (US — California Residents)</h2>
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
            For privacy questions: <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>
            <br />
            For general questions: <a href="mailto:support@pojulife.com">support@pojulife.com</a>
            <br />
            For legal matters: <a href="mailto:legal@pojulife.com">legal@pojulife.com</a>
          </p>

          <h2>12. Updates to This Policy</h2>
          <p>When we update this policy, we&apos;ll:</p>
          <ul>
            <li>Notify users via in-app banner on next visit</li>
            <li>Continued use after update = acceptance</li>
            <li>Major changes (new data collection, etc.) require re-agreement</li>
          </ul>

          <p className="not-prose mt-8 text-center text-[14px] leading-7 text-text-secondary sm:text-[15px]">
            Questions? Email <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>. We read every message.
          </p>
        </section>
      </div>
    </main>
  );
}
