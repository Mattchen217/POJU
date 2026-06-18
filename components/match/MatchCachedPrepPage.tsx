"use client";

import { CachedProfileBaziWait } from "@/components/wait-ritual/CachedProfileBaziWait";
import { useRouter } from "@/i18n/navigation";

/** Both profiles cached — 10s bazi ritual before relationship question input. */
export function MatchCachedPrepPage() {
  const router = useRouter();

  return (
    <CachedProfileBaziWait product="match" onComplete={() => router.push("/match/relationship")} />
  );
}
