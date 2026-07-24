"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { MatchSession } from "@/lib/match/types";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type WorkspaceMatchPhase =
  | "entry"
  | "warmup"
  | "inquiry"
  | "paywall"
  | "generating"
  | "delivery";

export type WorkspaceMatchRailDocStatus = "placeholder" | "generating" | "ready" | "error";

type MatchState = {
  phase: WorkspaceMatchPhase;
  collectingSlot: "a" | "b";
  profileIdA: string | null;
  profileIdB: string | null;
  relationship: string;
  previewId: string | null;
  matrixPayloadA: PojuMatrixPayload | null;
  matrixPayloadB: PojuMatrixPayload | null;
  matrixUnreadA: boolean;
  matrixUnreadB: boolean;
  matrixExpandedA: boolean;
  matrixExpandedB: boolean;
  reportAStatus: WorkspaceMatchRailDocStatus;
  reportBStatus: WorkspaceMatchRailDocStatus;
  matchReportStatus: WorkspaceMatchRailDocStatus;
  reportAText: string | null;
  reportBText: string | null;
  matchSession: MatchSession | null;
  matchReportExpanded: boolean;
  reportAExpanded: boolean;
  reportBExpanded: boolean;
  error: string | null;
};

type MatchApi = MatchState & {
  setPhase: (phase: WorkspaceMatchPhase) => void;
  setCollectingSlot: (slot: "a" | "b") => void;
  setProfileA: (profileId: string) => void;
  setProfileB: (profileId: string) => void;
  setRelationship: (value: string) => void;
  setPreviewId: (id: string | null) => void;
  setMatrixPayloadA: (payload: PojuMatrixPayload | null) => void;
  setMatrixPayloadB: (payload: PojuMatrixPayload | null) => void;
  setMatrixUnreadA: (unread: boolean) => void;
  setMatrixUnreadB: (unread: boolean) => void;
  setMatrixExpandedA: (expanded: boolean) => void;
  setMatrixExpandedB: (expanded: boolean) => void;
  setReportAStatus: (status: WorkspaceMatchRailDocStatus) => void;
  setReportBStatus: (status: WorkspaceMatchRailDocStatus) => void;
  setMatchReportStatus: (status: WorkspaceMatchRailDocStatus) => void;
  setReportAText: (text: string | null) => void;
  setReportBText: (text: string | null) => void;
  setMatchSession: (session: MatchSession | null) => void;
  setMatchReportExpanded: (expanded: boolean) => void;
  setReportAExpanded: (expanded: boolean) => void;
  setReportBExpanded: (expanded: boolean) => void;
  setError: (error: string | null) => void;
  beginWarmup: () => void;
  openRightAfterWarmup: () => void;
  resetMatch: () => void;
};

const WorkspaceMatchPrepareContext = createContext<MatchApi | null>(null);

const INITIAL: MatchState = {
  phase: "entry",
  collectingSlot: "a",
  profileIdA: null,
  profileIdB: null,
  relationship: "",
  previewId: null,
  matrixPayloadA: null,
  matrixPayloadB: null,
  matrixUnreadA: false,
  matrixUnreadB: false,
  matrixExpandedA: false,
  matrixExpandedB: false,
  reportAStatus: "placeholder",
  reportBStatus: "placeholder",
  matchReportStatus: "placeholder",
  reportAText: null,
  reportBText: null,
  matchSession: null,
  matchReportExpanded: false,
  reportAExpanded: false,
  reportBExpanded: false,
  error: null,
};

