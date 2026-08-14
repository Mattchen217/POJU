/**
 * Chinese UI-preview fixture — thicker P1 copy + sample nested evidence.
 * Live fill must still come from the model; this is for local slot design only.
 */

import type { DeliverySegmentKey } from "../delivery-schema";
import type { DeliveryPageData, DeliveryReportPagesV1 } from "./types";
import { DELIVERY_PAGE_SCHEMA_VERSION } from "./types";
import { pageSchemaToArgumentBodies } from "./render";

export const DELIVERY_PAGE_SCHEMA_MOCK_ZH: DeliveryReportPagesV1 = {
  version: DELIVERY_PAGE_SCHEMA_VERSION,
  unlocked_through_wave: "done",
  pages: {
    direct_answer: {
      page: "direct_answer",
      core_judgment:
        "现在不宜硬冲海外一线，也不宜直接退居二线。优先走中间态：海外业务改远程操盘 + 授权副手落地，先护健康与现金流。",
      primary: {
        role: "primary",
        name: "半年过渡 · 远程操盘 + 授权副手落地",
        core_logic:
          "你真正缺的不是再拼一次体力，而是把「结果责任」和「一线冲锋」拆开。主路的形态是：你坐镇后方，盯供应链节点、交付质量与关键风险闸门；把可授权的冲锋交给可培养副手落地。老板眼里你仍是「能把结果压出来的人」，但不再用血压和睡眠给无限范围买单。\n\n落地时，先把模糊催促改成对方必须二选一的书面取舍——保留 A 就推迟 B，或保住 B 就砍掉 A——让边界可见、可谈、可记。半年窗口里，目标不是再证明你能扛，而是证明「远程操盘 + 授权」同样能出货。成功时你会看到：赞助仍找你要结果，但一线火情不再默认落到你身上；睡眠与血压从滑坡变为可守住的底板。",
        why: "你仍握有交付质量与供应链控本的话语权；现在裸退会烧掉跑道却没有落点。",
        when: "老板仍看重结果、手下有可培养副手、睡眠与血压开始回升时优先走这条。",
        strategic_goal: "攻坚破局，保住核心收入与话语权",
        leverage_chip: "供应链控本数据（暗牌转明牌）",
        dims: { body: "mid", mind: "high", field: "mid" },
      },
      backup: {
        role: "backup",
        name: "内部转岗 / 收缩业务范围",
        core_logic:
          "当远程操盘谈不拢，或身体连续触红线时，主路暂停，切到体面止损轨：主动收缩业务边界，或转任供应链高级顾问一类「有结果话语权、无一线冲锋债」的位置。先停掉英雄式接锅——不再靠加班证明忠诚——再同步攒战绩夹与两个月现金缓冲，让下一站有落点而不是裸退。\n\n这条路不是认输叙事，而是把「不可替代」从体力证明改成资产与记录证明。成功时你会看到：一线高压责任被剥离，血压与睡眠进入恢复区；你仍带着可出示的控本/交付证据离开或内转，而不是在沉默里被耗干。触发后两周内完成责任交接清单与缓冲进度复核，避免又滑回硬刚。",
        why: "赞助沉默或身体扛不住时，尊严与跑道比再证明一次更重要。",
        when: "谈判失败，或连续 3 天血压 > 140，或书面取舍发出后 10 天无回应。",
        strategic_goal: "彻底止损，剥离一线高压责任",
        leverage_chip: "战绩夹 + 两个月现金缓冲目标",
        dims: { body: "low", mind: "mid", field: "low" },
      },
      evidence: [],
    },
    foundation: {
      page: "foundation",
      surface_vs_essence: {
        surface: "表面像是海外开拓 vs 退居二线的二选一，外加失眠、血压和老板催结果。",
        essence: "本质是结果权与一线冲锋绑死，需养状态下却被高压任务拖着证明，边界从未被写成可选择的取舍。",
      },
      dashboard: [
        { key: "body", label: "身体负荷", score: 42, note: "来自 pack" },
        { key: "mind", label: "心智张力", score: 68, note: "来自 pack" },
        { key: "field", label: "场域摩擦", score: 55, note: "来自 pack" },
      ],
      why_cards: [
        {
          title: "结构",
          body: "你对结果负责，却不拥有释放工作的闸门；每次胜利只是把门槛再抬高一格。",
        },
        {
          title: "阻力",
          body: "休息从不复利：Slack 深夜一响，蓄力就被清空。",
        },
        {
          title: "信号",
          body: "身体指标落后于心智过载——卡住的是系统，不是某一场会。因此主路保留结果权做远程操盘，辅路则冻结英雄式接锅、先攒证明与缓冲。",
        },
      ],
      evidence: [],
    },
    science_action: {
      page: "science_action",
      opening: "先用范围数学说话，不要用情绪开战。",
      primary_toolkit: {
        role: "primary",
        title: "半年过渡·远程操盘 + 授权副手落地",
        angles: [
          {
            name: "边界谈判",
            strategy: "把模糊催促变成赞助必须勾选的两条取舍，用书面二选一逼出边界。",
            exact_script:
              "老板，这周带宽只够扛一件：周五前我能把 A 交齐，前提是本周拿掉 B；或者保留 B，把 A 整体挪到下周三。请直接回「选A」或「选B」，我按你的选择改日历。",
            means: [
              "打开本周日历，标出 Top3 承诺各自占用的小时数，删掉无法并行的项",
              "发出只含两个选项的取舍邮件/微信，主题写清「二选一·本周范围」",
              "同周约 20 分钟决策会；会前把两条选项贴进议程，不开第三选项",
            ],
            hard_metrics: [
              "赞助在 48h 内书面回复「选A/选B」之一",
              "会后你的日历只保留被选中的那一条主交付",
            ],
          },
          {
            name: "授权与副手",
            strategy: "结果权留在你手里，一线冲锋交给可培养副手，状态会从你日历迁出。",
            exact_script:
              "我想把一线冲锋交给你：从下周一起，每日站会由你主持，我只看结果与风险闸门。第一周你先带两场，周五我们复盘一次缺口；你接得住，我就把状态会从我日历永久挪走。",
            means: [
              "点名一位副手，书面写清「他/她接什么、你留什么」两行职责边界",
              "把每日/每周状态会从你的日历改到副手日历，你改成旁听或会后摘要",
              "设周五 30 分钟复盘：只看交付、风险、需你拍板的三件事",
            ],
            hard_metrics: [
              "连续 7 天你亲自扛的一线火情 ≤2",
              "状态会主人从你换成副手，且你未再默认主持",
            ],
          },
          {
            name: "节奏与身体护栏",
            strategy: "守住睡眠与血压底板，远程操盘才可持续；护栏写进可见规则。",
            exact_script:
              "我这边固定规则：工作日 22:00 后不再回 Slack/微信工作消息，紧急事项请第二天 9:00 前发我。硬谈或关键会我会提前排在午前；连续熬夜后我不排硬谈判。请按这个窗口找我。",
            means: [
              "在团队频道置顶「22:00 后不回工作消息」规则，并关掉夜间推送",
              "硬谈前安排一次 10–15 分钟短走，再进会议室或开视频",
              "连续三晚睡眠不足时，主动把次日硬谈改期到午前窗口",
            ],
            hard_metrics: [
              "连续 7 天 22:00 后零工作 Slack/微信回复",
              "硬谈全部落在午前，且未在熬夜后强开谈判",
            ],
          },
        ],
      },
      backup_toolkit: {
        role: "backup",
        title: "内部转岗 / 收缩业务范围",
        angles: [
          {
            name: "战绩打包",
            strategy: "不声张地整理可带走的证明，把「不可替代」从体力改成资产。",
            exact_script:
              "我在整理一份近 12 个月的交付与控本摘要，方便后续交接或内转评估。需要你确认两件可见成果的日期与口径，周五前回我一句「确认」即可，不必开会。",
            means: [
              "导出近 12 个月战绩夹：交付、控本、风险闸门三类各 2–3 条",
              "给两件赞助可见成果打日期戳与一句话口径，存进只读文件夹",
              "请赞助用一句话书面确认口径，截图归档，不做大范围转发",
            ],
            hard_metrics: [
              "战绩夹可打开且含日期戳成果 ≥2",
              "赞助书面确认口径至少 1 条",
            ],
          },
          {
            name: "暖联系人",
            strategy: "用暖关系护体面跑道，而不是恐慌投递或公开求职。",
            exact_script:
              "最近在评估内部转岗/顾问方向，想请你帮我看一眼：以我过去控本与交付记录，更适合哪类头衔落点？不用帮转推，回我你的直觉就好，谢谢。",
            means: [
              "列出 3 个暖联系人，本周只更新其中 1 个（信息交换，不求职硬推）",
              "起草一个软着陆头衔选项（如供应链高级顾问）与一句价值主张",
              "把话术改成对方方言/习惯后再发，发完只记回复，不连环催",
            ],
            hard_metrics: [
              "本周完成 ≥1 次暖联系人更新并有回复",
              "软着陆头衔选项写成可口述的一句话",
            ],
          },
          {
            name: "现金缓冲",
            strategy: "公开动作前先钉死缓冲日，避免裸退或情绪性跳槽。",
            exact_script:
              "我给自己设了缓冲目标日：账户可覆盖两个月 burn 之前，不做公开离职/转岗宣布。本周只冻结新的英雄式 ownership，先把缓冲进度钉在日历上。",
            means: [
              "算出两个月 burn 数字，在日历钉一个「缓冲达标」检查日",
              "冻结一切新的英雄式 ownership；已接的列清单并标可移交项",
              "每周五复核缓冲进度：达标前不发公开离职/转岗消息",
            ],
            hard_metrics: [
              "缓冲目标日写进日历且每周有复核记录",
              "缓冲 ≥ 2 个月 burn 前零公开宣布",
            ],
          },
        ],
      },
      alert: "这里只要可改写开口，不要写完整律师/HR 剧本。",
      evidence: [],
    },
    metaphysics_action: {
      page: "metaphysics_action",
      primary_track: {
        role: "primary",
        title: "主路的东方借力",
        dimensions: [
          {
            name: "开口场域",
            strategy: "开口前借场域支撑，避免在耗尽房间里谈硬条件。",
            means: [
              "在你已用于深工的亮桌角谈取舍",
              "短走后再开口，不要接完深夜 Slack 立刻谈",
            ],
          hard_metrics: [],
          },
          {
            name: "时段窗口",
            strategy: "用更清的午前窗口；跳过耗尽后的夜晚硬谈。",
            means: ["优先午前开口", "连续三晚熬夜后不排硬谈判"],
          hard_metrics: [],
          },
          {
            name: "赞助顺风",
            strategy: "把既有赞助温度当场域顺风，不当情绪燃料。",
            means: ["开口先对齐对方已信的结果指标"],
          hard_metrics: [],
          },
        ],
      },
      backup_track: {
        role: "backup",
        title: "辅路的东方掩护",
        dimensions: [
          {
            name: "降低场域纠缠",
            strategy: "准备退出时减少场域纠缠。",
            means: ["固定时刻后设备暗屏", "避开会重开旧战的庆功场"],
          hard_metrics: [],
          },
          {
            name: "先恢复再公开",
            strategy: "任何公开动作前先恢复身体信号。",
            means: ["头衔谈话前先守 7 晚睡眠底板"],
          hard_metrics: [],
          },
        ],
      },
      leverage: ["把既有赞助温度当场域顺风，不当情绪燃料"],
      avoid: ["整页不要收成穿衣/颜色口诀"],
      field_matrix: [
        { label: "开口窗口", value: "午前 · 清桌" },
        { label: "恢复", value: "步行 + 暗夜" },
      ],
      evidence: [],
    },
    thirty_day: {
      page: "thirty_day",
      weeks: [
        {
          week: 1,
          focus: "取舍邮件 + 睡眠底板",
          actions: ["发出二选一邮件", "22:00 后零 Slack"],
          source_refs: ["p3.primary.steps.0"],
        },
        {
          week: 2,
          focus: "决策会",
          actions: ["开 20 分钟赞助会", "记录回复时延"],
          source_refs: ["p3.primary.steps.2"],
        },
        {
          week: 3,
          focus: "稳住或武装辅路",
          actions: ["触红灯则开始导出战绩"],
          source_refs: ["p3.backup.steps.0"],
        },
        {
          week: 4,
          focus: "复核切换条件",
          actions: ["检查沉默 > 10 天规则"],
          source_refs: ["p1.backup.when"],
        },
      ],
      day7_checklist: ["取舍邮件已发", "赞助回复已记", "三晚睡眠底板恢复"],
      evidence: [],
    },
    risk_guard: {
      page: "risk_guard",
      red_lights: ["书面取舍后赞助沉默 > 10 天", "深夜 Slack 连续 3 晚回流"],
      traps: ["用情绪再辩一轮，却不发二选一框架"],
      switch_to_backup: "两盏红灯齐亮：冻结重谈，跑两周安静退出准备。",
      protection_rules: ["没有书面取舍不接新英雄式 ownership", "紧急周也守睡眠底板"],
      boundary_script: "这周我能扛 A 或 B，不能两个都扛。你定一个。",
      evidence: [],
    },
    signals_close: {
      page: "signals_close",
      identity_before: "吸收催促的人",
      identity_after: "逼出清楚选择的人",
      quote: "清楚，是你欠未来自己的一份体面。",
      immediate_action: "今晚：起草二选一句，放进草稿，明早再发。",
      day7_micro_actions: [
        "发出二选一取舍邮件",
        "记录一次赞助回复时延",
        "守住三晚睡眠底板",
      ],
      evidence: [],
    },
  },
};

