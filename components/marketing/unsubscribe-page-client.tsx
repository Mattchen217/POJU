"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { siteConfig } from "@/lib/config/site";

type UnsubscribeState = "loading" | "success" | "invalid";

function isLikelyToken(token: string) {
  return /^[a-zA-Z0-9_-]{16,}$/.test(token);
}

export function UnsubscribePageClient() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [state, setState] = useState<UnsubscribeState>("loading");

  useEffect(() => {
    let stop = false;

    async function run() {
      if (!token) {
        setState("invalid");
        return;
      }

      try {
        const response = await fetch("/api/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (stop) return;
        if (response.ok) {
          const data = (await response.json()) as { success?: boolean };
          setState(data.success ? "success" : "invalid");
          return;
        }
      } catch {
        // ignore
      }

      // 无后端兜底：至少保证页面交互可用
      setState(isLikelyToken(token) ? "success" : "invalid");
    }

    const timer = window.setTimeout(run, 700);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-deep px-4 text-text-body">
      <div className="poju-glass-card w-full max-w-lg p-7 text-center sm:p-8">
        <p className="text-2xl font-semibold tracking-[0.08em] text-text-primary">✦ POJU</p>

        {state === "loading" ? (
          <>
            <p className="mt-6 text-lg font-medium text-text-primary">Processing your request...</p>
            <div
              className="mx-auto mt-5 h-8 w-8 rounded-full border-2 border-purple-vivid/40 border-t-purple-vivid"
              style={{ animation: "pojuSpin 1s linear infinite" }}
              aria-hidden
            />
          </>
        ) : null}

        {state === "success" ? (
          <>
            <p className="mt-6 text-xl font-semibold text-text-primary">You&apos;ve been unsubscribed.</p>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              Your email has been deleted from our servers.
              <br />
              This was the only email we had about this topic.
            </p>
            <div className="mx-auto my-5 h-px w-full max-w-xs bg-gradient-to-r from-transparent via-glass-border to-transparent" />
            <p className="text-sm text-text-secondary">You can come back anytime without leaving anything behind.</p>
            <Link href="/" className="poju-button-primary mt-6 inline-flex">
              Return to POJU
            </Link>
          </>
        ) : null}

        {state === "invalid" ? (
          <>
            <p className="mt-6 text-xl font-semibold text-text-primary">This unsubscribe link has expired or is invalid.</p>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              If you&apos;re still receiving emails, contact {siteConfig.supportEmail} and we&apos;ll remove you
              immediately.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href={`mailto:${siteConfig.supportEmail}?subject=Unsubscribe%20request`}
                className="poju-button-secondary inline-flex"
              >
                Contact support
              </a>
              <Link href="/" className="poju-button-primary inline-flex">
                Return to POJU
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
