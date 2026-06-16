import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact.meta");

  return {
    title: t("title"),
    description: t("description"),
  };
}

async function ContactContent() {
  const t = await getTranslations("contact");

  return (
    <LegalPageShell
      version={t("meta.version")}
      title={t("meta.pageTitle")}
      intro={
        <>
          <p>{t("intro.p1")}</p>
          <p>{t("intro.p2")}</p>
        </>
      }
      footer={
        <p className="legal-page__closing-note">
          <em>{t("footer")}</em>
        </p>
      }
    >
      <h2>{t("billing.title")}</h2>
      <p>{t("billing.body")}</p>
      <ul>
        <li>
          <strong>{t("billing.emailLabel")}</strong>{" "}
          <a href="mailto:support@pojulife.com">support@pojulife.com</a>
        </li>
        <li>
          <strong>{t("billing.responseLabel")}</strong> {t("billing.response")}
        </li>
      </ul>
      <p>
        <em>{t("billing.note")}</em>
      </p>

      <h2>{t("subscription.title")}</h2>
      <p>
        {t("subscription.bodyBefore")} <strong>{t("subscription.manageLink")}</strong>{" "}
        {t("subscription.bodyAfter")}
      </p>

      <h2>{t("privacy.title")}</h2>
      <p>{t("privacy.body")}</p>
      <ul>
        <li>
          <strong>{t("privacy.emailLabel")}</strong>{" "}
          <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>
        </li>
        <li>
          <strong>{t("privacy.responseLabel")}</strong> {t("privacy.response")}
        </li>
      </ul>

      <h2>{t("legal.title")}</h2>
      <p>{t("legal.body")}</p>
      <ul>
        <li>
          <strong>{t("legal.emailLabel")}</strong>{" "}
          <a href="mailto:legal@pojulife.com">legal@pojulife.com</a>
        </li>
        <li>
          <strong>{t("legal.responseLabel")}</strong> {t("legal.response")}
        </li>
      </ul>

      <h2>{t("beforeWrite.title")}</h2>
      <p>{t("beforeWrite.body")}</p>
      <ul>
        <li>
          <Link href="/terms">{t("beforeWrite.terms")}</Link> — {t("beforeWrite.termsDesc")}
        </li>
        <li>
          <Link href="/privacy">{t("beforeWrite.privacy")}</Link> — {t("beforeWrite.privacyDesc")}
        </li>
        <li>
          <Link href="/disclaimer">{t("beforeWrite.disclaimer")}</Link> — {t("beforeWrite.disclaimerDesc")}
        </li>
        <li>
          <Link href="/refund">{t("beforeWrite.refund")}</Link> — {t("beforeWrite.refundDesc")}
        </li>
      </ul>

      <h2>{t("crisis.title")}</h2>
      <p>{t("crisis.body")}</p>
      <ul>
        <li>
          <strong>{t("crisis.usCanadaLabel")}</strong> {t("crisis.usCanadaAction")}
        </li>
        <li>
          <strong>{t("crisis.ukLabel")}</strong> {t("crisis.ukAction")}
        </li>
        <li>
          <strong>{t("crisis.euLabel")}</strong> {t("crisis.euAction")}
        </li>
        <li>
          <strong>{t("crisis.globalLabel")}</strong> {t("crisis.globalAction")}{" "}
          <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">
            https://findahelpline.com
          </a>
        </li>
      </ul>
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
