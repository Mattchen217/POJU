"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
    label: "Cognitive & Analytical Tools",
    body: "Our specialized modular engines provide conceptual frameworks for self-reflection and cognitive reframing, combining classical Eastern philosophical structures with modern analytical psychology.",
  },
  {
    label: "Strict Professional Exclusions",
    body: (
      <>
        This platform does <strong>NOT</strong> provide medical, clinical, mental health, legal, or financial advice.
        No supernatural claims, divination, or deterministic future forecasting are guaranteed.
      </>
    ),
  },
  {
    label: "Crisis Protocol",
    body: (
      <>
        This interface is completely unequipped to handle psychological or medical emergencies. If you are experiencing
        distress, immediately contact <strong>988</strong> (US/CA), <strong>116 123</strong> (UK/EU), or your local
        emergency response nodes.
      </>
    ),
  },
  {
    label: "Decentralized Privacy Architecture",
    body: (
      <>
        Zero central storage. All your inputs and conversation history are encrypted locally (<strong>AES-256</strong>)
        within your browser storage and are never collected on our servers.
      </>
    ),
  },
  {
    label: "Age Requirement",
    body: (
      <>
        Exclusively intended for adult exploration and users aged <strong>18 or older</strong>.
      </>
    ),
  },
];

export function DisclaimerModal({ onAccepted }: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false);

  const storageKey = useMemo(
    () => `pojulife_disclaimer_${siteConfig.disclaimerVersion}`,
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
            Before you enter pojulife
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
              [Read the full Disclaimer &amp; Sovereignty Architecture →]
            </Link>
          </div>

          <div className="mt-4 shrink-0 border-t border-glass-border/60 pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-text-secondary">
              <input
                checked={checked}
                className="mt-1 size-4 shrink-0 accent-purple-vivid"
                onChange={(event) => setChecked(event.target.checked)}
                type="checkbox"
              />
              <span>
                I explicitly acknowledge these disclaimers and agree to the Terms of Service, Privacy Policy, and Refund
                Policy.
              </span>
            </label>

            <button
              className="poju-button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!checked}
              onClick={handleEnter}
              type="button"
            >
              Enter pojulife
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
