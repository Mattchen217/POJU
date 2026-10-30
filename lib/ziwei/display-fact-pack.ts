/**
 * ZiweiDisplayFactPack — user/prompt-safe projection of ZiweiFactPack (Phase 2).
 * Raw calculation pack is unchanged. Unmapped tokens are blocked (never traditional fallback).
 */

import {
  toTermLocale,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import { sha256Hex } from "@/lib/sha256";
import type { ZiweiFactPack, ZiweiSihuaHit } from "@/lib/ziwei/fact-pack";
import { ziweiTokenDisposition } from "@/lib/ziwei/token-disposition";

export type ZiweiDisplayAtom =
  | {
      status: "resolved";
      slug: string;
      label: string;
      /** Internal traditional — never render in UI/prompt. */
      _traditional: string;
    }
  | {
      status: "blocked";
      reason: "internal_only" | "unknown" | "forbidden" | "ambiguous";
      reasonCode: string;
      /** Hash of raw token — audit only, not user-facing. */
      tokenHash: string;
    };

export type ZiweiDisplaySihuaHit = {
  mutagen: ZiweiDisplayAtom;
  star: ZiweiDisplayAtom;
  palace: ZiweiDisplayAtom;
};

export type ZiweiDisplayFactPack = {
  locale: TermLocale;
  topicPalace: {
    role: "ming";
    palace: ZiweiDisplayAtom;
    heavenlyStem: string;
    earthlyBranch: string;
    majorStars: ZiweiDisplayAtom[];
    oppositeFieldLabel: ZiweiDisplayAtom;
    oppositePalace: ZiweiDisplayAtom;
    oppositeMajorStars: ZiweiDisplayAtom[];
  };
  sihuaLabel: ZiweiDisplayAtom;
  sihua: ZiweiDisplaySihuaHit[];
  daxian: {
    label: ZiweiDisplayAtom;
    palace: ZiweiDisplayAtom;
    heavenlyStem: string;
    earthlyBranch: string;
    startAge: number;
    endAge: number;
    majorStars: ZiweiDisplayAtom[];
    sihua: ZiweiDisplaySihuaHit[];
    liunian: {
      label: ZiweiDisplayAtom;
      year: number;
      heavenlyStem: string;
      earthlyBranch: string;
      palace: ZiweiDisplayAtom;
      sihua: ZiweiDisplaySihuaHit[];
    };
  };
  mingShen: {
    coreDriverLabel: ZiweiDisplayAtom;
    actionDriverLabel: ZiweiDisplayAtom;
    soul: ZiweiDisplayAtom;
    body: ZiweiDisplayAtom;
    mingBranch: string;
    shenBranch: string;
    actionDomainLabel: ZiweiDisplayAtom;
    shenPalace: ZiweiDisplayAtom;
    elementalConfigLabel: ZiweiDisplayAtom;
    fiveElementsClass: ZiweiDisplayAtom;
  };
  otherChart: null;
  /** Pattern hits stay internal — only count exposed for prompts. */
  patternHitCount: number;
  palaces: Array<{
    name: ZiweiDisplayAtom;
    heavenlyStem: string;
    earthlyBranch: string;
    majorStars: ZiweiDisplayAtom[];
    isBodyPalace: boolean;
    decadalRange: [number, number];
  }>;
  lifeDomainsLabel: ZiweiDisplayAtom;
  audit: {
    resolved: number;
    blocked: number;
  };
};

function tokenHash(raw: string): string {
  // Isomorphic — this module is pulled into client via delivery-schema / preview-client.
  return sha256Hex(new TextEncoder().encode(raw)).slice(0, 12);
}

function resolveZiweiAtom(raw: string, locale: TermLocale): ZiweiDisplayAtom {
  const input = raw.trim();
  if (!input) {
    return {
      status: "blocked",
      reason: "unknown",
      reasonCode: "empty_token",
      tokenHash: tokenHash(""),
    };
  }

  const resolved = resolvePojuTerm(input, { namespace: "ziwei" });
  if (resolved.status === "forbidden") {
    return {
      status: "blocked",
      reason: "forbidden",
      reasonCode: resolved.reason,
      tokenHash: tokenHash(input),
    };
  }
  if (resolved.status === "ambiguous") {
    return {
      status: "blocked",
      reason: "ambiguous",
      reasonCode: "ambiguous_ziwei_surface",
      tokenHash: tokenHash(input),
    };
  }
  if (resolved.status === "resolved") {
    const label = (resolved.term.term[locale] || resolved.term.term.en || resolved.term.term.zh).trim();
    return {
      status: "resolved",
      slug: resolved.term.slug,
      label,
      _traditional: resolved.term.traditional,
    };
  }

  const disposition = ziweiTokenDisposition(input);
  if (disposition.status === "internal_only") {
    return {
      status: "blocked",
      reason: "internal_only",
      reasonCode: disposition.reasonCode,
      tokenHash: tokenHash(input),
    };
  }
  if (disposition.status === "unknown_blocked") {
    return {
      status: "blocked",
      reason: "unknown",
      reasonCode: disposition.reasonCode,
      tokenHash: tokenHash(input),
    };
  }
  // public_glossary without resolvePojuTerm hit — treat as unknown, never leak traditional.
  return {
    status: "blocked",
    reason: "unknown",
    reasonCode: "unresolved_public_glossary",
    tokenHash: tokenHash(input),
  };
}

function mapStars(stars: readonly string[], locale: TermLocale): ZiweiDisplayAtom[] {
  return stars.map((s) => resolveZiweiAtom(s, locale));
}

function mapSihua(hits: readonly ZiweiSihuaHit[], locale: TermLocale): ZiweiDisplaySihuaHit[] {
  return hits.map((h) => ({
    mutagen: resolveZiweiAtom(h.mutagen, locale),
    star: resolveZiweiAtom(h.star, locale),
    palace: resolveZiweiAtom(h.palace, locale),
  }));
}

function tally(atoms: ZiweiDisplayAtom[]): { resolved: number; blocked: number } {
  let resolved = 0;
  let blocked = 0;
  for (const a of atoms) {
    if (a.status === "resolved") resolved += 1;
    else blocked += 1;
  }
  return { resolved, blocked };
}

function collectAtoms(pack: ZiweiDisplayFactPack): ZiweiDisplayAtom[] {
  const out: ZiweiDisplayAtom[] = [];
  const push = (a: ZiweiDisplayAtom | ZiweiDisplayAtom[]) => {
    if (Array.isArray(a)) out.push(...a);
    else out.push(a);
  };
  push(pack.topicPalace.palace);
  push(pack.topicPalace.majorStars);
  push(pack.topicPalace.oppositeFieldLabel);
  push(pack.topicPalace.oppositePalace);
  push(pack.topicPalace.oppositeMajorStars);
  push(pack.sihuaLabel);
  for (const h of pack.sihua) {
    push(h.mutagen);
    push(h.star);
    push(h.palace);
  }
  push(pack.daxian.label);
  push(pack.daxian.palace);
  push(pack.daxian.majorStars);
  for (const h of pack.daxian.sihua) {
    push(h.mutagen);
    push(h.star);
    push(h.palace);
  }
  push(pack.daxian.liunian.label);
  push(pack.daxian.liunian.palace);
  for (const h of pack.daxian.liunian.sihua) {
    push(h.mutagen);
    push(h.star);
    push(h.palace);
  }
  push(pack.mingShen.coreDriverLabel);
  push(pack.mingShen.actionDriverLabel);
  push(pack.mingShen.soul);
  push(pack.mingShen.body);
  push(pack.mingShen.actionDomainLabel);
  push(pack.mingShen.shenPalace);
  push(pack.mingShen.elementalConfigLabel);
  push(pack.mingShen.fiveElementsClass);
  push(pack.lifeDomainsLabel);
  for (const p of pack.palaces) {
    push(p.name);
    push(p.majorStars);
  }
  return out;
}

/** Soft label or empty — never traditional / raw. */
export function displayAtomLabel(atom: ZiweiDisplayAtom): string {
  return atom.status === "resolved" ? atom.label : "";
}

export function joinDisplayLabels(atoms: readonly ZiweiDisplayAtom[], sep = "、"): string {
  return atoms
    .map(displayAtomLabel)
    .filter(Boolean)
    .join(sep);
}

/**
 * Build display projection. Stems/branches stay as structural calendrical codes
 * (handled by existing 干支 closed set elsewhere); Han palace/star/mutagen go through resolver.
 */
export function buildZiweiDisplayFactPack(
  pack: ZiweiFactPack,
  localeInput: string = "zh",
): ZiweiDisplayFactPack {
  const locale = toTermLocale(localeInput);
  const display: ZiweiDisplayFactPack = {
    locale,
    topicPalace: {
      role: "ming",
      palace: resolveZiweiAtom(pack.topicPalace.palace, locale),
      heavenlyStem: pack.topicPalace.heavenlyStem,
      earthlyBranch: pack.topicPalace.earthlyBranch,
      majorStars: mapStars(pack.topicPalace.majorStars, locale),
      oppositeFieldLabel: resolveZiweiAtom("对宫", locale),
      oppositePalace: resolveZiweiAtom(pack.topicPalace.oppositePalace, locale),
      oppositeMajorStars: mapStars(pack.topicPalace.oppositeMajorStars, locale),
    },
    sihuaLabel: resolveZiweiAtom("四化", locale),
    sihua: mapSihua(pack.sihua, locale),
    daxian: {
      label: resolveZiweiAtom("大限", locale),
      palace: resolveZiweiAtom(pack.daxian.palace, locale),
      heavenlyStem: pack.daxian.heavenlyStem,
      earthlyBranch: pack.daxian.earthlyBranch,
      startAge: pack.daxian.startAge,
      endAge: pack.daxian.endAge,
      majorStars: mapStars(pack.daxian.majorStars, locale),
      sihua: mapSihua(pack.daxian.sihua, locale),
      liunian: {
        label: resolveZiweiAtom("流年", locale),
        year: pack.daxian.liunian.year,
        heavenlyStem: pack.daxian.liunian.heavenlyStem,
        earthlyBranch: pack.daxian.liunian.earthlyBranch,
        palace: resolveZiweiAtom(pack.daxian.liunian.palace, locale),
        sihua: mapSihua(pack.daxian.liunian.sihua, locale),
      },
    },
    mingShen: {
      coreDriverLabel: resolveZiweiAtom("命主", locale),
      actionDriverLabel: resolveZiweiAtom("身主", locale),
      soul: resolveZiweiAtom(pack.mingShen.soul, locale),
      body: resolveZiweiAtom(pack.mingShen.body, locale),
      mingBranch: pack.mingShen.mingBranch,
      shenBranch: pack.mingShen.shenBranch,
      actionDomainLabel: resolveZiweiAtom("身宫", locale),
      shenPalace: resolveZiweiAtom(pack.mingShen.shenPalace, locale),
      elementalConfigLabel: resolveZiweiAtom("五行局", locale),
      fiveElementsClass: resolveZiweiAtom(pack.mingShen.fiveElementsClass, locale),
    },
    otherChart: null,
    patternHitCount: pack.patternHits.length,
    palaces: pack.palaces.map((p) => ({
      name: resolveZiweiAtom(p.name, locale),
      heavenlyStem: p.heavenlyStem,
      earthlyBranch: p.earthlyBranch,
      majorStars: mapStars(p.majorStars, locale),
      isBodyPalace: p.isBodyPalace,
      decadalRange: p.decadalRange,
    })),
    lifeDomainsLabel: resolveZiweiAtom("十二宫", locale),
    audit: { resolved: 0, blocked: 0 },
  };
  display.audit = tally(collectAtoms(display));
  return display;
}

/** Traditional surfaces that must not appear in user-facing display JSON (except `_traditional`). */
export function collectZiweiTraditionalSuspects(rawPack: ZiweiFactPack): string[] {
  const suspects = new Set<string>();
  for (const p of rawPack.palaces) {
    suspects.add(p.name);
    for (const s of p.majorStars) suspects.add(s);
  }
  for (const s of rawPack.topicPalace.majorStars) suspects.add(s);
  for (const s of rawPack.topicPalace.oppositeMajorStars) suspects.add(s);
  for (const h of [...rawPack.sihua, ...rawPack.daxian.sihua, ...rawPack.daxian.liunian.sihua]) {
    suspects.add(h.mutagen);
    suspects.add(h.star);
    suspects.add(h.palace);
  }
  suspects.add(rawPack.daxian.palace);
  suspects.add(rawPack.daxian.liunian.palace);
  suspects.add(rawPack.mingShen.soul);
  suspects.add(rawPack.mingShen.body);
  suspects.add(rawPack.mingShen.shenPalace);
  suspects.add(rawPack.mingShen.fiveElementsClass);
  for (const hit of rawPack.patternHits) suspects.add(hit.name);
  return [...suspects].filter((t) => t.trim().length > 0);
}

/** True if user-facing display still embeds traditional ziwei tokens as whole string values. */
export function ziweiDisplayContainsTraditionalLeak(
  display: ZiweiDisplayFactPack,
  rawPack: ZiweiFactPack,
): string[] {
  // Strip internal traditional mirrors, then require exact JSON string match (not substring —
  // soft labels like 主动权转化 contain mutagen 权).
  const scrubbed = JSON.stringify(display).replace(/"_traditional":"[^"]*"/g, '"_traditional":""');
  const leaks: string[] = [];
  for (const token of collectZiweiTraditionalSuspects(rawPack)) {
    if (!/[\u4e00-\u9fff]/.test(token)) continue;
    if (scrubbed.includes(`"${token}"`)) {
      leaks.push(token);
    }
  }
  return [...new Set(leaks)];
}
