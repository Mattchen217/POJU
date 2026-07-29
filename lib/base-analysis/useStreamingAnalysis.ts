'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import type { BaseAnalysisJob } from '@/lib/base-analysis/job-types';
import type {
  BaseAnalysisProgressStage,
  ProgressPayload,
} from '@/lib/base-analysis/progress-stages';
import { consumeBaseAnalysisStream } from '@/lib/base-analysis/stream-sse-client';

export interface UseStreamingAnalysisOptions {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob['local_data'];
  resume_job_id?: string;

  onComplete: (content: string, meta: BaseAnalysisJob['meta'] | Record<string, unknown>) => void;
  onError: (error: string) => void;
  onCoreJudgments?: (judgments: unknown, source?: string) => void;
  onProgress?: (payload: ProgressPayload) => void;
}

export interface StreamingState {
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  content: string;
  job_id: string | null;
  error: string | null;
  bytes_received: number;
  progress_stage: BaseAnalysisProgressStage | null;
}

export function stripMetaSection(content: string): string {
  const idx = content.lastIndexOf('---META---');
  return idx === -1 ? content : content.slice(0, idx).trim();
}

/** Throttle React updates during SSE — full content stays in a ref until complete. */
const STREAM_UI_TICK_MS = 500;

export function useStreamingAnalysis(opts: UseStreamingAnalysisOptions) {
  const [state, setState] = useState<StreamingState>({
    status: 'idle',
    content: '',
    job_id: null,
    error: null,
    bytes_received: 0,
    progress_stage: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const optsRef = useRef(opts);
  const contentRef = useRef('');
  const lastUiTickRef = useRef(0);
  optsRef.current = opts;

  const bumpStreamProgress = useCallback((accumulated: string) => {
    contentRef.current = accumulated;
    const now = Date.now();
    if (now - lastUiTickRef.current < STREAM_UI_TICK_MS) return;
    lastUiTickRef.current = now;
    setState((prev) => ({
      ...prev,
      status: 'streaming',
      bytes_received: accumulated.length,
    }));
  }, []);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    const runId = (runIdRef.current += 1);

    contentRef.current = '';
    lastUiTickRef.current = 0;
    setState({
      status: 'connecting',
      content: '',
      job_id: null,
      error: null,
      bytes_received: 0,
      progress_stage: null,
    });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const result = await consumeBaseAnalysisStream({
        profile_id: optsRef.current.profile_id,
        locale: optsRef.current.locale,
        local_data: optsRef.current.local_data,
        resume_job_id: optsRef.current.resume_job_id,
        signal: abort.signal,
        callbacks: {
          onStart: (job_id) => {
            if (runId !== runIdRef.current) return;
            setState((prev) => ({
              ...prev,
              status: 'streaming',
              job_id,
            }));
          },
          onProgress: (payload) => {
            if (runId !== runIdRef.current) return;
            setState((prev) => ({
              ...prev,
              progress_stage: payload.stage,
            }));
            optsRef.current.onProgress?.(payload);
          },
          onChunk: (_text, accumulated) => {
            if (runId !== runIdRef.current) return;
            bumpStreamProgress(accumulated);
          },
          onPollContent: (accumulated) => {
            if (runId !== runIdRef.current) return;
            bumpStreamProgress(accumulated);
          },
          onCoreJudgments: (judgments, source) => {
            if (runId !== runIdRef.current) return;
            optsRef.current.onCoreJudgments?.(judgments, source);
          },
        },
      });

      if (runId !== runIdRef.current) return;

      contentRef.current = result.content;
      setState((prev) => ({
        ...prev,
        status: 'completed',
        content: result.content,
        job_id: result.job_id,
        bytes_received: result.content.length,
      }));
      optsRef.current.onComplete(result.content, result.meta ?? {});
    } catch (e: unknown) {
      if (runId !== runIdRef.current) return;
      if (e instanceof Error && e.name === 'AbortError') {
        const message = 'Analysis interrupted — tap retry to continue.';
        setState((prev) => ({ ...prev, status: 'failed', error: message }));
        optsRef.current.onError(message);
        return;
      }
      const message = e instanceof Error ? e.message : 'stream failed';
      setState((prev) => ({ ...prev, status: 'failed', error: message }));
      optsRef.current.onError(message);
    }
  }, [stop, bumpStreamProgress]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { state, start, stop };
}
