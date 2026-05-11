export type BirthGender = "male" | "female" | "other";

export type BirthInfo = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  city?: string;
  latitude?: number;
  longitude?: number;
  gender: BirthGender;
};

export type UserProfile = {
  id: string;
  birth: BirthInfo;
  bazi: {
    yearPillar: string;
    monthPillar: string;
    dayPillar: string;
    hourPillar: string;
  };
  diagnosis: {
    dayMaster: string;
    favorableElements: string[];
    challengingElements: string[];
    patternSummary: string;
  };
  createdAt: number;
  updatedAt: number;
  source: "shunshi" | "fallback";
};
