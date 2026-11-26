export type HardwareKitStatus = "READY" | "DRAFT";

export interface HardwareKit {
  id: "counter-token-tv" | "table-service" | "bring-your-own-device";
  status: HardwareKitStatus;
  /** Set true ONLY by the product owner after verifying real kit photo and contents. */
  ownerApproved: boolean;
  /** Filename strictly inside marketing/assets/photos/hardware/ when status is READY. */
  photo: string;
  titleEn: string;
  titleTa: string;
  summaryEn: string;
  summaryTa: string;
  contentsEn: string[];
  contentsTa: string[];
  /** Optional owner-entered notes (never claim model, brand, price, warranty, or installation unless owner wrote it). */
  ownerNotesEn?: string;
  ownerNotesTa?: string;
}

export const HARDWARE_KITS: HardwareKit[] = [
  {
    id: "counter-token-tv",
    status: "DRAFT",
    ownerApproved: false,
    photo: "",
    titleEn: "Counter kit with token TV",
    titleTa: "டோக்கன் டிவியுடன் கவுண்டர் தொகுப்பு",
    summaryEn:
      "For fast tea shops, bakeries, and self-service counters calling token numbers on a screen.",
    summaryTa:
      "தேநீர்க் கடை, பேக்கரி மற்றும் விரைவு கவுண்டர்களில் டோக்கன் எண்களை திரையில் அழைக்க.",
    contentsEn: [
      "Counter phone or tablet with web browser",
      "Kitchen display tablet or phone with speaker",
      "TV or monitor with web browser for token display",
      "Optional thermal slip printer (browser print)",
    ],
    contentsTa: [
      "இணைய உலாவி கொண்ட கவுண்டர் போன் அல்லது டேப்லெட்",
      "ஒலி வசதியுடன் சமையலறை டேப்லெட் அல்லது போன்",
      "டோக்கன் எண்களை காட்ட இணைய உலாவி கொண்ட டிவி திரை",
      "விருப்பத் தேர்வு ரசீது பிரிண்டர் (உலாவி வழி அச்சு)",
    ],
  },
  {
    id: "table-service",
    status: "DRAFT",
    ownerApproved: false,
    photo: "",
    titleEn: "Table service kit",
    titleTa: "உணவக பரிமாறும் சேவை தொகுப்பு",
    summaryEn:
      "For cafes, dining rooms, and hotel restaurants where waiters take orders and cashiers settle bills.",
    summaryTa:
      "பணியாளர்கள் ஆர்டர் எடுத்து கேஷியர் பில் போடும் கஃபே மற்றும் உணவகங்களுக்கு ஏற்றது.",
    contentsEn: [
      "Phones for waiters taking orders",
      "Kitchen screen tablet with sound chime",
      "Cashier laptop, desktop, or tablet",
      "Printed QR cards for dining spots",
    ],
    contentsTa: [
      "ஆர்டர் எடுக்கும் பணியாளர்களுக்கான போன்கள்",
      "ஒலி அறிவிப்புடன் கூடிய சமையலறை டேப்லெட் திரை",
      "கேஷியர் கணினி, லேப்டாப் அல்லது டேப்லெட்",
      "உணவருந்தும் இடங்களுக்கான அச்சிடப்பட்ட QR அட்டைகள்",
    ],
  },
  {
    id: "bring-your-own-device",
    status: "DRAFT",
    ownerApproved: false,
    photo: "",
    titleEn: "Bring your own device",
    titleTa: "உங்களிடம் உள்ள சாதனத்திலேயே பயன்படுத்துங்கள்",
    summaryEn:
      "Start right away in a modern web browser using phones, tablets, or computers you already own.",
    summaryTa:
      "உங்களிடம் ஏற்கனவே உள்ள Android போன், டேப்லெட் அல்லது கணினியின் உலாவியில் உடனே தொடங்கலாம்.",
    contentsEn: [
      "Any Android phone, tablet, laptop, or desktop with Chrome or Edge",
      "Shop Wi-Fi or regular 4G mobile data connection",
      "Any TV or monitor with a browser for counter token display",
    ],
    contentsTa: [
      "நவீன இணைய உலாவி உள்ள எந்த Android போன், டேப்லெட் அல்லது கணினி",
      "கடை Wi-Fi அல்லது சாதாரண 4G மொபைல் டேட்டா இணைப்பு",
      "கவுண்டர் டோக்கன் காட்ட உலாவி உள்ள எந்த டிவி அல்லது மானிட்டர்",
    ],
  },
];

export function getReadyHardwareKits(): HardwareKit[] {
  return HARDWARE_KITS.filter(
    (kit) =>
      kit.status === "READY" &&
      kit.ownerApproved === true &&
      kit.photo.trim().length > 0 &&
      kit.contentsEn.length > 0 &&
      kit.contentsTa.length > 0
  );
}
