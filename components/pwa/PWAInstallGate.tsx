"use client";

import { useEffect, useState } from "react";
import {
  IconCheck,
  IconDotsVertical,
  IconDownload,
  IconShare2,
  IconSquareRoundedPlus,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { PwaBrandMark } from "@/components/pwa/PwaBrandMark";
import {
  detectDeviceCapability,
  type DeviceCapability,
} from "@/lib/syncro/device-capability";

import "@/styles/pwa-gate.css";

const GATE_ACCEPTED_KEY = "pojulife_gate_accepted";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallGate({ children }: { children: React.ReactNode }) {
  const [capability, setCapability] = useState<DeviceCapability | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    void detectDeviceCapability().then(setCapability);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    try {
      if (localStorage.getItem(GATE_ACCEPTED_KEY) === "1") {
        setAccepted(true);
      }
    } catch {
      /* private mode */
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!capability) {
    return <div className="loading-fullscreen" aria-busy="true" />;
  }

  if (capability.isDesktop || capability.isPWA) {
    return <>{children}</>;
  }

  if (capability.isMobile || capability.isTablet) {
    if (!accepted) {
      return (
        <DisclaimerGate
          onAccept={() => {
            setAccepted(true);
            try {
              localStorage.setItem(GATE_ACCEPTED_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
        />
      );
    }

    return <PWAInstallScreen capability={capability} installPrompt={installPrompt} />;
  }

  return <>{children}</>;
}

function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  const t = useTranslations("pwa.disclaimer");
  const [checked, setChecked] = useState(false);

  return (
    <div className="pwa-disclaimer-gate">
      <div className="disclaimer-content">
        <PwaBrandMark size="md" />

        <h1 className="disclaimer-title">{t("title")}</h1>

        <div className="disclaimer-body">
          <p>{t("para_1")}</p>
          <p>{t("para_2")}</p>
          <p className="muted">{t("para_3")}</p>
        </div>

        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>{t("agree")}</span>
        </label>

        <button type="button" className="primary-btn" disabled={!checked} onClick={onAccept}>
          {t("enter")}
        </button>
      </div>
    </div>
  );
}

function PWAInstallScreen({
  capability,
  installPrompt,
}: {
  capability: DeviceCapability;
  installPrompt: BeforeInstallPromptEvent | null;
}) {
  const t = useTranslations("pwa.install");

  async function handleAndroidInstall() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (e) {
      console.warn("[pwa] install prompt failed:", e);
    }
  }

  const desktopUrl = "https://pojulife.com";

  return (
    <div className="pwa-install-screen">
      <div className="install-content">
        <PwaBrandMark size="lg" />

        <h1 className="install-title">{t("title")}</h1>
        <p className="install-subtitle">{t("subtitle")}</p>

        {capability.os === "ios" ? <IOSInstallSteps /> : null}
        {capability.os === "android" ? (
          <AndroidInstallSteps
            canDirectInstall={Boolean(installPrompt)}
            onInstall={() => void handleAndroidInstall()}
          />
        ) : null}
        {capability.os !== "ios" && capability.os !== "android" ? (
          <AndroidInstallSteps canDirectInstall={false} onInstall={() => {}} />
        ) : null}

        <div className="post-install-tip">
          <p>{t("after_install_tip")}</p>
        </div>

        <div className="desktop-fallback">
          <p className="muted">{t("want_explore")}</p>
          <a href={desktopUrl} className="desktop-link" rel="noopener noreferrer">
            pojulife.com
          </a>
        </div>
      </div>
    </div>
  );
}

function IOSInstallSteps() {
  const t = useTranslations("pwa.install.ios");

  return (
    <div className="install-steps">
      <div className="steps-label">{t("label")}</div>

      <div className="step-item">
        <div className="step-icon">
          <IconShare2 aria-hidden />
        </div>
        <div
          className="step-text"
          dangerouslySetInnerHTML={{ __html: t.raw("step_1") as string }}
        />
      </div>

      <div className="step-item">
        <div className="step-icon">
          <IconSquareRoundedPlus aria-hidden />
        </div>
        <div
          className="step-text"
          dangerouslySetInnerHTML={{ __html: t.raw("step_2") as string }}
        />
      </div>

      <div className="step-item">
        <div className="step-icon">
          <IconCheck aria-hidden />
        </div>
        <div
          className="step-text"
          dangerouslySetInnerHTML={{ __html: t.raw("step_3") as string }}
        />
      </div>
    </div>
  );
}

function AndroidInstallSteps({
  canDirectInstall,
  onInstall,
}: {
  canDirectInstall: boolean;
  onInstall: () => void;
}) {
  const t = useTranslations("pwa.install.android");

  if (canDirectInstall) {
    return (
      <div className="install-direct">
        <button type="button" className="install-btn-large" onClick={onInstall}>
          <IconDownload aria-hidden />
          {t("install_button")}
        </button>
        <p className="install-direct-hint">{t("one_tap_hint")}</p>
      </div>
    );
  }

  return (
    <div className="install-steps">
      <div className="steps-label">{t("label_manual")}</div>

      <div className="step-item">
        <div className="step-icon">
          <IconDotsVertical aria-hidden />
        </div>
        <div className="step-text">{t("step_1")}</div>
      </div>

      <div className="step-item">
        <div className="step-icon">
          <IconSquareRoundedPlus aria-hidden />
        </div>
        <div className="step-text">{t("step_2")}</div>
      </div>

      <div className="step-item">
        <div className="step-icon">
          <IconCheck aria-hidden />
        </div>
        <div className="step-text">{t("step_3")}</div>
      </div>
    </div>
  );
}
