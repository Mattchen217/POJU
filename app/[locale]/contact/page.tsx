import { Suspense } from "react";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — pojulife",
  description: "Contact pojulife",
};

function ContactContent() {
  return (
    <LegalPageShell title="Contact pojulife" maxWidth="md">
      <p>We&apos;re a small team. Every email is read and answered by a real person.</p>
      <hr />

      <h2>Reach us</h2>
      <p>
        <strong>General questions / customer support</strong>
        <br />
        <code>support@pojulife.com</code>
        <br />
        <em>Response time: usually within 24 hours, often faster</em>
      </p>
      <p>
        <strong>Privacy or data requests</strong> (GDPR, CCPA, deletion)
        <br />
        <code>privacy@pojulife.com</code>
        <br />
        <em>Response time: 24-72 hours</em>
      </p>
      <p>
        <strong>Legal matters</strong> (Terms questions, disputes)
        <br />
        <code>legal@pojulife.com</code>
        <br />
        <em>Response time: 2-5 business days</em>
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
          <Link href="/disclaimer">Disclaimer</Link> — What POJULIFE is and isn&apos;t
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
      <p>POJULIFE is not equipped to help with mental health crises. Please reach out to a human trained for this.</p>

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
