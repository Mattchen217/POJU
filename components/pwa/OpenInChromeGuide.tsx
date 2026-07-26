"use client";

import { useState } from "react";
import { IconCheck, IconCopy, IconInfoCircle } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { PwaBrandMark } from "@/components/pwa/PwaBrandMark";
import { getBrowserDisplayName, POJULIFE_SITE_URL } from "@/lib/pwa/install-capability";

type OpenInChromeGuideProps = {
  browserName: string;
};

export function OpenInChromeGuide({ browserName }: OpenInChromeGuideProps) {
  const t = useTranslations("pwa.install.open_in_chrome");
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(POJULIFE_SITE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user can copy manually */
    }
  }

  const browserDisplay = getBrowserDisplayName(browserName);

  return (
    <div className="install-content">
      <PwaBrandMark size="lg" />

      <h1 className="install-title">{t("title")}</h1>
      <p className="install-subtitle">{t("subtitle", { browser: browserDisplay })}</p>

      <div className="install-steps">
        <div className="steps-label">{t("label")}</div>

        <div className="step-item">
          <div className="step-icon">
            <span className="step-num">1</span>
          </div>
          <div className="step-text">
            <strong>{t("step_1_title")}</strong>
            <button
              type="button"
              className={`copy-url-btn${copied ? " copied" : ""}`}
              onClick={() => void copyUrl()}
            >
              {copied ? <IconCheck aria-hidden /> : <IconCopy aria-hidden />}
              {copied ? t("copied") : "easternos.com"}
            </button>
          </div>
        </div>

        <div className="step-item">
          <div className="step-icon">
            <span className="step-num">2</span>
          </div>
          <div className="step-text">
            <strong>{t("step_2_title")}</strong>
            <p>{t("step_2_desc")}</p>
          </div>
        </div>

        <div className="step-item">
          <div className="step-icon">
            <span className="step-num">3</span>
          </div>
          <div className="step-text">
            <strong>{t("step_3_title")}</strong>
            <p>{t("step_3_desc")}</p>
          </div>
        </div>
      </div>

      <div className="install-note">
        <IconInfoCircle aria-hidden />
        <p>{t("why_chrome")}</p>
      </div>
    </div>
  );
}
