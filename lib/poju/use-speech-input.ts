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

export type UseSpeechInputOptions = {
  /** BCP-47 tag, e.g. zh-CN / en-US / es-ES / fr-FR */
  lang?: string;
  onUnsupported?: () => void;
  onPermissionDenied?: () => void;
  /**
   * Fired when the user (or app) stops listening — not on Chrome silence auto-restart.
   * Use to focus the composer caret at the end of the text.
   */
  onStopped?: () => void;
};

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/** Map app locale → SpeechRecognition.lang */
export function speechRecognitionLang(locale: string): string {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("zh")) return "zh-CN";
  if (l.startsWith("es")) return "es-ES";
  if (l.startsWith("fr")) return "fr-FR";
  return "en-US";
}

/** Phones / coarse pointers: hold-to-talk; desktop fine pointer: click toggle. */
export function prefersHoldToTalkVoice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const mobileUa = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return coarse || narrow || mobileUa;
  } catch {
    return false;
  }
}

/** Append glue: space after Latin/punctuation; none after CJK. */
function appendGlue(text: string): string {
  if (!text) return "";
  if (/\s$/.test(text)) return text;
  if (/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]$/.test(text)) return text;
  return `${text} `;
}

/**
 * Web Speech API → live fill of a controlled text field.
 *
 * Design details:
 * 1. Append (never overwrite) existing composer text
 * 2. Interim results stream into the box while speaking
 * 3. onStopped → caller focuses caret at end for keyboard edit
 *
 * Never auto-sends; user confirms with Send.
 */
export function useSpeechInput(
  value: string,
  onChange: (value: string) => void,
  options?: UseSpeechInputOptions,
) {
  const [active, setActive] = useState(false);
  // Assume supported until mounted — avoids SSR/hydration hiding the mic forever.
  const [supported, setSupported] = useState(true);

  const activeRef = useRef(false);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  /** Snapshot of composer text when this listen session started (append base). */
  const baseRef = useRef("");
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const langRef = useRef(options?.lang ?? "en-US");
  const onUnsupportedRef = useRef(options?.onUnsupported);
  const onPermissionDeniedRef = useRef(options?.onPermissionDenied);
  const onStoppedRef = useRef(options?.onStopped);

  valueRef.current = value;
  onChangeRef.current = onChange;
  langRef.current = options?.lang ?? navigator.language ?? "en-US";
  onUnsupportedRef.current = options?.onUnsupported;
  onPermissionDeniedRef.current = options?.onPermissionDenied;
  onStoppedRef.current = options?.onStopped;

  const stop = useCallback(() => {
    const wasActive = activeRef.current;
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
    if (wasActive) {
      // Let React commit the final value, then notify for caret focus.
      queueMicrotask(() => onStoppedRef.current?.());
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onUnsupportedRef.current?.();
      return;
    }

    stop();

    // Detail 2 — Append: keep existing text; new speech concatenates after it.
    baseRef.current = valueRef.current ? appendGlue(valueRef.current) : "";

    activeRef.current = true;

    const rec = new Ctor();
    rec.lang = langRef.current;
    // Detail 3 — Interim: partial hypotheses paint live; finals replace them.
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (evt) => {
      // Rebuild from full result list — avoids double-append on Chrome restarts.
      let finals = "";
      let interim = "";
      for (let i = 0; i < evt.results.length; i++) {
        const result = evt.results[i];
        if (!result) continue;
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finals += piece;
        else interim += piece;
      }
      onChangeRef.current(baseRef.current + finals + interim);
    };

    rec.onerror = (evt) => {
      if (evt.error === "not-allowed" || evt.error === "service-not-allowed") {
        const wasActive = activeRef.current;
        activeRef.current = false;
        recRef.current = null;
        setActive(false);
        onPermissionDeniedRef.current?.();
        if (wasActive) queueMicrotask(() => onStoppedRef.current?.());
        return;
      }
      // no-speech / aborted: quiet; onend will settle state
      if (evt.error === "aborted" || evt.error === "no-speech") return;
    };

    rec.onend = () => {
      if (!activeRef.current || recRef.current !== rec) {
        setActive(false);
        return;
      }
      // Chrome often ends after a pause — commit finals into append base, keep listening.
      baseRef.current = appendGlue(valueRef.current);
      try {
        rec.lang = langRef.current;
        rec.start();
      } catch {
        activeRef.current = false;
        recRef.current = null;
        setActive(false);
        queueMicrotask(() => onStoppedRef.current?.());
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
  }, [stop]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { active, supported, start, stop, toggle };
}
