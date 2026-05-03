import Link from "next/link";
import { Suspense } from "react"; // 新增：导入 Suspense
import type { Metadata } from "next";

import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { MarketingLocaleProvider } from "@/components/marketing/marketing-locale";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { StationeryPaperPanel } from "@/components/marketing/stationery-paper-panel";

// 1. 强制动态渲染，防止 Build 时的 Prerender 错误
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — POJU",
  description: "POJU privacy policy",
};

const sections = [
  "1. What We Collect",
  "2. What We Don't Collect",
  "3. How We Use Your Data",
  "4. Data Encryption",
  "5. Data Deletion",
  "6. Third-Party Services",
  "7. AI Model Data Handling",
  "8. Children's Privacy",
  "9. Your Rights (CCPA — California Residents)",
  "10. GDPR Specific (EU Residents)",
  "11. Contact",
  "12. Updates to This Policy",
] as const;

const privacyIntro = `POJU was built differently.

Most products talk about "respecting your privacy." 
We built a product that doesn't need your data to work.

Here's the full picture.`;

const privacyOriginalBlocks = [
  `Minimal, by design:

· Device fingerprint (one-way hash)
  Used to restore your paid session if you refresh.

· Payment records (no personal info)
  Amount, timestamp, Stripe session ID.
  Kept for 7 years for tax compliance.

· Email (only when you explicitly provide it)
  Used to deliver PDF readings and one check-in email.
  Deleted within 24 hours after sending.

· Aggregated usage stats (anonymous)
  Total sessions, not per-user behavior.`,
  `What stays off our servers:

✗ Your conversations (lives encrypted on your device only)
✗ Your name, address, phone number (never asked)
✗ Your precise location (only country from GeoIP)
✗ Your behavioral tracking across websites
✗ Cookies for advertising
✗ IP addresses (Cloudflare/Vercel may log briefly)`,
  `· Device fingerprint: fraud prevention and session restoration only
· Payment records: tax compliance (required by law)
· Email: send PDF + optional check-in, then deleted
· Aggregate stats: improve product

We NEVER:
- Sell your data
- Use your data for advertising
- Share your data with marketing partners
- Use your conversations to train AI models`,
  `Conversations on your device: AES-256-GCM encryption
Encryption key: generated on your device, never sent to us
Transmission: HTTPS only (TLS 1.2+)
Payment: handled by Stripe (PCI DSS Level 1 certified)

Even if our servers were breached, there are no 
conversations to steal.`,
  `· Your local data: clear your browser OR click "End & Wipe"
· Email: physically deleted within 24 hours after delivery
· Device fingerprint: auto-deleted after 365 days of inactivity
· Payment records: kept 7 years (tax requirement), then deleted

You can request immediate deletion of all server-side data 
associated with your device by emailing privacy@pojulife.com.`,
  `Services we use and their privacy policies:

· Anthropic (Claude API)
  AI processing. Zero Data Retention enabled — they don't 
  save your conversations.
  Privacy: https://www.anthropic.com/privacy

· OpenAI
  Used ONLY for embedding (converting knowledge base to 
  vectors). Your conversations never go to OpenAI.
  Privacy: https://openai.com/privacy/

· ElevenLabs
  Text-to-speech for reading aloud. Optional, user-initiated.
  Privacy: https://elevenlabs.io/privacy

· Stripe
  Payment processing. They handle your payment method.
  Privacy: https://stripe.com/privacy

· Resend
  Email delivery. Auto-deletes messages after 30 days.
  Privacy: https://resend.com/legal/privacy-policy

· Vercel
  Hosting. Standard web server logs (IP, user agent, URL).
  Privacy: https://vercel.com/legal/privacy-policy

· Supabase
  Database (for payment records + knowledge base).
  Privacy: https://supabase.com/privacy

· FingerprintJS (OSS version)
  Device identification. Runs entirely on your device.
  Privacy: no data sent to FingerprintJS servers (OSS version).`,
  `Your conversations are sent to Anthropic for processing 
by Claude. We've specifically enabled:

✓ Zero Data Retention (ZDR)
  Anthropic does not keep your API requests or responses.

✓ No training on your data
  Your conversations are not used to improve Claude.

✓ No human review
  Unless you explicitly flag content for abuse, no Anthropic 
  employee will see your conversations.

This guarantee is contractual — we pay extra for ZDR.`,
  `POJU is not intended for users under 18.

We do not knowingly collect data from minors. If you 
believe a minor has used POJU, contact privacy@pojulife.com 
and we'll delete any associated data immediately.`,
  `As a California resident, you have the right to:

· Know what personal information we collect, use, disclose
· Delete personal information we hold about you
· Opt out of the "sale" of personal information
  (We don't sell data, so this is automatic)
· Non-discrimination for exercising your rights

To exercise any of these rights, email privacy@pojulife.com 
with "CCPA Request" in the subject line.`,
  `If you're in the EU, you also have:

· Right to access your personal data
· Right to rectification (correct inaccurate data)
· Right to erasure ("right to be forgotten")
· Right to data portability
· Right to withdraw consent
· Right to object to processing

Legal basis for processing:
· Contract (providing the service you paid for)
· Legitimate interest (fraud prevention)

Data Protection Officer: privacy@pojulife.com`,
  `For privacy questions:
privacy@pojulife.com

For general questions:
support@pojulife.com

For legal matters:
legal@pojulife.com

Physical address (if required by your jurisdiction):
[待律师确定后填入]`,
  `When we update this policy, we'll:

· Notify users via in-app banner on next visit
· Continued use after update = acceptance
· Major changes (new data collection, etc.) require 
  re-agreement`,
] as const;

