/**
 * Atmos engine snapshot — pure local facts for LLM / UI (no narrative).
 */

import { z } from "zod";

import { relateLiuriToYongShen } from "@/lib/calculations/atmos-day-element";
import { assessAtmosEnergy } from "@/lib/calculations/atmos-energy-weighting";
import { activateLiuriShenSha } from "@/lib/calculations/atmos-liuri-shensha";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  computeAtmosDynamicRelations,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import { resolveLuckCycles } from "@/lib/calculations/resolve-luck-cycles";

export const YONGSHEN_SOURCE = "heuristic_wuxing_scores" as const;

const GanzhiSchema = z.object({
  stem: z.string().min(1),
  branch: z.string().min(1),
  ganzhi: z.string().min(2),
});

const RelationLabelSchema = z.object({
  id: z.string(),
  han: z.string(),
  kind: z.string(),
  source: z.string(),
  positions: z.array(z.string()),
  palaces: z.array(z.string()),
  polarity: z.enum(["green", "red", "gold"]),
});

export const AtmosEngineSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  asOf: z.object({
    iso: z.string(),
    timezone: z.string(),
    localDate: z.string(),
    localTime: z.string(),
    baziDayDate: z.string(),
    dayBoundaryPolicy: z.literal("zi_2300_local"),
  }),
  cycles: z.object({
    dayun: GanzhiSchema.nullable(),
    dayunIndex: z.number().int().nullable(),
    liunian: GanzhiSchema,
    liuyue: GanzhiSchema,
    liuri: GanzhiSchema,
  }),
  dayMaster: z.object({
    stem: z.string(),
    strength: z.enum(["strong", "balanced", "weak"]),
    yong_shen: z.string(),
    xi_shen: z.array(z.string()),
    ji_shen: z.array(z.string()),
  }),
  relationToDayMaster: z.object({
    tenGod: z.string(),
    dayStemElement: z.string(),
    dayBranchElement: z.string(),
    dayElementHelp: z.enum(["helps", "drains", "mixed", "neutral"]),
    matchedXi: z.array(z.string()),
    matchedJi: z.array(z.string()),
  }),
  interactions: z.array(RelationLabelSchema),
  energy: z.object({
    climateTone: z.enum(["pressured", "supportive", "mixed", "neutral"]),
    dayWeather: z.enum(["ease", "friction", "volatile", "neutral"]),
    overrideRule: z.object({
      blockSprintNarrative: z.boolean(),
      reasonCode: z.enum(["climate_pressured", "none"]),
    }),
    focusSignals: z.array(
      z.object({
        cueCode: z.string(),
        relationId: z.string(),
        weight: z.number(),
        polarity: z.enum(["green", "red", "gold"]),
        source: z.string(),
      }),
    ),
    climateScore: z.number(),
    dayScore: z.number(),
  }),
  activatedShenSha: z.array(
    z.object({
      id: z.string(),
      han: z.string(),
      cueCode: z.enum(["ask_help", "movement", "deep_work"]),
    }),
  ),
  yongshenSource: z.literal(YONGSHEN_SOURCE),
});

export type AtmosEngineSnapshot = z.infer<typeof AtmosEngineSnapshotSchema>;

export type BuildAtmosEngineSnapshotInput = {
  structured: ProfileStructured;
  date?: Date;
  timezone?: string;
};

/**
 * Build a deterministic Atmos engine snapshot for a profile at a local wall-clock instant.
 */
export function buildAtmosEngineSnapshot(
  input: BuildAtmosEngineSnapshotInput,
): AtmosEngineSnapshot {
  const date = input.date ?? new Date();
  const timezone = input.timezone ?? "UTC";
  const structured = input.structured;

  const cycles = resolveLuckCycles(structured, date, timezone);
  const interactions: RelationLabel[] = computeAtmosDynamicRelations(structured, cycles);
  const relationToDayMaster = relateLiuriToYongShen(structured, cycles.liuri);
  const energy = assessAtmosEnergy(interactions, relationToDayMaster.dayElementHelp);
  const activatedShenSha = activateLiuriShenSha(structured, cycles.liuri);

  const snapshot: AtmosEngineSnapshot = {
    schemaVersion: 1,
    asOf: { ...cycles.asOf },
    cycles: {
      dayun: cycles.dayun,
      dayunIndex: cycles.dayunIndex,
      liunian: cycles.liunian,
      liuyue: cycles.liuyue,
      liuri: cycles.liuri,
    },
    dayMaster: {
      stem: structured.day_master || structured.four_pillars.day.charAt(0),
      strength: structured.strength,
      yong_shen: structured.yong_shen,
      xi_shen: [...(structured.xi_shen ?? [])],
      ji_shen: [...(structured.ji_shen ?? [])],
    },
    relationToDayMaster: {
      tenGod: relationToDayMaster.tenGod,
      dayStemElement: relationToDayMaster.dayStemElement,
      dayBranchElement: relationToDayMaster.dayBranchElement,
      dayElementHelp: relationToDayMaster.dayElementHelp,
      matchedXi: relationToDayMaster.matchedXi,
      matchedJi: relationToDayMaster.matchedJi,
    },
    interactions,
    energy,
    activatedShenSha,
    yongshenSource: YONGSHEN_SOURCE,
  };

  return AtmosEngineSnapshotSchema.parse(snapshot);
}

/** Stable JSON string for equality tests (sorted keys via JSON.stringify insertion order on built object). */
export function serializeAtmosSnapshot(snapshot: AtmosEngineSnapshot): string {
  return JSON.stringify(snapshot);
}
