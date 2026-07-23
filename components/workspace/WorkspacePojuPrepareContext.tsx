"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import {
  buildMatrixPayloadFromProfile,
  type PojuMatrixPayload,
} from "@/lib/poju/build-matrix-payload";
import { hasUnlockReportMessage } from "@/lib/poju/finalize-unlock-bazi-session";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { getUnlockReportText } from "@/lib/poju/unlock-report-gate";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  getStoredProfile,
  storedBaseAnalysisPresent,
} from "@/lib/profile/stored-profiles-service";

export type WorkspacePojuPreparePhase = "idle" | "handoff" | "preparing" | "exiting" | "chat";

export type WorkspaceBaseReportStatus = "idle" | "generating" | "ready" | "error";

type PrepareState = {
  phase: WorkspacePojuPreparePhase;
  profileId: string | null;
  matrixPayload: PojuMatrixPayload | null;
  session: POJUSessionState | null;
  matrixExpanded: boolean;
  /** Personal energy analysis report paper open in the right rail. */
  reportExpanded: boolean;
  error: string | null;
  /** @deprecated Center ritual removed — kept false; pipeline uses baseReportStatus. */
  unlockRitualActive: boolean;
  baseReportText: string | null;
  baseReportStatus: WorkspaceBaseReportStatus;
  baseReportError: string | null;
};

type PrepareApi = PrepareState & {
  openRight: () => void;
  startPrepare: (profileId: string) => void;
  setPhase: (phase: WorkspacePojuPreparePhase) => void;
  setProfileId: (profileId: string | null) => void;
  setMatrixPayload: (payload: PojuMatrixPayload | null) => void;
  setSession: (session: POJUSessionState | null) => void;
  setMatrixExpanded: (expanded: boolean) => void;
  setReportExpanded: (expanded: boolean) => void;
  setError: (error: string | null) => void;
  /**
   * Start base-analysis pipeline in the right rail (does not block center chat).
   * Chat should release pending question in parallel.
   */
  startUnlockRitual: () => void;
  completeUnlockRitual: (reportText: string) => void;
  failUnlockRitual: (message: string) => void;
  dismissUnlockRitual: () => void;
  resetPrepare: () => void;
  /** Restore a saved POJU session into center chat + right-rail matrix/report. */
  resumeSession: (sessionId: string, locale: string) => Promise<boolean>;
};

const WorkspacePojuPrepareContext = createContext<PrepareApi | null>(null);

const INITIAL: PrepareState = {
  phase: "idle",
  profileId: null,
  matrixPayload: null,
  session: null,
  matrixExpanded: false,
  reportExpanded: false,
  error: null,
  unlockRitualActive: false,
  baseReportText: null,
  baseReportStatus: "idle",
  baseReportError: null,
};

