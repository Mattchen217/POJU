"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import { SyncroARMode } from "@/components/syncro/SyncroARMode";
import { SyncroCompassMode } from "@/components/syncro/SyncroCompassMode";
import { SyncroMapMode } from "@/components/syncro/SyncroMapMode";
import { SyncroMarketingOrientationProvider } from "@/components/syncro/SyncroMarketingOrientationProvider";
import { ThreeModeToggle } from "@/components/syncro/ThreeModeToggle";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import type { DirectionId } from "@/lib/syncro/current-system";
import {
  buildSyncroMarketingDemoSession,
  SYNCRO_MARKETING_DEMO_LIVE_PERIOD,
} from "@/lib/syncro/syncro-marketing-demo-session";
import type { SyncroUiMode } from "@/lib/syncro/syncro-view-helpers";
import type { HourPeriod } from "@/lib/syncro/types";

import "@/styles/syncro.css";
import "@/styles/syncro-layout.css";
import "@/styles/syncro-hour-progress.css";
import "@/styles/syncro-compass.css";
import "@/styles/syncro-ar.css";
import "@/styles/syncro-marketing-preview.css";

const PREVIEW_WIDTH = 390;
const PREVIEW_HEIGHT = 844;

function SyncroMarketingPreviewInner() {
  const locale = useLocale();
  const session = useMemo(() => buildSyncroMarketingDemoSession(locale), [locale]);
  const [uiMode, setUiMode] = useState<SyncroUiMode>("compass");
  const [activeHour, setActiveHour] = useState<HourPeriod>(SYNCRO_MARKETING_DEMO_LIVE_PERIOD);
  const [activeDirection, setActiveDirection] = useState<DirectionId>("E");

  return (
    <div className="syncro-marketing-phone-preview">
      <div
        className="syncro-marketing-phone-preview__frame"
        style={
          {
            ["--syncro-preview-width" as string]: `${PREVIEW_WIDTH}px`,
            ["--syncro-preview-height" as string]: `${PREVIEW_HEIGHT}px`,
          } as CSSProperties
        }
      >
        <div className="syncro-marketing-phone-preview__viewport">
          <SyncroMarketingOrientationProvider uiMode={uiMode}>
            <div className={`syncro-main-view syncro-main syncro-main-view--marketing syncro-main-view--${uiMode}`}>
              <HourProgressBar
                matrix={session.matrix}
                llmMeta={session.llm_meta}
                orderedPeriods={HOUR_ORDER}
                livePeriod={SYNCRO_MARKETING_DEMO_LIVE_PERIOD}
                activeHour={activeHour}
                onSelect={setActiveHour}
                locale={locale}
              />

              <div className="syncro-display syncro-mode-stage">
                {uiMode === "compass" ? (
                  <SyncroCompassMode
                    session={session}
                    locale={locale}
                    hourPeriod={activeHour}
                    marketingPreview
                  />
                ) : null}

                {uiMode === "ar" ? (
                  <SyncroARMode
                    session={session}
                    locale={locale}
                    hourPeriod={activeHour}
                    marketingPreview
                  />
                ) : null}

                {uiMode === "map" ? (
                  <SyncroMapMode
                    session={session}
                    locale={locale}
                    hourPeriod={activeHour}
                    activeDirection={activeDirection}
                    onSelectDirection={setActiveDirection}
                    marketingPreview
                  />
                ) : null}
              </div>

              <ThreeModeToggle mode={uiMode} onChange={setUiMode} />
            </div>
          </SyncroMarketingOrientationProvider>
        </div>
      </div>
    </div>
  );
}

export function SyncroMarketingPhonePreview() {
  return <SyncroMarketingPreviewInner />;
}
