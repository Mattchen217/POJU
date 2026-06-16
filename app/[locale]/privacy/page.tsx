import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — pojulife",
  description: "pojulife privacy policy — Version 1.1",
};

const privacyArchitectureItems = [
  {
    title: "✦ Your Conversations Stay Encrypted on Your Device",
    body: 'Your inputs are not "secured on our cloud servers." They are encrypted using industry-standard AES-256-GCM right inside your local browser storage, utilizing a cryptographic key generated locally that we never see and cannot access. Even in the event of an external server breach, there is absolutely zero user conversation data to steal.',
    verify:
      "Verify it yourself: Open your browser's DevTools → Application → IndexedDB. You will see encrypted cryptographic text, never your raw inputs.",
  },
  {
    title: "✦ No Mandatory Account Sign-up or Password Walls",
    body: "We do not force you to provide an email, phone number, or social login (Google/Apple) to use the interface. Your localized device fingerprint (a secure, one-way cryptographic hash) acts as your temporary identification to validate active sessions and restore authorized usage—nothing more.",
  },
  {
    title: "✦ Transparent & Postponed Email Requests",
    body: "We delay and strictly limit the request for an email address to only two clear, voluntary situational contexts: (1) Secure Payment Processing — handled directly by our Merchant of Record to route transaction receipts and manage active subscriptions; (2) Perk Distribution — when you voluntarily opt-in to receive our monthly complimentary ecosystem vouchers or subscribe to our Monthly Pass.",
    verify:
      "Your mailbox identity is never used for unsolicited marketing or shared with external data brokers.",
  },
  {
    title: "✦ Enterprise-Grade Zero Data Retention (ZDR)",
    body: "Your immediate contextual inputs are processed through secure APIs powered by leading models (including Anthropic Claude and DeepSeek). We interact exclusively via API channels configured to ensure that our processors do not retain your inputs, do not run human reviews on your data, and never use your conversations to train public AI models.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPageShell
      version="Version 1.1"
      title="Privacy Policy"
      updated="Last updated: 2026-06-15"
      intro={
        <>
          <p>
            <strong>Operator:</strong> pojulife is operated by Tonghui Chen, an individual developer based in the
            People&apos;s Republic of China.
          </p>
          <p>
            <strong>Operator contact:</strong>{" "}
            <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>
          </p>
          <p>
            pojulife and its specialized modular engines (POJU, Glyph, Syncro, Match) are built upon a foundation of{" "}
            <strong>Decentralized Sovereignty</strong>. While most digital products talk about &quot;respecting your
            privacy&quot; while harvesting your behavior, we engineered an ecosystem that does not need your data to
            function. This document outlines our architectural commitment to your absolute data autonomy.
          </p>
        </>
      }
    >
      <section id="privacy-architecture" className="legal-architecture">
        <p className="legal-architecture__kicker">How we actually keep our word</p>
        <h2 className="legal-architecture__title">Privacy is not a compliant checkbox; it is our core architecture.</h2>
        {privacyArchitectureItems.map((item) => (
          <article key={item.title} className="legal-architecture__item">
            <p className="legal-architecture__item-title">{item.title}</p>
            <p className="legal-architecture__item-body">{item.body}</p>
            {"verify" in item && item.verify ? (
              <p className="legal-architecture__verify">{item.verify}</p>
            ) : null}
          </article>
        ))}
      </section>

      <h2>The Business Model</h2>
      <p>
        We are an architecture that sells specialized clarity, not user data. Our business relies entirely on two clean,
        transparent transactional frameworks:
      </p>
      <ul>
        <li>
          <strong>Pay-Per-Use:</strong> A structured standalone session ($9.99 for POJU, $4.99 for Glyph, Syncro, or
          Match) to resolve a specific situational block.
        </li>
        <li>
          <strong>Monthly Pass Subscription:</strong> An optional, high-value subscription tier at{" "}
          <strong>$29.99/month</strong> that provisions an ecosystem package worth $125 (including 5× POJU tokens, 5×
          Glyph tokens, 5× Match tokens, and 5× Syncro tokens).
        </li>
      </ul>
      <p>That is the entire business model. No hidden tracking, no behavioral monetization.</p>

      <h2>1. What We Collect</h2>
      <p>Minimalist by design, limited strictly to infrastructure requirements:</p>
      <ul>
        <li>
          <strong>Device Fingerprint (One-way Hash):</strong> Used exclusively to map transaction authorization and
          validate active sessions when you refresh.
        </li>
        <li>
          <strong>Payment Records:</strong> Transaction amounts, timestamps, subscription statuses, and payment
          processor session tokens. Retained securely for up to 7 years solely to satisfy legal tax and accounting
          compliance.
        </li>
        <li>
          <strong>Email Address (Voluntary Input):</strong> Collected only during checkout for secure gateway receipt
          routing, or when actively maintaining an optioned Monthly Pass subscription and reward voucher pool.
        </li>
        <li>
          <strong>Aggregated Usage Statistics (Anonymous):</strong> Volumetric platform tracking (e.g., total platform
          traffic counter) entirely divorced from individual user histories.
        </li>
      </ul>

      <h2>2. What We Explicitly Do NOT Collect</h2>
      <ul>
        <li>Your continuous chat logs and analytical inputs (these stay local to your device).</li>
        <li>Your real name, exact street address, or personal biological attributes.</li>
        <li>
          Your precise geolocation data (we process only high-level country codes derived from secure GeoIP lookups).
        </li>
        <li>Behavioral pixels or cross-site commercial advertising tracking cookies.</li>
      </ul>

      <h2>3. Data Governance &amp; Third-Party Processors</h2>
      <p>We interact with a minimal stack of highly verified global infrastructure providers to serve this application:</p>
      <ul>
        <li>
          <strong>Anthropic (Claude API):</strong> AI spatial-linguistic processing. Zero Data Retention (ZDR) protocol
          is active for our endpoints. Privacy:{" "}
          <a href="https://www.anthropic.com/privacy" rel="noopener noreferrer" target="_blank">
            anthropic.com/privacy
          </a>
        </li>
        <li>
          <strong>DeepSeek API:</strong> Contextual computing processing. Integrated strictly via API schemas that
          explicitly prohibit user data utilization for model optimization or training cycles. Privacy:{" "}
          <a href="https://www.deepseek.com/privacy" rel="noopener noreferrer" target="_blank">
            deepseek.com/privacy
          </a>
        </li>
        <li>
          <strong>Dodo Payments:</strong> Card, wallet transactions, and Monthly Pass automated billing are handled
          entirely by Dodo Payments acting as the Merchant of Record. We never see, process, or store your full raw
          card credentials. Privacy &amp; Terms available at secure checkout.
        </li>
        <li>
          <strong>Vercel / Cloudflare:</strong> Edge hosting and delivery infrastructure. Standard, temporary edge
          routing network logs may capture basic system metadata (IP ranges and user-agent strings) briefly to mitigate
          distributed cyber attacks (DDoS).
        </li>
      </ul>

      <h2>4. Retention &amp; Deletion Rights</h2>
      <ul>
        <li>
          <strong>Local Data Clearance:</strong> You maintain total execution authority. Clearing your local browser
          storage or selecting the in-app &quot;End &amp; Wipe&quot; function immediately and irreversibly destroys all
          local-storage logs on your hardware.
        </li>
        <li>
          <strong>Subscription &amp; Voucher Email Records:</strong> Maintained continuously only for the active duration
          of your subscription service or voucher pool allocation. You can request absolute erasure of your server-side
          identifier records at any time by contacting{" "}
          <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>.
        </li>
        <li>
          <strong>Tax Audit Data:</strong> Payment compliance transaction references are systematically archived for 7
          years as mandated by international tax law, after which they are automatically purged.
        </li>
      </ul>

      <h2>5. Regional Statutory Compliance (GDPR &amp; CCPA)</h2>
      <p>
        Whether you reside in the European Economic Area (EEA) under GDPR jurisdiction or California under the CCPA, our
        architecture natively fulfills your statutory rights: the Right to Erasure (&quot;Right to be Forgotten&quot;),
        Right to Access, and Right to Non-Discrimination. Because we do not sell or lease metadata to data brokers,
        your opt-out rights are fundamentally integrated into the system by default.
      </p>
      <p>
        For formal data validation requests, dispatch an inquiry to{" "}
        <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a> with the subject token &quot;Data Sovereignty
        Request.&quot;
      </p>

      <p className="legal-page__closing-note">
        <em>
          Updates to this policy will be flagged on the interface dashboard upon subsequent deployments. Sustained
          engagement with the platform constitutes alignment with these decentralized parameters.
        </em>
      </p>
    </LegalPageShell>
  );
}
