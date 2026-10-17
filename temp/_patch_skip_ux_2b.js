const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

{
  const p = "lib/poju/dyad-compat.ts";
  let s = read(p);

  // Remove the helpers block we inserted early (before dyadLang)
  const startMark = "\n/**\n * Skip-path UX (#12):";
  const start = s.indexOf(startMark);
  if (start < 0) throw new Error("helpers block start not found");
  const endMark = "export function dyadGateChipsLocked";
  const endFn = s.indexOf(endMark, start);
  if (endFn < 0) throw new Error("dyadGateChipsLocked not found");
  // end of dyadGateChipsLocked function
  const endBrace = s.indexOf("\n}", endFn);
  const after = s.indexOf("\n", endBrace + 2);
  const block = s.slice(start, after + 1);
  s = s.slice(0, start) + s.slice(after + 1);

  // Fix shouldAnnotate to be tighter in the block text
  let fixed = block.replace(
    /export function shouldAnnotateUnderstandingWithSkipPath\(input: \{[\s\S]*?\}\): boolean \{[\s\S]*?\n\}/,
    `export function shouldAnnotateUnderstandingWithSkipPath(input: {
  dyadOfferStatus?: DyadOfferStatus | null;
  partner_bazi?: PartnerBaziPresence | null;
  pivot_chart_path?: PivotChartPath | null;
}): boolean {
  if (input.dyadOfferStatus === "skipped") return true;
  // Skip patch always locks solo + absent together.
  return input.partner_bazi === "absent" && input.pivot_chart_path === "solo";
}`
  );

  // Use deliveryLocaleBucket inline instead of dyadLang so helpers can live after ACTION_LABELS
  fixed = fixed.replace(
    /export function dyadSkipPathUnderstandingNote\(locale: string\): string \{[\s\S]*?const lang = dyadLang\(locale\);/,
    `export function dyadSkipPathUnderstandingNote(locale: string): string {
  const lang = deliveryLocaleBucket(locale);`
  );

  // Insert after matchDyadGateAction function (dyadLang exists by then; deliveryLocaleBucket imported at top)
  const anchor = "export function matchDyadGateAction(";
  const a = s.indexOf(anchor);
  if (a < 0) throw new Error("matchDyadGateAction not found");
  // find closing of matchDyadGateAction
  let i = s.indexOf("\n}", a);
  // matchDyadGateAction has nested braces - find the return null; then }
  const ret = s.indexOf("return null;\n}", a);
  const insertAt = ret >= 0 ? ret + "return null;\n}".length : i + 2;

  s = s.slice(0, insertAt) + "\n" + fixed + s.slice(insertAt);
  write(p, s);
}
console.log("relocated helpers");
