'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import type { BaseAnalysisJob } from '@/lib/base-analysis/job-types';
import { consumeBaseAnalysisStream } from '@/lib/base-analysis/stream-sse-client';

export interface UseStreamingAnalysisOptions {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob['local_data'];
  resume_job_id?: string;

  onComplete: (content: string, meta: BaseAnalysisJob['meta'] | Record<string, unknown>) => void;
  onError: (error: string) => void;
}

export interface StreamingState {
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  content: string;
  job_id: string | null;
  error: string | null;
  bytes_received: number;
}

export function stripMetaSection(content: string): string {
  const idx = content.lastIndexOf('---META---');
  return idx === -1 ? content : content.slice(0, idx).trim();
}

export function useStreamingAnalysis(opts: UseStreamingAnalysisOptions) {
  const [state, setState] = useState<StreamingState>({
    status: 'idle',
    content: '',
    job_id: null,
    error: null,
    bytes_received: 0,
  });

  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    stop();

    setState({
      status: 'connecting',
      content: '',
      job_id: null,
      error: null,
      bytes_received: 0,
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
            setState((prev) => ({
              ...prev,
              status: 'streaming',
              job_id,
            }));
          },
          onChunk: (_text, accumulated) => {
            setState((prev) => ({
              ...prev,
              status: 'streaming',
              content: accumulated,
              bytes_received: accumulated.length,
            }));
          },
          onPollContent: (accumulated) => {
            setState((prev) => ({
              ...prev,
              status: 'streaming',
              content: accumulated,
              bytes_received: accumulated.length,
            }));
          },
        },
      });

      setState((prev) => ({
        ...prev,
        status: 'completed',
        content: result.content,
        job_id: result.job_id,
        bytes_received: result.content.length,
      }));
      optsRef.current.onComplete(result.content, result.meta ?? {});
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[useStreamingAnalysis] aborted by user');
        return;
      }
      const message = e instanceof Error ? e.message : 'stream failed';
      setState((prev) => ({ ...prev, status: 'failed', error: message }));
      optsRef.current.onError(message);
    }
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { state, start, stop };
}
