"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { wipeAllLocalData } from "@/lib/archive/wipe-local-data";

export function WipeEverythingButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleWipe = async () => {
    if (busy) return;
    const ok = window.confirm("Wipe all local data on this device? This cannot be undone.");
    if (!ok) return;
    setBusy(true);
    await wipeAllLocalData();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleWipe()}
      className="mx-auto flex items-center justify-center gap-2 py-2 font-['Inter'] text-[12px] font-medium uppercase tracking-[0.05em] text-[#cbc3d7]/50 transition-colors hover:text-red-300 disabled:opacity-50 md:mx-0 md:justify-start"
    >
      <span className="material-symbols-outlined text-sm">delete_forever</span>
      {busy ? "Wiping..." : "Wipe everything"}
    </button>
  );
}

