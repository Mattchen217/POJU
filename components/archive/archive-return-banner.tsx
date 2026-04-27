"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = {
  className?: string;
};

export function ArchiveReturnBanner({ className = "" }: Props) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const entry = searchParams.get("entry");
  const kind = searchParams.get("kind");

  if (from !== "archive") return null;

  return (
    <div className={`rounded-xl border border-violet-300/30 bg-violet-900/25 px-4 py-3 text-xs text-violet-100 ${className}`}>
      <p>
        Opened from Archive{kind ? ` · ${kind.toUpperCase()}` : ""}{entry ? ` · ${entry}` : ""}.
      </p>
      <Link href="/archive" className="mt-1 inline-flex text-violet-200 underline underline-offset-4 hover:text-white">
        ← Back to Archive
      </Link>
    </div>
  );
}

