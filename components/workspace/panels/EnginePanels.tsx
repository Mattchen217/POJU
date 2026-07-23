"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { BeginButton } from "@/components/pwa/BeginButton";
import { WorkspaceContextPanel } from "@/components/workspace/WorkspaceContextPanel";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { WorkspacePojuChatStage } from "@/components/workspace/WorkspacePojuChatStage";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { WorkspacePojuPreparingStage } from "@/components/workspace/WorkspacePojuPreparingStage";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";
import { WorkspaceUnlockRitual } from "@/components/workspace/WorkspaceUnlockRitual";
import { useWorkspaceUnlockRitualResume } from "@/components/workspace/useWorkspaceUnlockRitualResume";
import {
  useWorkspaceProductHistory,
  type WorkspaceProductId,
} from "@/components/workspace/use-workspace-product-history";
import { POJU_WORKSPACE_UNLOCK_RITUAL_KEY } from "@/lib/poju/preview-unlock";

const PRESET_KEYS = ["career", "relationship", "timing"] as const;

/** Birth UI → preparing Spline crossfade duration (ms). */
const PREPARE_HANDOFF_MS = 480;

type Props = {
  productId: WorkspaceProductId;
  price: string;
  onOpenArchive: (archiveId: string) => void;
};

export function EnginePanel({ productId, price, onOpenArchive }: Props) {
  const t = useTranslations(`workspace.${productId}`);
  const tWs = useTranslations("workspace");
  const tDensity = useTranslations("workspace.density");
  const [dilemma, setDilemma] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const { items: recent } = useWorkspaceProductHistory(productId, 8);

  const presets = useMemo(
    () =>
      PRESET_KEYS.map((key) => ({
        key,
        label: tDensity(`presets.${key}.label`),
        prompt: tDensity(`presets.${key}.prompt`),
      })),
    [tDensity],
  );

  function applyPreset(key: string, prompt: string) {
    setActivePreset(key);
    setDilemma(prompt);
  }

  return (
    <div className="workspace-dual">
      <div className="workspace-dual__glow" aria-hidden />
      <section className="workspace-dual__main">
        <header className="workspace-micro-header">
          <h2 className="workspace-micro-header__title">{t("headline")}</h2>
          <p className="workspace-micro-header__sub">{t("guidance")}</p>
        </header>

        <div className="workspace-glass-panel workspace-form-panel">
          <WorkspaceProfileSlotBar showAddAffordance />

          <div className="workspace-presets" role="group" aria-label={tDensity("presetsLabel")}>
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                className="workspace-preset-chip"
                aria-pressed={activePreset === p.key}
                onClick={() => applyPreset(p.key, p.prompt)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor={`workspace-dilemma-${productId}`}>
            {tWs("dilemmaLabel")}
          </label>
          <textarea
            id={`workspace-dilemma-${productId}`}
            className="workspace-dilemma-field"
            placeholder={t("placeholder")}
            value={dilemma}
            onChange={(e) => {
              setDilemma(e.target.value);
              setActivePreset(null);
            }}
            rows={6}
          />
          <p className="workspace-dilemma-hint">
            {tWs("dilemmaHint", { product: productId.toUpperCase() })}
          </p>

          <div className="workspace-panel__begin workspace-panel__begin--cta">
            <BeginButton productId={productId} price={price} useMarketingLabels />
          </div>
        </div>
      </section>

      <WorkspaceContextPanel
        productId={productId}
        recent={recent}
        onOpenArchive={onOpenArchive}
        className="workspace-context--mobile-only"
      />
    </div>
  );
}

/** Workspace center — birth entry, then preparing Spline → chat shell. */
export function PojuPanel({ onOpenArchive: _onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  const t = useTranslations("marketingSite.poju");
  const tBrand = useTranslations("poju.branding");
  const locale = useLocale();
  const [hasProfiles, setHasProfiles] = useState(false);
  const { phase, startPrepare, setPhase, unlockRitualActive } = useWorkspacePojuPrepare();
  useWorkspaceUnlockRitualResume(locale);

  /* Avoid flashing birth home while Stripe return resumes unlock ritual. */
  const [unlockResumeGate, setUnlockResumeGate] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(sessionStorage.getItem(POJU_WORKSPACE_UNLOCK_RITUAL_KEY)?.trim());
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (phase !== "idle") setUnlockResumeGate(false);
  }, [phase]);

  useEffect(() => {
    if (!unlockResumeGate) return;
    const timer = window.setTimeout(() => setUnlockResumeGate(false), 5000);
    return () => window.clearTimeout(timer);
  }, [unlockResumeGate]);

  const heroCopy = {
    brandTag: t("hero.brand_tag"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: tBrand("hero_tagline"),
    ctaPrimary: t("hero.cta_primary"),
    billingNotice: t("hero.billing_notice"),
  };

  // Confirm → fade out birth/hero, then reveal preparing (Spline already preloading underneath).
  useEffect(() => {
    if (phase !== "handoff") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : PREPARE_HANDOFF_MS;
    const timer = window.setTimeout(() => setPhase("preparing"), ms);
    return () => window.clearTimeout(timer);
  }, [phase, setPhase]);

  if (phase === "chat" || (phase === "idle" && unlockResumeGate)) {
    return (
      <div
        className="workspace-poju-stack workspace-poju-stack--chat"
        aria-busy={phase === "idle" || unlockRitualActive || undefined}
      >
        {phase === "chat" ? (
          <div
            className={`workspace-poju-chat-layer${
              unlockRitualActive ? " is-fade-out" : ""
            }`}
          >
            <WorkspacePojuChatStage />
          </div>
        ) : null}
        {unlockRitualActive ? (
          <div className="workspace-unlock-ritual-layer is-fade-in">
            <WorkspaceUnlockRitual />
          </div>
        ) : null}
      </div>
    );
  }

  /* Idle home: flat stack (hero + below) — same as pre-crossfade HEAD layout.
     Layered crossfade only while handing off / preparing. */
  if (phase === "idle") {
    return (
      <div className="workspace-poju-stack">
        <div className="workspace-poju-hero">
          <PojuProductHero copy={heroCopy} hideActions />
        </div>
        <div className="workspace-poju-below">
          <div className="workspace-poju-below__unit">
            <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
            <div className="workspace-poju-birth">
              <WorkspacePojuBirthHost
                onHasProfilesChange={setHasProfiles}
                onPrepareStart={startPrepare}
              />
            </div>
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
          <div className="workspace-poju-hero">
            <PojuProductHero copy={heroCopy} hideActions />
          </div>
          <div className="workspace-poju-below">
            <div className="workspace-poju-below__unit">
              <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
              <div className="workspace-poju-birth">
                <WorkspacePojuBirthHost
                  onHasProfilesChange={setHasProfiles}
                  onPrepareStart={startPrepare}
                />
              </div>
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
          <WorkspacePojuPreparingStage />
        </div>
      ) : null}
    </div>
  );
}

export function MatchPanel({ onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  return <EnginePanel productId="match" price="$9.99" onOpenArchive={onOpenArchive} />;
}

export function SyncroPanel({ onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  return <EnginePanel productId="syncro" price="Free" onOpenArchive={onOpenArchive} />;
}

export function GlyphPanel({ onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  return <EnginePanel productId="glyph" price="$9.99" onOpenArchive={onOpenArchive} />;
}
