"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type WorkspaceAtmosPreparePhase =
  | "idle"
  | "handoff"
  | "preparing"
  | "exiting"
  | "forecast";

export type AtmosDayReadingStatus = "idle" | "generating" | "ready" | "error";

export type AtmosDayReading = {
  /** YYYY-MM-DD (bazi / civil day key). */
  dateKey: string;
  fieldTone: string;
  whatToWatch: string;
  oneMove: string;
  fullText: string;
};

type PrepareState = {
  phase: WorkspaceAtmosPreparePhase;
  profileId: string | null;
  matrixPayload: PojuMatrixPayload | null;
  matrixExpanded: boolean;
  matrixUnread: boolean;
  error: string | null;
  /** Today unlocked after paywall. */
  todayUnlocked: boolean;
  dayReadings: Record<string, AtmosDayReading>;
  readingStatus: AtmosDayReadingStatus;
  readingError: string | null;
  /** Expanded cell date key for reading sheet. */
  expandedDateKey: string | null;
  paywallOpen: boolean;
};

type PrepareApi = PrepareState & {
  openRight: () => void;
  startPrepare: (profileId: string) => void;
  setPhase: (phase: WorkspaceAtmosPreparePhase) => void;
  setMatrixPayload: (payload: PojuMatrixPayload | null) => void;
  setMatrixExpanded: (expanded: boolean) => void;
  setError: (error: string | null) => void;
  setTodayUnlocked: (unlocked: boolean) => void;
  setPaywallOpen: (open: boolean) => void;
  setReadingStatus: (status: AtmosDayReadingStatus) => void;
  setReadingError: (error: string | null) => void;
  upsertDayReading: (reading: AtmosDayReading) => void;
  setExpandedDateKey: (dateKey: string | null) => void;
  resetPrepare: () => void;
};

const WorkspaceAtmosPrepareContext = createContext<PrepareApi | null>(null);

const INITIAL: PrepareState = {
  phase: "idle",
  profileId: null,
  matrixPayload: null,
  matrixExpanded: false,
  matrixUnread: false,
  error: null,
  todayUnlocked: false,
  dayReadings: {},
  readingStatus: "idle",
  readingError: null,
  expandedDateKey: null,
  paywallOpen: false,
};

export function WorkspaceAtmosPrepareProvider({
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

  const setPhase = useCallback((phase: WorkspaceAtmosPreparePhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setMatrixPayload = useCallback((matrixPayload: PojuMatrixPayload | null) => {
    setState((s) => ({
      ...s,
      matrixPayload,
      matrixUnread: Boolean(matrixPayload),
    }));
  }, []);

  const setMatrixExpanded = useCallback((matrixExpanded: boolean) => {
    setState((s) => ({
      ...s,
      matrixExpanded,
      matrixUnread: matrixExpanded ? false : s.matrixUnread,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const setTodayUnlocked = useCallback((todayUnlocked: boolean) => {
    setState((s) => ({ ...s, todayUnlocked }));
  }, []);

  const setPaywallOpen = useCallback((paywallOpen: boolean) => {
    setState((s) => ({ ...s, paywallOpen }));
  }, []);

  const setReadingStatus = useCallback((readingStatus: AtmosDayReadingStatus) => {
    setState((s) => ({ ...s, readingStatus }));
  }, []);

  const setReadingError = useCallback((readingError: string | null) => {
    setState((s) => ({ ...s, readingError }));
  }, []);

  const upsertDayReading = useCallback((reading: AtmosDayReading) => {
    setState((s) => ({
      ...s,
      dayReadings: { ...s.dayReadings, [reading.dateKey]: reading },
      readingStatus: "ready",
      readingError: null,
    }));
  }, []);

  const setExpandedDateKey = useCallback((expandedDateKey: string | null) => {
    setState((s) => ({ ...s, expandedDateKey }));
  }, []);

  const resetPrepare = useCallback(() => {
    setState(INITIAL);
  }, []);

  const value = useMemo<PrepareApi>(
    () => ({
      ...state,
      openRight,
      startPrepare,
      setPhase,
      setMatrixPayload,
      setMatrixExpanded,
      setError,
      setTodayUnlocked,
      setPaywallOpen,
      setReadingStatus,
      setReadingError,
      upsertDayReading,
      setExpandedDateKey,
      resetPrepare,
    }),
    [
      state,
      openRight,
      startPrepare,
      setPhase,
      setMatrixPayload,
      setMatrixExpanded,
      setError,
      setTodayUnlocked,
      setPaywallOpen,
      setReadingStatus,
      setReadingError,
      upsertDayReading,
      setExpandedDateKey,
      resetPrepare,
    ],
  );

  return (
    <WorkspaceAtmosPrepareContext.Provider value={value}>
      {children}
    </WorkspaceAtmosPrepareContext.Provider>
  );
}

export function useWorkspaceAtmosPrepare(): PrepareApi {
  const ctx = useContext(WorkspaceAtmosPrepareContext);
  if (!ctx) {
    throw new Error("useWorkspaceAtmosPrepare must be used within WorkspaceAtmosPrepareProvider");
  }
  return ctx;
}

export function useWorkspaceAtmosPrepareOptional(): PrepareApi | null {
  return useContext(WorkspaceAtmosPrepareContext);
}

/** Atmos right rail wide when energy portrait is expanded. */
export function useWorkspaceAtmosRightRailWide(): boolean {
  const prepare = useWorkspaceAtmosPrepareOptional();
  return Boolean(prepare?.matrixExpanded && prepare.matrixPayload);
}
