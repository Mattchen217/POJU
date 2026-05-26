import { Suspense } from "react";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

import { siteConfig } from "@/lib/config/site";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — pojulife",
  description: "Contact pojulife",
};

function ContactContent() {
  return (
    <LegalPageShell title="Contact pojulife" maxWidth="md">
      <p>We read every email. pojulife is a small operation — real humans respond as fast as we can.</p>
      <hr />

      <h2>Operator</h2>
      <p>
        pojulife is operated by <strong>Tonghui Chen</strong>, an individual developer based in the People&apos;s
        Republic of China.
        <br />
        <strong>Operator contact:</strong>{" "}
        <a href={`mailto:${siteConfig.founderEmail}`}>{siteConfig.founderEmail}</a>
      </p>

      <hr />

      <h2>Support</h2>
      <p>
        For payments, refunds, and technical issues
        <br />
        <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>
        <br />
        <em>We usually reply within 24 hours on business days.</em>
      </p>

      <h2>Privacy</h2>
      <p>
        For data questions, CCPA/GDPR requests, and cookie preferences
        <br />
        <a href={`mailto:${siteConfig.privacyEmail}`}>{siteConfig.privacyEmail}</a>
        <br />
        <em>Privacy requests are typically answered within 48 hours.</em>
      </p>

      <h2>Legal</h2>
      <p>
        For legal matters, press inquiries, and physical address requests
        <br />
        <a href={`mailto:${siteConfig.legalEmail}`}>{siteConfig.legalEmail}</a>
        <br />
        <em>Legal inquiries are typically answered within 5 business days.</em>
      </p>

      <hr />

      <h2>Payments</h2>
      <p>
        Card payments are processed by <strong>Dodo Payments</strong> as the merchant of record. pojulife does not store
        your full payment card details.
      </p>

      <hr />

      <h2>Before you write</h2>
      <p>Many questions are answered in our:</p>
      <ul>
        <li>
          <Link href="/privacy">Privacy Policy</Link> — How we handle your data
        </li>
        <li>
          <Link href="/terms">Terms of Service</Link> — What you agree to
        </li>
        <li>
          <Link href="/disclaimer">Disclaimer</Link> — What pojulife is and isn&apos;t
        </li>
        <li>
          <Link href="/refund">Refund Policy</Link> — When refunds apply
        </li>
        <li>
          <Link href="/cookies">Cookie Policy</Link> — How we use cookies
        </li>
      </ul>

      <hr />

      <h2>Crisis support</h2>
      <p>If you&apos;re in crisis or considering harm to yourself:</p>
      <p>
        <strong>United States</strong>: Call or text 988 — available 24/7
        <br />
        <strong>Worldwide</strong>:{" "}
        <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">
          findahelpline.com
        </a>
      </p>
      <p>pojulife is not equipped to help with mental health crises. Please reach out to someone trained for this.</p>

      <hr />

      <p className="legal-prose__closing">We read every message.</p>
    </LegalPageShell>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <ContactContent />
    </Suspense>
  );
}
