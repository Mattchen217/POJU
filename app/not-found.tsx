import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <GlassCard variant="elevated" padding="lg" className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Path not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This page does not exist in the current POJU universe map.
        </p>
        <Link href="/" className="glass-btn glass-btn-primary mt-5 inline-flex">
          Return Home
        </Link>
      </GlassCard>
    </div>
  );
}
