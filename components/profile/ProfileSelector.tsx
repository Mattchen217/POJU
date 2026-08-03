"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BirthInfoForm } from "@/components/forms/BirthInfoForm";
import { AppDialogProvider, useAppDialog } from "@/components/ui/app-dialog";
import type { StoredProfileRelationship } from "@/lib/db/poju-db";
import {
  deleteStoredProfile,
  getStoredProfile,
  getStoredProfileRecord,
  importCalculatedProfileAsStored,
  listStoredProfiles,
  recordProfileUsage,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import { normalizeStoredBirthInfo } from "@/lib/profile/birth-info-utils";
import { formatBirthLocationLabel } from "@/lib/profile/birth-info-display";
import type { UserProfile } from "@/lib/profile/types";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { ProfileAccuracyBadge } from "@/components/profile/ProfileAccuracyBadge";
import { ProfileUpgradeModal } from "@/components/profile/ProfileUpgradeModal";
import { LOCAL_OWNER_CHANGED_EVENT } from "@/lib/storage/local-owner";

export interface ProfileSelectorProps {
  product: "poju" | "glyph" | "syncro";
  onSelected: (profileId: string) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}

type Step = "list" | "confirm" | "create";

const REL_OPTIONS: StoredProfileRelationship[] = [
  "self",
  "spouse",
  "child",
  "parent",
  "sibling",
  "friend",
  "other",
];

function relLabel(r: StoredProfileRelationship, tr: (key: string) => string): string {
  switch (r) {
    case "self":
      return tr("rel_self");
    case "spouse":
      return tr("rel_spouse");
    case "child":
      return tr("rel_child");
    case "parent":
      return tr("rel_parent");
    case "sibling":
      return tr("rel_sibling");
    case "friend":
      return tr("rel_friend");
    default:
      return tr("rel_other");
  }
}

export function ProfileSelector(props: ProfileSelectorProps) {
  return (
    <AppDialogProvider>
      <ProfileSelectorInner {...props} />
    </AppDialogProvider>
  );
}

function ProfileSelectorInner({ product, onSelected, onCancel, allowSkip, onSkip }: ProfileSelectorProps) {
  const t = useTranslations("profile_selector");
  const tCommon = useTranslations("common");
  const { confirm } = useAppDialog();
  const router = useRouter();
  const [step, setStep] = useState<Step>("list");
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeTarget, setUpgradeTarget] = useState<StoredProfileSummary | null>(null);

  async function loadProfiles() {
    setLoading(true);
    try {
      const list = await listStoredProfiles();
      setProfiles(list);
      setStep(list.length === 0 ? "create" : "list");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
    const onOwner = () => {
      void loadProfiles();
    };
    window.addEventListener(LOCAL_OWNER_CHANGED_EVENT, onOwner);
    return () => window.removeEventListener(LOCAL_OWNER_CHANGED_EVENT, onOwner);
  }, []);

  async function handleConfirmAndContinue() {
    if (!selectedProfileId) return;
    await recordProfileUsage(selectedProfileId, product);
    onSelected(selectedProfileId);
  }

  async function handleDelete(profileId: string) {
    const profile = profiles.find((p) => p.profile_id === profileId);
    const ok = await confirm(tCommon("deleteConfirmWarning"), t("delete"), {
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      tone: "danger",
      target: profile?.display_name?.trim() || profile?.birth_date,
    });
    if (!ok) return;
    await deleteStoredProfile(profileId);
    await loadProfiles();
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">{t("loading")}</p>;
  }

  return (
    <div className="space-y-4">
      {step === "list" ? (
        <ProfileListView
          profiles={profiles}
          onSelect={(id) => {
            setSelectedProfileId(id);
            setStep("confirm");
          }}
          onAddNew={() => setStep("create")}
          onDelete={(id) => void handleDelete(id)}
          onUpgrade={(p) => setUpgradeTarget(p)}
          onViewAnalysis={(p) => router.push(`/profile/${p.profile_id}`)}
          onCancel={onCancel}
          allowSkip={allowSkip}
          onSkip={onSkip}
        />
      ) : null}

      {step === "confirm" && selectedProfileId ? (
        <ProfileConfirmView
          profileId={selectedProfileId}
          onConfirm={() => void handleConfirmAndContinue()}
          onBack={() => setStep("list")}
        />
      ) : null}

      {step === "create" ? (
        <ProfileCreateView
          onComplete={async (profileId) => {
            await recordProfileUsage(profileId, product);
            onSelected(profileId);
          }}
          onCancel={() => {
            if (profiles.length > 0) setStep("list");
            else onCancel?.();
          }}
          allowSkip={allowSkip}
          onSkip={onSkip}
        />
      ) : null}

      {upgradeTarget ? (
        <ProfileUpgradeModal
          profile={upgradeTarget}
          onClose={() => setUpgradeTarget(null)}
          onUpgraded={() => void loadProfiles()}
        />
      ) : null}

    </div>
  );
}

