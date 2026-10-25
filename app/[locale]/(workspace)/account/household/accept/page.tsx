"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";

export default function HouseholdAcceptPage() {
  const locale = useLocale();
  const zh = locale.toLowerCase().startsWith("zh");
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setError("missing_token");
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("working");
      try {
        const res = await fetch("/api/household/accept-seat", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setStatus("err");
          setError(data.error ?? "accept_failed");
          return;
        }
        setStatus("ok");
        setTimeout(() => {
          router.replace(`/${locale}/account`);
        }, 1200);
      } catch {
        if (!cancelled) {
          setStatus("err");
          setError("network_error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, locale, router]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-[#f5f0e8]">
      <h1 className="text-xl font-medium">
        {zh ? "加入双人订阅" : "Join Duo household"}
      </h1>
      <p className="mt-3 text-sm text-[#94a3b8]">
        {status === "working"
          ? zh
            ? "正在接受邀请…"
            : "Accepting invite…"
          : status === "ok"
            ? zh
              ? "已绑定成功，正在跳转账户页…"
              : "Bound. Redirecting to account…"
            : status === "err"
              ? `${zh ? "失败" : "Failed"}: ${error}`
              : null}
      </p>
    </main>
  );
}
