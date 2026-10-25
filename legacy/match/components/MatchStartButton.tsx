"use client";

import { useState, type ReactNode } from "react";
import { IconHeartHandshake } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
  checkMatchProfilesReady,
  matchPreparePath,
} from "@/lib/match/match-start-flow";

export type MatchStartStatus = "idle" | "checking" | "preparing_b" | "ready";

export function useMatchStartFlow() {
  const router = useRouter();
  const t = useTranslations("match.relationship");
  const [status, setStatus] = useState<MatchStartStatus>("idle");

  async function startMatch(aProfileId: string, bProfileId: string): Promise<void> {
    if (status !== "idle") return;

    setStatus("checking");

    try {
      const result = await checkMatchProfilesReady(aProfileId, bProfileId);

      if (result.status === "needs_prepare") {
        const preparingB = result.redirect.profile_id === bProfileId;
        setStatus(preparingB ? "preparing_b" : "checking");
        router.push(matchPreparePath(result.redirect));
        return;
      }

      setStatus("ready");
      router.push("/match/analyzing");
    } catch (e) {
      console.error("[match/start]", e);
      setStatus("idle");
      throw e;
    }
  }

  const buttonLabel =
    status === "checking"
      ? t("checking")
      : status === "preparing_b"
        ? t("preparing_b")
        : status === "ready"
          ? t("starting")
          : t("begin_match");

  const isBusy = status !== "idle";

  return { startMatch, status, buttonLabel, isBusy, resetStatus: () => setStatus("idle") };
}

export type MatchStartGlassButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
};

export function MatchStartGlassButton({ onClick, disabled, children }: MatchStartGlassButtonProps) {
  return (
    <button
      type="button"
      className="match-start-btn-glass"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="btn-icon" aria-hidden>
        <IconHeartHandshake size={22} stroke={1.75} />
      </span>
      <span className="btn-text">{children}</span>
    </button>
  );
}
