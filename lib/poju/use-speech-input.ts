"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechErrorEvent = {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type UseSpeechInputOptions = {
  lang?: string;
  onUnsupported?: () => void;
  onPermissionDenied?: () => void;
};

export function useSpeechInput(
  value: string,
  onChange: (value: string) => void,
  options?: UseSpeechInputOptions,
) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      try {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    }
    setActive(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      options?.onUnsupported?.();
      return;
    }

    stop();

    baseRef.current = valueRef.current;
    if (baseRef.current && !baseRef.current.endsWith(" ") && !baseRef.current.endsWith("\n")) {
      baseRef.current += " ";
    }
    finalRef.current = "";
    activeRef.current = true;

    const rec = new Ctor() as BrowserSpeechRecognition;
    rec.lang = options?.lang ?? navigator.language ?? "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (evt) => {
      let interim = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const result = evt.results[i];
        if (!result) continue;
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current += piece;
        } else {
          interim += piece;
        }
      }
      onChange(baseRef.current + finalRef.current + interim);
    };

    rec.onerror = (evt) => {
      if (evt.error === "not-allowed" || evt.error === "service-not-allowed") {
        activeRef.current = false;
        setActive(false);
        options?.onPermissionDenied?.();
        return;
      }
      if (evt.error === "aborted") return;
    };

    rec.onend = () => {
      if (!activeRef.current || recRef.current !== rec) {
        setActive(false);
        return;
      }
      try {
        rec.start();
      } catch {
        activeRef.current = false;
        recRef.current = null;
        setActive(false);
      }
    };

    recRef.current = rec;
    setActive(true);
    try {
      rec.start();
    } catch {
      activeRef.current = false;
      recRef.current = null;
      setActive(false);
    }
  }, [onChange, options, stop]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { active, start, stop, toggle };
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}
