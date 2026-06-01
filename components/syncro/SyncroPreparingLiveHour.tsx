"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import type { SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import { hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

type Props = {
  session: SyncroSession;
  locale: string;
  livePeriod: HourPeriod;
  progress: SyncroLlmProgress;
};

/** Full-screen wait until the live hour's LLM batch finishes (before compass). */
export function SyncroPreparingLiveHour({ session, locale, livePeriod, progress }: Props) {
  const t = useTranslations("syncro.preparing_live");

  const orderedPeriods = getOrderedHourPeriodsFromSession(session);
  const hourName = hourPeriodDisplayName(livePeriod, locale);

  return (
    <div className="syncro-preparing-live">
      <HourProgressBar
        matrix={session.matrix}
        llmMeta={session.llm_meta}
        orderedPeriods={orderedPeriods}
        livePeriod={livePeriod}
        activeHour={livePeriod}
        onSelect={() => {}}
        locale={locale}
      />

      <div className="syncro-preparing-live-body">
        <IconLoader2 className="syncro-preparing-live-spin" aria-hidden size={32} stroke={1.5} />
        <h2 className="syncro-preparing-live-title">{t("title", { hour: hourName })}</h2>
        <p className="syncro-preparing-live-hint">{t("hint")}</p>
        {progress.running && progress.current_hour ? (
          <p className="syncro-preparing-live-progress">
            {t("progress", {
              hour: hourPeriodDisplayName(progress.current_hour, locale),
              done: progress.completed,
              total: progress.total,
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
