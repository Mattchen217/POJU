"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { getActivePOJUSessionsByDevice } from "@/lib/poju/session-manager";
import { QuestionDialog } from "@/components/poju/QuestionDialog";

type ActiveSession = {
  session_id: string;
  original_question: string;
  created_at: Date;
  expires_at: Date;
};

export function PojuStep2Entry() {
  const locale = useLocale();
  const router = useRouter();
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const deviceId = getPojuDeviceId();
      const sessions = await getActivePOJUSessionsByDevice(deviceId);
      if (!cancelled) setActiveSessions(sessions as ActiveSession[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleQuestionSubmit(question: string) {
    setLoading(true);
    sessionStorage.setItem("poju_pending_question", question);
    const returnUrl = `${window.location.origin}/${locale}/poju/payment-success`;
    const response = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "poju",
        amount: 9.99,
        device_id: getPojuDeviceId(),
        return_url: returnUrl,
      }),
    });
    const data = (await response.json()) as {
      payment_url?: string;
      checkout_url?: string;
      order_id?: string;
    };
    if (!response.ok || (!data.payment_url && !data.checkout_url) || !data.order_id) {
      setLoading(false);
      alert("Unable to start payment flow. Please try again.");
      return;
    }
    sessionStorage.setItem("poju_pending_order_id", data.order_id);
    window.location.href = data.payment_url ?? data.checkout_url!;
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-5xl rounded-2xl border border-white/10 bg-black/20 p-6">
      <h3 className="text-2xl font-semibold text-white">Start a session</h3>
      <p className="mt-2 text-sm text-white/70">One focused question • mock payment now • swap to real gateway later</p>
      <div className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
        <p className="text-lg font-medium text-violet-100">$9.99</p>
        <p className="text-sm text-violet-100/75">Deep decision support with POJU Agent</p>
      </div>
      {activeSessions.length > 0 ? (
        <div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-white/80">Active sessions</p>
          {activeSessions.map((s) => (
            <button
              type="button"
              key={s.session_id}
              className="block w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/5"
              onClick={() => router.push(`/${locale}/poju/session/${s.session_id}`)}
            >
              {s.original_question}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setShowQuestionDialog(true)}
        disabled={loading}
        className="mt-6 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Preparing..." : "Start a session"}
      </button>
      {showQuestionDialog ? (
        <QuestionDialog
          onClose={() => {
            if (!loading) setShowQuestionDialog(false);
          }}
          onSubmit={handleQuestionSubmit}
        />
      ) : null}
    </section>
  );
}
