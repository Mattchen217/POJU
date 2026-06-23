"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BaseAnalysisDeliveryView } from "@/components/base-analysis/BaseAnalysisDeliveryView";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { decodeMarkedDisplayText } from "@/lib/base-analysis/resolve-display-text";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { resolveProfileMatrixPayloadWithoutLlm } from "@/lib/poju/resolve-matrix-preview";
import {
  getStoredProfile,
  getStoredProfileRecord,
} from "@/lib/profile/stored-profiles-service";

import "@/styles/glyph-delivery.css";
import "@/styles/base-analysis-delivery.css";
import "@/styles/poju-unlock-report.css";
import "@/styles/poju-energy-matrix.css";

type Props = {
  open: boolean;
  reportText: string;
  profileId?: string;
  gateMode?: boolean;
  onClose: () => void;
};

export function PojuUnlockReportModal({
  open,
  reportText,
  profileId,
  gateMode = false,
  onClose,
}: Props) {
  const t = useTranslations("poju.chat");
  const locale = useLocale();
  const [structured, setStructured] = useState<ProfileStructured | null>(null);
  const [userProfile, setUserProfile] = useState<
    import("@/lib/profile/types").UserProfile | null
  >(null);
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [matrixPayload, setMatrixPayload] = useState<PojuMatrixPayload | null>(null);

  const displayText = decodeMarkedDisplayText(reportText);

  useEffect(() => {
    if (!open || !profileId) {
      setStructured(null);
      setUserProfile(null);
      setDisplayName(undefined);
      setMatrixPayload(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [data, record] = await Promise.all([
          getStoredProfile(profileId),
          getStoredProfileRecord(profileId),
        ]);
        if (cancelled) return;
        setDisplayName(record?.display_name?.trim() || undefined);
        setUserProfile(data?.user_profile ?? null);
        setStructured(
          data?.base_analysis?.structured ??
            (data?.user_profile
              ? buildStreamLocalDataFromProfile(data.user_profile).structured
              : null),
        );
        if (data?.user_profile) {
          try {
            const payload = await resolveProfileMatrixPayloadWithoutLlm({
              profileId,
              userProfile: data.user_profile,
              locale,
              product: "poju",
            });
            if (!cancelled) setMatrixPayload(payload);
          } catch (e) {
            console.warn("[PojuUnlockReportModal] matrix preview failed:", e);
            if (!cancelled) setMatrixPayload(null);
          }
        }
      } catch {
        if (!cancelled) setStructured(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, profileId, locale]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !gateMode) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, gateMode]);

  if (!open || !displayText) return null;

  return (
    <div
      className="poju-unlock-report-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="poju-unlock-report-title"
      onClick={gateMode ? undefined : onClose}
    >
      <div className="poju-unlock-report-panel" onClick={(e) => e.stopPropagation()}>
        <header className="poju-unlock-report-panel__head">
          <div>
            <h2 id="poju-unlock-report-title" className="poju-unlock-report-panel__title">
              {t("unlock_report_modal_title")}
            </h2>
            <p className="poju-unlock-report-panel__hint">
              {gateMode ? t("unlock_report_gate_hint") : t("unlock_report_modal_hint")}
            </p>
          </div>
        </header>

        <div className="poju-unlock-report-panel__body poju-unlock-report-panel__body--delivery">
          <BaseAnalysisDeliveryView
            displayText={displayText}
            structured={structured}
            userProfile={userProfile}
            locale={locale}
            profileId={profileId}
            displayName={displayName}
            variant="modal"
            showPageHeader={false}
          />
          {matrixPayload ? (
            <section className="px-2 pb-4">
              <PojuEnergyMatrix payload={matrixPayload} locale={locale} compact />
            </section>
          ) : null}
        </div>

        <footer className="poju-unlock-report-panel__foot">
          <button
            type="button"
            className="poju-new-session-btn poju-unlock-report-panel__close-btn"
            onClick={onClose}
          >
            {gateMode ? t("unlock_report_close_continue") : t("unlock_report_close")}
          </button>
        </footer>
      </div>
    </div>
  );
}
