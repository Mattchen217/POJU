"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { checkGlyphUsage } from "@/lib/glyph/storage";

export function GlyphHomePage() {
  const router = useRouter();
  const t = useTranslations("glyph");

  const [hasUsedFree, setHasUsedFree] = useState(false);
  const [checking, setChecking] = useState(true);
  const [paidBusy, setPaidBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const usage = await checkGlyphUsage();
        setHasUsedFree(usage.has_used_free);
      } catch (e) {
        console.error(e);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  function handleStartFree() {
    router.push("/glyph/prepare?type=free");
  }

  async function handleStartPaid() {
    setPaidBusy(true);
    try {
      const res = await fetch("/api/payments/create", { method: "POST" });
      if (!res.ok) {
        router.push("/glyph/prepare?type=paid");
        return;
      }
      await fetch("/api/glyph/quota", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "consume_paid" }),
      });
      router.push("/glyph/prepare?type=paid");
    } catch {
      router.push("/glyph/prepare?type=paid");
    } finally {
      setPaidBusy(false);
    }
  }

  if (checking) {
    return <div className="session-prep-loading">{t("loading")}</div>;
  }

  return (
    <main className="glyph-home-page">
      <div className="glyph-home-inner">
        <div className="glyph-hero">
          <h1 className="glyph-title">GLYPH</h1>
          <p className="glyph-subtitle">{t("subtitle")}</p>
          <p className="glyph-description">{t("description")}</p>
        </div>

        <div className="glyph-actions">
          {!hasUsedFree ? (
            <button type="button" onClick={handleStartFree} className="glyph-primary-btn">
              {t("start_free")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStartPaid()}
              disabled={paidBusy}
              className="glyph-primary-btn"
            >
              {paidBusy ? t("starting_paid") : t("start_paid")}
            </button>
          )}
        </div>

        <p className="glyph-home-foot">
          <Link href="/oracle" className="glyph-link-muted">
            {t("about_glyph")}
          </Link>
        </p>
      </div>
    </main>
  );
}
