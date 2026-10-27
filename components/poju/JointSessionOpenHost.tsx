"use client";

/**
 * Joint open: agree → birth → 10s avatar prep (same as solo) → portrait + PASS charge
 * in parallel → close portrait → 3s PASS toast (or tip under welcome + retry) →
 * only then unlock + auto-send shared question into stage 1.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
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
  clearAwaitJointPortraitClose,
} from "@/lib/poju/joint-client-events";
import {
  PREVIEW_MATRIX_MIN_PREP_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { finalizeWorkspacePrepare } from "@/lib/poju/finalize-workspace-prepare";
import {
  createJointPassGateMessage,
  POJU_RELEASE_PENDING_QUESTION_FLAG,
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

const EXIT_MS = 700;

type Phase =
  | "loading"
  | "waiting"
  | "agree"
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
  if (preview.role === "invitee" && preview.status === "invited") return "agree";
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
  const { alert } = useAppDialog();
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
  const [showFlash, setShowFlash] = useState(false);
  const chargeRef = useRef<ChargeResult>({ status: "pending" });
  const tipShownRef = useRef(false);
  const startedAtRef = useRef(0);
  const matrixPayloadRef = useRef<Awaited<
    ReturnType<typeof finalizeWorkspacePrepare>
  >["matrixPayload"] | null>(null);
  /** Last birth used for prepare/charge — needed for PASS retry. */
  const lastBirthRef = useRef<BirthInfo | null>(null);
  const previewSessionIdRef = useRef<string | null>(null);

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
        setPhase("agree");
        window.setTimeout(() => notifyJointListUpdated(), 0);
        return;
      }

      if (paintedInvite) {
        // Preview said invited but server says otherwise — continue normal routing.
      }

      // Already charged — resume stage1 (skip portrait/tip).
      if (j.my_charged && data.seed) {
        try {
          const self = j.self_birth_for_my_session ?? (await inferSelfBirth());
          if (!self) throw new Error("self_birth_missing");
          const { session_id } = await hydrateJointSessionFromSeed(data.seed, self, {
            locale,
          });
          sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, session_id);
          await prepare.resumeSession(session_id, locale);
          onEnteredChat?.(session_id);
          setPhase("done");
          onClose();
          return;
        } catch {
          /* fall through to start flow */
        }
      }

      if (j.role === "initiator" && j.partner_ready) {
        await alert(t("partner_agreed_tip"), t("title"));
        const birth = j.self_birth_for_my_session;
        if (birth) {
          setPhase("preparing");
          void runPrepareThenPortrait(birth);
          return;
        }
        setPhase("birth_pick");
        return;
      }

      if (j.role === "invitee" && (j.partner_ready || j.status === "accepted") && !j.my_charged) {
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

  async function handleAgreeContinue() {
    setPhase("birth_pick");
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

  function beginCharge() {
    chargeRef.current = { status: "pending" };
    void (async () => {
      try {
        const res = await fetch(`/api/joint/${jointId}/start`, {
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
          chargeRef.current = {
            status: "fail",
            reason: data.error ?? "charge_failed",
          };
          return;
        }
        chargeRef.current = {
          status: "ok",
          charged_from: data.charged_from ?? "flex",
          already_charged: Boolean(data.already_charged),
          seed: data.seed,
        };
      } catch {
        chargeRef.current = { status: "fail", reason: "network_error" };
      }
    })();
  }

  async function waitForCharge(): Promise<ChargeResult> {
    for (let i = 0; i < 80 && chargeRef.current.status === "pending"; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return chargeRef.current;
  }

  /** 10s avatar prep (no PASS / no model) → flash → preview chat + portrait + charge. */
  async function runPrepareThenPortrait(birth: BirthInfo) {
    lastBirthRef.current = birth;
    startedAtRef.current = Date.now();
    tipShownRef.current = false;
    chargeRef.current = { status: "pending" };
    setPrepError(null);
    setShowFlash(false);
    matrixPayloadRef.current = null;
    previewSessionIdRef.current = null;

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

    try {
      const [result] = await Promise.all([
        finalizeWorkspacePrepare(profileId, locale),
        waitRemainingMinSpline(startedAtRef.current, PREVIEW_MATRIX_MIN_PREP_MS),
      ]);

      matrixPayloadRef.current = result.matrixPayload;
      previewSessionIdRef.current = result.session.session_id;

      // Same exit flash as solo preparing stage — still no model / no unlock.
      setShowFlash(true);
      setPhase("exiting");
      prepare.setPhase("exiting");
      prepare.openRight();
      markDocVaultUnread(DocVaultIds.matrix(profileId), "foundation");
      notifyDocVaultUpdated();
      await new Promise((r) => setTimeout(r, EXIT_MS));
      setShowFlash(false);

      // Preview chat only (unlock_status=preview). Shared question not sent to model yet.
      prepare.setMatrixPayload(result.matrixPayload);
      prepare.setSession({
        ...result.session,
        // Keep preview; mark as joint shell for header copy without unlocking stage1.
        joint_decision_id: jointId,
        joint_decision: true,
        original_question:
          joint?.shared_question?.trim() || result.session.original_question || "",
        pending_question: undefined,
        unlock_status: "preview",
      });
      await savePOJUSession({
        ...result.session,
        joint_decision_id: jointId,
        joint_decision: true,
        original_question:
          joint?.shared_question?.trim() || result.session.original_question || "",
        pending_question: undefined,
        unlock_status: "preview",
      });

      // Charge in parallel with personal baseline portrait (same as designed).
      beginCharge();
      markAwaitJointPortraitClose(jointId);
      prepare.setPhase("chat");
      setPhase("awaiting_tip");
      requestBaselineAutoOpen(profileId);
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
    const birth = lastBirthRef.current;
    if (!birth) {
      setBlockedMsg(t("err_birth_required"));
      setPhase("pass_blocked");
      return;
    }
    const { session_id } = await hydrateJointSessionFromSeed(final.seed, birth, {
      matrixPayload: matrixPayloadRef.current,
      locale,
    });
    if (!final.already_charged) {
      dispatchPassSpendToast({ amount: 1, locale });
    }
    // Auto-send shared question only after PASS — same flag as solo unlock.
    sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, session_id);
    await prepare.resumeSession(session_id, locale);
    notifyJointListUpdated();
    onEnteredChat?.(session_id);
    setPhase("done");
    onClose();
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
      if (tipShownRef.current) return;
      tipShownRef.current = true;
      void (async () => {
        const final = await waitForCharge();
        if (final.status === "ok") {
          try {
            await enterStage1AfterCharge(final);
          } catch (e) {
            console.error("[joint-open] enter stage1", e);
            setBlockedMsg(t("prepare_failed"));
            setPhase("pass_blocked");
          }
          return;
        }
        const reason = final.status === "fail" ? final.reason : "insufficient_pass";
        await injectPassGateUnderWelcome(reason);
      })();
    }
    window.addEventListener(JOINT_PORTRAIT_CLOSED_EVENT, onPortraitClosed);
    return () => {
      window.removeEventListener(JOINT_PORTRAIT_CLOSED_EVENT, onPortraitClosed);
      clearAwaitJointPortraitClose();
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
    chargeRef.current = { status: "pending" };
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
      await enterStage1AfterCharge(chargeRef.current);
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

  if (phase === "agree" && joint) {
    return (
      <div className="confirm-dialog-overlay" role="dialog" aria-modal="true">
        <div className="confirm-dialog">
          <div className="confirm-dialog__header">
            <h2>{t("invite_title")}</h2>
            <button type="button" className="confirm-dialog__back-link" onClick={onClose}>
              {t("back")}
            </button>
          </div>
          <p className="description">
            {t("invite_body", { account: joint.peer_label || t("peer_fallback") })}
          </p>
          <p className="joint-open-host__question">{joint.shared_question}</p>
          <div className="dialog-actions">
            <button type="button" className="primary" onClick={() => void handleAgreeContinue()}>
              {t("agree")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "birth_pick") {
    return (
      <div className="workspace-product-stack workspace-poju-stack joint-open-host">
        <div className="workspace-product-below workspace-poju-below">
          <div className="workspace-poju-below__cluster">
            <div className="workspace-poju-below__unit" aria-busy={busy || undefined}>
              <WorkspacePojuBirthSideCopy
                hasBirthHistory={hasBirthProfiles}
                entryMode="joint"
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
        <WaitFxLayer
          glowColor="rgba(255,255,255,0.35)"
          showBreath={false}
          showFlash={showFlash}
        />
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
