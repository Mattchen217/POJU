"use client";

/**
 * Joint open (initiator = invitee):
 * 10s wait page = work window: PASS charge + baseline portrait generate in parallel.
 * At 10s → open portrait immediately. On close → immediate PASS tip (or insufficient
 * copy) + paint question + model thinking + send. No idle gap after close.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { AtmosThinkingAvatar } from "@/components/poju/AtmosThinkingAvatar";
import { ChartReadingLoader } from "@/components/poju/ChartReadingLoader";
import { useAppDialog } from "@/components/ui/app-dialog";
import { WaitFxLayer } from "@/components/wait-ritual/WaitFxLayer";
import { WorkspacePojuBirthHost } from "@/components/workspace/WorkspacePojuBirthHost";
import { WorkspacePojuBirthSideCopy } from "@/components/workspace/WorkspacePojuBirthSideCopy";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { hydrateJointSessionFromSeed } from "@/lib/poju/hydrate-joint-session";
import {
  JOINT_PASS_RETRY_EVENT,
  JOINT_PORTRAIT_CLOSED_EVENT,
  markAwaitJointPortraitClose,
  notifyJointListUpdated,
} from "@/lib/poju/joint-client-events";
import {
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { finalizeWorkspacePrepare } from "@/lib/poju/finalize-workspace-prepare";
import {
  createJointPassGateMessage,
  markReleasePendingQuestion,
} from "@/lib/poju/preview-unlock";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { dispatchPassSpendToast } from "@/lib/passes/pass-client-events";
import type { JointDecisionPublicView } from "@/lib/passes/household-types";
import type { JointSessionSeed } from "@/lib/passes/joint-decision";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  createStoredProfile,
  getStoredProfile,
  listStoredProfiles,
} from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";
import { DocVaultIds } from "@/lib/workspace/doc-vault-index";
import { markDocVaultUnread } from "@/lib/workspace/doc-vault-unread";
import {
  notifyDocVaultUpdated,
  requestBaselineAutoOpen,
} from "@/lib/workspace/doc-vault-types";

import "@/styles/session-prep.css";

type Phase =
  | "loading"
  | "waiting"
  | "birth_pick"
  | "preparing"
  | "exiting"
  | "awaiting_tip"
  | "pass_blocked"
  | "done";

type ChargeResult =
  | { status: "pending" }
  | { status: "ok"; charged_from: "sub" | "flex"; already_charged: boolean; seed: JointSessionSeed }
  | { status: "fail"; reason: string };

type Props = {
  jointId: string;
  /** Sidebar row — show invite modal immediately without waiting for GET. */
  initialJoint?: JointDecisionPublicView | null;
  onClose: () => void;
  /** After successful hydrate into chat. */
  onEnteredChat?: (sessionId: string) => void;
};

function initialPhase(preview: JointDecisionPublicView | null | undefined): Phase {
  if (!preview) return "loading";
  // Invitee pending: skip confirm modal — go straight to birth hero with invite details.
  if (preview.role === "invitee" && preview.status === "invited") return "birth_pick";
  if (preview.waiting_for_partner) return "waiting";
  return "loading";
}

