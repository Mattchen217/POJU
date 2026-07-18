import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import {
  POJU_TERMS,
  toTermLocale,
  type TermNs,
  type TermPolarity,
} from "@/lib/glossary/pojulife-terms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Glossary — pojulife",
  description: "Soft-label terminology dictionary used across pojulife products.",
};

const NS_LABEL: Record<TermNs, string> = {
  bazi: "Profile",
  qimen: "Vector",
  glyph: "Glyph",
  zodiac: "Zodiac",
};

const POLARITY_LABEL: Record<TermPolarity, string> = {
  favorable: "favorable",
  caution: "caution",
  neutral: "neutral",
};

export default async function GlossaryPage() {
  const locale = toTermLocale(await getLocale());
  const bazi = POJU_TERMS.filter((t) => t.ns === "bazi");
  const qimen = POJU_TERMS.filter((t) => t.ns === "qimen");
  const glyph = POJU_TERMS.filter((t) => t.ns === "glyph");
  const zodiac = POJU_TERMS.filter((t) => t.ns === "zodiac");

  return (
    <LegalPageShell
      title="Terminology glossary"
      updated={`${POJU_TERMS.length} terms · soft labels only`}
      intro={
        <p>
          User-facing soft labels for the closed terminology set. Traditional names are never shown
          in product output; gold markers in readings link here conceptually.
        </p>
      }
    >
      <Section title={`${NS_LABEL.bazi} (${bazi.length})`} terms={bazi} locale={locale} />
      <Section title={`${NS_LABEL.qimen} (${qimen.length})`} terms={qimen} locale={locale} />
      <Section title={`${NS_LABEL.glyph} (${glyph.length})`} terms={glyph} locale={locale} />
      <Section title={`${NS_LABEL.zodiac} (${zodiac.length})`} terms={zodiac} locale={locale} />
    </LegalPageShell>
  );
}

function Section({
  title,
  terms,
  locale,
}: {
  title: string;
  terms: typeof POJU_TERMS;
  locale: ReturnType<typeof toTermLocale>;
}) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <h2>{title}</h2>
      <dl style={{ display: "grid", gap: "1.25rem", marginTop: "1rem" }}>
        {terms.map((t) => (
          <div key={`${t.ns}:${t.slug}`}>
            <dt>
              <strong>{t.term[locale]}</strong>
              <span style={{ opacity: 0.55, marginLeft: "0.5rem", fontSize: "0.85em" }}>
                {POLARITY_LABEL[t.polarity]} · <code>{t.slug}</code>
              </span>
            </dt>
            <dd style={{ margin: "0.35rem 0 0", opacity: 0.9 }}>{t.definition[locale]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
