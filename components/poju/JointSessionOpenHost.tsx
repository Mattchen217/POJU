"use client";

/**
 * Orchestrates opening a joint decision: agree → birth → prepare → portrait+charge → stage 1.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import {
  BirthInfoConfirmDialog,
} from "@/components/poju/BirthInfoConfirmDialog";
import { useAppDialog } from "@/components/ui/app-dialog";
import { WorkspaceBirthInfoPicker } from "@/components/workspace/WorkspaceBirthInfoPicker";
import { WorkspacePojuProfileRecords } from "@/components/workspace/WorkspacePojuProfileRecords";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { hydrateJointSessionFromSeed } from "@/lib/poju/hydrate-joint-session";
import {
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
import { POJU_RELEASE_PENDING_QUESTION_FLAG } from "@/lib/poju/preview-unlock";
import type { JointDecisionPublicView } from "@/lib/passes/household-types";
import type { JointSessionSeed } from "@/lib/passes/joint-decision";
import { markPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  createStoredProfile,
  getStoredProfile,
  listStoredProfiles,
  recordProfileUsage,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import type { BirthInfo } from "@/lib/profile/types";
import {
  DocVaultIds,
} from "@/lib/workspace/doc-vault-index";
import { markDocVaultUnread } from "@/lib/workspace/doc-vault-unread";
import {
  notifyDocVaultUpdated,
  requestBaselineAutoOpen,
} from "@/lib/workspace/doc-vault-types";

import "@/styles/session-prep.css";

type Phase =
  | "loading"
  | "waiting"
  | "agree"
  | "birth_list"
  | "birth_new"
  | "birth_confirm"
  | "preparing"
  | "awaiting_tip"
  | "blocked"
  | "done";

type ChargeResult =
  | { status: "pending" }
  | { status: "ok"; charged_from: "sub" | "flex"; already_charged: boolean; seed: JointSessionSeed }
  | { status: "fail"; reason: string };

type Props = {
  jointId: string;
  onClose: () => void;
  /** After successful hydrate into chat. */
  onEnteredChat?: (sessionId: string) => void;
};

