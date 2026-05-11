/**
 * Oracle 签的等级 — 5 个等级,对应 5 张 PNG 背面
 */
export type GlyphLevel =
  | "divine_tailwind"
  | "fair_sky"
  | "still_water"
  | "crosswind"
  | "eye_of_storm";

/** 单签数据结构 — 100 签 JSON 中每个元素的格式 */
export interface SignData {
  sign_number: number;
  level: GlyphLevel;
  verse_lines_en: string[];
  summary_line_en: string;
  raw_md_content: string;
  level_zh?: string;
  story_figure?: string;
}

export interface UserInput {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthShichen: string;
  question: string;
}

export interface DrawResult {
  sign: SignData;
  drawnAt: number;
  userInput: UserInput;
}

export interface FullReading {
  wind_category_blurb: string;
  classical_voice: string;
  meaning_for_question: string;
  hidden_tension: string;
  your_moment: string;
  exploration: {
    text: string;
    timeframe: "today" | "tonight" | "within_24h" | "this_week";
    duration_estimate: string;
    is_solo: boolean;
  };
  reflection_question: string;
  metadata?: {
    tone?: string;
    key_insights?: string[];
    language?: string;
    word_count?: number;
  };
  /** True when question is gibberish / uninterpretable and UI should show one compact warning block. */
  invalid_input?: boolean;
}

export interface LevelMeta {
  level: GlyphLevel;
  display_name: string;
  subtitle: string;
  top_symbol: string;
  primary_color: string;
  accent_color: string;
  back_image_filename: string;
  border_class: string;
  shadow_color: string;
}

export const LEVEL_META: Record<GlyphLevel, LevelMeta> = {
  divine_tailwind: {
    level: "divine_tailwind",
    display_name: "Divine Tailwind",
    subtitle: "Pattern of Alignment",
    top_symbol: "✦ ✦ ✦ ✦ ✦",
    primary_color: "#FFD700",
    accent_color: "#F0ABFC",
    back_image_filename: "divine-tailwind.png",
    border_class: "border-yellow-400/40",
    shadow_color: "rgba(255, 215, 0, 0.20)",
  },
  fair_sky: {
    level: "fair_sky",
    display_name: "Fair Sky",
    subtitle: "Pattern of Openness",
    top_symbol: "✦ ✦ ✦ ✦",
    primary_color: "#A78BFA",
    accent_color: "#C4B5FD",
    back_image_filename: "fair-sky.png",
    border_class: "border-purple-400/40",
    shadow_color: "rgba(167, 139, 250, 0.20)",
  },
  still_water: {
    level: "still_water",
    display_name: "Still Water",
    subtitle: "Pattern of Patience",
    top_symbol: "✦ ✦ ✦",
    primary_color: "#6366F1",
    accent_color: "#818CF8",
    back_image_filename: "still-water.png",
    border_class: "border-indigo-400/40",
    shadow_color: "rgba(99, 102, 241, 0.18)",
  },
  crosswind: {
    level: "crosswind",
    display_name: "Crosswind",
    subtitle: "Pattern of Recalibration",
    top_symbol: "✦ ✦",
    primary_color: "#7C3AED",
    accent_color: "#A855F7",
    back_image_filename: "crosswind.png",
    border_class: "border-purple-500/40",
    shadow_color: "rgba(124, 58, 237, 0.20)",
  },
  eye_of_storm: {
    level: "eye_of_storm",
    display_name: "Eye of Storm",
    subtitle: "Pattern of Clarity",
    top_symbol: "◉",
    primary_color: "#FBBF24",
    accent_color: "#3B0764",
    back_image_filename: "eye-of-storm.png",
    border_class: "border-purple-900/50",
    shadow_color: "rgba(251, 191, 36, 0.15)",
  },
};
