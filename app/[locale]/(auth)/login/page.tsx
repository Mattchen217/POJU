import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
};

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/** Server page — no useSearchParams Suspense, avoids empty-card flash on open. */
export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <LoginForm initialNext={firstString(sp.next)} initialError={firstString(sp.error)} />
  );
}
