"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { WorkspaceAtmosForecastStage } from "@/components/workspace/WorkspaceAtmosForecastStage";
import { WorkspaceAtmosPreparingStage } from "@/components/workspace/WorkspaceAtmosPreparingStage";
import { useWorkspaceAtmosPrepare } from "@/components/workspace/WorkspaceAtmosPrepareContext";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { WorkspaceUsageGuideLink } from "@/components/workspace/WorkspaceUsageGuideLink";

/** Birth UI → preparing Spline crossfade duration (ms). */
const PREPARE_HANDOFF_MS = 480;

/**
 * Atmos workspace center: birth (same as POJU) → 10s prepare → 30-day forecast grid.
 */
export function AtmosPanel() {
  const t = useTranslations("workspace.atmos");
  const tBrand = useTranslations("poju.branding");
  const [hasProfiles, setHasProfiles] = useState(false);
  const { phase, startPrepare, setPhase } = useWorkspaceAtmosPrepare();

  const heroCopy = {
    brandTag: t("hero.brandTag"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: tBrand("hero_tagline"),
    ctaPrimary: t("hero.ctaPrimary"),
    billingNotice: t("hero.billingNotice"),
  };

  useEffect(() => {
    if (phase !== "handoff") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : PREPARE_HANDOFF_MS;
    const timer = window.setTimeout(() => setPhase("preparing"), ms);
    return () => window.clearTimeout(timer);
  }, [phase, setPhase]);

  if (phase === "forecast") {
    return (
      <div className="workspace-poju-stack workspace-poju-stack--chat">
        <div className="workspace-poju-chat-layer">
          <WorkspaceAtmosForecastStage />
        </div>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div className="workspace-product-stack workspace-poju-stack">
        <div className="workspace-product-hero workspace-poju-hero workspace-atmos-hero">
          <PojuProductHero
            copy={heroCopy}
            hideActions
            scene="/spline/atmoswork.splinecode"
            initialZoom={0.92}
            hideStarrySky
            hideVignette
          />
        </div>
        <div className="workspace-product-below workspace-poju-below">
          <div className="workspace-poju-below__cluster">
            <div className="workspace-poju-below__unit">
              <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
              <div className="workspace-poju-birth">
                <WorkspacePojuBirthHost
                  onHasProfilesChange={setHasProfiles}
                  onPrepareStart={startPrepare}
                  usageProduct="atmos"
                />
              </div>
            </div>
            <WorkspaceUsageGuideLink />
          </div>
        </div>
      </div>
    );
  }

  const showBirth = phase === "handoff";
  const showPrepare =
    phase === "handoff" || phase === "preparing" || phase === "exiting";
  const birthFading = phase === "handoff";
  const preparePreloading = phase === "handoff";
  const prepareVisible = phase === "preparing" || phase === "exiting";

  return (
    <div
      className={`workspace-poju-stack workspace-poju-stack--crossfade${
        prepareVisible ? " workspace-poju-stack--prepare" : ""
      }${showPrepare ? " workspace-poju-stack--prepare-armed" : ""}`}
      aria-busy={birthFading || undefined}
    >
      {showBirth ? (
        <div
          className={`workspace-poju-stack__layer workspace-poju-stack__layer--birth${
            birthFading ? " is-fade-out" : ""
          }`}
        >
          <div className="workspace-product-hero workspace-poju-hero workspace-atmos-hero">
            <PojuProductHero
              copy={heroCopy}
              hideActions
              scene="/spline/atmoswork.splinecode"
              initialZoom={0.92}
              hideStarrySky
              hideVignette
            />
          </div>
          <div className="workspace-product-below workspace-poju-below">
            <div className="workspace-poju-below__cluster">
              <div className="workspace-poju-below__unit">
                <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
                <div className="workspace-poju-birth">
                  <WorkspacePojuBirthHost
                    onHasProfilesChange={setHasProfiles}
                    onPrepareStart={startPrepare}
                    usageProduct="atmos"
                  />
                </div>
              </div>
              <WorkspaceUsageGuideLink />
            </div>
          </div>
        </div>
      ) : null}

      {showPrepare ? (
        <div
          className={`workspace-poju-stack__layer workspace-poju-stack__layer--prepare${
            preparePreloading ? " is-preload" : ""
          }${prepareVisible ? " is-visible" : ""}`}
        >
          <WorkspaceAtmosPreparingStage />
        </div>
      ) : null}
    </div>
  );
}
