import type { Metadata } from "next";

import { ArchiveDetailClient } from "@/components/archive/archive-detail-client";

export const metadata: Metadata = {
  title: "Archive — Eastern OS",
};

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function ArchiveDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <section className="relative mx-auto mt-2 w-full max-w-6xl overflow-hidden rounded-xl border border-white/10 bg-[#15121b] px-6 py-8 text-[#e7e0ed] md:py-12">
          <ArchiveDetailClient archiveId={id} />
        </section>
      </div>
    </main>
  );
}