const privacyArchitectureItems = [
  {
    title: "✦ Your conversations are encrypted on your device.",
    body: "Not \"secured on our servers.\" Encrypted with AES-256-GCM right in your browser, using a key we never see. Even if our servers were breached, there is nothing to steal.",
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

// 2. 将原页面逻辑移至 Content 组件
function PrivacyContent() {
  return (
    <MarketingLocaleProvider>
      <main className="bg-bg-deep text-text-body">
        <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
          <header className="px-1 py-2.5 sm:py-3 md:px-2">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-0">
                <PojuMarkLogo />
                <span className="inline-flex items-center text-[14px] font-semibold leading-none tracking-[0.09em] text-text-primary sm:text-[15px] md:text-[16px]">
                  POJU
                </span>
              </Link>
              <nav className="hidden items-center gap-7 text-[12px] tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
                <Link href="/poju" className="hover:text-text-primary">
                  POJU
                </Link>
                <Link href="/glyph" className="hover:text-text-primary">
                  Glyph
                </Link>
                <Link href="/syncro" className="hover:text-text-primary">
                  Syncro
                </Link>
                <Link href="/archive" className="hover:text-text-primary">
                  Archive
                </Link>
              </nav>
              <MarketingLanguageSwitcher />
            </div>
          </header>

          <section className="mx-auto mt-2 w-full max-w-4xl rounded-2xl border border-white/10 bg-black/25 px-5 py-8 sm:px-7 md:px-10">
            <p className="text-center text-xs uppercase tracking-[0.16em] text-text-dim">Version 1.0</p>
            <h1 className="mt-3 text-center text-[28px] font-semibold text-text-primary sm:text-[34px]">Privacy Policy</h1>
            <p className="mt-2 text-center text-sm text-text-dim">Last updated: [日期]</p>
            <pre className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-center text-[15px] leading-8 text-text-secondary">
              {privacyIntro}
            </pre>

            <section id="privacy-architecture" className="mx-auto mt-10 max-w-3xl scroll-mt-24 px-1">
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
                    sells one thing: a $9.99 conversation that helps you move through what&apos;s stuck. That&apos;s
                    the whole <span className="whitespace-nowrap">business model.</span>
                  </p>
                  <p>
                    If you ever doubt us: every claim on this page can be verified in a minute with your browser&apos;s
                    DevTools or public documentation.
                  </p>
                </div>
              </StationeryPaperPanel>
            </section>

            <div className="mt-8 space-y-7">
              {sections.map((section, idx) => (
                <article key={section} className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4 sm:px-5">
                  <h2 className="text-[16px] font-semibold text-text-primary sm:text-[17px]">{section}</h2>
                  <pre className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text-secondary sm:text-[15px]">
                    {privacyOriginalBlocks[idx]}
                  </pre>
                </article>
              ))}
            </div>

            <pre className="mt-8 whitespace-pre-wrap text-center text-[14px] leading-7 text-text-secondary sm:text-[15px]">
              {"Questions? Email privacy@pojulife.com.\nWe read every message."}
            </pre>
          </section>

          <footer className="mt-8 w-full rounded-xl bg-bg-layer-1/60 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-lg font-semibold tracking-[0.12em] text-text-primary">POJU</p>
              <p className="mt-1 text-sm text-text-secondary">pojulife.com</p>
              <div className="my-4 h-px bg-gradient-to-r from-transparent via-glass-border to-transparent" />
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
                <Link href="/" className="hover:text-text-primary">
                  Home
                </Link>
                <Link href="/disclaimer" className="hover:text-text-primary">
                  Disclaimer
                </Link>
                <Link href="/privacy" className="hover:text-text-primary">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-text-primary">
                  Terms of Service
                </Link>
                <Link href="/contact" className="hover:text-text-primary">
                  Contact
                </Link>
              </div>
              <p className="mt-4 text-center text-xs text-text-dim">© 2026 POJU. All rights reserved.</p>
              <p className="mt-2 text-center text-xs text-text-dim">
                For self-reflection and entertainment. POJU offers perspectives, not predictions. All decisions are yours alone.
              </p>
            </div>
          </footer>
        </div>
      </main>
    </MarketingLocaleProvider>
  );
}

// 3. 默认导出入口，包裹 Suspense
export default function PrivacyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <PrivacyContent />
    </Suspense>
  );
}