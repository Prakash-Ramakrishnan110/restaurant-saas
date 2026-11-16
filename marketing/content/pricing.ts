export interface PricingPlan {
  id: string;
  nameEn: string;
  nameTa: string;
  yearlyPriceInr: number;
  summaryEn: string;
  summaryTa: string;
}

export interface PricingConfig {
  mode: "contact" | "listed";
  headlineEn: string;
  headlineTa: string;
  subtextEn: string;
  subtextTa: string;
  plans: PricingPlan[];
}

export const PRICING_CONFIG: PricingConfig = {
  mode: "contact",
  headlineEn: "Simple yearly plans. Talk to us about pilot pricing.",
  headlineTa: "எளிய வருடாந்திர திட்டங்கள். முன்னோட்ட விலைக்கு எங்களுடன் பேசுங்கள்.",
  subtextEn:
    "Every outlet is different. Book a quick call and we will share a clear yearly quote for your tea shop, cafe, restaurant or hotel.",
  subtextTa:
    "ஒவ்வொரு கடையும் வேறுபட்டது. உங்கள் தேநீர்க் கடை, கஃபே, உணவகம் அல்லது ஹோட்டலுக்கான தெளிவான வருடாந்திர விலையைப் பெற எங்களை அழைக்கவும்.",
  plans: [],
};