export function JointSessionOpenHost({
  jointId,
  initialJoint = null,
  onClose,
  onEnteredChat,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("joint_flow");
  const tPrep = useTranslations("session_prep");
  const { alert, confirm } = useAppDialog();
  const prepare = useWorkspacePojuPrepare();

  const [phase, setPhase] = useState<Phase>(() => initialPhase(initialJoint));
  const [joint, setJoint] = useState<JointDecisionPublicView | null>(
    () => initialJoint ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [hasBirthProfiles, setHasBirthProfiles] = useState(false);
  const [prepProfile, setPrepProfile] = useState<StoredProfileData | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const chargeRef = useRef<ChargeResult>({ status: "pending" });
  const tipShownRef = useRef(false);
  /** Prevent double enterStage1 (portrait-close vs charge-resolve race). Same for initiator + invitee. */
  const stage1StartedRef = useRef(false);
  const startedAtRef = useRef(0);
  const matrixPayloadRef = useRef<Awaited<
    ReturnType<typeof finalizeWorkspacePrepare>
  >["matrixPayload"] | null>(null);
  /** Last birth used for prepare/charge — needed for PASS retry. */
  const lastBirthRef = useRef<BirthInfo | null>(null);
  const previewSessionIdRef = useRef<string | null>(null);
  /** Pre-hydrate during 10s / portrait so close → tip + send is instant. */
  const hydratedSessionIdRef = useRef<string | null>(null);
  const hydratePromiseRef = useRef<Promise<string> | null>(null);

  const loadJoint = useCallback(async () => {
    const res = await fetch(`/api/joint/${jointId}`, { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      joint?: JointDecisionPublicView;
      seed?: JointSessionSeed | null;
      error?: string;
    };
    if (!data.ok || !data.joint) {
      await alert(t("load_failed"), t("title"));
      onClose();
      return null;
    }
    setJoint(data.joint);
    return data;
  }, [jointId, alert, t, onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const paintedInvite =
        initialJoint?.role === "invitee" && initialJoint.status === "invited";

      const data = await loadJoint();
      if (cancelled || !data?.joint) return;
      const j = data.joint;
      setJoint(j);

      if (j.waiting_for_partner) {
        setPhase("waiting");
        return;
      }

      if (j.role === "invitee" && j.status === "invited") {
        setPhase("birth_pick");
        window.setTimeout(() => notifyJointListUpdated(), 0);
        return;
      }

      if (paintedInvite) {
        // Preview said invited but server says otherwise — continue normal routing.
      }

      // Already charged — resume stage1 (toast + auto-send same as fresh open).
      if (j.my_charged && data.seed) {
        try {
          const self = j.self_birth_for_my_session ?? (await inferSelfBirth());
          if (!self) throw new Error("self_birth_missing");
          lastBirthRef.current = self;
          stage1StartedRef.current = true;
          tipShownRef.current = true;
          await enterStage1AfterCharge({
            status: "ok",
            charged_from: "flex",
            already_charged: true,
            seed: data.seed,
          });
          return;
        } catch {
          stage1StartedRef.current = false;
          tipShownRef.current = false;
          /* fall through to start flow */
        }
      }

      // Initiator + invitee share the same prepare → portrait → PASS → stage1 path.
      if (
        (j.role === "initiator" && j.partner_ready && !j.my_charged) ||
        (j.role === "invitee" &&
          (j.partner_ready || j.status === "accepted" || j.status === "partner_ready") &&
          !j.my_charged)
      ) {
        if (j.role === "initiator") {
          const start = await confirm(t("partner_agreed_tip"), t("partner_agreed_title"), {
            confirmLabel: t("partner_agreed_cta"),
            cancelLabel: t("back"),
          });
          if (!start) {
            onClose();
            return;
          }
        }
        const birth = j.self_birth_for_my_session;
        if (birth) {
          setPhase("preparing");
          void runPrepareThenPortrait(birth);
          return;
        }
        setPhase("birth_pick");
        return;
      }

      setPhase("waiting");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per jointId
  }, [jointId]);

  async function inferSelfBirth(): Promise<BirthInfo | null> {
    const list = await listStoredProfiles();
    if (list[0]) {
      const full = await getStoredProfile(list[0].profile_id);
      return (full?.birth_info as BirthInfo | undefined) ?? null;
    }
    return null;
  }

  async function handleBirthConfirmed(args: { profileId: string; birth: BirthInfo }) {
    if (!joint) return;
    setBusy(true);
    try {
      if (joint.role === "invitee" && joint.status === "invited") {
        const birthPayload = {
          year: args.birth.year,
          month: args.birth.month,
          day: args.birth.day,
          hour_period: args.birth.hour_period,
          hour: args.birth.hour,
          minute: args.birth.minute,
          gender: args.birth.gender,
          timezone: args.birth.timezone,
          birth_location: args.birth.birth_location,
        };
        const res = await fetch("/api/joint/agree", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joint_id: jointId, birth: birthPayload }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          joint?: JointDecisionPublicView;
        };
        if (!res.ok || !data.ok) {
          console.error("[joint-open] agree failed", res.status, data.error);
          await alert(mapJointError(data.error, t), t("title"));
          return;
        }
        if (data.joint) setJoint(data.joint);
        notifyJointListUpdated();
      }

      setPhase("preparing");
      void runPrepareThenPortrait(args.birth);
    } catch {
      await alert(t("network_error"), t("title"));
    } finally {
      setBusy(false);
    }
  }

  const CHARGE_FETCH_MS = 12_000;

  function beginCharge() {
    if (chargeRef.current.status === "ok" || chargeRef.current.status === "fail") {
      return;
    }
    chargeRef.current = { status: "pending" };
    void (async () => {
      const ac = new AbortController();
      const timer = window.setTimeout(() => ac.abort(), CHARGE_FETCH_MS);
      try {
        const res = await fetch(`/api/joint/${jointId}/start`, {
          method: "POST",
          credentials: "same-origin",
          signal: ac.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          seed?: JointSessionSeed;
          charged_from?: "sub" | "flex";
          already_charged?: boolean;
        };
        if (!res.ok || !data.ok || !data.seed) {
          chargeRef.current = {
            status: "fail",
            reason: data.error ?? "charge_failed",
          };
          if (tipShownRef.current && !stage1StartedRef.current) {
            stage1StartedRef.current = true;
            await injectPassGateUnderWelcome(chargeRef.current.reason);
          }
          return;
        }
        chargeRef.current = {
          status: "ok",
          charged_from: data.charged_from ?? "flex",
          already_charged: Boolean(data.already_charged),
          seed: data.seed,
        };
        // Warm hydrate during wait/portrait when matrix already ready.
        if (matrixPayloadRef.current && lastBirthRef.current) {
          void ensureHydratedSession(chargeRef.current);
        }
        if (tipShownRef.current && !stage1StartedRef.current) {
          stage1StartedRef.current = true;
          try {
            await enterStage1AfterCharge(chargeRef.current);
          } catch (e) {
            console.error("[joint-open] enter stage1 after charge", e);
            stage1StartedRef.current = false;
            setBlockedMsg(t("prepare_failed"));
            setPhase("pass_blocked");
          }
        }
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        chargeRef.current = {
          status: "fail",
          reason: aborted ? "charge_failed" : "network_error",
        };
        if (tipShownRef.current && !stage1StartedRef.current) {
          stage1StartedRef.current = true;
          await injectPassGateUnderWelcome(chargeRef.current.reason);
        }
      } finally {
        window.clearTimeout(timer);
      }
    })();
  }

  async function waitForCharge(): Promise<ChargeResult> {
    // Charge starts at T=0; by portrait close it must already be settled.
    for (let i = 0; i < 50 && chargeRef.current.status === "pending"; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { ...chargeRef.current } as ChargeResult;
  }

  function ensureHydratedSession(
    final: Extract<ChargeResult, { status: "ok" }>,
  ): Promise<string> {
    if (hydratedSessionIdRef.current) {
      return Promise.resolve(hydratedSessionIdRef.current);
    }
    if (hydratePromiseRef.current) return hydratePromiseRef.current;
    const birth = lastBirthRef.current;
    if (!birth) {
      return Promise.reject(new Error("self_birth_missing"));
    }
    const p = hydrateJointSessionFromSeed(final.seed, birth, {
      matrixPayload: matrixPayloadRef.current,
      locale,
      reuseSessionId: previewSessionIdRef.current,
      selfProfileId: prepare.profileId,
    }).then(({ session_id }) => {
      hydratedSessionIdRef.current = session_id;
      return session_id;
    });
    hydratePromiseRef.current = p;
    return p;
  }

  /**
   * 10s wait = forced work window: PASS charge + baseline portrait (+ hydrate).
   * Portrait opens only after that work is ready — close must be instant tip/send.
   */
  async function runPrepareThenPortrait(birth: BirthInfo) {
    lastBirthRef.current = birth;
    startedAtRef.current = Date.now();
    tipShownRef.current = false;
    stage1StartedRef.current = false;
    chargeRef.current = { status: "pending" };
    setPrepError(null);
    matrixPayloadRef.current = null;
    previewSessionIdRef.current = null;
    hydratedSessionIdRef.current = null;
    hydratePromiseRef.current = null;

    let profileId: string;
    try {
      const created = await createStoredProfile({ birth_info: birth });
      profileId = created.profile_id;
      markPendingBaseAnalysisProfile(profileId);
      const stored = await getStoredProfile(profileId);
      setPrepProfile(stored);
    } catch {
      setPrepError(tPrep("error_create_profile"));
      setBlockedMsg(tPrep("error_create_profile"));
      setPhase("pass_blocked");
      return;
    }

    prepare.setProfileId(profileId);
    prepare.setPhase("preparing");
    setPhase("preparing");

    // PASS charge starts with the 10s page — not after it.
    beginCharge();

    try {
      const [result] = await Promise.all([
        finalizeWorkspacePrepare(profileId, locale),
        waitRemainingMinSpline(startedAtRef.current, PREVIEW_MATRIX_MIN_PREP_MS),
      ]);

      matrixPayloadRef.current = result.matrixPayload;
      previewSessionIdRef.current = result.session.session_id;

      const jointSession = {
        ...result.session,
        joint_decision_id: jointId,
        joint_decision: true as const,
        original_question:
          joint?.shared_question?.trim() || result.session.original_question || "",
        pending_question: undefined,
        unlock_status: "preview" as const,
      };

      prepare.setMatrixPayload(result.matrixPayload);
      prepare.setSession(jointSession);
      prepare.openRight();
      markDocVaultUnread(DocVaultIds.matrix(profileId), "foundation");
      notifyDocVaultUpdated();
      await savePOJUSession(jointSession);

      // Finish charge + hydrate inside the wait window before opening portrait.
      const charged = await waitForCharge();
      if (charged.status === "ok") {
        await ensureHydratedSession(charged);
      }

      markAwaitJointPortraitClose(jointId);
      prepare.setPhase("chat");
      setPhase("awaiting_tip");
      requestBaselineAutoOpen(profileId, result.matrixPayload);
    } catch (e) {
      console.error("[joint-open]", e);
      const msg = e instanceof Error ? e.message : t("prepare_failed");
      setPrepError(msg);
      setBlockedMsg(msg);
      setPhase("pass_blocked");
      prepare.setPhase("idle");
    }
  }

  async function enterStage1AfterCharge(final: Extract<ChargeResult, { status: "ok" }>) {
    // Tip first — never gate UI on hydrate/resume.
    dispatchPassSpendToast({ amount: 1, locale });
    const session_id = await ensureHydratedSession(final);
    markReleasePendingQuestion(session_id);

    // In-place upgrade — do NOT resumeSession (it nulls session → chat unmount =
    // the "page refreshed" flash users reported).
    const live =
      (await loadPOJUSession(session_id)) ??
      (prepare.session?.session_id === session_id ? prepare.session : null);
    if (live) {
      prepare.setMatrixPayload(matrixPayloadRef.current ?? live.matrix_payload ?? null);
      prepare.setSession({ ...live });
      prepare.setPhase("chat");
      prepare.openRight();
    }

    notifyJointListUpdated();
    setPhase("done");
    onEnteredChat?.(session_id);
  }

  async function injectPassGateUnderWelcome(reason: string) {
    const sid = previewSessionIdRef.current ?? prepare.session?.session_id;
    const copy =
      reason === "insufficient_pass" ? t("blocked_insufficient") : mapJointError(reason, t);
    setBlockedMsg(copy);
    if (!sid) {
      setPhase("pass_blocked");
      return;
    }
    const live = (await loadPOJUSession(sid)) ?? prepare.session;
    if (!live) {
      setPhase("pass_blocked");
      return;
    }
    const withoutGate = live.messages.filter((m) => m.meta?.kind !== "joint_pass_gate");
    const next = {
      ...live,
      messages: [...withoutGate, createJointPassGateMessage(copy)],
      unlock_status: "preview" as const,
      pending_question: undefined,
    };
    await savePOJUSession(next);
    prepare.setSession(next);
    prepare.setPhase("chat");
    setPhase("pass_blocked");
    if (reason === "insufficient_pass") setBuyOpen(true);
  }

  useEffect(() => {
    function onPortraitClosed() {
      tipShownRef.current = true;
      void (async () => {
        if (stage1StartedRef.current) return;
        // Charge + hydrate finished during the 10s window — close must not idle-wait.
        const final = await waitForCharge();
        if (stage1StartedRef.current) return;
        if (final.status === "ok") {
          stage1StartedRef.current = true;
          try {
            await enterStage1AfterCharge(final);
          } catch (e) {
            console.error("[joint-open] enter stage1", e);
            stage1StartedRef.current = false;
            setBlockedMsg(t("prepare_failed"));
            setPhase("pass_blocked");
          }
          return;
        }
        stage1StartedRef.current = true;
        const reason =
          final.status === "fail" ? final.reason : "insufficient_pass";
        await injectPassGateUnderWelcome(reason);
      })();
    }
    window.addEventListener(JOINT_PORTRAIT_CLOSED_EVENT, onPortraitClosed);
    return () => {
      window.removeEventListener(JOINT_PORTRAIT_CLOSED_EVENT, onPortraitClosed);
      // Do NOT clearAwaitJointPortraitClose here — effect re-runs must not wipe
      // the mark before the user closes the baseline portrait.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable per joint open
  }, [jointId, locale, t, onClose, onEnteredChat]);

  async function handleRetry() {
    const birth = lastBirthRef.current;
    if (!birth) {
      setPhase("birth_pick");
      return;
    }
    setBlockedMsg(null);
    setBuyOpen(false);
    tipShownRef.current = false;
    stage1StartedRef.current = false;
    chargeRef.current = { status: "pending" };
    hydratedSessionIdRef.current = null;
    hydratePromiseRef.current = null;
    setPhase("preparing");
    prepare.setPhase("preparing");
    try {
      const res = await fetch(`/api/joint/${jointId}/retry-start`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        seed?: JointSessionSeed;
        charged_from?: "sub" | "flex";
        already_charged?: boolean;
      };
      if (!res.ok || !data.ok || !data.seed) {
        await injectPassGateUnderWelcome(data.error ?? "charge_failed");
        return;
      }
      chargeRef.current = {
        status: "ok",
        charged_from: data.charged_from ?? "flex",
        already_charged: Boolean(data.already_charged),
        seed: data.seed,
      };
      stage1StartedRef.current = true;
      tipShownRef.current = true;
      try {
        await enterStage1AfterCharge(chargeRef.current);
      } catch (e) {
        console.error("[joint-open] retry enter stage1", e);
        stage1StartedRef.current = false;
        await injectPassGateUnderWelcome("charge_failed");
      }
    } catch {
      await injectPassGateUnderWelcome("network_error");
    }
  }

  useEffect(() => {
    function onRetry() {
      void handleRetry();
    }
    window.addEventListener(JOINT_PASS_RETRY_EVENT, onRetry);
    return () => window.removeEventListener(JOINT_PASS_RETRY_EVENT, onRetry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jointId]);

  if (phase === "loading") {
    return (
      <div className="workspace-poju-birth-column">
        <p className="workspace-poju-records__loading">{t("loading")}</p>
      </div>
    );
  }

  /** Chat (+ portrait / PASS tip under welcome) visible; host waits invisibly. */
  if (phase === "awaiting_tip" || phase === "pass_blocked" || phase === "done") {
    return (
      <>
        {phase === "pass_blocked" && buyOpen ? (
          <PassPurchaseModal
            open={buyOpen}
            onClose={() => setBuyOpen(false)}
            reason="insufficient"
          />
        ) : null}
        {phase === "pass_blocked" && !prepare.session ? (
          <div className="joint-open-host joint-open-host--blocked">
            <div className="confirm-dialog">
              <h2>{t("title")}</h2>
              <p>{blockedMsg ?? t("blocked_insufficient")}</p>
              <div className="dialog-actions dialog-actions--stack">
                <button type="button" className="primary" onClick={() => void handleRetry()}>
                  {t("retry_start")}
                </button>
                <button type="button" onClick={() => setBuyOpen(true)}>
                  {t("buy_pass")}
                </button>
                <button type="button" onClick={onClose}>
                  {t("back")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="joint-open-host joint-open-host--waiting">
        <div className="confirm-dialog">
          <h2>{t("title")}</h2>
          <p>{t("waiting_partner")}</p>
          {joint?.shared_question ? (
            <p className="joint-open-host__question">{joint.shared_question}</p>
          ) : null}
          <div className="dialog-actions">
            <button type="button" className="primary" onClick={onClose}>
              {t("back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "birth_pick") {
    // Distinct from homepage joint marketing hero — step prompt only.
    const heroCopy = {
      brandTag: t("open_birth_brand"),
      heading: t("open_birth_heading"),
      description: t("open_birth_lead"),
      leadIn: "",
      tagline: "",
      ctaPrimary: "",
      billingNotice: "",
    };
    const peer = joint?.peer_label?.trim() || t("peer_fallback");
    const question = joint?.shared_question?.trim() || "";
    const inviteSummary =
      joint != null ? (
        <div className="workspace-poju-joint-invite-summary" role="region" aria-label={t("title")}>
          <div className="workspace-poju-joint-invite-summary__row">
            <span className="workspace-poju-joint-invite-summary__kicker">
              {joint.role === "invitee" ? t("hero_initiator") : t("card_peer")}
            </span>
            <span className="workspace-poju-joint-invite-summary__value" title={peer}>
              {peer}
            </span>
          </div>
          {question ? (
            <div className="workspace-poju-joint-invite-summary__row">
              <span className="workspace-poju-joint-invite-summary__kicker">{t("hero_question")}</span>
              <span className="workspace-poju-joint-invite-summary__value workspace-poju-joint-invite-summary__value--question">
                {question}
              </span>
            </div>
          ) : null}
        </div>
      ) : null;
    return (
      <div className="workspace-product-stack workspace-poju-stack">
        <div className="workspace-product-hero workspace-poju-hero workspace-atmos-hero workspace-poju-hero--joint">
          <PojuProductHero
            copy={heroCopy}
            hideActions
            workspaceMotion="spline-constellation"
            scene="/spline/atmoswork.splinecode"
            initialZoom={1.15}
            hideStarrySky
            hideVignette
            afterDescription={inviteSummary}
          />
        </div>
        <div className="workspace-product-below workspace-poju-below">
          <div className="workspace-poju-below__cluster">
            <div className="workspace-poju-below__unit" aria-busy={busy || undefined}>
              <WorkspacePojuBirthSideCopy
                hasBirthHistory={hasBirthProfiles}
                entryMode="joint"
                tipOverride={t("birth_hint")}
              />
              <WorkspacePojuBirthHost
                onHasProfilesChange={setHasBirthProfiles}
                onBirthConfirmed={(args) => void handleBirthConfirmed(args)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "preparing" || phase === "exiting") {
    const exiting = phase === "exiting";
    return (
      <div
        className={clsx(
          "workspace-poju-preparing-stage",
          "workspace-poju-preparing",
          "workspace-poju-preparing--avatar",
          exiting && "workspace-poju-preparing-stage--exit",
        )}
      >
        <WaitFxLayer glowColor="rgba(255,255,255,0.35)" showBreath={false} showFlash={false} />
        {prepError && prepProfile ? (
          <div className="workspace-prepare-avatar-stage__overlay">
            <ChartReadingLoader
              profile={prepProfile}
              currentStep="error"
              error={prepError}
              onRetry={() => {
                const birth = lastBirthRef.current;
                if (!birth) return;
                setPrepError(null);
                void runPrepareThenPortrait(birth);
              }}
              onRefund={() => {
                prepare.resetPrepare();
                onClose();
              }}
              locale={locale}
              variant="matrix"
            />
          </div>
        ) : (
          <div className="workspace-prepare-avatar-stage" aria-busy="true" aria-live="polite">
            <AtmosThinkingAvatar thinking className="workspace-prepare-avatar" />
            <p className="workspace-prepare-avatar-stage__status">{tPrep("preparing")}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function mapJointError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<"joint_flow">>,
): string {
  switch (code) {
    case "partner_not_registered":
      return t("err_partner_not_registered");
    case "cannot_invite_self":
      return t("err_cannot_invite_self");
    case "invalid_email":
      return t("err_invalid_email");
    case "insufficient_pass":
      return t("insufficient_need_buy");
    case "waiting_for_partner":
      return t("waiting_partner");
    case "invite_expired":
      return t("err_invite_expired");
    case "invitee_birth_required":
    case "birth_required":
      return t("err_birth_required");
    case "not_invitee":
      return t("err_not_invitee");
    case "agree_failed":
      return t("err_agree_failed");
    case "joint_not_found":
      return t("load_failed");
    case "network_error":
      return t("network_error");
    default:
      if (code?.startsWith("bad_status:")) return t("err_generic");
      return t("err_generic");
  }
}
