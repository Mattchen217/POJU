import { getTranslations } from "next-intl/server";

import { LegalDocumentBody } from "@/components/legal/legal-document-body";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

type LegalNamespace = "cookies";

type LegalDocumentPageProps = {
  namespace: LegalNamespace;
  maxWidth?: "md" | "lg";
};

export async function LegalDocumentPage({ namespace, maxWidth = "md" }: LegalDocumentPageProps) {
  const t = await getTranslations(namespace);

  return (
    <LegalPageShell
      version={t("meta.version")}
      title={t("meta.title")}
      updated={t("meta.updated")}
      maxWidth={maxWidth}
      footer={
        (() => {
          const closing = t("closing");
          return closing.trim() ? <p>{closing}</p> : undefined;
        })()
      }
    >
      <LegalDocumentBody namespace={namespace} />
    </LegalPageShell>
  );
}
