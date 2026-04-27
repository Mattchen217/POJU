"use client";

import { useMemo, useState } from "react";

const SYNCRO_URL = "https://pojulife.com/syncro";

export function SyncroSmsLinkForm() {
  const [phone, setPhone] = useState("");

  const smsHref = useMemo(() => {
    const normalized = phone.replace(/[^\d+]/g, "");
    const body = encodeURIComponent(`Open Syncro on your phone: ${SYNCRO_URL}`);
    return normalized ? `sms:${normalized}?body=${body}` : "#";
  }, [phone]);

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-text-dim">Text yourself the link</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="phone number"
          className="h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-text-primary placeholder:text-text-dim focus:border-cyan-300/60 focus:outline-none"
          aria-label="Phone number"
        />
        <a
          href={smsHref}
          className={`inline-flex h-11 min-w-[170px] items-center justify-center rounded-lg border px-4 text-sm font-semibold transition ${
            phone.trim()
              ? "border-cyan-300/40 bg-cyan-400/18 text-cyan-100 hover:bg-cyan-300/24"
              : "cursor-not-allowed border-white/10 bg-white/5 text-text-dim"
          }`}
          aria-disabled={!phone.trim()}
          onClick={(e) => {
            if (!phone.trim()) e.preventDefault();
          }}
        >
          Text me the link
        </a>
      </div>
    </div>
  );
}
