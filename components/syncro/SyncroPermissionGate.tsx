"use client";

import { useEffect, useState } from "react";
import { IconCompass } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";

import "@/styles/syncro-permission-gate.css";

export type SyncroPermissionGateProps = {
  /** Called when heading events are flowing (compass actually works). */
  onReady?: () => void;
  layout?: "fullscreen" | "inline";
};

export function SyncroPermissionGate({ onReady, layout = "inline" }: SyncroPermissionGateProps) {
  const t = useTranslations("syncro.permission");
  const { requestPermissionFromUserGesture, isSupported, receivingHeading } = useOrientation();
  const [requesting, setRequesting] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (receivingHeading) {
      onReady?.();
    }
  }, [receivingHeading, onReady]);

  function handleEnable() {
    setDeniedMessage(null);
    setRequesting(true);

    requestPermissionFromUserGesture()
      .then((ok) => {
        setRequesting(false);
        if (!ok) {
          setDeniedMessage(t("denied_alert"));
        }
      })
      .catch(() => {
        setRequesting(false);
        setDeniedMessage(t("denied_alert"));
      });
  }

  if (!isSupported) {
    return (
      <div className={`permission-gate permission-gate--${layout}`}>
        <div className="permission-gate-card">
          <p className="permission-unsupported">{t("unsupported")}</p>
        </div>
      </div>
    );
  }

  if (receivingHeading) {
    return null;
  }

  return (
    <div className={`permission-gate permission-gate--${layout}`}>
      <div className="permission-gate-card">
        <div className="permission-icon">
          <IconCompass aria-hidden size={40} stroke={1.5} />
        </div>

        <h2>{t("title")}</h2>
        <p className="permission-lead">{t("description")}</p>
        <p className="permission-not-location">{t("not_location_hint")}</p>

        {deniedMessage ? <p className="permission-denied-msg">{deniedMessage}</p> : null}

        <button
          type="button"
          className="permission-btn-primary"
          onClick={handleEnable}
          disabled={requesting}
        >
          {requesting ? t("requesting") : t("enable")}
        </button>

        <p className="permission-settings-hint">{t("settings_hint")}</p>
      </div>
    </div>
  );
}
