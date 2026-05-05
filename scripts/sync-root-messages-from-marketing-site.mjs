/**
 * 将 marketingSite（Fix 03 Part 5）同步到 next-intl 实际使用的根键：
 * common / nav / home，使首页等 getTranslations("home") 随 locale 切换。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, "..", "messages");

const languageUi = {
  en: { short: "Lang", aria: "Language", mobileSection: "Language" },
  zh: { short: "语言", aria: "选择界面语言", mobileSection: "语言" },
  es: { short: "Idioma", aria: "Idioma", mobileSection: "Idioma" },
  fr: { short: "Langue", aria: "Langue", mobileSection: "Langue" },
  de: { short: "Spr.", aria: "Sprache", mobileSection: "Sprache" },
};

function sync(data, locale) {
  const ms = data.marketingSite;
  if (!ms) throw new Error("missing marketingSite");

  const h = ms.home;
  const c = ms.common;
  const n = ms.nav;
  const f = ms.footer;
  const hero = h.hero;
  const tw = h.three_ways;
  const tl = h.two_languages;
  const p = h.promises;
  const fc = h.final_cta;

  data.common.tagline = c.tagline;
  data.common.footerTagline = c.footer_disclaimer;
  data.common.syncroFooterTagline = f.disclaimers.syncro;
  if (f.copyright) data.common.copyright = f.copyright;

  data.nav.poju = n.poju;
  data.nav.glyph = n.glyph;
  data.nav.syncro = n.syncro;
  data.nav.archive = n.archive;
  if (f.links) {
    data.nav.home = f.links.home;
    data.nav.disclaimer = f.links.disclaimer;
    data.nav.privacy = f.links.privacy;
    data.nav.terms = f.links.terms;
    data.nav.contact = f.links.contact;
  }

  data.home.hero.brand = hero.brand ?? "Poju Life";
  data.home.hero.headline = hero.headline ?? "Break through what won't let you go.";
  data.home.hero.descLine1 = hero.desc_line1 ?? "Two thousand years of Eastern wisdom.";
  data.home.hero.descLine2 = hero.desc_line2 ?? "Confirmed by modern science.";
  data.home.hero.descLine3 = hero.desc_line3 ?? "Translated by AI — for you, today.";
  data.home.hero.trustLine = c.trust_line;
  delete data.home.hero.title;
  delete data.home.hero.subtitle;
  data.home.threeWays.heading = tw.heading;
  data.home.cta.startSession = hero.cta_primary;
  data.home.cta.tryGlyph = hero.cta_secondary;
  data.home.cta.yoursToDecide = c.trust_line;

  data.home.twoLanguages.heading = tl.heading;
  data.home.twoLanguages.line1 = tl.subtitles[0];
  data.home.twoLanguages.line2 = tl.subtitles[1];
  data.home.twoLanguages.line3 = tl.subtitles[2];
  data.home.twoLanguages.patternTitle = tl.pattern.title;
  data.home.twoLanguages.patternBody = tl.pattern.description;
  data.home.twoLanguages.directionTitle = tl.direction.title;
  data.home.twoLanguages.directionBody = tl.direction.description;
  data.home.twoLanguages.timingTitle = tl.timing.title;
  data.home.twoLanguages.timingBody = tl.timing.description;
  data.home.twoLanguages.youTitle = tl.you.title;
  data.home.twoLanguages.youBody = tl.you.description;

  data.home.promises.heading = p.heading;
  data.home.promises.neverStoredTitle = p.never_stored.title;
  data.home.promises.neverStoredBody = p.never_stored.description;
  data.home.promises.neverRequiredTitle = p.never_required.title;
  data.home.promises.neverRequiredBody = p.never_required.description;
  data.home.promises.neverManipulativeTitle = p.never_manipulative.title;
  data.home.promises.neverManipulativeBody = p.never_manipulative.description;
  data.home.promises.readMore = p.read_more;

  data.home.finalCta.heading = fc.heading;
  data.home.finalCta.subtitle = fc.subtitle;
  data.home.finalCta.subline = fc.subtitle;
  data.home.finalCta.primary = fc.primary;
  data.home.finalCta.secondary = fc.secondary;

  data.home.products.poju.name = "POJU";
  data.home.products.poju.line1 = tw.poju.tagline;
  data.home.products.poju.line2 = tw.poju.description;
  data.home.products.poju.cta = tw.try_it;

  data.home.products.glyph.name = "Glyph";
  data.home.products.glyph.line1 = tw.glyph.tagline;
  data.home.products.glyph.line2 = tw.glyph.description;
  data.home.products.glyph.cta = tw.try_it;

  data.home.products.syncro.name = "Syncro";
  data.home.products.syncro.line1 = tw.syncro.tagline;
  data.home.products.syncro.line2 = tw.syncro.description;
  data.home.products.syncro.cta = tw.try_it;

  const freeLabel =
    { en: "Free", zh: "免费", es: "Gratis", fr: "Gratuit", de: "Kostenlos" }[
      locale
    ] ?? "Free";
  const glyphBadgeFree =
    { en: "Free", zh: "免费", es: "GRATIS", fr: "GRATUIT", de: "KOSTENLOS" }[locale] ?? "Free";
  data.home.products.glyph.badgeFree = glyphBadgeFree;
  data.home.products.glyph.badgeStruck = "$1.99";
  delete data.home.products.glyph.badge;
  data.home.products.syncro.badge = freeLabel;

  data.language.comingSoon =
    {
      en: "All locales active",
      zh: "多语言已启用",
      es: "Todos los idiomas activos",
      fr: "Toutes les langues actives",
      de: "Alle Sprachen aktiv",
    }[locale] ?? data.language.comingSoon;

  const lu = languageUi[locale];
  if (lu) {
    data.language.short = lu.short;
    data.language.aria = lu.aria;
    data.language.mobileSection = lu.mobileSection;
  }
}

for (const loc of ["en", "zh", "es", "fr", "de"]) {
  const p = path.join(messagesDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  sync(data, loc);
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  console.log("synced root from marketingSite:", loc);
}
