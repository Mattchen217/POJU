"use client";

import { useEffect, useState } from "react";
import { IconCompass } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";

import "@/styles/syncro-permission-gate.css";

export type SyncroPermissionGateProps = {
  onGranted: () => void;
  onSkip?: () => void;
};

export function SyncroPermissionGate({ onGranted, onSkip }: SyncroPermissionGateProps) {
  const t = useTranslations("syncro.permission");
  const { requestPermission, hasPermission, isSupported } = useOrientation();
  const [requesting, setRequesting] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupported) {
      onGranted();
      return;
    }
    if (hasPermission) {
      onGranted();
    }
  }, [hasPermission, isSupported, onGranted]);

  async function handleEnable() {
    setDeniedMessage(null);
    setRequesting(true);
    const ok = await requestPermission();
    setRequesting(false);

    if (ok) {
      onGranted();
    } else {
      setDeniedMessage(t("denied_alert"));
    }
  }

  if (!isSupported || hasPermission) {
    return null;
  }

  return (
    <div className="permission-gate">
      <div className="permission-gate-card">
        <div className="permission-icon">
          <IconCompass aria-hidden size={36} stroke={1.5} />
        </div>

        <h2>{t("title")}</h2>
        <p>{t("description")}</p>

        {deniedMessage ? <p className="permission-denied-msg">{deniedMessage}</p> : null}

        <button
          type="button"
          className="permission-btn-primary"
          onClick={() => void handleEnable()}
          disabled={requesting}
        >
          {requesting ? t("requesting") : t("enable")}
        </button>

        {onSkip ? (
          <button type="button" className="permission-btn-skip" onClick={onSkip}>
            {t("skip")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
