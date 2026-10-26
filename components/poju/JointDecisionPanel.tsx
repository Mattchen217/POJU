"use client";

/**
 * Duo joint decision: create invite / accept invite / hydrate local session.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import { PartnerBirthModal } from "@/components/poju/PartnerBirthModal";
import { useAppDialog } from "@/components/ui/app-dialog";
import { hydrateJointSessionFromSeed } from "@/lib/poju/hydrate-joint-session";
import { notifyJointListUpdated } from "@/lib/poju/joint-client-events";
import type { BirthInfo } from "@/lib/profile/types";
import type { JointDecisionPublicView } from "@/lib/passes/household-types";
import type { JointSessionSeed } from "@/lib/passes/joint-decision";

type HouseholdMe = {
  can_joint: boolean;
  household: {
    id: string;
    status: string;
    shared_sub_balance: number;
    quota: number;
    peer_bound: boolean;
    role: string;
  } | null;
};

type Mode =
  | "idle"
  | "create"
  | "accept"
  | "birth_create"
  | "birth_accept"
  | "birth_open";

type Props = {
  className?: string;
  /** When set, open accept flow for this joint id. */
  initialAcceptJointId?: string | null;
  /**
   * Account page: bind/invites only — primary create is on birth confirm.
   * Default true for backward compat elsewhere.
   */
  showCreate?: boolean;
};

