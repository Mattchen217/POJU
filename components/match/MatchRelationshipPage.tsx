"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { RelationshipInput } from "@/components/match/RelationshipInput";
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
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void init();
  }, [router]);

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

  function handleContinue() {
    if (relationship.trim().length < 10) return;
    sessionStorage.setItem("match_relationship", relationship.trim());
    router.push("/match/analyzing");
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
      <RelationshipInput
        aLabel={formatBirthShort(aProfile)}
        bLabel={formatBirthShort(bProfile)}
        relationship={relationship}
        onRelationshipChange={setRelationship}
        onContinue={handleContinue}
        onBack={handleBack}
      />
    </main>
  );
}
