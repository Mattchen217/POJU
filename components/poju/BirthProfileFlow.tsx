"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import pojuLogo from "@/assets/images/POJUlogo.png";
import { BirthInfoForm } from "@/components/forms/BirthInfoForm";
import type { UserProfile } from "@/lib/profile/types";

export type BirthProfileFlowStage =
  | "intro"
  | "form"
  | "received"
  | "analyzing"
  | "complete";

export type BirthProfileFlowProps = {
  stage: BirthProfileFlowStage;
  onContinueToForm: () => void;
  onComplete: (profile: UserProfile) => void;
  onSkip?: () => void;
  analysisFailed?: boolean;
};

export function BirthProfileFlow({
  stage,
  onContinueToForm,
  onComplete,
  onSkip,
  analysisFailed = false,
}: BirthProfileFlowProps) {
  const t = useTranslations("poju.chat");

  if (stage === "form") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-2xl border border-violet-300/25 bg-violet-950/35 p-3">
        <BirthInfoForm
          context="chat"
          allowSkip
          persistDefaultProfile={false}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      </div>
    );
  }

  if (stage === "received" || stage === "analyzing" || stage === "complete") {
    const steps = [
      { key: "birth_flow_step_received", done: stage !== "received", active: stage === "received" },
      {
        key: "birth_flow_step_analyzing",
        done: stage === "complete",
        active: stage === "analyzing",
      },
      {
        key: "birth_flow_step_done",
        done: stage === "complete" && !analysisFailed,
        active: stage === "complete",
      },
    ];

    return (
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-950/25 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
          <span className="material-symbols-outlined text-[20px] animate-pulse">hourglass_top</span>
          {stage === "received"
            ? t("birth_flow_step_received")
            : stage === "complete"
              ? analysisFailed
                ? t("birth_flow_analysis_partial")
                : t("birth_flow_analysis_done_short")
              : t("birth_flow_analyzing_title")}
        </div>
        <ul className="mt-3 space-y-2 text-xs text-on-surface-variant">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-2">
              <span
                className={`material-symbols-outlined text-[16px] ${
                  step.done ? "text-emerald-400" : step.active ? "animate-pulse text-cyan-300" : "text-white/30"
                }`}
              >
                {step.done ? "check_circle" : step.active ? "progress_activity" : "radio_button_unchecked"}
              </span>
              <span className={step.done || step.active ? "text-on-surface" : ""}>{t(step.key)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-950/40 to-[#1a1824] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-violet-400/30">
          <Image src={pojuLogo} alt="" width={40} height={40} className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] leading-7 text-on-surface-variant">{t("birth_flow_intro_cta_hint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              onClick={onContinueToForm}
            >
              {t("birth_flow_continue")}
            </button>
            {onSkip ? (
              <button
                type="button"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-on-surface-variant hover:bg-white/5"
                onClick={onSkip}
              >
                {t("birth_flow_skip")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
