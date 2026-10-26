"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { Link } from "@/i18n/navigation";

import "@/components/auth/auth.css";

/**
 * Partner accepts a seat invite after OAuth/login.
 * If not signed in → redirect to login (with next back here) so Google etc. work.
 */
function HouseholdAcceptInner() {
  const t = useTranslations("account");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace(`/${locale}/account`);
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
        if (res.status === 401 || data.error === "unauthorized") {
          const next = `/${locale}/account/household/accept?token=${encodeURIComponent(token)}`;
          router.replace(`/${locale}/login?next=${encodeURIComponent(next)}`);
          return;
        }
        if (!res.ok || !data.ok) {
          setStatus("err");
          setError(data.error ?? "accept_failed");
          return;
        }
        setStatus("ok");
        setTimeout(() => {
          router.replace(`/${locale}/account`);
        }, 1000);
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

  if (!token) {
    return (
      <AuthCard title={t("bindSeatTitle")} showClose closeHref="/account">
        <p className="auth-card__subtitle">{t("bindSeatRedirecting")}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("bindSeatTitle")} showClose closeHref="/account">
      <p className="auth-card__subtitle">
        {status === "working"
          ? t("bindSeatAccepting")
          : status === "ok"
            ? t("bindSeatAcceptOk")
            : status === "err"
              ? `${t("bindSeatAcceptFail")}: ${error}`
              : null}
      </p>
      {status === "err" ? (
        <p className="auth-card__footer" style={{ marginTop: 16 }}>
          <Link href="/account">{t("bindSeatBackAccount")}</Link>
        </p>
      ) : null}
    </AuthCard>
  );
}

export default function HouseholdAcceptPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="…" showClose={false}>
          <p className="auth-card__subtitle">…</p>
        </AuthCard>
      }
    >
      <HouseholdAcceptInner />
    </Suspense>
  );
}
