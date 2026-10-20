/**
 * Fixed decision-report email chrome (short body; report lives in HTML attachment).
 */

export type ReportMailLocale = "en" | "zh" | "es" | "fr";

export function normalizeReportMailLocale(raw?: string | null): ReportMailLocale {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("zh")) return "zh";
  if (s.startsWith("es")) return "es";
  if (s.startsWith("fr")) return "fr";
  return "en";
}

type Copy = {
  subject: (title: string) => string;
  introHtml: string;
  introText: string;
  footerHtml: string;
  footerText: string;
};

const COPY: Record<ReportMailLocale, Copy> = {
  en: {
    subject: (title) => `Your Eastern OS decision report · ${title.slice(0, 80)}`,
    introHtml:
      "Your <strong>decision report</strong> is in the attached interactive HTML file. Download and save the attachment, then open it in <strong>Chrome, Safari, Edge</strong>, or another browser (do not rely on the email preview for paging). You can turn pages and expand evidence offline — no sign-in required. This message was sent because you asked for it.",
    introText:
      "Your decision report is in the attached interactive HTML file. Download and save the attachment, then open it in Chrome, Safari, Edge, or another browser (do not rely on the email preview for paging). You can turn pages and expand evidence offline — no sign-in required. This message was sent because you asked for it.",
    footerHtml: "Sent at your request · Eastern OS",
    footerText: "Sent at your request · Eastern OS",
  },
  zh: {
    subject: (title) => `你的 Eastern OS 决策报告 · ${title.slice(0, 80)}`,
    introHtml:
      "你的<strong>决策报告</strong>在附件的交互式 HTML 文件中。请下载并保存附件，用 <strong>Chrome / Safari / Edge</strong> 等浏览器打开（不要依赖邮件内预览完成翻页）。打开后可翻页、展开依据，无需登录。本邮件因你主动请求发送。",
    introText:
      "你的决策报告在附件的交互式 HTML 文件中。请下载并保存附件，用 Chrome / Safari / Edge 等浏览器打开（不要依赖邮件内预览完成翻页）。打开后可翻页、展开依据，无需登录。本邮件因你主动请求发送。",
    footerHtml: "本邮件由你主动请求发送 · Eastern OS",
    footerText: "本邮件由你主动请求发送 · Eastern OS",
  },
  es: {
    subject: (title) => `Tu informe de decisión Eastern OS · ${title.slice(0, 80)}`,
    introHtml:
      "Tu <strong>informe de decisión</strong> está en el archivo HTML interactivo adjunto. Descárgalo y guárdalo, luego ábrelo en <strong>Chrome, Safari, Edge</strong> u otro navegador (no dependas de la vista previa del correo para pasar páginas). Podrás pasar páginas y ampliar evidencias sin iniciar sesión. Este mensaje se envió porque lo solicitaste.",
    introText:
      "Tu informe de decisión está en el archivo HTML interactivo adjunto. Descárgalo y guárdalo, luego ábrelo en Chrome, Safari, Edge u otro navegador. Podrás pasar páginas y ampliar evidencias sin iniciar sesión. Este mensaje se envió porque lo solicitaste.",
    footerHtml: "Enviado a tu solicitud · Eastern OS",
    footerText: "Enviado a tu solicitud · Eastern OS",
  },
  fr: {
    subject: (title) => `Ton rapport de décision Eastern OS · ${title.slice(0, 80)}`,
    introHtml:
      "Ton <strong>rapport de décision</strong> se trouve dans le fichier HTML interactif en pièce jointe. Télécharge et enregistre la pièce jointe, puis ouvre-la dans <strong>Chrome, Safari, Edge</strong> ou un autre navigateur (ne compte pas sur l’aperçu du mail pour tourner les pages). Tu pourras feuilleter et déployer les preuves hors ligne, sans connexion. Ce message a été envoyé à ta demande.",
    introText:
      "Ton rapport de décision se trouve dans le fichier HTML interactif en pièce jointe. Télécharge et enregistre la pièce jointe, puis ouvre-la dans Chrome, Safari, Edge ou un autre navigateur. Tu pourras feuilleter et déployer les preuves hors ligne, sans connexion. Ce message a été envoyé à ta demande.",
    footerHtml: "Envoyé à ta demande · Eastern OS",
    footerText: "Envoyé à ta demande · Eastern OS",
  },
};

const BASELINE: Record<
  ReportMailLocale,
  { subject: (title: string) => string; intro: string; footer: string }
> = {
  en: {
    subject: (title) => title.trim().slice(0, 120) || "Personal baseline profile",
    intro:
      "Your personal baseline profile is in the attached interactive HTML. Open it in a browser — no sign-in required.",
    footer: "Sent at your request · Eastern OS",
  },
  zh: {
    subject: () => "个人基础画像",
    intro: "你的个人基础画像在附件的交互式 HTML 中。用浏览器打开即可，无需登录。",
    footer: "本邮件由你主动请求发送 · Eastern OS",
  },
  es: {
    subject: (title) => title.trim().slice(0, 120) || "Perfil base personal",
    intro:
      "Tu perfil base personal está en el HTML interactivo adjunto. Ábrelo en un navegador — sin iniciar sesión.",
    footer: "Enviado a tu solicitud · Eastern OS",
  },
  fr: {
    subject: (title) => title.trim().slice(0, 120) || "Profil de base personnel",
    intro:
      "Ton profil de base personnel est dans le HTML interactif en pièce jointe. Ouvre-le dans un navigateur — sans connexion.",
    footer: "Envoyé à ta demande · Eastern OS",
  },
};

export function decisionReportAttachmentFilename(dateIso = new Date().toISOString()): string {
  return `eastern-os-decision-report-${dateIso.slice(0, 10)}.html`;
}

export function getDecisionReportMailCopy(localeRaw: string | undefined, title: string) {
  const locale = normalizeReportMailLocale(localeRaw);
  const c = COPY[locale];
  return {
    locale,
    subject: c.subject(title),
    introHtml: c.introHtml,
    introText: c.introText,
    footerHtml: c.footerHtml,
    footerText: c.footerText,
    filename: decisionReportAttachmentFilename(),
  };
}

export function getBaselinePackMailCopy(localeRaw: string | undefined, title: string) {
  const locale = normalizeReportMailLocale(localeRaw);
  const c = BASELINE[locale];
  return {
    locale,
    subject: c.subject(title),
    introHtml: c.intro,
    introText: c.intro,
    footerHtml: c.footer,
    footerText: c.footer,
    filename: `eastern-os-baseline-profile-${new Date().toISOString().slice(0, 10)}.html`,
  };
}
