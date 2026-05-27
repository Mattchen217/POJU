"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { DrawSequence } from "@/components/oracle/DrawSequence";
import { FullReading } from "@/components/oracle/FullReading";
import { OracleInput } from "@/components/oracle/OracleInput";
import { OracleIntro } from "@/components/oracle/OracleIntro";
import { OracleSummon } from "@/components/oracle/OracleSummon";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { appendRuntimeArchiveEntry } from "@/lib/archive/runtime-archive";
import { saveOracleEntry } from "@/lib/oracle/saveToArchive";
import { LEVEL_META, type SignData, type UserInput, type FullReading as FullReadingType } from "@/types/oracle";

type Phase = "intro" | "input" | "summon" | "draw" | "reading";
type ArchiveSaveState = "idle" | "saving" | "saved" | "failed";

interface OracleFlowProps {
  showIntro?: boolean;
}

async function requestFreeQuota(): Promise<{ allowed: boolean; requiresPayment: boolean }> {
  const check = await fetch("/api/glyph/quota", { method: "GET" });
  if (!check.ok) return { allowed: true, requiresPayment: false };
  const snapshot = (await check.json()) as { canUseFree: boolean };
  if (snapshot.canUseFree) {
    await fetch("/api/glyph/quota", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "consume_free" }),
    });
    return { allowed: true, requiresPayment: false };
  }
  return { allowed: false, requiresPayment: true };
}

async function requestPaidCheckout(): Promise<boolean> {
  const res = await fetch("/api/payments/create", { method: "POST" });
  if (!res.ok) return false;
  await fetch("/api/glyph/quota", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "consume_paid" }),
  });
  return true;
}

export function OracleFlow({ showIntro = true }: OracleFlowProps) {
  const [phase, setPhase] = useState<Phase>(showIntro ? "intro" : "input");
  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [drawnSign, setDrawnSign] = useState<SignData | null>(null);
  const [archiveSaveState, setArchiveSaveState] = useState<ArchiveSaveState>("idle");
  const [pendingPaidInput, setPendingPaidInput] = useState<UserInput | null>(null);

  const handleStart = useCallback(() => {
    setPhase("input");
  }, []);

  const handleInputSubmit = useCallback((input: UserInput) => {
    void (async () => {
      const quota = await requestFreeQuota();
      if (!quota.allowed && quota.requiresPayment) {
        setPendingPaidInput(input);
        return;
      }
      setUserInput(input);
      setPhase("summon");
    })();
  }, []);

  const handleConfirmPaid = useCallback(() => {
    void (async () => {
      if (!pendingPaidInput) return;
      const ok = await requestPaidCheckout();
      if (!ok) return;
      setUserInput(pendingPaidInput);
      setPendingPaidInput(null);
      setPhase("summon");
    })();
  }, [pendingPaidInput]);

  const handleSummonComplete = useCallback(() => {
    setPhase("draw");
  }, []);

  const handleFullReading = useCallback((sign: SignData) => {
    setDrawnSign(sign);
    setArchiveSaveState("idle");
    setPhase("reading");
  }, []);

  const handleReadingReady = useCallback(
    async (reading: FullReadingType) => {
      if (!drawnSign || !userInput) return;
      setArchiveSaveState("saving");
      try {
        const refId = await saveOracleEntry({
          sign: drawnSign,
          userInput,
          fullReading: reading,
        });
        appendRuntimeArchiveEntry({
          id: safeRandomUUID(),
          kind: "oracle",
          title: `${LEVEL_META[drawnSign.level].display_name} · Full reading`,
          subtitle: userInput.question,
          createdAt: Date.now(),
          refId,
          oracleVariant: "full_reading",
        });
        setArchiveSaveState("saved");
      } catch (error) {
        console.error("Failed to save to archive:", error);
        setArchiveSaveState("failed");
      }
    },
    [drawnSign, userInput],
  );

  return (
    <>
      <Link
        href="/glyph"
        className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[200] inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-white/25 bg-black/55 px-3 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-white/10"
        aria-label="关闭并返回 Glyph 介绍页"
      >
        <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
          close
        </span>
      </Link>
      <AnimatePresence mode="wait">
        {showIntro && phase === "intro" ? (
          <motion.div key="intro" exit={{ opacity: 0 }}>
            <OracleIntro onStart={handleStart} />
          </motion.div>
        ) : null}

        {phase === "input" ? (
          <motion.div key="input" exit={{ opacity: 0 }}>
            <OracleInput
              initialInput={userInput ?? undefined}
              onSubmit={handleInputSubmit}
            />
          </motion.div>
        ) : null}

        {phase === "summon" && userInput ? (
          <motion.div key="summon" exit={{ opacity: 0 }}>
            <OracleSummon userInput={userInput} onComplete={handleSummonComplete} />
          </motion.div>
        ) : null}

        {phase === "draw" && userInput ? (
          <motion.div key="draw" exit={{ opacity: 0 }}>
            <DrawSequence userInput={userInput} onFullReading={handleFullReading} />
          </motion.div>
        ) : null}

        {phase === "reading" && drawnSign && userInput ? (
          <motion.div key="reading" exit={{ opacity: 0 }}>
            <FullReading
              sign={drawnSign}
              userInput={userInput}
              onReadingReady={handleReadingReady}
              archiveSaveState={archiveSaveState}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {pendingPaidInput ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#131221] p-6 text-center">
            <h3 className="text-xl font-semibold text-text-primary">Daily free reading used</h3>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              You can still get another Glyph reading today for $1.99.
            </p>
            <button
              type="button"
              onClick={handleConfirmPaid}
              className="mt-5 w-full rounded-full bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white hover:bg-fuchsia-600"
            >
              Get another reading — $1.99
            </button>
            <button
              type="button"
              onClick={() => setPendingPaidInput(null)}
              className="mt-3 w-full rounded-full border border-white/20 px-5 py-3 text-sm text-white/80 hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
