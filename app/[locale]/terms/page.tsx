import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service — pojulife",
  description: "pojulife terms of service",
};

export default function TermsPage() {
  return <LegalDocumentPage namespace="terms" />;
}