export function JointDecisionPanel({
  className,
  initialAcceptJointId,
  showCreate = true,
}: Props) {
  const locale = useLocale();
  const router = useRouter();
  const { alert } = useAppDialog();
  const zh = locale.toLowerCase().startsWith("zh");
  const [hh, setHh] = useState<HouseholdMe | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [question, setQuestion] = useState("");
  const [pendingJoints, setPendingJoints] = useState<JointDecisionPublicView[]>([]);
  const [myReadyJoints, setMyReadyJoints] = useState<JointDecisionPublicView[]>([]);
  const [acceptJointId, setAcceptJointId] = useState<string | null>(
    initialAcceptJointId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfBirth, setSelfBirth] = useState<BirthInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [hRes, jRes] = await Promise.all([
        fetch("/api/household/me", { credentials: "same-origin" }),
        fetch("/api/joint/list", { credentials: "same-origin" }),
      ]);
      const hData = (await hRes.json().catch(() => ({}))) as HouseholdMe & {
        ok?: boolean;
      };
      const jData = (await jRes.json().catch(() => ({}))) as {
        ok?: boolean;
        joints?: JointDecisionPublicView[];
      };
      if (hData.ok) setHh(hData);
      if (jData.ok && Array.isArray(jData.joints)) {
        setPendingJoints(
          jData.joints.filter(
            (j) => j.status === "invited" && j.role === "invitee",
          ),
        );
        setMyReadyJoints(
          jData.joints.filter(
            (j) =>
              (j.status === "running" || j.status === "accepted") &&
              Boolean(j.my_pivot_session_id),
          ),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (initialAcceptJointId) {
      setAcceptJointId(initialAcceptJointId);
      setMode("birth_accept");
    }
  }, [initialAcceptJointId]);

  async function afterSeed(seed: JointSessionSeed, birth: BirthInfo) {
    const { session_id } = await hydrateJointSessionFromSeed(seed, birth);
    router.push(`/${locale}/poju?session=${encodeURIComponent(session_id)}`);
  }

  async function submitCreate(birth: BirthInfo) {
    setBusy(true);
    setError(null);
    setSelfBirth(birth);
    try {
      const res = await fetch("/api/joint/create", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared_question: question, birth }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        joint?: JointDecisionPublicView;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "create_failed");
        return;
      }
      setMode("idle");
      setQuestion("");
      await refresh();
      notifyJointListUpdated();
      await alert(
        zh
          ? "已发出共同决策邀请。对方同意并提交出生信息后，双方可各自开启对话。"
          : "Invite sent. After your partner agrees and submits birth details, you can each open your own session.",
      );
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
      setMode("idle");
    }
  }

  async function submitAccept(birth: BirthInfo) {
    if (!acceptJointId) return;
    setBusy(true);
    setError(null);
    setSelfBirth(birth);
    try {
      const res = await fetch("/api/joint/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joint_id: acceptJointId, birth }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        seed?: JointSessionSeed;
      };
      if (!res.ok || !data.ok || !data.seed) {
        setError(data.error ?? "accept_failed");
        return;
      }
      await afterSeed(data.seed, birth);
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  /** Hydrate local session from server seed (after peer accepted / reopen). */
  async function openFromSeed(jointId: string, birth: BirthInfo) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/joint/${jointId}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        seed?: JointSessionSeed | null;
        error?: string;
      };
      if (!data.ok || !data.seed) {
        setError(
          data.error ??
            (zh ? "对方尚未接受，请稍后重试。" : "Partner has not accepted yet."),
        );
        return;
      }
      await afterSeed(data.seed, birth);
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
      setMode("idle");
    }
  }

  const canJoint = Boolean(hh?.can_joint);

  return (
    <div className={className}>
      <div className="joint-decision-panel">
        <h3 className="joint-decision-panel__title">
          {zh ? "共同决策" : "Joint decision"}
        </h3>
        <p className="joint-decision-panel__hint">
          {zh
            ? "仅双人订阅且已绑定第二账号可用。双方各扣 1 PASS；各自独立咨询，互不可见聊天与报告。"
            : "Duo subscription with both seats bound. Costs 1 PASS each. Independent sessions — no shared chat or reports."}
        </p>

        {hh?.household ? (
          <p className="joint-decision-panel__balance">
            {zh ? "家庭额度" : "Household pool"}: {hh.household.shared_sub_balance}/
            {hh.household.quota}
            {hh.household.peer_bound
              ? zh
                ? " · 已绑定搭档"
                : " · Partner bound"
              : zh
                ? " · 待绑定第二席"
                : " · Waiting for seat B"}
          </p>
        ) : (
          <p className="joint-decision-panel__hint">
            {zh
              ? "订阅双人方案后可绑定账号并发起共同决策。"
              : "Subscribe to Duo to bind a partner and start joint decisions."}
          </p>
        )}

        {error ? <p className="joint-decision-panel__error">{error}</p> : null}

        {showCreate ? (
          canJoint ? (
            mode === "create" ? (
              <div className="joint-decision-panel__form">
                <label>
                  {zh ? "共同问题 / 困境" : "Shared question"}
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    disabled={busy}
                  />
                </label>
                <div className="joint-decision-panel__actions">
                  <button
                    type="button"
                    disabled={busy || question.trim().length < 4}
                    onClick={() => setMode("birth_create")}
                  >
                    {zh ? "下一步：授权出生信息并发起" : "Next: authorize birth & invite"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setMode("idle")}>
                    {zh ? "取消" : "Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="joint-decision-panel__cta"
                disabled={busy}
                onClick={() => setMode("create")}
              >
                {zh ? "发起共同决策" : "Start joint decision"}
              </button>
            )
          ) : (
            <button
              type="button"
              className="joint-decision-panel__cta"
              disabled
              title={
                zh
                  ? "需双人订阅且已绑定第二账号"
                  : "Requires Duo subscription with both seats bound"
              }
            >
              {zh ? "发起共同决策（需满席）" : "Start joint decision (seats required)"}
            </button>
          )
        ) : (
          <p className="joint-decision-panel__hint">
            {zh
              ? "发起共同决策：在新建会话确认出生信息后选择「开启共同决策（双人）」。"
              : "To start a joint decision: confirm birth on a new session, then choose “Start joint decision (Duo)”."}
          </p>
        )}

        {pendingJoints.length > 0 ? (
          <ul className="joint-decision-panel__invites">
            {pendingJoints.map((j) => (
              <li key={j.id}>
                <span>{j.shared_question.slice(0, 80)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAcceptJointId(j.id);
                    setMode("birth_accept");
                  }}
                >
                  {zh ? "接受并授权" : "Accept & authorize"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {myReadyJoints.length > 0 ? (
          <ul className="joint-decision-panel__ready">
            {myReadyJoints.map((j) => (
              <li key={`ready-${j.id}`}>
                <span>{j.shared_question.slice(0, 80)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAcceptJointId(j.id);
                    if (selfBirth) {
                      void openFromSeed(j.id, selfBirth);
                    } else {
                      setMode("birth_open");
                    }
                  }}
                >
                  {zh ? "打开我的会话" : "Open my session"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

      </div>

      <PartnerBirthModal
        open={
          mode === "birth_create" ||
          mode === "birth_accept" ||
          mode === "birth_open"
        }
        locale={locale}
        busy={busy}
        title={
          zh ? "授权你的出生信息（共同决策）" : "Authorize your birth details (joint)"
        }
        intro={
          zh
            ? "接受共同决策即同意用你的出生信息参与本次联合分析。对方看不到你的出生信息原文、聊天与报告。"
            : "Accepting authorizes your birth details for this joint analysis only. Your partner will not see your birth data, chat, or report."
        }
        onSubmit={(info) => {
          if (mode === "birth_create") void submitCreate(info);
          else if (mode === "birth_open" && acceptJointId) {
            void openFromSeed(acceptJointId, info);
          } else void submitAccept(info);
        }}
        onCancel={() => {
          if (!busy) {
            setMode(
              mode === "birth_create" ? "create" : "idle",
            );
          }
        }}
      />
    </div>
  );
}

/** Hook helper for initiator after peer accepts. */
export async function openJointSessionAsInitiator(
  jointId: string,
  selfBirth: BirthInfo,
  locale: string,
  router: { push: (href: string) => void },
): Promise<void> {
  const res = await fetch(`/api/joint/${jointId}`, { credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    seed?: JointSessionSeed | null;
  };
  if (!data.ok || !data.seed) throw new Error("joint_not_ready");
  const { session_id } = await hydrateJointSessionFromSeed(data.seed, selfBirth);
  router.push(`/${locale}/poju?session=${encodeURIComponent(session_id)}`);
}
