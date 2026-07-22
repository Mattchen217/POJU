"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { BeginButton } from "@/components/pwa/BeginButton";
import { WorkspaceContextPanel } from "@/components/workspace/WorkspaceContextPanel";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";
import {
  useWorkspaceProductHistory,
  type WorkspaceProductId,
} from "@/components/workspace/use-workspace-product-history";

const PRESET_KEYS = ["career", "relationship", "timing"] as const;

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

/** Workspace center — POJU hero + birth form or returning-user profile list. */
export function PojuPanel({ onOpenArchive: _onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  const t = useTranslations("marketingSite.poju");
  const tBrand = useTranslations("poju.branding");
  const [hasProfiles, setHasProfiles] = useState(false);

  const heroCopy = {
    brandTag: t("hero.brand_tag"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: tBrand("hero_tagline"),
    ctaPrimary: t("hero.cta_primary"),
    billingNotice: t("hero.billing_notice"),
  };

  return (
    <div className="workspace-poju-stack">
      <div className="workspace-poju-hero">
        <PojuProductHero copy={heroCopy} hideActions />
      </div>
      <div className="workspace-poju-below">
        <div className="workspace-poju-below__unit">
          <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
          <div className="workspace-poju-birth">
            <WorkspacePojuBirthHost onHasProfilesChange={setHasProfiles} />
          </div>
        </div>
      </div>
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
