"use client";

import { useState } from "react";

import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SyncroCenterInfo } from "@/components/syncro/syncro-result-shared";
import { SyncroSplineCanvas } from "@/components/syncro/SyncroSplineCanvas";
import { SyncroVRMode } from "@/components/syncro/SyncroVRMode";
import { compassToDirection } from "@/lib/syncro/current-system";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

export type SyncroARModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
};

export function SyncroARMode({ session, locale, hourPeriod }: SyncroARModeProps) {
  const { compassDegree } = useOrientation();
  const [showDetail, setShowDetail] = useState(false);

  const { primary: currentDirection } = compassToDirection(compassDegree);
  const combination = session.matrix[matrixKey(hourPeriod, currentDirection)];

  if (!combination) return null;

  return (
    <div className="syncro-ar-mode">
      <SyncroSplineCanvas compassDegree={compassDegree} vrMode />
      <SyncroVRMode />
      <SyncroCenterInfo
        combination={combination}
        directionId={currentDirection}
        hourPeriod={hourPeriod}
        showDetail={showDetail}
        onToggleDetail={() => setShowDetail((v) => !v)}
        compact
        locale={locale}
      />
    </div>
  );
}
