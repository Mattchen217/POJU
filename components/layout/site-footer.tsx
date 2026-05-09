import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-glass-border px-4 py-10 text-sm text-text-secondary">
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-text-primary">Pojulife</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/disclaimer">Disclaimer</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <p>© 2026 Pojulife. All rights reserved.</p>
        <p>Not medical, legal, or financial advice.</p>
      </div>
    </footer>
  );
}
