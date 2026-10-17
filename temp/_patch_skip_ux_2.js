const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// ---------- dyad-compat: skip-path UX helpers + stronger continue cue ----------
{
  const p = "lib/poju/dyad-compat.ts";
  let s = read(p);

  // Strengthen EN/ZH skip branch of buildDyadContinueModelUserCue
  const oldZhSkip = "用户选择暂不提供对方盘；禁止臆造对方命理。请承接原问题继续澄清情况与主期望。";
  const newZhSkip =
    "用户已跳过对方盘（path=solo · partner_bazi=absent）；禁止臆造对方命理，禁止再索要/暗示还在等对方生辰，禁止再出收集芯片。请承接原问题继续澄清情况与主期望；若三必填已齐则 understanding_sufficient=true 进入理解确认。";
  const oldEnSkip =
    "User skipped partner chart; do not invent their chart. Resume clarifying situation + desired outcome.";
  const newEnSkip =
    "User skipped partner chart (path=solo · partner_bazi=absent); do not invent their chart; do not re-ask birth details or imply we are still waiting for their chart; do not re-offer collect chips. Resume clarifying situation + desired outcome; if the three required fields are filled set understanding_sufficient=true for the confirm gate.";

  if (s.includes(oldZhSkip)) s = s.replace(oldZhSkip, newZhSkip);
  else console.log("WARN: zh skip cue not found exact");
  if (s.includes(oldEnSkip)) s = s.replace(oldEnSkip, newEnSkip);
  else console.log("WARN: en skip cue not found exact");

  // Insert helpers after shouldResumeUnderstandingConfirmAfterDyad
  const marker = "export function shouldResumeUnderstandingConfirmAfterDyad";
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("shouldResumeUnderstandingConfirmAfterDyad not found");
  // find end of that function (next export or blank+type)
  const afterFn = s.indexOf("\n\n\n", idx);
  const insertAt = afterFn >= 0 ? afterFn : s.indexOf("\ntype DyadLang", idx);
  if (insertAt < 0) throw new Error("insert point not found");

  if (!s.includes("export function shouldAnnotateUnderstandingWithSkipPath")) {
    const helpers = `

/**
 * Skip-path UX (#12): after Case C Skip, understanding confirm / chips must not
 * read as "still waiting for partner chart". Solo note is user-visible.
 */
export function shouldAnnotateUnderstandingWithSkipPath(input: {
  dyadOfferStatus?: DyadOfferStatus | null;
  partner_bazi?: PartnerBaziPresence | null;
  pivot_chart_path?: PivotChartPath | null;
}): boolean {
  if (input.dyadOfferStatus === "skipped") return true;
  if (input.partner_bazi === "absent" && input.pivot_chart_path === "solo") return true;
  return input.partner_bazi === "absent" && input.dyadOfferStatus !== "collected";
}

/** User-visible solo / skip-path line for understanding confirm (ZH/EN + locale bucket). */
export function dyadSkipPathUnderstandingNote(locale: string): string {
  const lang = dyadLang(locale);
  if (lang === "zh") {
    return "你已选择暂不提供对方盘——接下来我们按你本人的信息继续（solo 路径）。确认理解后不会再索要对方生辰，也不会再出现「输入对方信息」芯片。";
  }
  if (lang === "es") {
    return "Elegiste continuar sin su carta: seguiremos solo con tu información (ruta solo). Al confirmar no volveremos a pedir sus datos de nacimiento ni chips de recogida.";
  }
  if (lang === "fr") {
    return "Vous avez choisi de continuer sans leur thème : nous poursuivons avec vos seules informations (chemin solo). Après confirmation, plus de demande de naissance ni de puces de collecte.";
  }
  if (lang === "de") {
    return "Sie setzen ohne deren Chart fort — wir arbeiten nur mit Ihren Angaben (Solo-Pfad). Nach der Bestätigung fragen wir nicht erneut nach Geburtsdaten und zeigen keine Sammel-Chips.";
  }
  return "You've chosen to continue without their chart — we'll work from your information only (solo path). Confirming won't ask for their birth details again or re-offer collect chips.";
}

/** True when composer must not show collect/skip chips (path already locked). */
export function dyadGateChipsLocked(status: DyadOfferStatus | undefined | null): boolean {
  return status === "skipped" || status === "collected";
}
`;
    s = s.slice(0, insertAt) + helpers + s.slice(insertAt);
  }

  write(p, s);
}

console.log("part2 dyad-compat done");
