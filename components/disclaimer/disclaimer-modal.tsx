"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

type DisclaimerModalProps = {
  onAccepted: () => void;
};

type DisclaimerBullet = {
  label: string;
  body: ReactNode;
};

const DISCLAIMER_BULLETS: DisclaimerBullet[] = [
  {
    label: "Reflective decision support",
    body: "Eastern OS is a unified multi-turn decision dialogue for adult reflection and clearer decision framing. It may draw on Eastern wisdom traditions as analytical lenses鈥攏ot as fortune-telling or destiny prediction.",
  },
  {
    label: "Not professional advice",
    body: (
      <>
        This is not medical, clinical, mental-health, legal, or financial advice. We do not provide divination,
        supernatural claims, or deterministic future forecasting.
      </>
    ),
  },
  {
    label: "Crisis",
    body: (
      <>
        Eastern OS is not emergency care and cannot help in a crisis. If you are in distress, contact{" "}
        <strong>988</strong> (US/CA), local emergency services, or other regional helplines. See the full Disclaimer for
        more resources.
      </>
    ),
  },
  {
    label: "Browser-local chat",
    body: (
      <>
        Chat and in-browser deliverables stay in this browser profile (local storage / IndexedDB). Switching devices,
        clearing site data, or using Incognito can permanently erase history. We do not restore a cloud chat archive.
        Your receipt email is billing confirmation鈥攏ot a chat backup. Export or email content if you want to keep it.
      </>
    ),
  },
  {
    label: "Age 18+",
    body: "Eastern OS is for users aged 18 or older only.",
  },
];

export function DisclaimerModal({ onAccepted }: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false);

  const storageKey = useMemo(
    () => `easternos_disclaimer_${siteConfig.disclaimerVersion}`,
    [],
  );

  const handleEnter = () => {
    if (!checked) return;
    localStorage.setItem(storageKey, "accepted");
    onAccepted();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/70">
      <div className="flex min-h-full items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div
          aria-labelledby="disclaimer-modal-title"
          aria-modal="true"
          className="poju-glass-card my-auto flex w-full max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden p-5 sm:p-8"
          role="dialog"
        >
          <h2
            id="disclaimer-modal-title"
            className="shrink-0 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl"
          >
            Before you enter Eastern OS
          </h2>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
            <div className="rounded-xl border border-glass-border bg-bg-layer-2/50 p-4 sm:p-5">
              <ul className="space-y-4">
                {DISCLAIMER_BULLETS.map((item) => (
                  <li key={item.label} className="text-sm leading-relaxed text-text-secondary">
                    <strong className="font-semibold text-text-primary">{item.label}</strong>
                    <span aria-hidden="true">: </span>
                    <span>{item.body}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              className="mt-4 inline-flex text-sm font-medium text-text-accent transition-colors hover:text-purple-vivid"
              href="/disclaimer"
            >
              Read the full Disclaimer &amp; Sovereignty Architecture 鈫?            </Link>
          </div>

          <div className="mt-4 shrink-0 border-t border-glass-border/60 pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-text-secondary">
              <input
                checked={checked}
                className="disclaimer-modal__assent-check mt-0.5 size-5 shrink-0 cursor-pointer rounded-[3px] accent-gold-rare [color-scheme:dark] shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--pj-gold-soft,#f2c994)_70%,white)] checked:shadow-[0_0_0_1.5px_var(--pj-gold,#d4a574)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-gold-rare"
                onChange={(event) => setChecked(event.target.checked)}
                type="checkbox"
              />
              <span>
                I confirm I am 18 or older, acknowledge these points and the{" "}
                <Link className="text-text-accent underline-offset-2 hover:underline" href="/disclaimer">
                  Disclaimer
                </Link>
                , and agree to the{" "}
                <Link className="text-text-accent underline-offset-2 hover:underline" href="/terms">
                  Terms of Service
                </Link>
                ,{" "}
                <Link className="text-text-accent underline-offset-2 hover:underline" href="/privacy">
                  Privacy Policy
                </Link>
                ,{" "}
                <Link className="text-text-accent underline-offset-2 hover:underline" href="/refund">
                  Refund Policy
                </Link>
                , and{" "}
                <Link className="text-text-accent underline-offset-2 hover:underline" href="/cookies">
                  Cookie &amp; Local Storage Policy
                </Link>
                .
              </span>
            </label>

            <button
              className="poju-button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!checked}
              onClick={handleEnter}
              type="button"
            >
              Enter Eastern OS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