function ProfileListView({
  profiles,
  onSelect,
  onAddNew,
  onDelete,
  onUpgrade,
  onViewAnalysis,
  onCancel,
  allowSkip,
  onSkip,
}: {
  profiles: StoredProfileSummary[];
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onDelete: (id: string) => void;
  onUpgrade: (summary: StoredProfileSummary) => void;
  onViewAnalysis: (summary: StoredProfileSummary) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}) {
  const t = useTranslations("profile_selector");
  const rel = (r: string) =>
    ({
      self: t("rel_self"),
      spouse: t("rel_spouse"),
      child: t("rel_child"),
      parent: t("rel_parent"),
      sibling: t("rel_sibling"),
      friend: t("rel_friend"),
      other: t("rel_other"),
    })[r] ?? r;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">{t("list_title")}</h2>
      <p className="text-sm text-text-secondary">{t("list_description")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {profiles.map((p) => (
          <div
            key={p.profile_id}
            className="rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-cyan-400/30"
          >
            <button type="button" className="w-full text-left" onClick={() => onSelect(p.profile_id)}>
              <p className="font-medium text-text-primary">
                {p.display_name}{" "}
                <span className="text-xs font-normal text-text-dim">({rel(p.relationship)})</span>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {p.birth_date} · {HOUR_PERIOD_INFO[p.hour_period].zh_label} ·{" "}
                {p.gender === "M" ? t("male") : t("female")}
              </p>
              <p className="mt-1 text-xs text-text-dim">{p.timezone}</p>
              {p.has_base_analysis ? (
                <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                  {t("analyzed")}
                </span>
              ) : null}
              <div className="mt-2">
                <ProfileAccuracyBadge profile={p} onUpgrade={() => onUpgrade(p)} />
              </div>
            </button>
            <div className="mt-2 flex flex-wrap gap-3 border-t border-white/10 pt-2">
              {p.has_base_analysis ? (
                <button
                  type="button"
                  className="text-xs text-cyan-200/90 hover:underline"
                  onClick={() => onViewAnalysis(p)}
                >
                  {t("view_analysis")}
                </button>
              ) : null}
              <button type="button" className="text-xs text-red-300/90 hover:underline" onClick={() => onDelete(p.profile_id)}>
                {t("delete")}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddNew}
          className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/10 p-4 text-sm text-cyan-100/90 hover:border-cyan-400/40"
        >
          <span className="text-2xl leading-none">+</span>
          {t("add_new")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {allowSkip && onSkip ? (
          <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-text-secondary" onClick={onSkip}>
            {t("skip_for_now")}
          </button>
        ) : null}
        {onCancel ? (
          <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-text-secondary" onClick={onCancel}>
            {t("cancel")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProfileConfirmView({
  profileId,
  onConfirm,
  onBack,
}: {
  profileId: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("profile_selector");
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getStoredProfile>> | null | undefined>(undefined);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof getStoredProfileRecord>> | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoadingProfile(true);
      const [d, r] = await Promise.all([getStoredProfile(profileId), getStoredProfileRecord(profileId)]);
      setData(d ?? null);
      setRecord(r);
      setLoadingProfile(false);
    })();
  }, [profileId]);

  async function runBaseAnalysis() {
    setGenError(null);
    setGenerating(true);
    try {
      await generateBaseAnalysis(profileId);
      router.push(`/profile/${profileId}`);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  if (loadingProfile || data === undefined) return <p className="text-sm text-text-secondary">{t("loading")}</p>;
  if (data === null) return <p className="text-sm text-red-300">Profile not found.</p>;
  const birth = normalizeStoredBirthInfo(data.birth_info as unknown as Record<string, unknown>);
  const locationLabel = formatBirthLocationLabel(birth.birth_location, t("birth_location_default"));

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <h2 className="text-lg font-semibold text-text-primary">{t("confirm_title")}</h2>
      <p className="text-sm text-text-secondary">{t("confirm_description")}</p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-text-dim">{t("birth_date_label")}</dt>
          <dd className="text-text-primary">
            {birth.year}-{birth.month}-{birth.day}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-dim">{t("birth_time_label")}</dt>
          <dd className="text-text-primary">
            {HOUR_PERIOD_INFO[birth.hour_period].zh_label}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-dim">{t("birth_location_label")}</dt>
          <dd className="text-text-primary">{locationLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-dim">{t("gender_label")}</dt>
          <dd className="text-text-primary">
            {birth.gender === "M" ? t("male") : birth.gender === "F" ? t("female") : t("other_gender")}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-text-dim">{t("confirm_reassure")}</p>
      {record && !record.has_base_analysis ? (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-text-secondary">
          <p>{t("base_analysis_note")}</p>
          {genError ? <p className="mt-2 text-red-300">{t("base_analysis_error")}: {genError}</p> : null}
          <button
            type="button"
            disabled={generating}
            className="mt-2 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-100 disabled:opacity-50"
            onClick={() => void runBaseAnalysis()}
          >
            {generating ? t("generating_base_analysis") : t("generate_base_analysis")}
          </button>
        </div>
      ) : record?.has_base_analysis ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-emerald-200/90">{t("base_analysis_ready")}</p>
          <button
            type="button"
            className="text-xs text-cyan-200/90 hover:underline"
            onClick={() => router.push(`/profile/${profileId}`)}
          >
            {t("view_analysis")}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={onBack}>
          {t("back_to_list")}
        </button>
        <button
          type="button"
          className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100"
          onClick={onConfirm}
        >
          {t("confirm_and_continue")}
        </button>
      </div>
    </div>
  );
}

function ProfileCreateView({
  onComplete,
  onCancel,
  allowSkip,
  onSkip,
}: {
  onComplete: (profileId: string) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}) {
  const t = useTranslations("profile_selector");

  async function onProfileReady(profile: UserProfile) {
    const { profile_id } = await importCalculatedProfileAsStored({ profile });
    onComplete(profile_id);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
        <h2 className="text-lg font-semibold text-text-primary">{t("create_title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("create_description")}</p>
      </div>
      <BirthInfoForm
        context="profile"
        persistDefaultProfile={false}
        onComplete={(p) => void onProfileReady(p)}
        allowSkip={allowSkip}
        onSkip={onSkip}
      />
      {onCancel ? (
        <button type="button" className="text-sm text-text-secondary hover:underline" onClick={onCancel}>
          {t("cancel")}
        </button>
      ) : null}
    </div>
  );
}
