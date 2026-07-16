/**
 * Qimen closed-set slugs — `qm_` prefix isolates from bazi (e.g. 六合 → qm_liu_he vs liuhe).
 */

export const QIMEN_SLUG = {
  // 八神 (8)
  值符: "qm_zhi_fu",
  騰蛇: "qm_teng_she",
  太陰: "qm_tai_yin",
  六合: "qm_liu_he",
  白虎: "qm_bai_hu",
  玄武: "qm_xuan_wu",
  九地: "qm_jiu_di",
  九天: "qm_jiu_tian",
  // 九星 (9)
  天蓬: "qm_tian_peng",
  天任: "qm_tian_ren",
  天冲: "qm_tian_chong",
  天輔: "qm_tian_fu",
  天英: "qm_tian_ying",
  天芮: "qm_tian_rui",
  天柱: "qm_tian_zhu",
  天心: "qm_tian_xin",
  天禽: "qm_tian_qin",
  // 八門 (8)
  休門: "qm_xiu_men",
  生門: "qm_sheng_men",
  傷門: "qm_shang_men",
  杜門: "qm_du_men",
  景門: "qm_jing_men",
  死門: "qm_si_men",
  驚門: "qm_jing2_men",
  開門: "qm_kai_men",
  // 宮位 (9)
  坎一宮: "qm_gong_kan",
  坤二宮: "qm_gong_kun",
  震三宮: "qm_gong_zhen",
  巽四宮: "qm_gong_xun",
  中五宮: "qm_gong_zhong",
  乾六宮: "qm_gong_qian",
  兌七宮: "qm_gong_dui",
  艮八宮: "qm_gong_gen",
  離九宮: "qm_gong_li",
  // 遁 (2) + 上中下元 (3)
  陽遁: "qm_yang_dun",
  陰遁: "qm_yin_dun",
  上元: "qm_yuan_shang",
  中元: "qm_yuan_zhong",
  下元: "qm_yuan_xia",
} as const;

export type QimenTraditional = keyof typeof QIMEN_SLUG;
