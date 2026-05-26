"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SyncroCenterInfo, SyncroDirectionLabels } from "@/components/syncro/syncro-result-shared";
import { SyncroSplineCanvas } from "@/components/syncro/SyncroSplineCanvas";
import { compassToDirection } from "@/lib/syncro/current-system";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

export type SyncroCompassModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
};

export function SyncroCompassMode({ session, locale, hourPeriod }: SyncroCompassModeProps) {
  const t = useTranslations("syncro.main");
  const { compassDegree, hasPermission, requestPermission, isSupported } = useOrientation();
  const [showDetail, setShowDetail] = useState(false);

  const { primary: currentDirection } = compassToDirection(compassDegree);
  const combination = session.matrix[matrixKey(hourPeriod, currentDirection)];

  if (!isSupported) {
    return (
      <div className="syncro-mode-empty flex min-h-[50vh] items-center justify-center px-6 text-center text-sm text-text-secondary">
        <p>{t("not_supported")}</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="syncro-mode-empty flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
        <button
          type="button"
          onClick={() => void requestPermission()}
          className="permission-button"
        >
          {t("enable_compass")}
        </button>
      </div>
    );
  }

  if (!combination) {
    return null;
  }

  return (
    <>
      <SyncroDirectionLabels
        compassDegree={compassDegree}
        activeDirection={currentDirection}
        locale={locale}
      />
      <SyncroSplineCanvas compassDegree={compassDegree} vrMode={false} />
      <SyncroCenterInfo
        combination={combination}
        directionId={currentDirection}
        hourPeriod={hourPeriod}
        showDetail={showDetail}
        onToggleDetail={() => setShowDetail((v) => !v)}
        locale={locale}
      />
    </>
  );
}
