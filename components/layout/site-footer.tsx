import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-glass-border px-4 py-10 text-sm text-text-secondary">
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-text-primary">pojulife</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/disclaimer">Disclaimer</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refund Policy</Link>
          <Link href="/cookies">Cookie Policy</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <p>© 2026 pojulife. All rights reserved.</p>
        <p className="text-xs">
          pojulife offers perspective and insight. Designed for self-reflection only. All decisions are yours alone.
        </p>
      </div>
    </footer>
  );
}
