"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { getPojuDb } from "@/lib/db/poju-db";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { setPOJUV4SessionStatus } from "@/lib/poju/v4-lifecycle";
import { POJUChatUI } from "@/components/poju/POJUChatUI";
import { AppDialogProvider } from "@/components/ui/app-dialog";
import { getWelcomeMessage } from "@/lib/poju/welcome-messages";
import type { POJUSessionState } from "@/lib/poju/types";
import { Link, useRouter } from "@/i18n/navigation";

export default function PojuSessionDeepLinkPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pausedOnly, setPausedOnly] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setPausedOnly(false);
    if (!sessionId) {
      setError("missing_session");
      setLoading(false);
      return;
    }
    const row = await getPojuDb().pojuSessionRecords.get(sessionId);
    if (!row) {
      setError("session_not_found");
      setLoading(false);
      return;
    }
    if (row.status === "archived" || row.status === "resolved") {
      setError("session_closed");
      setLoading(false);
      return;
    }
    if (row.status === "paused") {
      setPausedOnly(true);
      setLoading(false);
      return;
    }

    const local = await loadPOJUSession(sessionId);
    if (!local) {
      setError("session_not_found");
      setLoading(false);
      return;
    }

    if (local.messages.length === 0) {
      local.messages.push({
        role: "assistant",
        content: getWelcomeMessage(locale),
        timestamp: new Date().toISOString(),
        meta: {
          current_state: "greeting",
          user_intent: "greeting",
        },
      });
      await savePOJUSession(local);
    }

    setSession(local);
    setLoading(false);
  }, [locale, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResume() {
    await setPOJUV4SessionStatus(sessionId, "active");
    setPausedOnly(false);
    setLoading(true);
    setSession(null);
    await load();
  }

  if (error) {
    const closed = error === "session_closed";
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center bg-bg-deep px-4 text-text-body">
        <p className="text-text-primary">
          {closed ? "This session is archived or marked as ended." : "Session not available."}
        </p>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {closed ? (
            <Link href="/poju/archive" className="text-violet-300 underline">
              Open archive
            </Link>
          ) : null}
          <button type="button" className="text-violet-300 underline" onClick={() => router.push("/poju")}>
            Back to POJU
          </button>
        </div>
      </main>
    );
  }

  if (loading) return <main className="flex min-h-[50vh] items-center justify-center text-white/70">Loading...</main>;
  if (!session) return <main className="flex min-h-[50vh] items-center justify-center text-white/70">Session not found</main>;

  if (pausedOnly) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center text-white/85">
        <p>This POJU session is paused. Resume to continue chatting.</p>
        <button
          type="button"
          className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white"
          onClick={() => void handleResume()}
        >
          Resume session
        </button>
      </main>
    );
  }

  return (
    <AppDialogProvider>
      <POJUChatUI session={session} onSessionUpdate={setSession} locale={locale} />
    </AppDialogProvider>
  );
}
