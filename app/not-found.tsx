import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep px-4">
      <div className="poju-glass-card max-w-md p-6 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Path not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This page does not exist in the current POJU universe map.
        </p>
        <Link href="/" className="poju-button-primary mt-5 inline-flex">
          Return Home
        </Link>
      </div>
    </div>
  );
}