export function WorkspacePojuPrepareProvider({
  openRight,
  children,
}: {
  openRight: () => void;
  children: ReactNode;
}) {
  const [state, setState] = useState<PrepareState>(INITIAL);

  const startPrepare = useCallback((profileId: string) => {
    setState({
      ...INITIAL,
      phase: "handoff",
      profileId,
    });
  }, []);

  const setPhase = useCallback((phase: WorkspacePojuPreparePhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setProfileId = useCallback((profileId: string | null) => {
    setState((s) => ({ ...s, profileId }));
  }, []);

  const setMatrixPayload = useCallback((matrixPayload: PojuMatrixPayload | null) => {
    setState((s) => ({ ...s, matrixPayload }));
  }, []);

  const setSession = useCallback((session: POJUSessionState | null) => {
    setState((s) => ({ ...s, session }));
  }, []);

  const setMatrixExpanded = useCallback((matrixExpanded: boolean) => {
    setState((s) => ({ ...s, matrixExpanded }));
  }, []);

  const setReportExpanded = useCallback((reportExpanded: boolean) => {
    setState((s) => ({ ...s, reportExpanded }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const startUnlockRitual = useCallback(() => {
    openRight();
    setState((s) => ({
      ...s,
      unlockRitualActive: false,
      baseReportStatus: "generating",
      baseReportError: null,
      baseReportText: null,
      /** Force-collapse bazi list; user may expand again (wait ritual slides down). */
      matrixExpanded: false,
      reportExpanded: false,
      phase: "chat",
    }));
  }, [openRight]);

  const completeUnlockRitual = useCallback((reportText: string) => {
    setState((s) => ({
      ...s,
      unlockRitualActive: false,
      baseReportText: reportText,
      baseReportStatus: "ready",
      baseReportError: null,
      /** Arrive folded — user opens the report paper explicitly. */
      reportExpanded: false,
    }));
  }, []);

  const failUnlockRitual = useCallback((message: string) => {
    setState((s) => ({
      ...s,
      unlockRitualActive: false,
      baseReportStatus: "error",
      baseReportError: message,
    }));
  }, []);

  const dismissUnlockRitual = useCallback(() => {
    setState((s) => ({
      ...s,
      unlockRitualActive: false,
      baseReportStatus: s.baseReportStatus === "generating" ? "idle" : s.baseReportStatus,
    }));
  }, []);

  const resetPrepare = useCallback(() => {
    setState(INITIAL);
  }, []);

  const resumeSession = useCallback(
    async (sessionId: string, locale: string): Promise<boolean> => {
      try {
        const session = await loadPOJUSession(sessionId);
        if (!session) return false;

        const profileId =
          session.selected_stored_profile_id?.trim() ||
          session.agent_v2?.selected_profile_id?.trim() ||
          "";

        let matrixPayload: PojuMatrixPayload | null = session.matrix_payload ?? null;
        let baseReportText: string | null = null;
        let baseReportStatus: WorkspaceBaseReportStatus = "idle";

        if (profileId) {
          const profile = await getStoredProfile(profileId);
          if (profile) {
            matrixPayload =
              matrixPayload ??
              buildMatrixPayloadFromProfile(profileId, profile.user_profile, {
                locale,
              });
            if (
              hasUnlockReportMessage(session) ||
              storedBaseAnalysisPresent(profile.base_analysis)
            ) {
              const reportMsg = session.messages.find((m) => m.meta?.kind === "report");
              const text =
                getUnlockReportText(reportMsg) ||
                markedTextFromStoredBaseAnalysis(profile.base_analysis) ||
                "";
              if (text) {
                baseReportText = text;
                baseReportStatus = "ready";
              }
            }
          }
        }

        openRight();
        setState({
          ...INITIAL,
          phase: "chat",
          profileId: profileId || null,
          session,
          matrixPayload,
          matrixExpanded: false,
          reportExpanded: false,
          baseReportText,
          baseReportStatus,
        });
        return true;
      } catch (e) {
        console.error("[workspace] resume POJU session failed:", e);
        return false;
      }
    },
    [openRight],
  );

  const value = useMemo<PrepareApi>(
    () => ({
      ...state,
      openRight,
      startPrepare,
      setPhase,
      setProfileId,
      setMatrixPayload,
      setSession,
      setMatrixExpanded,
      setReportExpanded,
      setError,
      startUnlockRitual,
      completeUnlockRitual,
      failUnlockRitual,
      dismissUnlockRitual,
      resetPrepare,
      resumeSession,
    }),
    [
      state,
      openRight,
      startPrepare,
      setPhase,
      setProfileId,
      setMatrixPayload,
      setSession,
      setMatrixExpanded,
      setReportExpanded,
      setError,
      startUnlockRitual,
      completeUnlockRitual,
      failUnlockRitual,
      dismissUnlockRitual,
      resetPrepare,
      resumeSession,
    ],
  );

  return (
    <WorkspacePojuPrepareContext.Provider value={value}>
      {children}
    </WorkspacePojuPrepareContext.Provider>
  );
}

export function useWorkspacePojuPrepare(): PrepareApi {
  const ctx = useContext(WorkspacePojuPrepareContext);
  if (!ctx) {
    throw new Error("useWorkspacePojuPrepare must be used within WorkspacePojuPrepareProvider");
  }
  return ctx;
}

/** Safe for right drawer when provider may be absent on non-POJU tabs — always provided in shell. */
export function useWorkspacePojuPrepareOptional(): PrepareApi | null {
  return useContext(WorkspacePojuPrepareContext);
}

/** True when right rail should use the large (3×) width. */
export function useWorkspaceRightRailWide(): boolean {
  const prepare = useWorkspacePojuPrepareOptional();
  if (!prepare) return false;
  if (prepare.matrixExpanded) return true;
  if (prepare.reportExpanded) return true;
  if (prepare.baseReportStatus === "generating") return true;
  return false;
}
