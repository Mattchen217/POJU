const fs = require("fs");

// 1) pathname — treat /contact as legal chrome
{
  let s = fs.readFileSync("lib/i18n/pathname-without-locale.ts", "utf8");
  if (!s.includes('"contact"')) {
    s = s.replace(
      `const LEGAL_SEGMENTS = new Set([
  "disclaimer",
  "privacy",
  "terms",
  "refund",
  "cookies",
]);`,
      `const LEGAL_SEGMENTS = new Set([
  "disclaimer",
  "privacy",
  "terms",
  "refund",
  "cookies",
  "contact",
]);`
    );
    // Extend LegalNavActive type
    s = s.replace(
      `export type LegalNavActive = "disclaimer" | "privacy" | "terms" | "refund" | "cookies";`,
      `export type LegalNavActive = "disclaimer" | "privacy" | "terms" | "refund" | "cookies" | "contact";`
    );
    fs.writeFileSync("lib/i18n/pathname-without-locale.ts", s, "utf8");
    console.log("updated pathname-without-locale.ts");
  } else console.log("pathname already has contact");
}

// 2) MainNav — add Contact to legal nav items
{
  let s = fs.readFileSync("components/layout/MainNav.tsx", "utf8");
  if (!s.includes('href: "/contact"')) {
    s = s.replace(
      `const LEGAL_NAV_ITEMS: { href: string; key: LegalNavActive; label: string }[] = [
  { href: "/disclaimer", key: "disclaimer", label: "Disclaimer" },
  { href: "/privacy", key: "privacy", label: "Privacy" },
  { href: "/terms", key: "terms", label: "Terms" },
  { href: "/refund", key: "refund", label: "Refund" },
  { href: "/cookies", key: "cookies", label: "Cookies" },
];`,
      `const LEGAL_NAV_ITEMS: { href: string; key: LegalNavActive; label: string }[] = [
  { href: "/disclaimer", key: "disclaimer", label: "Disclaimer" },
  { href: "/privacy", key: "privacy", label: "Privacy" },
  { href: "/terms", key: "terms", label: "Terms" },
  { href: "/refund", key: "refund", label: "Refund" },
  { href: "/cookies", key: "cookies", label: "Cookies" },
  { href: "/contact", key: "contact", label: "Contact" },
];`
    );
    fs.writeFileSync("components/layout/MainNav.tsx", s, "utf8");
    console.log("updated MainNav.tsx");
  } else console.log("MainNav already has contact");
}

// 3) MobileDrawer
{
  let s = fs.readFileSync("components/layout/mobile-drawer.tsx", "utf8");
  if (!s.includes('href: "/contact"')) {
    s = s.replace(
      `const LEGAL_NAV_ITEMS = [
  { href: "/disclaimer", key: "disclaimer" as const, label: "Disclaimer" },
  { href: "/privacy", key: "privacy" as const, label: "Privacy" },
  { href: "/terms", key: "terms" as const, label: "Terms" },
  { href: "/refund", key: "refund" as const, label: "Refund" },
  { href: "/cookies", key: "cookies" as const, label: "Cookies" },
];`,
      `const LEGAL_NAV_ITEMS = [
  { href: "/disclaimer", key: "disclaimer" as const, label: "Disclaimer" },
  { href: "/privacy", key: "privacy" as const, label: "Privacy" },
  { href: "/terms", key: "terms" as const, label: "Terms" },
  { href: "/refund", key: "refund" as const, label: "Refund" },
  { href: "/cookies", key: "cookies" as const, label: "Cookies" },
  { href: "/contact", key: "contact" as const, label: "Contact" },
];`
    );
    fs.writeFileSync("components/layout/mobile-drawer.tsx", s, "utf8");
    console.log("updated mobile-drawer.tsx");
  } else console.log("mobile-drawer already has contact");
}

console.log("nav chrome done");
