"use client";

import { useEffect, useState } from "react";
import { IconCamera, IconCompass } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  readSyncroPermissionSync,
  requestSyncroCameraPermission,
} from "@/lib/syncro/permissions";

import "@/styles/syncro-permission-gate.css";

export type SyncroPermissionGateProps = {
  onReady?: (result: { cameraGranted: boolean }) => void;
  layout?: "fullscreen" | "inline";
  variant?: "initial" | "resume";
};

export function SyncroPermissionGate({
  onReady,
  layout = "inline",
  variant = "initial",
}: SyncroPermissionGateProps) {
  const t = useTranslations("syncro.permission");
  const { requestPermissionFromUserGesture, isSupported, receivingHeading } = useOrientation();
  const [requesting, setRequesting] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  async function handleEnable() {
    setDeniedMessage(null);
    setRequesting(true);

    try {
      const orientOk = await requestPermissionFromUserGesture();
      if (!orientOk) {
        setDeniedMessage(t("denied_alert"));
        return;
      }

      if (isResume) {
        onReady?.({ cameraGranted: readSyncroPermissionSync().camera });
        return;
      }

      const cached = readSyncroPermissionSync();
      const cameraOk = cached.camera || (await requestSyncroCameraPermission());
      if (!cameraOk) {
        setDeniedMessage(t("camera_denied"));
      }

      onReady?.({ cameraGranted: cameraOk });
    } catch {
      setDeniedMessage(t("denied_alert"));
    } finally {
      setRequesting(false);
    }
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

  if (receivingHeading && variant === "resume") {
    return null;
  }

  const isResume = variant === "resume";

  return (
    <div className={`permission-gate permission-gate--${layout}`}>
      <div className="permission-gate-card">
        <div className="permission-icon">
          {isResume ? (
            <IconCompass aria-hidden size={40} stroke={1.5} />
          ) : (
            <div className="permission-icon-duo">
              <IconCompass aria-hidden size={28} stroke={1.5} />
              <IconCamera aria-hidden size={22} stroke={1.5} />
            </div>
          )}
        </div>

        <h2>{isResume ? t("resume_title") : t("title")}</h2>
        <p className="permission-lead">{isResume ? t("resume_description") : t("description")}</p>
        {!isResume ? <p className="permission-not-location">{t("not_location_hint")}</p> : null}

        {deniedMessage ? <p className="permission-denied-msg">{deniedMessage}</p> : null}

        <button
          type="button"
          className="permission-btn-primary"
          onClick={() => void handleEnable()}
          disabled={requesting}
        >
          {requesting ? t("requesting") : isResume ? t("resume_enable") : t("enable")}
        </button>

        {!isResume ? <p className="permission-settings-hint">{t("settings_hint")}</p> : null}
      </div>
    </div>
  );
}