export function WorkspaceMatchPrepareProvider({
  children,
  openRight,
}: {
  children: ReactNode;
  openRight?: () => void;
}) {
  const [state, setState] = useState<MatchState>(INITIAL);

  const setPhase = useCallback((phase: WorkspaceMatchPhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setCollectingSlot = useCallback((collectingSlot: "a" | "b") => {
    setState((s) => ({ ...s, collectingSlot }));
  }, []);

  const setProfileA = useCallback((profileIdA: string) => {
    setState((s) => ({ ...s, profileIdA }));
    try {
      sessionStorage.setItem("match_a_profile_id", profileIdA);
    } catch {
      /* private mode */
    }
  }, []);

  const setProfileB = useCallback((profileIdB: string) => {
    setState((s) => ({ ...s, profileIdB }));
    try {
      sessionStorage.setItem("match_b_profile_id", profileIdB);
    } catch {
      /* private mode */
    }
  }, []);

  const setRelationship = useCallback((relationship: string) => {
    setState((s) => ({ ...s, relationship }));
  }, []);

  const setPreviewId = useCallback((previewId: string | null) => {
    setState((s) => ({ ...s, previewId }));
  }, []);

  const setMatrixPayloadA = useCallback((matrixPayloadA: PojuMatrixPayload | null) => {
    setState((s) => ({ ...s, matrixPayloadA }));
  }, []);

  const setMatrixPayloadB = useCallback((matrixPayloadB: PojuMatrixPayload | null) => {
    setState((s) => ({ ...s, matrixPayloadB }));
  }, []);

  const setMatrixUnreadA = useCallback((matrixUnreadA: boolean) => {
    setState((s) => ({ ...s, matrixUnreadA }));
  }, []);

  const setMatrixUnreadB = useCallback((matrixUnreadB: boolean) => {
    setState((s) => ({ ...s, matrixUnreadB }));
  }, []);

  const setMatrixExpandedA = useCallback((matrixExpandedA: boolean) => {
    setState((s) => ({
      ...s,
      matrixExpandedA,
      matrixUnreadA: matrixExpandedA ? false : s.matrixUnreadA,
      matrixExpandedB: matrixExpandedA ? false : s.matrixExpandedB,
      reportAExpanded: matrixExpandedA ? false : s.reportAExpanded,
      reportBExpanded: matrixExpandedA ? false : s.reportBExpanded,
      matchReportExpanded: matrixExpandedA ? false : s.matchReportExpanded,
    }));
  }, []);

  const setMatrixExpandedB = useCallback((matrixExpandedB: boolean) => {
    setState((s) => ({
      ...s,
      matrixExpandedB,
      matrixUnreadB: matrixExpandedB ? false : s.matrixUnreadB,
      matrixExpandedA: matrixExpandedB ? false : s.matrixExpandedA,
      reportAExpanded: matrixExpandedB ? false : s.reportAExpanded,
      reportBExpanded: matrixExpandedB ? false : s.reportBExpanded,
      matchReportExpanded: matrixExpandedB ? false : s.matchReportExpanded,
    }));
  }, []);

  const setReportAStatus = useCallback((reportAStatus: WorkspaceMatchRailDocStatus) => {
    setState((s) => ({ ...s, reportAStatus }));
  }, []);

  const setReportBStatus = useCallback((reportBStatus: WorkspaceMatchRailDocStatus) => {
    setState((s) => ({ ...s, reportBStatus }));
  }, []);

  const setMatchReportStatus = useCallback((matchReportStatus: WorkspaceMatchRailDocStatus) => {
    setState((s) => ({ ...s, matchReportStatus }));
  }, []);

  const setReportAText = useCallback((reportAText: string | null) => {
    setState((s) => ({ ...s, reportAText }));
  }, []);

  const setReportBText = useCallback((reportBText: string | null) => {
    setState((s) => ({ ...s, reportBText }));
  }, []);

  const setMatchSession = useCallback((matchSession: MatchSession | null) => {
    setState((s) => ({ ...s, matchSession }));
  }, []);

  const setMatchReportExpanded = useCallback((matchReportExpanded: boolean) => {
    setState((s) => ({
      ...s,
      matchReportExpanded,
      matrixExpandedA: matchReportExpanded ? false : s.matrixExpandedA,
      matrixExpandedB: matchReportExpanded ? false : s.matrixExpandedB,
      reportAExpanded: matchReportExpanded ? false : s.reportAExpanded,
      reportBExpanded: matchReportExpanded ? false : s.reportBExpanded,
    }));
  }, []);

  const setReportAExpanded = useCallback((reportAExpanded: boolean) => {
    setState((s) => ({
      ...s,
      reportAExpanded,
      matrixExpandedA: reportAExpanded ? false : s.matrixExpandedA,
      matrixExpandedB: reportAExpanded ? false : s.matrixExpandedB,
      reportBExpanded: reportAExpanded ? false : s.reportBExpanded,
      matchReportExpanded: reportAExpanded ? false : s.matchReportExpanded,
    }));
  }, []);

  const setReportBExpanded = useCallback((reportBExpanded: boolean) => {
    setState((s) => ({
      ...s,
      reportBExpanded,
      matrixExpandedA: reportBExpanded ? false : s.matrixExpandedA,
      matrixExpandedB: reportBExpanded ? false : s.matrixExpandedB,
      reportAExpanded: reportBExpanded ? false : s.reportAExpanded,
      matchReportExpanded: reportBExpanded ? false : s.matchReportExpanded,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const beginWarmup = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: "warmup",
      matrixPayloadA: null,
      matrixPayloadB: null,
      matrixUnreadA: false,
      matrixUnreadB: false,
      matrixExpandedA: false,
      matrixExpandedB: false,
      reportAStatus: "placeholder",
      reportBStatus: "placeholder",
      matchReportStatus: "placeholder",
    }));
  }, []);

  const openRightAfterWarmup = useCallback(() => {
    openRight?.();
  }, [openRight]);

  const resetMatch = useCallback(() => {
    setState(INITIAL);
  }, []);

  const value = useMemo<MatchApi>(
    () => ({
      ...state,
      setPhase,
      setCollectingSlot,
      setProfileA,
      setProfileB,
      setRelationship,
      setPreviewId,
      setMatrixPayloadA,
      setMatrixPayloadB,
      setMatrixUnreadA,
      setMatrixUnreadB,
      setMatrixExpandedA,
      setMatrixExpandedB,
      setReportAStatus,
      setReportBStatus,
      setMatchReportStatus,
      setReportAText,
      setReportBText,
      setMatchSession,
      setMatchReportExpanded,
      setReportAExpanded,
      setReportBExpanded,
      setError,
      beginWarmup,
      openRightAfterWarmup,
      resetMatch,
    }),
    [
      state,
      setPhase,
      setCollectingSlot,
      setProfileA,
      setProfileB,
      setRelationship,
      setPreviewId,
      setMatrixPayloadA,
      setMatrixPayloadB,
      setMatrixUnreadA,
      setMatrixUnreadB,
      setMatrixExpandedA,
      setMatrixExpandedB,
      setReportAStatus,
      setReportBStatus,
      setMatchReportStatus,
      setReportAText,
      setReportBText,
      setMatchSession,
      setMatchReportExpanded,
      setReportAExpanded,
      setReportBExpanded,
      setError,
      beginWarmup,
      openRightAfterWarmup,
      resetMatch,
    ],
  );

  return (
    <WorkspaceMatchPrepareContext.Provider value={value}>
      {children}
    </WorkspaceMatchPrepareContext.Provider>
  );
}

export function useWorkspaceMatchPrepare(): MatchApi {
  const ctx = useContext(WorkspaceMatchPrepareContext);
  if (!ctx) {
    throw new Error("useWorkspaceMatchPrepare must be used within WorkspaceMatchPrepareProvider");
  }
  return ctx;
}

export function useWorkspaceMatchPrepareOptional(): MatchApi | null {
  return useContext(WorkspaceMatchPrepareContext);
}

/** True when Match right rail needs the large width. */
export function useWorkspaceMatchRightRailWide(): boolean {
  const match = useWorkspaceMatchPrepareOptional();
  if (!match) return false;
  if (match.matrixExpandedA || match.matrixExpandedB) return true;
  if (match.reportAExpanded || match.reportBExpanded || match.matchReportExpanded) return true;
  if (match.reportAStatus === "generating" || match.reportBStatus === "generating") return true;
  if (match.matchReportStatus === "generating") return true;
  return false;
}
