"use client";

import { useRouter } from "@/i18n/navigation";

import { WorkspaceGlyphPrepareStage } from "@/components/workspace/WorkspaceGlyphPrepareStage";

type Props = {
  profileId: string;
};

/** Marketing route — prepare wait then navigate to draw. */
export function GlyphPrepareProfilePage({ profileId }: Props) {
  const router = useRouter();

  return (
    <WorkspaceGlyphPrepareStage
      profileId={profileId}
      onComplete={() =>
        router.push(`/glyph/draw?profile=${encodeURIComponent(profileId)}`)
      }
      onBack={() => router.push("/glyph/prepare")}
    />
  );
}
