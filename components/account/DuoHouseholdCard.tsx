"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { JointDecisionPanel } from "@/components/poju/JointDecisionPanel";
import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";

type HouseholdPayload = {
  ok?: boolean;
  can_joint?: boolean;
  household: {
    id: string;
    status: string;
    shared_sub_balance: number;
    quota: number;
    peer_bound: boolean;
    role: string;
  } | null;
};

/**
 * Account / workspace card: bind seat B + joint decision entry.
 * Always visible — without Duo, CTA is grayed and opens subscribe.
 */
export function DuoHouseholdCard() {
  const locale = useLocale();
  const zh = locale.toLowerCase().startsWith("zh");
  const [data, setData] = useState<HouseholdPayload | null>(null);
  const [email, setEmail] = useState("");
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/household/me", { credentials: "same-origin" });
    const json = (await res.json().catch(() => ({}))) as HouseholdPayload;
    if (json.ok) setData(json);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function inviteSeat() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/household/invite-seat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        invite_path?: string;
      };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "invite_failed");
        return;
      }
      const path = json.invite_path
        ? `/${locale}${json.invite_path}`
        : null;
      setInvitePath(path);
      setMsg(zh ? "邀请已生成，把链接发给搭档。" : "Invite created — send the link to your partner.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const hh = data?.household ?? null;

  return (
    <section className="duo-household-card rounded-xl border border-white/10 bg-black/20 p-4">
      <h2 className="text-base font-medium text-[#f5f0e8]">
        {zh ? "双人订阅 · 共同决策" : "Duo · Joint decision"}
      </h2>

      {!hh ? (
        <>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {zh
              ? "共同决策仅双人订阅可用。订阅后绑定第二账号，双方各扣 1 PASS。"
              : "Joint decisions require Duo. Bind a second account after subscribe — 1 PASS each."}
          </p>
          <button
            type="button"
            className="mt-3 rounded bg-[#c4a574]/20 px-3 py-2 text-sm text-[#f5f0e8]"
            onClick={() => setBuyOpen(true)}
          >
            {zh ? "查看双人订阅" : "View Duo subscription"}
          </button>
          <div className="mt-4 opacity-50 pointer-events-none" aria-disabled>
            <JointDecisionPanel />
          </div>
          <PassPurchaseModal
            open={buyOpen}
            onClose={() => {
              setBuyOpen(false);
              void refresh();
            }}
          />
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {zh
              ? `共享额度 ${hh.shared_sub_balance}/${hh.quota} · 席位 ${hh.role}${hh.peer_bound ? " · 已满员" : " · 待邀请第二账号"}`
              : `Shared pool ${hh.shared_sub_balance}/${hh.quota} · seat ${hh.role}${hh.peer_bound ? " · full" : " · invite seat B"}`}
          </p>

          {hh.role === "seat_a" && !hh.peer_bound ? (
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="email"
                placeholder={zh ? "搭档邮箱（可选）" : "Partner email (optional)"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded border border-white/15 bg-transparent px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void inviteSeat()}
                className="rounded bg-[#c4a574]/15 px-3 py-2 text-sm text-[#f5f0e8]"
              >
                {zh ? "生成绑定邀请链接" : "Create bind invite link"}
              </button>
              {invitePath ? (
                <code className="break-all text-xs text-[#cbd5e1]">{invitePath}</code>
              ) : null}
            </div>
          ) : null}

          {msg ? <p className="mt-2 text-xs text-[#94a3b8]">{msg}</p> : null}

          <div className="mt-4">
            <JointDecisionPanel />
          </div>
        </>
      )}
    </section>
  );
}
