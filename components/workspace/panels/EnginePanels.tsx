"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MatchProductHero } from "@/components/marketing/match-product-hero";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { MatchDeliveryView } from "@/components/match/MatchDeliveryView";
import { ToolPaywallInline } from "@/components/cross-product/ToolPaywallInline";
import { BeginButton, type BeginProductId } from "@/components/pwa/BeginButton";
import { WorkspaceContextPanel } from "@/components/workspace/WorkspaceContextPanel";
import { WorkspaceMatchBirthSideCopy } from "@/components/workspace/WorkspaceMatchBirthSideCopy";
import { WorkspaceMatchGeneratingStage } from "@/components/workspace/WorkspaceMatchGeneratingStage";
import { WorkspaceMatchInquiryForm } from "@/components/workspace/WorkspaceMatchInquiryForm";
import { useWorkspaceMatchPrepare } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { WorkspaceMatchWarmupStage } from "@/components/workspace/WorkspaceMatchWarmupStage";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { WorkspacePojuChatStage } from "@/components/workspace/WorkspacePojuChatStage";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { WorkspacePojuPreparingStage } from "@/components/workspace/WorkspacePojuPreparingStage";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { WorkspaceUsageGuideLink } from "@/components/workspace/WorkspaceUsageGuideLink";
import { useWorkspaceUnlockRitualResume } from "@/components/workspace/useWorkspaceUnlockRitualResume";
import { useWorkspaceProductHistory } from "@/components/workspace/use-workspace-product-history";
import {
  ensureMatchPreviewSession,
  loadMatchPreviewSession,
  patchMatchPreviewSession,
} from "@/lib/match/match-preview-session";
import { isMatchPreviewSession } from "@/lib/match/match-preview-unlock";
import { POJU_WORKSPACE_UNLOCK_RITUAL_KEY } from "@/lib/poju/preview-unlock";

const PRESET_KEYS = ["career", "relationship", "timing"] as const;

/** Birth UI → preparing Spline crossfade duration (ms). */
const PREPARE_HANDOFF_MS = 480;

type Props = {
  /** Engine home CTA products only — Atmos has its own panel. */
  productId: BeginProductId;
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
  const { phase, startPrepare, setPhase, resumingSessionId, session } =
    useWorkspacePojuPrepare();
  useWorkspaceUnlockRitualResume(locale);
  const tDensity = useTranslations("workspace.density");

  /* Avoid flashing birth home while Stripe return resumes unlock pipeline. */
  const [unlockResumeGate, setUnlockResumeGate] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(sessionStorage.getItem(POJU_WORKSPACE_UNLOCK_RITUAL_KEY)?.trim());
    } catch {
      return false;
    }
  });

  /** URL already has session= — never mount the 100k-particle hero before IndexedDB hydrate. */
  useLayoutEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session")?.trim();
    if (sid) setUnlockResumeGate(true);
  }, []);

  useEffect(() => {
    if (phase !== "idle") setUnlockResumeGate(false);
  }, [phase]);

  useEffect(() => {
    if (!unlockResumeGate) return;
    const timer = window.setTimeout(() => {
      const sid = new URLSearchParams(window.location.search).get("session")?.trim();
      if (sid) return;
      setUnlockResumeGate(false);
    }, 5000);
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
    const showResumeSpinner = Boolean(resumingSessionId);

    return (
      <div
        className="workspace-poju-stack workspace-poju-stack--chat"
        aria-busy={showResumeSpinner || phase === "idle" || undefined}
      >
        {showResumeSpinner ? (
          <div
            className="workspace-poju-resume"
            role="status"
            aria-live="polite"
            aria-label={tDensity("historyLoading")}
          >
            <span className="workspace-poju-resume__spin" aria-hidden />
            <p className="workspace-poju-resume__label">{tDensity("sessionOpening")}</p>
          </div>
        ) : phase === "chat" && session ? (
          <div className="workspace-poju-chat-layer">
            <WorkspacePojuChatStage />
          </div>
        ) : null}
      </div>
    );
  }

  /* Idle home: flat stack (hero + below) — same as pre-crossfade HEAD layout.
     Layered crossfade only while handing off / preparing. */
  if (phase === "idle") {
    return (
      <div className="workspace-product-stack workspace-poju-stack">
        <div className="workspace-product-hero workspace-poju-hero">
          <PojuProductHero copy={heroCopy} hideActions />
        </div>
        <div className="workspace-product-below workspace-poju-below">
          <div className="workspace-poju-below__cluster">
            <div className="workspace-poju-below__unit">
              <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
              <div className="workspace-poju-birth">
                <WorkspacePojuBirthHost
                  onHasProfilesChange={setHasProfiles}
                  onPrepareStart={startPrepare}
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
          <div className="workspace-product-hero workspace-poju-hero">
            <PojuProductHero copy={heroCopy} hideActions />
          </div>
          <div className="workspace-product-below workspace-poju-below">
            <div className="workspace-poju-below__cluster">
              <div className="workspace-poju-below__unit">
                <WorkspacePojuBirthSideCopy hasProfiles={hasProfiles} />
                <div className="workspace-poju-birth">
                  <WorkspacePojuBirthHost
                    onHasProfilesChange={setHasProfiles}
                    onPrepareStart={startPrepare}
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
          <WorkspacePojuPreparingStage />
        </div>
      ) : null}
    </div>
  );
}

