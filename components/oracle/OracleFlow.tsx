"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DrawSequence } from "@/components/oracle/DrawSequence";
import { FullReading } from "@/components/oracle/FullReading";
import { OracleInput } from "@/components/oracle/OracleInput";
import { OracleIntro } from "@/components/oracle/OracleIntro";
import { OracleSummon } from "@/components/oracle/OracleSummon";
import { appendRuntimeArchiveEntry } from "@/lib/archive/runtime-archive";
import { saveOracleEntry } from "@/lib/oracle/saveToArchive";
import { LEVEL_META, type SignData, type UserInput, type FullReading as FullReadingType } from "@/types/oracle";

type Phase = "intro" | "input" | "summon" | "draw" | "reading";
type ArchiveSaveState = "idle" | "saving" | "saved" | "failed";

interface OracleFlowProps {
  showIntro?: boolean;
}

export function OracleFlow({ showIntro = true }: OracleFlowProps) {
  const [phase, setPhase] = useState<Phase>(showIntro ? "intro" : "input");
  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [drawnSign, setDrawnSign] = useState<SignData | null>(null);
  const [archiveSaveState, setArchiveSaveState] = useState<ArchiveSaveState>("idle");

  const handleStart = useCallback(() => {
    setPhase("input");
  }, []);

  const handleInputSubmit = useCallback((input: UserInput) => {
    setUserInput(input);
    setPhase("summon");
  }, []);

  const handleSummonComplete = useCallback(() => {
    setPhase("draw");
  }, []);

  const handleFullReading = useCallback((sign: SignData) => {
    setDrawnSign(sign);
    setArchiveSaveState("idle");
    setPhase("reading");
  }, []);

  const handleDrawClose = useCallback(() => {
    setPhase(showIntro ? "intro" : "input");
    setDrawnSign(null);
  }, [showIntro]);

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
          id: crypto.randomUUID(),
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
          <DrawSequence
            userInput={userInput}
            onFullReading={handleFullReading}
            onClose={handleDrawClose}
          />
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
  );
}
