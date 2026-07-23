"use client";

import { useLocale } from "next-intl";

import { POJUChatUI } from "@/components/poju/POJUChatUI";
import { AppDialogProvider } from "@/components/ui/app-dialog";
import { useWorkspacePojuPrepare } from "@/components/workspace/WorkspacePojuPrepareContext";
import { savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";

import "@/styles/poju-matrix-welcome.css";

/**
 * Workspace opening: welcome + original PojuChat composer (full attach/voice/send wiring).
 * No chat shell / sidebar / debug panel.
 */
export function WorkspacePojuChatStage() {
  const locale = useLocale();
  const { session, setSession } = useWorkspacePojuPrepare();

  if (!session) return null;

  return (
    <AppDialogProvider>
      <POJUChatUI
        layout="workspace-opening"
        session={session}
        locale={locale}
        onSessionUpdate={(next: POJUSessionState) => {
          setSession(next);
          void savePOJUSession(next);
        }}
      />
    </AppDialogProvider>
  );
}
