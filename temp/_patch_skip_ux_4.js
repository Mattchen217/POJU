const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// ---------- agent.ts: pass dyadPath into openingReplyInput ----------
{
  const p = "lib/poju/agent.ts";
  let s = read(p);
  const old = `  const openingReplyInput = {
    locale: sessionOutputLocale,
    agent: agent_v2,
    llmResponse: finalContent,
    understandingGenerationFailed,
    phaseAfter,
    envelopeFailedStayedOpening,
  };`;
  const neu = `  const openingReplyInput = {
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
  };`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    write(p, s);
  } else if (s.includes("dyadPath:")) {
    console.log("agent already has dyadPath");
  } else {
    console.log("WARN: openingReplyInput block not found exact");
    // soft match
    const i = s.indexOf("const openingReplyInput = {");
    console.log(s.slice(i, i + 280));
  }
}

// ---------- ChatUI: clearDyadGateUi + chip lock ----------
{
  const p = "components/poju/POJUChatUI.tsx";
  let s = read(p);

  if (!s.includes("clearDyadGateUi")) {
    s = s.replace(
      'import { consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";',
      'import { clearDyadGateUi, consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";'
    );
  }

  // Import dyadGateChipsLocked + matchDyadGateAction already imported via matchDyadGateAction
  if (!s.includes("dyadGateChipsLocked")) {
    // find existing dyad-compat import block
    const importMatch = s.match(/import \{\n([\s\S]*?)\} from "@\/lib\/poju\/dyad-compat";/);
    if (importMatch && !importMatch[1].includes("dyadGateChipsLocked")) {
      s = s.replace(
        importMatch[0],
        importMatch[0].replace(
          "} from \"@/lib/poju/dyad-compat\";",
          "  dyadGateChipsLocked,\n} from \"@/lib/poju/dyad-compat\";"
        )
      );
      // if dyadSkipPatch is imported, ensure dyadGateChipsLocked is there
      if (!s.includes("dyadGateChipsLocked")) {
        s = s.replace(
          "dyadSkipPatch,",
          "dyadSkipPatch,\n  dyadGateChipsLocked,"
        );
      }
    }
  }

  // handleDyadSkip: use clearDyadGateUi instead of consumeReplyOptionsOnSession
  s = s.replace(
    `      const next = consumeReplyOptionsOnSession({
        ...session,
        ...dyadSkipPatch(),
      });`,
    `      const next = clearDyadGateUi({
        ...session,
        ...dyadSkipPatch(),
      });`
  );

  // handlePartnerBirthSubmit collect path
  s = s.replace(
    `      const next = consumeReplyOptionsOnSession({
        ...session,
        ...dyadCollectedPatch({
          partner_profile_id: created.profile_id,
          summary,
          matrix_pack,
        }),
      });`,
    `      const next = clearDyadGateUi({
        ...session,
        ...dyadCollectedPatch({
          partner_profile_id: created.profile_id,
          summary,
          matrix_pack,
        }),
      });`
  );

  // Harden activeComposerOptions: never re-offer dyad chips after lock
  if (!s.includes("dyadGateChipsLocked(session.dyad_offer_status)")) {
    const needle = `    const cleaned = last.options
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0 && s !== "[object Object]");
    return cleaned.length >= 2 ? cleaned.slice(0, 3) : undefined;`;
    const replacement = `    const cleaned = last.options
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0 && s !== "[object Object]");
    // Skip-path UX (#12): after skip/collect, never re-surface collect/skip chips.
    const locked = dyadGateChipsLocked(session.dyad_offer_status);
    const withoutDyad = locked
      ? cleaned.filter((o) => matchDyadGateAction(o, sessionLang) == null)
      : cleaned;
    return withoutDyad.length >= 2 ? withoutDyad.slice(0, 3) : undefined;`;
    if (s.includes(needle)) {
      s = s.replace(needle, replacement);
    } else {
      console.log("WARN: activeComposerOptions cleaned block not exact");
    }
  }

  // Ensure useMemo deps include session.dyad_offer_status
  if (!s.includes("session.dyad_offer_status")) {
    // add to activeComposerOptions deps
    s = s.replace(
      `  }, [
    visibleMessages,
    understandingGatePending,
    deliveryConfirmPending,
    composerLocked,
    sending,
    sessionLang,`,
      `  }, [
    visibleMessages,
    understandingGatePending,
    deliveryConfirmPending,
    composerLocked,
    sending,
    sessionLang,
    session.dyad_offer_status,`
    );
  }

  write(p, s);
}

console.log("part4 agent+chatui done");
