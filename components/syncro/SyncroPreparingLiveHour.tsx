"use client";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import type { SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import { hourPeriodDisplayName, HOUR_PERIOD_RANGES } from "@/lib/syncro/hour-period-ranges";
import { getFirstSubmissionBatchPair } from "@/lib/syncro/syncro-submission-schedule";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

type Props = {
  session: SyncroSession;
  locale: string;
  realtimePeriod: HourPeriod;
  progress: SyncroLlmProgress;
};

/**
 * Waiting UI while Inngest generates copy in the cloud (client only polls KV).
 */
export function SyncroPreparingLiveHour({
  session,
  locale,
  realtimePeriod,
  progress,
}: Props) {
  const [firstHour, secondHour] = getFirstSubmissionBatchPair(session);
  const orderedPeriods = getOrderedHourPeriodsFromSession(session);
  const hourName = hourPeriodDisplayName(firstHour, locale);
  const nextName = hourPeriodDisplayName(secondHour, locale);
  const hourRange = HOUR_PERIOD_RANGES[firstHour];

  const currentLabel = progress.current_hour
    ? hourPeriodDisplayName(progress.current_hour, locale)
    : null;

  return (
    <div className="syncro-preparing-live">
      <HourProgressBar
        matrix={session.matrix}
        llmMeta={session.llm_meta}
        orderedPeriods={orderedPeriods}
        livePeriod={realtimePeriod}
        activeHour={realtimePeriod}
        onSelect={() => {}}
        locale={locale}
      />

      <div className="syncro-preparing-live-body">
        <h2 className="syncro-preparing-live-title" style={{ marginTop: 0 }}>
          AI 正在云端生成中…
        </h2>

        <p className="syncro-preparing-live-hint" style={{ maxWidth: "28rem" }}>
          已提交 12 时辰任务（从 {hourName} 起）。可离开本页，完成后回来即可继续。
        </p>

        <p className="syncro-preparing-live-progress">
          进度：{progress.completed}/12 时辰
          {currentLabel ? ` · 正在处理 ${currentLabel}` : ""}
        </p>

        {progress.context_missing ? (
          <p className="syncro-preparing-live-progress" style={{ color: "#f87171" }}>
            无法加载生成上下文，请从 Archive 打开本任务或重新创建 Syncro。
          </p>
        ) : null}

        {progress.failed > 0 ? (
          <p className="syncro-preparing-live-progress" style={{ color: "#fbbf24" }}>
            {progress.failed} 个时辰生成失败，进入罗盘后可对单时辰重试。
          </p>
        ) : null}

        <p className="syncro-preparing-live-hint" style={{ maxWidth: "28rem", opacity: 0.85 }}>
          时间轴 NOW = {realtimePeriod}（{hourPeriodDisplayName(realtimePeriod, locale)}）
          <br />
          首批序列：{firstHour} + {secondHour}（{hourRange}）
        </p>

        <p className="syncro-preparing-live-hint" style={{ marginTop: 20 }}>
          使用 V4 Pro 深度推理，全程在后台运行（Inngest）
          <br />
          离开、切换 App 或熄屏不会中断生成
        </p>
      </div>
    </div>
  );
}
