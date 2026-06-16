"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ThinkingEnergyPulse,
  type ThinkingEnergyPulseHandle,
} from "@/components/poju/ThinkingEnergyPulse";

const MOCK_CHUNKS = [
  "Analyzing elemental balance",
  " cross-referencing day master",
  " with current decade cycle",
  " mapping structural tension",
  " synthesizing alignment vectors",
  " validating context coherence",
  " preparing response framing",
];

export default function ThinkingPulseDemoPage() {
  const pulseRef = useRef<ThinkingEnergyPulseHandle>(null);
  const [streaming, setStreaming] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [pulseHold, setPulseHold] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIdxRef = useRef(0);

  const stopMock = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStreaming(false);
  }, []);

  const startMock = useCallback(() => {
    stopMock();
    chunkIdxRef.current = 0;
    setReasoning("");
    setPulseHold(true);
    setStreaming(true);

    timerRef.current = setInterval(() => {
      const i = chunkIdxRef.current;
      if (i >= MOCK_CHUNKS.length) {
        stopMock();
        return;
      }
      const chunk = MOCK_CHUNKS[i]!;
      chunkIdxRef.current = i + 1;
      setReasoning((prev) => prev + chunk);
      pulseRef.current?.onChunkReceived(chunk);
    }, 280);
  }, [stopMock]);

  useEffect(() => () => stopMock(), [stopMock]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1a1030, #050508)",
        padding: "48px 24px",
        color: "#e8e4f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Thinking Energy Pulse — Demo</h1>
      <p style={{ opacity: 0.65, fontSize: 14, maxWidth: 560, marginBottom: 28 }}>
        Mock stream drives amplitude &amp; frequency on each chunk. Reasoning text is never shown —
        only the waveform reacts.
      </p>

      <div style={{ maxWidth: 720, marginBottom: 20 }}>
        {(streaming || pulseHold) ? (
          <ThinkingEnergyPulse
            ref={pulseRef}
            streaming={streaming}
            reasoningText={reasoning}
            onFadeComplete={() => setPulseHold(false)}
          />
        ) : (
          <div
            style={{
              height: 72,
              borderRadius: 10,
              border: "1px dashed rgba(229,193,88,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
            }}
          >
            Pulse idle — press Start Mock Stream
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={startMock}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#e5c158",
            color: "#0b0914",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start Mock Stream
        </button>
        <button
          type="button"
          onClick={() => {
            stopMock();
            pulseRef.current?.startFadeOut();
          }}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          End &amp; Fade Out
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.4 }}>
        Hidden buffer ({reasoning.length} chars): not rendered in UI
      </p>
    </main>
  );
}
