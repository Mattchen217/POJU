const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

const inlineDecl = "let inlineCall: (() => Promise<NextResponse>) | null = null;";
if (!s.includes("let m22_claim_token: string | null = null;") || s.indexOf(inlineDecl) < 0) {
  console.error("unexpected state");
  process.exit(1);
}

// Count occurrences of let m22_claim_token
const matches = [...s.matchAll(/let m22_claim_token: string \| null = null;/g)];
console.log("let m22_claim_token count", matches.length);

// If already hoisted once near inlineCall, skip hoist
const afterInline = s.indexOf(inlineDecl) + inlineDecl.length;
const window = s.slice(afterInline, afterInline + 250);
if (!window.includes("let m22_claim_token")) {
  s = s.slice(0, afterInline) +
    "\n  // M2.2-R3: hoisted so catch / early-return cleanup can CAS-release.\n" +
    "  let m22_claim_token: string | null = null;\n" +
    "  let m22_claim_key: string | null = null;" +
    s.slice(afterInline);
  console.log("hoisted near inlineCall");
}

// Remove the *second* pair of let m22_claim_token / let m22_claim_key (inner)
const first = s.indexOf("let m22_claim_token: string | null = null;");
const second = s.indexOf("let m22_claim_token: string | null = null;", first + 1);
if (second < 0) {
  console.log("only one declaration — check if inner was assignment-only");
} else {
  // Remove second let m22_claim_token line and following let m22_claim_key line
  const line1End = s.indexOf("\n", second);
  let line2Start = line1End + 1;
  // skip whitespace
  const keyLine = s.indexOf("let m22_claim_key: string | null = null;", second);
  if (keyLine > second && keyLine < second + 120) {
    const keyLineEnd = s.indexOf("\n", keyLine);
    s = s.slice(0, second) + s.slice(keyLineEnd + 1);
    console.log("removed inner let pair");
  } else {
    console.error("key line not adjacent");
    process.exit(1);
  }
}

// Ensure remaining references assign without redeclare — they should already use m22_claim_token =
fs.writeFileSync(path, s, "utf8");
const left = [...s.matchAll(/let m22_claim_token/g)];
console.log("final let m22_claim_token count", left.length);
console.log("forceRelease(key)", s.includes("forceRelease(key)"));
