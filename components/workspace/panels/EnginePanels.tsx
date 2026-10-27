"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { JointSessionOpenHost } from "@/components/poju/JointSessionOpenHost";
import { BeginButton, type BeginProductId } from "@/components/pwa/BeginButton";
import { WorkspaceContextPanel } from "@/components/workspace/WorkspaceContextPanel";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { WorkspacePojuChatStage } from "@/components/workspace/WorkspacePojuChatStage";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { WorkspacePojuPreparingStage } from "@/components/workspace/WorkspacePojuPreparingStage";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";
import { useWorkspaceUnlockRitualResume } from "@/components/workspace/useWorkspaceUnlockRitualResume";
import { useWorkspaceProductHistory } from "@/components/workspace/use-workspace-product-history";
import type { JointDecisionPublicView } from "@/lib/passes/household-types";
import {
  JOINT_ENTRY_MODE_EVENT,
  JOINT_OPEN_EVENT,
  type JointEntryMode,
  type JointEntryModeDetail,
  type JointOpenDetail,
  requestJointEntryMode,
} from "@/lib/poju/joint-client-events";
import { readPendingLangSwitch } from "@/lib/poju/pending-lang-switch";
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
export function PojuPanel({ onOpenArchive }: { onOpenArchive: (id: string) => void }) {
  const t = useTranslations("workspace.sessionOpen");
  const locale = useLocale();
  const { phase, startPrepare, setPhase, resumingSessionId, session, resetPrepare } =
    useWorkspacePojuPrepare();
  useWorkspaceUnlockRitualResume(locale);
  const tDensity = useTranslations("workspace.density");

  const [hasProfiles, setHasProfiles] = useState(false);
  const [entryMode, setEntryMode] = useState<JointEntryMode>("solo");
  const [openJointId, setOpenJointId] = useState<string | null>(null);
  const [openJointPreview, setOpenJointPreview] = useState<JointDecisionPublicView | null>(
    null,
  );

  useEffect(() => {
    function onEntry(e: Event) {
      const mode = (e as CustomEvent<JointEntryModeDetail>).detail?.mode;
      if (mode === "solo" || mode === "joint") {
        setOpenJointId(null);
        setOpenJointPreview(null);
        setEntryMode(mode);
      }
    }
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<JointOpenDetail>).detail;
      const id = detail?.jointId?.trim();
      if (!id) return;
      setEntryMode("solo");
      setOpenJointPreview(detail.preview ?? null);
      setOpenJointId(id);
      resetPrepare();
    }
    window.addEventListener(JOINT_ENTRY_MODE_EVENT, onEntry);
    window.addEventListener(JOINT_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(JOINT_ENTRY_MODE_EVENT, onEntry);
      window.removeEventListener(JOINT_OPEN_EVENT, onOpen);
    };
  }, [resetPrepare]);

  // Do NOT clear openJointId when phase→chat: joint preview + PASS tip + auto-send
  // all run with phase=chat; clearing remounts chat and drops JointSessionOpenHost
  // (same for initiator + invitee). History / solo entry already clears via
  // requestJointEntryMode; new joint via JOINT_OPEN.

  /* Avoid flashing birth home while Stripe return / mid-chat locale switch resumes. */
  const [unlockResumeGate, setUnlockResumeGate] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (sessionStorage.getItem(POJU_WORKSPACE_UNLOCK_RITUAL_KEY)?.trim()) return true;
      if (readPendingLangSwitch()) return true;
      if (new URLSearchParams(window.location.search).get("session")?.trim()) return true;
    } catch {
      /* private mode */
    }
    return false;
  });

  /** session= or pending lang-switch — never mount the hero before chat hydrate. */
  useLayoutEffect(() => {
    try {
      const sid = new URLSearchParams(window.location.search).get("session")?.trim();
      if (sid || readPendingLangSwitch()) setUnlockResumeGate(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (phase !== "idle") setUnlockResumeGate(false);
  }, [phase]);

  useEffect(() => {
    if (!unlockResumeGate) return;
    const timer = window.setTimeout(() => {
      const sid = new URLSearchParams(window.location.search).get("session")?.trim();
      if (sid || readPendingLangSwitch()) return;
      setUnlockResumeGate(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [unlockResumeGate]);

  const isJointEntry = entryMode === "joint";
  const heroCopy = {
    brandTag: isJointEntry ? t("h1_joint") : t("h1_solo"),
    heading: isJointEntry ? t("body_joint") : t("body_solo"),
    description: isJointEntry ? t("lead_joint") : t("lead_solo"),
    leadIn: "",
    tagline: "",
    ctaPrimary: "",
    billingNotice: "",
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

  if (openJointId) {
    return (
      <div className="workspace-poju-stack workspace-poju-stack--joint">
        {phase === "chat" && session ? (
          <div className="workspace-poju-chat-layer">
            <WorkspacePojuChatStage />
          </div>
        ) : null}
        {/* Stay mounted through portrait close so charge tip can fire. */}
        <JointSessionOpenHost
          jointId={openJointId}
          initialJoint={openJointPreview}
          onClose={() => {
            setOpenJointId(null);
            setOpenJointPreview(null);
            requestJointEntryMode("solo");
          }}
          onEnteredChat={() => {
            // Keep openJointId: host stays mounted (phase done → null UI) so the
            // chat layer is not remounted mid 3s PASS tip / auto-send.
            setOpenJointPreview(null);
          }}
        />
      </div>
    );
  }

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
        <div
          className={`workspace-product-hero workspace-poju-hero workspace-atmos-hero workspace-poju-hero--${entryMode}`}
        >
          <PojuProductHero
            copy={heroCopy}
            hideActions
            workspaceMotion="spline-constellation"
            scene="/spline/atmoswork.splinecode"
            initialZoom={1.15}
            hideStarrySky
            hideVignette
          />
        </div>
        <div className="workspace-product-below workspace-poju-below">
          <div className="workspace-poju-below__cluster">
            <div className="workspace-poju-below__unit">
              <WorkspacePojuBirthSideCopy
                hasBirthHistory={hasProfiles}
                entryMode={entryMode}
              />
              <WorkspacePojuBirthHost
                  jointInitiate={entryMode === "joint"}
                  onPrepareStart={startPrepare}
                  onHasProfilesChange={setHasProfiles}
                  onJointCreated={() => {
                    requestJointEntryMode("solo");
                    setEntryMode("solo");
                  }}
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
          <div
            className={`workspace-product-hero workspace-poju-hero workspace-atmos-hero workspace-poju-hero--${entryMode}`}
          >
            <PojuProductHero
              copy={heroCopy}
              hideActions
              workspaceMotion="spline-constellation"
              scene="/spline/atmoswork.splinecode"
              initialZoom={1.15}
              hideStarrySky
              hideVignette
            />
          </div>
          <div className="workspace-product-below workspace-poju-below">
            <div className="workspace-poju-below__cluster">
              <div className="workspace-poju-below__unit">
                <WorkspacePojuBirthSideCopy
                  hasBirthHistory={hasProfiles}
                  entryMode={entryMode}
                />
                <WorkspacePojuBirthHost
                      jointInitiate={entryMode === "joint"}
                      onPrepareStart={startPrepare}
                      onHasProfilesChange={setHasProfiles}
                      onJointCreated={() => {
                        requestJointEntryMode("solo");
                        setEntryMode("solo");
                      }}
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
