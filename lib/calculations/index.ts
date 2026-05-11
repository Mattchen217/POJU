/**
 * v4.0 计算引擎入口（Batch1 Task 2.2）
 * 当前导出：M6 方位（Syncro 浏览模式）。其余模块在接入 shunshi-bazi-core 后扩展。
 */
export {
  calculateDirections,
  getHourBranchFromDate,
  getNextShichenBoundary,
} from "./modules/m6-directions";
export { calculateProfile } from "./profile";
export { approximateYongShenFromBirthYear } from "./yong-shen-placeholder";
export type {
  Direction8,
  DirectionRating,
  DirectionRatingLevel,
  DirectionsOutput,
  FiveElement,
  YongShenOutput,
} from "./types";
