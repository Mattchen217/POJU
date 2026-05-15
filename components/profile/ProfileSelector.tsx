"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BirthInfoForm } from "@/components/forms/BirthInfoForm";
import type { StoredProfileRelationship } from "@/lib/db/poju-db";
import {
  deleteStoredProfile,
  getStoredProfile,
  getStoredProfileRecord,
  importCalculatedProfileAsStored,
  listStoredProfiles,
  recordProfileUsage,
  updateStoredProfileMeta,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import type { UserProfile } from "@/lib/profile/types";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";

export interface ProfileSelectorProps {
  product: "poju" | "glyph" | "syncro";
  onSelected: (profileId: string) => void;
  onCancel?: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}

type Step = "list" | "confirm" | "create" | "edit";

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

export function ProfileSelector({ product, onSelected, onCancel, allowSkip, onSkip }: ProfileSelectorProps) {
  const t = useTranslations("profile_selector");
  const [step, setStep] = useState<Step>("list");
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  async function handleConfirmAndContinue() {
    if (!selectedProfileId) return;
    await recordProfileUsage(selectedProfileId, product);
    onSelected(selectedProfileId);
  }

  async function handleDelete(profileId: string) {
    if (!window.confirm(t("confirm_delete"))) return;
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
          onEdit={(id) => {
            setEditingProfileId(id);
            setStep("edit");
          }}
          onDelete={(id) => void handleDelete(id)}
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
          onEdit={() => {
            setEditingProfileId(selectedProfileId);
            setStep("edit");
          }}
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

      {step === "edit" && editingProfileId ? (
        <ProfileEditMetaView
          profileId={editingProfileId}
          onSaved={() => {
            setEditingProfileId(null);
            void loadProfiles();
            setStep("list");
          }}
          onBack={() => {
            setEditingProfileId(null);
            setStep("list");
          }}
        />
      ) : null}
    </div>
  );
}

function ProfileListView({
  profiles,
  onSelect,
  onAddNew,
  onEdit,
  onDelete,
  onCancel,
  allowSkip,
  onSkip,
}: {
  profiles: StoredProfileSummary[];
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
                {p.birth_date} · {p.birth_time} ·{" "}
                {p.gender === "M" ? t("male") : p.gender === "F" ? t("female") : t("other_gender")}
              </p>
              <p className="mt-1 text-xs text-text-dim">{p.location_name}</p>
              {p.has_base_analysis ? (
                <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                  {t("analyzed")}
                </span>
              ) : null}
            </button>
            <div className="mt-2 flex gap-2 border-t border-white/10 pt-2">
              <button
                type="button"
                className="text-xs text-cyan-200/90 hover:underline"
                onClick={() => onEdit(p.profile_id)}
              >
                {t("edit")}
              </button>
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
  onEdit,
}: {
  profileId: string;
  onConfirm: () => void;
  onBack: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("profile_selector");
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
      const [d, r] = await Promise.all([getStoredProfile(profileId), getStoredProfileRecord(profileId)]);
      setData(d ?? null);
      setRecord(r);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  if (loadingProfile || data === undefined) return <p className="text-sm text-text-secondary">{t("loading")}</p>;
  if (data === null) return <p className="text-sm text-red-300">Profile not found.</p>;
  const birth = data.birth_info;

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
            {birth.hour}:{String(birth.minute).padStart(2, "0")}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-dim">{t("birth_location_label")}</dt>
          <dd className="text-text-primary">{birth.location_name ?? `${birth.latitude}, ${birth.longitude}`}</dd>
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
        <p className="text-xs text-emerald-200/90">{t("base_analysis_ready")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={onBack}>
          {t("back_to_list")}
        </button>
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={onEdit}>
          {t("edit_this")}
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
  const [displayName, setDisplayName] = useState("我自己");
  const [relationship, setRelationship] = useState<StoredProfileRelationship>("self");
  const [showBirth, setShowBirth] = useState(false);

  async function onProfileReady(profile: UserProfile) {
    const { profile_id } = await importCalculatedProfileAsStored({
      profile,
      display_name: displayName.trim() || "Profile",
      relationship,
    });
    onComplete(profile_id);
  }

  if (!showBirth) {
    return (
      <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
        <h2 className="text-lg font-semibold text-text-primary">{t("create_title")}</h2>
        <p className="text-sm text-text-secondary">{t("create_description")}</p>
        <label className="block text-xs text-text-dim">
          {t("display_name")}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="block text-xs text-text-dim">
          {t("relationship")}
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as StoredProfileRelationship)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-text-primary"
          >
            {REL_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {relLabel(r, t)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100"
          onClick={() => setShowBirth(true)}
        >
          {t("continue_to_birth")}
        </button>
        <div className="flex flex-wrap gap-2">
          {allowSkip && onSkip ? (
            <button type="button" className="text-sm text-text-secondary hover:underline" onClick={onSkip}>
              {t("skip_for_now")}
            </button>
          ) : null}
          {onCancel ? (
            <button type="button" className="text-sm text-text-secondary hover:underline" onClick={onCancel}>
              {t("cancel")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BirthInfoForm
        context="profile"
        persistDefaultProfile={false}
        onComplete={(p) => void onProfileReady(p)}
        allowSkip={allowSkip}
        onSkip={onSkip}
      />
      <button type="button" className="text-sm text-text-secondary hover:underline" onClick={() => setShowBirth(false)}>
        {t("back_to_list")}
      </button>
    </div>
  );
}

function ProfileEditMetaView({
  profileId,
  onSaved,
  onBack,
}: {
  profileId: string;
  onSaved: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("profile_selector");
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState<StoredProfileRelationship>("self");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const row = await getStoredProfileRecord(profileId);
      if (row) {
        setDisplayName(row.display_name);
        setRelationship(row.relationship);
      }
      setLoading(false);
    })();
  }, [profileId]);

  async function save() {
    await updateStoredProfileMeta(profileId, {
      display_name: displayName.trim(),
      relationship,
    });
    onSaved();
  }

  if (loading) return <p className="text-sm text-text-secondary">{t("loading")}</p>;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <h2 className="text-lg font-semibold text-text-primary">{t("edit_meta_title")}</h2>
      <p className="text-xs text-text-dim">{t("edit_meta_hint")}</p>
      <label className="block text-xs text-text-dim">
        {t("display_name")}
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-text-primary"
        />
      </label>
      <label className="block text-xs text-text-dim">
        {t("relationship")}
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as StoredProfileRelationship)}
          className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-text-primary"
        >
          {REL_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {relLabel(r, t)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm" onClick={onBack}>
          {t("edit_meta_back")}
        </button>
        <button
          type="button"
          className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100"
          onClick={() => void save()}
        >
          {t("save_meta")}
        </button>
      </div>
    </div>
  );
}
