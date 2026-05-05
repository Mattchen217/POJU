import { Suspense } from "react";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — POJU",
  description: "Contact POJU",
};

function ContactContent() {
  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <article className="prose prose-invert prose-lg mx-auto mt-2 max-w-3xl rounded-2xl border border-white/10 bg-black/25 px-5 py-8 text-text-secondary prose-headings:text-text-primary prose-a:text-purple-vivid sm:px-7 md:px-10">
          <h1 className="text-text-primary">Contact POJU</h1>
          <p>We&apos;re a small team. Every email is read and answered by a real person.</p>
          <hr />

          <h2>Reach us</h2>
          <p>
            <strong>General questions / customer support</strong>
            <br />
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-cyan-100">support@pojulife.com</code>
            <br />
            <em>Response time: usually within 24 hours, often faster</em>
          </p>
          <p>
            <strong>Privacy or data requests</strong> (GDPR, CCPA, deletion)
            <br />
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-cyan-100">privacy@pojulife.com</code>
            <br />
            <em>Response time: 24-72 hours</em>
          </p>
          <p>
            <strong>Legal matters</strong> (Terms questions, disputes)
            <br />
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-cyan-100">legal@pojulife.com</code>
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
              <Link href="/disclaimer">Disclaimer</Link> — What POJU is and isn&apos;t
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
          <p>POJU is not equipped to help with mental health crises. Please reach out to a human trained for this.</p>

          <hr />

          <p className="text-center font-medium text-text-primary">We read every message.</p>
        </article>
      </div>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <ContactContent />
    </Suspense>
  );
}
