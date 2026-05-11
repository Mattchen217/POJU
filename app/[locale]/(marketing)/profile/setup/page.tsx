import { BirthInfoForm } from "@/components/forms/BirthInfoForm";

export default function ProfileSetupPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-text-primary">Profile Setup</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Create encrypted shared profile once. POJU / Glyph / Syncro will reuse it.
      </p>
      <div className="mt-6">
        <BirthInfoForm />
      </div>
    </main>
  );
}
