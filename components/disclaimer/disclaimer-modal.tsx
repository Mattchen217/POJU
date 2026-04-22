"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

type DisclaimerModalProps = {
  onAccepted: () => void;
};

const fullSections = [
  "1. Nature of Service",
  "2. Not Professional Advice",
  "3. Crisis Resources",
  "4. No Warranty",
  "5. Limitation of Liability",
  "6. Age Restriction",
  "7. Scientific Claims",
  "8. Cultural and Religious Neutrality",
  "9. AI-Generated Content",
  "10. Changes to this Disclaimer",
];

export function DisclaimerModal({ onAccepted }: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="poju-glass-card w-full max-w-xl p-6">
        <h2 className="text-xl font-semibold text-text-primary">Before you enter POJU</h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>POJU delivers reflective insights grounded in Eastern wisdom and modern science context.</li>
          <li>Not medical, legal, financial, or mental health advice.</li>
          <li>If you are in crisis, contact 988 or local emergency services.</li>
          <li>For users 18+ only.</li>
          <li>Your conversations are designed to stay on this device.</li>
        </ul>
        <button
          type="button"
          className="mt-4 text-sm text-text-accent hover:text-purple-vivid"
          onClick={() => setExpanded((prev) => !prev)}
        >
          [Read the full Disclaimer →]
        </button>
        {expanded && (
          <div className="mt-3 rounded-lg border border-glass-border bg-bg-layer-2/70 p-3 text-xs text-text-secondary">
            {fullSections.map((section) => (
              <p key={section}>{section}</p>
            ))}
            <Link href="/disclaimer" className="mt-2 inline-block text-text-accent">
              Open full page
            </Link>
          </div>
        )}
        <label className="mt-5 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I have read and agree to the Disclaimer, Privacy Policy, and Terms of Service.
          </span>
        </label>
        <button
          type="button"
          disabled={!checked}
          onClick={handleEnter}
          className="poju-button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enter POJU
        </button>
      </div>
    </div>
  );
}
