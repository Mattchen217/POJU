"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type WorkspaceGlyphPreparePhase =
  | "idle"
  | "handoff"
  | "preparing"
  | "draw"
  | "reading";

type PrepareState = {
  phase: WorkspaceGlyphPreparePhase;
  profileId: string | null;
  readingId: string | null;
  matrixPayload: PojuMatrixPayload | null;
  narrative: MatrixNarrativeResponse | null;
  matrixExpanded: boolean;
  matrixUnread: boolean;
  error: string | null;
};

type PrepareApi = PrepareState & {
  openRight: () => void;
  startPrepare: (profileId: string) => void;
  setPhase: (phase: WorkspaceGlyphPreparePhase) => void;
  setReadingId: (readingId: string | null) => void;
  setMatrixPayload: (payload: PojuMatrixPayload | null) => void;
  setNarrative: (narrative: MatrixNarrativeResponse | null) => void;
  setMatrixExpanded: (expanded: boolean) => void;
  setError: (error: string | null) => void;
  resetPrepare: () => void;
};

const WorkspaceGlyphPrepareContext = createContext<PrepareApi | null>(null);

const INITIAL: PrepareState = {
  phase: "idle",
  profileId: null,
  readingId: null,
  matrixPayload: null,
  narrative: null,
  matrixExpanded: false,
  matrixUnread: false,
  error: null,
};

export function WorkspaceGlyphPrepareProvider({
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

  const setPhase = useCallback((phase: WorkspaceGlyphPreparePhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setReadingId = useCallback((readingId: string | null) => {
    setState((s) => ({ ...s, readingId }));
  }, []);

  const setMatrixPayload = useCallback((matrixPayload: PojuMatrixPayload | null) => {
    setState((s) => ({
      ...s,
      matrixPayload,
      matrixUnread: Boolean(matrixPayload),
    }));
  }, []);

  const setNarrative = useCallback((narrative: MatrixNarrativeResponse | null) => {
    setState((s) => ({ ...s, narrative }));
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

  const resetPrepare = useCallback(() => {
    setState(INITIAL);
  }, []);

  const value = useMemo<PrepareApi>(
    () => ({
      ...state,
      openRight,
      startPrepare,
      setPhase,
      setReadingId,
      setMatrixPayload,
      setNarrative,
      setMatrixExpanded,
      setError,
      resetPrepare,
    }),
    [
      state,
      openRight,
      startPrepare,
      setPhase,
      setReadingId,
      setMatrixPayload,
      setNarrative,
      setMatrixExpanded,
      setError,
      resetPrepare,
    ],
  );

  return (
    <WorkspaceGlyphPrepareContext.Provider value={value}>
      {children}
    </WorkspaceGlyphPrepareContext.Provider>
  );
}

export function useWorkspaceGlyphPrepare(): PrepareApi {
  const ctx = useContext(WorkspaceGlyphPrepareContext);
  if (!ctx) {
    throw new Error("useWorkspaceGlyphPrepare must be used within WorkspaceGlyphPrepareProvider");
  }
  return ctx;
}

export function useWorkspaceGlyphPrepareOptional(): PrepareApi | null {
  return useContext(WorkspaceGlyphPrepareContext);
}

export function useWorkspaceGlyphRightRailWide(): boolean {
  const prepare = useWorkspaceGlyphPrepareOptional();
  return Boolean(prepare?.matrixExpanded && prepare.matrixPayload);
}
