"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DrawSequence } from "@/components/oracle/DrawSequence";
import { FullReading } from "@/components/oracle/FullReading";
import { OracleInput } from "@/components/oracle/OracleInput";
import { OracleIntro } from "@/components/oracle/OracleIntro";
import { OracleSummon } from "@/components/oracle/OracleSummon";
import { saveCardBack } from "@/lib/oracle/saveCard";
import { saveOracleEntry } from "@/lib/oracle/saveToArchive";
import { shareCardBack } from "@/lib/oracle/shareCard";
import type { SignData, UserInput, FullReading as FullReadingType } from "@/types/oracle";

type Phase = "intro" | "input" | "summon" | "draw" | "reading";

export function OracleFlow() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [drawnSign, setDrawnSign] = useState<SignData | null>(null);

  const handleStart = useCallback(() => {
    setPhase("input");
  }, []);

  const handleInputSubmit = useCallback((input: UserInput) => {
    setUserInput(input);
    setPhase("summon");
  }, []);

  const handleInputClose = useCallback(() => {
    setPhase("intro");
  }, []);

  const handleSummonComplete = useCallback(() => {
    setPhase("draw");
  }, []);

  const handleSaveCard = useCallback(async (sign: SignData) => {
    const result = await saveCardBack(sign.level, sign.sign_number);
    if (result.success) {
      console.log("Card saved", result.method);
    }
  }, []);

  const handleShareCard = useCallback(async (sign: SignData) => {
    await shareCardBack(sign.level, sign.sign_number);
  }, []);

  const handleFullReading = useCallback((sign: SignData) => {
    setDrawnSign(sign);
    setPhase("reading");
  }, []);

  const handleDrawClose = useCallback(() => {
    setPhase("intro");
    setDrawnSign(null);
  }, []);

  const handleReadingReady = useCallback(
    async (reading: FullReadingType) => {
      if (!drawnSign || !userInput) return;
      try {
        await saveOracleEntry({
          sign: drawnSign,
          userInput,
          fullReading: reading,
        });
      } catch (error) {
        console.error("Failed to save to archive:", error);
      }
    },
    [drawnSign, userInput],
  );

  const handleAskAgain = useCallback(() => {
    if (userInput) {
      setUserInput({
        ...userInput,
        question: "",
      });
    }
    setDrawnSign(null);
    setPhase("input");
  }, [userInput]);

  const handleClose = useCallback(() => {
    setPhase("intro");
    setUserInput(null);
    setDrawnSign(null);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {phase === "intro" ? (
        <motion.div key="intro" exit={{ opacity: 0 }}>
          <OracleIntro onStart={handleStart} />
        </motion.div>
      ) : null}

      {phase === "input" ? (
        <motion.div key="input" exit={{ opacity: 0 }}>
          <OracleInput
            initialInput={userInput ?? undefined}
            onSubmit={handleInputSubmit}
            onClose={handleInputClose}
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
            onSaveCard={handleSaveCard}
            onShareCard={handleShareCard}
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
            onAskAgain={handleAskAgain}
            onClose={handleClose}
            onReadingReady={handleReadingReady}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
