"use client";

import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import type { StoredProfileData } from "@/lib/db/poju-db";

type Props = {
  profile: StoredProfileData | null;
  locale: string;
  error?: string | null;
  onRetry?: () => void;
  onBack: () => void;
  backLabel?: string;
};

/** Phase ① — energy matrix prep (chart_loader) after birth info, before tool preview. */
export function ToolPreviewMatrixLoading({
  profile,
  locale,
  error,
  onRetry,
  onBack,
  backLabel,
}: Props) {
  if (!profile) {
    return (
      <PreparingSplineShell blockInteraction>
        <PreparingStatusOverlay>
          <p className="preparing-spline-page__status" role="status" aria-live="polite">
            …
          </p>
        </PreparingStatusOverlay>
      </PreparingSplineShell>
    );
  }

  return (
    <PreparingSplineShell blockInteraction>
      <ChartReadingLoader
        profile={profile}
        currentStep={error ? "error" : "analyzing"}
        error={error ?? null}
        onRetry={onRetry ?? (() => {})}
        onRefund={onBack}
        locale={locale}
        variant="matrix"
        secondaryActionLabel={backLabel}
      />
    </PreparingSplineShell>
  );
}
