"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { getPojuDb } from "@/lib/db/poju-db";
import { loadPOJUSession, restoreAuthoritativePOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { setPOJUV4SessionStatus } from "@/lib/poju/v4-lifecycle";
import { isUnlockReportReturnRoute } from "@/lib/poju/unlock-report-gate";
import { PojuSessionChatShell } from "@/components/poju/PojuSessionChatShell";
import { AppDialogProvider } from "@/components/ui/app-dialog";
import "@/styles/poju-unlock-report.css";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { dedupeWelcomeMessages, seedMatrixWelcomeMessage } from "@/lib/poju/chat-bootstrap";
import { sessionMatrixReadyForChat } from "@/lib/poju/matrix-narrative-ready";
import { dedupePreviewMatrixMessages, isPreviewSession } from "@/lib/poju/preview-unlock";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
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
  const [authorityNotice, setAuthorityNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setPausedOnly(false);
    if (!sessionId) {
      setError("missing_session");
      setLoading(false);
      return;
    }
    setAuthorityNotice(null);
    const row = await getPojuDb().pojuSessionRecords.get(sessionId);
    if (row?.status === "archived" || row?.status === "resolved") {
      setError("session_closed");
      setLoading(false);
      return;
    }
    if (row?.status === "paused") {
      setPausedOnly(true);
      setLoading(false);
      return;
    }

    const restored = await restoreAuthoritativePOJUSession(sessionId);
    if (restored.authority_sync === "server_missing") {
      setError("session_not_found");
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "server_expired") {
      setError("session_expired");
      setSession(restored.session);
      setAuthorityNotice(restored.message);
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "server_terminated") {
      setError("session_terminated");
      setSession(restored.session);
      setAuthorityNotice(restored.message);
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "offline_cache") {
      setAuthorityNotice(restored.message);
    }

    let local = restored.session ?? (await loadPOJUSession(sessionId));
    if (!local) {
      setError("session_not_found");
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "server_frozen") {
      setAuthorityNotice(restored.message);
    }

    const { backfillSessionProfileBinding } = await import("@/lib/poju/session-profile");
    const backfilled = backfillSessionProfileBinding(local);
    if (backfilled !== local) {
      local = backfilled;
      await savePOJUSession(local);
    }

    if (!resolveSessionHasProfile(local)) {
      router.replace(`/poju/session/${sessionId}/prepare`);
      return;
    }

    if (!local.agent_v2 && resolveSessionHasProfile(local)) {
      local.agent_v2 = createInitialAgentState({
        original_question: local.original_question,
        selected_profile_id: local.selected_stored_profile_id,
      });
      await savePOJUSession(local);
    }

    if (
      local.selected_stored_profile_id &&
      !local.matrix_payload &&
      local.unlock_status !== "unlocked" &&
      !local.agent_v2?.has_base_analysis
    ) {
      try {
        const { bindPreviewProfileToSession } = await import("@/lib/poju/preview-unlock");
        local = await bindPreviewProfileToSession(local, local.selected_stored_profile_id, locale);
        await savePOJUSession(local);
      } catch (e) {
        console.warn("[poju/session] matrix payload bootstrap failed:", e);
      }
    }

    if (local.selected_stored_profile_id) {
      let deduped = dedupePreviewMatrixMessages(local);
      deduped = dedupeWelcomeMessages(deduped);
      if (deduped.matrix_payload && isPreviewSession(deduped)) {
        const withWelcome = seedMatrixWelcomeMessage(deduped, locale);
        deduped = dedupeWelcomeMessages(withWelcome);
      }
      if (deduped !== local) {
        local = deduped;
        await savePOJUSession(local);
      }
    }

    if (isPreviewSession(local) && !sessionMatrixReadyForChat(local)) {
      const pid = local.selected_stored_profile_id?.trim();
      if (pid) {
        router.replace(
          `/poju/session/${sessionId}/preparing?profile=${encodeURIComponent(pid)}`,
        );
        return;
      }
    }

    setSession(local);
    setLoading(false);
  }, [locale, router, sessionId]);

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
          {closed
            ? "This session is archived or marked as ended."
            : error === "session_expired"
              ? "This session has expired on the server. Intake cannot continue."
              : error === "session_terminated"
                ? "This session has been terminated on the server and cannot be restored locally."
                : "Session not available."}
        </p>
        {authorityNotice ? <p className="mt-2 max-w-md text-center text-sm text-white/60">{authorityNotice}</p> : null}
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

  if (loading) {
    if (typeof window !== "undefined" && isUnlockReportReturnRoute(sessionId)) {
      return (
        <main
          className="poju-unlock-report-overlay poju-unlock-report-overlay--route-pending"
          aria-busy="true"
          aria-label="Opening base analysis report"
        />
      );
    }
    return <main className="flex min-h-[50vh] items-center justify-center text-white/70">Loading...</main>;
  }
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
      {authorityNotice ? (
        <p className="bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-100">{authorityNotice}</p>
      ) : null}
      <PojuSessionChatShell
        session={session}
        onSessionUpdate={setSession}
        locale={locale}
        onReload={() => void load()}
      />
    </AppDialogProvider>
  );
}
