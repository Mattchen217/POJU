import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Disclaimer — pojulife",
  description: "pojulife disclaimer",
};

export default function DisclaimerPage() {
  return (
    <LegalPageShell
      version="Version 1.0"
      title="Important Disclaimer"
      updated="Last updated: May 1, 2026"
      maxWidth="md"
    >
      <p>
        POJULIFE is an AI-powered decision support and reflection platform. This page explains what POJULIFE is — and what
        it is not.
      </p>

      <hr />

      <h2>What POJULIFE does</h2>
      <p>POJU uses large language models to generate structured reflection reports and conversations. These integrate:</p>
      <ul>
        <li>Decision psychology research</li>
        <li>Behavioral economics frameworks</li>
        <li>Philosophical traditions (including Eastern philosophy)</li>
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

      <h2>What POJULIFE does NOT do</h2>
      <p>POJU does NOT provide:</p>
      <p>
        <strong>Predictions about your future</strong>
        <br />
        POJU is not a fortune-teller. The patterns and frameworks describe common human situations, not future events.
      </p>
      <p>
        <strong>Medical advice</strong>
        <br />
        If you have health concerns, please consult a licensed medical professional. POJU&apos;s reflections cannot replace
        medical evaluation.
      </p>
      <p>
        <strong>Mental health treatment</strong>
        <br />
        If you&apos;re experiencing suicidal thoughts, severe anxiety, depression, or other mental health crises, please
        contact:
      </p>
      <ul>
        <li>US: 988 (Suicide &amp; Crisis Lifeline) — available 24/7</li>
        <li>Worldwide: findahelpline.com</li>
      </ul>
      <p>POJU is for self-reflection, not therapy.</p>
      <p>
        <strong>Legal advice</strong>
        <br />
        For legal matters, consult a licensed attorney in your jurisdiction.
      </p>
      <p>
        <strong>Financial advice</strong>
        <br />
        For investment, tax, or financial planning, consult a certified financial advisor.
      </p>
      <p>
        <strong>Spiritual or religious guidance</strong>
        <br />
        POJU references philosophical traditions as frameworks for thinking, not as religious teaching or spiritual
        authority.
      </p>

      <hr />

      <h2>How to read POJULIFE&apos;s outputs</h2>
      <p>POJULIFE&apos;s outputs are best treated as:</p>
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

      <h2>On AI technology</h2>
      <p>
        POJULIFE is powered by advanced language models built on the Transformer architecture — the foundational
        technology behind modern AI systems.
      </p>
      <p>
        To meet quality requirements, our service may call upon leading large language models from providers including
        Anthropic&apos;s Claude, OpenAI&apos;s GPT, and Google&apos;s Gemini.
      </p>
      <p>While we strive for high quality, please note:</p>
      <ul>
        <li>AI can make factual errors</li>
        <li>AI may misinterpret cultural or historical references</li>
        <li>AI does not &quot;understand&quot; your situation the way a human friend or counselor would</li>
        <li>AI outputs should not be trusted as definitive</li>
      </ul>
      <p>Always apply your own judgment to what POJULIFE generates.</p>

      <hr />

      <h2>On framework references</h2>
      <p>POJULIFE references philosophical and psychological traditions including:</p>
      <ul>
        <li>Eastern philosophical frameworks (archetypal patterns, contemplative practices, temporal observations)</li>
        <li>Decision psychology</li>
        <li>Behavioral economics</li>
        <li>Mindfulness research</li>
      </ul>
      <p>
        These are referenced as <strong>research subjects and frameworks for thinking</strong>, not as belief systems
        POJULIFE endorses or claims authority over.
      </p>
      <p>
        POJULIFE does not predict outcomes based on these traditions. POJULIFE uses them as one of several frameworks
        the AI considers when generating reflection reports and conversations.
      </p>

      <hr />

      <h2>Liability limitation</h2>
      <p>POJULIFE is provided &quot;as is&quot; for entertainment, educational, and reflection purposes.</p>
      <p>By using POJULIFE, you acknowledge:</p>
      <ul>
        <li>You are solely responsible for decisions you make</li>
        <li>POJULIFE&apos;s developers are not liable for outcomes resulting from your decisions</li>
        <li>
          You will not use POJU as a substitute for professional advice in medical, legal, financial, or mental health
          matters
        </li>
      </ul>

      <hr />

      <h2>Questions</h2>
      <p>
        If you&apos;re unsure how to interpret a POJU output:
        <br />
        <a href="mailto:support@pojulife.com">support@pojulife.com</a>
      </p>
      <p>
        If you&apos;re in distress:
        <br />
        988 (US) or{" "}
        <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">
          findahelpline.com
        </a>{" "}
        (worldwide)
      </p>
    </LegalPageShell>
  );
}
