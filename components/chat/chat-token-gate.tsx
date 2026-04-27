"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { siteConfig } from "@/lib/config/site";

const STORE_KEY = "poju_chat_store_v1";

type GateState = "loading" | "ready" | "error";

function seedLocalChatStore(sessionId: string) {
  try {
    if (localStorage.getItem(STORE_KEY)) return;
    const now = Date.now();
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        sessions: [
          {
            id: sessionId,
            title: "New POJU Session",
            createdAt: now,
            hidden: false,
            status: "active",
            pdfSaves: 0,
          },
        ],
        messages: [],
        activeSessionId: sessionId,
      }),
    );
  } catch {
    // ignore
  }
}

export function ChatTokenGate() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GateState>("loading");
  const [errorText, setErrorText] = useState<string>("");

  const token = useMemo(() => params.get("token"), [params]);

  const exchangeToken = useCallback(async (rawToken: string) => {
    let lastError: unknown = null;
    for (let i = 0; i < 3; i += 1) {
      try {
        const response = await fetch("/api/payment/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawToken }),
        });
        if (response.ok) {
          const data = (await response.json()) as { session_id?: string };
          return data.session_id ?? `session_${rawToken.slice(0, 12)}`;
        }
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    // 开发阶段兜底：无后端时允许继续进入，避免卡住已支付用户
    if (rawToken && rawToken.length >= 6) {
      return `session_${rawToken.slice(0, 12)}`;
    }
    throw lastError ?? new Error("Token exchange failed");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setState("ready");
        return;
      }
      setState("loading");
      try {
        const sessionId = await exchangeToken(token);
        if (cancelled) return;
        seedLocalChatStore(sessionId);
        try {
          sessionStorage.setItem("poju_chat_payment_welcome_toast", "1");
        } catch {
          // ignore
        }
        router.replace(pathname || "/chat");
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorText(
          error instanceof Error
            ? error.message
            : `We're confirming your payment. Please contact ${siteConfig.supportEmail}.`,
        );
        setState("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [exchangeToken, pathname, router, token]);

  if (state === "ready") {
    return <iframe title="POJU Chat UI" src="/chatui.html" className="h-full w-full border-0" />;
  }

  if (state === "error") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-deep px-4 text-text-body">
        <div className="poju-glass-card max-w-md p-6 text-center">
          <p className="text-xl font-semibold text-text-primary">Something went wrong.</p>
          <p className="mt-2 text-sm text-text-secondary">
            Your payment is safe. Please contact {siteConfig.supportEmail}.
          </p>
          {errorText ? <p className="mt-2 text-xs text-text-dim">{errorText}</p> : null}
          <div className="mt-5 flex items-center justify-center gap-3">
            <a
              className="poju-button-primary"
              href={`mailto:${siteConfig.supportEmail}?subject=POJU%20Payment%20Recovery&body=Token:%20${token ?? ""}`}
            >
              Contact support
            </a>
            <button type="button" className="poju-button-secondary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-deep px-4 text-text-body">
      <div className="poju-glass-card max-w-md p-6 text-center">
        <p className="text-xl font-semibold text-text-primary">✦ POJU</p>
        <p className="mt-3 text-sm text-text-secondary">Preparing your session...</p>
        <div
          className="mx-auto mt-5 h-8 w-8 rounded-full border-2 border-purple-vivid/40 border-t-purple-vivid"
          style={{ animation: "pojuSpin 1s linear infinite" }}
          aria-hidden
        />
        <p className="mt-3 text-xs text-text-dim">Your payment is confirmed.</p>
      </div>
    </div>
  );
}
