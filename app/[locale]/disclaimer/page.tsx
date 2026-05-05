import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer — POJU",
  description: "POJU disclaimer",
};

export default function DisclaimerPage() {
  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <article className="prose prose-invert prose-lg mx-auto mt-6 max-w-3xl px-2 text-text-secondary prose-headings:text-text-primary prose-strong:text-text-primary prose-a:text-purple-vivid prose-hr:border-white/15">
          <h1 className="text-text-primary">Important Disclaimer</h1>
          <p>
            POJU is an AI-powered decision support and reflection tool. This page explains what POJU is — and what it is
            not.
          </p>
          <hr />

          <h2>What POJU does</h2>
          <p>
            POJU uses large language models to generate structured reflection reports and conversations. These integrate:
          </p>
          <ul>
            <li>Decision psychology research</li>
            <li>Behavioral economics frameworks</li>
            <li>Eastern philosophical traditions</li>
            <li>Mindfulness and time-perception research</li>
          </ul>
          <p>The reports and conversations are designed to help you:</p>
          <ul>
            <li>Look at a question from new angles</li>
            <li>Notice patterns in your situation</li>
            <li>Consider actions you may not have considered</li>
            <li>Reflect on what matters</li>
          </ul>

          <hr />

          <h2>What POJU does NOT do</h2>
          <p>POJU does NOT provide:</p>
          <p>
            <strong>Predictions about your future</strong> — POJU is not a fortune-teller. The patterns and frameworks
            describe common human situations, not future events.
          </p>
          <p>
            <strong>Medical advice</strong> — If you have health concerns, please consult a licensed medical professional.
            POJU&apos;s reflections cannot replace medical evaluation.
          </p>
          <p>
            <strong>Mental health treatment</strong> — If you&apos;re experiencing suicidal thoughts, severe anxiety,
            depression, or other mental health crises, please contact:
          </p>
          <ul>
            <li>US: 988 (Suicide &amp; Crisis Lifeline) — available 24/7</li>
            <li>Other: findahelpline.com</li>
          </ul>
          <p>POJU is for self-reflection, not therapy.</p>
          <p>
            <strong>Legal advice</strong> — For legal matters, consult a licensed attorney in your jurisdiction.
          </p>
          <p>
            <strong>Financial advice</strong> — For investment, tax, or financial planning, consult a certified financial
            advisor.
          </p>
          <p>
            <strong>Spiritual or religious guidance</strong> — POJU references philosophical traditions as frameworks for
            thinking, not as religious teaching or spiritual authority.
          </p>

          <hr />

          <h2>How to read POJU&apos;s outputs</h2>
          <p>POJU&apos;s outputs are best treated as:</p>
          <ul>
            <li>
              <strong>One perspective among many</strong> — not the only correct view
            </li>
            <li>
              <strong>A starting point for reflection</strong> — not a conclusion
            </li>
            <li>
              <strong>A thinking tool</strong> — not a decision-maker
            </li>
            <li>
              <strong>Educational and reflective</strong> — not authoritative
            </li>
          </ul>
          <p>
            The decisions in your life remain entirely yours. You are the only person who can decide what&apos;s right for
            you.
          </p>

          <hr />

          <h2>On AI accuracy</h2>
          <p>POJU uses Claude (Anthropic) for AI generation. While we strive for high quality:</p>
          <ul>
            <li>AI can make factual errors</li>
            <li>AI may misinterpret cultural or historical references</li>
            <li>AI does not &quot;understand&quot; your situation the way a human friend or counselor would</li>
            <li>AI outputs should not be trusted as definitive</li>
          </ul>
          <p>Always apply your own judgment to what POJU generates.</p>

          <hr />

          <h2>On framework references</h2>
          <p>POJU references philosophical and psychological traditions including:</p>
          <ul>
            <li>Eastern philosophical frameworks (I Ching, Daoist thought, archetypal traditions)</li>
            <li>Decision psychology</li>
            <li>Behavioral economics</li>
            <li>Mindfulness research</li>
          </ul>
          <p>
            These are referenced as <strong>research subjects and frameworks for thinking</strong>, not as belief systems
            POJU endorses or claims authority over.
          </p>
          <p>
            POJU does not predict outcomes based on these traditions. POJU uses them as one of several frameworks the AI
            considers when generating reflection reports and conversations.
          </p>

          <hr />

          <h2>Liability limitation</h2>
          <p>POJU is provided &quot;as is&quot; for entertainment, educational, and reflection purposes.</p>
          <p>By using POJU, you acknowledge:</p>
          <ul>
            <li>You are solely responsible for decisions you make</li>
            <li>POJU&apos;s developers are not liable for outcomes resulting from your decisions</li>
            <li>
              You will not use POJU as a substitute for professional advice in medical, legal, financial, or mental health
              matters
            </li>
          </ul>

          <hr />

          <h2>Questions</h2>
          <p>
            If you&apos;re unsure how to interpret a POJU output:{" "}
            <a href="mailto:support@pojulife.com">support@pojulife.com</a>
          </p>
          <p>
            If you&apos;re in distress: 988 (US) or{" "}
            <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">
              findahelpline.com
            </a>{" "}
            (worldwide)
          </p>

          <p className="text-sm text-text-dim">Last updated: October 30, 2025</p>
        </article>
      </div>
    </main>
  );
}
