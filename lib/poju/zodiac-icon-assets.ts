import type { StaticImageData } from "next/image";

import iconDog from "@/assets/icons/狗生肖LOGO.png";
import iconDragon from "@/assets/icons/龙生肖LOGO.png";
import iconGoat from "@/assets/icons/羊生肖LOGO.png";
import iconHorse from "@/assets/icons/马生肖LOGO.png";
import iconMonkey from "@/assets/icons/猴生肖LOGO.png";
import iconOx from "@/assets/icons/牛生肖LOGO.png";
import iconPig from "@/assets/icons/猪生肖LOGO.png";
import iconRabbit from "@/assets/icons/兔生肖LOGO.png";
import iconRat from "@/assets/icons/鼠生肖LOGO.png";
import iconRooster from "@/assets/icons/鸡生肖LOGO.png";
import iconSnake from "@/assets/icons/蛇生肖LOGO.png";
import iconTiger from "@/assets/icons/虎生肖LOGO.png";

/** Zodiac animal han → logo asset (assets/icons/*生肖LOGO.png). */
export const ZODIAC_ICON_BY_HAN: Record<string, StaticImageData> = {
  鼠: iconRat,
  牛: iconOx,
  虎: iconTiger,
  兔: iconRabbit,
  龙: iconDragon,
  蛇: iconSnake,
  马: iconHorse,
  羊: iconGoat,
  猴: iconMonkey,
  鸡: iconRooster,
  狗: iconDog,
  猪: iconPig,
};
