"use client";

import { useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PojuSessionDeepLinkPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("missing_session");
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/poju/session?sessionId=${encodeURIComponent(sessionId)}`);
      const data = (await res.json()) as { ok?: boolean };
      if (cancelled) return;
      if (!res.ok || !data.ok) {
        setError("session_not_found");
        return;
      }
      router.replace(`/chat?sid=${encodeURIComponent(sessionId)}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  if (error) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center bg-bg-deep px-4 text-text-body">
        <p className="text-text-primary">Session not available.</p>
        <button type="button" className="mt-4 text-sm text-violet-300 underline" onClick={() => router.push("/poju")}>
          Back to POJU
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center bg-bg-deep text-text-secondary">
      <p className="text-sm">Opening your POJU session…</p>
    </main>
  );
}
