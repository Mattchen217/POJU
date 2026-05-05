"use client";

import { useMemo, useState } from "react";

const SYNCRO_URL = "https://pojulife.com/syncro";

export type SyncroSmsLinkFormCopy = {
  hint: string;
  placeholder: string;
  phoneAriaLabel: string;
  buttonLabel: string;
  /** 须包含字面量 `{url}`，由客户端替换为 Syncro 链接 */
  smsBodyTemplate: string;
};

export function SyncroSmsLinkForm({
  hint,
  placeholder,
  phoneAriaLabel,
  buttonLabel,
  smsBodyTemplate,
}: SyncroSmsLinkFormCopy) {
  const [phone, setPhone] = useState("");

  const smsHref = useMemo(() => {
    const normalized = phone.replace(/[^\d+]/g, "");
    const bodyText = smsBodyTemplate.replace("{url}", SYNCRO_URL);
    const body = encodeURIComponent(bodyText);
    return normalized ? `sms:${normalized}?body=${body}` : "#";
  }, [phone, smsBodyTemplate]);

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-text-dim">{hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-text-primary placeholder:text-text-dim focus:border-cyan-300/60 focus:outline-none"
          aria-label={phoneAriaLabel}
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
          {buttonLabel}
        </a>
      </div>
    </div>
  );
}
