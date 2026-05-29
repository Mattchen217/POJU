"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { RelationshipInput } from "@/components/match/RelationshipInput";
import { useMatchStartFlow } from "@/components/match/MatchStartButton";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import "@/styles/poju-tool-handoff.css";
import { useRouter } from "@/i18n/navigation";
import { formatBirthShort } from "@/lib/match/format-birth-short";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { StoredProfileData } from "@/lib/db/poju-db";

import "@/styles/match.css";

export function MatchRelationshipPage() {
  const router = useRouter();
  const t = useTranslations("match");

  const [aProfile, setAProfile] = useState<StoredProfileData | null>(null);
  const [bProfile, setBProfile] = useState<StoredProfileData | null>(null);
  const pojuHandoff = usePojuToolHandoff("match");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(true);
  const { startMatch, buttonLabel, isBusy } = useMatchStartFlow();

  useEffect(() => {
    void init();
  }, [router]);

  useEffect(() => {
    const prefill =
      pojuHandoff?.prefill.partner_relationship ??
      sessionStorage.getItem("match_relationship_prefill");
    if (prefill && prefill.trim().length >= 10 && relationship.trim().length < 10) {
      setRelationship(prefill.trim());
    }
  }, [pojuHandoff, relationship]);

  async function init() {
    const aId = sessionStorage.getItem("match_a_profile_id");
    const bId = sessionStorage.getItem("match_b_profile_id");

    if (!aId || !bId) {
      router.replace("/match/select-a");
      return;
    }

    try {
      const [a, b] = await Promise.all([getStoredProfile(aId), getStoredProfile(bId)]);
      if (!a || !b) {
        router.replace("/match/select-a");
        return;
      }
      setAProfile(a);
      setBProfile(b);
    } catch (e) {
      console.error("[match/relationship]", e);
      router.replace("/match/select-a");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (relationship.trim().length < 10 || isBusy) return;
    sessionStorage.setItem("match_relationship", relationship.trim());

    const aId = sessionStorage.getItem("match_a_profile_id");
    const bId = sessionStorage.getItem("match_b_profile_id");
    if (!aId || !bId) {
      router.replace("/match/select-a");
      return;
    }

    await startMatch(aId, bId);
  }

  function handleBack() {
    router.push("/match/select-b");
  }

  if (loading) {
    return (
      <main className="match-relationship-page match-relationship-page--loading">
        <p>{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="match-relationship-page">
      {pojuHandoff ? <PojuToolHandoffBanner handoff={pojuHandoff} /> : null}
      <RelationshipInput
        aLabel={formatBirthShort(aProfile)}
        bLabel={formatBirthShort(bProfile)}
        relationship={relationship}
        onRelationshipChange={setRelationship}
        onContinue={() => void handleContinue()}
        onBack={handleBack}
        continueLabel={buttonLabel}
        continueDisabled={isBusy}
      />
    </main>
  );
}