/** Sample nested evidence aligned to pageSchemaToArgumentBodies order. */
export const DELIVERY_PAGE_SCHEMA_MOCK_EVIDENCE_ZH: Record<
  DeliverySegmentKey,
  string[]
> = {
  direct_answer: [
    "判定层：在需养结构下硬冲一线会放大身体债；直接退居二线又丢掉你仅有的结果话语权。中间态是结构允许的最小代价路径。",
    "主方案依据：你在这种需养状态里，本来就容易被框架和淬炼带来的高压任务拖住；潮涌供源若再绑死一线冲锋，血压与睡眠会继续给范围买单。把结果权留在后方、冲锋授权出去，才对得上这盘能量。",
    "辅方案依据：当赞助沉默或身体连续触线，继续证明只会消耗昭德式的场面分。退路要体面：收缩责任边界，用战绩夹换下一站，而不是再开硬刚。",
  ],
  foundation: [
    "表象/本质对照：多维里身体负荷滞后、心智过载先行——所以「卡」不是某一场会，是系统闸门错位。",
    "结构维：结果权与释放闸门分离，是这盘特有的卡住方式。",
    "阻力维：深夜打断使休息无法复利，与仪表盘身体分相互印证。",
    "信号维：身体指标落后于心智，是该先改结构而非再加鸡血的信号。",
  ],
  science_action: [
    "开口短句只服务主路取舍，不替代合同。",
    "主·边界谈判：二选一邮件把催促变成可勾选边界。",
    "主·授权副手：结果权留后方，一线冲锋授权出去。",
    "主·节奏护栏：睡眠底板是远程操盘可持续的条件。",
    "辅·战绩打包：切辅时的可带走证明。",
    "辅·暖联系人：体面跑道而非恐慌投递。",
    "辅·现金缓冲：公开动作前的硬指标。",
    "警戒：禁止长专业代做剧本。",
  ],
  metaphysics_action: [
    "主·开口场域：亮桌角与短走后开口，减少耗尽房间硬谈折损。",
    "主·时段窗口：午前更清；耗尽夜不硬谈。",
    "主·赞助顺风：温度当场域风，不当情绪燃料。",
    "辅·降低纠缠：暗夜与回避旧战场。",
    "辅·先恢复：公开动作前守睡眠底板。",
    "借力清单对齐主辅，而非通用风水模板。",
    "避坑：整页不得收成穿衣口诀。",
  ],
  thirty_day: [
    "第1周动作可追溯到 P3 主步骤与硬指标。",
    "第2周承接决策会，不另起推销文。",
    "第3周红灯触发才武装辅路。",
    "第4周复核 P1 辅路 when。",
    "近7日清单是第1–2周的可勾选切片。",
  ],
  risk_guard: [
    "红灯对齐赞助沉默与睡眠回流，不是泛泛「你累了」。",
    "特有坑：情绪再辩却不发框架。",
    "切辅开关绑定两盏红灯。",
    "防护法则守 ownership 与睡眠底板。",
    "边界短句只服务开口，非法务长稿。",
  ],
  signals_close: [
    "身份对照：从吸收催促到逼出选择。",
    "金句只服务定心，不做追踪钩子。",
    "今晚一件事：起草二选一句。",
    "近7日微清单可追溯 Action Brief，不是四周表。",
  ],
};

export function mockPageForPreview(
  key: DeliverySegmentKey,
  locale = "zh",
): DeliveryPageData {
  const pack = locale.startsWith("zh")
    ? DELIVERY_PAGE_SCHEMA_MOCK_ZH
    : null;
  const page = pack?.pages[key];
  if (!page) {
    throw new Error(`mock page missing: ${key}`);
  }
  return page;
}

export function mockEvidenceForPreview(
  key: DeliverySegmentKey,
  locale = "zh",
): string[] {
  if (locale.startsWith("zh")) {
    return DELIVERY_PAGE_SCHEMA_MOCK_EVIDENCE_ZH[key] ?? [];
  }
  // EN: thin placeholders matching argument count
  const page = mockPageForPreview(key, "zh");
  return pageSchemaToArgumentBodies(page).map((_, i) => `Evidence stub #${i + 1}`);
}
