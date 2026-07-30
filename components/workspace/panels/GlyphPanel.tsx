"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { GlyphDrawStage } from "@/components/glyph/GlyphDrawPage";
import { GlyphReadingStage } from "@/components/glyph/GlyphReadingPage";
import { OracleProductHero } from "@/components/marketing/oracle-product-hero";
import {
  useWorkspaceGlyphPrepare,
} from "@/components/workspace/WorkspaceGlyphPrepareContext";
import { WorkspaceGlyphPreparingStage } from "@/components/workspace/WorkspaceGlyphPreparingStage";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { WorkspaceUsageGuideLink } from "@/components/workspace/WorkspaceUsageGuideLink";

import "@/styles/glyph-home.css";
import "@/styles/chart-loader.css";
import "@/styles/tool-preview-chat.css";

/** Birth UI → preparing crossfade duration (ms). */
const PREPARE_HANDOFF_MS = 480;

/**
 * Glyph workspace: birth home → 10s matrix prepare (right rail opens) →
 * center welcome + question → draw → reading. Stays on /app?tab=glyph.
 */
export function GlyphPanel() {
  const t = useTranslations("marketingSite.glyph");
  const [hasProfiles, setHasProfiles] = useState(false);
  const glyph = useWorkspaceGlyphPrepare();

  const heroCopy = {
    brandTag: t("hero.brand_tag"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: t.has("hero.tagline") ? t("hero.tagline") : undefined,
    cta: t("hero.cta"),
    billingNotice: t("hero.billing_notice"),
  };

  useEffect(() => {
    if (glyph.phase !== "handoff") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : PREPARE_HANDOFF_MS;
    const timer = window.setTimeout(() => glyph.setPhase("preparing"), ms);
    return () => window.clearTimeout(timer);
  }, [glyph.phase, glyph.setPhase]);

  if (glyph.phase === "preparing" || glyph.phase === "handoff") {
    return (
      <div className="workspace-poju-stack workspace-poju-stack--chat workspace-glyph-flow">
        {glyph.phase === "preparing" ? <WorkspaceGlyphPreparingStage /> : null}
      </div>
    );
  }

  if (glyph.phase === "draw" && glyph.profileId) {
    return (
      <div className="workspace-poju-stack workspace-poju-stack--chat workspace-glyph-flow">
        <GlyphDrawStage
          profileId={glyph.profileId}
          initialMatrix={glyph.matrixPayload}
          initialNarrative={glyph.narrative}
          narrativeOnly
          onReadingReady={(id) => {
            glyph.setReadingId(id);
            glyph.setPhase("reading");
          }}
          onBack={glyph.resetPrepare}
        />
      </div>
    );
  }

  if (glyph.phase === "reading" && glyph.readingId) {
    return (
      <div className="workspace-poju-stack workspace-poju-stack--chat workspace-glyph-flow">
        <GlyphReadingStage
          readingId={glyph.readingId}
          onHome={glyph.resetPrepare}
        />
      </div>
    );
  }

  return (
    <div className="workspace-product-stack workspace-poju-stack">
      <div className="workspace-product-hero workspace-poju-hero">
        <OracleProductHero copy={heroCopy} hideActions />
      </div>
      <div className="workspace-product-below workspace-poju-below">
        <div className="workspace-poju-below__cluster">
          <div className="workspace-poju-below__unit">
            <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
            <div className="workspace-poju-birth">
              <WorkspacePojuBirthHost
                onHasProfilesChange={setHasProfiles}
                onPrepareStart={glyph.startPrepare}
                usageProduct="glyph"
              />
            </div>
          </div>
          <WorkspaceUsageGuideLink />
        </div>
      </div>
    </div>
  );
}