export function MatchPanel({ onOpenArchive: _onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  const t = useTranslations("match.home");
  const locale = useLocale();
  const [hasProfiles, setHasProfiles] = useState(false);
  const match = useWorkspaceMatchPrepare();

  useEffect(() => {
    if (match.phase !== "paywall") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") match.setPhase("inquiry");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match.phase, match.setPhase]);

  const heroCopy = {
    brandTag: t("brand_tag"),
    heading: t("heading"),
    description: t("description"),
    cta: t("cta"),
    billingNotice: t("billing_notice"),
  };

  function handleBirthConfirmed(profileId: string) {
    if (match.collectingSlot === "a") {
      match.setProfileA(profileId);
      match.setCollectingSlot("b");
      return;
    }
    if (profileId === match.profileIdA) {
      return;
    }
    match.setProfileB(profileId);
    match.beginWarmup();
  }

  function handleInquirySubmit(relationshipOverride?: string) {
    const q = (relationshipOverride ?? match.relationship).trim();
    if (q.length < 10 || !match.profileIdA || !match.profileIdB) return;

    match.setRelationship(q);

    try {
      sessionStorage.setItem("match_relationship", q);
      sessionStorage.setItem("match_a_profile_id", match.profileIdA);
      sessionStorage.setItem("match_b_profile_id", match.profileIdB);
    } catch {
      /* private mode */
    }

    const preview = ensureMatchPreviewSession({
      a_profile_id: match.profileIdA,
      b_profile_id: match.profileIdB,
      locale,
    });
    match.setPreviewId(preview.preview_id);
    patchMatchPreviewSession({
      pending_question: q,
      unlock_status: preview.unlock_status === "unlocked" ? "unlocked" : "preview",
    });

    const next = loadMatchPreviewSession();
    if (next && isMatchPreviewSession(next)) {
      match.setPhase("paywall");
      return;
    }
    match.setPhase("generating");
  }

  async function handleUnlocked() {
    const q = match.relationship.trim();
    patchMatchPreviewSession({
      unlock_status: "unlocked",
      pending_question: q,
    });
    try {
      sessionStorage.setItem("match_relationship", q);
    } catch {
      /* private mode */
    }
    match.setPhase("generating");
  }

  if (match.phase === "warmup") {
    return (
      <div className="workspace-product-stack workspace-poju-stack workspace-match-stack">
        <WorkspaceMatchWarmupStage />
      </div>
    );
  }

  if (match.phase === "inquiry" || match.phase === "paywall") {
    return (
      <div className="workspace-product-stack workspace-poju-stack workspace-match-stack workspace-match-stack--inquiry">
        <WorkspaceMatchInquiryForm
          onClarified={(relationshipDescription) => handleInquirySubmit(relationshipDescription)}
          submitBusy={match.phase === "paywall"}
        />
        {match.phase === "paywall" && match.previewId ? (
          <div
            className="workspace-match-paywall-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-match-paywall-title"
          >
            <button
              type="button"
              className="workspace-match-paywall-modal__backdrop"
              aria-label="Close"
              onClick={() => match.setPhase("inquiry")}
            />
            <div className="workspace-match-paywall-modal__panel" id="workspace-match-paywall-title">
              <ToolPaywallInline
                product="match"
                previewId={match.previewId}
                locale={locale}
                pendingQuestion={match.relationship.trim()}
                onUnlocked={() => void handleUnlocked()}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (match.phase === "generating") {
    return (
      <div className="workspace-product-stack workspace-poju-stack workspace-match-stack">
        <WorkspaceMatchGeneratingStage />
      </div>
    );
  }

  if (match.phase === "delivery" && match.matchSession) {
    return (
      <div className="workspace-product-stack workspace-poju-stack workspace-match-stack workspace-match-stack--delivery">
        <WorkspaceScrollArea className="workspace-match-delivery" fixedThumbPx={52}>
          <MatchDeliveryView session={match.matchSession} locale={locale} variant="live" />
        </WorkspaceScrollArea>
      </div>
    );
  }

  /* Stage 1 — Match A then Match B birth entry */
  return (
    <div className="workspace-product-stack workspace-poju-stack">
      <div className="workspace-product-hero">
        <MatchProductHero copy={heroCopy} hideActions />
      </div>
      <div className="workspace-product-below workspace-poju-below">
        <div className="workspace-poju-below__cluster">
          <div className="workspace-poju-below__unit">
            <WorkspaceMatchBirthSideCopy hasProfiles={hasProfiles} />
            <div className="workspace-poju-birth">
              <WorkspacePojuBirthHost
                key={match.collectingSlot}
                usageProduct="match"
                matchCollectingSlot={match.collectingSlot}
                excludeProfileId={match.collectingSlot === "b" ? match.profileIdA : null}
                onHasProfilesChange={setHasProfiles}
                onPrepareStart={handleBirthConfirmed}
              />
            </div>
          </div>
          <WorkspaceUsageGuideLink />
        </div>
      </div>
    </div>
  );
}
