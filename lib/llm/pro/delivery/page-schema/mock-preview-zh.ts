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
      page_title: "主辅双轨决策盘",
      page_subtitle: "首选攻坚轨与安全止损轨的推演裁定",
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
      page_title: "结构卡点与深层病灶",
      page_subtitle: "剥离表象误区，锁定导致停滞的真实阻力",
      dashboard: [
        { key: "body", label: "身体负荷", score: 42, note: "来自 pack" },
        { key: "mind", label: "心智张力", score: 68, note: "来自 pack" },
        { key: "field", label: "场域摩擦", score: 55, note: "来自 pack" },
      ],
      why_cards: [
        {
          title: "职场二选一",
          surface:
            "收集里反复出现：海外一线硬冲还是退居二线——像一道必须立刻站队的二选一，外加老板催结果。",
          essence:
            "本质不是缺勇气选边，而是结果权与一线冲锋绑死：需养结构下仍被高压任务拖着证明，边界从未写成可选择的取舍。",
        },
        {
          title: "身体报警",
          surface: "失眠、血压波动、休息后仍像没充上电——身体已经在喊停，日程却继续加码。",
          essence:
            "身体负荷滞后于心智过载：系统闸门错位，卡的是续航与释放权，不是某一场会开砸了。",
        },
        {
          title: "深夜清不掉",
          surface: "Slack/消息深夜一响，白天攒的蓄力当场清空；休息从不复利。",
          essence:
            "阻力维：外部催促直接穿透个人节律。因此主辅成立——结果权可守、一线冲锋必须拆开，否则续航闸门永远合不上。",
        },
      ],
      evidence: [],
    },
    science_action: {
      page: "science_action",
      page_title: "职场博弈与逐字剧本",
      page_subtitle: "可直接复用的硬核策略、步骤与开口话术",
      opening: "先用范围数学说话，不要用情绪开战。",
      primary_toolkit: {
        role: "primary",
        title: "半年过渡·远程操盘 + 授权副手落地",
        angles: [
          {
            name: "边界谈判",
            strategy:
              "主路要先把「无限催促」改成可勾选的书面边界：赞助每次加需求，必须在两条取舍里选一条——保 A 就推迟 B，或保 B 就挪 A。你不再用情绪硬扛范围，而是用二选一逼对方表态；谈成后，远程操盘才有可守的周带宽。",
            exact_script:
              "老板，这周带宽只够扛一件：周五前我能把 A 交齐，前提是本周拿掉 B；或者保留 B，把 A 挪到下周三。请直接回「选A」或「选B」，我按你的选择改日历。",
            means: [
              "列出本周 Top3 承诺与各自小时数，删掉无法并行的项后，只留给对方两个选项",
              "发出二选一取舍邮件/微信，并同周约 20 分钟决策会把选择钉死",
            ],
            hard_metrics: ["赞助 48h 内书面回复选 A 或选 B"],
          },
          {
            name: "授权与副手",
            strategy:
              "主路的第二维是拆开「结果权」与「一线冲锋」：你留供应链节点、交付质量与风险闸门；可培养副手主持站会、扛火情。授权不是甩锅，而是让远程操盘可持续——状态会从你日历迁出后，赞助仍找你要结果，但默认冲锋不再落在你身上。",
            exact_script:
              "我想把一线冲锋交给你：从下周起每日站会由你主持，我只看结果与风险闸门。第一周你先带两场，周五复盘缺口；你接得住，就把状态会从我日历挪走。",
            means: [
              "书面两行划清副手接什么、你留什么，并把状态会改到副手日历",
              "设周五 30 分钟复盘：只看交付、风险、需你拍板的事",
            ],
            hard_metrics: ["连续 7 天你亲自扛的一线火情 ≤2"],
          },
          {
            name: "节奏与身体护栏",
            strategy:
              "主路第三维是把身体底板写成可见规则：远程操盘靠清醒判断，不靠熬夜证明忠诚。把 22:00 后不回工作消息、硬谈落在午前写进团队窗口；连续短睡就改期硬谈。护栏不是鸡汤，是主路能跑满半年的前提条件。",
            exact_script:
              "我这边固定规则：工作日 22:00 后不回 Slack/微信工作消息，紧急事项请第二天 9:00 前发我。硬谈排午前；连续熬夜后我不排硬谈判。",
            means: [
              "团队频道置顶夜间不回规则并关夜间推送；硬谈前留一次短走",
              "连续三晚睡眠不足时，主动把次日硬谈改到午前",
            ],
            hard_metrics: ["连续 7 天 22:00 后零工作回复"],
          },
        ],
      },
      backup_toolkit: {
        role: "backup",
        title: "内部转岗 / 收缩业务范围",
        angles: [
          {
            name: "战绩打包",
            strategy:
              "切辅时先把「不可替代」从体力证明改成资产证明：安静整理近 12 个月交付、控本与风险闸门，给赞助可见成果打日期戳。没有这份夹，内转或收缩会变成裸退叙事；有了它，止损才体面。",
            exact_script:
              "我在整理近 12 个月交付与控本摘要，方便交接或内转评估。请确认两件可见成果的日期与口径，周五回一句「确认」即可，不必开会。",
            means: [
              "导出战绩夹（交付/控本/风险各 2–3 条），给两件赞助可见成果打日期戳",
              "请赞助一句话书面确认口径并截图归档",
            ],
            hard_metrics: ["战绩夹含日期戳成果 ≥2"],
          },
          {
            name: "暖联系人",
            strategy:
              "辅路第二维用暖关系护体面跑道：每周只更新一个可信联系人，交换信息而非恐慌投递。同时起草一个软着陆头衔（如供应链高级顾问）与一句价值主张，让下一站有落点可说，而不是公开求职式消耗。",
            exact_script:
              "最近在评估内部转岗/顾问方向，想请你看一眼：以我过去控本与交付记录，更适合哪类头衔落点？不用帮转推，回我你的直觉就好。",
            means: [
              "本周只更新 1 个暖联系人；起草软着陆头衔 + 一句价值主张后再发",
            ],
            hard_metrics: ["本周 ≥1 次暖联系人更新并有回复"],
          },
          {
            name: "现金缓冲",
            strategy:
              "辅路第三维是公开动作前的硬闸：先钉死两个月 burn 缓冲目标日，达标前冻结新的英雄式 ownership，也不发离职/转岗公开宣布。缓冲不是怂，是避免情绪性跳槽把止损做成二次受伤。",
            exact_script:
              "我设了缓冲目标：账户可覆盖两个月 burn 之前，不做公开离职/转岗宣布。本周只冻结新的英雄式 ownership，并把缓冲进度钉在日历上。",
            means: [
              "算出两个月 burn，日历钉缓冲达标检查日；达标前零公开宣布",
              "冻结新英雄式 ownership，已接事项标出可移交项",
            ],
            hard_metrics: ["缓冲 ≥ 2 个月 burn 前零公开宣布"],
          },
        ],
      },
      alert: "这里只要可改写开口，不要写完整律师/HR 剧本。",
      evidence: [],
    },
    metaphysics_action: {
      page: "metaphysics_action",
      page_title: "局势调频与环境杠杆",
      page_subtitle: "非对称借力、避坑节点与场域反常识决策",
      question_anchor:
        "海外一线硬冲还是退居二线——怎么在半年窗口里既保结果话语权又护住身体。",
      desired_outcome:
        "走出可持续的远程操盘形态：赞助仍找我要结果，一线火情不再默认落在我身上。",
      dimensions: [
        {
          name: "色彩与着装锚定",
          strategy:
            "就「保结果话语权、降一线消耗」这件事：用盘面喜用色做视觉能量锚定，关键开口与赞助可见场合穿/佩这些色，帮你稳住输出感，而不是再靠硬扛刷存在感。",
          means: [
            "关键会与书面沟通日，主色用深蓝/墨黑系外层（与喜用色锚一致）",
            "少用大面积刺眼高饱和撞色作主场着装，避免视觉上的「硬冲」信号",
          ],
          hard_metrics: [],
        },
        {
          name: "方位与空间朝向",
          strategy:
            "远程操盘要的是可持续输出：工位与开口朝向优先落在本盘高适配方向，减少在耗尽朝向里开硬谈——这是空间效能适配，不是另开科学谈判剧本。",
          means: [
            "深工与关键开口优先坐在已标为高适配的一侧（如东南/正东桌角，以 pack 优选为准）",
            "硬谈视频尽量背靠稳定墙面、面朝清亮一侧，避开长期背光耗尽位",
          ],
          hard_metrics: [],
        },
        {
          name: "精力高频时段",
          strategy:
            "把推进这件事的关键动作排进本盘更匹配的高频时段；耗尽段只做整理、不做硬推进——用时辰节律护「可持续」期望。",
          means: [
            "边界/范围确认类动作优先排在午前清档时段",
            "连续熬夜后的夜间段不排硬推进，只做归档与恢复",
          ],
          hard_metrics: [],
        },
        {
          name: "大运与阶段年窗",
          strategy:
            "对照当前大运/阶段：近窗更利「结构改造与远程操盘定型」，不适合再加一线冲锋债；更远的窗口才适合扩大对外开拓——阶段定性指导节奏，不报绝对吉凶日期。",
          means: [
            "未来 1–2 年：把精力放在远程操盘结构与授权落地上，少开新的一线战场",
            "结构稳定后的后续年窗，再加大对外开拓比重（仍以身体底板为闸）",
          ],
          hard_metrics: [],
        },
        {
          name: "用神补与忌神避",
          strategy:
            "补喜用、避忌神消耗：补的是能支撑「后方操盘」的清润与节奏；避的是再把火气绑死在一线硬冲上——直接服务这件事业选择。",
          means: [
            "日常场域多留清水/绿植/短走恢复，作为补的可见动作",
            "少在高压庆功/争吵场里久留，避开忌神式纠缠耗尽",
          ],
          hard_metrics: [],
        },
      ],
      leverage: ["用本盘高适配方位 + 喜用色，把关键开口做成「场域顺风」而不是硬刚"],
      avoid: [
        "不要写成穿衣口诀墙或属相吉凶",
        "不要复读科学页的邮件/授权/日历手段",
      ],
      field_matrix: [
        { label: "着装锚", value: "深蓝 / 墨黑" },
        { label: "朝向", value: "高适配侧工位" },
        { label: "时段", value: "午前清档" },
        { label: "年窗", value: "近窗定结构 · 后窗再开拓" },
      ],
      evidence: [],
    },
    thirty_day: {
      page: "thirty_day",
      page_title: "四周推进节奏（已退役）",
      page_subtitle: "仅兼容旧会话",
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
      page_title: "熔断红线与退路开关",
      page_subtitle: "设定底线边界，明确主辅方案的切换触发点",
      red_lights: [
        {
          situation: "书面取舍发出后，赞助沉默超过 10 天仍无答复",
          then_do: "冻结新英雄式 ownership；只发一次状态确认后停止追问",
          watch: "沉默是否与深夜 Slack 回流叠在一起",
          forbid: "禁止在没有书面框架时用情绪再辩一轮",
        },
        {
          situation: "硬谈未开、深夜 Slack 已连续回流 3 晚",
          then_do: "硬谈改到睡眠底板恢复两晚之后；先守休息",
          watch: "次日血压/烦躁是否抬头",
          forbid: "禁止刚打完深夜火情立刻谈边界",
        },
      ],
      traps: [
        {
          situation: "用情绪再辩一轮，却迟迟不发二选一框架",
          then_do: "改写成 A/B 取舍句并只发一次",
          watch: "想靠加班证明忠诚的冲动",
          forbid: "禁止两头都扛来「维稳」",
        },
      ],
      switch_to_backup: {
        situation: "两盏红灯齐亮，且赞助仍拒绝清楚范围",
        then_do: "冻结重谈；启动两周安静退出/顾问化准备",
        watch: "主路径是否还在加塞无偿 ownership",
        forbid: "禁止「再撑一程」继续硬冲主路径",
      },
      protection_rules: [
        {
          situation: "紧急需求来了，却没有书面取舍",
          then_do: "先要 A 或 B，再接受 ownership",
          watch: "英雄式 ownership 是否又爬回日历",
          forbid: "没有书面取舍不接新英雄式 ownership",
        },
        {
          situation: "「紧急周」威胁睡眠底板",
          then_do: "先守睡眠；硬谈改到上午窗口",
          watch: "赞助会前是否连续熬夜",
          forbid: "禁止用烧睡眠底板证明自己不可或缺",
        },
      ],
      boundary_script: "这周我能扛 A 或 B，不能两个都扛。你定一个。",
      evidence: [],
    },
    signals_close: {
      page: "signals_close",
      page_title: "今晚一件事与首周清单",
      page_subtitle: "身份重塑、定心金句、即刻闭环与近 7 日 Checklist",
      identity_before: "总是冲在一线的救火者",
      identity_after: "守住决策、授权执行的操盘手",
      identity_shift:
        "本案主路是远程操盘+授权副手：价值在供应链决策与风险把关，不在高频飞行冲锋。身份必须跟着主路切，否则会滑回硬扛。",
      quote: "清晰，是你欠未来自己的一份善意。",
      quote_use: "想答应「再飞一趟就好」时，先默念这句，再只看今晚那一件事有没有做完。",
      immediate_action: "今晚写半页纸：你控后台决策，副手跑前线执行——列清你留什么、他接什么。",
      tonight_done_looks_like: "半页草稿落在可打开的文档里，至少写出「你留 / 他接」两栏，不是只在脑子里过一遍。",
      tonight_why: "拖过今晚，摇摆会把你拉回一线硬扛；有纸面边界，明天谈授权才站得住。",
      day7_micro_actions: [
        {
          action: "固定上床 23:00，连续守睡眠底板",
          why: "恢复是主路判断力的底线，不是私事。",
          done_when: "连续 ≥3 晚睡眠可勾选记录。",
        },
        {
          action: "书面交出两个副手可独立对接的环节",
          why: "授权要有证据，才能谈远程操盘。",
          done_when: "清单发出且对方确认收到。",
        },
        {
          action: "约一次老板沟通窗口（先约时间）",
          why: "把折中从念头变成日程，避免无限拖延。",
          done_when: "日历上有确定的会面或通话时段。",
        },
        {
          action: "起草远程操盘三要点（不常驻、关键节点、结果考核）",
          why: "开口前有骨架，才不会又谈成身体诉苦。",
          done_when: "三要点写进同一份半页稿可复述。",
        },
      ],
      takeaways: [
        "主路：远程操盘+授权，不硬接一线。",
        "本周杠杆：睡眠底板+副手书面交接。",
        "熔断：谈不下或身体连亮红灯 → 切辅。",
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
    "多表象分卡：职场二选一、身体报警、深夜清不掉——各来自收集，互不换皮。",
    "每卡先钉真实表象，再写对该表象的本质分析。",
    "最后一张收束到因此主辅成立。",
    "仪表盘只用 pack 真分。",
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
    "问题/期望锚定：本页服务这件事情，不挂主辅轨。",
    "色彩着装：喜用色锚定关键场合，稳住输出感而非硬冲。",
    "方位朝向：高适配侧工位/开口；避耗尽朝向硬谈。",
    "精力时段：关键推进排午前清档；耗尽夜只归档。",
    "大运年窗：近窗定远程结构，后窗再开拓——阶段定性非绝对日期。",
    "用神补避：补清润节奏，避一线纠缠耗尽。",
    "借力：色+向做成场域顺风；禁复读科学页邮件/授权手段。",
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
    "身份对照：从一线救火到守决策授权；shift 须对准本案主路。",
    "金句+用法：定心，不做追踪钩子。",
    "今晚闭环：半页分工稿，做成什么样与为何今晚写清。",
    "近7日条目卡可追溯 Action Brief，不是四周表。",
    "带走三样：决策 / 杠杆 / 熔断各一行。",
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
