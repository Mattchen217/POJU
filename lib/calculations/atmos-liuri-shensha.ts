/**
 * 流日神煞激活：以原局日主（及年支）为锚，判断今日干支是否激活贵人/驿马/文昌。
 * 仅闭集已有项；cueCode 供教练语映射。
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { LiuRiGanzhi } from "@/lib/calculations/liuri";
import {
  TIAN_YI_GUI_REN,
  WEN_CHANG,
  YI_MA_MAP,
} from "@/lib/match/data/shensha";
import type { EarthlyBranch, HeavenlyStem } from "@/lib/match/data/stems-branches";

export type AtmosShenShaCueCode = "ask_help" | "movement" | "deep_work";

export type AtmosActivatedShenSha = {
  id: string;
  han: string;
  cueCode: AtmosShenShaCueCode;
};

const PRIORITY: Array<{
  han: string;
  id: string;
  cueCode: AtmosShenShaCueCode;
  test: (ctx: {
    dayMaster: HeavenlyStem;
    yearBranch: EarthlyBranch;
    dayBranch: EarthlyBranch;
    liuri: LiuRiGanzhi;
  }) => boolean;
}> = [
  {
    han: "天乙贵人",
    id: "shensha_tian_yi_gui_ren",
    cueCode: "ask_help",
    test: ({ dayMaster, liuri }) =>
      (TIAN_YI_GUI_REN[dayMaster] ?? []).includes(liuri.branch as EarthlyBranch),
  },
  {
    han: "驿马",
    id: "shensha_yi_ma",
    cueCode: "movement",
    test: ({ yearBranch, dayBranch, liuri }) => {
      const fromYear = YI_MA_MAP[yearBranch];
      const fromDay = YI_MA_MAP[dayBranch];
      return liuri.branch === fromYear || liuri.branch === fromDay;
    },
  },
  {
    han: "文昌",
    id: "shensha_wen_chang",
    cueCode: "deep_work",
    test: ({ dayMaster, liuri }) => WEN_CHANG[dayMaster] === liuri.branch,
  },
];

export function activateLiuriShenSha(
  structured: ProfileStructured,
  liuri: LiuRiGanzhi,
): AtmosActivatedShenSha[] {
  const dayMaster = (structured.day_master ||
    structured.pillars_detail?.day?.stem ||
    structured.four_pillars.day.charAt(0)) as HeavenlyStem;
  const yearBranch = (structured.pillars_detail?.year?.branch ||
    structured.four_pillars.year.charAt(1)) as EarthlyBranch;
  const dayBranch = (structured.pillars_detail?.day?.branch ||
    structured.four_pillars.day.charAt(1)) as EarthlyBranch;

  const ctx = { dayMaster, yearBranch, dayBranch, liuri };
  const out: AtmosActivatedShenSha[] = [];
  for (const item of PRIORITY) {
    if (item.test(ctx)) {
      out.push({ id: item.id, han: item.han, cueCode: item.cueCode });
    }
  }
  return out;
}
