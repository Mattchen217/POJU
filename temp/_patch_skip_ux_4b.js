const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// agent.ts
{
  const p = "lib/poju/agent.ts";
  let s = read(p);
  if (!s.includes("dyadPath:")) {
    const re = /const openingReplyInput = \{\r?\n\s*locale: sessionOutputLocale,\r?\n\s*agent: agent_v2,\r?\n\s*llmResponse: finalContent,\r?\n\s*understandingGenerationFailed,\r?\n\s*phaseAfter,\r?\n\s*envelopeFailedStayedOpening,\r?\n\s*\};/;
    if (!re.test(s)) {
      console.log("agent regex fail");
      const i = s.indexOf("const openingReplyInput");
      console.log(JSON.stringify(s.slice(i, i+220)));
    } else {
      s = s.replace(re, `const openingReplyInput = {
    locale: sessionOutputLocale,
    agent: agent_v2,
    llmResponse: finalContent,
    understandingGenerationFailed,
    phaseAfter,
    envelopeFailedStayedOpening,
    dyadPath: {
      partner_bazi: workingSession.partner_bazi ?? null,
      pivot_chart_path: workingSession.pivot_chart_path ?? null,
      dyad_offer_status: workingSession.dyad_offer_status ?? null,
    },
  };`);
      write(p, s);
    }
  } else console.log("agent ok already");
}

// ChatUI
{
  const p = "components/poju/POJUChatUI.tsx";
  let s = read(p);
  console.log("has clearDyadGateUi import", s.includes("clearDyadGateUi"));
  console.log("has dyadGateChipsLocked", s.includes("dyadGateChipsLocked"));
  console.log("skip uses clear", /clearDyadGateUi\(\{[\s\S]*?dyadSkipPatch/.test(s));
  console.log("skip uses consume", /consumeReplyOptionsOnSession\(\{[\s\S]*?dyadSkipPatch/.test(s));

  // Fix skip handler
  s = s.replace(
    /const next = consumeReplyOptionsOnSession\(\{\r?\n\s*\.\.\.session,\r?\n\s*\.\.\.dyadSkipPatch\(\),\r?\n\s*\}\);/,
    `const next = clearDyadGateUi({
        ...session,
        ...dyadSkipPatch(),
      });`
  );
  s = s.replace(
    /const next = consumeReplyOptionsOnSession\(\{\r?\n\s*\.\.\.session,\r?\n\s*\.\.\.dyadCollectedPatch\(\{/,
    `const next = clearDyadGateUi({
        ...session,
        ...dyadCollectedPatch({`
  );

  // Fix cleaned options block with flexible whitespace
  if (!s.includes("dyadGateChipsLocked(session.dyad_offer_status)")) {
    const re2 = /const cleaned = last\.options\r?\n\s*\.map\(\(s\) => \(typeof s === "string" \? s\.trim\(\) : ""\)\)\r?\n\s*\.filter\(\(s\) => s\.length > 0 && s !== "\[object Object\]"\);\r?\n\s*return cleaned\.length >= 2 \? cleaned\.slice\(0, 3\) : undefined;/;
    if (!re2.test(s)) {
      console.log("cleaned regex fail");
      const i = s.indexOf("const cleaned = last.options");
      console.log(JSON.stringify(s.slice(i, i+280)));
    } else {
      s = s.replace(re2, `const cleaned = last.options
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0 && s !== "[object Object]");
    // Skip-path UX (#12): after skip/collect, never re-surface collect/skip chips.
    const locked = dyadGateChipsLocked(session.dyad_offer_status);
    const withoutDyad = locked
      ? cleaned.filter((o) => matchDyadGateAction(o, sessionLang) == null)
      : cleaned;
    return withoutDyad.length >= 2 ? withoutDyad.slice(0, 3) : undefined;`);
    }
  }

  // deps
  if (!s.includes("session.dyad_offer_status")) {
    const re3 = /(understandingGatePending,\r?\n\s*deliveryConfirmPending,\r?\n\s*composerLocked,\r?\n\s*sending,\r?\n\s*sessionLang,)/;
    if (re3.test(s)) {
      s = s.replace(re3, `$1\n    session.dyad_offer_status,`);
    } else console.log("deps regex fail");
  }

  // ensure imports
  if (!s.includes("clearDyadGateUi")) {
    s = s.replace(
      'import { consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";',
      'import { clearDyadGateUi, consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";'
    );
  }
  if (!s.includes("dyadGateChipsLocked")) {
    if (s.includes("dyadSkipPatch,")) {
      s = s.replace("dyadSkipPatch,", "dyadSkipPatch,\n  dyadGateChipsLocked,");
    }
  }

  write(p, s);
  // re-check
  const t = read(p);
  console.log("AFTER clear import", t.includes("clearDyadGateUi"));
  console.log("AFTER skip clear", /clearDyadGateUi\(\{[\s\S]*?dyadSkipPatch/.test(t));
  console.log("AFTER chips locked", t.includes("dyadGateChipsLocked(session.dyad_offer_status)"));
  console.log("AFTER collect clear", /clearDyadGateUi\(\{[\s\S]*?dyadCollectedPatch/.test(t));
}