export function JointSessionOpenHost({ jointId, onClose, onEnteredChat }: Props) {
  const locale = useLocale();
  const t = useTranslations("joint_flow");
  const tPrep = useTranslations("session_prep");
  const { alert } = useAppDialog();
  const prepare = useWorkspacePojuPrepare();

  const [phase, setPhase] = useState<Phase>("loading");
  const [joint, setJoint] = useState<JointDecisionPublicView | null>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [pendingBirth, setPendingBirth] = useState<BirthInfo | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selfBirth, setSelfBirth] = useState<BirthInfo | null>(null);
  const chargeRef = useRef<ChargeResult>({ status: "pending" });
  const tipShownRef = useRef(false);
  const startedAtRef = useRef(0);

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
      const data = await loadJoint();
      if (cancelled || !data?.joint) return;
      const j = data.joint;
      notifyJointListUpdated();

      if (j.waiting_for_partner) {
        setPhase("waiting");
        return;
      }

      if (j.role === "invitee" && j.status === "invited") {
        setPhase("agree");
        return;
      }

      // Partner ready or running — if already charged, resume seed session
      if (j.my_charged && data.seed) {
        try {
          const self =
            j.self_birth_for_my_session ?? (await inferSelfBirth());
          if (!self) throw new Error("self_birth_missing");
          const { session_id } = await hydrateJointSessionFromSeed(data.seed, self);
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
          setSelfBirth(birth);
          setPhase("preparing");
          void runPrepareAndCharge(birth);
          return;
        }
        const list = await listStoredProfiles();
        setProfiles(list);
        setPhase(list.length > 0 ? "birth_list" : "birth_new");
        return;
      }

      if (j.role === "invitee" && j.partner_ready && !j.my_charged) {
        const birth = j.self_birth_for_my_session;
        if (birth) {
          setSelfBirth(birth);
          setPhase("preparing");
          void runPrepareAndCharge(birth);
          return;
        }
        const list = await listStoredProfiles();
        setProfiles(list);
        setPhase(list.length > 0 ? "birth_list" : "birth_new");
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

  async function resolveBirth(): Promise<BirthInfo | null> {
    if (pendingBirth) return pendingBirth;
    if (!selectedProfileId) return null;
    const stored = await getStoredProfile(selectedProfileId);
    return (stored?.birth_info as BirthInfo | undefined) ?? null;
  }

  async function handleAgreeContinue() {
    const list = await listStoredProfiles();
    setProfiles(list);
    setPhase(list.length > 0 ? "birth_list" : "birth_new");
  }

  async function submitAgreeAndBirth() {
    const birth = await resolveBirth();
    if (!birth || !joint) return;
    setBusy(true);
    try {
      if (pendingBirth) {
        const created = await createStoredProfile({ birth_info: pendingBirth });
        markPendingBaseAnalysisProfile(created.profile_id);
        await recordProfileUsage(created.profile_id, "poju");
      } else if (selectedProfileId) {
        await recordProfileUsage(selectedProfileId, "poju");
      }

      if (joint.role === "invitee" && joint.status === "invited") {
        const res = await fetch("/api/joint/agree", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joint_id: jointId, birth }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          joint?: JointDecisionPublicView;
        };
        if (!res.ok || !data.ok) {
          await alert(mapJointError(data.error, t), t("title"));
          return;
        }
        if (data.joint) setJoint(data.joint);
        notifyJointListUpdated();
      }

      setSelfBirth(birth);
      setPhase("preparing");
      void runPrepareAndCharge(birth);
    } catch {
      await alert(t("network_error"), t("title"));
    } finally {
      setBusy(false);
    }
  }

  async function runPrepareAndCharge(birth: BirthInfo) {
    startedAtRef.current = Date.now();
    tipShownRef.current = false;
    chargeRef.current = { status: "pending" };

    let profileId: string;
    try {
      const created = await createStoredProfile({ birth_info: birth });
      profileId = created.profile_id;
      markPendingBaseAnalysisProfile(profileId);
    } catch {
      setBlockedMsg(tPrep("error_create_profile"));
      setPhase("blocked");
      return;
    }

    prepare.setProfileId(profileId);
    prepare.setPhase("preparing");

    // Fire charge in parallel once we approach portrait time
    const chargePromise = (async () => {
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

    try {
      const [result] = await Promise.all([
        finalizeWorkspacePrepare(profileId, locale),
        waitRemainingMinSpline(startedAtRef.current, PREVIEW_MATRIX_MIN_PREP_MS),
        chargePromise,
      ]);

      // Replace solo preview session with joint-hydrated session when charge ok
      // Re-read after await — ref mutation inside chargePromise is opaque to TS.
      const charge = chargeRef.current as ChargeResult;
      if (charge.status === "ok") {
        const { session_id } = await hydrateJointSessionFromSeed(charge.seed, birth);
        // Merge matrix from prepare into joint session via resume
        prepare.setMatrixPayload(result.matrixPayload);
        markDocVaultUnread(DocVaultIds.matrix(profileId), "foundation");
        notifyDocVaultUpdated();
        markAwaitJointPortraitClose(jointId);
        prepare.setPhase("chat");
        await prepare.resumeSession(session_id, locale);
        setPhase("awaiting_tip");
        requestBaselineAutoOpen(profileId);
      } else {
        // Still show portrait for UX; tip after close will block
        prepare.setMatrixPayload(result.matrixPayload);
        prepare.setSession(result.session);
        markDocVaultUnread(DocVaultIds.matrix(profileId), "foundation");
        notifyDocVaultUpdated();
        markAwaitJointPortraitClose(jointId);
        prepare.setPhase("chat");
        setPhase("awaiting_tip");
        requestBaselineAutoOpen(profileId);
      }
    } catch (e) {
      console.error("[joint-open]", e);
      setBlockedMsg(e instanceof Error ? e.message : t("prepare_failed"));
      setPhase("blocked");
      prepare.setPhase("idle");
    }
  }

  useEffect(() => {
    function onPortraitClosed() {
      if (tipShownRef.current) return;
      tipShownRef.current = true;
      void (async () => {
        const charge = chargeRef.current;
        // Wait briefly if charge still pending
        if (charge.status === "pending") {
          for (let i = 0; i < 40 && chargeRef.current.status === "pending"; i++) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
        const final = chargeRef.current;
        if (final.status === "ok") {
          const msg =
            final.charged_from === "sub"
              ? t("charged_sub")
              : t("charged_flex");
          await alert(
            final.already_charged ? t("already_charged") : msg,
            t("title"),
          );
          const sid = final.seed.pivot_session_id;
          sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, sid);
          notifyJointListUpdated();
          onEnteredChat?.(sid);
          setPhase("done");
          onClose();
          return;
        }
        const reason = final.status === "fail" ? final.reason : "insufficient_pass";
        if (reason === "insufficient_pass") {
          setBuyOpen(true);
          await alert(t("insufficient_need_buy"), t("title"));
          setBlockedMsg(t("blocked_insufficient"));
          setPhase("blocked");
          return;
        }
        await alert(mapJointError(reason, t), t("title"));
        setBlockedMsg(mapJointError(reason, t));
        setPhase("blocked");
      })();
    }
    window.addEventListener(JOINT_PORTRAIT_CLOSED_EVENT, onPortraitClosed);
    return () => {
      window.removeEventListener(JOINT_PORTRAIT_CLOSED_EVENT, onPortraitClosed);
      clearAwaitJointPortraitClose();
    };
  }, [alert, t, onClose, onEnteredChat]);

  async function handleRetry() {
    if (!selfBirth && !(await resolveBirth())) {
      setPhase("birth_list");
      return;
    }
    const birth = selfBirth ?? (await resolveBirth());
    if (!birth) return;
    setBlockedMsg(null);
    setBuyOpen(false);
    setPhase("preparing");
    setSelfBirth(birth);
    // Prefer retry-start endpoint
    tipShownRef.current = false;
    chargeRef.current = { status: "pending" };
    startedAtRef.current = Date.now();
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
        if (data.error === "insufficient_pass") {
          setBuyOpen(true);
          await alert(t("insufficient_need_buy"), t("title"));
          setBlockedMsg(t("blocked_insufficient"));
          setPhase("blocked");
          return;
        }
        await alert(mapJointError(data.error, t), t("title"));
        setPhase("blocked");
        return;
      }
      const { session_id } = await hydrateJointSessionFromSeed(data.seed, birth);
      sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, session_id);
      await prepare.resumeSession(session_id, locale);
      await alert(
        data.charged_from === "sub" ? t("charged_sub") : t("charged_flex"),
        t("title"),
      );
      notifyJointListUpdated();
      onEnteredChat?.(session_id);
      setPhase("done");
      onClose();
    } catch {
      await alert(t("network_error"), t("title"));
      setPhase("blocked");
    }
  }

  if (phase === "loading") {
    return (
      <div className="workspace-poju-birth-column">
        <p className="workspace-poju-records__loading">{t("loading")}</p>
      </div>
    );
  }

  /** Chat + portrait visible underneath; host only waits for close tip. */
  if (phase === "awaiting_tip" || phase === "done") {
    return null;
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

  if (phase === "birth_list" || phase === "birth_new" || phase === "birth_confirm") {
    return (
      <div className="workspace-poju-birth-column joint-open-host">
        {phase === "birth_list" ? (
          <div className="birth-info-picker birth-info-picker--workspace workspace-poju-records-frame">
            <WorkspacePojuProfileRecords
              profiles={profiles}
              onSelect={(summary) => {
                setSelectedProfileId(summary.profile_id);
                setPendingBirth(null);
                setPhase("birth_confirm");
              }}
              onAddNew={() => setPhase("birth_new")}
              onRename={() => undefined}
              onDelete={() => undefined}
              pinnedHint={t("birth_hint")}
            />
          </div>
        ) : null}
        {phase === "birth_new" ? (
          <WorkspaceBirthInfoPicker
            locale={locale}
            onSubmit={(info) => {
              setPendingBirth(info);
              setSelectedProfileId(null);
              setPhase("birth_confirm");
            }}
            onCancel={profiles.length > 0 ? () => setPhase("birth_list") : onClose}
          />
        ) : null}
        {phase === "birth_confirm" ? (
          <BirthInfoConfirmDialog
            birthInfo={pendingBirth}
            existingProfile={
              selectedProfileId
                ? (profiles.find((p) => p.profile_id === selectedProfileId) ?? null)
                : null
            }
            onConfirm={() => void submitAgreeAndBirth()}
            onCancel={() =>
              setPhase(profiles.length > 0 ? "birth_list" : "birth_new")
            }
            processing={busy}
          />
        ) : null}
      </div>
    );
  }

  if (phase === "preparing") {
    return (
      <div className="workspace-poju-preparing-stage workspace-poju-preparing" aria-busy>
        <p className="workspace-prepare-avatar-stage__status">{tPrep("preparing")}</p>
      </div>
    );
  }

  if (phase === "blocked") {
    return (
      <>
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
        <PassPurchaseModal
          open={buyOpen}
          onClose={() => setBuyOpen(false)}
          reason="insufficient"
        />
      </>
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
    default:
      return t("err_generic");
  }
}
